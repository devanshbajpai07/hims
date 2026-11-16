import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps_employee import EmployeeContext, get_current_employee
from app.core.permissions import SYSTEM_ROLE_PERMISSIONS
from app.core.security import get_password_hash, verify_password
from app.db.database import get_db
from app.models.assignment import RoleAssignment
from app.models.audit import AuditLog
from app.models.department import Department
from app.models.notification import HospitalNotification
from app.models.registration import AdditionalAssignmentRequest
from app.models.role import Role
from app.models.session import SessionRecord
from app.models.user import User
from app.services.username_service import UsernameService

router = APIRouter(prefix="/employee", tags=["Employee Workspace & Account"])


# -----------------------------------------------------------------------------
# SCHEMAS
# -----------------------------------------------------------------------------

class EmployeeProfileResponse(BaseModel):
    user_id: str
    username: str
    email: str
    full_name: str
    hospital_id: str
    hospital_name: str
    hospital_uid: str
    employee_uid: str
    plan_code: str
    active_assignments: List[Dict[str, Any]]


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class ChangeUsernameRequest(BaseModel):
    new_username: str = Field(..., min_length=3, max_length=64)


class SessionItemResponse(BaseModel):
    id: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime
    expires_at: datetime
    is_current: bool


class RoleRequestPayload(BaseModel):
    department_id: Optional[str] = None
    role_id: Optional[str] = None
    requested_responsibilities: str
    justification: str


class SwitchAssignmentRequest(BaseModel):
    assignment_id: str


# -----------------------------------------------------------------------------
# HELPER FUNCTIONS
# -----------------------------------------------------------------------------

def _check_employee_permission(
    emp_ctx: EmployeeContext,
    db: Session,
    permission_code: str,
    department_id: Optional[uuid.UUID] = None,
) -> None:
    from app.services.authorization_service import AuthorizationService
    detail = AuthorizationService.get_effective_permissions_detail(db, emp_ctx.membership.id, department_id)
    granted_codes = {item.code for item in detail if item.is_granted}

    if permission_code in granted_codes:
        return

    item = next((i for i in detail if i.code == permission_code), None)
    reason = item.explanation if item else "Permission not granted."
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Access denied: Missing required permission '{permission_code}'. {reason}",
    )


# -----------------------------------------------------------------------------
# ENDPOINTS
# -----------------------------------------------------------------------------

@router.get("/profile", response_model=EmployeeProfileResponse)
def get_employee_profile(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieves authoritative employee profile, active hospital facility details,
    and verified department/facility role assignments.
    """
    _check_employee_permission(emp_ctx, db, "account:profile:read")
    assignments_data = []
    for a in emp_ctx.active_assignments:
        rcode = a.role.code if a.role else "unknown"
        assignments_data.append({
            "id": str(a.id),
            "role_id": str(a.role_id),
            "role_name": a.role.name if a.role else "Unknown Role",
            "role_code": rcode,
            "department_id": str(a.department_id) if a.department_id else None,
            "department_name": a.department.name if a.department else "Hospital-Wide",
            "scope_type": a.scope_type,
            "assignment_status": a.assignment_status,
            "permissions": list(SYSTEM_ROLE_PERMISSIONS.get(rcode, [])),
        })

    return EmployeeProfileResponse(
        user_id=str(emp_ctx.user.id),
        username=emp_ctx.user.username,
        email=emp_ctx.user.email or "",
        full_name=emp_ctx.user.full_name or emp_ctx.user.username,
        hospital_id=str(emp_ctx.hospital.id),
        hospital_name=emp_ctx.hospital.name,
        hospital_uid=emp_ctx.hospital.hospital_uid,
        employee_uid=emp_ctx.membership.employee_uid,
        plan_code=emp_ctx.plan_code,
        active_assignments=assignments_data,
    )


@router.post("/switch-assignment")
def switch_active_assignment(
    payload: SwitchAssignmentRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Switches the employee's active operational assignment context."""
    target_assign = None
    for a in emp_ctx.active_assignments:
        if str(a.id) == payload.assignment_id:
            target_assign = a
            break
    if not target_assign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found or not active for your membership."
        )

    rcode = target_assign.role.code if target_assign.role else "staff"
    rname = target_assign.role.name if target_assign.role else "Staff"
    dname = target_assign.department.name if target_assign.department else "Hospital-Wide"

    # Evaluate dynamic effective permissions including overrides and role versions
    from app.services.authorization_service import AuthorizationService
    detail = AuthorizationService.get_effective_permissions_detail(db, emp_ctx.membership.id, target_assign.department_id)
    perms = [item.code for item in detail if item.is_granted]

    return {
        "status": "success",
        "active_assignment_id": str(target_assign.id),
        "role_code": rcode,
        "role_name": rname,
        "department_name": dname,
        "scope_type": target_assign.scope_type,
        "effective_permissions": perms,
    }


@router.put("/profile", response_model=EmployeeProfileResponse)
def update_employee_profile(
    payload: UpdateProfileRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Updates personal employee profile details."""
    _check_employee_permission(emp_ctx, db, "account:profile:update")
    if payload.full_name and payload.full_name.strip():
        emp_ctx.user.full_name = payload.full_name.strip()
        db.commit()
        db.refresh(emp_ctx.user)

    return get_employee_profile(emp_ctx, db)


@router.post("/change-username")
def change_employee_username(
    payload: ChangeUsernameRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Changes employee username with case-insensitive global uniqueness verification."""
    new_uname = payload.new_username.strip()
    is_valid, err_msg = UsernameService.validate_syntax(new_uname)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    if not UsernameService.is_available(db, new_uname):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{new_uname}' is already in use by another user in the system.",
        )

    old_uname = emp_ctx.user.username
    emp_ctx.user.username = new_uname
    db.add(AuditLog(
        hospital_id=emp_ctx.hospital.id,
        user_id=emp_ctx.user.id,
        action="USERNAME_CHANGE",
        resource_type="user",
        resource_id=str(emp_ctx.user.id),
        details=f"Changed username from '{old_uname}' to '{new_uname}'",
    ))
    db.commit()
    return {"success": True, "message": f"Username successfully changed to '{new_uname}'."}


@router.post("/change-password")
def change_employee_password(
    payload: ChangePasswordRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Self-service password rotation for authenticated employee.
    Enforces current password verification, Argon2id re-hashing, and prevents reuse.
    """
    _check_employee_permission(emp_ctx, db, "account:password:change")
    if not verify_password(payload.current_password, emp_ctx.user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed.",
        )

    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation do not match.",
        )

    # Database reuse check
    if verify_password(payload.new_password, emp_ctx.user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be identical to your current password.",
        )

    emp_ctx.user.password_hash = get_password_hash(payload.new_password)
    db.add(AuditLog(
        hospital_id=emp_ctx.hospital.id,
        user_id=emp_ctx.user.id,
        action="PASSWORD_CHANGE",
        resource_type="user",
        resource_id=str(emp_ctx.user.id),
        details="Self-service password changed successfully.",
    ))
    db.commit()
    return {"success": True, "message": "Password updated successfully."}


@router.get("/sessions", response_model=List[SessionItemResponse])
def list_employee_sessions(
    request: Request,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Lists all active device sessions for this employee in the hospital facility."""
    now = datetime.now(timezone.utc)
    sessions = db.query(SessionRecord).filter(
        SessionRecord.user_id == emp_ctx.user.id,
        SessionRecord.hospital_id == emp_ctx.hospital.id,
        SessionRecord.is_revoked == False,
        SessionRecord.expires_at > now,
    ).order_by(SessionRecord.created_at.desc()).all()

    # Determine current session token hash
    curr_token = request.cookies.get("hims_session") or (
        request.headers.get("Authorization", "").split(" ", 1)[1]
        if request.headers.get("Authorization", "").startswith("Bearer ")
        else None
    )
    curr_hash = hashlib.sha256(curr_token.encode()).hexdigest() if curr_token else None

    return [
        SessionItemResponse(
            id=str(s.id),
            ip_address=s.ip_address,
            user_agent=s.user_agent,
            created_at=s.created_at,
            expires_at=s.expires_at,
            is_current=(s.token_hash == curr_hash),
        )
        for s in sessions
    ]


@router.post("/sessions/{session_id}/revoke")
def revoke_employee_session(
    session_id: uuid.UUID,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Revokes a specific active session."""
    s = db.query(SessionRecord).filter(
        SessionRecord.id == session_id,
        SessionRecord.user_id == emp_ctx.user.id,
        SessionRecord.hospital_id == emp_ctx.hospital.id,
    ).first()

    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session record not found.")

    s.is_revoked = True
    db.commit()
    return {"success": True, "message": "Session revoked successfully."}


@router.post("/requests/role")
def submit_role_request(
    payload: RoleRequestPayload,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Submits a formal request for an additional role or department placement.
    Security: Strictly enters pending approval state; never auto-activates.
    """
    if not payload.justification.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Justification is required for additional role requests.",
        )

    # Protect administrator role
    if payload.role_id:
        r = db.query(Role).filter(Role.id == uuid.UUID(payload.role_id)).first()
        if r and (r.code == "admin" or "admin" in r.name.lower()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hospital Administrator authority cannot be requested through employee requests.",
            )

    req = AdditionalAssignmentRequest(
        id=uuid.uuid4(),
        hospital_id=emp_ctx.hospital.id,
        email=emp_ctx.user.email or "unspecified@aurahims.org",
        employee_uid=emp_ctx.membership.employee_uid,
        requested_responsibilities=payload.requested_responsibilities.strip(),
        justification=payload.justification.strip(),
        status="pending",
    )
    db.add(req)

    # Dispatch notification to administrators
    db.add(HospitalNotification(
        id=uuid.uuid4(),
        hospital_id=emp_ctx.hospital.id,
        title="New Employee Assignment Request",
        message=f"Employee '{emp_ctx.user.full_name}' ({emp_ctx.membership.employee_uid}) requested an assignment: {payload.requested_responsibilities[:80]}",
        notification_type="employee_request",
    ))

    db.commit()
    db.refresh(req)
    return {
        "success": True,
        "request_id": str(req.id),
        "status": "pending",
        "message": "Assignment request submitted for administrator and department review.",
    }


@router.get("/requests")
def list_employee_requests(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Lists submitted requests by this employee."""
    reqs = db.query(AdditionalAssignmentRequest).filter(
        AdditionalAssignmentRequest.hospital_id == emp_ctx.hospital.id,
        AdditionalAssignmentRequest.employee_uid == emp_ctx.membership.employee_uid,
    ).order_by(AdditionalAssignmentRequest.created_at.desc()).all()

    return [
        {
            "id": str(r.id),
            "requested_responsibilities": r.requested_responsibilities,
            "justification": r.justification,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in reqs
    ]

