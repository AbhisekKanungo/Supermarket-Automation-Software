# app/main.py
from decimal import Decimal
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import engine, SessionLocal, Base, get_db
from app.models import ItemInventory, SalesBill, SalesLineItem

app = FastAPI(title="Supermarket Automation Software (SAS) Backend", version="1.0.0")

# Enable CORS for local frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Pydantic DTOs -----------------

class CartItemInput(BaseModel):
    barcode: str
    quantity: Decimal = Field(gt=0, decimal_places=3)

class CheckoutRequest(BaseModel):
    clerk_id: str
    items: List[CartItemInput]

class BillLineItemResponse(BaseModel):
    barcode: str
    item_name: str
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal

class BillResponse(BaseModel):
    serial_number: int
    created_at: datetime
    clerk_id: str
    line_items: List[BillLineItemResponse]
    total_amount_payable: Decimal

class RestockPayload(BaseModel):
    barcode: str
    quantity_added: Decimal = Field(gt=0, decimal_places=3)

class PriceUpdatePayload(BaseModel):
    new_price: Decimal = Field(gt=0, decimal_places=2)

class SalesStatItem(BaseModel):
    item_id: int
    barcode: str
    item_name: str
    quantity_sold: Decimal
    price_realized: Decimal
    total_cost: Decimal
    profit: Decimal

# ----------------- API Endpoints -----------------

@app.get("/api/v1/items/barcode/{code}")
def scan_item(code: str, db: Session = Depends(get_db)):
    """Simulates barcode scanner lookup."""
    item = db.query(ItemInventory).filter(ItemInventory.barcode == code).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return {
        "item_id": item.item_id,
        "barcode": item.barcode,
        "name": item.name,
        "is_weighted": item.is_weighted,
        "current_price": float(item.current_price),
        "stock_available": float(item.stock_quantity)
    }

@app.post("/api/v1/sales/checkout", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
def checkout(payload: CheckoutRequest, db: Session = Depends(get_db)):
    """
    Atomic Checkout:
    1. Locks inventory rows (SELECT FOR UPDATE)
    2. Validates available stock
    3. Decrements inventory
    4. Snapshots sold prices and costs
    5. Commits bill with unique serial number
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    with db.begin():
        bill = SalesBill(clerk_id=payload.clerk_id, total_amount=Decimal("0.00"))
        db.add(bill)
        db.flush()  # Generates serial bill_id

        total_payable = Decimal("0.00")
        line_item_responses = []

        for cart_item in payload.items:
            # Row-level lock to prevent concurrency conflicts
            item = db.query(ItemInventory).filter(
                ItemInventory.barcode == cart_item.barcode
            ).with_for_update().first()

            if not item:
                raise HTTPException(status_code=404, detail=f"Barcode {cart_item.barcode} not found")

            if item.stock_quantity < cart_item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{item.name}'. Available: {item.stock_quantity}, Requested: {cart_item.quantity}"
                )

            # Atomic decrement
            item.stock_quantity -= cart_item.quantity

            # Point-in-time calculation
            subtotal = (cart_item.quantity * item.current_price).quantize(Decimal("0.01"))
            total_payable += subtotal

            line_item = SalesLineItem(
                bill_id=bill.bill_id,
                item_id=item.item_id,
                quantity=cart_item.quantity,
                sold_unit_price=item.current_price,
                sold_cost_price=item.cost_price,
                line_total=subtotal
            )
            db.add(line_item)

            line_item_responses.append(
                BillLineItemResponse(
                    barcode=item.barcode,
                    item_name=item.name,
                    quantity=cart_item.quantity,
                    unit_price=item.current_price,
                    line_total=subtotal
                )
            )

        bill.total_amount = total_payable

    db.refresh(bill)
    return BillResponse(
        serial_number=bill.bill_id,
        created_at=bill.created_at,
        clerk_id=bill.clerk_id,
        line_items=line_item_responses,
        total_amount_payable=total_payable
    )

@app.post("/api/v1/inventory/restock")
def restock_item(payload: RestockPayload, db: Session = Depends(get_db)):
    """Restocks inventory when a new shipment arrives."""
    item = db.query(ItemInventory).filter(ItemInventory.barcode == payload.barcode).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.stock_quantity += payload.quantity_added
    db.commit()
    return {
        "message": f"Restocked {item.name}",
        "barcode": item.barcode,
        "new_stock_quantity": float(item.stock_quantity)
    }

@app.patch("/api/v1/items/{barcode}/price")
def update_price(barcode: str, payload: PriceUpdatePayload, db: Session = Depends(get_db)):
    """Manager adjusts the daily selling price."""
    item = db.query(ItemInventory).filter(ItemInventory.barcode == barcode).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.current_price = payload.new_price
    db.commit()
    return {
        "message": f"Price updated for {item.name}",
        "barcode": item.barcode,
        "new_price": float(item.current_price)
    }

@app.get("/api/v1/inventory")
def get_inventory(db: Session = Depends(get_db)):
    """Manager views current stock levels."""
    items = db.query(ItemInventory).all()
    return [
        {
            "item_id": i.item_id,
            "barcode": i.barcode,
            "name": i.name,
            "is_weighted": i.is_weighted,
            "stock_quantity": float(i.stock_quantity),
            "current_price": float(i.current_price),
            "cost_price": float(i.cost_price),
        }
        for i in items
    ]

@app.get("/api/v1/reports/sales-stats", response_model=List[SalesStatItem])
def get_sales_stats(start_date: datetime, end_date: datetime, db: Session = Depends(get_db)):
    """Generates sales statistics, revenue realized, and net profit over a selected period."""
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")

    results = (
        db.query(
            ItemInventory.item_id,
            ItemInventory.barcode,
            ItemInventory.name.label("item_name"),
            func.sum(SalesLineItem.quantity).label("quantity_sold"),
            func.sum(SalesLineItem.line_total).label("price_realized"),
            func.sum(SalesLineItem.quantity * SalesLineItem.sold_cost_price).label("total_cost"),
            func.sum(SalesLineItem.line_total - (SalesLineItem.quantity * SalesLineItem.sold_cost_price)).label("profit")
        )
        .join(SalesBill, SalesLineItem.bill_id == SalesBill.bill_id)
        .join(ItemInventory, SalesLineItem.item_id == ItemInventory.item_id)
        .filter(SalesBill.created_at >= start_date, SalesBill.created_at <= end_date)
        .group_by(ItemInventory.item_id, ItemInventory.barcode, ItemInventory.name)
        .all()
    )

    return [
        SalesStatItem(
            item_id=r.item_id,
            barcode=r.barcode,
            item_name=r.item_name,
            quantity_sold=Decimal(r.quantity_sold or 0),
            price_realized=Decimal(r.price_realized or 0),
            total_cost=Decimal(r.total_cost or 0),
            profit=Decimal(r.profit or 0)
        )
        for r in results
    ]