from typing import Optional
from pydantic import BaseModel, Field

EMAIL_PATTERN = r"^[\w\.-]+@[\w\.-]+\.\w+$"


class StartRegistrationRequest(BaseModel):
    hospital_uid: str = Field(..., min_length=2, max_length=64, description="Hospital UID")
    email: str = Field(..., pattern=EMAIL_PATTERN, description="Official employee email address")


class StartRegistrationResponse(BaseModel):
    challenge_id: str
    email: str
    hospital_name: str
    hospital_uid: str
    resend_available_in_seconds: int
    message: str


class VerifyOTPRequest(BaseModel):
    challenge_id: str
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$", description="Six-digit OTP code")


class VerifyOTPResponse(BaseModel):
    verified: bool
    verification_token: str
    hospital_id: str
    hospital_uid: str
    hospital_name: str
    email: str
    message: str
