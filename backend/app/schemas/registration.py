import uuid
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

EMAIL_PATTERN = r"^[\w\.-]+@[\w\.-]+\.\w+$"


class DepartmentRoleSlot(BaseModel):
    department_id: Optional[str] = Field(None, description="Department UUID if department-scoped role")
    role_id: str = Field(..., description="Role UUID")


class Stage2RegistrationRequest(BaseModel):
    verification_token: str = Field(..., description="Single-use OTP verification token from Stage 1")
    full_name: str = Field(..., min_length=2, max_length=128)
    employee_uid: str = Field(..., min_length=2, max_length=64, description="Official Employee UID (unverified claim)")
    username: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9._]{3,30}$")
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)
    requested_assignments: List[DepartmentRoleSlot] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="List of 1 to 5 requested department-role assignments",
    )

    @field_validator("confirm_password")
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v

    @field_validator("requested_assignments")
    def validate_slot_limits_and_duplicates(cls, v: List[DepartmentRoleSlot]) -> List[DepartmentRoleSlot]:
        if len(v) > 5:
            raise ValueError("Maximum of five department-role assignments allowed during initial registration.")
        if len(v) < 1:
            raise ValueError("At least one department-role assignment must be requested.")

        # Check duplicate combinations
        seen = set()
        for slot in v:
            key = (slot.department_id, slot.role_id)
            if key in seen:
                raise ValueError("Duplicate department-role assignments are not allowed.")
            seen.add(key)
        return v


class Stage2RegistrationResponse(BaseModel):
    registration_id: str
    status: str
    username: str
    full_name: str
    requested_slots_count: int
    message: str


class AdditionalAssignmentRequestSchema(BaseModel):
    hospital_uid: str
    email: str = Field(..., pattern=EMAIL_PATTERN)
    employee_uid: str
    requested_responsibilities: str = Field(..., min_length=10, max_length=2000)
    justification: str = Field(..., min_length=10, max_length=2000)


class AdditionalAssignmentResponse(BaseModel):
    request_id: str
    status: str
    message: str


class UsernameAvailabilityResponse(BaseModel):
    username: str
    available: bool
    suggestions: List[str] = []


class DepartmentOption(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None


class RoleOption(BaseModel):
    id: str
    name: str
    code: str
    scope: str
    description: Optional[str] = None
