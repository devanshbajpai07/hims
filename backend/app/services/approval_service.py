import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.exceptions import HIMSException
from app.models.admin_invitation import HospitalAdministrator
from app.models.approval import ApprovalRecord
from app.models.assignment import RoleAssignment
from app.models.audit import AuditLog
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.permission import RoleVersion
from app.models.purchaser_subscription import PurchaserSubscription
from app.models.registration import (
    RegistrationAssignmentRequest,
    RegistrationRequest,
)
from app.models.role import Role
from app.models.user import User
from app.services.subscription_entitlement_service import SubscriptionEntitlementService


class ApprovalService:
    @classmethod
    def department_head_review(
        cls,
        db: Session,
        assignment_request_id: str,
        dept_head_user_id: str,
        decision: str,  # "approved" or "rejected"
        notes: Optional[str] = None,
    ) -> RegistrationAssignmentRequest:
        a_uuid = uuid.UUID(assignment_request_id)
        u_uuid = uuid.UUID(dept_head_user_id)

        assign_req = db.execute(
            select(RegistrationAssignmentRequest).where(RegistrationAssignmentRequest.id == a_uuid)
        ).scalar_one_or_none()

        if not assign_req:
            raise HIMSException(404, "Assignment request not found.", "ASSIGNMENT_NOT_FOUND")

        # Verify pending approval state
        if assign_req.status != "pending_dept_review":
            raise HIMSException(
                400,
                f"Assignment request is '{assign_req.status}' and not pending department head review.",
                "INVALID_REQUEST_STATUS",
            )

        # Hospital-wide requests (no department) require administrator approval, not department head review
        if assign_req.department_id is None:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "HOSPITAL_WIDE_REQUIRES_ADMIN_APPROVAL",
                    "message": "Hospital-wide role requests require administrator approval, not department head review.",
                },
            )

        # Verify reviewer exists
        reviewer = db.execute(select(User).where(User.id == u_uuid)).scalar_one_or_none()
        if not reviewer:
            raise HIMSException(403, "Reviewer not found.", "UNAUTHORIZED_REVIEWER")

        # Check active membership in the hospital (not hardcoded role code)
        hospital_id = (
            assign_req.registration_request.hospital_id
            if assign_req.registration_request
            else db.execute(
                select(RegistrationRequest.hospital_id).where(
                    RegistrationRequest.id == assign_req.registration_request_id
                )
            ).scalar_one_or_none()
        )

        membership = db.query(TenantMembership).filter(
            TenantMembership.user_id == u_uuid,
            TenantMembership.hospital_id == hospital_id,
            TenantMembership.status == "active",
        ).first()

        if not membership and not reviewer.is_superuser:
            raise HIMSException(403, "Reviewer does not belong to this hospital.", "REVIEWER_NOT_IN_HOSPITAL")

        # Verify that reviewer holds dept_head or admin role for this department
        has_dept_head_role = db.query(RoleAssignment).join(
            TenantMembership, TenantMembership.id == RoleAssignment.membership_id
        ).join(
            Role, Role.id == RoleAssignment.role_id
        ).filter(
            TenantMembership.user_id == u_uuid,
            TenantMembership.hospital_id == hospital_id,
            TenantMembership.status == "active",
            RoleAssignment.is_active == True,
            (RoleAssignment.department_id == assign_req.department_id) | (RoleAssignment.department_id.is_(None)),
            Role.code.in_(["dept_head", "admin"]),
        ).first()

        is_admin_record = db.query(HospitalAdministrator).filter(
            HospitalAdministrator.user_id == u_uuid,
            HospitalAdministrator.hospital_id == hospital_id,
            HospitalAdministrator.status == "active",
        ).first()

        if not has_dept_head_role and not is_admin_record and not reviewer.is_superuser:
            raise HIMSException(403, "You do not have department head authorization for this department.", "DEPARTMENT_HEAD_UNAUTHORIZED")

        now = datetime.now(timezone.utc)
        assign_req.status = "approved_by_dept" if decision.lower() == "approved" else "rejected_by_dept"
        assign_req.dept_head_user_id = u_uuid
        assign_req.dept_head_reviewed_at = now
        assign_req.dept_head_notes = notes

        # Record in approval records
        record = ApprovalRecord(
            assignment_request_id=assign_req.id,
            approver_user_id=u_uuid,
            approval_level="department_head",
            decision=decision.lower(),
            comments=notes,
        )
        db.add(record)

        # Audit log
        db.add(AuditLog(
            hospital_id=assign_req.registration_request.hospital_id,
            user_id=u_uuid,
            action=f"DEPT_HEAD_{decision.upper()}",
            resource_type="registration_assignment_request",
            resource_id=str(assign_req.id),
            details=f"Decision: {decision} | Notes: {notes}",
        ))

        db.commit()
        db.refresh(assign_req)
        return assign_req

    @classmethod
    def admin_final_approval(
        cls,
        db: Session,
        registration_request_id: str,
        admin_user_id: str,
        verify_employee_uid: bool,
        assignment_decisions: List[dict],  # list of {"assignment_id": str, "decision": "approved" | "rejected"}
        notes: Optional[str] = None,
    ) -> RegistrationRequest:
        r_uuid = uuid.UUID(registration_request_id)
        u_uuid = uuid.UUID(admin_user_id)

        reg_req = db.execute(
            select(RegistrationRequest).where(RegistrationRequest.id == r_uuid)
        ).scalar_one_or_none()

        if not reg_req:
            raise HIMSException(404, "Registration request not found.", "REGISTRATION_NOT_FOUND")

        # Verify pending state
        if reg_req.status in ("approved", "rejected"):
            raise HIMSException(
                400,
                f"Registration request has already been finalized (status: '{reg_req.status}').",
                "REGISTRATION_ALREADY_FINALIZED",
            )

        # Verify admin has hospital administrator record in HospitalAdministrator table OR admin role assignment
        admin_record = db.query(HospitalAdministrator).filter(
            HospitalAdministrator.user_id == u_uuid,
            HospitalAdministrator.hospital_id == reg_req.hospital_id,
            HospitalAdministrator.status == "active",
        ).first()

        has_admin_role = db.query(TenantMembership).join(
            RoleAssignment, RoleAssignment.membership_id == TenantMembership.id
        ).join(
            Role, Role.id == RoleAssignment.role_id
        ).filter(
            TenantMembership.user_id == u_uuid,
            TenantMembership.hospital_id == reg_req.hospital_id,
            TenantMembership.status == "active",
            RoleAssignment.is_active == True,
            Role.code == "admin",
        ).first()

        admin_user = db.execute(select(User).where(User.id == u_uuid)).scalar_one_or_none()
        if not admin_record and not has_admin_role and not (admin_user and admin_user.is_superuser):
            raise HIMSException(403, "Administrator privileges required.", "ADMIN_UNAUTHORIZED")

        now = datetime.now(timezone.utc)

        # 1. Employee UID verification
        if verify_employee_uid:
            reg_req.employee_uid_verified = True
            reg_req.verified_by_user_id = u_uuid
            reg_req.verified_at = now

        # 2. Process assignment decisions (partial approvals supported)
        approved_count = 0
        decisions_map = {d["assignment_id"]: d["decision"].lower() for d in assignment_decisions}

        membership = db.execute(
            select(TenantMembership).where(
                TenantMembership.user_id == reg_req.user_id,
                TenantMembership.hospital_id == reg_req.hospital_id,
            )
        ).scalar_one_or_none()

        for assign_req in reg_req.assignment_requests:
            dec = decisions_map.get(str(assign_req.id))
            if dec:
                assign_req.admin_user_id = u_uuid
                assign_req.admin_reviewed_at = now
                assign_req.admin_notes = notes

                if dec == "approved":
                    # Protection: Hospital Administrator role cannot be approved via employee registration
                    target_role = db.execute(select(Role).where(Role.id == assign_req.role_id)).scalar_one_or_none()
                    if target_role and (target_role.code == "admin" or "admin" in target_role.name.lower()):
                        raise ValueError(
                            "Hospital Administrator authority cannot be approved through employee registration. "
                            "Executive administrators must be invited exclusively by the institution purchaser."
                        )

                    assign_req.status = "approved_final"
                    approved_count += 1

                    # Create actual active RoleAssignment for this employee!
                    if membership:
                        # Check if already assigned
                        existing_assign = db.execute(
                            select(RoleAssignment).where(
                                RoleAssignment.membership_id == membership.id,
                                RoleAssignment.department_id == assign_req.department_id,
                                RoleAssignment.role_id == assign_req.role_id,
                            )
                        ).scalar_one_or_none()
                        if existing_assign:
                            # Reactivate revoked assignment
                            existing_assign.is_active = True
                            if hasattr(existing_assign, "assignment_status"):
                                existing_assign.assignment_status = "active"
                            if hasattr(existing_assign, "activated_at"):
                                existing_assign.activated_at = now
                            if hasattr(existing_assign, "revoked_at"):
                                existing_assign.revoked_at = None
                            if hasattr(existing_assign, "approved_by_user_id"):
                                existing_assign.approved_by_user_id = u_uuid
                        else:
                            # Look up active role version
                            active_version = db.execute(
                                select(RoleVersion).where(
                                    RoleVersion.role_id == assign_req.role_id,
                                    RoleVersion.is_active == True,
                                )
                            ).scalar_one_or_none()
                            db.add(RoleAssignment(
                                membership_id=membership.id,
                                department_id=assign_req.department_id,
                                role_id=assign_req.role_id,
                                role_version_id=active_version.id if active_version else None,
                                assignment_status="active",
                                assignment_source="self_registration",
                                approved_by_user_id=u_uuid,
                                activated_at=now,
                                scope_type="DEPARTMENT" if assign_req.department_id else "FACILITY",
                                is_active=True,
                            ))
                else:
                    assign_req.status = "rejected_final"

                # Record decision
                db.add(ApprovalRecord(
                    assignment_request_id=assign_req.id,
                    approver_user_id=u_uuid,
                    approval_level="hospital_admin",
                    decision=dec,
                    comments=notes,
                ))

        # 3. Overall status transition & Employee quota enforcement
        total_slots = len(reg_req.assignment_requests)
        if approved_count == 0:
            reg_req.status = "rejected"
            if membership:
                membership.status = "rejected"
        else:
            # At least one assignment approved! Check employee quota before activating membership
            if not membership or membership.status != "active":
                hospital = db.execute(
                    select(Hospital).where(Hospital.id == reg_req.hospital_id)
                ).scalar_one_or_none()
                plan_code = "BASIC"
                if hospital and hospital.subscription_id:
                    sub = db.execute(
                        select(PurchaserSubscription).where(PurchaserSubscription.id == hospital.subscription_id)
                    ).scalar_one_or_none()
                    if sub and sub.plan_code:
                        plan_code = sub.plan_code
                elif hospital and hospital.subscription and hospital.subscription.plan_code:
                    plan_code = hospital.subscription.plan_code

                entitlements = SubscriptionEntitlementService.get_canonical_entitlements(plan_code)
                active_count = db.query(TenantMembership).filter(
                    TenantMembership.hospital_id == reg_req.hospital_id,
                    TenantMembership.status == "active",
                ).count()
                if active_count >= entitlements.max_employees:
                    raise HIMSException(403, "Employee quota exceeded for this subscription tier.", "EMPLOYEE_QUOTA_EXCEEDED")

            reg_req.status = "approved" if approved_count == total_slots else "partially_approved"
            if membership:
                membership.status = "active"
                membership.employee_uid_verified = reg_req.employee_uid_verified
                membership.verified_by_user_id = u_uuid
                membership.verified_at = now

            # Activate User
            if reg_req.user:
                reg_req.user.is_active = True

        # Audit log
        db.add(AuditLog(
            hospital_id=reg_req.hospital_id,
            user_id=u_uuid,
            action="ADMIN_FINAL_APPROVAL",
            resource_type="registration_request",
            resource_id=str(reg_req.id),
            details=f"Status: {reg_req.status} | Approved slots: {approved_count}/{total_slots} | Verified UID: {verify_employee_uid}",
        ))

        db.commit()
        db.refresh(reg_req)
        return reg_req
