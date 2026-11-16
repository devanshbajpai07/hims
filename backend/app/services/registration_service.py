import uuid
from typing import List, Tuple
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.exceptions import (
    FiveSlotLimitError,
    UsernameTakenError,
    HospitalNotFoundError,
)
from app.core.security import get_password_hash
from app.models.hospital import Hospital
from app.models.department import Department
from app.models.role import Role
from app.models.user import User
from app.models.membership import TenantMembership
from app.models.registration import (
    RegistrationRequest,
    RegistrationAssignmentRequest,
    AdditionalAssignmentRequest,
)
from app.schemas.registration import Stage2RegistrationRequest, AdditionalAssignmentRequestSchema
from app.services.verification_service import VerificationService
from app.services.username_service import UsernameService


class RegistrationService:
    @classmethod
    def submit_stage2_registration(
        cls, db: Session, payload: Stage2RegistrationRequest
    ) -> Tuple[RegistrationRequest, User]:
        # 1. Validate and consume OTP verification token from Stage 1
        challenge = VerificationService.validate_verification_token(db, payload.verification_token)

        # 2. Validate slot limits (strictly 1 to 5)
        if len(payload.requested_assignments) > 5:
            raise FiveSlotLimitError()
        if len(payload.requested_assignments) < 1:
            raise FiveSlotLimitError("At least one department-role assignment must be requested.")

        # Check duplicate combinations
        seen_combinations = set()
        for slot in payload.requested_assignments:
            combo = (slot.department_id, slot.role_id)
            if combo in seen_combinations:
                raise FiveSlotLimitError("Duplicate department-role assignments are not allowed.")
            seen_combinations.add(combo)

        # 3. Validate global username uniqueness case-insensitively
        norm_username = UsernameService.normalize_username(payload.username)
        if not UsernameService.is_username_available(db, norm_username):
            raise UsernameTakenError(f"Username '{payload.username}' is already taken across HIMS.")

        # 4. Validate departments and roles belong to this hospital
        hospital_id = challenge.hospital_id
        for slot in payload.requested_assignments:
            role_uuid = uuid.UUID(slot.role_id)
            role_obj = db.execute(
                select(Role).where(Role.id == role_uuid, Role.hospital_id == hospital_id, Role.is_active == True)
            ).scalar_one_or_none()
            if not role_obj:
                raise FiveSlotLimitError(f"Requested role (ID: {slot.role_id}) is invalid or not available at this institution.")

            # Protection: Reject Hospital Administrator role for employee self-registration
            if role_obj.code == "admin" or "admin" in role_obj.name.lower():
                raise FiveSlotLimitError(
                    "The Hospital Administrator role cannot be requested through employee self-registration. "
                    "Executive administrators must be invited exclusively by the institution purchaser."
                )

            if slot.department_id:
                dept_uuid = uuid.UUID(slot.department_id)
                dept_obj = db.execute(
                    select(Department).where(Department.id == dept_uuid, Department.hospital_id == hospital_id, Department.is_active == True)
                ).scalar_one_or_none()
                if not dept_obj:
                    raise FiveSlotLimitError(f"Requested department (ID: {slot.department_id}) is invalid at this institution.")

        # 5. Consume the challenge (single-use enforcement)
        challenge.is_consumed = True

        # 6. Create User account (initially inactive / pending approval)
        hashed_pwd = get_password_hash(payload.password)
        new_user = User(
            username=norm_username,
            email=challenge.email,
            password_hash=hashed_pwd,
            full_name=payload.full_name.strip(),
            is_active=False,  # Inactive until approved!
            is_superuser=False,
        )
        db.add(new_user)
        db.flush()

        # 7. Create Tenant Membership with status 'pending'
        # CRITICAL: Employee UID is stored as an unverified claim
        membership = TenantMembership(
            user_id=new_user.id,
            hospital_id=hospital_id,
            employee_uid=payload.employee_uid.strip(),
            employee_uid_verified=False,  # Unverified!
            status="pending",             # Pending approval!
        )
        db.add(membership)
        db.flush()

        # 8. Create Registration Request
        reg_req = RegistrationRequest(
            hospital_id=hospital_id,
            user_id=new_user.id,
            challenge_id=challenge.id,
            email=challenge.email,
            full_name=payload.full_name.strip(),
            employee_uid_claim=payload.employee_uid.strip(),
            employee_uid_verified=False,
            status="pending_approval",
        )
        db.add(reg_req)
        db.flush()

        # 9. Create up to 5 Registration Assignment Requests
        for idx, slot in enumerate(payload.requested_assignments):
            dept_uuid = uuid.UUID(slot.department_id) if slot.department_id else None
            role_uuid = uuid.UUID(slot.role_id)
            assign_req = RegistrationAssignmentRequest(
                registration_request_id=reg_req.id,
                department_id=dept_uuid,
                role_id=role_uuid,
                slot_number=idx + 1,
                status="pending_dept_review",
            )
            db.add(assign_req)

        db.commit()
        db.refresh(reg_req)
        db.refresh(new_user)

        return reg_req, new_user

    @classmethod
    def submit_additional_assignment_request(
        cls, db: Session, payload: AdditionalAssignmentRequestSchema
    ) -> AdditionalAssignmentRequest:
        hosp = db.execute(
            select(Hospital).where(func.lower(Hospital.hospital_uid) == payload.hospital_uid.strip().lower())
        ).scalar_one_or_none()

        if not hosp:
            raise HospitalNotFoundError()

        add_req = AdditionalAssignmentRequest(
            hospital_id=hosp.id,
            email=payload.email.strip().lower(),
            employee_uid=payload.employee_uid.strip(),
            requested_responsibilities=payload.requested_responsibilities.strip(),
            justification=payload.justification.strip(),
            status="pending",
        )
        db.add(add_req)
        db.commit()
        db.refresh(add_req)
        return add_req

