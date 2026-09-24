# Supermarket-Automation-Software

Supermarket automation software (SAS): billing at the counter, inventory management, price control, and sales statistics.

- **Backend:** FastAPI + PostgreSQL. Handles POS billing, atomic stock updates, item approval, bill cancellation, and profit reports.
- **Frontend:** React + TypeScript (Vite) with Tailwind CSS. Role-based screens for employees and managers.

## Features

| Requirement | Where |
| --- | --- |
| Print a bill with serial number, item name, code, quantity, unit price, item price, and total | Billing page (employee) |
| Inventory decreases automatically on every sale | Backend checkout |
| Cancel a bill and restore its stock | Bill screen, right after checkout (employee) |
| Register new items (staged as pending until priced) | Stock & New Items page (employee) |
| Update inventory when new supply arrives | Stock & New Items page (employee) |
| Approve pending items and set their selling price | Approvals page (manager) |
| View inventory details | Inventory & Prices page (manager) |
| Change an item's selling price | Inventory & Prices page (manager) |
| Sales statistics (quantity sold, price realized, profit) for any day or period | Sales Stats page (manager) |

### Roles

Use the **Role** dropdown in the top bar to switch.

| Role | Can do |
| --- | --- |
| Employee | Bill customers, cancel a bill, register new items, restock approved items |
| Manager | Approve new items and set selling prices, view inventory and cost prices, change selling prices, view sales statistics |

> **Note:** roles are enforced in the UI only. The API itself has no authentication, so treat this as a demo of the access rules, not a security boundary.

### How a new item reaches the counter

1. An **employee** registers the item (code, name, cost price, opening stock). It is saved as **PENDING** with no selling price.
2. The **manager** sees it in the Approvals queue, enters a selling price (it can't be below cost), and approves it.
3. The item becomes **APPROVED** and appears on the Billing counter.

Pending items can't be billed or restocked.

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

Seeded items must be created with `approval_status="APPROVED"` and a selling price, otherwise they start as pending and won't appear at the billing counter.

### Updating an existing database

`seed.py` only creates missing tables; it never adds columns to existing ones. If you pull changes to `app/models.py` and see `column ... does not exist`, choose one:

**Option 1: reset (loses local data).** In SQL Shell (psql):

```sql
DROP DATABASE sas_db;
CREATE DATABASE sas_db;
```

Then run `python seed.py` again. Stop uvicorn first so nothing is connected.

**Option 2: keep your data.** Run this against `sas_db`. Existing items are marked `APPROVED` and existing bills `COMPLETED`, so they stay sellable:

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
  pages/        # Billing, Inventory, Approvals, SalesStats
  App.tsx       # Routes and role-based route guards
```

## Using the app

Items are listed alphabetically by name on every screen.

### Billing (employee)

- Browse approved items as cards, or search by name or code.
- Click **Add** on a card, or scan/type an exact barcode in the search box and press Enter.
- Adjust quantities in the current bill with the **+** and **-** buttons, or type a number directly.
- Items sold by weight (per kg) are entered in grams, in steps of 10 g.
- The stock shown on each card reflects what is left after the current bill.
- Enter a clerk ID and click **Check out** to generate the bill, then **Print bill**.
- To void a bill, click **Cancel bill** on the bill screen and confirm. Stock is restored and the bill is marked cancelled. This is only possible from the bill screen straight after checkout.

### Stock & New Items (employee)

- **Restock:** enter the quantity received for an approved item and click **Add stock**. Stock updates immediately.
- **New item:** enter a code (type, scan, or click **Generate**), name, cost price, opening stock, and whether it is sold by weight, then submit. The item is sent to the manager as **PENDING**.
- If the code already exists, the form warns you: submitting updates that item, adds the stock, and sends it back for re-approval.

### Approvals (manager)

- The nav shows a badge with the number of pending items.
- Each pending item is pre-filled with a suggested price (cost + 20%). Adjust it and click **Approve**. Prices below cost are rejected.

### Inventory & Prices (manager)

- View stock, selling price, cost price, and approval status for every item.
- Enter a new price and click **Set price** to change an approved item's selling price. The new price applies to future sales only; past sales keep the price they were made at.

### Sales Stats (manager)

- Pick a date range (or use Today, Last 7 days, Last 30 days) to see quantity sold, price realized, and profit per item, with totals.
- Cancelled bills are excluded.
- Click a column header to sort.
- Use **Print report** to print it.

## API Cheatsheet

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/v1/items/barcode/{code}` | Scan item / scale lookup (approved items only) |
| POST | `/api/v1/sales/checkout` | Process sale & print bill |
| POST | `/api/v1/sales/{bill_id}/cancel` | Cancel bill & restore stock |
| POST | `/api/v1/items` | Register a new item or update an existing one (stages as pending) |
| GET | `/api/v1/manager/items/pending` | List unapproved items awaiting pricing |
| PATCH | `/api/v1/manager/items/{barcode}/approve` | Approve item and set selling price |
| POST | `/api/v1/inventory/restock` | Restock incoming shipment |
| PATCH | `/api/v1/items/{barcode}/price` | Update an item's selling price |
| GET | `/api/v1/inventory` | Inspect current stock levels and approval status |
| GET | `/api/v1/reports/sales-stats` | Revenue & profit report (completed bills only) |

## Testing

Run backend unit tests and check coverage:

```bash
pytest -v --cov=app --cov-report=term-missing tests/
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `fe_sendauth: no password supplied` | Add your password to `DATABASE_URL` in `.env`. |
| `password authentication failed` | The password in `.env` doesn't match your PostgreSQL install. |
| `column ... approval_status does not exist` | Your database predates the approval workflow. See "Updating an existing database". |
| `ModuleNotFoundError` when running `seed.py` | Activate the virtual environment and run `pip install -r requirements.txt`. |
| Billing counter shows no items | Items are probably still pending. Approve them from the Approvals page, or check that seeded items are `APPROVED`. |
| Frontend shows a network error | Check the backend is running and `VITE_API_URL` points to it. |
| Checkout, cancel, or approve returns a 500 with `A transaction is already begun` | Known SQLAlchemy 2.0 issue with `db.begin()` in those endpoints. Report it to the backend maintainers. |
