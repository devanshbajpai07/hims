import uuid
from typing import List, Optional
from fastapi import APIRouter, Cookie, Depends, Header, Request, Response, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.exceptions import CSRFError, InvalidCredentialsError
from app.db.database import get_db
from app.models.purchaser import Purchaser, PurchaserSession
from app.schemas.purchaser_auth import (
    PurchaserAuthResponse,
    PurchaserChangePasswordRequest,
    PurchaserForgotPasswordRequest,
    PurchaserLoginRequest,
    PurchaserRegisterRequest,
    PurchaserRequestEmailChangeRequest,
    PurchaserResetPasswordRequest,
    PurchaserResponse,
    PurchaserResendOTPRequest,
    PurchaserSessionItem,
    PurchaserVerifyEmailChangeRequest,
    PurchaserVerifyEmailRequest,
    PurchaserUpdateNameRequest,
    PurchaserEmailChangeOTPRequest,
    PurchaserEmailChangeVerifyOTPRequest,
    PurchaserScheduleDeletionRequest,
)
from app.services.purchaser_auth_service import PurchaserAuthService

router = APIRouter(prefix="/purchaser/auth", tags=["Purchaser Authentication"])

SESSION_COOKIE_KEY = "hims_purchaser_session"
CSRF_COOKIE_KEY = "hims_purchaser_csrf"


def get_client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def get_current_purchaser(
    request: Request,
    db: Session = Depends(get_db),
    hims_purchaser_session: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
    x_csrf_token: Optional[str] = Header(None),
    hims_purchaser_csrf: Optional[str] = Cookie(None),
) -> Purchaser:
    # 1. Resolve token from cookie or Authorization header
    token = None
    from_cookie = False
    if hims_purchaser_session:
        token = hims_purchaser_session
        from_cookie = True
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]

    if not token:
        raise InvalidCredentialsError("Purchaser authentication required.")

    # 2. CSRF verification on state-changing requests when authenticated via cookie
    if from_cookie and request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        if not x_csrf_token or not hims_purchaser_csrf or x_csrf_token != hims_purchaser_csrf:
            raise CSRFError("CSRF verification token mismatch.")

    # 3. Retrieve purchaser and session from database
    result = PurchaserAuthService.get_purchaser_from_token(db, token)
    if not result:
        raise InvalidCredentialsError("Purchaser session expired or invalid.")

    purchaser, _ = result
    return purchaser


def set_auth_cookies(
    response: Response,
    session_token: str,
    csrf_token: str,
    remember_device: bool,
) -> None:
    is_prod = settings.ENVIRONMENT.lower() == "production"
    max_age = (
        settings.SESSION_COOKIE_MAX_AGE_DAYS * 86400 if remember_device else 86400
    )

    response.set_cookie(
        key=SESSION_COOKIE_KEY,
        value=session_token,
        max_age=max_age,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=CSRF_COOKIE_KEY,
        value=csrf_token,
        max_age=max_age,
        httponly=False,  # Client-accessible for double-submit CSRF protection
        secure=is_prod,
        samesite="lax",
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    is_prod = settings.ENVIRONMENT.lower() == "production"
    response.delete_cookie(key=SESSION_COOKIE_KEY, path="/", secure=is_prod, samesite="lax")
    response.delete_cookie(key=CSRF_COOKIE_KEY, path="/", secure=is_prod, samesite="lax")


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: PurchaserRegisterRequest, db: Session = Depends(get_db)):
    """Registers a new institutional purchaser account and dispatches a 6-digit email OTP."""
    result = PurchaserAuthService.register_purchaser(
        db=db,
        full_name=payload.full_name,
        email=payload.email,
        password=payload.password,
        confirm_password=payload.confirm_password,
    )
    return result


@router.post("/verify-email", response_model=PurchaserAuthResponse)
def verify_email(
    payload: PurchaserVerifyEmailRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Verifies the single-use OTP and logs the purchaser in with secure session cookies."""
    ip_addr = get_client_ip(request)
    u_agent = request.headers.get("user-agent")

    purchaser, session_token, csrf_token = PurchaserAuthService.verify_email(
        db=db,
        email=payload.email,
        otp=payload.otp,
        ip_address=ip_addr,
        user_agent=u_agent,
    )
    set_auth_cookies(response, session_token, csrf_token, remember_device=True)

    return PurchaserAuthResponse(
        purchaser=PurchaserResponse.model_validate(purchaser),
        csrf_token=csrf_token,
        message="Email verified successfully. Welcome to your Purchaser Portal.",
    )


@router.post("/resend-otp")
def resend_otp(payload: PurchaserResendOTPRequest, db: Session = Depends(get_db)):
    """Resends a fresh 6-digit OTP subject to 60s cooldown limit."""
    return PurchaserAuthService.resend_otp(db, payload.email)


@router.post("/login", response_model=PurchaserAuthResponse)
def login(
    payload: PurchaserLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Authenticates purchaser with email and password, establishing server-managed session."""
    ip_addr = get_client_ip(request)
    u_agent = request.headers.get("user-agent")

    purchaser, session_token, csrf_token = PurchaserAuthService.login_purchaser(
        db=db,
        email=payload.email,
        password=payload.password,
        remember_device=payload.remember_device,
        ip_address=ip_addr,
        user_agent=u_agent,
    )
    set_auth_cookies(response, session_token, csrf_token, payload.remember_device)

    return PurchaserAuthResponse(
        purchaser=PurchaserResponse.model_validate(purchaser),
        csrf_token=csrf_token,
        message=f"Welcome back, {purchaser.full_name}.",
    )


@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
    hims_purchaser_session: Optional[str] = Cookie(None),
    hims_purchaser_csrf: Optional[str] = Cookie(None),
    x_csrf_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
):
    """Terminates active purchaser session and clears cookies with CSRF protection."""
    token = None
    from_cookie = False

    if hims_purchaser_session:
        token = hims_purchaser_session
        from_cookie = True
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]

    # For cookie-authenticated requests, require a valid X-CSRF-Token matching the CSRF cookie
    if from_cookie:
        if not x_csrf_token or not hims_purchaser_csrf or x_csrf_token != hims_purchaser_csrf:
            raise CSRFError("CSRF verification token mismatch.")

    if token:
        PurchaserAuthService.logout_session(db, token)

    clear_auth_cookies(response)
    return {"message": "Purchaser session terminated successfully."}


@router.get("/me", response_model=PurchaserResponse)
def get_current_purchaser_profile(
    current_purchaser: Purchaser = Depends(get_current_purchaser),
):
    """Retrieves current authenticated purchaser profile."""
    return PurchaserResponse.model_validate(current_purchaser)


@router.get("/sessions", response_model=List[PurchaserSessionItem])
def list_active_sessions(
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Lists all active sessions for the current purchaser."""
    sessions = PurchaserAuthService.list_sessions(db, current_purchaser.id)
    return [
        PurchaserSessionItem(
            id=s.id,
            ip_address=s.ip_address,
            user_agent=s.user_agent,
            remember_device=s.remember_device,
            created_at=s.created_at,
            last_activity_at=s.last_activity_at,
            expires_at=s.expires_at,
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def revoke_specific_session(
    session_id: uuid.UUID,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Revokes a specific active session."""
    revoked = PurchaserAuthService.revoke_session(db, current_purchaser.id, session_id)
    if not revoked:
        return Response(status_code=status.HTTP_404_NOT_FOUND)
    return {"message": "Session revoked successfully."}


@router.post("/change-password")
def change_password(
    payload: PurchaserChangePasswordRequest,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
    hims_purchaser_session: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Changes purchaser password and invalidates all other active sessions."""
    token = hims_purchaser_session
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]

    PurchaserAuthService.change_password(
        db=db,
        purchaser=current_purchaser,
        current_password=payload.current_password,
        new_password=payload.new_password,
        confirm_new_password=payload.confirm_new_password,
        current_session_token=token,
    )
    return {"message": "Password changed successfully. Other sessions have been revoked."}


@router.post("/forgot-password")
def forgot_password(
    payload: PurchaserForgotPasswordRequest, db: Session = Depends(get_db)
):
    """Dispatches a password reset link (enumeration-resistant response)."""
    return PurchaserAuthService.request_password_reset(db, payload.email)


@router.post("/reset-password")
def reset_password(
    payload: PurchaserResetPasswordRequest, db: Session = Depends(get_db)
):
    """Consumes single-use reset token and resets password, invalidating all sessions."""
    return PurchaserAuthService.complete_password_reset(
        db=db,
        token=payload.token,
        new_password=payload.new_password,
        confirm_new_password=payload.confirm_new_password,
    )


@router.post("/change-email/request")
def request_email_change(
    payload: PurchaserRequestEmailChangeRequest,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Requests email change, verifying current password and sending link to proposed email."""
    return PurchaserAuthService.request_email_change(
        db=db,
        purchaser=current_purchaser,
        current_password=payload.current_password,
        new_email=payload.new_email,
    )


@router.post("/change-email/verify")
def verify_email_change(
    payload: PurchaserVerifyEmailChangeRequest, db: Session = Depends(get_db)
):
    """Completes email change upon verification of the new address."""
    return PurchaserAuthService.verify_email_change(db, payload.token)


@router.put("/name", response_model=PurchaserResponse)
def update_purchaser_name(
    payload: PurchaserUpdateNameRequest,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Updates purchaser's legal full name."""
    updated = PurchaserAuthService.update_full_name(db, current_purchaser, payload.full_name)
    return PurchaserResponse.model_validate(updated)


@router.post("/email/request-otp")
def request_email_change_otp(
    payload: PurchaserEmailChangeOTPRequest,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Initiates email change by sending a single-use 6-digit OTP to current (previous) email."""
    return PurchaserAuthService.request_email_change_otp(
        db=db, purchaser=current_purchaser, new_email=payload.new_email
    )


@router.post("/email/confirm-otp", response_model=PurchaserResponse)
def confirm_email_change_otp(
    payload: PurchaserEmailChangeVerifyOTPRequest,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Verifies OTP sent to previous email and completes email update."""
    updated = PurchaserAuthService.verify_email_change_otp(
        db=db, purchaser=current_purchaser, new_email=payload.new_email, otp=payload.otp
    )
    return PurchaserResponse.model_validate(updated)


@router.post("/schedule-deletion")
def schedule_account_deletion(
    payload: PurchaserScheduleDeletionRequest,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Schedules purchaser account for deletion after 60-day recovery window and notifies hospital administrators."""
    return PurchaserAuthService.schedule_account_deletion(
        db=db,
        purchaser=current_purchaser,
        password=payload.password,
        reason=payload.reason,
    )


@router.post("/cancel-deletion")
def cancel_account_deletion(
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Cancels pending deletion request, restoring full enterprise account access and informing administrators."""
    return PurchaserAuthService.cancel_account_deletion(db=db, purchaser=current_purchaser)

