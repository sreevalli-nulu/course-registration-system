import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

# Falls back to a local SQLite file only if DATABASE_URL isn't set, so the
# app is runnable immediately for a quick smoke test. Real dev/submission
# work should always set DATABASE_URL to the shared Supabase/Neon Postgres
# instance in .env — SQLite does not support the recursive CTEs, triggers,
# and window functions this project relies on.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local_dev.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
