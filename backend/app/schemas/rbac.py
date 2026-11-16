import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# =========================================================================
# PERMISSION SCHEMAS
# =========================================================================

class PermissionItemResponse(BaseModel):
    code: str
    name: str
    category: str
    module: str
    description: Optional[str] = None
    risk_level: str
    min_tier: str
    is_system: bool
    is_active: bool
    is_tier_permitted: bool = True


class PermissionCatalogueResponse(BaseModel):
    hospital_tier: str
    total_permissions: int
    permitted_permissions: int
    permissions: List[PermissionItemResponse]


# =========================================================================
# ROLE VERSION SCHEMAS
# =========================================================================

class RoleVersionItemResponse(BaseModel):
    id: uuid.UUID
    role_id: uuid.UUID
    role_name: str
    role_code: str
    version_number: int
    parent_role_id: Optional[uuid.UUID] = None
    parent_role_name: Optional[str] = None
    change_reason: Optional[str] = None
    is_active: bool
    created_by_user_id: Optional[uuid.UUID] = None
    created_by_name: Optional[str] = None
    activated_at: Optional[datetime] = None
    created_at: datetime
    permission_codes: List[str] = []


class CreateRoleVersionRequest(BaseModel):
    permission_codes: List[str] = Field(..., min_length=1)
    parent_role_id: Optional[uuid.UUID] = None
    change_reason: str = Field(..., min_length=3, max_length=512)


# =========================================================================
# MULTI-DEPARTMENT ROLE ASSIGNMENT SCHEMAS
# =========================================================================

class RoleAssignmentItemResponse(BaseModel):
    id: uuid.UUID
    membership_id: uuid.UUID
    department_id: Optional[uuid.UUID] = None
    department_name: Optional[str] = None
    role_id: uuid.UUID
    role_name: str
    role_code: str
    role_version_id: Optional[uuid.UUID] = None
    role_version_number: Optional[int] = None
    assignment_status: str
    assignment_source: str
    scope_type: str
    scope_department_ids: Optional[str] = None
    is_active: bool
    assigned_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None


class CreateRoleAssignmentRequest(BaseModel):
    department_id: Optional[uuid.UUID] = None
    role_id: uuid.UUID
    role_version_id: Optional[uuid.UUID] = None
    scope_type: str = Field(default="DEPARTMENT", pattern="^(DEPARTMENT|MULTI_DEPARTMENT|FACILITY)$")
    scope_department_ids: Optional[List[uuid.UUID]] = None


# =========================================================================
# PERMISSION OVERRIDE SCHEMAS (GRANT / DENY)
# =========================================================================

class PermissionOverrideItemResponse(BaseModel):
    id: uuid.UUID
    membership_id: uuid.UUID
    permission_code: str
    permission_name: str
    override_type: str  # "GRANT" | "DENY"
    department_id: Optional[uuid.UUID] = None
    department_name: Optional[str] = None
    reason: str
    expires_at: Optional[datetime] = None
    granted_by_user_id: Optional[uuid.UUID] = None
    granted_by_name: Optional[str] = None
    created_at: datetime


class CreatePermissionOverrideRequest(BaseModel):
    permission_code: str = Field(..., min_length=2, max_length=64)
    override_type: str = Field(..., pattern="^(GRANT|DENY)$")
    department_id: Optional[uuid.UUID] = None
    reason: str = Field(..., min_length=3, max_length=512)
    expires_at: Optional[datetime] = None


# =========================================================================
# EFFECTIVE PERMISSIONS SCHEMAS
# =========================================================================

class EffectivePermissionResponseItem(BaseModel):
    code: str
    name: str
    category: str
    module: str
    is_granted: bool
    status: str  # "GRANTED", "DENIED_BY_OVERRIDE", "DENIED_BY_TIER", "NOT_GRANTED"
    source: str  # "ROLE", "OVERRIDE_GRANT", "INHERITED_ROLE", "TIER_RESTRICTED", "NONE"
    source_role_name: Optional[str] = None
    source_role_version: Optional[int] = None
    department_scope: Optional[str] = None
    reason: Optional[str] = None
    expires_at: Optional[datetime] = None
    explanation: str


class EmployeeEffectivePermissionsResponse(BaseModel):
    membership_id: uuid.UUID
    employee_name: str
    employee_uid: str
    plan_code: str
    active_assignments_count: int
    active_overrides_count: int
    permissions: List[EffectivePermissionResponseItem]


# =========================================================================
# APPROVAL WORKFLOW SCHEMAS
# =========================================================================

class AssignmentDecisionItem(BaseModel):
    assignment_id: uuid.UUID
    decision: str = Field(..., pattern="^(approved|rejected)$")


class RegistrationApprovalDecisionRequest(BaseModel):
    verify_employee_uid: bool = True
    assignment_decisions: List[AssignmentDecisionItem]
    notes: Optional[str] = None


class PendingAssignmentSlot(BaseModel):
    id: uuid.UUID
    slot_number: int
    department_id: Optional[uuid.UUID] = None
    department_name: Optional[str] = None
    role_id: uuid.UUID
    role_name: str
    role_code: str
    status: str
    dept_head_notes: Optional[str] = None
    admin_notes: Optional[str] = None


class PendingApprovalItem(BaseModel):
    id: uuid.UUID
    hospital_id: uuid.UUID
    email: str
    full_name: str
    employee_uid_claim: str
    employee_uid_verified: bool
    status: str
    created_at: datetime
    assignment_requests: List[PendingAssignmentSlot]

