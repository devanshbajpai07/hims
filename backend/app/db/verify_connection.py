import logging
import sys
import time
from sqlalchemy import text
from app.core.config import settings
from app.db.database import engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("hims.verify_connection")


def verify_neon_connection() -> bool:
    """Verifies live PostgreSQL connection using SELECT 1 and reports diagnostics."""
    masked_url = engine.url.render_as_string(hide_password=True)
    print("=" * 65)
    print("  AURA HIMS — Database Connectivity Check")
    print("=" * 65)
    print(f"Target URL: {masked_url}")
    print(f"Dialect   : {engine.dialect.name} (driver: {engine.dialect.driver})")

    start_time = time.time()
    try:
        with engine.connect() as conn:
            # 1. Verification query
            ping_result = conn.execute(text("SELECT 1")).scalar()
            elapsed_ms = (time.time() - start_time) * 1000

            if ping_result != 1:
                print(f"[FAIL] Unexpected SELECT 1 result: {ping_result}")
                return False

            # 2. Metadata diagnostics
            db_info = conn.execute(
                text("SELECT current_database(), current_user, version()")
            ).fetchone()

            db_name = db_info[0] if db_info else "unknown"
            db_user = db_info[1] if db_info else "unknown"
            pg_version = db_info[2].split(",")[0] if db_info else "unknown"

            print(f"Connected : Database='{db_name}', User='{db_user}'")
            print(f"Server    : {pg_version}")
            print(f"Latency   : {elapsed_ms:.1f} ms")
            print("=" * 65)
            print("[SUCCESS] Database connectivity verified successfully!")
            print("=" * 65)
            return True

    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000
        print("-" * 65)
        print(f"[ERROR] Database connection failed after {elapsed_ms:.1f} ms")
        print(f"Details : {type(e).__name__}: {e}")
        print("=" * 65)
        return False


if __name__ == "__main__":
    success = verify_neon_connection()
    sys.exit(0 if success else 1)

