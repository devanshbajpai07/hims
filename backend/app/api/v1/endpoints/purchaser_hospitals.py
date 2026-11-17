import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.purchaser_auth import get_current_purchaser
from app.db.database import get_db
from app.models.purchaser import Purchaser
from app.schemas.hospital_admin import (
    AdminInviteItem,
    AdminInviteRequest,
    HospitalAdministratorsManagementResponse,
    HospitalCreateRequest,
    HospitalDetailResponse,
    HospitalSummaryResponse,
)
from app.services.hospital_admin_service import HospitalAdminService, QuotaExceededError

router = APIRouter(prefix="/purchaser/hospitals", tags=["Purchaser Hospital Management"])


@router.post(
    "/register",
    response_model=HospitalDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_hospital(
    payload: HospitalCreateRequest,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Register a new hospital facility under the purchaser's portfolio, assigning an active subscription.
    Pre-populates default clinical departments and roles.
    """
    try:
        hospital = HospitalAdminService.register_hospital(db, current_purchaser.id, payload)
        detail = HospitalAdminService.get_purchaser_hospital_detail(
            db, current_purchaser.id, hospital.id
        )
        return detail["hospital"]
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[HospitalSummaryResponse], status_code=status.HTTP_200_OK)
def list_purchaser_hospitals(
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Retrieve all hospital facilities owned by the current purchaser account with active administrator counts."""
    return HospitalAdminService.get_purchaser_hospitals(db, current_purchaser.id)


@router.get(
    "/{hospital_id}",
    response_model=HospitalAdministratorsManagementResponse,
    status_code=status.HTTP_200_OK,
)
def get_hospital_administrators_management(
    hospital_id: uuid.UUID,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Fetch complete administrator management view for a specific hospital facility,
    including current administrators, pending invitations, quota limits, and remaining seats.
    """
    try:
        return HospitalAdminService.get_purchaser_hospital_detail(
            db, current_purchaser.id, hospital_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/{hospital_id}/administrators/invite",
    response_model=AdminInviteItem,
    status_code=status.HTTP_201_CREATED,
)
def invite_hospital_administrator(
    hospital_id: uuid.UUID,
    payload: AdminInviteRequest,
    request: Request,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Invite an executive administrator to govern a hospital facility.
    Enforces atomic subscription administrator quota checks and dispatches single-use invitation email.
    """
    ip_addr = request.client.host if request.client else None
    try:
        invitation, raw_token = HospitalAdminService.invite_hospital_administrator(
            db, current_purchaser.id, hospital_id, payload, ip_address=ip_addr, request=request
        )
        return AdminInviteItem(
            id=invitation.id,
            hospital_id=invitation.hospital_id,
            invitee_name=invitation.invitee_name,
            invitee_email=invitation.invitee_email,
            invitee_phone=invitation.invitee_phone,
            invitee_designation=invitation.invitee_designation,
            status=invitation.status,
            created_at=invitation.created_at,
            expires_at=invitation.expires_at,
            accepted_at=invitation.accepted_at,
            revoked_at=invitation.revoked_at,
        )
    except QuotaExceededError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.detail)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{hospital_id}/administrators/invitations/{invitation_id}/revoke",
    response_model=AdminInviteItem,
    status_code=status.HTTP_200_OK,
)
def revoke_admin_invitation(
    hospital_id: uuid.UUID,
    invitation_id: uuid.UUID,
    request: Request,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Revoke a pending administrator invitation, immediately invalidating its token."""
    ip_addr = request.client.host if request.client else None
    try:
        inv = HospitalAdminService.revoke_admin_invitation(
            db, current_purchaser.id, hospital_id, invitation_id, ip_address=ip_addr
        )
        return AdminInviteItem(
            id=inv.id,
            hospital_id=inv.hospital_id,
            invitee_name=inv.invitee_name,
            invitee_email=inv.invitee_email,
            invitee_phone=inv.invitee_phone,
            invitee_designation=inv.invitee_designation,
            status=inv.status,
            created_at=inv.created_at,
            expires_at=inv.expires_at,
            accepted_at=inv.accepted_at,
            revoked_at=inv.revoked_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{hospital_id}/administrators/invitations/{invitation_id}/resend",
    response_model=AdminInviteItem,
    status_code=status.HTTP_200_OK,
)
def resend_admin_invitation(
    hospital_id: uuid.UUID,
    invitation_id: uuid.UUID,
    request: Request,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Invalidate previous invitation token and issue a fresh 72-hour invitation email."""
    ip_addr = request.client.host if request.client else None
    try:
        inv, _ = HospitalAdminService.resend_admin_invitation(
            db, current_purchaser.id, hospital_id, invitation_id, ip_address=ip_addr, request=request
        )
        return AdminInviteItem(
            id=inv.id,
            hospital_id=inv.hospital_id,
            invitee_name=inv.invitee_name,
            invitee_email=inv.invitee_email,
            invitee_phone=inv.invitee_phone,
            invitee_designation=inv.invitee_designation,
            status=inv.status,
            created_at=inv.created_at,
            expires_at=inv.expires_at,
            accepted_at=inv.accepted_at,
            revoked_at=inv.revoked_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/{hospital_id}/administrators/{admin_id}",
    status_code=status.HTTP_200_OK,
)
def remove_hospital_administrator(
    hospital_id: uuid.UUID,
    admin_id: uuid.UUID,
    request: Request,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Remove a hospital administrator, revoking their active sessions and administrator access
    while preserving their underlying employee identity and historical audit log.
    """
    ip_addr = request.client.host if request.client else None
    try:
        HospitalAdminService.remove_hospital_administrator(
            db, current_purchaser.id, hospital_id, admin_id, ip_address=ip_addr
        )
        return {"success": True, "message": "Hospital administrator privileges revoked successfully."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
