from typing import List, Optional
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: Optional[str] = Field(None, description="Globally unique employee username or registered official email")
    username_or_email: Optional[str] = Field(None, description="Username or registered official email")
    email: Optional[str] = Field(None, description="Registered official email")
    password: str = Field(..., min_length=1, description="Employee password")
    remember_me: bool = Field(False, description="Persist device session")

    @property
    def identifier(self) -> str:
        ident = self.username_or_email or self.email or self.username or ""
        return ident.strip()


class HospitalWorkspaceOption(BaseModel):
    hospital_id: str
    hospital_uid: str
    hospital_name: str
    role_name: str
    role_code: str
    department_name: Optional[str] = None


class UserProfile(BaseModel):
    id: str
    username: str
    email: str
    full_name: str


class EmployeeAssignmentSummary(BaseModel):
    id: str
    role_id: str
    role_code: str
    role_name: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    scope_type: str = "DEPARTMENT"
    permissions: List[str] = []
    is_active: bool = True


class ActiveMembershipInfo(BaseModel):
    id: str
    hospital_id: str
    hospital_uid: str
    hospital_name: str
    employee_uid: str
    role: str
    role_name: str
    department: Optional[str] = None
    status: str
    active_assignment_id: Optional[str] = None
    assignments: List[EmployeeAssignmentSummary] = []
    effective_permissions: List[str] = []


class AuthSessionData(BaseModel):
    user: UserProfile
    active_membership: ActiveMembershipInfo
    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    session: Optional[AuthSessionData] = None
    requires_workspace_selection: bool = False
    user_id: Optional[str] = None
    available_memberships: List[HospitalWorkspaceOption] = []
    message: str


class WorkspaceSelectRequest(BaseModel):
    user_id: str
    hospital_id: str
    remember_me: bool = False


class ForgotPasswordRequest(BaseModel):
    identifier: str = Field(..., min_length=3, description="Username or registered email address")


class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    dev_reset_token: Optional[str] = None
    dev_reset_link: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Password reset token from email")
    new_password: str = Field(..., min_length=8, description="New strong password")
    confirm_password: str = Field(..., min_length=8, description="Password confirmation")


class ResetPasswordResponse(BaseModel):
    success: bool
    message: str


