# seed.py
from decimal import Decimal
from app.database import engine, SessionLocal, Base
from app.models import ItemInventory

# 1. Create tables in PostgreSQL
Base.metadata.create_all(bind=engine)

# 2. Seed initial mock inventory
db = SessionLocal()

if db.query(ItemInventory).count() == 0:
    items = [
        ItemInventory(barcode="8901030", name="Fortune Basmati Rice 1kg", is_weighted=False, cost_price=Decimal("80.00"), current_price=Decimal("110.00"), stock_quantity=Decimal("50.000")),
        ItemInventory(barcode="8901230", name="Fresh Shimla Apples", is_weighted=True, cost_price=Decimal("120.00"), current_price=Decimal("170.00"), stock_quantity=Decimal("30.500")),
        ItemInventory(barcode="8901450", name="Amul Butter 100g", is_weighted=False, cost_price=Decimal("45.00"), current_price=Decimal("56.00"), stock_quantity=Decimal("40.000")),
        ItemInventory(barcode="8901670", name="Loose Potatoes", is_weighted=True, cost_price=Decimal("18.00"), current_price=Decimal("28.00"), stock_quantity=Decimal("100.000")),
    ]
    db.add_all(items)
    db.commit()
    print("✅ Database tables created and 4 test products seeded successfully!")
else:
    print("ℹ️ Tables already exist and contain data.")

db.close()