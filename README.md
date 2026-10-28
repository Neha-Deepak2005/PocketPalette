# PocketPalette — Personal Expense Tracker

A full-stack, colourful personal finance tracker built with **React + Vite + custom CSS**, **FastAPI**, **SQLAlchemy**, and **SQLite**. It follows the features described in the supplied internship project brief.

## Features included

- Account registration, login, logout, hashed passwords, signed bearer tokens
- User-specific records (users cannot access another user's transactions, budgets, or goals)
- Create, view, edit, and delete income and expense transactions
- Category labels and icons
- Search, category/type/date filters, and amount/date sorting
- Dashboard with income, expenses, net balance, transaction count
- Six-month spending trend and category distribution charts (Chart.js)
- Monthly category budgets with progress and over-budget indicators
- Savings goals with target amount, saved amount, progress, and optional target date
- CSV export
- Responsive layout, colourful cards, empty states, form validation, and success/error toasts
- API docs at `/docs`
- Basic automated backend tests

## Project structure

```text
pocketpalette-expense-tracker/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── .env.example
│   └── test_app.py
└── frontend/
    ├── .env.example
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        └── styles.css
```

## Run locally on Windows

You need Python 3.10+ and Node.js 20+.

### 1. Start the backend

Open a terminal in the `backend` folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Open `.env` and replace `SECRET_KEY` with a long random value. For local testing, the default SQLite database is fine.

Start the API:

```powershell
uvicorn app:app --reload
```

API: http://127.0.0.1:8000  
Interactive API docs: http://127.0.0.1:8000/docs

### 2. Start the frontend

Open a **second terminal** in the `frontend` folder:

```powershell
npm install
copy .env.example .env
npm run dev
```

Open the local URL Vite prints (usually http://localhost:5173).

### 3. Use it

1. Register with your name, email, and a password of at least 8 characters.
2. Add income and expense transactions.
3. Visit Overview to see analytics and charts.
4. Use Budgets to set monthly category limits.
5. Use Savings goals to track a target.
6. Export your transactions as CSV from the Overview or Transactions page.

## Run backend tests

From `backend`, with the virtual environment active:

```powershell
pytest -q
```

## Deployment outline

- **Frontend:** deploy `frontend` to Vercel. Build command: `npm run build`; output directory: `dist`. Set `VITE_API_URL` to your deployed backend URL.
- **Backend:** deploy `backend` to Render or Railway. Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`. Set `SECRET_KEY` to a strong random secret and `FRONTEND_ORIGIN` to your frontend URL.
- For production, use PostgreSQL via `DATABASE_URL` and run behind HTTPS. SQLite is for local development.
- Never commit `.env` files or real secrets. Add your deployed frontend origin to CORS.
- For production deployments with multiple instances, replace the current create-all startup pattern with migrations (Alembic) and configure persistent database storage.

## Notes / scope

- Amounts are displayed in Indian rupees (INR); change the `money` formatter in `frontend/src/main.jsx` if you need another currency.
- Budgets are unique by user + category + month; saving the same combination updates the existing budget.
- The savings goal's saved amount is manually updated by editing the goal. It is not automatically deducted from bank accounts.
- Password reset by email and recurring transactions were listed as optional upgrades in the brief and are not included in this starter.
- The code is a solid local starter, but test it in your own environment and complete deployment configuration before presenting it as production-ready.
