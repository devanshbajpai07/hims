from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps_admin import AdminContext, get_current_admin
from app.core.config import settings
from app.db.database import get_db
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from app.schemas.hospital_admin import (
    AcceptInvitationRequest,
    AcceptInvitationResponse,
    AdminHospitalContext,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminUserProfile,
    InvitationVerifyResponse,
)
from app.services.auth_service import AuthService
from app.services.hospital_admin_service import HospitalAdminService

router = APIRouter(prefix="/admin", tags=["Hospital Administrator Authentication"])


@router.get("/invitations/verify-token", response_model=InvitationVerifyResponse, status_code=status.HTTP_200_OK)
def verify_invitation_token(
    token: str = Query(..., min_length=16),
    db: Session = Depends(get_db),
):
    """Public token verification for administrator invitation landing page.
    Validates token hash, status, and expiry without modifying state.
    """
    try:
        return HospitalAdminService.verify_invitation_token(db, token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/invitations/accept", response_model=AcceptInvitationResponse, status_code=status.HTTP_200_OK)
def accept_admin_invitation(
    payload: AcceptInvitationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Accept administrator invitation atomically:
    Validates token, associates or creates employee user identity, assigns administrator role,
    and creates hospital administrator membership.
    """
    ip_addr = request.client.host if request.client else None
    try:
        return HospitalAdminService.accept_admin_invitation(db, payload, ip_address=ip_addr)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/auth/login", response_model=AdminLoginResponse, status_code=status.HTTP_200_OK)
def admin_login(
    payload: AdminLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Dedicated Hospital Administrator Portal Sign-in.
    Verifies Argon2id password hash, checks active HospitalAdministrator membership,
    verifies hospital subscription validity and period, and issues secure session cookie.
    """
    ip_addr = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    result = HospitalAdminService.authenticate_admin(
        db,
        username_or_email=payload.username_or_email,
        password=payload.password,
        hospital_id=payload.hospital_id,
        remember_me=payload.remember_me,
        ip_address=ip_addr,
        user_agent=user_agent,
    )

    # Set secure HttpOnly cookie when single session established
    if result.get("token"):
        max_age = (
            settings.SESSION_COOKIE_MAX_AGE_DAYS * 86400
            if payload.remember_me
            else 86400
        )
        is_prod = settings.ENVIRONMENT.lower() == "production"
        response.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=result["token"],
            max_age=max_age,
            httponly=True,
            secure=is_prod,
            samesite="none" if is_prod else "lax",
        )

    return result


@router.post("/auth/logout", status_code=status.HTTP_200_OK)
def admin_logout(
    response: Response,
):
    """Terminate administrator session and clear HttpOnly session cookie."""
    is_prod = settings.ENVIRONMENT.lower() == "production"
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
    )
    return {"success": True, "message": "Administrator session ended safely."}


@router.get("/auth/me", status_code=status.HTTP_200_OK)
def get_admin_me(
    admin_ctx: AdminContext = Depends(get_current_admin),
):
    """Return authenticated administrator profile, hospital context, and tier entitlements."""
    return {
        "user": {
            "id": admin_ctx.user.id,
            "username": admin_ctx.user.username,
            "email": admin_ctx.user.email,
            "full_name": admin_ctx.user.full_name,
        },
        "hospital": {
            "id": admin_ctx.hospital.id,
            "hospital_uid": admin_ctx.hospital.hospital_uid,
            "name": admin_ctx.hospital.name,
            "city": admin_ctx.hospital.city,
            "plan_code": admin_ctx.plan_code,
            "plan_name": admin_ctx.entitlements.display_name,
            "max_administrators": admin_ctx.entitlements.max_administrators,
            "max_employees": admin_ctx.entitlements.max_employees,
            "features": admin_ctx.entitlements.features,
        },
    }


@router.post("/auth/forgot-password", response_model=ForgotPasswordResponse, status_code=status.HTTP_200_OK)
def admin_forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Administrator password recovery endpoint."""
    return AuthService.request_password_reset(db, payload.identifier)


@router.post("/auth/reset-password", response_model=ResetPasswordResponse, status_code=status.HTTP_200_OK)
def admin_reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Administrator password reset with database previous-password verification."""
    return AuthService.complete_password_reset(
        db=db,
        token=payload.token,
        new_password=payload.new_password,
        confirm_password=payload.confirm_password,
    )

