from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.database import get_db
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    WorkspaceSelectRequest,
    AuthSessionData,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
def login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Routine employee login requiring ONLY Username and Password.
    Identifies global user identity, verifies Argon2 hash, retrieves memberships,
    checks account status, and prompts workspace selection if multi-hospital.
    """
    ip_addr = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    result = AuthService.authenticate_user(
        db, credentials, ip_address=ip_addr, user_agent=user_agent
    )

    # Set secure HttpOnly session cookie if single workspace session established
    if result.get("session"):
        session: AuthSessionData = result["session"]
        max_age = (
            settings.SESSION_COOKIE_MAX_AGE_DAYS * 86400
            if credentials.remember_me
            else 86400
        )
        response.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=session.access_token,
            max_age=max_age,
            httponly=True,
            secure=(settings.ENVIRONMENT == "production"),
            samesite="lax",
        )

    return result


@router.post("/select-workspace", response_model=AuthSessionData)
def select_workspace(
    payload: WorkspaceSelectRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Selects a hospital facility workspace for multi-hospital employees."""
    ip_addr = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    session = AuthService.select_workspace(
        db,
        user_id=payload.user_id,
        hospital_id=payload.hospital_id,
        remember_me=payload.remember_me,
        ip_address=ip_addr,
        user_agent=user_agent,
    )

    max_age = (
        settings.SESSION_COOKIE_MAX_AGE_DAYS * 86400
        if payload.remember_me
        else 86400
    )
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session.access_token,
        max_age=max_age,
        httponly=True,
        secure=(settings.ENVIRONMENT == "production"),
        samesite="lax",
    )

    return session


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Logs out employee, revokes session in database, and invalidates session cookie."""
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    else:
        token = request.cookies.get(settings.SESSION_COOKIE_NAME)

    if token:
        AuthService.revoke_session(db, token)

    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        httponly=True,
        secure=(settings.ENVIRONMENT == "production"),
        samesite="lax",
    )
    return {"success": True, "message": "Successfully logged out."}


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Password recovery endpoint returning a generic safe confirmation message
    to avoid revealing whether an account or username exists.
    """
    return AuthService.request_password_reset(db, payload.identifier)


@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Consumes single-use reset token and resets password, invalidating all active sessions.
    Verifies that the new password is not identical to the current password in the database.
    """
    return AuthService.complete_password_reset(
        db=db,
        token=payload.token,
        new_password=payload.new_password,
        confirm_password=payload.confirm_password,
    )

