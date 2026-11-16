import re
from typing import List, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.user import User


class UsernameService:
    @staticmethod
    def normalize_username(username: str) -> str:
        return username.strip().lower()

    @staticmethod
    def validate_format(username: str) -> Tuple[bool, str]:
        normalized = username.strip()
        if len(normalized) < 3:
            return False, "Username must be at least 3 characters long."
        if len(normalized) > 30:
            return False, "Username cannot exceed 30 characters."
        if not re.match(r"^[a-zA-Z0-9._]+$", normalized):
            return False, "Only letters, numbers, periods (.), and underscores (_) are allowed."
        if normalized.startswith(".") or normalized.endswith(".") or normalized.startswith("_") or normalized.endswith("_"):
            return False, "Username cannot start or end with a period or underscore."
        if ".." in normalized or "__" in normalized:
            return False, "Consecutive periods or underscores are not allowed."
        return True, ""

    @classmethod
    def is_username_available(cls, db: Session, username: str) -> bool:
        normalized = cls.normalize_username(username)
        existing = db.execute(
            select(User.id).where(func.lower(User.username) == normalized)
        ).scalar_one_or_none()
        return existing is None

    @classmethod
    def generate_suggestions(cls, db: Session, base_username: str) -> List[str]:
        cleaned = re.sub(r"[^a-zA-Z0-9]", "", base_username.lower())
        candidates = [
            f"{cleaned}01",
            f"{cleaned}02",
            f"{cleaned}.med",
            f"{cleaned}.care",
            f"dr.{cleaned}",
        ]
        available: List[str] = []
        for cand in candidates:
            if cls.is_username_available(db, cand):
                available.append(cand)
            if len(available) >= 3:
                break
        return available

