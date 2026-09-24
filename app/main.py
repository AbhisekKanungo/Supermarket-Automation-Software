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
    status: str
    line_items: List[BillLineItemResponse]
    total_amount_payable: Decimal

class CreateItemPayload(BaseModel):
    barcode: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=150)
    is_weighted: bool = False
    cost_price: Decimal = Field(gt=0, decimal_places=2)
    stock_quantity: Decimal = Field(ge=0, decimal_places=3, default=Decimal("0.000"))

class ManagerApprovePayload(BaseModel):
    selling_price: Decimal = Field(gt=0, decimal_places=2)

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

# ----------------- POS & Scanner Endpoints -----------------

@app.get("/api/v1/items/barcode/{code}")
def scan_item(code: str, db: Session = Depends(get_db)):
    """Simulates barcode scanner lookup for active, approved items."""
    item = db.query(ItemInventory).filter(ItemInventory.barcode == code).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.approval_status != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail=f"Item '{item.name}' is pending manager approval (status: {item.approval_status}) and cannot be billed"
        )

    if item.current_price is None:
        raise HTTPException(status_code=400, detail=f"Selling price is not set for '{item.name}'")

    return {
        "item_id": item.item_id,
        "barcode": item.barcode,
        "name": item.name,
        "is_weighted": item.is_weighted,
        "current_price": float(item.current_price),
        "stock_available": float(item.stock_quantity),
        "approval_status": item.approval_status
    }

@app.post("/api/v1/sales/checkout", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
def checkout(payload: CheckoutRequest, db: Session = Depends(get_db)):
    """
    Atomic Checkout:
    1. Sorts items deterministically to avoid deadlocks
    2. Locks inventory rows (SELECT FOR UPDATE)
    3. Verifies item is approved and priced
    4. Validates stock and atomically decrements
    5. Commits bill with COMPLETED status
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    sorted_cart = sorted(payload.items, key=lambda x: x.barcode)

    with db.begin():
        bill = SalesBill(
            clerk_id=payload.clerk_id,
            total_amount=Decimal("0.00"),
            status="COMPLETED"
        )
        db.add(bill)
        db.flush()

        total_payable = Decimal("0.00")
        line_item_responses = []

        for cart_item in sorted_cart:
            item = db.query(ItemInventory).filter(
                ItemInventory.barcode == cart_item.barcode
            ).with_for_update().first()

            if not item:
                raise HTTPException(status_code=404, detail=f"Barcode {cart_item.barcode} not found")

            if item.approval_status != "APPROVED" or item.current_price is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Item '{item.name}' is not approved for retail sale"
                )

            if item.stock_quantity < cart_item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{item.name}'. Available: {item.stock_quantity}, Requested: {cart_item.quantity}"
                )

            item.stock_quantity -= cart_item.quantity

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
        status=bill.status,
        line_items=line_item_responses,
        total_amount_payable=total_payable
    )

@app.post("/api/v1/sales/{bill_id}/cancel")
def cancel_sale(bill_id: int, db: Session = Depends(get_db)):
    """
    Cashier voids an order:
    1. Locks the bill record
    2. Validates it hasn't been cancelled already
    3. Restores inventory quantities inside the transaction
    4. Marks bill status as CANCELLED
    """
    with db.begin():
        bill = db.query(SalesBill).filter(SalesBill.bill_id == bill_id).with_for_update().first()
        if not bill:
            raise HTTPException(status_code=404, detail=f"Bill with ID {bill_id} not found")

        if bill.status == "CANCELLED":
            raise HTTPException(status_code=400, detail="Bill is already cancelled")

        line_items = db.query(SalesLineItem).filter(SalesLineItem.bill_id == bill_id).all()
        sorted_lines = sorted(line_items, key=lambda x: x.item_id)

        for line in sorted_lines:
            item = db.query(ItemInventory).filter(
                ItemInventory.item_id == line.item_id
            ).with_for_update().first()

            if item:
                item.stock_quantity += line.quantity

        bill.status = "CANCELLED"

    return {
        "message": f"Bill #{bill_id} successfully cancelled and stock restored",
        "bill_id": bill_id,
        "status": "CANCELLED"
    }

# ----------------- Inventory & Maker-Checker Endpoints -----------------

@app.post("/api/v1/items", status_code=status.HTTP_201_CREATED)
def employee_create_or_update_item(payload: CreateItemPayload, db: Session = Depends(get_db)):
    """
    Employee registers a new item or updates basic item metadata.
    Submitted items enter PENDING status and require Manager Approval for retail price.
    """
    item = db.query(ItemInventory).filter(ItemInventory.barcode == payload.barcode).first()

    if item:
        # Existing item: update details, but reset to PENDING if cost/specs change
        item.name = payload.name
        item.is_weighted = payload.is_weighted
        item.cost_price = payload.cost_price
        item.stock_quantity += payload.stock_quantity
        item.approval_status = "PENDING"
        db.commit()
        db.refresh(item)
        return {
            "message": f"Item '{item.name}' updated and submitted for manager approval",
            "barcode": item.barcode,
            "stock_quantity": float(item.stock_quantity),
            "approval_status": item.approval_status
        }

    # Brand new item
    new_item = ItemInventory(
        barcode=payload.barcode,
        name=payload.name,
        is_weighted=payload.is_weighted,
        cost_price=payload.cost_price,
        current_price=None,  # Requires manager assignment
        stock_quantity=payload.stock_quantity,
        approval_status="PENDING"
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return {
        "message": f"New item '{new_item.name}' registered. Awaiting manager approval.",
        "barcode": new_item.barcode,
        "stock_quantity": float(new_item.stock_quantity),
        "approval_status": new_item.approval_status
    }

@app.get("/api/v1/manager/items/pending")
def list_pending_items(db: Session = Depends(get_db)):
    """Manager views all items awaiting approval and retail pricing."""
    items = db.query(ItemInventory).filter(ItemInventory.approval_status == "PENDING").all()
    return [
        {
            "item_id": i.item_id,
            "barcode": i.barcode,
            "name": i.name,
            "is_weighted": i.is_weighted,
            "cost_price": float(i.cost_price),
            "stock_quantity": float(i.stock_quantity),
            "approval_status": i.approval_status
        }
        for i in items
    ]

@app.patch("/api/v1/manager/items/{barcode}/approve")
def approve_item(barcode: str, payload: ManagerApprovePayload, db: Session = Depends(get_db)):
    """Manager assigns retail selling price and activates the item for sales."""
    with db.begin():
        item = db.query(ItemInventory).filter(
            ItemInventory.barcode == barcode
        ).with_for_update().first()

        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        if payload.selling_price < item.cost_price:
            raise HTTPException(
                status_code=400,
                detail=f"Selling price ({payload.selling_price}) cannot be below cost price ({item.cost_price})"
            )

        item.current_price = payload.selling_price
        item.approval_status = "APPROVED"

    return {
        "message": f"Item '{item.name}' approved and active for POS checkout",
        "barcode": item.barcode,
        "selling_price": float(item.current_price),
        "approval_status": item.approval_status
    }

@app.post("/api/v1/inventory/restock")
def restock_item(payload: RestockPayload, db: Session = Depends(get_db)):
    """Restocks inventory for existing products."""
    with db.begin():
        item = db.query(ItemInventory).filter(
            ItemInventory.barcode == payload.barcode
        ).with_for_update().first()

        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        item.stock_quantity += payload.quantity_added

    return {
        "message": f"Restocked {item.name}",
        "barcode": item.barcode,
        "new_stock_quantity": float(item.stock_quantity)
    }

@app.patch("/api/v1/items/{barcode}/price")
def update_price(barcode: str, payload: PriceUpdatePayload, db: Session = Depends(get_db)):
    """Manager adjusts selling price for an already approved product."""
    with db.begin():
        item = db.query(ItemInventory).filter(
            ItemInventory.barcode == barcode
        ).with_for_update().first()

        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        item.current_price = payload.new_price

    return {
        "message": f"Price updated for {item.name}",
        "barcode": item.barcode,
        "new_price": float(item.current_price)
    }

@app.get("/api/v1/inventory")
def get_inventory(db: Session = Depends(get_db)):
    """Manager/Employee views full catalog with statuses."""
    items = db.query(ItemInventory).all()
    return [
        {
            "item_id": i.item_id,
            "barcode": i.barcode,
            "name": i.name,
            "is_weighted": i.is_weighted,
            "stock_quantity": float(i.stock_quantity),
            "cost_price": float(i.cost_price),
            "current_price": float(i.current_price) if i.current_price is not None else None,
            "approval_status": i.approval_status
        }
        for i in items
    ]

# ----------------- Reports -----------------

@app.get("/api/v1/reports/sales-stats", response_model=List[SalesStatItem])
def get_sales_stats(start_date: datetime, end_date: datetime, db: Session = Depends(get_db)):
    """Generates sales statistics, revenue realized, and net profit over a selected period for completed bills."""
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
        .filter(
            SalesBill.created_at >= start_date,
            SalesBill.created_at <= end_date,
            SalesBill.status == "COMPLETED"
        )
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