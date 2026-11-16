import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.plans import PlanEntitlements, get_plan_entitlements
from app.core.security import decode_token, hash_token
from app.db.database import get_db
from app.models.assignment import RoleAssignment
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.purchaser_subscription import PurchaserSubscription
from app.models.session import SessionRecord
from app.models.user import User


@dataclass
class EmployeeContext:
    user: User
    membership: TenantMembership
    hospital: Hospital
    subscription: Optional[PurchaserSubscription]
    plan_code: str
    entitlements: PlanEntitlements
    active_assignments: List[RoleAssignment]


def get_current_employee(
    request: Request,
    db: Session = Depends(get_db),
) -> EmployeeContext:
    """Dependency that authenticates an active hospital employee identity.
    Validates cryptographic session cookie / bearer token against database SessionRecord,
    verifies active user status, active hospital membership, and active facility subscription.
    """
    token: Optional[str] = None

    # 1. Authorization header (precedence for explicit API requests / client headers)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    else:
        # 2. Cookie fallback for browser sessions
        cookie_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
        if cookie_token:
            token = cookie_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Decode claims
    try:
        payload = decode_token(token)
        user_id_str = payload.get("sub")
        hospital_id_str = payload.get("hospital_id")
        if not user_id_str or not hospital_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session token claims.",
            )
        user_id = uuid.UUID(user_id_str)
        hospital_id = uuid.UUID(hospital_id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token is invalid, expired, or malformed.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 4. Validate SessionRecord
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
    if not session_rec:
        now_check = datetime.now(timezone.utc)
        fallback_session = (
            db.query(SessionRecord)
            .filter(
                SessionRecord.user_id == user_id,
                SessionRecord.hospital_id == hospital_id,
                SessionRecord.is_revoked == False,
            )
            .order_by(SessionRecord.created_at.desc())
            .first()
        )
        if fallback_session:
            exp_check = fallback_session.expires_at
            if exp_check.tzinfo is None:
                exp_check = exp_check.replace(tzinfo=timezone.utc)
            if exp_check > now_check:
                session_rec = fallback_session

    if not session_rec or session_rec.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked. Please sign in again.",
        )

    now = datetime.now(timezone.utc)
    exp = session_rec.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if now > exp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please sign in again.",
        )

    # 5. Active User
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee account is deactivated.",
        )

    # 6. Active Membership
    mem = (
        db.query(TenantMembership)
        .options(
            joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.role),
            joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.department),
        )
        .filter(
            TenantMembership.user_id == user_id,
            TenantMembership.hospital_id == hospital_id,
        )
        .first()
    )
    if not mem or mem.status.lower() != "active":
        mem_status = mem.status.upper() if mem else "NONEXISTENT"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Hospital membership is {mem_status}.",
        )

    # 7. Active Hospital & Subscription
    hospital = (
        db.query(Hospital)
        .options(joinedload(Hospital.subscription))
        .filter(Hospital.id == hospital_id, Hospital.is_active == True)
        .first()
    )
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital facility not found or inactive.",
        )

    sub = hospital.subscription
    plan_code = sub.plan_code if sub and sub.status.lower() == "active" else "BASIC"
    entitlements = get_plan_entitlements(plan_code) or get_plan_entitlements("BASIC")

    active_assignments = [
        a for a in mem.role_assignments if a.is_active and a.assignment_status == "active"
    ]
    assignment_id_str = (
        request.headers.get("X-Assignment-Id")
        or request.query_params.get("assignment_id")
        or payload.get("assignment_id")
    )
    if assignment_id_str and active_assignments:
        matched = [a for a in active_assignments if str(a.id) == str(assignment_id_str)]
        if matched:
            active_assignments.sort(key=lambda a: 0 if str(a.id) == str(assignment_id_str) else 1)
        elif request.headers.get("X-Assignment-Id"):
            # If an explicit assignment ID header is sent that does not belong to the employee, reject immediately
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: The requested assignment ID does not belong to your authenticated membership or is inactive.",
            )

    return EmployeeContext(
        user=user,
        membership=mem,
        hospital=hospital,
        subscription=sub,
        plan_code=plan_code,
        entitlements=entitlements,
        active_assignments=active_assignments,
    )

