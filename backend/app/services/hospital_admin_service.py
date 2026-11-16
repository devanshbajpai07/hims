import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.exceptions import (
    AccountStatusError,
    HIMSException,
    HospitalNotFoundError,
    InvalidCredentialsError,
    SubscriptionAccessDeniedError,
    SubscriptionExpiredError,
    SubscriptionInactiveError,
    SubscriptionNotFoundError,
)
from app.core.plans import PLAN_CATALOGUE, PlanCode, get_plan_entitlements
from app.core.security import (
    create_access_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.models.admin_invitation import (
    HospitalAdminInvitation,
    HospitalAdministrator,
)
from app.models.approval import ApprovalRecord
from app.models.assignment import RoleAssignment
from app.models.audit import AuditLog
from app.models.department import Department
from app.models.employee_invitation import EmployeeInvitation
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.notification import HospitalNotification
from app.models.permission import (
    MembershipPermissionOverride,
    Permission,
    RoleVersion,
    RoleVersionPermission,
)
from app.models.purchaser import Purchaser
from app.models.purchaser_subscription import PurchaserSubscription
from app.models.registration import (
    RegistrationAssignmentRequest,
    RegistrationRequest,
)
from app.db.rbac_seeder import provision_hospital_rbac_templates
from app.models.role import Role
from app.models.session import SessionRecord
from app.models.user import User
from app.core.permissions import (
    MASTER_PERMISSION_CATALOGUE,
    SYSTEM_ROLE_PERMISSIONS,
    get_tier_allowed_permissions,
    is_permission_allowed_in_tier,
)
from app.schemas.hospital_admin import (
    AcceptEmployeeInvitationRequest,
    AcceptInvitationRequest,
    AdminInviteRequest,
    AssignEmployeeRolesRequest,
    CreateDepartmentRequest,
    CreateRoleRequest,
    EmployeeAssignmentSlot,
    EmployeeInviteItem,
    EmployeeInviteRequest,
    HospitalCreateRequest,
    UpdateEmployeeStatusRequest,
)
from app.schemas.rbac import (
    CreatePermissionOverrideRequest,
    CreateRoleAssignmentRequest,
    CreateRoleVersionRequest,
    RegistrationApprovalDecisionRequest,
)
from app.services.authorization_service import AuthorizationService
from app.services.email_service import get_email_service
from app.services.subscription_entitlement_service import (
    SubscriptionEntitlementService,
)


class QuotaExceededError(HIMSException):
    def __init__(self, message: str = "Plan quota limit exceeded for this operation."):
        super().__init__(status_code=403, detail=message, code="QUOTA_EXCEEDED")


class TierFeatureRestrictedError(HIMSException):
    def __init__(self, message: str = "This feature is not available in the current subscription tier."):
        super().__init__(status_code=403, detail=message, code="FEATURE_RESTRICTED")


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure datetime object is timezone-aware in UTC (essential for SQLite compatibility)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class HospitalAdminService:

    # =========================================================================
    # PART 1: PURCHASER-FACING HOSPITAL REGISTRATION & OVERVIEW
    # =========================================================================

    @staticmethod
    def register_hospital(
        db: Session, purchaser_id: uuid.UUID, payload: HospitalCreateRequest
    ) -> Hospital:
        """Register a new hospital facility associated with a purchaser's active subscription."""
        # 1. Validate subscription ownership and status
        sub = SubscriptionEntitlementService.validate_subscription_access(
            db, purchaser_id, payload.subscription_id
        )

        # 2. Ensure this subscription is not already assigned to another hospital
        existing_assigned = (
            db.query(Hospital)
            .filter(Hospital.subscription_id == payload.subscription_id)
            .first()
        )
        if existing_assigned:
            raise ValueError(
                f"Subscription '{payload.subscription_id}' is already assigned to hospital '{existing_assigned.name}' (UID: {existing_assigned.hospital_uid})."
            )

        # 3. Generate unique Hospital UID (e.g. AURA-CITY-XXXX)
        clean_name = "".join(filter(str.isalnum, payload.name.upper()))[:4] or "HOSP"
        clean_city = "".join(filter(str.isalnum, payload.city.upper()))[:4] or "METR"
        rand_suffix = secrets.token_hex(2).upper()
        hospital_uid = f"AURA-{clean_name}-{clean_city}-{rand_suffix}"

        # Ensure UID is globally unique
        while db.query(Hospital).filter(Hospital.hospital_uid == hospital_uid).first():
            rand_suffix = secrets.token_hex(3).upper()
            hospital_uid = f"AURA-{clean_name}-{clean_city}-{rand_suffix}"

        # 4. Create hospital record
        hospital = Hospital(
            hospital_uid=hospital_uid,
            name=payload.name.strip(),
            city=payload.city.strip(),
            purchaser_id=purchaser_id,
            subscription_id=payload.subscription_id,
            facility_type=payload.facility_type,
            address=payload.address,
            state=payload.state,
            country=payload.country,
            contact_email=payload.contact_email,
            contact_phone=payload.contact_phone,
            website=payload.website,
            licence_number=payload.licence_number,
            registration_enabled=True,
            is_active=True,
        )
        db.add(hospital)
        db.flush()

        # 5. Populate predefined default departments
        default_depts = [
            ("General Medicine", "GEN-MED", "Comprehensive adult inpatient and outpatient medical care"),
            ("Emergency Medicine", "EMERG", "24/7 Acute trauma, resuscitation, and urgent care"),
            ("Cardiology", "CARDIO", "Diagnostic, therapeutic, and interventional cardiovascular care"),
            ("Pediatrics", "PEDS", "Infant, child, and adolescent healthcare services"),
            ("Radiology", "RAD", "Diagnostic imaging, CT, MRI, and ultrasonography"),
            ("Pathology & Laboratory", "PATH", "Clinical biochemistry, hematology, and microbiological testing"),
            ("Outpatient Clinics", "OPD", "Specialty ambulatory and diagnostic consultations"),
            ("Dispensary", "DISP", "Prescription fulfillment, medication dispensing, and pharmaceutical inventory"),
        ]
        for dept_name, dept_code, dept_desc in default_depts:
            db.add(
                Department(
                    hospital_id=hospital.id,
                    name=dept_name,
                    code=dept_code,
                    description=dept_desc,
                    is_active=True,
                )
            )

        # 6. Populate default roles and versioned RBAC templates
        provision_hospital_rbac_templates(db, hospital.id)

        # 7. Record audit log
        audit = AuditLog(
            hospital_id=hospital.id,
            action="HOSPITAL_REGISTERED",
            resource_type="Hospital",
            resource_id=str(hospital.id),
            details=f"Hospital '{hospital.name}' (UID: {hospital.hospital_uid}) registered under subscription {sub.plan_code} by purchaser {purchaser_id}.",
        )
        db.add(audit)
        db.commit()
        db.refresh(hospital)
        return hospital

    @staticmethod
    def get_purchaser_hospitals(
        db: Session, purchaser_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        """List all hospitals owned by the purchaser with subscription and administrator counts."""
        hospitals = (
            db.query(Hospital)
            .options(joinedload(Hospital.subscription))
            .filter(Hospital.purchaser_id == purchaser_id)
            .order_by(Hospital.created_at.desc())
            .all()
        )

        now = datetime.now(timezone.utc)
        results = []
        for h in hospitals:
            plan_code = "BASIC"
            plan_name = "Basic"
            max_admins = 1
            max_employees = 50

            if h.subscription:
                plan_code = h.subscription.plan_code
                ent = get_plan_entitlements(plan_code)
                if ent:
                    plan_name = ent.display_name
                    max_admins = ent.max_administrators
                    max_employees = ent.max_employees

            active_admins = (
                db.query(func.count(HospitalAdministrator.id))
                .filter(
                    HospitalAdministrator.hospital_id == h.id,
                    HospitalAdministrator.status == "active",
                )
                .scalar()
                or 0
            )

            pending_invites = (
                db.query(func.count(HospitalAdminInvitation.id))
                .filter(
                    HospitalAdminInvitation.hospital_id == h.id,
                    HospitalAdminInvitation.status == "PENDING",
                    HospitalAdminInvitation.expires_at > now,
                )
                .scalar()
                or 0
            )

            results.append(
                {
                    "id": h.id,
                    "hospital_uid": h.hospital_uid,
                    "name": h.name,
                    "city": h.city,
                    "facility_type": h.facility_type,
                    "subscription_id": h.subscription_id,
                    "plan_code": plan_code,
                    "plan_name": plan_name,
                    "active_admins_count": active_admins,
                    "pending_invites_count": pending_invites,
                    "max_administrators": max_admins,
                    "max_employees": max_employees,
                    "is_active": h.is_active,
                    "created_at": h.created_at,
                }
            )
        return results

    @staticmethod
    def get_purchaser_hospital_detail(
        db: Session, purchaser_id: uuid.UUID, hospital_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Fetch detailed hospital view including active administrators and invitation history."""
        hospital = (
            db.query(Hospital)
            .options(
                joinedload(Hospital.subscription),
                joinedload(Hospital.administrators).joinedload(HospitalAdministrator.user),
                joinedload(Hospital.administrators).joinedload(HospitalAdministrator.membership),
                joinedload(Hospital.admin_invitations),
            )
            .filter(Hospital.id == hospital_id)
            .first()
        )
        if not hospital:
            raise HospitalNotFoundError("Hospital facility not found.")
        if hospital.purchaser_id != purchaser_id:
            raise SubscriptionAccessDeniedError(
                "Access denied: this hospital belongs to another purchaser account."
            )

        # Plan and Entitlements
        plan_code = "BASIC"
        plan_name = "Basic"
        sub_status = "active"
        period_end = None
        max_admins = 1
        max_employees = 50
        features = ["core_emr"]

        if hospital.subscription:
            sub = hospital.subscription
            plan_code = sub.plan_code
            sub_status = sub.status
            period_end = sub.current_period_ends_at
            ent = get_plan_entitlements(plan_code)
            if ent:
                plan_name = ent.display_name
                max_admins = ent.max_administrators
                max_employees = ent.max_employees
                features = ent.features

        now = datetime.now(timezone.utc)

        # Active Administrators list
        active_admins_list = []
        for ha in hospital.administrators:
            if ha.status == "active":
                active_admins_list.append(
                    {
                        "id": ha.id,
                        "user_id": ha.user_id,
                        "full_name": ha.user.full_name,
                        "email": ha.user.email,
                        "username": ha.user.username,
                        "employee_uid": ha.membership.employee_uid if ha.membership else "N/A",
                        "designation": "Hospital Administrator",
                        "status": ha.status,
                        "created_at": ha.created_at,
                        "last_login_at": None,
                    }
                )

        # Invitations list
        invitations_list = []
        for inv in hospital.admin_invitations:
            # Check if expired
            current_status = inv.status
            if current_status == "PENDING" and ensure_utc(inv.expires_at) < now:
                current_status = "EXPIRED"

            invitations_list.append(
                {
                    "id": inv.id,
                    "hospital_id": inv.hospital_id,
                    "invitee_name": inv.invitee_name,
                    "invitee_email": inv.invitee_email,
                    "invitee_phone": inv.invitee_phone,
                    "invitee_designation": inv.invitee_designation,
                    "status": current_status,
                    "created_at": inv.created_at,
                    "expires_at": inv.expires_at,
                    "accepted_at": inv.accepted_at,
                    "revoked_at": inv.revoked_at,
                }
            )

        # Sort invitations newest first
        invitations_list.sort(key=lambda x: x["created_at"], reverse=True)

        active_count = len(active_admins_list)
        pending_count = sum(1 for i in invitations_list if i["status"] == "PENDING")
        remaining_seats = max(0, max_admins - (active_count + pending_count))

        hospital_data = {
            "id": hospital.id,
            "hospital_uid": hospital.hospital_uid,
            "name": hospital.name,
            "city": hospital.city,
            "facility_type": hospital.facility_type,
            "address": hospital.address,
            "state": hospital.state,
            "country": hospital.country,
            "contact_email": hospital.contact_email,
            "contact_phone": hospital.contact_phone,
            "website": hospital.website,
            "licence_number": hospital.licence_number,
            "subscription_id": hospital.subscription_id,
            "plan_code": plan_code,
            "plan_name": plan_name,
            "subscription_status": sub_status,
            "current_period_ends_at": period_end,
            "active_admins_count": active_count,
            "pending_invites_count": pending_count,
            "max_administrators": max_admins,
            "max_employees": max_employees,
            "features": features,
            "created_at": hospital.created_at,
        }

        return {
            "hospital": hospital_data,
            "active_administrators": active_admins_list,
            "invitations": invitations_list,
            "max_administrators": max_admins,
            "remaining_seats": remaining_seats,
        }

    # =========================================================================
    # PART 2: PURCHASER-FACING ADMINISTRATOR INVITATIONS
    # =========================================================================

    @classmethod
    def invite_hospital_administrator(
        cls,
        db: Session,
        purchaser_id: uuid.UUID,
        hospital_id: uuid.UUID,
        payload: AdminInviteRequest,
        ip_address: Optional[str] = None,
    ) -> Tuple[HospitalAdminInvitation, str]:
        """Invite a hospital administrator with row-level locking, quota validation, and email dispatch."""
        # 1. Acquire row-level lock on the hospital to serialize concurrent invitations
        hospital = (
            db.query(Hospital)
            .filter(Hospital.id == hospital_id)
            .with_for_update()
            .first()
        )
        if not hospital:
            raise HospitalNotFoundError("Hospital facility not found.")
        if hospital.purchaser_id != purchaser_id:
            raise SubscriptionAccessDeniedError(
                "Access denied: this hospital belongs to another purchaser account."
            )

        # 2. Validate subscription status and entitlements
        if not hospital.subscription_id:
            raise SubscriptionNotFoundError("No subscription assigned to this hospital.")

        sub = SubscriptionEntitlementService.validate_subscription_access(
            db, purchaser_id, hospital.subscription_id
        )
        entitlements = SubscriptionEntitlementService.get_canonical_entitlements(sub.plan_code)
        max_admins = entitlements.max_administrators

        # 3. Check active administrators and pending invitations atomically
        now = datetime.now(timezone.utc)
        active_admins_count = (
            db.query(func.count(HospitalAdministrator.id))
            .filter(
                HospitalAdministrator.hospital_id == hospital_id,
                HospitalAdministrator.status == "active",
            )
            .scalar()
            or 0
        )

        pending_invites_count = (
            db.query(func.count(HospitalAdminInvitation.id))
            .filter(
                HospitalAdminInvitation.hospital_id == hospital_id,
                HospitalAdminInvitation.status == "PENDING",
                HospitalAdminInvitation.expires_at > now,
            )
            .scalar()
            or 0
        )

        if (active_admins_count + pending_invites_count) >= max_admins:
            raise QuotaExceededError(
                f"Administrator quota exceeded for this hospital's {sub.plan_code} plan "
                f"({active_admins_count} active + {pending_invites_count} pending / {max_admins} maximum allowed). "
                f"Upgrade subscription or revoke pending invitations to invite additional administrators."
            )

        # 4. Prevent duplicate pending invitations for the same email at this hospital
        norm_email = payload.invitee_email.strip().lower()
        existing_pending = (
            db.query(HospitalAdminInvitation)
            .filter(
                HospitalAdminInvitation.hospital_id == hospital_id,
                func.lower(HospitalAdminInvitation.invitee_email) == norm_email,
                HospitalAdminInvitation.status == "PENDING",
                HospitalAdminInvitation.expires_at > now,
            )
            .first()
        )
        if existing_pending:
            raise ValueError(
                f"A pending administrator invitation already exists for '{norm_email}' at this hospital."
            )

        # 5. Check if user is already an active administrator of this hospital
        existing_admin_user = (
            db.query(HospitalAdministrator)
            .join(User, HospitalAdministrator.user_id == User.id)
            .filter(
                HospitalAdministrator.hospital_id == hospital_id,
                func.lower(User.email) == norm_email,
                HospitalAdministrator.status == "active",
            )
            .first()
        )
        if existing_admin_user:
            raise ValueError(
                f"The user '{norm_email}' is already an active administrator of this hospital."
            )

        # 6. Generate cryptographically secure random token and hash
        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_token(raw_token)
        expires_at = now + timedelta(hours=72)

        invitation = HospitalAdminInvitation(
            hospital_id=hospital_id,
            inviting_purchaser_id=purchaser_id,
            invitee_name=payload.invitee_name.strip(),
            invitee_email=norm_email,
            invitee_phone=payload.invitee_phone,
            invitee_designation=payload.invitee_designation or "Hospital Administrator",
            token_hash=token_hash,
            status="PENDING",
            expires_at=expires_at,
        )
        db.add(invitation)
        db.flush()

        # 7. Record audit log
        audit = AuditLog(
            hospital_id=hospital_id,
            action="ADMIN_INVITATION_CREATED",
            resource_type="HospitalAdminInvitation",
            resource_id=str(invitation.id),
            details=f"Purchaser {purchaser_id} invited administrator '{payload.invitee_name}' ({norm_email}) for hospital '{hospital.name}'.",
            ip_address=ip_address,
        )
        db.add(audit)

        # 8. Dispatch invitation email
        invitation_url = f"{settings.FRONTEND_URL}/admin/accept-invitation?token={raw_token}"
        email_svc = get_email_service()
        email_svc.send_invitation_email(
            to_email=norm_email,
            recipient_name=payload.invitee_name.strip(),
            hospital_name=hospital.name,
            role_type="Hospital Administrator",
            invitation_url=invitation_url,
            expires_hours=72,
        )

        db.commit()
        db.refresh(invitation)
        return invitation, raw_token

    @staticmethod
    def revoke_admin_invitation(
        db: Session,
        purchaser_id: uuid.UUID,
        hospital_id: uuid.UUID,
        invitation_id: uuid.UUID,
        ip_address: Optional[str] = None,
    ) -> HospitalAdminInvitation:
        """Revoke a pending administrator invitation."""
        invitation = (
            db.query(HospitalAdminInvitation)
            .join(Hospital, HospitalAdminInvitation.hospital_id == Hospital.id)
            .filter(
                HospitalAdminInvitation.id == invitation_id,
                HospitalAdminInvitation.hospital_id == hospital_id,
            )
            .first()
        )
        if not invitation:
            raise ValueError("Invitation record not found.")

        if invitation.hospital.purchaser_id != purchaser_id:
            raise SubscriptionAccessDeniedError("Access denied: hospital belongs to another purchaser.")

        if invitation.status != "PENDING":
            raise ValueError(f"Cannot revoke an invitation that is already '{invitation.status}'.")

        invitation.status = "REVOKED"
        invitation.revoked_at = datetime.now(timezone.utc)

        audit = AuditLog(
            hospital_id=hospital_id,
            action="ADMIN_INVITATION_REVOKED",
            resource_type="HospitalAdminInvitation",
            resource_id=str(invitation.id),
            details=f"Purchaser {purchaser_id} revoked administrator invitation for {invitation.invitee_email}.",
            ip_address=ip_address,
        )
        db.add(audit)
        db.commit()
        db.refresh(invitation)
        return invitation

    @staticmethod
    def resend_admin_invitation(
        db: Session,
        purchaser_id: uuid.UUID,
        hospital_id: uuid.UUID,
        invitation_id: uuid.UUID,
        ip_address: Optional[str] = None,
    ) -> Tuple[HospitalAdminInvitation, str]:
        """Invalidate previous invitation token, issue a fresh token, and resend invitation email."""
        invitation = (
            db.query(HospitalAdminInvitation)
            .join(Hospital, HospitalAdminInvitation.hospital_id == Hospital.id)
            .filter(
                HospitalAdminInvitation.id == invitation_id,
                HospitalAdminInvitation.hospital_id == hospital_id,
            )
            .first()
        )
        if not invitation:
            raise ValueError("Invitation record not found.")

        if invitation.hospital.purchaser_id != purchaser_id:
            raise SubscriptionAccessDeniedError("Access denied: hospital belongs to another purchaser.")

        if invitation.status == "ACCEPTED":
            raise ValueError("Cannot resend an invitation that has already been accepted.")

        now = datetime.now(timezone.utc)
        raw_token = secrets.token_urlsafe(32)
        invitation.token_hash = hash_token(raw_token)
        invitation.expires_at = now + timedelta(hours=72)
        invitation.status = "PENDING"
        invitation.revoked_at = None

        audit = AuditLog(
            hospital_id=hospital_id,
            action="ADMIN_INVITATION_RESENT",
            resource_type="HospitalAdminInvitation",
            resource_id=str(invitation.id),
            details=f"Purchaser {purchaser_id} regenerated invitation for {invitation.invitee_email}.",
            ip_address=ip_address,
        )
        db.add(audit)

        invitation_url = f"{settings.FRONTEND_URL}/admin/accept-invitation?token={raw_token}"
        email_svc = get_email_service()
        email_svc.send_invitation_email(
            to_email=invitation.invitee_email,
            recipient_name=invitation.invitee_name,
            hospital_name=invitation.hospital.name,
            role_type="Hospital Administrator",
            invitation_url=invitation_url,
            expires_hours=72,
        )

        db.commit()
        db.refresh(invitation)
        return invitation, raw_token

    @staticmethod
    def remove_hospital_administrator(
        db: Session,
        purchaser_id: uuid.UUID,
        hospital_id: uuid.UUID,
        admin_id: uuid.UUID,
        ip_address: Optional[str] = None,
    ) -> bool:
        """Remove a hospital administrator, revoking active sessions and administrator privileges."""
        admin_membership = (
            db.query(HospitalAdministrator)
            .join(Hospital, HospitalAdministrator.hospital_id == Hospital.id)
            .filter(
                HospitalAdministrator.id == admin_id,
                HospitalAdministrator.hospital_id == hospital_id,
            )
            .first()
        )
        if not admin_membership:
            raise ValueError("Hospital administrator record not found.")

        if admin_membership.hospital.purchaser_id != purchaser_id:
            raise SubscriptionAccessDeniedError("Access denied: hospital belongs to another purchaser.")

        # 1. Update administrator membership to revoked
        admin_membership.status = "revoked"
        admin_membership.revoked_at = datetime.now(timezone.utc)

        # 2. Invalidate all active sessions for this employee at this hospital
        db.query(SessionRecord).filter(
            SessionRecord.user_id == admin_membership.user_id,
            SessionRecord.hospital_id == hospital_id,
        ).update({"is_revoked": True})

        # 3. Deactivate administrator role assignment
        if admin_membership.membership_id:
            admin_roles = (
                db.query(Role)
                .filter(Role.hospital_id == hospital_id, Role.code == "admin")
                .all()
            )
            admin_role_ids = [r.id for r in admin_roles]
            db.query(RoleAssignment).filter(
                RoleAssignment.membership_id == admin_membership.membership_id,
                RoleAssignment.role_id.in_(admin_role_ids),
            ).update({"is_active": False}, synchronize_session=False)

        # 4. Record audit log
        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_membership.user_id,
            action="ADMIN_MEMBERSHIP_REMOVED",
            resource_type="HospitalAdministrator",
            resource_id=str(admin_id),
            details=f"Purchaser {purchaser_id} removed user {admin_membership.user_id} from administrator membership.",
            ip_address=ip_address,
        )
        db.add(audit)
        db.commit()
        return True

    # =========================================================================
    # PART 3: ADMINISTRATOR INVITATION ACCEPTANCE & REGISTRATION
    # =========================================================================

    @staticmethod
    def verify_invitation_token(db: Session, raw_token: str) -> Dict[str, Any]:
        """Validate token hash, status, and expiry for public invitation verification."""
        t_hash = hash_token(raw_token)
        invitation = (
            db.query(HospitalAdminInvitation)
            .options(joinedload(HospitalAdminInvitation.hospital).joinedload(Hospital.subscription))
            .filter(HospitalAdminInvitation.token_hash == t_hash)
            .first()
        )
        if not invitation:
            raise ValueError("Invalid or unknown administrator invitation token.")

        now = datetime.now(timezone.utc)
        if invitation.status == "ACCEPTED":
            raise ValueError("This invitation has already been accepted.")
        if invitation.status == "REVOKED":
            raise ValueError("This invitation has been revoked by institutional leadership.")
        if invitation.status != "PENDING" or ensure_utc(invitation.expires_at) < now:
            if invitation.status == "PENDING":
                invitation.status = "EXPIRED"
                db.commit()
            raise ValueError("This invitation has expired. Please contact your institution purchaser.")

        plan_code = "BASIC"
        if invitation.hospital.subscription:
            plan_code = invitation.hospital.subscription.plan_code

        return {
            "valid": True,
            "hospital_id": invitation.hospital_id,
            "hospital_uid": invitation.hospital.hospital_uid,
            "hospital_name": invitation.hospital.name,
            "invitee_name": invitation.invitee_name,
            "invitee_email": invitation.invitee_email,
            "invitee_designation": invitation.invitee_designation,
            "expires_at": invitation.expires_at,
            "plan_code": plan_code,
        }

    @classmethod
    def accept_admin_invitation(
        cls, db: Session, payload: AcceptInvitationRequest, ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Atomically accept administrator invitation, creating or associating employee user,
        tenant membership, admin role assignment, and hospital administrator record.
        """
        # 1. Acquire row lock on invitation
        t_hash = hash_token(payload.token)
        invitation = (
            db.query(HospitalAdminInvitation)
            .filter(HospitalAdminInvitation.token_hash == t_hash)
            .with_for_update()
            .first()
        )
        if not invitation:
            raise ValueError("Invalid invitation token.")

        now = datetime.now(timezone.utc)
        if invitation.status != "PENDING" or ensure_utc(invitation.expires_at) < now:
            if invitation.status == "PENDING":
                invitation.status = "EXPIRED"
                db.commit()
            raise ValueError(f"Invitation is no longer valid (current status: '{invitation.status}').")

        hospital = db.query(Hospital).filter(Hospital.id == invitation.hospital_id).first()
        if not hospital or not hospital.is_active:
            raise HospitalNotFoundError("The associated hospital facility is inactive or unavailable.")

        norm_email = invitation.invitee_email.strip().lower()

        # 2. Check if a User account already exists with this email
        user = db.query(User).filter(func.lower(User.email) == norm_email).first()
        if not user:
            # Create new user identity
            base_username = payload.username or norm_email.split("@")[0]
            clean_username = "".join(c for c in base_username.lower() if c.isalnum() or c in ("_", "-")) or "admin"
            username = clean_username

            # Check uniqueness of username
            counter = 1
            while db.query(User).filter(func.lower(User.username) == username).first():
                username = f"{clean_username}{counter}"
                counter += 1

            password_hash = get_password_hash(payload.password)
            user = User(
                username=username,
                email=norm_email,
                password_hash=password_hash,
                full_name=invitation.invitee_name,
                is_active=True,
                is_superuser=False,
            )
            db.add(user)
            db.flush()
        else:
            # Existing user identity: verify password or update credentials
            # To securely claim invitation, verify password if provided, or update hash
            if not verify_password(payload.password, user.password_hash):
                # Update password for newly accepted invitee
                user.password_hash = get_password_hash(payload.password)
                db.flush()

        # 3. Create or activate TenantMembership for this hospital
        membership = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.hospital_id == hospital.id,
                TenantMembership.user_id == user.id,
            )
            .first()
        )
        if not membership:
            # Generate unique employee UID for administrator
            emp_uid = f"ADM-{uuid.uuid4().hex[:6].upper()}"
            membership = TenantMembership(
                user_id=user.id,
                hospital_id=hospital.id,
                employee_uid=emp_uid,
                employee_uid_verified=True,
                status="active",
                verified_at=now,
            )
            db.add(membership)
            db.flush()
        else:
            membership.status = "active"
            membership.employee_uid_verified = True
            db.flush()

        # 4. Ensure hospital has admin Role
        admin_role = (
            db.query(Role)
            .filter(Role.hospital_id == hospital.id, Role.code == "admin")
            .first()
        )
        if not admin_role:
            admin_role = Role(
                hospital_id=hospital.id,
                name="Hospital Administrator",
                code="admin",
                scope="hospital",
                description="Executive governance and administrative authority",
                is_active=True,
            )
            db.add(admin_role)
            db.flush()

        # 5. Ensure RoleAssignment exists
        role_assign = (
            db.query(RoleAssignment)
            .filter(
                RoleAssignment.membership_id == membership.id,
                RoleAssignment.role_id == admin_role.id,
            )
            .first()
        )
        if not role_assign:
            role_assign = RoleAssignment(
                membership_id=membership.id,
                role_id=admin_role.id,
                is_active=True,
            )
            db.add(role_assign)
        else:
            role_assign.is_active = True

        # 6. Create HospitalAdministrator record
        admin_rec = (
            db.query(HospitalAdministrator)
            .filter(
                HospitalAdministrator.hospital_id == hospital.id,
                HospitalAdministrator.user_id == user.id,
            )
            .first()
        )
        if not admin_rec:
            admin_rec = HospitalAdministrator(
                hospital_id=hospital.id,
                user_id=user.id,
                membership_id=membership.id,
                invitation_id=invitation.id,
                status="active",
            )
            db.add(admin_rec)
        else:
            admin_rec.status = "active"
            admin_rec.revoked_at = None

        # 7. Update invitation status to ACCEPTED
        invitation.status = "ACCEPTED"
        invitation.accepted_at = now

        # 8. Add welcome notification
        welcome_notif = HospitalNotification(
            hospital_id=hospital.id,
            recipient_user_id=user.id,
            title="Administrator Credentials Activated",
            message=f"Welcome to {hospital.name}. Your hospital administrator account has been activated with executive governance authority.",
            category="security",
        )
        db.add(welcome_notif)

        # 9. Audit event
        audit = AuditLog(
            hospital_id=hospital.id,
            user_id=user.id,
            action="ADMIN_INVITATION_ACCEPTED",
            resource_type="HospitalAdministrator",
            resource_id=str(admin_rec.id),
            details=f"User '{user.username}' ({norm_email}) accepted administrator invitation for hospital '{hospital.name}'.",
            ip_address=ip_address,
        )
        db.add(audit)

        db.commit()

        return {
            "success": True,
            "message": "Administrator account successfully registered and activated.",
            "hospital_uid": hospital.hospital_uid,
            "hospital_name": hospital.name,
            "username": user.username,
            "email": user.email,
        }

    # =========================================================================
    # PART 4: DEDICATED ADMINISTRATOR AUTHENTICATION
    # =========================================================================

    @classmethod
    def authenticate_admin(
        cls,
        db: Session,
        username_or_email: str,
        password: str,
        hospital_id: Optional[uuid.UUID] = None,
        remember_me: bool = False,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Authenticate an employee into the Hospital Administrator Portal.
        Enforces that the user has an active HospitalAdministrator membership and
        that the hospital's assigned subscription is active.
        """
        norm_ident = username_or_email.strip().lower()

        # 1. Locate user by username or email
        user = (
            db.query(User)
            .filter(
                or_(
                    func.lower(User.username) == norm_ident,
                    func.lower(User.email) == norm_ident,
                )
            )
            .first()
        )
        if not user or not user.is_active:
            raise InvalidCredentialsError()

        # 2. Verify password
        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsError()

        # 3. Locate active hospital administrator memberships
        admin_memberships = (
            db.query(HospitalAdministrator)
            .options(
                joinedload(HospitalAdministrator.hospital).joinedload(Hospital.subscription),
                joinedload(HospitalAdministrator.membership),
            )
            .filter(
                HospitalAdministrator.user_id == user.id,
                HospitalAdministrator.status == "active",
            )
            .all()
        )

        if not admin_memberships:
            raise AccountStatusError(
                "no_admin_membership",
                "Access denied: your employee identity does not possess an active administrator membership for any hospital facility.",
            )

        # 4. Handle multiple hospital workspaces
        if len(admin_memberships) > 1 and not hospital_id:
            available = []
            for am in admin_memberships:
                h = am.hospital
                sub = h.subscription
                p_code = sub.plan_code if sub else "BASIC"
                ent = get_plan_entitlements(p_code)
                p_name = ent.display_name if ent else "Basic"
                available.append(
                    {
                        "hospital_id": h.id,
                        "hospital_uid": h.hospital_uid,
                        "hospital_name": h.name,
                        "plan_code": p_code,
                        "plan_name": p_name,
                    }
                )
            return {
                "success": True,
                "requires_hospital_selection": True,
                "available_hospitals": available,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "full_name": user.full_name,
                },
                "message": "Multiple hospital administrator workspaces available. Please select a hospital.",
            }

        # 5. Select target hospital
        target_membership = None
        if hospital_id:
            for am in admin_memberships:
                if str(am.hospital_id) == str(hospital_id):
                    target_membership = am
                    break
            if not target_membership:
                raise AccountStatusError(
                    "not_authorized",
                    "You are not an authorized administrator for the selected hospital facility.",
                )
        else:
            target_membership = admin_memberships[0]

        target_hospital = target_membership.hospital

        # 6. Validate hospital assigned subscription
        if not target_hospital.subscription_id:
            raise SubscriptionNotFoundError(
                "This hospital does not have an assigned subscription license."
            )

        sub = target_hospital.subscription
        if not sub:
            sub = (
                db.query(PurchaserSubscription)
                .filter(PurchaserSubscription.id == target_hospital.subscription_id)
                .first()
            )

        if not sub:
            raise SubscriptionNotFoundError(
                "This hospital does not have an assigned subscription license."
            )

        if sub.status != "active":
            raise SubscriptionInactiveError(
                f"Hospital subscription is inactive (status: '{sub.status}'). Please contact your purchaser."
            )

        now = datetime.now(timezone.utc)
        if sub.current_period_ends_at and ensure_utc(sub.current_period_ends_at) < now:
            raise SubscriptionExpiredError(
                "Hospital subscription billing period has expired. Please contact your purchaser."
            )

        # 7. Resolve canonical entitlements
        entitlements = SubscriptionEntitlementService.get_canonical_entitlements(sub.plan_code)

        # 8. Create session record and JWT token
        days = settings.SESSION_COOKIE_MAX_AGE_DAYS if remember_me else 1
        expires_at = now + timedelta(days=days)

        token_claims = {
            "hospital_id": str(target_hospital.id),
            "hospital_uid": target_hospital.hospital_uid,
            "membership_id": str(target_membership.membership_id),
            "role": "admin",
            "is_admin": True,
            "plan_code": sub.plan_code,
            "remember_me": remember_me,
        }
        token = create_access_token(
            subject=str(user.id),
            extra_claims=token_claims,
            expires_delta=timedelta(days=days),
        )

        token_hash = hash_token(token)
        session_rec = SessionRecord(
            user_id=user.id,
            hospital_id=target_hospital.id,
            token_hash=token_hash,
            remember_me=remember_me,
            expires_at=expires_at,
            is_revoked=False,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(session_rec)

        # Audit login
        audit = AuditLog(
            hospital_id=target_hospital.id,
            user_id=user.id,
            action="ADMIN_LOGIN_SUCCESS",
            resource_type="SessionRecord",
            resource_id=str(session_rec.id),
            details=f"Administrator '{user.username}' logged into {target_hospital.name} ({sub.plan_code} tier).",
            ip_address=ip_address,
        )
        db.add(audit)
        db.commit()

        hospital_context = {
            "id": target_hospital.id,
            "hospital_uid": target_hospital.hospital_uid,
            "name": target_hospital.name,
            "city": target_hospital.city,
            "plan_code": sub.plan_code,
            "plan_name": entitlements.display_name,
            "max_administrators": entitlements.max_administrators,
            "max_employees": entitlements.max_employees,
            "features": entitlements.features,
        }

        user_profile = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
        }

        return {
            "success": True,
            "requires_hospital_selection": False,
            "available_hospitals": [],
            "user": user_profile,
            "hospital": hospital_context,
            "token": token,
            "message": "Administrator authentication successful.",
        }

    # =========================================================================
    # PART 5: DASHBOARD OVERVIEW & METRICS
    # =========================================================================

    @staticmethod
    def get_dashboard_overview(
        db: Session, hospital_id: uuid.UUID, user_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Fetch honest, backend-backed workforce statistics, activity, alerts, and quota usage."""
        hospital = (
            db.query(Hospital)
            .options(joinedload(Hospital.subscription))
            .filter(Hospital.id == hospital_id)
            .first()
        )
        if not hospital:
            raise HospitalNotFoundError()

        sub = hospital.subscription
        plan_code = sub.plan_code if sub else "BASIC"
        ent = get_plan_entitlements(plan_code) or get_plan_entitlements("BASIC")

        now = datetime.now(timezone.utc)

        # Real Counts
        total_employees = (
            db.query(func.count(TenantMembership.id))
            .filter(TenantMembership.hospital_id == hospital_id)
            .scalar()
            or 0
        )
        active_employees = (
            db.query(func.count(TenantMembership.id))
            .filter(
                TenantMembership.hospital_id == hospital_id,
                TenantMembership.status == "active",
            )
            .scalar()
            or 0
        )
        dept_count = (
            db.query(func.count(Department.id))
            .filter(Department.hospital_id == hospital_id, Department.is_active == True)
            .scalar()
            or 0
        )
        active_admins = (
            db.query(func.count(HospitalAdministrator.id))
            .filter(
                HospitalAdministrator.hospital_id == hospital_id,
                HospitalAdministrator.status == "active",
            )
            .scalar()
            or 0
        )
        pending_emp_invites = (
            db.query(func.count(EmployeeInvitation.id))
            .filter(
                EmployeeInvitation.hospital_id == hospital_id,
                EmployeeInvitation.status == "PENDING",
                EmployeeInvitation.expires_at > now,
            )
            .scalar()
            or 0
        )
        pending_registrations = (
            db.query(func.count(RegistrationRequest.id))
            .filter(
                RegistrationRequest.hospital_id == hospital_id,
                RegistrationRequest.status == "pending_approval",
            )
            .scalar()
            or 0
        )
        pending_role_requests = (
            db.query(func.count(RegistrationAssignmentRequest.id))
            .join(RegistrationRequest, RegistrationAssignmentRequest.registration_request_id == RegistrationRequest.id)
            .filter(
                RegistrationRequest.hospital_id == hospital_id,
                RegistrationAssignmentRequest.status.in_(["pending_dept_review", "approved_by_dept"]),
            )
            .scalar()
            or 0
        )

        # Recent Activity (Latest 10 audit logs)
        recent_logs = (
            db.query(AuditLog)
            .filter(AuditLog.hospital_id == hospital_id)
            .order_by(AuditLog.created_at.desc())
            .limit(10)
            .all()
        )
        recent_activity = [
            {
                "id": str(log.id),
                "action": log.action,
                "resource_type": log.resource_type,
                "details": log.details,
                "created_at": log.created_at.isoformat(),
            }
            for log in recent_logs
        ]

        # Important Alerts (Unread notifications)
        unread_notifs = (
            db.query(HospitalNotification)
            .filter(
                HospitalNotification.hospital_id == hospital_id,
                HospitalNotification.is_read == False,
            )
            .order_by(HospitalNotification.created_at.desc())
            .limit(5)
            .all()
        )
        important_alerts = [
            {
                "id": str(n.id),
                "title": n.title,
                "message": n.message,
                "category": n.category,
                "created_at": n.created_at.isoformat(),
            }
            for n in unread_notifs
        ]

        # Quota usage
        quota_usage = {
            "admins_used": active_admins,
            "admins_allowed": ent.max_administrators,
            "employees_used": active_employees,
            "employees_allowed": ent.max_employees,
            "plan_code": plan_code,
            "plan_name": ent.display_name,
        }

        hospital_context = {
            "id": hospital.id,
            "hospital_uid": hospital.hospital_uid,
            "name": hospital.name,
            "city": hospital.city,
            "plan_code": plan_code,
            "plan_name": ent.display_name,
            "max_administrators": ent.max_administrators,
            "max_employees": ent.max_employees,
            "features": ent.features,
        }

        return {
            "hospital": hospital_context,
            "total_employees": total_employees,
            "active_employees": active_employees,
            "department_count": dept_count,
            "active_admin_count": active_admins,
            "pending_employee_invites": pending_emp_invites,
            "pending_registration_requests": pending_registrations,
            "pending_role_requests": pending_role_requests,
            "quota_usage": quota_usage,
            "recent_activity": recent_activity,
            "important_alerts": important_alerts,
        }

    # =========================================================================
    # PART 6: EMPLOYEE MANAGEMENT & INVITATIONS
    # =========================================================================

    @staticmethod
    def list_employees(
        db: Session,
        hospital_id: uuid.UUID,
        search: Optional[str] = None,
        department_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List hospital employees with department and role assignments."""
        query = (
            db.query(TenantMembership)
            .options(
                joinedload(TenantMembership.user),
                joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.department),
                joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.role),
            )
            .filter(TenantMembership.hospital_id == hospital_id)
        )

        if status:
            query = query.filter(TenantMembership.status == status)

        memberships = query.all()

        # Check which users are administrators
        admin_user_ids = set(
            r[0]
            for r in db.query(HospitalAdministrator.user_id)
            .filter(
                HospitalAdministrator.hospital_id == hospital_id,
                HospitalAdministrator.status == "active",
            )
            .all()
        )

        results = []
        for m in memberships:
            # Search filter
            if search:
                s_lower = search.strip().lower()
                matches = (
                    s_lower in m.user.full_name.lower()
                    or s_lower in m.user.email.lower()
                    or s_lower in m.user.username.lower()
                    or s_lower in m.employee_uid.lower()
                )
                if not matches:
                    continue

            # Extract distinct department and role names
            depts = set()
            roles = set()
            for ra in m.role_assignments:
                if ra.is_active:
                    if ra.department:
                        depts.add(ra.department.name)
                    if ra.role:
                        roles.add(ra.role.name)

            if department_id:
                has_dept = any(
                    ra.department_id == department_id and ra.is_active
                    for ra in m.role_assignments
                )
                if not has_dept:
                    continue

            results.append(
                {
                    "id": m.id,
                    "user_id": m.user_id,
                    "full_name": m.user.full_name,
                    "username": m.user.username,
                    "email": m.user.email,
                    "employee_uid": m.employee_uid,
                    "status": m.status,
                    "departments": sorted(list(depts)),
                    "roles": sorted(list(roles)),
                    "is_administrator": m.user_id in admin_user_ids,
                    "created_at": m.created_at,
                    "last_login_at": None,
                }
            )

        return results

    @classmethod
    def invite_employee(
        cls,
        db: Session,
        hospital_id: uuid.UUID,
        admin_user_id: uuid.UUID,
        payload: EmployeeInviteRequest,
        ip_address: Optional[str] = None,
    ) -> Tuple[EmployeeInvitation, str]:
        """Administrator-initiated employee invitation with atomic quota enforcement and multi-scope role support."""
        # 1. Lock hospital to prevent concurrent quota breaches
        hospital = (
            db.query(Hospital)
            .filter(Hospital.id == hospital_id)
            .with_for_update()
            .first()
        )
        if not hospital:
            raise HospitalNotFoundError()

        sub = hospital.subscription
        plan_code = sub.plan_code if sub else "BASIC"
        ent = get_plan_entitlements(plan_code) or get_plan_entitlements("BASIC")
        max_employees = ent.max_employees

        norm_email = payload.email.strip().lower()

        # Check if invitee already belongs to this hospital as an active member
        existing_membership = (
            db.query(TenantMembership)
            .join(User, TenantMembership.user_id == User.id)
            .filter(
                TenantMembership.hospital_id == hospital_id,
                func.lower(User.email) == norm_email,
                TenantMembership.status == "active",
            )
            .first()
        )

        # 2. Count active employees + pending employee invitations (if user is not already an active member)
        now = datetime.now(timezone.utc)
        if not existing_membership:
            active_emp_count = (
                db.query(func.count(TenantMembership.id))
                .filter(
                    TenantMembership.hospital_id == hospital_id,
                    TenantMembership.status == "active",
                )
                .scalar()
                or 0
            )
            pending_emp_count = (
                db.query(func.count(EmployeeInvitation.id))
                .filter(
                    EmployeeInvitation.hospital_id == hospital_id,
                    EmployeeInvitation.status == "PENDING",
                    EmployeeInvitation.expires_at > now,
                )
                .scalar()
                or 0
            )

            if (active_emp_count + pending_emp_count) >= max_employees:
                raise QuotaExceededError(
                    f"Employee headcount quota exceeded for this hospital's {plan_code} plan "
                    f"({active_emp_count} active + {pending_emp_count} pending / {max_employees} maximum allowed)."
                )

        # 3. Resolve assignment slots (support new multi-assignment structure + legacy fallback)
        slots = payload.assignments
        if not slots:
            if payload.role_ids:
                slots = [
                    EmployeeAssignmentSlot(
                        scope_type="DEPARTMENT" if payload.department_id else "FACILITY",
                        department_id=payload.department_id,
                        role_id=r_id,
                    )
                    for r_id in payload.role_ids
                ]

        if not slots or len(slots) < 1:
            raise ValueError("An employee invitation must contain at least 1 scope-role assignment.")
        if len(slots) > 5:
            raise ValueError("An employee invitation cannot contain more than 5 assignment slots.")

        # 4. Check for duplicate assignment pairs
        seen_pairs = set()
        for slot in slots:
            dept_key = str(slot.department_id) if slot.scope_type == "DEPARTMENT" and slot.department_id else "FACILITY"
            pair = (dept_key, str(slot.role_id))
            if pair in seen_pairs:
                raise ValueError("Duplicate department-role assignment detected. Each assignment slot must be unique.")
            seen_pairs.add(pair)

        # 5. Validate roles
        role_ids = [s.role_id for s in slots]
        roles = (
            db.query(Role)
            .filter(Role.id.in_(role_ids), Role.hospital_id == hospital_id, Role.is_active == True)
            .all()
        )
        roles_by_id = {r.id: r for r in roles}
        if len(roles_by_id) != len(set(role_ids)):
            raise ValueError("One or more selected roles do not exist, are inactive, or do not belong to this hospital.")

        # 6. Validate departments
        dept_ids = [s.department_id for s in slots if s.scope_type == "DEPARTMENT" and s.department_id is not None]
        depts_by_id = {}
        if dept_ids:
            depts = (
                db.query(Department)
                .filter(Department.id.in_(dept_ids), Department.hospital_id == hospital_id, Department.is_active == True)
                .all()
            )
            depts_by_id = {d.id: d for d in depts}
            if len(depts_by_id) != len(set(dept_ids)):
                raise ValueError("One or more selected departments do not exist, are inactive, or do not belong to this hospital.")

        # 7. Validate scopes, role restrictions, and BASIC tier restrictions
        tier_allowed_perms = get_tier_allowed_permissions(plan_code)
        assignments_payload = []
        for slot in slots:
            r = roles_by_id[slot.role_id]

            # REQ 7: Reject Hospital Administrator role for employee invitations
            if r.code == "admin" or "admin" in r.name.lower() or "administrator" in r.name.lower():
                raise ValueError("Hospital Administrator access cannot be granted through employee invitations. Institutional administrators must be invited through the purchaser governance portal.")

            # Validate Scope vs Role compatibility
            if slot.scope_type == "FACILITY":
                if slot.department_id is not None:
                    raise ValueError(f"Hospital-wide facility scope cannot be bound to a specific department ({r.name}).")
                if r.scope != "hospital":
                    raise ValueError(f"Role '{r.name}' is scoped to clinical departments and cannot be assigned hospital-wide.")
                dept_name = "Hospital-wide"
                dept_code = "FACILITY"
                dept_id_val = None
            else:
                if slot.department_id is None:
                    raise ValueError(f"Department-level role '{r.name}' must be assigned to a specific clinical department.")
                if r.scope != "department":
                    raise ValueError(f"Role '{r.name}' is a hospital-wide role and cannot be constrained to a single department.")
                d = depts_by_id.get(slot.department_id)
                dept_name = d.name if d else "Department"
                dept_code = d.code if d else "DEPT"
                dept_id_val = str(slot.department_id)

            # BASIC Tier restriction check: verify active version permissions
            active_ver = db.query(RoleVersion).filter(RoleVersion.role_id == r.id, RoleVersion.is_active == True).first()
            if active_ver and active_ver.permissions:
                for vp in active_ver.permissions:
                    if vp.permission and vp.permission.code not in tier_allowed_perms:
                        raise ValueError(f"Role '{r.name}' contains permission '{vp.permission.code}' restricted under the {plan_code} tier.")

            assignments_payload.append({
                "scope_type": slot.scope_type,
                "department_id": dept_id_val,
                "department_name": dept_name,
                "department_code": dept_code,
                "role_id": str(r.id),
                "role_name": r.name,
                "role_code": r.code,
            })

        # 8. Prevent duplicate pending invitations for the same email in this hospital
        existing_inv = (
            db.query(EmployeeInvitation)
            .filter(
                EmployeeInvitation.hospital_id == hospital_id,
                func.lower(EmployeeInvitation.email) == norm_email,
                EmployeeInvitation.status == "PENDING",
                EmployeeInvitation.expires_at > now,
            )
            .first()
        )
        if existing_inv:
            raise ValueError(f"A pending employee invitation already exists for '{norm_email}'.")

        # 9. Generate secure single-use token
        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_token(raw_token)
        expires_at = now + timedelta(days=7)

        assignments_data_json = json.dumps(assignments_payload)
        role_ids_json = json.dumps([str(s.role_id) for s in slots])
        primary_dept_id = slots[0].department_id if slots[0].scope_type == "DEPARTMENT" else None

        invitation = EmployeeInvitation(
            hospital_id=hospital_id,
            invited_by_user_id=admin_user_id,
            email=norm_email,
            full_name=payload.full_name.strip(),
            phone=payload.phone.strip() if payload.phone else None,
            designation=payload.designation.strip() if payload.designation else None,
            department_id=primary_dept_id,
            role_ids=role_ids_json,
            assignments_data=assignments_data_json,
            token_hash=token_hash,
            status="PENDING",
            expires_at=expires_at,
        )
        db.add(invitation)
        db.flush()

        # 10. Audit
        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action="EMPLOYEE_INVITATION_CREATED",
            resource_type="EmployeeInvitation",
            resource_id=str(invitation.id),
            details=f"Admin {admin_user_id} invited employee '{payload.full_name}' ({norm_email}) to hospital '{hospital.name}' with {len(slots)} assignments.",
            ip_address=ip_address,
        )
        db.add(audit)

        # 11. Dispatch email with dedicated employee acceptance link
        invitation_url = f"{settings.FRONTEND_URL}/employee/invitation/accept?token={raw_token}"
        email_svc = get_email_service()
        role_summary = ", ".join(s["role_name"] for s in assignments_payload[:2])
        if len(assignments_payload) > 2:
            role_summary += f" +{len(assignments_payload) - 2} more"

        email_svc.send_invitation_email(
            to_email=norm_email,
            recipient_name=payload.full_name.strip(),
            hospital_name=hospital.name,
            role_type=payload.designation or role_summary,
            invitation_url=invitation_url,
            expires_hours=168,
        )

        db.commit()
        db.refresh(invitation)
        return invitation, raw_token

    @staticmethod
    def verify_employee_invitation_token(db: Session, raw_token: str) -> Dict[str, Any]:
        """Validate token hash, status, expiry, and pre-authorized assignments for public employee invitation acceptance."""
        t_hash = hash_token(raw_token)
        invitation = (
            db.query(EmployeeInvitation)
            .options(joinedload(EmployeeInvitation.hospital).joinedload(Hospital.subscription))
            .filter(EmployeeInvitation.token_hash == t_hash)
            .first()
        )
        if not invitation:
            raise ValueError("Invalid or unknown employee invitation token.")

        now = datetime.now(timezone.utc)
        if invitation.status == "ACCEPTED":
            raise ValueError("This employee invitation has already been accepted.")
        if invitation.status == "REVOKED":
            raise ValueError("This invitation has been revoked by hospital leadership.")
        if invitation.status != "PENDING" or ensure_utc(invitation.expires_at) < now:
            if invitation.status == "PENDING":
                invitation.status = "EXPIRED"
                db.commit()
            raise ValueError("This invitation has expired. Please contact your hospital administrator.")

        hospital = invitation.hospital
        if not hospital or not hospital.is_active:
            raise ValueError("The associated hospital facility is inactive or unavailable.")

        # Parse assignments
        assignments = []
        if invitation.assignments_data:
            try:
                assignments = json.loads(invitation.assignments_data)
            except Exception:
                assignments = []

        if not assignments:
            # Fallback for legacy invitations
            role_ids = []
            try:
                role_ids = [uuid.UUID(rid) for rid in json.loads(invitation.role_ids or "[]")]
            except Exception:
                role_ids = []
            roles = db.query(Role).filter(Role.id.in_(role_ids)).all() if role_ids else []
            dept = db.query(Department).filter(Department.id == invitation.department_id).first() if invitation.department_id else None
            for r in roles:
                assignments.append({
                    "scope_type": "DEPARTMENT" if dept else "FACILITY",
                    "department_id": str(dept.id) if dept else None,
                    "department_name": dept.name if dept else "Hospital-wide",
                    "department_code": dept.code if dept else "FACILITY",
                    "role_id": str(r.id),
                    "role_name": r.name,
                    "role_code": r.code,
                })

        # Check existing user
        norm_email = invitation.email.strip().lower()
        user = db.query(User).filter(func.lower(User.email) == norm_email).first()

        suggested = user.username if user else norm_email.split("@")[0].replace(".", "_")

        return {
            "valid": True,
            "invitation_id": invitation.id,
            "hospital_id": invitation.hospital_id,
            "hospital_name": hospital.name,
            "hospital_uid": hospital.hospital_uid,
            "full_name": invitation.full_name,
            "email": invitation.email,
            "phone": invitation.phone,
            "designation": invitation.designation,
            "assignments": assignments,
            "has_existing_account": user is not None,
            "suggested_username": suggested,
            "expires_at": invitation.expires_at,
        }

    @classmethod
    def accept_employee_invitation(
        cls, db: Session, payload: AcceptEmployeeInvitationRequest, ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Atomically accept employee invitation:
        - Revalidates token, hospital, subscription, quota
        - Authenticates existing user or creates new user identity
        - Creates or activates TenantMembership in hospital
        - Creates all authorized RoleAssignments in active state
        - Marks invitation accepted and records audit logs
        """
        # 1. Acquire row lock on invitation
        t_hash = hash_token(payload.token)
        invitation = (
            db.query(EmployeeInvitation)
            .filter(EmployeeInvitation.token_hash == t_hash)
            .with_for_update()
            .first()
        )
        if not invitation:
            raise ValueError("Invalid employee invitation token.")

        now = datetime.now(timezone.utc)
        if invitation.status == "ACCEPTED":
            raise ValueError("This employee invitation has already been accepted.")
        if invitation.status == "REVOKED":
            raise ValueError("This invitation has been revoked by hospital leadership.")
        if invitation.status != "PENDING" or ensure_utc(invitation.expires_at) < now:
            if invitation.status == "PENDING":
                invitation.status = "EXPIRED"
                db.commit()
            raise ValueError(f"Invitation is no longer valid (current status: '{invitation.status}').")

        # 2. Revalidate hospital and subscription
        hospital = (
            db.query(Hospital)
            .filter(Hospital.id == invitation.hospital_id)
            .with_for_update()
            .first()
        )
        if not hospital or not hospital.is_active:
            raise HospitalNotFoundError("The associated hospital facility is inactive or unavailable.")

        sub = hospital.subscription
        plan_code = sub.plan_code if sub else "BASIC"
        ent = get_plan_entitlements(plan_code) or get_plan_entitlements("BASIC")
        max_employees = ent.max_employees

        norm_email = invitation.email.strip().lower()

        # 3. Handle Identity (New vs Existing Account)
        user = db.query(User).filter(func.lower(User.email) == norm_email).first()
        if user:
            # Existing account: verify password
            if not verify_password(payload.password, user.password_hash):
                raise ValueError("Incorrect password for existing account. Please enter your existing password to accept this invitation.")
        else:
            # New account: validate password policy and username
            if len(payload.password) < 8:
                raise ValueError("Password must be at least 8 characters in length.")

            base_username = payload.username or norm_email.split("@")[0]
            clean_username = "".join(c for c in base_username.lower() if c.isalnum() or c in ("_", "-")) or "emp"

            # Ensure uniqueness
            existing_user_by_name = db.query(User).filter(func.lower(User.username) == clean_username.lower()).first()
            if existing_user_by_name:
                if payload.username and payload.username.lower() == existing_user_by_name.username.lower():
                    raise ValueError(f"Username '{payload.username}' is already in use. Please select a different username.")
                counter = 1
                while db.query(User).filter(func.lower(User.username) == f"{clean_username}{counter}").first():
                    counter += 1
                clean_username = f"{clean_username}{counter}"

            password_hash = get_password_hash(payload.password)
            user = User(
                username=clean_username,
                email=norm_email,
                password_hash=password_hash,
                full_name=invitation.full_name,
                is_active=True,
                is_superuser=False,
            )
            db.add(user)
            db.flush()

        # 4. Check Quota (before adding new membership)
        membership = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.hospital_id == hospital.id,
                TenantMembership.user_id == user.id,
            )
            .first()
        )
        if not membership or membership.status != "active":
            active_emp_count = (
                db.query(func.count(TenantMembership.id))
                .filter(
                    TenantMembership.hospital_id == hospital.id,
                    TenantMembership.status == "active",
                )
                .scalar()
                or 0
            )
            if active_emp_count >= max_employees:
                raise QuotaExceededError(
                    f"Employee headcount quota exceeded for this hospital's {plan_code} plan ({max_employees} maximum allowed)."
                )

        # 5. Create or activate TenantMembership
        if not membership:
            emp_uid = f"EMP-{uuid.uuid4().hex[:6].upper()}"
            membership = TenantMembership(
                user_id=user.id,
                hospital_id=hospital.id,
                employee_uid=emp_uid,
                employee_uid_verified=True,
                status="active",
                verified_at=now,
                verified_by_user_id=invitation.invited_by_user_id,
            )
            db.add(membership)
            db.flush()
        else:
            membership.status = "active"
            membership.employee_uid_verified = True
            membership.verified_at = now
            if not membership.verified_by_user_id:
                membership.verified_by_user_id = invitation.invited_by_user_id
            db.flush()

        # 6. Parse and revalidate assignments
        assignments = []
        if invitation.assignments_data:
            try:
                assignments = json.loads(invitation.assignments_data)
            except Exception:
                assignments = []

        if not assignments:
            # Fallback for legacy
            role_ids = []
            try:
                role_ids = [uuid.UUID(rid) for rid in json.loads(invitation.role_ids or "[]")]
            except Exception:
                role_ids = []
            for rid in role_ids:
                assignments.append({
                    "scope_type": "DEPARTMENT" if invitation.department_id else "FACILITY",
                    "department_id": str(invitation.department_id) if invitation.department_id else None,
                    "role_id": str(rid),
                })

        if not assignments:
            raise ValueError("No authorized role assignments found in this invitation.")

        created_assignments = []
        for slot in assignments:
            r_uuid = uuid.UUID(slot["role_id"])
            d_uuid = uuid.UUID(slot["department_id"]) if slot.get("department_id") else None
            scope_type = slot.get("scope_type", "FACILITY" if d_uuid is None else "DEPARTMENT")

            # Validate role exists and belongs to hospital
            role = (
                db.query(Role)
                .filter(Role.id == r_uuid, Role.hospital_id == hospital.id, Role.is_active == True)
                .first()
            )
            if not role:
                raise ValueError(f"Assigned role ID {r_uuid} is not valid for this hospital.")
            if role.code == "admin":
                raise ValueError("Hospital Administrator role cannot be assigned through employee invitations.")

            if scope_type == "DEPARTMENT":
                if not d_uuid:
                    raise ValueError(f"Department ID required for department-scoped role {role.name}.")
                dept = (
                    db.query(Department)
                    .filter(Department.id == d_uuid, Department.hospital_id == hospital.id, Department.is_active == True)
                    .first()
                )
                if not dept:
                    raise ValueError(f"Assigned department ID {d_uuid} does not belong to this hospital.")
            else:
                d_uuid = None

            # Check if assignment already exists
            existing_assign = (
                db.query(RoleAssignment)
                .filter(
                    RoleAssignment.membership_id == membership.id,
                    RoleAssignment.department_id == d_uuid,
                    RoleAssignment.role_id == r_uuid,
                )
                .first()
            )
            if existing_assign:
                existing_assign.is_active = True
                existing_assign.assignment_status = "active"
                existing_assign.activated_at = now
                existing_assign.revoked_at = None
                created_assignments.append(existing_assign)
            else:
                # Find active role version
                active_ver = (
                    db.query(RoleVersion)
                    .filter(RoleVersion.role_id == r_uuid, RoleVersion.is_active == True)
                    .first()
                )
                new_assign = RoleAssignment(
                    membership_id=membership.id,
                    department_id=d_uuid,
                    role_id=r_uuid,
                    role_version_id=active_ver.id if active_ver else None,
                    assignment_status="active",
                    assignment_source="invitation",
                    approved_by_user_id=invitation.invited_by_user_id,
                    activated_at=now,
                    scope_type=scope_type,
                    is_active=True,
                )
                db.add(new_assign)
                created_assignments.append(new_assign)

        # 7. Mark invitation accepted
        invitation.status = "ACCEPTED"
        invitation.accepted_at = now

        # 8. Audit log
        audit = AuditLog(
            hospital_id=hospital.id,
            user_id=user.id,
            action="EMPLOYEE_INVITATION_ACCEPTED",
            resource_type="EmployeeInvitation",
            resource_id=str(invitation.id),
            details=f"Employee '{user.full_name}' ({user.email}) accepted invitation with {len(created_assignments)} assignments.",
            ip_address=ip_address,
        )
        db.add(audit)

        db.commit()
        db.refresh(membership)

        return {
            "success": True,
            "message": f"Welcome to {hospital.name}! Your account and authorized role assignments are active.",
            "user_id": user.id,
            "username": user.username,
            "membership_id": membership.id,
            "employee_uid": membership.employee_uid,
            "hospital_name": hospital.name,
            "assignments_count": len(created_assignments),
        }

    @classmethod
    def list_employee_invitations(
        cls, db: Session, hospital_id: uuid.UUID, status: Optional[str] = None
    ) -> List[EmployeeInviteItem]:
        """List employee invitations for a hospital, optionally filtered by status."""
        query = (
            db.query(EmployeeInvitation)
            .options(joinedload(EmployeeInvitation.department))
            .filter(EmployeeInvitation.hospital_id == hospital_id)
        )
        if status:
            query = query.filter(EmployeeInvitation.status == status.upper())
        invs = query.order_by(EmployeeInvitation.created_at.desc()).all()

        results = []
        for inv in invs:
            assignments = []
            if inv.assignments_data:
                try:
                    assignments = json.loads(inv.assignments_data)
                except Exception:
                    assignments = []

            role_count = len(assignments)
            if role_count == 0:
                try:
                    role_count = len(json.loads(inv.role_ids or "[]"))
                except Exception:
                    role_count = 0

            dept_name = inv.department.name if inv.department else ("Hospital-wide" if assignments and assignments[0].get("scope_type") == "FACILITY" else None)

            results.append(
                EmployeeInviteItem(
                    id=inv.id,
                    email=inv.email,
                    full_name=inv.full_name,
                    phone=inv.phone,
                    designation=inv.designation,
                    department_name=dept_name,
                    role_count=role_count,
                    status=inv.status,
                    created_at=inv.created_at,
                    expires_at=inv.expires_at,
                    assignments=assignments if assignments else None,
                )
            )
        return results

    @classmethod
    def revoke_employee_invitation(
        cls, db: Session, hospital_id: uuid.UUID, invitation_id: uuid.UUID, admin_user_id: uuid.UUID
    ) -> EmployeeInvitation:
        """Revoke a pending employee invitation, releasing quota immediately."""
        inv = (
            db.query(EmployeeInvitation)
            .filter(
                EmployeeInvitation.id == invitation_id,
                EmployeeInvitation.hospital_id == hospital_id,
            )
            .first()
        )
        if not inv:
            raise ValueError("Employee invitation not found.")
        if inv.status != "PENDING":
            raise ValueError(f"Cannot revoke invitation with status '{inv.status}'.")

        now = datetime.now(timezone.utc)
        inv.status = "REVOKED"
        inv.revoked_at = now

        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action="EMPLOYEE_INVITATION_REVOKED",
            resource_type="EmployeeInvitation",
            resource_id=str(inv.id),
            details=f"Admin {admin_user_id} revoked employee invitation for '{inv.email}'.",
        )
        db.add(audit)
        db.commit()
        db.refresh(inv)
        return inv

    @classmethod
    def resend_employee_invitation(
        cls, db: Session, hospital_id: uuid.UUID, invitation_id: uuid.UUID, admin_user_id: uuid.UUID
    ) -> Tuple[EmployeeInvitation, str]:
        """Generate a fresh invitation token and re-dispatch employee invitation email."""
        inv = (
            db.query(EmployeeInvitation)
            .join(Hospital, EmployeeInvitation.hospital_id == Hospital.id)
            .filter(
                EmployeeInvitation.id == invitation_id,
                EmployeeInvitation.hospital_id == hospital_id,
            )
            .first()
        )
        if not inv:
            raise ValueError("Employee invitation not found.")
        if inv.status != "PENDING":
            raise ValueError(f"Cannot resend invitation with status '{inv.status}'.")

        now = datetime.now(timezone.utc)
        raw_token = secrets.token_urlsafe(32)
        inv.token_hash = hash_token(raw_token)
        inv.expires_at = now + timedelta(days=7)

        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action="EMPLOYEE_INVITATION_RESENT",
            resource_type="EmployeeInvitation",
            resource_id=str(inv.id),
            details=f"Admin {admin_user_id} refreshed and resent invitation for '{inv.email}'.",
        )
        db.add(audit)

        invitation_url = f"{settings.FRONTEND_URL}/employee/invitation/accept?token={raw_token}"
        email_svc = get_email_service()
        email_svc.send_invitation_email(
            to_email=inv.email,
            recipient_name=inv.full_name,
            hospital_name=inv.hospital.name,
            role_type=inv.designation or "Hospital Staff",
            invitation_url=invitation_url,
            expires_hours=168,
        )
        db.commit()
        db.refresh(inv)
        return inv, raw_token

    @staticmethod
    def update_employee_status(
        db: Session,
        hospital_id: uuid.UUID,
        membership_id: uuid.UUID,
        payload: UpdateEmployeeStatusRequest,
        admin_user_id: uuid.UUID,
    ) -> TenantMembership:
        """Suspend, reactivate, or terminate an employee's hospital membership."""
        membership = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.id == membership_id,
                TenantMembership.hospital_id == hospital_id,
            )
            .first()
        )
        if not membership:
            raise ValueError("Employee membership not found.")

        # Protection: Hospital Administrators cannot suspend, terminate, or mutate their own membership
        if admin_user_id == membership.user_id:
            raise ValueError(
                "Hospital Administrators cannot suspend, terminate, or mutate their own membership status. "
                "Administrator lifecycle is governed exclusively by the purchasing entity."
            )

        # Protection: Target membership belonging to any HospitalAdministrator cannot be modified by hospital admins
        target_admin = (
            db.query(HospitalAdministrator)
            .filter(
                HospitalAdministrator.hospital_id == hospital_id,
                HospitalAdministrator.user_id == membership.user_id,
            )
            .first()
        )
        if target_admin:
            raise ValueError(
                "Hospital Administrator membership status is protected and cannot be modified by hospital administrators. "
                "Administrator revocation and replacement is governed exclusively by the purchasing entity."
            )

        old_status = membership.status
        membership.status = payload.status

        # If suspended or terminated, revoke active sessions
        if payload.status in ("suspended", "terminated"):
            db.query(SessionRecord).filter(
                SessionRecord.user_id == membership.user_id,
                SessionRecord.hospital_id == hospital_id,
            ).update({"is_revoked": True})

        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action=f"EMPLOYEE_STATUS_{payload.status.upper()}",
            resource_type="TenantMembership",
            resource_id=str(membership.id),
            details=f"Status changed from '{old_status}' to '{payload.status}'. Reason: {payload.reason or 'N/A'}",
        )
        db.add(audit)
        db.commit()
        db.refresh(membership)
        return membership

    @staticmethod
    def assign_employee_roles(
        db: Session,
        hospital_id: uuid.UUID,
        membership_id: uuid.UUID,
        payload: AssignEmployeeRolesRequest,
        admin_user_id: uuid.UUID,
    ) -> List[RoleAssignment]:
        """Update role and department assignments for an employee."""
        membership = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.id == membership_id,
                TenantMembership.hospital_id == hospital_id,
            )
            .first()
        )
        if not membership:
            raise ValueError("Employee membership not found.")

        # Validate roles
        roles = (
            db.query(Role)
            .filter(Role.id.in_(payload.role_ids), Role.hospital_id == hospital_id)
            .all()
        )
        if len(roles) != len(payload.role_ids):
            raise ValueError("One or more roles do not belong to this hospital.")

        # Protection: Cannot assign Hospital Administrator role through employee assignments
        for r in roles:
            if r.code == "admin" or "admin" in r.name.lower():
                raise ValueError(
                    "Hospital Administrator authority cannot be assigned through ordinary employee role assignments. "
                    "Executive administrators must be invited exclusively by the institution purchaser."
                )

        # Protection: Cannot alter administrator role assignments
        target_admin = (
            db.query(HospitalAdministrator)
            .filter(
                HospitalAdministrator.hospital_id == hospital_id,
                HospitalAdministrator.user_id == membership.user_id,
            )
            .first()
        )
        if target_admin:
            raise ValueError(
                "Hospital Administrator role assignments are protected and cannot be mutated by hospital administrators. "
                "Administrator lifecycle is governed exclusively by the purchasing entity."
            )

        # Deactivate existing assignments for this department
        db.query(RoleAssignment).filter(
            RoleAssignment.membership_id == membership_id,
            RoleAssignment.department_id == payload.department_id,
        ).update({"is_active": False}, synchronize_session=False)

        # Add or activate new assignments
        new_assignments = []
        for r in roles:
            existing_ra = (
                db.query(RoleAssignment)
                .filter(
                    RoleAssignment.membership_id == membership_id,
                    RoleAssignment.department_id == payload.department_id,
                    RoleAssignment.role_id == r.id,
                )
                .first()
            )
            if existing_ra:
                existing_ra.is_active = True
                new_assignments.append(existing_ra)
            else:
                ra = RoleAssignment(
                    membership_id=membership_id,
                    department_id=payload.department_id,
                    role_id=r.id,
                    is_active=True,
                )
                db.add(ra)
                new_assignments.append(ra)

        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action="EMPLOYEE_ROLES_ASSIGNED",
            resource_type="TenantMembership",
            resource_id=str(membership_id),
            details=f"Assigned {len(roles)} roles to employee {membership.employee_uid}.",
        )
        db.add(audit)
        db.commit()
        return new_assignments

    # =========================================================================
    # PART 7: DEPARTMENT & ROLE MANAGEMENT (TIER-AWARE)
    # =========================================================================

    @staticmethod
    def list_departments(db: Session, hospital_id: uuid.UUID) -> List[Dict[str, Any]]:
        """List departments with headcount."""
        depts = (
            db.query(Department)
            .filter(Department.hospital_id == hospital_id)
            .order_by(Department.name.asc())
            .all()
        )
        results = []
        for d in depts:
            count = (
                db.query(func.count(func.distinct(RoleAssignment.membership_id)))
                .filter(RoleAssignment.department_id == d.id, RoleAssignment.is_active == True)
                .scalar()
                or 0
            )
            is_future_scope = (d.code == "DISP")
            results.append(
                {
                    "id": d.id,
                    "name": d.name,
                    "code": d.code,
                    "description": d.description,
                    "employee_count": count,
                    "is_active": d.is_active,
                    "is_future_scope": is_future_scope,
                    "future_scope_notes": "Central dispensary and medication inventory are scheduled for future release." if is_future_scope else None,
                }
            )
        return results

    @staticmethod
    def create_department(
        db: Session,
        hospital_id: uuid.UUID,
        payload: CreateDepartmentRequest,
        plan_code: str,
        admin_user_id: uuid.UUID,
    ) -> Department:
        """Create department, enforcing tier-specific restrictions."""
        if plan_code.upper() == "BASIC":
            raise TierFeatureRestrictedError(
                "Department configuration is restricted under the Basic subscription tier. "
                "The Basic plan uses a standardized predefined department catalogue. "
                "Upgrade to Pro or Ultra to configure custom clinical departments."
            )

        norm_code = payload.code.strip().upper()
        existing = (
            db.query(Department)
            .filter(Department.hospital_id == hospital_id, Department.code == norm_code)
            .first()
        )
        if existing:
            raise ValueError(f"Department code '{norm_code}' already exists in this hospital.")

        dept = Department(
            hospital_id=hospital_id,
            name=payload.name.strip(),
            code=norm_code,
            description=payload.description,
            is_active=True,
        )
        db.add(dept)
        db.flush()

        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action="DEPARTMENT_CREATED",
            resource_type="Department",
            resource_id=str(dept.id),
            details=f"Created department '{dept.name}' ({dept.code}).",
        )
        db.add(audit)
        db.commit()
        db.refresh(dept)
        return dept

    @staticmethod
    def list_roles(db: Session, hospital_id: uuid.UUID) -> List[Dict[str, Any]]:
        """List roles with assigned employee counts."""
        roles = (
            db.query(Role)
            .filter(Role.hospital_id == hospital_id)
            .order_by(Role.name.asc())
            .all()
        )
        results = []
        for r in roles:
            count = (
                db.query(func.count(func.distinct(RoleAssignment.membership_id)))
                .filter(RoleAssignment.role_id == r.id, RoleAssignment.is_active == True)
                .scalar()
                or 0
            )
            is_future_scope = (r.code == "pharmacist")
            perm_codes = []
            if r.active_version and r.active_version.permissions:
                perm_codes = [
                    rvp.permission.code
                    for rvp in r.active_version.permissions
                    if rvp.permission and rvp.permission.is_active
                ]
            if not perm_codes:
                perm_codes = list(SYSTEM_ROLE_PERMISSIONS.get(r.code, []))

            results.append(
                {
                    "id": r.id,
                    "name": r.name,
                    "code": r.code,
                    "scope": r.scope,
                    "description": r.description,
                    "employee_count": count,
                    "is_active": r.is_active,
                    "permission_codes": perm_codes,
                    "is_future_scope": is_future_scope,
                    "future_scope_notes": "Planned future capability. Operational pharmacy and dispensing features are currently inactive." if is_future_scope else None,
                }
            )
        return results

    @staticmethod
    def create_role(
        db: Session,
        hospital_id: uuid.UUID,
        payload: CreateRoleRequest,
        plan_code: str,
        admin_user_id: uuid.UUID,
    ) -> Role:
        """Create role, enforcing tier-specific restrictions."""
        if plan_code.upper() == "BASIC":
            raise TierFeatureRestrictedError(
                "Role configuration is restricted under the Basic subscription tier. "
                "The Basic plan uses standardized institutional roles. "
                "Upgrade to Pro or Ultra to configure custom roles and granular permissions."
            )

        norm_code = payload.code.strip().lower()
        existing = (
            db.query(Role)
            .filter(Role.hospital_id == hospital_id, Role.code == norm_code)
            .first()
        )
        if existing:
            raise ValueError(f"Role code '{norm_code}' already exists in this hospital.")

        if payload.parent_role_id:
            if plan_code.upper() != "ULTRA":
                raise TierFeatureRestrictedError(
                    "Hierarchical role inheritance is an Ultra-tier feature."
                )
            parent = (
                db.query(Role)
                .filter(Role.id == payload.parent_role_id, Role.hospital_id == hospital_id)
                .first()
            )
            if not parent:
                raise ValueError(f"Parent role '{payload.parent_role_id}' not found in this hospital.")

        tier_allowed = get_tier_allowed_permissions(plan_code)
        if payload.permission_codes:
            for p_code in payload.permission_codes:
                if p_code not in tier_allowed:
                    raise TierFeatureRestrictedError(
                        f"Permission '{p_code}' is not permitted in {plan_code} tier."
                    )

        role = Role(
            hospital_id=hospital_id,
            name=payload.name.strip(),
            code=norm_code,
            scope=payload.scope,
            description=payload.description,
            is_active=True,
        )
        db.add(role)
        db.flush()

        now = datetime.now(timezone.utc)
        v1 = RoleVersion(
            id=uuid.uuid4(),
            role_id=role.id,
            version_number=1,
            parent_role_id=payload.parent_role_id,
            is_active=True,
            created_by_user_id=admin_user_id,
            change_reason="Initial custom role version (v1)",
            activated_at=now,
        )
        db.add(v1)
        db.flush()

        if payload.permission_codes:
            for p_code in set(payload.permission_codes):
                perm = db.query(Permission).filter(Permission.code == p_code).first()
                if not perm:
                    defn = MASTER_PERMISSION_CATALOGUE.get(p_code)
                    if defn:
                        perm = Permission(
                            id=uuid.uuid4(),
                            code=defn.code,
                            name=defn.name,
                            description=defn.description,
                            category=defn.category,
                            module=defn.module,
                            risk_level=defn.risk_level,
                            tier_availability=defn.min_tier,
                            is_system=True,
                            is_active=True,
                        )
                        db.add(perm)
                        db.flush()
                if perm:
                    db.add(
                        RoleVersionPermission(
                            id=uuid.uuid4(),
                            role_version_id=v1.id,
                            permission_id=perm.id,
                        )
                    )

        role.active_version_id = v1.id

        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action="ROLE_CREATED",
            resource_type="Role",
            resource_id=str(role.id),
            details=f"Created custom role '{role.name}' ({role.code}, scope={role.scope}) with version 1.",
        )
        db.add(audit)
        db.commit()
        db.refresh(role)
        return role

    # =========================================================================
    # PART 8: AUDIT & NOTIFICATIONS
    # =========================================================================

    @staticmethod
    def list_audit_logs(
        db: Session,
        hospital_id: uuid.UUID,
        action: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List tenant-isolated audit logs for hospital administrators."""
        query = (
            db.query(AuditLog)
            .outerjoin(User, AuditLog.user_id == User.id)
            .filter(AuditLog.hospital_id == hospital_id)
        )
        if action:
            query = query.filter(AuditLog.action == action)

        logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
        results = []
        for log in logs:
            user = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None
            results.append(
                {
                    "id": log.id,
                    "action": log.action,
                    "resource_type": log.resource_type,
                    "resource_id": log.resource_id,
                    "details": log.details,
                    "actor_name": user.full_name if user else "Purchaser / System",
                    "actor_email": user.email if user else None,
                    "ip_address": log.ip_address,
                    "created_at": log.created_at,
                }
            )
        return results

    @staticmethod
    def list_notifications(
        db: Session, hospital_id: uuid.UUID, user_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        """List notifications for the administrator's hospital context."""
        notifs = (
            db.query(HospitalNotification)
            .filter(
                HospitalNotification.hospital_id == hospital_id,
                or_(
                    HospitalNotification.recipient_user_id == user_id,
                    HospitalNotification.recipient_user_id.is_(None),
                ),
            )
            .order_by(HospitalNotification.created_at.desc())
            .limit(30)
            .all()
        )
        return [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "category": n.category,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in notifs
        ]

    @staticmethod
    def mark_notification_read(
        db: Session, hospital_id: uuid.UUID, notification_id: uuid.UUID
    ) -> bool:
        """Mark notification as read."""
        notif = (
            db.query(HospitalNotification)
            .filter(
                HospitalNotification.id == notification_id,
                HospitalNotification.hospital_id == hospital_id,
            )
            .first()
        )
        if notif:
            notif.is_read = True
            db.commit()
            return True
        return False

    # =========================================================================
    # PART 9: PERMISSIONS & ROLE VERSIONING (RBAC)
    # =========================================================================

    @staticmethod
    def list_permissions(
        plan_code: str, db: Optional[Session] = None
    ) -> List[Dict[str, Any]]:
        """List master permission catalogue with tier-availability metadata."""
        from app.core.permissions import DEFERRED_PERMISSIONS
        tier_allowed = get_tier_allowed_permissions(plan_code)
        results = []
        for code, defn in sorted(MASTER_PERMISSION_CATALOGUE.items()):
            is_deferred = getattr(defn, "is_deferred", False) or code in DEFERRED_PERMISSIONS
            is_permitted = (code in tier_allowed) and not is_deferred
            results.append(
                {
                    "code": defn.code,
                    "name": defn.name,
                    "category": defn.category,
                    "module": defn.module,
                    "description": defn.description,
                    "risk_level": defn.risk_level,
                    "min_tier": defn.min_tier,
                    "is_system": True,
                    "is_active": not is_deferred,
                    "is_deferred": is_deferred,
                    "is_tier_permitted": is_permitted,
                }
            )
        return results

    @staticmethod
    def list_role_versions(
        db: Session, hospital_id: uuid.UUID, role_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        """List immutable version history and permissions for a specific role."""
        role = (
            db.query(Role)
            .filter(Role.id == role_id, Role.hospital_id == hospital_id)
            .first()
        )
        if not role:
            raise ValueError(f"Role '{role_id}' not found in this hospital.")

        versions = (
            db.query(RoleVersion)
            .options(
                joinedload(RoleVersion.permissions).joinedload(RoleVersionPermission.permission),
                joinedload(RoleVersion.parent_role),
                joinedload(RoleVersion.created_by),
            )
            .filter(RoleVersion.role_id == role_id)
            .order_by(RoleVersion.version_number.desc())
            .all()
        )

        results = []
        for ver in versions:
            p_codes = [
                rvp.permission.code
                for rvp in ver.permissions
                if rvp.permission and rvp.permission.is_active
            ]
            results.append(
                {
                    "id": ver.id,
                    "role_id": role.id,
                    "role_name": role.name,
                    "role_code": role.code,
                    "version_number": ver.version_number,
                    "parent_role_id": ver.parent_role_id,
                    "parent_role_name": ver.parent_role.name if ver.parent_role else None,
                    "change_reason": ver.change_reason,
                    "is_active": ver.is_active,
                    "created_by_user_id": ver.created_by_user_id,
                    "created_by_name": ver.created_by.full_name if ver.created_by else None,
                    "activated_at": ver.activated_at,
                    "created_at": ver.created_at,
                    "permission_codes": p_codes,
                }
            )
        return results

    @staticmethod
    def create_role_version(
        db: Session,
        hospital_id: uuid.UUID,
        role_id: uuid.UUID,
        payload: Optional[CreateRoleVersionRequest] = None,
        plan_code: str = "BASIC",
        admin_user_id: Optional[uuid.UUID] = None,
        data: Optional[CreateRoleVersionRequest] = None,
    ) -> RoleVersion:
        """Create and activate a new version for a role with specified permissions."""
        req = payload or data
        if not req:
            raise ValueError("CreateRoleVersionRequest payload is required.")

        if plan_code.upper() == "BASIC":
            raise TierFeatureRestrictedError(
                "Role versioning and custom permission sets are restricted on the Basic tier. Upgrade to Pro or Ultra."
            )

        role = (
            db.query(Role)
            .filter(Role.id == role_id, Role.hospital_id == hospital_id)
            .first()
        )
        if not role:
            raise ValueError(f"Role '{role_id}' not found in this hospital.")

        parent_role_id = req.parent_role_id
        if parent_role_id:
            if plan_code.upper() != "ULTRA":
                raise TierFeatureRestrictedError(
                    "Hierarchical role inheritance is an Ultra-tier feature."
                )
            if parent_role_id == role.id:
                raise ValueError("Role cannot inherit from itself.")
            parent = (
                db.query(Role)
                .filter(Role.id == parent_role_id, Role.hospital_id == hospital_id)
                .first()
            )
            if not parent:
                raise ValueError(f"Parent role '{parent_role_id}' not found in this hospital.")

            # Traverse ancestors of parent_role_id to prevent cyclic inheritance
            visited = {role_id, parent_role_id}
            curr_parent_id = parent_role_id
            while curr_parent_id:
                active_parent_ver = (
                    db.query(RoleVersion)
                    .filter(RoleVersion.role_id == curr_parent_id, RoleVersion.is_active == True)
                    .first()
                )
                if not active_parent_ver or not active_parent_ver.parent_role_id:
                    break
                next_parent_id = active_parent_ver.parent_role_id
                if next_parent_id == role.id or next_parent_id in visited:
                    raise ValueError(f"Cyclic role inheritance detected: role '{role.name}' would form an inheritance cycle with parent role.")
                visited.add(next_parent_id)
                curr_parent_id = next_parent_id

        from app.core.permissions import DEFERRED_PERMISSIONS
        tier_allowed = get_tier_allowed_permissions(plan_code)
        for p_code in req.permission_codes:
            if p_code in DEFERRED_PERMISSIONS:
                raise ValueError(
                    f"Permission '{p_code}' is deferred to future scope and cannot be activated in operational roles."
                )
            if p_code not in tier_allowed:
                raise TierFeatureRestrictedError(
                    f"Permission '{p_code}' is not permitted in {plan_code} tier."
                )

        max_ver = (
            db.query(func.max(RoleVersion.version_number))
            .filter(RoleVersion.role_id == role_id)
            .scalar()
        ) or 0
        new_version_number = max_ver + 1

        # Deactivate current active versions
        db.query(RoleVersion).filter(
            RoleVersion.role_id == role_id, RoleVersion.is_active == True
        ).update({"is_active": False})

        now = datetime.now(timezone.utc)
        ver = RoleVersion(
            id=uuid.uuid4(),
            role_id=role_id,
            version_number=new_version_number,
            parent_role_id=parent_role_id,
            is_active=True,
            created_by_user_id=admin_user_id,
            change_reason=req.change_reason,
            activated_at=now,
        )
        db.add(ver)
        db.flush()

        for p_code in set(req.permission_codes):
            perm = db.query(Permission).filter(Permission.code == p_code).first()
            if not perm:
                defn = MASTER_PERMISSION_CATALOGUE.get(p_code)
                if defn:
                    perm = Permission(
                        id=uuid.uuid4(),
                        code=defn.code,
                        name=defn.name,
                        description=defn.description,
                        category=defn.category,
                        module=defn.module,
                        risk_level=defn.risk_level,
                        tier_availability=defn.min_tier,
                        is_system=True,
                        is_active=True,
                    )
                    db.add(perm)
                    db.flush()
            if perm:
                db.add(
                    RoleVersionPermission(
                        id=uuid.uuid4(),
                        role_version_id=ver.id,
                        permission_id=perm.id,
                    )
                )

        role.active_version_id = ver.id

        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action="ROLE_VERSION_CREATED",
            resource_type="RoleVersion",
            resource_id=str(ver.id),
            details=f"Created and activated version {ver.version_number} for role '{role.name}' ({role.code}) with {len(req.permission_codes)} permissions.",
        )
        db.add(audit)
        db.commit()
        db.refresh(ver)
        return ver

    # =========================================================================
    # PART 10: MULTI-DEPARTMENT ASSIGNMENTS & OVERRIDES
    # =========================================================================

    @staticmethod
    def list_employee_assignments(
        db: Session, hospital_id: uuid.UUID, membership_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        """List multi-department role assignments for a specific employee."""
        mem = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.id == membership_id,
                TenantMembership.hospital_id == hospital_id,
            )
            .first()
        )
        if not mem:
            raise ValueError(f"Employee membership '{membership_id}' not found in this hospital.")

        assignments = (
            db.query(RoleAssignment)
            .options(
                joinedload(RoleAssignment.role).joinedload(Role.versions),
                joinedload(RoleAssignment.department),
                joinedload(RoleAssignment.role_version),
            )
            .filter(RoleAssignment.membership_id == membership_id)
            .order_by(RoleAssignment.created_at.desc())
            .all()
        )

        results = []
        for a in assignments:
            active_v = None
            if a.role and hasattr(a.role, "versions") and a.role.versions:
                active_v = next((v for v in a.role.versions if v.is_active), None) or a.role.versions[0]

            ver_num = a.role_version.version_number if a.role_version else (active_v.version_number if active_v else 1)
            ver_id = a.role_version_id or (active_v.id if active_v else None)

            results.append(
                {
                    "id": a.id,
                    "membership_id": a.membership_id,
                    "department_id": a.department_id,
                    "department_name": a.department.name if a.department else None,
                    "role_id": a.role_id,
                    "role_name": a.role.name if a.role else "Unknown Role",
                    "role_code": a.role.code if a.role else "unknown",
                    "role_version_id": ver_id,
                    "role_version_number": ver_num,
                    "assignment_status": a.assignment_status,
                    "assignment_source": a.assignment_source,
                    "scope_type": a.scope_type,
                    "scope_department_ids": a.scope_department_ids,
                    "is_active": a.is_active,
                    "assigned_at": a.created_at,
                    "activated_at": a.activated_at,
                    "revoked_at": a.revoked_at,
                }
            )
        return results

    @staticmethod
    def assign_employee_role(
        db: Session,
        hospital_id: uuid.UUID,
        membership_id: uuid.UUID,
        payload: Optional[CreateRoleAssignmentRequest] = None,
        plan_code: str = "BASIC",
        admin_user_id: Optional[uuid.UUID] = None,
        data: Optional[CreateRoleAssignmentRequest] = None,
    ) -> RoleAssignment:
        """Assign an employee to a specific department role with dynamic version tracking."""
        req = payload or data
        if not req:
            raise ValueError("CreateRoleAssignmentRequest payload is required.")

        mem = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.id == membership_id,
                TenantMembership.hospital_id == hospital_id,
            )
            .first()
        )
        if not mem:
            raise ValueError(f"Employee membership '{membership_id}' not found in this hospital.")

        role = (
            db.query(Role)
            .filter(Role.id == req.role_id, Role.hospital_id == hospital_id)
            .first()
        )
        if not role:
            raise ValueError(f"Role '{req.role_id}' not found in this hospital.")

        # Protection: Cannot assign Hospital Administrator role through employee assignments
        if role.code == "admin" or "admin" in role.name.lower():
            raise ValueError(
                "Hospital Administrator authority cannot be assigned through ordinary employee role assignments. "
                "Executive administrators must be invited exclusively by the institution purchaser."
            )

        # Protection: Cannot alter administrator role assignments
        target_admin = (
            db.query(HospitalAdministrator)
            .filter(
                HospitalAdministrator.hospital_id == hospital_id,
                HospitalAdministrator.user_id == mem.user_id,
            )
            .first()
        )
        if target_admin:
            raise ValueError(
                "Hospital Administrator role assignments are protected and cannot be mutated by hospital administrators. "
                "Administrator lifecycle is governed exclusively by the purchasing entity."
            )

        if req.department_id:
            dept = (
                db.query(Department)
                .filter(Department.id == req.department_id, Department.hospital_id == hospital_id)
                .first()
            )
            if not dept:
                raise ValueError(f"Department '{req.department_id}' not found in this hospital.")

        if req.scope_type in ("FACILITY", "MULTI_DEPARTMENT") and plan_code.upper() != "ULTRA":
            raise TierFeatureRestrictedError(
                "Multi-department and facility-wide scoping requires the Ultra subscription tier."
            )

        if req.scope_type == "MULTI_DEPARTMENT":
            if not req.scope_department_ids:
                raise ValueError("Multi-department scope requires at least one department ID in 'scope_department_ids'.")
            valid_hospital_dept_ids = {
                d[0] for d in db.query(Department.id).filter(Department.hospital_id == hospital_id).all()
            }
            for d_id in req.scope_department_ids:
                if d_id not in valid_hospital_dept_ids:
                    raise ValueError(f"Cross-hospital or invalid department ID '{d_id}' cannot be added to scope.")

        scope_dept_str = (
            json.dumps([str(d) for d in req.scope_department_ids])
            if req.scope_department_ids
            else None
        )

        now = datetime.now(timezone.utc)

        existing = (
            db.query(RoleAssignment)
            .filter(
                RoleAssignment.membership_id == membership_id,
                RoleAssignment.department_id == req.department_id,
                RoleAssignment.role_id == req.role_id,
            )
            .first()
        )

        if existing:
            existing.is_active = True
            existing.assignment_status = "active"
            existing.assignment_source = "admin_assigned"
            existing.assigned_by_user_id = admin_user_id
            existing.role_version_id = None  # Dynamic tracking
            existing.scope_type = req.scope_type
            existing.scope_department_ids = scope_dept_str
            existing.activated_at = now
            existing.revoked_at = None
            existing.revoked_by_user_id = None
            assign = existing
        else:
            assign = RoleAssignment(
                id=uuid.uuid4(),
                membership_id=membership_id,
                department_id=req.department_id,
                role_id=req.role_id,
                role_version_id=None,  # Dynamic tracking
                is_active=True,
                assignment_status="active",
                assignment_source="admin_assigned",
                assigned_by_user_id=admin_user_id,
                scope_type=req.scope_type,
                scope_department_ids=scope_dept_str,
                activated_at=now,
            )
            db.add(assign)

        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action="ROLE_ASSIGNMENT_CREATED",
            resource_type="RoleAssignment",
            resource_id=str(assign.id),
            details=f"Assigned role '{role.name}' ({role.code}) to employee {membership_id} (scope={req.scope_type}).",
        )
        db.add(audit)
        db.commit()
        db.refresh(assign)
        return assign

    @staticmethod
    def revoke_employee_role_assignment(
        db: Session,
        hospital_id: uuid.UUID,
        membership_id: uuid.UUID,
        assignment_id: uuid.UUID,
        admin_user_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """Revoke an employee role assignment."""
        mem = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.id == membership_id,
                TenantMembership.hospital_id == hospital_id,
            )
            .first()
        )
        if not mem:
            raise ValueError(f"Employee membership '{membership_id}' not found in this hospital.")

        assign = (
            db.query(RoleAssignment)
            .filter(
                RoleAssignment.id == assignment_id,
                RoleAssignment.membership_id == membership_id,
            )
            .first()
        )
        if not assign:
            raise ValueError(f"Role assignment '{assignment_id}' not found.")

        # Protection: Cannot revoke Hospital Administrator role assignments
        assign_role = db.query(Role).filter(Role.id == assign.role_id).first()
        if assign_role and (assign_role.code == "admin" or "admin" in assign_role.name.lower()):
            raise ValueError(
                "Hospital Administrator role assignments are protected and cannot be revoked by hospital administrators. "
                "Administrator lifecycle is governed exclusively by the purchasing entity."
            )

        # Protection: Administrator cannot revoke their own assignments
        if admin_user_id and admin_user_id == mem.user_id:
            raise ValueError(
                "Hospital Administrators cannot revoke their own role assignments. "
                "Administrator lifecycle is governed exclusively by the purchasing entity."
            )

        now = datetime.now(timezone.utc)
        assign.is_active = False
        assign.assignment_status = "revoked"
        assign.revoked_at = now
        assign.revoked_by_user_id = admin_user_id

        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action="ROLE_ASSIGNMENT_REVOKED",
            resource_type="RoleAssignment",
            resource_id=str(assign.id),
            details=f"Revoked role assignment {assignment_id} for employee {membership_id}.",
        )
        db.add(audit)
        db.commit()
        return True

    @staticmethod
    def list_employee_overrides(
        db: Session, hospital_id: uuid.UUID, membership_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        """List active individual permission overrides (GRANT or DENY) for an employee."""
        mem = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.id == membership_id,
                TenantMembership.hospital_id == hospital_id,
            )
            .first()
        )
        if not mem:
            raise ValueError(f"Employee membership '{membership_id}' not found in this hospital.")

        overrides = (
            db.query(MembershipPermissionOverride)
            .options(
                joinedload(MembershipPermissionOverride.permission),
                joinedload(MembershipPermissionOverride.department),
                joinedload(MembershipPermissionOverride.granted_by),
            )
            .filter(
                MembershipPermissionOverride.membership_id == membership_id,
                MembershipPermissionOverride.revoked_at.is_(None),
            )
            .order_by(MembershipPermissionOverride.created_at.desc())
            .all()
        )

        results = []
        for o in overrides:
            p_code = o.permission.code if o.permission else "unknown"
            p_name = o.permission.name if o.permission else p_code
            results.append(
                {
                    "id": o.id,
                    "membership_id": o.membership_id,
                    "permission_code": p_code,
                    "permission_name": p_name,
                    "override_type": o.override_type,
                    "department_id": o.department_id,
                    "department_name": o.department.name if o.department else None,
                    "reason": o.reason,
                    "expires_at": o.expires_at,
                    "granted_by_user_id": o.granted_by_user_id,
                    "granted_by_name": o.granted_by.full_name if o.granted_by else None,
                    "created_at": o.created_at,
                }
            )
        return results

    @staticmethod
    def create_employee_override(
        db: Session,
        hospital_id: uuid.UUID,
        membership_id: uuid.UUID,
        payload: Optional[CreatePermissionOverrideRequest] = None,
        plan_code: str = "BASIC",
        admin_user_id: Optional[uuid.UUID] = None,
        data: Optional[CreatePermissionOverrideRequest] = None,
    ) -> MembershipPermissionOverride:
        """Create explicit individual permission override (GRANT or DENY)."""
        req = payload or data
        if not req:
            raise ValueError("CreatePermissionOverrideRequest payload is required.")

        mem = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.id == membership_id,
                TenantMembership.hospital_id == hospital_id,
            )
            .first()
        )
        if not mem:
            raise ValueError(f"Employee membership '{membership_id}' not found in this hospital.")

        perm = db.query(Permission).filter(Permission.code == req.permission_code).first()
        if not perm:
            defn = MASTER_PERMISSION_CATALOGUE.get(req.permission_code)
            if not defn:
                raise ValueError(f"Permission code '{req.permission_code}' is not recognized.")
            perm = Permission(
                id=uuid.uuid4(),
                code=defn.code,
                name=defn.name,
                description=defn.description,
                category=defn.category,
                module=defn.module,
                risk_level=defn.risk_level,
                tier_availability=defn.min_tier,
                is_system=True,
                is_active=True,
            )
            db.add(perm)
            db.flush()

        if req.override_type == "GRANT":
            # Protection: Cannot grant executive administrative authority via generic employee overrides
            ADMIN_EXCLUSIVE_PERMISSIONS = {
                "employee:invite",
                "employee:manage",
                "department:manage",
                "role:manage",
                "role:inherit",
                "audit:read",
                "audit:export",
                "subscription:read",
                "hospital:settings:manage",
            }
            if req.permission_code in ADMIN_EXCLUSIVE_PERMISSIONS:
                raise ValueError(
                    f"Permission '{req.permission_code}' is an executive Hospital Administrator authority "
                    "and cannot be granted via individual employee overrides."
                )

            tier_allowed = get_tier_allowed_permissions(plan_code)
            if req.permission_code not in tier_allowed:
                raise TierFeatureRestrictedError(
                    f"Explicit permission grant for '{req.permission_code}' is restricted under the {plan_code} tier entitlement. Higher tier permissions cannot be granted via individual overrides."
                )

        if req.department_id:
            dept = (
                db.query(Department)
                .filter(Department.id == req.department_id, Department.hospital_id == hospital_id)
                .first()
            )
            if not dept:
                raise ValueError(f"Department '{req.department_id}' not found in this hospital.")

        existing = (
            db.query(MembershipPermissionOverride)
            .filter(
                MembershipPermissionOverride.membership_id == membership_id,
                MembershipPermissionOverride.permission_id == perm.id,
                MembershipPermissionOverride.department_id == req.department_id,
                MembershipPermissionOverride.revoked_at.is_(None),
            )
            .first()
        )
        if existing:
            existing.override_type = req.override_type
            existing.reason = req.reason
            existing.expires_at = req.expires_at
            existing.granted_by_user_id = admin_user_id
            override = existing
        else:
            override = MembershipPermissionOverride(
                id=uuid.uuid4(),
                membership_id=membership_id,
                permission_id=perm.id,
                override_type=req.override_type,
                department_id=req.department_id,
                reason=req.reason,
                expires_at=req.expires_at,
                granted_by_user_id=admin_user_id,
            )
            db.add(override)

        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action="PERMISSION_OVERRIDE_CREATED",
            resource_type="MembershipPermissionOverride",
            resource_id=str(override.id),
            details=f"Created {req.override_type} override for permission '{req.permission_code}' on employee {membership_id}.",
        )
        db.add(audit)
        db.commit()
        db.refresh(override)
        return override

    @staticmethod
    def revoke_employee_override(
        db: Session,
        hospital_id: uuid.UUID,
        membership_id: uuid.UUID,
        override_id: uuid.UUID,
        admin_user_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """Revoke an active permission override."""
        mem = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.id == membership_id,
                TenantMembership.hospital_id == hospital_id,
            )
            .first()
        )
        if not mem:
            raise ValueError(f"Employee membership '{membership_id}' not found in this hospital.")

        override = (
            db.query(MembershipPermissionOverride)
            .filter(
                MembershipPermissionOverride.id == override_id,
                MembershipPermissionOverride.membership_id == membership_id,
            )
            .first()
        )
        if not override:
            raise ValueError(f"Permission override '{override_id}' not found.")

        now = datetime.now(timezone.utc)
        override.revoked_at = now
        override.revoked_by_user_id = admin_user_id

        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=admin_user_id,
            action="PERMISSION_OVERRIDE_REVOKED",
            resource_type="MembershipPermissionOverride",
            resource_id=str(override.id),
            details=f"Revoked permission override {override_id} for employee {membership_id}.",
        )
        db.add(audit)
        db.commit()
        return True

    @staticmethod
    def get_employee_effective_permissions(
        db: Session,
        hospital_id: uuid.UUID,
        membership_id: uuid.UUID,
        department_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Inspect all 43 atomic permissions and resolution explanations for an employee."""
        mem = (
            db.query(TenantMembership)
            .options(
                joinedload(TenantMembership.user),
                joinedload(TenantMembership.hospital).joinedload(Hospital.subscription),
                joinedload(TenantMembership.role_assignments),
            )
            .filter(
                TenantMembership.id == membership_id,
                TenantMembership.hospital_id == hospital_id,
            )
            .first()
        )
        if not mem:
            raise ValueError(f"Employee membership '{membership_id}' not found in this hospital.")

        sub = mem.hospital.subscription if mem.hospital else None
        plan_code = sub.plan_code if sub and sub.status.lower() == "active" else "BASIC"

        resolved = AuthorizationService.get_effective_permissions_detail(
            db, membership_id, target_department_id=department_id
        )

        active_assignments_count = sum(
            1 for a in mem.role_assignments if a.is_active and a.assignment_status == "active"
        )
        active_overrides_count = (
            db.query(func.count(MembershipPermissionOverride.id))
            .filter(
                MembershipPermissionOverride.membership_id == membership_id,
                MembershipPermissionOverride.revoked_at.is_(None),
            )
            .scalar()
            or 0
        )

        perm_items = []
        for r in resolved:
            perm_items.append(
                {
                    "code": r.code,
                    "name": r.name,
                    "category": r.category,
                    "module": r.module,
                    "is_granted": r.is_granted,
                    "status": r.status,
                    "source": r.source,
                    "source_role_name": r.source_role_name,
                    "source_role_version": r.source_role_version,
                    "department_scope": r.department_scope,
                    "reason": r.reason,
                    "expires_at": r.expires_at,
                    "explanation": r.explanation,
                }
            )

        return {
            "membership_id": mem.id,
            "employee_name": mem.user.full_name if mem.user else "Unknown",
            "employee_uid": mem.employee_uid,
            "plan_code": plan_code,
            "active_assignments_count": active_assignments_count,
            "active_overrides_count": active_overrides_count,
            "permissions": perm_items,
        }

    # =========================================================================
    # PART 11: APPROVAL WORKFLOW DECISIONS
    # =========================================================================

    @staticmethod
    def list_pending_approvals(
        db: Session, hospital_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        """List pending employee registration requests and requested roles."""
        requests = (
            db.query(RegistrationRequest)
            .options(
                joinedload(RegistrationRequest.assignment_requests).joinedload(
                    RegistrationAssignmentRequest.department
                ),
                joinedload(RegistrationRequest.assignment_requests).joinedload(
                    RegistrationAssignmentRequest.role
                ),
            )
            .filter(
                RegistrationRequest.hospital_id == hospital_id,
                RegistrationRequest.status.in_(["pending_approval", "partially_approved", "pending"]),
            )
            .order_by(RegistrationRequest.created_at.desc())
            .all()
        )

        results = []
        for req in requests:
            slots = []
            for slot in sorted(req.assignment_requests, key=lambda s: s.slot_number):
                slots.append(
                    {
                        "id": slot.id,
                        "slot_number": slot.slot_number,
                        "department_id": slot.department_id,
                        "department_name": slot.department.name if slot.department else None,
                        "role_id": slot.role_id,
                        "role_name": slot.role.name if slot.role else "Unknown Role",
                        "role_code": slot.role.code if slot.role else "unknown",
                        "status": slot.status,
                        "dept_head_notes": slot.dept_head_notes,
                        "admin_notes": slot.admin_notes,
                    }
                )
            results.append(
                {
                    "id": req.id,
                    "hospital_id": req.hospital_id,
                    "email": req.email,
                    "full_name": req.full_name,
                    "employee_uid_claim": req.employee_uid_claim,
                    "employee_uid_verified": req.employee_uid_verified,
                    "status": req.status,
                    "created_at": req.created_at,
                    "assignment_requests": slots,
                }
            )
        return results

    @staticmethod
    def decide_registration_approval(
        db: Session,
        hospital_id: uuid.UUID,
        registration_request_id: Optional[uuid.UUID] = None,
        payload: Optional[RegistrationApprovalDecisionRequest] = None,
        admin_user_id: Optional[uuid.UUID] = None,
        registration_id: Optional[uuid.UUID] = None,
        data: Optional[RegistrationApprovalDecisionRequest] = None,
    ) -> RegistrationRequest:
        """Process administrator final approval/rejection decision on requested department roles."""
        r_id = registration_request_id or registration_id
        if not r_id:
            raise ValueError("Registration request ID is required.")

        req = payload or data
        if not req:
            raise ValueError("RegistrationApprovalDecisionRequest payload is required.")

        reg_req = (
            db.query(RegistrationRequest)
            .options(
                joinedload(RegistrationRequest.assignment_requests),
                joinedload(RegistrationRequest.user),
            )
            .filter(
                RegistrationRequest.id == r_id,
                RegistrationRequest.hospital_id == hospital_id,
            )
            .first()
        )
        if not reg_req:
            raise ValueError(f"Registration request '{r_id}' not found in this hospital.")

        if reg_req.status in ("approved", "rejected"):
            raise ValueError(
                f"Registration request '{r_id}' has already been decided (status: {reg_req.status})."
            )

        now = datetime.now(timezone.utc)
        if req.verify_employee_uid:
            reg_req.employee_uid_verified = True
            reg_req.verified_by_user_id = admin_user_id
            reg_req.verified_at = now

        decisions_map: Dict[str, str] = {}
        for d in req.assignment_decisions:
            if hasattr(d, "assignment_id"):
                decisions_map[str(d.assignment_id)] = d.decision.lower()
            elif isinstance(d, dict):
                decisions_map[str(d["assignment_id"])] = d["decision"].lower()

        approved_count = 0
        membership = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.user_id == reg_req.user_id,
                TenantMembership.hospital_id == reg_req.hospital_id,
            )
            .first()
        )

        any_approved = any(dec == "approved" for dec in decisions_map.values())
        if any_approved and (not membership or membership.status != "active"):
            sub = (
                db.query(PurchaserSubscription)
                .join(Hospital, Hospital.subscription_id == PurchaserSubscription.id)
                .filter(Hospital.id == hospital_id)
                .first()
            )
            plan_code = sub.plan_code if sub and sub.status.lower() == "active" else "BASIC"
            ent = get_plan_entitlements(plan_code)
            active_emp_count = (
                db.query(func.count(TenantMembership.id))
                .filter(
                    TenantMembership.hospital_id == hospital_id,
                    TenantMembership.status == "active",
                )
                .scalar()
                or 0
            )
            if active_emp_count >= ent.max_employees:
                raise QuotaExceededError(
                    f"Employee headcount quota exceeded for this hospital ({active_emp_count}/{ent.max_employees}). Upgrade plan to approve more employees."
                )

        for assign_req in reg_req.assignment_requests:
            dec = decisions_map.get(str(assign_req.id))
            if dec:
                assign_req.admin_user_id = admin_user_id
                assign_req.admin_reviewed_at = now
                assign_req.admin_notes = req.notes

                if dec == "approved":
                    assign_req.status = "approved_final"
                    approved_count += 1

                    if membership:
                        existing_assign = (
                            db.query(RoleAssignment)
                            .filter(
                                RoleAssignment.membership_id == membership.id,
                                RoleAssignment.department_id == assign_req.department_id,
                                RoleAssignment.role_id == assign_req.role_id,
                            )
                            .first()
                        )
                        if existing_assign:
                            existing_assign.is_active = True
                            existing_assign.assignment_status = "active"
                            existing_assign.activated_at = now
                            existing_assign.revoked_at = None
                            existing_assign.revoked_by_user_id = None
                            existing_assign.approved_by_user_id = admin_user_id
                            existing_assign.role_version_id = None  # Dynamic tracking
                        else:
                            db.add(
                                RoleAssignment(
                                    id=uuid.uuid4(),
                                    membership_id=membership.id,
                                    department_id=assign_req.department_id,
                                    role_id=assign_req.role_id,
                                    role_version_id=None,  # Dynamic tracking
                                    assignment_status="active",
                                    assignment_source="self_registration",
                                    approved_by_user_id=admin_user_id,
                                    activated_at=now,
                                    scope_type="DEPARTMENT",
                                    is_active=True,
                                )
                            )
                else:
                    assign_req.status = "rejected_final"

                db.add(
                    ApprovalRecord(
                        assignment_request_id=assign_req.id,
                        approver_user_id=admin_user_id,
                        approval_level="hospital_admin",
                        decision=dec,
                        comments=req.notes,
                    )
                )

        total_slots = len(reg_req.assignment_requests)
        if approved_count == 0:
            reg_req.status = "rejected"
            if membership:
                membership.status = "rejected"
        else:
            reg_req.status = "approved" if approved_count == total_slots else "partially_approved"
            if membership:
                membership.status = "active"
                membership.employee_uid_verified = reg_req.employee_uid_verified
                membership.verified_by_user_id = admin_user_id
                membership.verified_at = now
            if reg_req.user:
                reg_req.user.is_active = True

        if reg_req.user_id:
            db.add(
                HospitalNotification(
                    id=uuid.uuid4(),
                    hospital_id=hospital_id,
                    recipient_user_id=reg_req.user_id,
                    title=f"Registration {reg_req.status.capitalize()}",
                    message=f"Your registration request has been {reg_req.status} by administrator.",
                    category="approval",
                    is_read=False,
                )
            )

        db.add(
            AuditLog(
                hospital_id=hospital_id,
                user_id=admin_user_id,
                action="ADMIN_REGISTRATION_DECISION",
                resource_type="RegistrationRequest",
                resource_id=str(reg_req.id),
                details=f"Status: {reg_req.status} | Approved slots: {approved_count}/{total_slots} | Verified UID: {req.verify_employee_uid}",
            )
        )
        db.commit()
        db.refresh(reg_req)
        return reg_req
