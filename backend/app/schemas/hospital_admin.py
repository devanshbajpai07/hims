import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ==========================================
# Hospital & Facility Schemas
# ==========================================

class HospitalCreateRequest(BaseModel):
    subscription_id: uuid.UUID
    name: str = Field(..., min_length=2, max_length=255)
    city: str = Field(..., min_length=2, max_length=128)
    facility_type: str = Field(default="General Hospital", max_length=64)
    address: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = Field(default="United States", max_length=64)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    licence_number: Optional[str] = None


class HospitalSummaryResponse(BaseModel):
    id: uuid.UUID
    hospital_uid: str
    name: str
    city: str
    facility_type: Optional[str] = None
    subscription_id: Optional[uuid.UUID] = None
    plan_code: str
    plan_name: str
    active_admins_count: int
    pending_invites_count: int
    max_administrators: int
    max_employees: int
    is_active: bool
    created_at: datetime


class HospitalDetailResponse(BaseModel):
    id: uuid.UUID
    hospital_uid: str
    name: str
    city: str
    facility_type: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    licence_number: Optional[str] = None
    subscription_id: Optional[uuid.UUID] = None
    plan_code: str
    plan_name: str
    subscription_status: str
    current_period_ends_at: Optional[datetime] = None
    active_admins_count: int
    pending_invites_count: int
    max_administrators: int
    max_employees: int
    features: List[str]
    created_at: datetime


# ==========================================
# Administrator Invitation & Membership Schemas
# ==========================================

class AdminInviteRequest(BaseModel):
    invitee_name: str = Field(..., min_length=2, max_length=128)
    invitee_email: str = Field(..., min_length=5, max_length=255)
    invitee_phone: Optional[str] = Field(default=None, max_length=32)
    invitee_designation: Optional[str] = Field(default=None, max_length=128)


class AdminInviteItem(BaseModel):
    id: uuid.UUID
    hospital_id: uuid.UUID
    invitee_name: str
    invitee_email: str
    invitee_phone: Optional[str] = None
    invitee_designation: Optional[str] = None
    status: str
    created_at: datetime
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None


class ActiveAdminItem(BaseModel):
    id: uuid.UUID  # HospitalAdministrator ID
    user_id: uuid.UUID
    full_name: str
    email: str
    username: str
    employee_uid: str
    designation: Optional[str] = None
    status: str
    created_at: datetime
    last_login_at: Optional[datetime] = None


class HospitalAdministratorsManagementResponse(BaseModel):
    hospital: HospitalDetailResponse
    active_administrators: List[ActiveAdminItem]
    invitations: List[AdminInviteItem]
    max_administrators: int
    remaining_seats: int


# ==========================================
# Invitation Acceptance & Token Verification
# ==========================================

class InvitationVerifyResponse(BaseModel):
    valid: bool
    hospital_id: uuid.UUID
    hospital_uid: str
    hospital_name: str
    invitee_name: str
    invitee_email: str
    invitee_designation: Optional[str] = None
    expires_at: datetime
    plan_code: str


class AcceptInvitationRequest(BaseModel):
    token: str = Field(..., min_length=16)
    password: str = Field(..., min_length=8, max_length=128)
    username: Optional[str] = Field(default=None, max_length=64)
    phone: Optional[str] = Field(default=None, max_length=32)


class AcceptInvitationResponse(BaseModel):
    success: bool
    message: str
    hospital_uid: str
    hospital_name: str
    username: str
    email: str


# ==========================================
# Administrator Authentication Schemas
# ==========================================

class AdminLoginRequest(BaseModel):
    username_or_email: str = Field(..., min_length=2)
    password: str = Field(..., min_length=1)
    hospital_id: Optional[uuid.UUID] = None
    remember_me: bool = False


class AdminWorkspaceOption(BaseModel):
    hospital_id: uuid.UUID
    hospital_uid: str
    hospital_name: str
    plan_code: str
    plan_name: str


class AdminUserProfile(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    full_name: str


class AdminHospitalContext(BaseModel):
    id: uuid.UUID
    hospital_uid: str
    name: str
    city: str
    plan_code: str
    plan_name: str
    max_administrators: int
    max_employees: int
    features: List[str]


class AdminLoginResponse(BaseModel):
    success: bool
    requires_hospital_selection: bool = False
    available_hospitals: List[AdminWorkspaceOption] = []
    user: Optional[AdminUserProfile] = None
    hospital: Optional[AdminHospitalContext] = None
    token: Optional[str] = None
    message: str


# ==========================================
# Overview & Metrics Schemas
# ==========================================

class AdminOverviewResponse(BaseModel):
    hospital: AdminHospitalContext
    total_employees: int
    active_employees: int
    department_count: int
    active_admin_count: int
    pending_employee_invites: int
    pending_registration_requests: int
    pending_role_requests: int
    quota_usage: Dict[str, Any]
    recent_activity: List[Dict[str, Any]]
    important_alerts: List[Dict[str, Any]]


# ==========================================
# Employee Management Schemas
# ==========================================

class EmployeeAssignmentSlot(BaseModel):
    scope_type: str = Field(default="DEPARTMENT", pattern="^(DEPARTMENT|FACILITY)$")
    department_id: Optional[uuid.UUID] = None
    role_id: uuid.UUID


class EmployeeInviteRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    full_name: str = Field(..., min_length=2, max_length=128)
    phone: Optional[str] = Field(default=None, max_length=32)
    designation: Optional[str] = Field(default=None, max_length=128)
    assignments: List[EmployeeAssignmentSlot] = Field(default_factory=list, max_length=5)
    # Backward compatibility fields
    department_id: Optional[uuid.UUID] = None
    role_ids: List[uuid.UUID] = Field(default_factory=list)


class EmployeeInvitationVerifyResponse(BaseModel):
    valid: bool
    invitation_id: uuid.UUID
    hospital_id: uuid.UUID
    hospital_name: str
    hospital_uid: str
    full_name: str
    email: str
    phone: Optional[str] = None
    designation: Optional[str] = None
    assignments: List[Dict[str, Any]]
    has_existing_account: bool
    suggested_username: Optional[str] = None
    expires_at: datetime


class AcceptEmployeeInvitationRequest(BaseModel):
    token: str = Field(..., min_length=10)
    username: Optional[str] = Field(default=None, min_length=3, max_length=64)
    password: str = Field(..., min_length=8)


class EmployeeInviteItem(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    designation: Optional[str] = None
    department_name: Optional[str] = None
    role_count: int
    status: str
    created_at: datetime
    expires_at: datetime
    assignments: Optional[List[Dict[str, Any]]] = None


class AdminEmployeeItem(BaseModel):
    id: uuid.UUID  # TenantMembership ID
    user_id: uuid.UUID
    full_name: str
    username: str
    email: str
    employee_uid: str
    status: str
    departments: List[str]
    roles: List[str]
    is_administrator: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None


class UpdateEmployeeStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(active|suspended|terminated)$")
    reason: Optional[str] = None


class AssignEmployeeRolesRequest(BaseModel):
    department_id: Optional[uuid.UUID] = None
    role_ids: List[uuid.UUID] = Field(..., min_length=1)


# ==========================================
# Department & Role Schemas
# ==========================================

class DepartmentItem(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    description: Optional[str] = None
    employee_count: int
    is_active: bool


class CreateDepartmentRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    code: str = Field(..., min_length=2, max_length=64)
    description: Optional[str] = None


class RoleItem(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    scope: str
    description: Optional[str] = None
    employee_count: int
    is_active: bool
    permission_codes: Optional[List[str]] = []
    is_future_scope: Optional[bool] = False
    future_scope_notes: Optional[str] = None


class CreateRoleRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    code: str = Field(..., min_length=2, max_length=64)
    scope: str = Field(default="department", pattern="^(hospital|department)$")
    description: Optional[str] = None
    permission_codes: Optional[List[str]] = None
    parent_role_id: Optional[uuid.UUID] = None


# ==========================================
# Audit & Notification Schemas
# ==========================================

class AdminAuditItem(BaseModel):
    id: uuid.UUID
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[str] = None
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime


class NotificationItem(BaseModel):
    id: uuid.UUID
    title: str
    message: str
    category: str
    is_read: bool
    created_at: datetime
