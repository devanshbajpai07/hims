import logging
import uuid
from typing import List, Optional

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.exceptions import HospitalNotFoundError
from app.db.database import get_db
from app.models.department import Department
from app.models.hospital import Hospital
from app.models.registration import RegistrationRequest
from app.models.role import Role
from app.schemas.registration import (
    AdditionalAssignmentRequestSchema,
    AdditionalAssignmentResponse,
    DepartmentOption,
    RoleOption,
    Stage2RegistrationRequest,
    Stage2RegistrationResponse,
    UsernameAvailabilityResponse,
)
from app.schemas.verification import (
    StartRegistrationRequest,
    StartRegistrationResponse,
    VerifyOTPRequest,
    VerifyOTPResponse,
)
from app.services.registration_service import RegistrationService
from app.services.username_service import UsernameService
from app.services.verification_service import VerificationService

router = APIRouter(prefix="/registration", tags=["Registration"])


@router.post("/start", response_model=StartRegistrationResponse)
def start_registration(
    payload: StartRegistrationRequest,
    db: Session = Depends(get_db),
):
    """
    STAGE 1 — Hospital Identification and Email OTP initiation.
    Initially accepts ONLY Hospital UID and Email Address.
    Validates hospital eligibility and dispatches a 6-digit cryptographic OTP.
    """
    challenge = VerificationService.start_verification(
        db, hospital_uid=payload.hospital_uid, email=payload.email
    )

    diff = int((challenge.resend_available_at - challenge.created_at).total_seconds())

    if settings.EMAIL_PROVIDER == "mock" or settings.ENVIRONMENT == "development":
        from app.services.email_service import mock_email_service
        last_otp = mock_email_service.get_last_otp(challenge.email)
        if last_otp:
            logger.debug(f"[DEV] OTP for {challenge.email}: {last_otp}")

    return StartRegistrationResponse(
        challenge_id=str(challenge.id),
        email=challenge.email,
        hospital_name=challenge.hospital.name,
        hospital_uid=challenge.hospital.hospital_uid,
        resend_available_in_seconds=max(0, diff),
        message=f"Verification code dispatched to {challenge.email}.",
    )


@router.post("/send-otp", response_model=StartRegistrationResponse)
def resend_otp(
    payload: StartRegistrationRequest,
    db: Session = Depends(get_db),
):
    """Resends a new 6-digit OTP code subject to cooldown constraints."""
    return start_registration(payload, db)


@router.post("/verify-otp", response_model=VerifyOTPResponse)
def verify_otp(
    payload: VerifyOTPRequest,
    db: Session = Depends(get_db),
):
    """
    STAGE 1 OTP Verification.
    Verifies 6-digit OTP code against secure cryptographic hash.
    Unlocks Stage 2 by issuing a short-lived, single-use registration verification token.
    """
    result = VerificationService.verify_otp(
        db, challenge_id=payload.challenge_id, submitted_otp=payload.otp
    )

    return VerifyOTPResponse(
        verified=True,
        verification_token=result["verification_token"],
        hospital_id=result["hospital_id"],
        hospital_uid=result["hospital_uid"],
        hospital_name=result["hospital_name"],
        email=result["email"],
        message="Email verification successful. Stage 2 registration unlocked.",
    )


@router.get("/available-departments", response_model=List[DepartmentOption])
def get_available_departments(
    hospital_uid: str = Query(..., description="Hospital UID"),
    db: Session = Depends(get_db),
):
    """Retrieves hospital administrator-configured departments for assignment slots."""
    hosp = db.execute(
        select(Hospital).where(func.lower(Hospital.hospital_uid) == hospital_uid.strip().lower())
    ).scalar_one_or_none()

    if not hosp:
        raise HospitalNotFoundError()

    depts = db.execute(
        select(Department)
        .where(Department.hospital_id == hosp.id, Department.is_active == True)
        .order_by(Department.name.asc())
    ).scalars().all()

    return [
        DepartmentOption(
            id=str(d.id),
            name=d.name,
            code=d.code,
            description=d.description,
        )
        for d in depts
    ]


@router.get("/available-roles", response_model=List[RoleOption])
def get_available_roles(
    hospital_uid: str = Query(..., description="Hospital UID"),
    db: Session = Depends(get_db),
):
    """Retrieves hospital administrator-configured roles for assignment slots."""
    hosp = db.execute(
        select(Hospital).where(func.lower(Hospital.hospital_uid) == hospital_uid.strip().lower())
    ).scalar_one_or_none()

    if not hosp:
        raise HospitalNotFoundError()

    roles = db.execute(
        select(Role)
        .where(Role.hospital_id == hosp.id, Role.is_active == True)
        .order_by(Role.name.asc())
    ).scalars().all()

    return [
        RoleOption(
            id=str(r.id),
            name=r.name,
            code=r.code,
            scope=r.scope,
            description=r.description,
        )
        for r in roles
    ]


@router.get("/check-username", response_model=UsernameAvailabilityResponse)
def check_username(
    username: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    """
    Checks global case-insensitive username availability across HIMS.
    Backend is the authoritative source for uniqueness.
    """
    valid, err = UsernameService.validate_format(username)
    if not valid:
        return UsernameAvailabilityResponse(
            username=username,
            available=False,
            suggestions=[],
        )

    norm = UsernameService.normalize_username(username)
    available = UsernameService.is_username_available(db, norm)
    suggestions = [] if available else UsernameService.generate_suggestions(db, norm)

    return UsernameAvailabilityResponse(
        username=norm,
        available=available,
        suggestions=suggestions,
    )


@router.post("/submit", response_model=Stage2RegistrationResponse, status_code=status.HTTP_201_CREATED)
def submit_stage2_registration(
    payload: Stage2RegistrationRequest,
    db: Session = Depends(get_db),
):
    """
    STAGE 2 — Account Details & Access Request Submission.
    - Validates single-use OTP verification token.
    - Accepts Employee UID as an unverified claim.
    - Enforces global case-insensitive username uniqueness.
    - Enforces max 5 department-role assignment limit.
    - Establishes pending registration request awaiting two-level administrative approval.
    """
    reg_req, new_user = RegistrationService.submit_stage2_registration(db, payload)

    return Stage2RegistrationResponse(
        registration_id=str(reg_req.id),
        status=reg_req.status,
        username=new_user.username,
        full_name=reg_req.full_name,
        requested_slots_count=len(payload.requested_assignments),
        message="Registration request submitted successfully. Awaiting Department Head and Administrator approval.",
    )


@router.post("/additional-assignment-request", response_model=AdditionalAssignmentResponse)
def submit_additional_assignment_request(
    payload: AdditionalAssignmentRequestSchema,
    db: Session = Depends(get_db),
):
    """
    Contact Admin Request:
    Permitted ONLY when all five initial assignment slots have been utilized.
    Submits a grievance / additional-role justification to the hospital administrator.
    """
    req = RegistrationService.submit_additional_assignment_request(db, payload)

    return AdditionalAssignmentResponse(
        request_id=str(req.id),
        status=req.status,
        message="Your request for additional role responsibilities has been dispatched to the Hospital Administrator.",
    )


@router.get("/status")
def get_registration_status(
    registration_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Retrieves current two-level approval milestone status for a registration."""
    r_uuid = uuid.UUID(registration_id)
    reg_req = db.execute(
        select(RegistrationRequest).where(RegistrationRequest.id == r_uuid)
    ).scalar_one_or_none()

    if not reg_req:
        raise HospitalNotFoundError("Registration request not found.")

    assignments = [
        {
            "id": str(a.id),
            "slot_number": a.slot_number,
            "department_name": a.department.name if a.department else "Hospital-Wide",
            "role_name": a.role.name,
            "status": a.status,
            "dept_head_reviewed": a.dept_head_reviewed_at is not None,
            "admin_reviewed": a.admin_reviewed_at is not None,
        }
        for a in reg_req.assignment_requests
    ]

    return {
        "registration_id": str(reg_req.id),
        "status": reg_req.status,
        "employee_uid_claim": reg_req.employee_uid_claim,
        "employee_uid_verified": reg_req.employee_uid_verified,
        "assignments": assignments,
    }

