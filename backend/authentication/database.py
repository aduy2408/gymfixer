import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./backend.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _sqlite_column_exists(table_name: str, column_name: str) -> bool:
    inspector = inspect(engine)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _add_sqlite_column(table_name: str, column_name: str, definition: str) -> None:
    if _sqlite_column_exists(table_name, column_name):
        return
    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))


def _patch_sqlite_schema() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    _add_sqlite_column("users", "is_verified", "BOOLEAN NOT NULL DEFAULT 0")
    _add_sqlite_column("users", "auth_provider", "VARCHAR NOT NULL DEFAULT 'local'")
    _add_sqlite_column("users", "google_sub", "VARCHAR")
    _add_sqlite_column("users", "last_login_at", "DATETIME")

    with engine.begin() as connection:
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)"))


def init_db():
    from . import models

    Base.metadata.create_all(bind=engine)
    _patch_sqlite_schema()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
