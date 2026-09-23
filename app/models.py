from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base

class ItemInventory(Base):
    __tablename__ = "items_inventory"

    item_id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    is_weighted = Column(Boolean, default=False)
    cost_price = Column(Numeric(10, 2), nullable=False)
    current_price = Column(Numeric(10, 2), nullable=False)
    stock_quantity = Column(Numeric(10, 3), nullable=False, default=0.000)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    line_items = relationship("SalesLineItem", back_populates="item")

class SalesBill(Base):
    __tablename__ = "sales_bills"

    bill_id = Column(Integer, primary_key=True, index=True)
    clerk_id = Column(String(50), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False, default=0.00)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    line_items = relationship("SalesLineItem", back_populates="bill")

class SalesLineItem(Base):
    __tablename__ = "sales_line_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("sales_bills.bill_id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items_inventory.item_id"), nullable=False)
    quantity = Column(Numeric(10, 3), nullable=False)
    sold_unit_price = Column(Numeric(10, 2), nullable=False)
    sold_cost_price = Column(Numeric(10, 2), nullable=False)
    line_total = Column(Numeric(10, 2), nullable=False)

    bill = relationship("SalesBill", back_populates="line_items")
    item = relationship("ItemInventory", back_populates="line_items")