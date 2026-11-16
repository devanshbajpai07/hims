"""AURA HIMS — Quick Neon PostgreSQL Connectivity Verification

Run this script to verify your Neon PostgreSQL connection:
    python backend/verify_neon.py
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.db.verify_connection import verify_neon_connection

if __name__ == "__main__":
    success = verify_neon_connection()
    sys.exit(0 if success else 1)

