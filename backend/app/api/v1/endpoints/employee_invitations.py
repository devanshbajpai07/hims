from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.hospital_admin import (
    AcceptEmployeeInvitationRequest,
    EmployeeInvitationVerifyResponse,
)
from app.services.hospital_admin_service import HospitalAdminService, QuotaExceededError

router = APIRouter(tags=["Employee Invitation Acceptance"])


@router.get(
    "/employee/invitations/verify-token",
    response_model=EmployeeInvitationVerifyResponse,
    status_code=status.HTTP_200_OK,
)
@router.get(
    "/invitations/employee/verify",
    response_model=EmployeeInvitationVerifyResponse,
    status_code=status.HTTP_200_OK,
)
def verify_employee_invitation(
    token: str = Query(..., min_length=16),
    db: Session = Depends(get_db),
):
    """Public token verification for employee invitation acceptance page.
    Validates token hash, status, expiry, and returns pre-authorized assignments.
    """
    try:
        return HospitalAdminService.verify_employee_invitation_token(db, token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/employee/invitations/accept",
    status_code=status.HTTP_200_OK,
)
@router.post(
    "/invitations/employee/accept",
    status_code=status.HTTP_200_OK,
)
def accept_employee_invitation(
    payload: AcceptEmployeeInvitationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Atomically accept an administrator-initiated employee invitation:
    - Verifies token validity and single-use status
    - Authenticates existing user account OR creates new employee credentials
    - Creates or activates TenantMembership in the authorized hospital
    - Creates active RoleAssignments for all pre-authorized department/facility slots
    - Marks invitation ACCEPTED and records HIPAA audit logs
    """
    ip_addr = request.client.host if request.client else None
    try:
        return HospitalAdminService.accept_employee_invitation(db, payload, ip_address=ip_addr)
    except QuotaExceededError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.detail)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

