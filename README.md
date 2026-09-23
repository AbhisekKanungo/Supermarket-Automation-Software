# Supermarket-Automation-Software

FastAPI + PostgreSQL backend for supermarket POS billing, atomic stock management, daily price adjustments, and financial reports.

## Prerequisites & Setup

Ensure Python 3.10+ and PostgreSQL 15+ are installed.

```bash
# Clone the repository and enter directory
git clone https://github.com/AbhisekKanungo/Supermarket-Automation-Software
cd sas_backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\\Scripts\\activate

# Install required dependencies
pip install -r requirements.txt
```

## Database Initialization

Ensure PostgreSQL is running locally, then create the database and run the seed script:

```bash
createdb sas_db
python seed.py
```

## How to Run & Verify

Start the development server:

```bash
uvicorn app.main:app --reload
```

- Base URL: [http://localhost:8000](http://localhost:8000)
- Interactive API Documentation (Swagger UI): [http://localhost:8000/docs](http://localhost:8000/docs)

## API & Test Cheatsheet

### Endpoints

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| GET | `/api/v1/items/barcode/{code}` | Scan item / scale lookup |
| POST | `/api/v1/sales/checkout` | Process sale & print bill |
| POST | `/api/v1/inventory/restock` | Restock incoming shipment |
| PATCH | `/api/v1/items/{barcode}/price` | Update daily selling price |
| GET | `/api/v1/inventory` | Inspect current stock levels |
| GET | `/api/v1/reports/sales-stats` | Generate revenue & profit report |

### Testing

Run automated unit tests and check test coverage:

```bash
pytest -v --cov=app --cov-report=term-missing tests/
```
