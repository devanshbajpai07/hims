import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.exceptions import (
    AccountStatusError,
    SubscriptionExpiredError,
    SubscriptionInactiveError,
    SubscriptionNotFoundError,
)
from app.core.plans import PLAN_CATALOGUE, PlanCode, PlanEntitlements, get_plan_entitlements
from app.core.security import decode_token, hash_token
from app.db.database import get_db
from app.models.admin_invitation import HospitalAdministrator
from app.models.hospital import Hospital
from app.models.purchaser_subscription import PurchaserSubscription
from app.models.session import SessionRecord
from app.models.user import User


@dataclass
class AdminContext:
    user: User
    hospital: Hospital
    administrator: HospitalAdministrator
    subscription: PurchaserSubscription
    plan_code: str
    entitlements: PlanEntitlements


def get_current_admin(
    request: Request,
    db: Session = Depends(get_db),
) -> AdminContext:
    """Dependency that authenticates the employee identity, validates hospital-scoped
    administrator authority, and verifies that the hospital's assigned subscription is active.
    """
    token: Optional[str] = None

    # 1. Check Authorization Bearer header (precedence for explicit API client tokens)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    elif request.cookies.get(settings.SESSION_COOKIE_NAME):
        # 2. Fallback to HttpOnly session cookie
        token = request.cookies.get(settings.SESSION_COOKIE_NAME)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrator authentication required. No session credentials provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Decode JWT claims
    try:
        payload = decode_token(token)
        user_id_str = payload.get("sub")
        hospital_id_str = payload.get("hospital_id")
        is_admin_claim = payload.get("is_admin", False)
        if not user_id_str or not hospital_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid administrator session token claims.",
            )
        user_id = uuid.UUID(user_id_str)
        hospital_id = uuid.UUID(hospital_id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token is invalid, expired, or malformed.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 4. Validate session record against database
    t_hash = hash_token(token)
    session_rec = (
        db.query(SessionRecord)
        .filter(
            SessionRecord.token_hash == t_hash,
            SessionRecord.user_id == user_id,
            SessionRecord.hospital_id == hospital_id,
        )
        .first()
    )
    if not session_rec or session_rec.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or terminated. Please log in again.",
        )

    now = datetime.now(timezone.utc)
    exp = session_rec.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if now > exp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please log in again.",
        )

    # 5. Verify user is active
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee account is deactivated or unavailable.",
        )

    # 6. Verify hospital-scoped administrator membership
    admin_rec = (
        db.query(HospitalAdministrator)
        .filter(
            HospitalAdministrator.hospital_id == hospital_id,
            HospitalAdministrator.user_id == user_id,
            HospitalAdministrator.status == "active",
        )
        .first()
    )
    if not admin_rec:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: active hospital administrator membership required.",
        )

    # 7. Verify hospital and assigned subscription
    hospital = (
        db.query(Hospital)
        .options(joinedload(Hospital.subscription))
        .filter(Hospital.id == hospital_id, Hospital.is_active == True)
        .first()
    )
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital facility not found or currently inactive.",
        )

    sub = hospital.subscription
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hospital facility does not have an assigned subscription license.",
        )

    if sub.status.lower() != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Hospital subscription is inactive (status: '{sub.status}'). Access restricted.",
        )

    if sub.current_period_ends_at:
        period_end = sub.current_period_ends_at
        if period_end.tzinfo is None:
            period_end = period_end.replace(tzinfo=timezone.utc)
        if now > period_end:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Hospital subscription billing period has expired. Please contact your institutional purchaser.",
            )

    # 8. Resolve canonical plan entitlements
    plan_code = sub.plan_code
    entitlements = get_plan_entitlements(plan_code)
    if not entitlements:
        entitlements = get_plan_entitlements("BASIC")

    return AdminContext(
        user=user,
        hospital=hospital,
        administrator=admin_rec,
        subscription=sub,
        plan_code=plan_code,
        entitlements=entitlements,
    )


def require_tier(allowed_tiers: List[str]):
    """Dependency factory ensuring hospital subscription tier matches required capability."""
    def dependency(admin_ctx: AdminContext = Depends(get_current_admin)) -> AdminContext:
        normalized_allowed = [t.upper() for t in allowed_tiers]
        if admin_ctx.plan_code.upper() not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"This operation requires a {', '.join(allowed_tiers)} subscription tier. "
                    f"Current hospital tier is '{admin_ctx.plan_code}'. Upgrade plan to unlock."
                ),
            )
        return admin_ctx

    return dependency

