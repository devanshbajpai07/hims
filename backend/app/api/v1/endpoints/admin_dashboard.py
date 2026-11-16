import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps_admin import AdminContext, get_current_admin, require_tier
from app.db.database import get_db
from app.services.authorization_service import (
    AuthorizationContext,
    require_permission as _require_permission,
)

from app.core.permissions import get_tier_allowed_permissions

def require_permission(permission_code: str):
    """Admin-scoped permission dependency factory.
    Verifies that the authenticated administrator's hospital subscription tier
    allows the requested operation, and preserves exact tier error messages.
    """
    def dependency(
        request: Request,
        admin_ctx: AdminContext = Depends(get_current_admin),
        db: Session = Depends(get_db),
    ) -> AdminContext:
        plan_code = (admin_ctx.plan_code or "BASIC").upper()
        tier_allowed = get_tier_allowed_permissions(plan_code)

        if permission_code not in tier_allowed:
            if permission_code == "department:manage" and plan_code == "BASIC":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Custom department creation is restricted under the BASIC tier. Predefined clinical departments only.",
                )
            if permission_code == "role:manage" and plan_code == "BASIC":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Custom role creation is restricted under the BASIC tier. Predefined clinical roles only.",
                )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires permission '{permission_code}', which is not available on {plan_code} tier.",
            )
        return admin_ctx

    return dependency
from app.schemas.hospital_admin import (
    AdminAuditItem,
    AdminEmployeeItem,
    AdminOverviewResponse,
    AssignEmployeeRolesRequest,
    CreateDepartmentRequest,
    CreateRoleRequest,
    DepartmentItem,
    EmployeeInviteItem,
    EmployeeInviteRequest,
    NotificationItem,
    RoleItem,
    UpdateEmployeeStatusRequest,
)
from app.schemas.rbac import (
    CreatePermissionOverrideRequest,
    CreateRoleAssignmentRequest,
    CreateRoleVersionRequest,
    EmployeeEffectivePermissionsResponse,
    PendingApprovalItem,
    PermissionCatalogueResponse,
    PermissionItemResponse,
    PermissionOverrideItemResponse,
    RegistrationApprovalDecisionRequest,
    RoleAssignmentItemResponse,
    RoleVersionItemResponse,
)
from app.services.hospital_admin_service import (
    HospitalAdminService,
    QuotaExceededError,
    TierFeatureRestrictedError,
)

router = APIRouter(prefix="/admin", tags=["Hospital Administrator Platform"])


# =========================================================================
# 1. OVERVIEW & METRICS
# =========================================================================

@router.get("/dashboard/overview", response_model=AdminOverviewResponse, status_code=status.HTTP_200_OK)
def get_dashboard_overview(
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Retrieve honest backend metrics, workforce statistics, recent activity, alerts, and tier quota."""
    return HospitalAdminService.get_dashboard_overview(
        db, admin_ctx.hospital.id, admin_ctx.user.id
    )


# =========================================================================
# 2. EMPLOYEE MANAGEMENT & INVITATIONS
# =========================================================================

@router.get("/employees", response_model=List[AdminEmployeeItem], status_code=status.HTTP_200_OK)
def list_employees(
    search: Optional[str] = Query(None),
    department_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List hospital employees with department and role assignments, tenant-scoped to the active hospital."""
    return HospitalAdminService.list_employees(
        db,
        hospital_id=admin_ctx.hospital.id,
        search=search,
        department_id=department_id,
        status=status_filter,
    )


@router.post("/employees/invite", status_code=status.HTTP_201_CREATED)
def invite_employee(
    payload: EmployeeInviteRequest,
    request: Request,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """Administrator-initiated employee invitation with atomic quota enforcement and single-use token."""
    ip_addr = request.client.host if request.client else None
    try:
        invitation, raw_token = HospitalAdminService.invite_employee(
            db,
            hospital_id=admin_ctx.hospital.id,
            admin_user_id=admin_ctx.user.id,
            payload=payload,
            ip_address=ip_addr,
        )
        return {
            "success": True,
            "message": f"Invitation dispatched to {invitation.email}.",
            "invitation_id": invitation.id,
            "email": invitation.email,
            "full_name": invitation.full_name,
            "expires_at": invitation.expires_at,
        }
    except QuotaExceededError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.detail)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/employees/invitations", response_model=List[EmployeeInviteItem], status_code=status.HTTP_200_OK)
def list_employee_invitations(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """List pending and historical employee invitations with pre-authorized assignments."""
    return HospitalAdminService.list_employee_invitations(
        db, hospital_id=admin_ctx.hospital.id, status=status_filter
    )


@router.post("/employees/invitations/{invitation_id}/revoke", status_code=status.HTTP_200_OK)
def revoke_employee_invitation(
    invitation_id: uuid.UUID,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """Revoke a pending employee invitation and immediately release reserved quota."""
    try:
        inv = HospitalAdminService.revoke_employee_invitation(
            db,
            hospital_id=admin_ctx.hospital.id,
            invitation_id=invitation_id,
            admin_user_id=admin_ctx.user.id,
        )
        return {"success": True, "invitation_id": inv.id, "status": inv.status}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/employees/invitations/{invitation_id}/resend", status_code=status.HTTP_200_OK)
def resend_employee_invitation(
    invitation_id: uuid.UUID,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """Regenerate token and re-dispatch employee invitation email."""
    try:
        inv, _ = HospitalAdminService.resend_employee_invitation(
            db,
            hospital_id=admin_ctx.hospital.id,
            invitation_id=invitation_id,
            admin_user_id=admin_ctx.user.id,
        )
        return {"success": True, "invitation_id": inv.id, "status": inv.status, "expires_at": inv.expires_at}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/employees/{membership_id}/status", status_code=status.HTTP_200_OK)
def update_employee_status(
    membership_id: uuid.UUID,
    payload: UpdateEmployeeStatusRequest,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """Suspend, reactivate, or terminate an employee's hospital membership.
    Suspension immediately revokes active employee sessions.
    """
    try:
        mem = HospitalAdminService.update_employee_status(
            db,
            hospital_id=admin_ctx.hospital.id,
            membership_id=membership_id,
            payload=payload,
            admin_user_id=admin_ctx.user.id,
        )
        return {"success": True, "membership_id": mem.id, "status": mem.status}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/employees/{membership_id}/roles", status_code=status.HTTP_200_OK)
def assign_employee_roles(
    membership_id: uuid.UUID,
    payload: AssignEmployeeRolesRequest,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """Assign or update employee roles within a clinical department."""
    try:
        assignments = HospitalAdminService.assign_employee_roles(
            db,
            hospital_id=admin_ctx.hospital.id,
            membership_id=membership_id,
            payload=payload,
            admin_user_id=admin_ctx.user.id,
        )
        return {"success": True, "active_assignments_count": len(assignments)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# =========================================================================
# 3. DEPARTMENT MANAGEMENT (TIER-AWARE)
# =========================================================================

@router.get("/departments", response_model=List[DepartmentItem], status_code=status.HTTP_200_OK)
def list_departments(
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List hospital departments with assigned employee counts."""
    return HospitalAdminService.list_departments(db, admin_ctx.hospital.id)


@router.post("/departments", status_code=status.HTTP_201_CREATED)
def create_department(
    payload: CreateDepartmentRequest,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("department:manage")),
):
    """Create a new department.
    Enforces tier-specific restrictions: BASIC is restricted to predefined catalogue;
    PRO and ULTRA support custom department configuration.
    """
    try:
        dept = HospitalAdminService.create_department(
            db,
            hospital_id=admin_ctx.hospital.id,
            payload=payload,
            plan_code=admin_ctx.plan_code,
            admin_user_id=admin_ctx.user.id,
        )
        return {
            "success": True,
            "department": {
                "id": dept.id,
                "name": dept.name,
                "code": dept.code,
                "description": dept.description,
            },
        }
    except TierFeatureRestrictedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.detail)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# =========================================================================
# 4. ROLE MANAGEMENT (TIER-AWARE)
# =========================================================================

@router.get("/roles", response_model=List[RoleItem], status_code=status.HTTP_200_OK)
def list_roles(
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List hospital roles with assigned employee counts."""
    return HospitalAdminService.list_roles(db, admin_ctx.hospital.id)


@router.post("/roles", status_code=status.HTTP_201_CREATED)
def create_role(
    payload: CreateRoleRequest,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("role:manage")),
):
    """Create a custom role.
    Enforces tier-specific restrictions: BASIC is restricted to predefined roles;
    PRO and ULTRA support custom role configuration.
    """
    try:
        role = HospitalAdminService.create_role(
            db,
            hospital_id=admin_ctx.hospital.id,
            payload=payload,
            plan_code=admin_ctx.plan_code,
            admin_user_id=admin_ctx.user.id,
        )
        return {
            "success": True,
            "role": {
                "id": role.id,
                "name": role.name,
                "code": role.code,
                "scope": role.scope,
                "description": role.description,
            },
        }
    except TierFeatureRestrictedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.detail)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# =========================================================================
# 5. AUDIT & NOTIFICATIONS
# =========================================================================

@router.get("/audit", response_model=List[AdminAuditItem], status_code=status.HTTP_200_OK)
def list_audit_logs(
    action: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List tenant-isolated append-only audit history for the active hospital facility."""
    return HospitalAdminService.list_audit_logs(
        db,
        hospital_id=admin_ctx.hospital.id,
        action=action,
        limit=limit,
        offset=offset,
    )


@router.get("/notifications", response_model=List[NotificationItem], status_code=status.HTTP_200_OK)
def list_notifications(
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List operational notifications and security alerts for the active hospital."""
    return HospitalAdminService.list_notifications(
        db, hospital_id=admin_ctx.hospital.id, user_id=admin_ctx.user.id
    )


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_notification_read(
    notification_id: uuid.UUID,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Mark notification as read."""
    success = HospitalAdminService.mark_notification_read(
        db, hospital_id=admin_ctx.hospital.id, notification_id=notification_id
    )
    return {"success": success}


# =========================================================================
# 6. PERMISSIONS & ROLE VERSIONING (RBAC)
# =========================================================================

@router.get("/permissions", response_model=PermissionCatalogueResponse, status_code=status.HTTP_200_OK)
def list_permissions(
    admin_ctx: AdminContext = Depends(get_current_admin),
):
    """Retrieve full master permission catalogue with tier-availability metadata for active hospital."""
    perms = HospitalAdminService.list_permissions(admin_ctx.plan_code)
    permitted_count = sum(1 for p in perms if p.get("is_tier_permitted"))
    return {
        "hospital_tier": admin_ctx.plan_code,
        "total_permissions": len(perms),
        "permitted_permissions": permitted_count,
        "permissions": perms,
    }


@router.get("/roles/{role_id}/versions", response_model=List[RoleVersionItemResponse], status_code=status.HTTP_200_OK)
def list_role_versions(
    role_id: uuid.UUID,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List immutable version history and permission sets for a specific role."""
    try:
        return HospitalAdminService.list_role_versions(
            db, hospital_id=admin_ctx.hospital.id, role_id=role_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/roles/{role_id}/versions", response_model=RoleVersionItemResponse, status_code=status.HTTP_201_CREATED)
def create_role_version(
    role_id: uuid.UUID,
    payload: CreateRoleVersionRequest,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("role:manage")),
):
    """Create and activate a new version for a role with specified permissions.
    Available in Pro and Ultra tiers. Enforces tier permission boundaries and prevents cyclic inheritance.
    """
    try:
        ver = HospitalAdminService.create_role_version(
            db,
            hospital_id=admin_ctx.hospital.id,
            role_id=role_id,
            payload=payload,
            plan_code=admin_ctx.plan_code,
            admin_user_id=admin_ctx.user.id,
        )
        # Fetch updated representation
        versions = HospitalAdminService.list_role_versions(db, admin_ctx.hospital.id, role_id)
        latest = next((v for v in versions if v["id"] == ver.id), None)
        if latest:
            return latest
        return {
            "id": ver.id,
            "role_id": role_id,
            "role_name": "Role",
            "role_code": "role",
            "version_number": ver.version_number,
            "parent_role_id": ver.parent_role_id,
            "change_reason": ver.change_reason,
            "is_active": ver.is_active,
            "created_by_user_id": ver.created_by_user_id,
            "activated_at": ver.activated_at,
            "created_at": ver.created_at,
            "permission_codes": payload.permission_codes,
        }
    except TierFeatureRestrictedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.detail)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# =========================================================================
# 7. EMPLOYEE MULTI-DEPARTMENT ASSIGNMENTS & OVERRIDES
# =========================================================================

@router.get("/employees/{membership_id}/assignments", response_model=List[RoleAssignmentItemResponse], status_code=status.HTTP_200_OK)
def list_employee_assignments(
    membership_id: uuid.UUID,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List multi-department role assignments for a specific employee."""
    try:
        return HospitalAdminService.list_employee_assignments(
            db, hospital_id=admin_ctx.hospital.id, membership_id=membership_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/employees/{membership_id}/assignments", response_model=RoleAssignmentItemResponse, status_code=status.HTTP_201_CREATED)
def assign_employee_role(
    membership_id: uuid.UUID,
    payload: CreateRoleAssignmentRequest,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """Assign an employee to a specific department role. Supports scope tracking (DEPARTMENT/FACILITY)."""
    try:
        assign = HospitalAdminService.assign_employee_role(
            db,
            hospital_id=admin_ctx.hospital.id,
            membership_id=membership_id,
            payload=payload,
            plan_code=admin_ctx.plan_code,
            admin_user_id=admin_ctx.user.id,
        )
        assignments = HospitalAdminService.list_employee_assignments(
            db, hospital_id=admin_ctx.hospital.id, membership_id=membership_id
        )
        match = next((a for a in assignments if a["id"] == assign.id), None)
        if match:
            return match
        return {
            "id": assign.id,
            "membership_id": assign.membership_id,
            "department_id": assign.department_id,
            "role_id": assign.role_id,
            "role_name": "Assigned Role",
            "role_code": "role",
            "role_version_id": assign.role_version_id,
            "assignment_status": assign.assignment_status,
            "assignment_source": assign.assignment_source,
            "scope_type": assign.scope_type,
            "is_active": assign.is_active,
            "assigned_at": assign.created_at,
            "activated_at": assign.activated_at,
        }
    except TierFeatureRestrictedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.detail)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/employees/{membership_id}/assignments/{assignment_id}", status_code=status.HTTP_200_OK)
def revoke_employee_role_assignment(
    membership_id: uuid.UUID,
    assignment_id: uuid.UUID,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """Revoke an employee's role assignment."""
    try:
        HospitalAdminService.revoke_employee_role_assignment(
            db,
            hospital_id=admin_ctx.hospital.id,
            membership_id=membership_id,
            assignment_id=assignment_id,
            admin_user_id=admin_ctx.user.id,
        )
        return {"success": True, "message": "Role assignment revoked successfully."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/employees/{membership_id}/overrides", response_model=List[PermissionOverrideItemResponse], status_code=status.HTTP_200_OK)
def list_employee_overrides(
    membership_id: uuid.UUID,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List active individual permission overrides (GRANT or DENY) for an employee."""
    try:
        return HospitalAdminService.list_employee_overrides(
            db, hospital_id=admin_ctx.hospital.id, membership_id=membership_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/employees/{membership_id}/overrides", response_model=PermissionOverrideItemResponse, status_code=status.HTTP_201_CREATED)
def create_employee_override(
    membership_id: uuid.UUID,
    payload: CreatePermissionOverrideRequest,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """Create explicit individual permission override.
    DENY strictly overrides role-inherited grants.
    GRANT adds capability bounded by subscription tier.
    """
    try:
        override = HospitalAdminService.create_employee_override(
            db,
            hospital_id=admin_ctx.hospital.id,
            membership_id=membership_id,
            payload=payload,
            plan_code=admin_ctx.plan_code,
            admin_user_id=admin_ctx.user.id,
        )
        overrides = HospitalAdminService.list_employee_overrides(
            db, hospital_id=admin_ctx.hospital.id, membership_id=membership_id
        )
        match = next((o for o in overrides if o["id"] == override.id), None)
        if match:
            return match
        return {
            "id": override.id,
            "membership_id": override.membership_id,
            "permission_code": payload.permission_code,
            "permission_name": payload.permission_code,
            "override_type": override.override_type,
            "department_id": override.department_id,
            "reason": override.reason,
            "expires_at": override.expires_at,
            "granted_by_user_id": override.granted_by_user_id,
            "created_at": override.created_at,
        }
    except TierFeatureRestrictedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.detail)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/employees/{membership_id}/overrides/{override_id}", status_code=status.HTTP_200_OK)
def revoke_employee_override(
    membership_id: uuid.UUID,
    override_id: uuid.UUID,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """Revoke an active permission override."""
    try:
        HospitalAdminService.revoke_employee_override(
            db,
            hospital_id=admin_ctx.hospital.id,
            membership_id=membership_id,
            override_id=override_id,
            admin_user_id=admin_ctx.user.id,
        )
        return {"success": True, "message": "Permission override revoked."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/employees/{membership_id}/effective-permissions", response_model=EmployeeEffectivePermissionsResponse, status_code=status.HTTP_200_OK)
def get_employee_effective_permissions(
    membership_id: uuid.UUID,
    department_id: Optional[uuid.UUID] = Query(None),
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Authoritative backend inspector: returns full explanation, status, source role,
    scope, and expiry for all 43 atomic permissions for an employee.
    """
    try:
        return HospitalAdminService.get_employee_effective_permissions(
            db,
            hospital_id=admin_ctx.hospital.id,
            membership_id=membership_id,
            department_id=department_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# =========================================================================
# 8. REGISTRATION & ASSIGNMENT APPROVAL DECISIONS
# =========================================================================

@router.get("/approvals", response_model=List[PendingApprovalItem], status_code=status.HTTP_200_OK)
def list_pending_approvals(
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List pending employee registration requests and requested role slots for the active hospital."""
    return HospitalAdminService.list_pending_approvals(db, hospital_id=admin_ctx.hospital.id)


@router.post("/approvals/{request_id}/decide", status_code=status.HTTP_200_OK)
def decide_registration_approval(
    request_id: uuid.UUID,
    payload: RegistrationApprovalDecisionRequest,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("approval:manage")),
):
    """Hospital Administrator final approval/rejection decision on requested department roles.
    Atomically activates tenant membership, user identity, and role version assignments upon approval.
    """
    try:
        return HospitalAdminService.decide_registration_approval(
            db,
            hospital_id=admin_ctx.hospital.id,
            registration_request_id=request_id,
            payload=payload,
            admin_user_id=admin_ctx.user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# =========================================================================
# 9. EMPLOYEE ACCESS REVOCATION REQUESTS (DEPARTMENT HEAD ESCALATION)
# =========================================================================

class RevocationDecisionRequest(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT)$")
    decision_notes: Optional[str] = None


class AdminRevocationRequestItem(BaseModel):
    id: str
    hospital_id: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    requester_membership_id: str
    requester_name: str
    target_membership_id: str
    target_assignment_id: Optional[str] = None
    target_name: str
    target_employee_uid: str
    revocation_scope: str
    reason: str
    supporting_details: Optional[str] = None
    status: str
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[str] = None
    decision_notes: Optional[str] = None
    created_at: str
    updated_at: str


@router.get("/revocation-requests", response_model=List[AdminRevocationRequestItem], status_code=status.HTTP_200_OK)
def list_admin_revocation_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """Lists department head access revocation escalation requests for this hospital."""
    from app.models.revocation_request import EmployeeRevocationRequest
    from app.models.department import Department
    from sqlalchemy import desc

    query = (
        db.query(EmployeeRevocationRequest, Department)
        .outerjoin(Department, Department.id == EmployeeRevocationRequest.department_id)
        .filter(EmployeeRevocationRequest.hospital_id == admin_ctx.hospital.id)
    )
    if status_filter:
        query = query.filter(EmployeeRevocationRequest.status == status_filter.upper())

    results = query.order_by(desc(EmployeeRevocationRequest.created_at)).all()

    return [
        AdminRevocationRequestItem(
            id=str(r.id),
            hospital_id=str(r.hospital_id),
            department_id=str(r.department_id) if r.department_id else None,
            department_name=dept.name if dept else "Hospital-Wide",
            requester_membership_id=str(r.requester_membership_id),
            requester_name=r.requester_name,
            target_membership_id=str(r.target_membership_id),
            target_assignment_id=str(r.target_assignment_id) if r.target_assignment_id else None,
            target_name=r.target_name,
            target_employee_uid=r.target_employee_uid,
            revocation_scope=r.revocation_scope,
            reason=r.reason,
            supporting_details=r.supporting_details,
            status=r.status,
            reviewer_name=r.reviewer_name,
            reviewed_at=r.reviewed_at.isoformat() if r.reviewed_at else None,
            decision_notes=r.decision_notes,
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat(),
        )
        for r, dept in results
    ]


@router.post("/revocation-requests/{request_id}/decide", response_model=AdminRevocationRequestItem, status_code=status.HTTP_200_OK)
def decide_revocation_request(
    request_id: uuid.UUID,
    payload: RevocationDecisionRequest,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
    _: Any = Depends(require_permission("employee:manage")),
):
    """Administrator reviews and decides on an employee revocation request from a Department Head.
    If APPROVED:
      - For DEPARTMENT_ASSIGNMENT: immediately revokes the specific departmental role assignment.
      - For FULL_MEMBERSHIP: updates target employee status to 'terminated' / revokes all active assignments.
    """
    from datetime import datetime, timezone
    from app.models.revocation_request import EmployeeRevocationRequest
    from app.models.department import Department
    from app.models.notification import HospitalNotification
    from app.models.audit import AuditLog
    import json

    rev_req = (
        db.query(EmployeeRevocationRequest)
        .filter(
            EmployeeRevocationRequest.id == request_id,
            EmployeeRevocationRequest.hospital_id == admin_ctx.hospital.id,
        )
        .first()
    )
    if not rev_req:
        raise HTTPException(status_code=404, detail="Revocation request not found.")

    if rev_req.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"This revocation request has already been decided ({rev_req.status}).",
        )

    reviewer_display = admin_ctx.user.full_name or admin_ctx.user.username
    now = datetime.now(timezone.utc)

    if payload.action == "APPROVE":
        if rev_req.revocation_scope == "DEPARTMENT_ASSIGNMENT" and rev_req.target_assignment_id:
            try:
                HospitalAdminService.revoke_employee_role_assignment(
                    db=db,
                    hospital_id=admin_ctx.hospital.id,
                    membership_id=rev_req.target_membership_id,
                    assignment_id=rev_req.target_assignment_id,
                    admin_user_id=admin_ctx.user.id,
                )
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to revoke target role assignment: {str(e)}",
                )
        else:
            try:
                from app.schemas.hospital_admin import UpdateEmployeeStatusRequest
                HospitalAdminService.update_employee_status(
                    db=db,
                    hospital_id=admin_ctx.hospital.id,
                    membership_id=rev_req.target_membership_id,
                    payload=UpdateEmployeeStatusRequest(
                        status="terminated",
                        reason=f"Department Head escalation approved: {rev_req.reason}",
                    ),
                    admin_user_id=admin_ctx.user.id,
                )
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to terminate target membership: {str(e)}",
                )

        rev_req.status = "APPROVED"
        rev_req.reviewer_user_id = admin_ctx.user.id
        rev_req.reviewer_name = reviewer_display
        rev_req.reviewed_at = now
        rev_req.decision_notes = payload.decision_notes

        notif = HospitalNotification(
            hospital_id=admin_ctx.hospital.id,
            recipient_user_id=rev_req.requester_user_id,
            title="Revocation Request Approved",
            message=(
                f"Your access revocation request for {rev_req.target_name} ({rev_req.target_employee_uid}) "
                f"was APPROVED by administrator {reviewer_display}."
                + (f" Notes: {payload.decision_notes}" if payload.decision_notes else "")
            ),
            category="security",
            is_read=False,
        )
        db.add(notif)

    elif payload.action == "REJECT":
        rev_req.status = "REJECTED"
        rev_req.reviewer_user_id = admin_ctx.user.id
        rev_req.reviewer_name = reviewer_display
        rev_req.reviewed_at = now
        rev_req.decision_notes = payload.decision_notes

        notif = HospitalNotification(
            hospital_id=admin_ctx.hospital.id,
            recipient_user_id=rev_req.requester_user_id,
            title="Revocation Request Rejected",
            message=(
                f"Your access revocation request for {rev_req.target_name} ({rev_req.target_employee_uid}) "
                f"was REJECTED by administrator {reviewer_display}."
                + (f" Notes: {payload.decision_notes}" if payload.decision_notes else "")
            ),
            category="security",
            is_read=False,
        )
        db.add(notif)

    audit = AuditLog(
        hospital_id=admin_ctx.hospital.id,
        user_id=admin_ctx.user.id,
        action=f"REVOCATION_REQUEST_{payload.action}",
        resource_type="employee_revocation_request",
        resource_id=str(rev_req.id),
        details=json.dumps({
            "request_id": str(rev_req.id),
            "target_user_id": str(rev_req.target_user_id),
            "target_name": rev_req.target_name,
            "action": payload.action,
            "decision_notes": payload.decision_notes,
        }),
    )
    db.add(audit)

    db.commit()
    db.refresh(rev_req)

    dept = db.query(Department).filter(Department.id == rev_req.department_id).first()
    dept_name = dept.name if dept else "Department"

    return AdminRevocationRequestItem(
        id=str(rev_req.id),
        hospital_id=str(rev_req.hospital_id),
        department_id=str(rev_req.department_id) if rev_req.department_id else None,
        department_name=dept.name if dept else "Hospital-Wide",
        requester_membership_id=str(rev_req.requester_membership_id),
        requester_name=rev_req.requester_name,
        target_membership_id=str(rev_req.target_membership_id),
        target_assignment_id=str(rev_req.target_assignment_id) if rev_req.target_assignment_id else None,
        target_name=rev_req.target_name,
        target_employee_uid=rev_req.target_employee_uid,
        revocation_scope=rev_req.revocation_scope,
        reason=rev_req.reason,
        supporting_details=rev_req.supporting_details,
        status=rev_req.status,
        reviewer_name=rev_req.reviewer_name,
        reviewed_at=rev_req.reviewed_at.isoformat() if rev_req.reviewed_at else None,
        decision_notes=rev_req.decision_notes,
        created_at=rev_req.created_at.isoformat(),
        updated_at=rev_req.updated_at.isoformat(),
    )

