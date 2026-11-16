from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class HIMSException(HTTPException):
    def __init__(
        self,
        status_code: int,
        detail: str,
        code: str,
        headers: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code


class HospitalNotFoundError(HIMSException):
    def __init__(self, detail: str = "Invalid Hospital UID or institution not found."):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            code="HOSPITAL_NOT_FOUND",
        )


class RegistrationDisabledError(HIMSException):
    def __init__(self, detail: str = "Employee self-registration is currently disabled for this institution."):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            code="REGISTRATION_DISABLED",
        )


class OTPInvalidError(HIMSException):
    def __init__(self, detail: str = "The verification code entered is invalid."):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            code="OTP_INVALID",
        )


class OTPExpiredError(HIMSException):
    def __init__(self, detail: str = "The verification code has expired. Please request a new code."):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            code="OTP_EXPIRED",
        )


class OTPCooldownError(HIMSException):
    def __init__(self, seconds_remaining: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {seconds_remaining} seconds before requesting another verification code.",
            code="OTP_COOLDOWN_ACTIVE",
        )


class OTPMaxAttemptsError(HIMSException):
    def __init__(self, detail: str = "Maximum verification attempts exceeded. Please initiate a new challenge."):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            code="OTP_MAX_ATTEMPTS_EXCEEDED",
        )


class UsernameTakenError(HIMSException):
    def __init__(self, detail: str = "The requested username is already registered on HIMS."):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            code="USERNAME_TAKEN",
        )


class InvalidCredentialsError(HIMSException):
    def __init__(self, detail: str = "Invalid username or password."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            code="INVALID_CREDENTIALS",
            headers={"WWW-Authenticate": "Bearer"},
        )


class AccountStatusError(HIMSException):
    def __init__(self, status_name: str, message: str):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message,
            code=f"ACCOUNT_{status_name.upper()}",
        )
        self.account_status = status_name


class FiveSlotLimitError(HIMSException):
    def __init__(self, detail: str = "Maximum of five department-role assignments allowed during initial registration."):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            code="FIVE_SLOT_LIMIT_EXCEEDED",
        )


class PurchaserAlreadyExistsError(HIMSException):
    def __init__(self, detail: str = "A purchaser account with this email address already exists. Please log in."):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            code="PURCHASER_ALREADY_EXISTS",
        )


class PurchaserNotVerifiedError(HIMSException):
    def __init__(self, email: str, detail: str = "Please verify your email address before logging in."):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            code="PURCHASER_EMAIL_UNVERIFIED",
        )
        self.email = email


class PurchaserNotFoundError(HIMSException):
    def __init__(self, detail: str = "Purchaser account not found."):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            code="PURCHASER_NOT_FOUND",
        )


class InvalidTokenError(HIMSException):
    def __init__(self, detail: str = "Invalid or expired token."):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            code="INVALID_TOKEN",
        )


class CSRFError(HIMSException):
    def __init__(self, detail: str = "CSRF verification failed."):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            code="CSRF_FAILED",
        )


class SubscriptionNotFoundError(HIMSException):
    def __init__(self, detail: str = "Subscription not found."):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            code="SUBSCRIPTION_NOT_FOUND",
        )


class SubscriptionAccessDeniedError(HIMSException):
    def __init__(self, detail: str = "Access to this subscription is denied."):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            code="SUBSCRIPTION_ACCESS_DENIED",
        )


class SubscriptionInactiveError(HIMSException):
    def __init__(self, detail: str = "This subscription is not currently active."):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            code="SUBSCRIPTION_INACTIVE",
        )


class SubscriptionExpiredError(HIMSException):
    def __init__(self, detail: str = "This subscription has expired."):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            code="SUBSCRIPTION_EXPIRED",
        )


class PasswordReuseError(HIMSException):
    def __init__(self, detail: str = "New password cannot be the same as your previous password. Please choose a different password."):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            code="PASSWORD_REUSE_FORBIDDEN",
        )




