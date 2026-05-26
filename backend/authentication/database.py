import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable must be set.")
if not DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg://")):
    raise RuntimeError("DATABASE_URL must point to PostgreSQL for runtime use.")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    """Import models so SQLAlchemy metadata is registered.

    Schema creation is handled by Alembic migrations, not app startup.
    """
    from . import models  # noqa: F401


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
