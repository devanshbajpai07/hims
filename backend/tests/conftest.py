import os
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Configure test database override before importing application modules
# This guarantees tests run in full isolation without contacting the remote Neon database.
TEST_DATABASE_PATH = backend_dir / "test_hims.db"
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite:///./test_hims.db")

os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["TEST_DATABASE_URL"] = TEST_DATABASE_URL
os.environ["ENVIRONMENT"] = "testing"

# Clean any previous stale test SQLite database file
for stale_db in [TEST_DATABASE_PATH, Path("test_hims.db"), backend_dir / "test_hims.db"]:
    if stale_db.exists():
        try:
            stale_db.unlink()
        except Exception:
            pass

import pytest
from app.core.config import settings
settings.ENVIRONMENT = "testing"
settings.DATABASE_URL = str(TEST_DATABASE_URL)
settings.EMAIL_PROVIDER = "mock"

from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, create_tables
from app.db.seed import seed_database
from app.db.rbac_seeder import backfill_all_hospitals_rbac
from app.services.email_service import mock_email_service


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    create_tables()
    db = SessionLocal()
    try:
        seed_database(db)
        backfill_all_hospitals_rbac(db)
    finally:
        db.close()
    yield
    # Teardown test database file
    if "sqlite" in TEST_DATABASE_URL and TEST_DATABASE_PATH.exists():
        try:
            TEST_DATABASE_PATH.unlink()
        except Exception:
            pass


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def email_mock():
    return mock_email_service
