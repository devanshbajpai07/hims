import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_PATTERN = r"^[\w\.-]+@[\w\.-]+\.\w+$"


class PurchaserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=128)
    email: str = Field(...)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email", mode="before")
    def clean_email(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class PurchaserVerifyEmailRequest(BaseModel):
    email: str
    otp: str = Field(..., min_length=6, max_length=6)

    @field_validator("email", mode="before")
    def clean_email(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class PurchaserResendOTPRequest(BaseModel):
    email: str

    @field_validator("email", mode="before")
    def clean_email(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class PurchaserLoginRequest(BaseModel):
    email: str
    password: str
    remember_device: bool = False

    @field_validator("email", mode="before")
    def clean_email(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class PurchaserChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_new_password: str = Field(..., min_length=8, max_length=128)


class PurchaserForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email", mode="before")
    def clean_email(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class PurchaserResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_new_password: str = Field(..., min_length=8, max_length=128)


class PurchaserRequestEmailChangeRequest(BaseModel):
    current_password: str
    new_email: str

    @field_validator("new_email", mode="before")
    def clean_email(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class PurchaserVerifyEmailChangeRequest(BaseModel):
    token: str


class PurchaserSessionItem(BaseModel):
    id: uuid.UUID
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    remember_device: bool
    created_at: datetime
    last_activity_at: datetime
    expires_at: datetime


class PurchaserUpdateNameRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=128)

    @field_validator("full_name", mode="before")
    def clean_name(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class PurchaserEmailChangeOTPRequest(BaseModel):
    new_email: str

    @field_validator("new_email", mode="before")
    def clean_email(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class PurchaserEmailChangeVerifyOTPRequest(BaseModel):
    new_email: str
    otp: str = Field(..., min_length=6, max_length=6)

    @field_validator("new_email", mode="before")
    def clean_email(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v

    @field_validator("otp", mode="before")
    def clean_otp(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class PurchaserScheduleDeletionRequest(BaseModel):
    password: str
    reason: Optional[str] = None


class PurchaserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    is_email_verified: bool
    account_status: str
    created_at: datetime
    last_login_at: Optional[datetime] = None
    deletion_scheduled_at: Optional[datetime] = None


class PurchaserAuthResponse(BaseModel):
    purchaser: PurchaserResponse
    session_token: Optional[str] = None
    token: Optional[str] = None
    csrf_token: str
    message: str
