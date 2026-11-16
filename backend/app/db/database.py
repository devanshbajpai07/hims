import logging
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import settings
from app.models import Base

logger = logging.getLogger("hims.database")

if not settings.DATABASE_URL or not settings.DATABASE_URL.strip():
    raise RuntimeError(
        "DATABASE_URL is not configured. Please set the DATABASE_URL environment variable."
    )

is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if is_sqlite:
    from sqlalchemy.pool import NullPool
    from sqlalchemy import event
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30},
        poolclass=NullPool,
        echo=False,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=15000")
        except Exception:
            pass
        finally:
            cursor.close()
else:
    # Production / Neon PostgreSQL engine configuration using Psycopg 3
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,      # Tests connection liveness before checkout (essential for Neon idle timeouts)
        pool_recycle=300,        # Recycles connections every 5 minutes to prevent stale pooler states
        pool_size=10,            # Standard connection pool size
        max_overflow=20,         # Maximum overflow connections for request bursts
        echo=False,
    )

logger.info(
    "SQLAlchemy database engine initialized (%s)",
    engine.url.render_as_string(hide_password=True),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Creates all database tables defined in the metadata."""
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        try:
            # Safe schema upgrade for employee_invitations.assignments_data
            if is_sqlite:
                cursor = conn.exec_driver_sql("PRAGMA table_info(employee_invitations)")
                cols = [row[1] for row in cursor.fetchall()]
                if cols and "assignments_data" not in cols:
                    conn.exec_driver_sql("ALTER TABLE employee_invitations ADD COLUMN assignments_data TEXT DEFAULT '[]'")
            else:
                conn.execute(text("ALTER TABLE employee_invitations ADD COLUMN IF NOT EXISTS assignments_data TEXT DEFAULT '[]'"))
        except Exception as e:
            logger.warning("Optional schema upgrade skipped: %s", e)


def check_connection() -> bool:
    """Verifies database connectivity by executing SELECT 1."""
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1")).scalar()
        return result == 1
