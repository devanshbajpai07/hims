import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload
from app.core.config import settings
from app.core.exceptions import (
    AccountStatusError,
    InvalidCredentialsError,
    InvalidTokenError,
    OTPInvalidError,
    PasswordReuseError,
)
from app.core.security import (
    create_access_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.models.admin_invitation import HospitalAdministrator
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.assignment import RoleAssignment
from app.models.session import SessionRecord
from app.models.user import User
from app.models.user_reset_token import UserPasswordResetToken
from app.core.permissions import SYSTEM_ROLE_PERMISSIONS
from app.services.authorization_service import AuthorizationService
from app.services.email_service import get_email_service
from app.schemas.auth import (
    ActiveMembershipInfo,
    AuthSessionData,
    EmployeeAssignmentSummary,
    HospitalWorkspaceOption,
    LoginRequest,
    UserProfile,
)


def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class AuthService:
    @classmethod
    def authenticate_user(
        cls, db: Session, credentials: LoginRequest, ip_address: Optional[str] = None, user_agent: Optional[str] = None
    ) -> Dict:
        raw_ident = credentials.identifier if hasattr(credentials, "identifier") and credentials.identifier else (credentials.username or credentials.username_or_email or credentials.email or "")
        norm_ident = raw_ident.strip().lower()
        if not norm_ident:
            raise InvalidCredentialsError()

        # 1. Locate global user identity by normalized username or registered email
        user = db.execute(
            select(User).where(
                or_(
                    func.lower(User.username) == norm_ident,
                    func.lower(User.email) == norm_ident,
                )
            )
        ).scalar_one_or_none()

        if not user:
            raise InvalidCredentialsError()

        # 2. Verify password hash using Argon2
        if not verify_password(credentials.password, user.password_hash):
            raise InvalidCredentialsError()

        # 3. Retrieve hospital memberships
        memberships = db.execute(
            select(TenantMembership)
            .options(
                joinedload(TenantMembership.hospital),
                joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.role),
                joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.department),
            )
            .where(TenantMembership.user_id == user.id)
        ).unique().scalars().all()

        if not memberships:
            raise AccountStatusError(
                "no_membership",
                "Your account does not currently belong to any hospital workspace.",
            )

        # 4. Check for single membership status
        if len(memberships) == 1:
            mem = memberships[0]
            cls._assert_membership_active(mem)

            session_data = cls._create_session(
                db, user, mem, credentials.remember_me, ip_address, user_agent
            )
            return {
                "session": session_data,
                "requires_workspace_selection": False,
                "available_memberships": [],
                "message": "Authentication successful.",
            }

        # 5. Handle multiple memberships (workspace selection)
        active_memberships = [m for m in memberships if m.status == "active"]
        
        # If no memberships are active
        if not active_memberships:
            # Report status of first membership (e.g. pending/suspended)
            cls._assert_membership_active(memberships[0])

        # If exactly one active membership exists among multiples
        if len(active_memberships) == 1:
            mem = active_memberships[0]
            session_data = cls._create_session(
                db, user, mem, credentials.remember_me, ip_address, user_agent
            )
            return {
                "session": session_data,
                "requires_workspace_selection": False,
                "available_memberships": [],
                "message": "Authentication successful.",
            }

        # Multiple active hospital workspaces available
        options: List[HospitalWorkspaceOption] = []
        for m in active_memberships:
            first_assign = m.role_assignments[0] if m.role_assignments else None
            role_name = first_assign.role.name if first_assign else "Staff Member"
            role_code = first_assign.role.code if first_assign else "staff"
            dept_name = first_assign.department.name if first_assign and first_assign.department else None

            options.append(
                HospitalWorkspaceOption(
                    hospital_id=str(m.hospital_id),
                    hospital_uid=m.hospital.hospital_uid,
                    hospital_name=m.hospital.name,
                    role_name=role_name,
                    role_code=role_code,
                    department_name=dept_name,
                )
            )

        return {
            "session": None,
            "requires_workspace_selection": True,
            "user_id": str(user.id),
            "available_memberships": options,
            "message": "Please select a hospital workspace to continue.",
        }

    @classmethod
    def select_workspace(
        cls,
        db: Session,
        user_id: str,
        hospital_id: str,
        remember_me: bool = False,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuthSessionData:
        u_uuid = uuid.UUID(user_id)
        h_uuid = uuid.UUID(hospital_id)

        user = db.execute(select(User).where(User.id == u_uuid)).scalar_one_or_none()
        if not user:
            raise InvalidCredentialsError()

        mem = db.execute(
            select(TenantMembership)
            .options(
                joinedload(TenantMembership.hospital),
                joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.role),
                joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.department),
            )
            .where(TenantMembership.user_id == u_uuid, TenantMembership.hospital_id == h_uuid)
        ).unique().scalar_one_or_none()

        if not mem:
            raise AccountStatusError("not_found", "You do not have a membership at the selected hospital.")

        cls._assert_membership_active(mem)

        return cls._create_session(db, user, mem, remember_me, ip_address, user_agent)

    @classmethod
    def _assert_membership_active(cls, mem: TenantMembership):
        if mem.status == "pending":
            raise AccountStatusError(
                "pending",
                "Your account registration is awaiting Department Head review and Administrator sign-off.",
            )
        if mem.status == "suspended":
            raise AccountStatusError(
                "suspended",
                "Your hospital access has been suspended. Please contact your Hospital Administrator.",
            )
        if mem.status == "terminated":
            raise AccountStatusError(
                "terminated",
                "Your hospital account has been terminated.",
            )
        if mem.status != "active":
            raise AccountStatusError(
                mem.status,
                f"Access denied: account status is '{mem.status}'.",
            )

    @classmethod
    def _create_session(
        cls,
        db: Session,
        user: User,
        mem: TenantMembership,
        remember_me: bool,
        ip_address: Optional[str],
        user_agent: Optional[str],
    ) -> AuthSessionData:
        # Determine duration
        days = settings.SESSION_COOKIE_MAX_AGE_DAYS if remember_me else 1
        expires_delta = timedelta(days=days)
        now = datetime.now(timezone.utc)
        expires_at = now + expires_delta

        # Identify active assignments
        active_assignments = [
            a for a in mem.role_assignments if a.is_active and a.assignment_status == "active"
        ]
        if not active_assignments and mem.role_assignments:
            active_assignments = [mem.role_assignments[0]]

        assignments_summary: List[EmployeeAssignmentSummary] = []
        for a in active_assignments:
            rcode = a.role.code if a.role else "staff"
            rname = a.role.name if a.role else "Staff"
            dname = a.department.name if a.department else "Hospital-Wide"
            perms = list(AuthorizationService.get_effective_permissions_set(db, mem.id, a.department_id))
            assignments_summary.append(
                EmployeeAssignmentSummary(
                    id=str(a.id),
                    role_id=str(a.role_id),
                    role_code=rcode,
                    role_name=rname,
                    department_id=str(a.department_id) if a.department_id else None,
                    department_name=dname,
                    scope_type=a.scope_type,
                    permissions=perms,
                    is_active=a.is_active,
                )
            )

        # Primary active assignment
        first_assign = active_assignments[0] if active_assignments else None
        role_code = first_assign.role.code if first_assign and first_assign.role else "doctor"
        role_name = first_assign.role.name if first_assign and first_assign.role else "Doctor"
        dept_name = first_assign.department.name if first_assign and first_assign.department else "Hospital-Wide"
        active_assign_id = str(first_assign.id) if first_assign else None
        effective_perms = assignments_summary[0].permissions if assignments_summary else []

        # Generate JWT token
        token_claims = {
            "hospital_id": str(mem.hospital_id),
            "hospital_uid": mem.hospital.hospital_uid,
            "membership_id": str(mem.id),
            "assignment_id": active_assign_id,
            "role": role_code,
            "department": dept_name,
            "remember_me": remember_me,
        }
        token = create_access_token(
            subject=str(user.id),
            extra_claims=token_claims,
            expires_delta=expires_delta,
        )

        # Store session record in DB
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        session_rec = SessionRecord(
            user_id=user.id,
            hospital_id=mem.hospital_id,
            token_hash=token_hash,
            remember_me=remember_me,
            expires_at=expires_at,
            is_revoked=False,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(session_rec)
        db.commit()

        return AuthSessionData(
            user=UserProfile(
                id=str(user.id),
                username=user.username,
                email=user.email,
                full_name=user.full_name,
            ),
            active_membership=ActiveMembershipInfo(
                id=str(mem.id),
                hospital_id=str(mem.hospital_id),
                hospital_uid=mem.hospital.hospital_uid,
                hospital_name=mem.hospital.name,
                employee_uid=mem.employee_uid,
                role=role_code,
                role_name=role_name,
                department=dept_name,
                status=mem.status,
                active_assignment_id=active_assign_id,
                assignments=assignments_summary,
                effective_permissions=effective_perms,
            ),
            access_token=token,
            token_type="bearer",
        )

    @classmethod
    def request_password_reset(cls, db: Session, identifier: str) -> Dict[str, Any]:
        generic_message = (
            "If an account with that username or email exists in our system, "
            "password reset instructions have been dispatched to the registered email address."
        )
        if not identifier or not identifier.strip():
            return {"success": True, "message": generic_message}

        norm_id = identifier.strip().lower()

        # Locate user by normalized username or email
        user = db.execute(
            select(User).where(
                (func.lower(User.username) == norm_id) | (func.lower(User.email) == norm_id)
            )
        ).scalar_one_or_none()

        if not user or not user.is_active or not user.email:
            return {"success": True, "message": generic_message}

        # Check if user has an active HospitalAdministrator role
        is_admin = db.execute(
            select(HospitalAdministrator).where(
                HospitalAdministrator.user_id == user.id,
                HospitalAdministrator.status == "active",
            )
        ).first() is not None

        now = datetime.now(timezone.utc)

        # Invalidate prior unconsumed reset tokens for this user
        prev_tokens = db.execute(
            select(UserPasswordResetToken).where(
                UserPasswordResetToken.user_id == user.id,
                UserPasswordResetToken.consumed_at.is_(None),
            )
        ).scalars().all()
        for t in prev_tokens:
            t.consumed_at = now

        # Generate cryptographic single-use reset token
        raw_reset_token = secrets.token_urlsafe(32)
        token_hash_val = hash_token(raw_reset_token)

        reset_record = UserPasswordResetToken(
            user_id=user.id,
            token_hash=token_hash_val,
            expires_at=now + timedelta(hours=1),
        )
        db.add(reset_record)
        db.commit()

        # Choose portal route: admin vs employee
        route = "/admin/reset-password" if is_admin else "/reset-password"
        reset_link = f"{settings.FRONTEND_URL}{route}?token={raw_reset_token}"

        email_svc = get_email_service()
        email_sent = email_svc.send_password_reset_email(
            to_email=user.email,
            reset_link=reset_link,
            expires_minutes=60,
        )

        result = {"success": True, "message": generic_message}
        return result

    @classmethod
    def complete_password_reset(
        cls,
        db: Session,
        token: str,
        new_password: str,
        confirm_password: str,
    ) -> Dict[str, Any]:
        if not token or not token.strip():
            raise InvalidTokenError("Reset token is required.")

        if len(new_password) < 8:
            raise OTPInvalidError("Password must be at least 8 characters long.")

        if new_password != confirm_password:
            raise OTPInvalidError("Passwords do not match.")

        token_hash_val = hash_token(token.strip())
        now = datetime.now(timezone.utc)

        record = db.execute(
            select(UserPasswordResetToken).where(
                UserPasswordResetToken.token_hash == token_hash_val,
                UserPasswordResetToken.consumed_at.is_(None),
            )
        ).scalar_one_or_none()

        if not record or now > to_utc(record.expires_at):
            raise InvalidTokenError(
                "Password reset token is invalid or has expired. Please request a new link."
            )

        user = db.execute(
            select(User).where(User.id == record.user_id)
        ).scalar_one()

        # Database verification: New password MUST NOT be identical to previous/existing password
        if verify_password(new_password, user.password_hash):
            raise PasswordReuseError(
                "New password cannot be the same as your previous password. Please choose a different password."
            )

        record.consumed_at = now
        user.password_hash = get_password_hash(new_password)

        # Invalidate all existing sessions
        sessions = db.execute(
            select(SessionRecord).where(
                SessionRecord.user_id == user.id,
                SessionRecord.is_revoked.is_(False),
            )
        ).scalars().all()
        for s in sessions:
            s.is_revoked = True

        db.commit()
        return {
            "success": True,
            "message": "Password has been successfully reset. Please log in with your new password.",
        }

    @classmethod
    def revoke_session(cls, db: Session, token: str) -> bool:
        """Cryptographically marks the session as revoked in PostgreSQL / SQLite."""
        try:
            t_hash = hash_token(token)
            session = (
                db.query(SessionRecord)
                .filter(SessionRecord.token_hash == t_hash)
                .first()
            )
            if session:
                session.is_revoked = True
                db.commit()
                return True
        except Exception:
            db.rollback()
        return False

