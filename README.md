# Supermarket-Automation-Software

Supermarket automation software (SAS): billing at the counter, inventory management, price control, and sales statistics.

- **Backend:** FastAPI + PostgreSQL. Handles POS billing, atomic stock updates, daily price changes, and profit reports.
- **Frontend:** React + TypeScript (Vite) with Tailwind CSS. Role-based screens for employees and managers.

## Features

| Requirement | Where |
| --- | --- |
| Print a bill with serial number, item name, code, quantity, unit price, item price, and total | Billing page (employee) |
| Inventory decreases automatically on every sale | Backend checkout |
| Void/Cancel bill and restore inventory | Billing / Past bills page (employee) |
| Employee can register new items or restock shipments (stages as pending) | Restock / Inward page (employee) |
| Manager can approve pending items and set retail selling prices | Approvals page (manager) |
| Manager can view inventory details | Inventory & Prices page (manager) |
| Employee can update inventory when new supply arrives | Restock page (employee) |
| Manager can change an item's selling price | Inventory & Prices page (manager) |
| Sales statistics (quantity sold, price realized, profit) for any day or period | Sales Stats page (manager) |

### Roles

Use the **Role** dropdown in the top bar to switch.

| Role | Can do |
| --- | --- |
| Employee | Bill customers, void/cancel bills, inward/restock items |
| Manager | Approve new items & set selling prices, view inventory and cost prices, change selling prices, view sales statistics |

> **Note:** roles are enforced in the UI only. The API itself has no authentication, so treat this as a demo of the access rules, not a security boundary.

## Prerequisites

- Python 3.10+
- PostgreSQL 15+
- Node.js 18+ and npm

## Backend Setup

```bash
# Clone the repository and enter the directory
git clone https://github.com/AbhisekKanungo/Supermarket-Automation-Software
cd Supermarket-Automation-Software

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Configure the database connection

Copy the example environment file and put in your own PostgreSQL password:

```bash
cp .env.example .env           # On Windows: copy .env.example .env
```

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sas_db
```

`.env` is git-ignored, so your password is never committed. If your password contains special characters (`@`, `#`, `/`, `:`), URL-encode them (`@` becomes `%40`).

### Initialize the database

Make sure PostgreSQL is running, then create the database and seed it:

```bash
createdb sas_db
python seed.py
```

If `createdb` is not found (common on Windows), open SQL Shell (psql), log in, and run:

```sql
CREATE DATABASE sas_db;
```

If updating an existing database, run the status and approval migrations:

```sql
ALTER TABLE sales_bills ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE items_inventory ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED';
ALTER TABLE items_inventory ALTER COLUMN current_price DROP NOT NULL;
```

### Run the backend

```bash
uvicorn app.main:app --reload --port 8000
```

- Base URL: `http://localhost:8000`
- Interactive API docs (Swagger UI): `http://localhost:8000/docs`

## Frontend Setup

In a second terminal, from the repository root:

```bash
cd sas_frontend
npm install
```

Create `sas_frontend/.env` so the frontend knows where the API is:

```
VITE_API_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:5173`. The backend must be running for the pages to load data.

### Build for production

```bash
npm run build
npm run preview
```

## Frontend tech

| Area | Choice |
| --- | --- |
| Framework | React + TypeScript, built with Vite |
| Routing | React Router |
| HTTP | Axios |
| Styling | Tailwind CSS v4, Geist font |
| Icons | Phosphor Icons |

### Frontend structure

```
sas_frontend/src/
  api/          # Axios client, endpoint functions, response types
  components/   # Navbar, BillView, shared UI (buttons, cards, alerts)
  context/      # RoleContext (employee / manager)
  pages/        # Billing, Inventory, SalesStats
  App.tsx       # Routes and role-based route guards
```

## Using the app

### Billing (employee)

- Browse all items as cards, or search by name or code.
- Click **Add** on a card, or scan/type an exact barcode in the search box and press Enter.
- Adjust quantities in the current bill with the **+** and **-** buttons, or type a number directly.
- Items sold by weight (per kg) are entered in grams, in steps of 10 g.
- The stock shown on each card reflects what is left after the current bill.
- Enter a clerk ID and click **Check out** to generate the bill, then **Print bill**.
- To cancel an erroneous bill, click **Void / Cancel Bill** to restore the stock.

### Restock & inward items (employee)

- Enter the quantity received for an existing item and click **Add stock** to update immediately.
- To add a new product catalog entry, submit the item's barcode, name, cost price, and initial quantity; it will be staged as **PENDING** until a manager approves it.

### Manager approvals & inventory (manager)

- Review all pending items submitted by employees. Enter a retail selling price and click **Approve** to activate the product for counter checkout.
- View stock, selling price, and cost price for every item.
- Enter a new price and click **Set price** to change today's selling price. The new price applies to future sales only; past sales keep the price they were made at.

### Sales stats (manager)

- Pick a date range (or use Today, Last 7 days, Last 30 days) to see quantity sold, price realized, and profit per item, with totals.
- Cancelled bills are automatically excluded.
- Click a column header to sort.
- Use **Print report** to print it.

## API Cheatsheet

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/v1/items/barcode/{code}` | Scan item / scale lookup |
| POST | `/api/v1/sales/checkout` | Process sale & print bill |
| POST | `/api/v1/sales/{bill_id}/cancel` | Void/cancel bill & restore stock |
| POST | `/api/v1/items` | Submit new/updated item (maker, stages as pending) |
| GET | `/api/v1/manager/items/pending` | List unapproved items awaiting pricing |
| PATCH | `/api/v1/manager/items/{barcode}/approve` | Approve item and set selling price (checker) |
| POST | `/api/v1/inventory/restock` | Restock incoming shipment |
| PATCH | `/api/v1/items/{barcode}/price` | Update daily selling price |
| GET | `/api/v1/inventory` | Inspect current stock levels |
| GET | `/api/v1/reports/sales-stats` | Generate revenue & profit report |

## Testing

Run backend unit tests and check coverage:

```bash
pytest -v --cov=app --cov-report=term-missing tests/
```
