import csv
import io
import os
import secrets
import hashlib
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import create_engine, String, Integer, Float, Date, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker, Session

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")
ALGORITHM = "HS256"
TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "720"))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./expense_tracker.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    budgets: Mapped[list["Budget"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    goals: Mapped[list["Goal"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    amount: Mapped[float] = mapped_column(Float)
    kind: Mapped[str] = mapped_column(String(10), default="expense")
    category: Mapped[str] = mapped_column(String(40))
    spent_on: Mapped[date] = mapped_column(Date, index=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    user: Mapped[User] = relationship(back_populates="transactions")

class Budget(Base):
    __tablename__ = "budgets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    category: Mapped[str] = mapped_column(String(40))
    monthly_limit: Mapped[float] = mapped_column(Float)
    month: Mapped[str] = mapped_column(String(7), index=True)
    user: Mapped[User] = relationship(back_populates="budgets")

class Goal(Base):
    __tablename__ = "goals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    target_amount: Mapped[float] = mapped_column(Float)
    saved_amount: Mapped[float] = mapped_column(Float, default=0)
    target_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    user: Mapped[User] = relationship(back_populates="goals")

Base.metadata.create_all(bind=engine)
app = FastAPI(title="PocketPalette Expense Tracker", version="1.0.0")
origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in origin.split(",")],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
bearer = HTTPBearer(auto_error=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return salt.hex() + "$" + digest.hex()

def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
        return secrets.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False

def make_token(user: User) -> str:
    expiry = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES)
    return jwt.encode({"sub": str(user.id), "exp": expiry}, SECRET_KEY, algorithm=ALGORITHM)

def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Your session expired. Please sign in again.")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Account not found.")
    return user

class AuthIn(BaseModel):
    name: str = Field(default="Friend", min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: str
    password: str

class TransactionIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    amount: float = Field(gt=0, le=100000000)
    kind: str = "expense"
    category: str = Field(min_length=1, max_length=40)
    spent_on: date
    note: Optional[str] = Field(default=None, max_length=1000)

    @classmethod
    def validate_kind(cls, value):
        return value

class BudgetIn(BaseModel):
    category: str = Field(min_length=1, max_length=40)
    monthly_limit: float = Field(gt=0, le=100000000)
    month: str = Field(pattern=r"^\d{4}-\d{2}$")

class GoalIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    target_amount: float = Field(gt=0, le=100000000)
    saved_amount: float = Field(default=0, ge=0, le=100000000)
    target_date: Optional[date] = None

def tx_dict(t: Transaction):
    return {"id": t.id, "title": t.title, "amount": t.amount, "kind": t.kind,
            "category": t.category, "spent_on": t.spent_on.isoformat(), "note": t.note}

def budget_dict(b: Budget, spent: float = 0):
    return {"id": b.id, "category": b.category, "monthly_limit": b.monthly_limit,
            "month": b.month, "spent": round(spent, 2),
            "remaining": round(b.monthly_limit - spent, 2),
            "percent": min(100, round(spent / b.monthly_limit * 100)) if b.monthly_limit else 0}

def goal_dict(g: Goal):
    return {"id": g.id, "title": g.title, "target_amount": g.target_amount,
            "saved_amount": g.saved_amount, "target_date": g.target_date.isoformat() if g.target_date else None,
            "percent": min(100, round(g.saved_amount / g.target_amount * 100)) if g.target_amount else 0}

@app.get("/")
def home():
    return {"message": "PocketPalette API is running", "docs": "/docs"}

@app.post("/api/auth/register")
def register(payload: AuthIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password))
    db.add(user); db.commit(); db.refresh(user)
    return {"token": make_token(user), "user": {"id": user.id, "name": user.name, "email": user.email}}

@app.post("/api/auth/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    return {"token": make_token(user), "user": {"id": user.id, "name": user.name, "email": user.email}}

@app.get("/api/auth/me")
def me(user: User = Depends(current_user)):
    return {"id": user.id, "name": user.name, "email": user.email}

@app.get("/api/transactions")
def list_transactions(category: Optional[str] = None, kind: Optional[str] = None,
                      start: Optional[date] = None, end: Optional[date] = None,
                      search: Optional[str] = None, sort: str = "newest",
                      user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(Transaction).filter(Transaction.user_id == user.id)
    if category and category != "All categories": q = q.filter(Transaction.category == category)
    if kind in ("income", "expense"): q = q.filter(Transaction.kind == kind)
    if start: q = q.filter(Transaction.spent_on >= start)
    if end: q = q.filter(Transaction.spent_on <= end)
    if search: q = q.filter(Transaction.title.ilike(f"%{search[:100]}%"))
    q = q.order_by(Transaction.spent_on.asc() if sort == "oldest" else Transaction.amount.desc()
                   if sort == "highest" else Transaction.amount.asc() if sort == "lowest"
                   else Transaction.spent_on.desc(), Transaction.id.desc())
    return [tx_dict(t) for t in q.limit(500).all()]

@app.post("/api/transactions")
def create_transaction(payload: TransactionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if payload.kind not in ("income", "expense"):
        raise HTTPException(status_code=422, detail="Type must be income or expense.")
    tx = Transaction(user_id=user.id, title=payload.title.strip(), amount=payload.amount,
                     kind=payload.kind, category=payload.category.strip(), spent_on=payload.spent_on, note=payload.note)
    db.add(tx); db.commit(); db.refresh(tx)
    return tx_dict(tx)

@app.put("/api/transactions/{tx_id}")
def update_transaction(tx_id: int, payload: TransactionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.user_id == user.id).first()
    if not tx: raise HTTPException(status_code=404, detail="Transaction not found.")
    if payload.kind not in ("income", "expense"): raise HTTPException(status_code=422, detail="Type must be income or expense.")
    for key, value in payload.model_dump().items(): setattr(tx, key, value)
    tx.title = tx.title.strip(); tx.category = tx.category.strip()
    db.commit(); db.refresh(tx)
    return tx_dict(tx)

@app.delete("/api/transactions/{tx_id}")
def delete_transaction(tx_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.user_id == user.id).first()
    if not tx: raise HTTPException(status_code=404, detail="Transaction not found.")
    db.delete(tx); db.commit()
    return {"message": "Transaction deleted."}

@app.get("/api/analytics")
def analytics(month: Optional[str] = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    month = month or date.today().strftime("%Y-%m")
    rows = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    monthly = [t for t in rows if t.spent_on.strftime("%Y-%m") == month]
    expenses = [t for t in monthly if t.kind == "expense"]
    income = sum(t.amount for t in monthly if t.kind == "income")
    spending = sum(t.amount for t in expenses)
    category_totals = {}
    for t in expenses: category_totals[t.category] = category_totals.get(t.category, 0) + t.amount
    month_totals = {}
    today = date.today()
    for offset in range(5, -1, -1):
        idx = today.month - 1 - offset
        year = today.year + idx // 12
        m = idx % 12 + 1
        key = f"{year:04d}-{m:02d}"
        month_totals[key] = 0.0
    for t in rows:
        key = t.spent_on.strftime("%Y-%m")
        if key in month_totals and t.kind == "expense": month_totals[key] += t.amount
    return {"month": month, "income": round(income, 2), "expenses": round(spending, 2),
            "balance": round(income - spending, 2), "transaction_count": len(monthly),
            "category_totals": [{"category": k, "total": round(v, 2)} for k, v in sorted(category_totals.items(), key=lambda x: -x[1])],
            "monthly_trend": [{"month": k, "total": round(v, 2)} for k, v in month_totals.items()]}

@app.get("/api/budgets")
def list_budgets(month: Optional[str] = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    month = month or date.today().strftime("%Y-%m")
    budgets = db.query(Budget).filter(Budget.user_id == user.id, Budget.month == month).all()
    result = []
    for b in budgets:
        spent = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.user_id == user.id, Transaction.kind == "expense",
            Transaction.category == b.category, func.strftime("%Y-%m", Transaction.spent_on) == month).scalar() or 0
        result.append(budget_dict(b, float(spent)))
    return result

@app.post("/api/budgets")
def upsert_budget(payload: BudgetIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    b = db.query(Budget).filter(Budget.user_id == user.id, Budget.category == payload.category,
                                Budget.month == payload.month).first()
    if b: b.monthly_limit = payload.monthly_limit
    else:
        b = Budget(user_id=user.id, category=payload.category.strip(), monthly_limit=payload.monthly_limit, month=payload.month)
        db.add(b)
    db.commit(); db.refresh(b)
    return budget_dict(b)

@app.delete("/api/budgets/{budget_id}")
def delete_budget(budget_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    b = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == user.id).first()
    if not b: raise HTTPException(status_code=404, detail="Budget not found.")
    db.delete(b); db.commit()
    return {"message": "Budget deleted."}

@app.get("/api/goals")
def list_goals(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [goal_dict(g) for g in db.query(Goal).filter(Goal.user_id == user.id).order_by(Goal.id.desc()).all()]

@app.post("/api/goals")
def create_goal(payload: GoalIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if payload.saved_amount > payload.target_amount:
        raise HTTPException(status_code=422, detail="Saved amount cannot exceed the target.")
    g = Goal(user_id=user.id, **payload.model_dump())
    db.add(g); db.commit(); db.refresh(g)
    return goal_dict(g)

@app.put("/api/goals/{goal_id}")
def update_goal(goal_id: int, payload: GoalIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user.id).first()
    if not g: raise HTTPException(status_code=404, detail="Goal not found.")
    if payload.saved_amount > payload.target_amount: raise HTTPException(status_code=422, detail="Saved amount cannot exceed the target.")
    for k, v in payload.model_dump().items(): setattr(g, k, v)
    db.commit(); db.refresh(g)
    return goal_dict(g)

@app.delete("/api/goals/{goal_id}")
def delete_goal(goal_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user.id).first()
    if not g: raise HTTPException(status_code=404, detail="Goal not found.")
    db.delete(g); db.commit()
    return {"message": "Goal deleted."}

@app.get("/api/export.csv")
def export_csv(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(Transaction).filter(Transaction.user_id == user.id).order_by(Transaction.spent_on.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Title", "Type", "Category", "Amount", "Note"])
    for t in rows: writer.writerow([t.spent_on.isoformat(), t.title, t.kind, t.category, t.amount, t.note or ""])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="pocketpalette-transactions.csv"'})
