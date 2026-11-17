import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import get_frontend_base_url, settings
from app.core.exceptions import (
    AccountStatusError,
    CSRFError,
    InvalidCredentialsError,
    InvalidTokenError,
    PasswordReuseError,
    OTPCooldownError,
    OTPExpiredError,
    OTPInvalidError,
    OTPMaxAttemptsError,
    PurchaserAlreadyExistsError,
    PurchaserNotFoundError,
    PurchaserNotVerifiedError,
)
from app.core.security import (
    generate_six_digit_otp,
    get_password_hash,
    hash_otp,
    hash_token,
    verify_otp_hash,
    verify_password,
)
from app.models.purchaser import (
    Purchaser,
    PurchaserEmailChange,
    PurchaserOTPChallenge,
    PurchaserPasswordResetToken,
    PurchaserSession,
)
from app.models.hospital import Hospital
from app.models.admin_invitation import HospitalAdministrator, HospitalAdminInvitation
from app.models.purchaser_subscription import PurchaserSubscription
from app.services.email_service import get_email_service


EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def validate_email_format(email: str) -> str:
    cleaned = email.strip()
    if not EMAIL_REGEX.match(cleaned):
        raise OTPInvalidError("Please provide a valid email address.")
    return cleaned.lower()


def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise OTPInvalidError("Password must be at least 8 characters long.")


def is_development_environment() -> bool:
    return settings.ENVIRONMENT.lower() in ("development", "dev", "test", "testing", "local")


class PurchaserAuthService:
    @classmethod
    def register_purchaser(
        cls,
        db: Session,
        full_name: str,
        email: str,
        password: str,
        confirm_password: str,
    ) -> Dict[str, str]:
        # 1. Validation
        if not full_name or not full_name.strip():
            raise OTPInvalidError("Full legal name is required.")
        if len(full_name.strip()) < 2:
            raise OTPInvalidError("Full legal name must be at least 2 characters.")

        norm_email = validate_email_format(email)
        validate_password_strength(password)

        if password != confirm_password:
            raise OTPInvalidError("Passwords do not match.")

        # 2. Check existing purchaser
        existing = db.execute(
            select(Purchaser).where(Purchaser.email_normalized == norm_email)
        ).scalar_one_or_none()

        if existing:
            if existing.is_email_verified:
                raise PurchaserAlreadyExistsError()
            # If exists but unverified, update name and password and re-issue OTP
            existing.full_name = full_name.strip()
            existing.password_hash = get_password_hash(password)
            purchaser = existing
        else:
            purchaser = Purchaser(
                full_name=full_name.strip(),
                email=email.strip(),
                email_normalized=norm_email,
                password_hash=get_password_hash(password),
                is_email_verified=False,
                account_status="active",
            )
            db.add(purchaser)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                raise PurchaserAlreadyExistsError()

        # 3. Create single-use 6-digit OTP challenge
        # Invalidate any pending unconsumed OTPs for this email
        pending_otps = db.execute(
            select(PurchaserOTPChallenge).where(
                PurchaserOTPChallenge.email == norm_email,
                PurchaserOTPChallenge.consumed_at.is_(None),
            )
        ).scalars().all()
        now = datetime.now(timezone.utc)
        for p in pending_otps:
            p.consumed_at = now

        otp = generate_six_digit_otp()
        salt = secrets.token_hex(16)
        otp_hash_val = hash_otp(otp, salt)

        challenge = PurchaserOTPChallenge(
            purchaser_id=purchaser.id,
            email=norm_email,
            purpose="registration",
            otp_hash=otp_hash_val,
            salt=salt,
            attempts_count=0,
            max_attempts=settings.OTP_MAX_ATTEMPTS,
            expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
            resend_available_at=now + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS),
        )
        db.add(challenge)
        db.commit()

        # 4. Dispatch verification email
        email_svc = get_email_service()
        email_svc.send_otp_email(
            to_email=norm_email,
            hospital_name="Aarogya Enterprise Portal",
            otp=otp,
            expires_minutes=settings.OTP_EXPIRE_MINUTES,
        )

        result: Dict[str, str] = {
            "purchaser_id": str(purchaser.id),
            "email": norm_email,
            "message": f"Verification code dispatched to {norm_email}.",
        }

        # Include dev OTP in response only in explicitly permitted development/test environments
        if is_development_environment() and settings.EMAIL_PROVIDER.lower() == "mock":
            result["dev_otp"] = otp

        return result

    @classmethod
    def verify_email(
        cls,
        db: Session,
        email: str,
        otp: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[Purchaser, str, str]:
        norm_email = validate_email_format(email)
        cleaned_otp = otp.strip()

        now = datetime.now(timezone.utc)
        challenge = db.execute(
            select(PurchaserOTPChallenge)
            .where(
                PurchaserOTPChallenge.email == norm_email,
                PurchaserOTPChallenge.consumed_at.is_(None),
            )
            .order_by(PurchaserOTPChallenge.created_at.desc())
        ).scalars().first()

        if not challenge:
            raise OTPInvalidError(
                "Verification challenge not found or already consumed. Please request a new code."
            )

        if now > to_utc(challenge.expires_at):
            raise OTPExpiredError(
                "Verification code has expired. Please request a fresh code."
            )

        if challenge.attempts_count >= challenge.max_attempts:
            raise OTPMaxAttemptsError(
                "Maximum verification attempts exceeded. Please initiate a new challenge."
            )

        challenge.attempts_count += 1

        if not verify_otp_hash(cleaned_otp, challenge.salt, challenge.otp_hash):
            db.commit()
            remaining = challenge.max_attempts - challenge.attempts_count
            if remaining <= 0:
                raise OTPMaxAttemptsError(
                    "Maximum verification attempts exceeded. Please initiate a new challenge."
                )
            raise OTPInvalidError(
                f"Incorrect verification code. {remaining} attempt(s) remaining."
            )

        # Mark challenge consumed
        challenge.consumed_at = now

        # Activate purchaser account
        purchaser = db.execute(
            select(Purchaser).where(Purchaser.email_normalized == norm_email)
        ).scalar_one()
        purchaser.is_email_verified = True
        purchaser.account_status = "active"
        purchaser.last_login_at = now

        # Create authenticated session upon successful verification
        session_token, csrf_token, _ = cls.create_session(
            db=db,
            purchaser=purchaser,
            remember_device=True,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        db.commit()
        return purchaser, session_token, csrf_token

    @classmethod
    def resend_otp(cls, db: Session, email: str) -> Dict[str, str]:
        norm_email = validate_email_format(email)
        now = datetime.now(timezone.utc)

        challenge = db.execute(
            select(PurchaserOTPChallenge)
            .where(
                PurchaserOTPChallenge.email == norm_email,
                PurchaserOTPChallenge.consumed_at.is_(None),
            )
            .order_by(PurchaserOTPChallenge.created_at.desc())
        ).scalars().first()

        resend_at = to_utc(challenge.resend_available_at) if challenge else None
        if resend_at and now < resend_at:
            seconds_remaining = int((resend_at - now).total_seconds())
            if seconds_remaining > 0:
                raise OTPCooldownError(seconds_remaining)

        # Invalidate existing
        if challenge:
            challenge.consumed_at = now

        purchaser = db.execute(
            select(Purchaser).where(Purchaser.email_normalized == norm_email)
        ).scalar_one_or_none()

        otp = generate_six_digit_otp()
        salt = secrets.token_hex(16)
        otp_hash_val = hash_otp(otp, salt)

        new_challenge = PurchaserOTPChallenge(
            purchaser_id=purchaser.id if purchaser else None,
            email=norm_email,
            purpose="registration",
            otp_hash=otp_hash_val,
            salt=salt,
            attempts_count=0,
            max_attempts=settings.OTP_MAX_ATTEMPTS,
            expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
            resend_available_at=now + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS),
        )
        db.add(new_challenge)
        db.commit()

        email_svc = get_email_service()
        email_svc.send_otp_email(
            to_email=norm_email,
            hospital_name="Aarogya Enterprise Portal",
            otp=otp,
            expires_minutes=settings.OTP_EXPIRE_MINUTES,
        )

        result: Dict[str, str] = {
            "email": norm_email,
            "message": "A fresh verification code has been dispatched.",
        }
        if is_development_environment() and settings.EMAIL_PROVIDER.lower() == "mock":
            result["dev_otp"] = otp
        return result

    @classmethod
    def login_purchaser(
        cls,
        db: Session,
        email: str,
        password: str,
        remember_device: bool = False,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[Purchaser, str, str]:
        norm_email = validate_email_format(email)

        purchaser = db.execute(
            select(Purchaser).where(Purchaser.email_normalized == norm_email)
        ).scalar_one_or_none()

        # Constant-time comparison to prevent timing-based user enumeration
        if not purchaser or not verify_password(password, purchaser.password_hash):
            raise InvalidCredentialsError("Invalid email address or password.")

        if not purchaser.is_email_verified:
            raise PurchaserNotVerifiedError(
                email=norm_email,
                detail="Please verify your email address before logging in.",
            )

        if purchaser.account_status not in ("active", "pending_deletion"):
            raise AccountStatusError(
                status_name=purchaser.account_status,
                message="Your purchaser account is currently suspended or deactivated. Please contact support.",
            )

        now = datetime.now(timezone.utc)
        if purchaser.account_status == "pending_deletion":
            sched_at = to_utc(purchaser.deletion_scheduled_at)
            if sched_at and now > sched_at:
                purchaser.account_status = "deactivated"
                db.commit()
                raise AccountStatusError(
                    status_name="deactivated",
                    message="Your 60-day recovery window has expired. This enterprise account has been permanently decommissioned.",
                )

        purchaser.last_login_at = now

        session_token, csrf_token, _ = cls.create_session(
            db=db,
            purchaser=purchaser,
            remember_device=remember_device,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        db.commit()
        return purchaser, session_token, csrf_token

    @classmethod
    def create_session(
        cls,
        db: Session,
        purchaser: Purchaser,
        remember_device: bool = False,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[str, str, PurchaserSession]:
        raw_token = secrets.token_urlsafe(32)
        token_hash_val = hash_token(raw_token)
        csrf_token = secrets.token_urlsafe(32)

        now = datetime.now(timezone.utc)
        if remember_device:
            expires_at = now + timedelta(days=settings.SESSION_COOKIE_MAX_AGE_DAYS)
        else:
            expires_at = now + timedelta(days=1)

        session_record = PurchaserSession(
            purchaser_id=purchaser.id,
            token_hash=token_hash_val,
            ip_address=ip_address,
            user_agent=user_agent[:255] if user_agent else None,
            remember_device=remember_device,
            last_activity_at=now,
            expires_at=expires_at,
        )
        db.add(session_record)
        return raw_token, csrf_token, session_record

    @classmethod
    def get_purchaser_from_token(
        cls, db: Session, session_token: str
    ) -> Optional[Tuple[Purchaser, PurchaserSession]]:
        if not session_token:
            return None

        token_hash_val = hash_token(session_token)
        now = datetime.now(timezone.utc)

        result = db.execute(
            select(Purchaser, PurchaserSession)
            .join(PurchaserSession, Purchaser.id == PurchaserSession.purchaser_id)
            .where(
                PurchaserSession.token_hash == token_hash_val,
                PurchaserSession.revoked_at.is_(None),
                Purchaser.account_status == "active",
                Purchaser.is_email_verified.is_(True),
            )
        ).first()

        if not result:
            return None

        purchaser, session = result
        if now > to_utc(session.expires_at):
            return None

        session.last_activity_at = now
        db.commit()
        return purchaser, session

    @classmethod
    def logout_session(cls, db: Session, session_token: str) -> None:
        if not session_token:
            return
        token_hash_val = hash_token(session_token)
        session = db.execute(
            select(PurchaserSession).where(
                PurchaserSession.token_hash == token_hash_val,
                PurchaserSession.revoked_at.is_(None),
            )
        ).scalar_one_or_none()

        if session:
            session.revoked_at = datetime.now(timezone.utc)
            db.commit()

    @classmethod
    def list_sessions(cls, db: Session, purchaser_id: uuid.UUID) -> List[PurchaserSession]:
        now = datetime.now(timezone.utc)
        sessions = db.execute(
            select(PurchaserSession)
            .where(
                PurchaserSession.purchaser_id == purchaser_id,
                PurchaserSession.revoked_at.is_(None),
            )
            .order_by(PurchaserSession.created_at.desc())
        ).scalars().all()
        return [s for s in sessions if to_utc(s.expires_at) > now]

    @classmethod
    def revoke_session(
        cls, db: Session, purchaser_id: uuid.UUID, session_id: uuid.UUID
    ) -> bool:
        session = db.execute(
            select(PurchaserSession).where(
                PurchaserSession.id == session_id,
                PurchaserSession.purchaser_id == purchaser_id,
                PurchaserSession.revoked_at.is_(None),
            )
        ).scalar_one_or_none()
        if session:
            session.revoked_at = datetime.now(timezone.utc)
            db.commit()
            return True
        return False

    @classmethod
    def change_password(
        cls,
        db: Session,
        purchaser: Purchaser,
        current_password: str,
        new_password: str,
        confirm_new_password: str,
        current_session_token: Optional[str] = None,
    ) -> None:
        if not verify_password(current_password, purchaser.password_hash):
            raise InvalidCredentialsError("Current password entered is incorrect.")

        validate_password_strength(new_password)
        if new_password != confirm_new_password:
            raise OTPInvalidError("New passwords do not match.")

        purchaser.password_hash = get_password_hash(new_password)

        # Invalidate all other active sessions for security
        now = datetime.now(timezone.utc)
        active_sessions = db.execute(
            select(PurchaserSession).where(
                PurchaserSession.purchaser_id == purchaser.id,
                PurchaserSession.revoked_at.is_(None),
            )
        ).scalars().all()

        current_hash = hash_token(current_session_token) if current_session_token else None
        for s in active_sessions:
            if s.token_hash != current_hash:
                s.revoked_at = now

        db.commit()

    @classmethod
    def request_password_reset(
        cls,
        db: Session,
        email: str,
        request: Optional[Any] = None,
    ) -> Dict[str, str]:
        # Always return generic message to prevent user enumeration
        generic_message = (
            "If an account is associated with this email, a password reset link has been dispatched."
        )
        try:
            norm_email = validate_email_format(email)
        except Exception:
            return {"message": generic_message}

        purchaser = db.execute(
            select(Purchaser).where(
                Purchaser.email_normalized == norm_email,
                Purchaser.account_status == "active",
            )
        ).scalar_one_or_none()

        if not purchaser:
            return {"message": generic_message}

        now = datetime.now(timezone.utc)
        # Invalidate previous unconsumed reset tokens
        prev_tokens = db.execute(
            select(PurchaserPasswordResetToken).where(
                PurchaserPasswordResetToken.purchaser_id == purchaser.id,
                PurchaserPasswordResetToken.consumed_at.is_(None),
            )
        ).scalars().all()
        for t in prev_tokens:
            t.consumed_at = now

        raw_reset_token = secrets.token_urlsafe(32)
        token_hash_val = hash_token(raw_reset_token)

        reset_record = PurchaserPasswordResetToken(
            purchaser_id=purchaser.id,
            token_hash=token_hash_val,
            expires_at=now + timedelta(hours=1),
        )
        db.add(reset_record)
        db.commit()

        frontend_base = get_frontend_base_url(request)
        reset_link = f"{frontend_base}/account/reset-password?token={raw_reset_token}"
        email_svc = get_email_service()
        email_sent = email_svc.send_password_reset_email(
            to_email=norm_email,
            reset_link=reset_link,
            expires_minutes=60,
        )

        result = {"message": generic_message}
        if is_development_environment():
            result["dev_reset_token"] = raw_reset_token
            result["dev_reset_link"] = reset_link
            if not email_sent:
                result["message"] = (
                    f"{generic_message} (Antideploy daily quota reached: 10 emails/day limit. "
                    f"Use the reset link below to test.)"
                )
        return result

    @classmethod
    def complete_password_reset(
        cls,
        db: Session,
        token: str,
        new_password: str,
        confirm_new_password: str,
    ) -> Dict[str, str]:
        if not token or not token.strip():
            raise InvalidTokenError("Reset token is required.")

        validate_password_strength(new_password)
        if new_password != confirm_new_password:
            raise OTPInvalidError("Passwords do not match.")

        token_hash_val = hash_token(token.strip())
        now = datetime.now(timezone.utc)

        record = db.execute(
            select(PurchaserPasswordResetToken).where(
                PurchaserPasswordResetToken.token_hash == token_hash_val,
                PurchaserPasswordResetToken.consumed_at.is_(None),
            )
        ).scalar_one_or_none()

        if not record or now > to_utc(record.expires_at):
            raise InvalidTokenError(
                "Password reset token is invalid or has expired. Please request a new link."
            )

        purchaser = db.execute(
            select(Purchaser).where(Purchaser.id == record.purchaser_id)
        ).scalar_one()

        # Database verification: New password MUST NOT be identical to previous/existing password
        if verify_password(new_password, purchaser.password_hash):
            raise PasswordReuseError(
                "New password cannot be the same as your previous password. Please choose a different password."
            )

        record.consumed_at = now
        purchaser.password_hash = get_password_hash(new_password)

        # Invalidate ALL existing sessions after password reset
        all_sessions = db.execute(
            select(PurchaserSession).where(
                PurchaserSession.purchaser_id == purchaser.id,
                PurchaserSession.revoked_at.is_(None),
            )
        ).scalars().all()
        for s in all_sessions:
            s.revoked_at = now

        db.commit()
        return {"message": "Password has been successfully reset. Please log in with your new password."}

    @classmethod
    def request_email_change(
        cls,
        db: Session,
        purchaser: Purchaser,
        current_password: str,
        new_email: str,
    ) -> Dict[str, str]:
        if not verify_password(current_password, purchaser.password_hash):
            raise InvalidCredentialsError("Current password verification failed.")

        norm_new_email = validate_email_format(new_email)
        if norm_new_email == purchaser.email_normalized:
            raise OTPInvalidError("New email address must be different from your current email.")

        # Check if email is already used by another purchaser
        existing = db.execute(
            select(Purchaser).where(Purchaser.email_normalized == norm_new_email)
        ).scalar_one_or_none()
        if existing:
            raise PurchaserAlreadyExistsError("This email address is already in use by another account.")

        now = datetime.now(timezone.utc)
        # Invalidate older pending email changes for this purchaser
        prev_requests = db.execute(
            select(PurchaserEmailChange).where(
                PurchaserEmailChange.purchaser_id == purchaser.id,
                PurchaserEmailChange.completed_at.is_(None),
            )
        ).scalars().all()
        for r in prev_requests:
            r.completed_at = now

        raw_token = secrets.token_urlsafe(32)
        token_hash_val = hash_token(raw_token)

        change_record = PurchaserEmailChange(
            purchaser_id=purchaser.id,
            current_email=purchaser.email,
            proposed_email=norm_new_email,
            verification_token_hash=token_hash_val,
            expires_at=now + timedelta(hours=24),
        )
        db.add(change_record)
        db.commit()

        email_svc = get_email_service()
        # 1. Send verification link to new email
        email_svc.send_notification_email(
            to_email=norm_new_email,
            subject="Confirm Your New Email Address",
            message=(
                f"Hello,\n\nPlease confirm your request to change your Aarogya purchaser email to {norm_new_email}.\n"
                f"Verification Token: {raw_token}\n\nThis token will expire in 24 hours."
            ),
        )
        # 2. Send security alert to old email
        email_svc.send_notification_email(
            to_email=purchaser.email,
            subject="Security Alert: Email Change Requested",
            message=(
                f"Hello,\n\nA request was initiated to change the email on your Aarogya purchaser account to {norm_new_email}.\n"
                f"If you did not make this request, please change your password immediately."
            ),
        )

        result = {
            "proposed_email": norm_new_email,
            "message": f"Verification link dispatched to {norm_new_email}. A security notice was sent to your current email.",
        }
        if is_development_environment() and settings.EMAIL_PROVIDER.lower() == "mock":
            result["dev_verification_token"] = raw_token
        return result

    @classmethod
    def verify_email_change(cls, db: Session, token: str) -> Dict[str, str]:
        if not token or not token.strip():
            raise InvalidTokenError("Verification token is required.")

        token_hash_val = hash_token(token.strip())
        now = datetime.now(timezone.utc)

        record = db.execute(
            select(PurchaserEmailChange).where(
                PurchaserEmailChange.verification_token_hash == token_hash_val,
                PurchaserEmailChange.completed_at.is_(None),
            )
        ).scalar_one_or_none()

        if not record or now > to_utc(record.expires_at):
            raise InvalidTokenError(
                "Email change verification link is invalid or has expired."
            )

        # Re-check collision
        conflict = db.execute(
            select(Purchaser).where(
                Purchaser.email_normalized == record.proposed_email.lower(),
                Purchaser.id != record.purchaser_id,
            )
        ).scalar_one_or_none()
        if conflict:
            raise PurchaserAlreadyExistsError("Proposed email is no longer available.")

        purchaser = db.execute(
            select(Purchaser).where(Purchaser.id == record.purchaser_id)
        ).scalar_one()

        record.verified_at = now
        record.completed_at = now
        purchaser.email = record.proposed_email
        purchaser.email_normalized = record.proposed_email.lower()

        db.commit()
        return {
            "email": purchaser.email,
            "message": "Your purchaser account email has been successfully updated.",
        }

    @classmethod
    def update_full_name(cls, db: Session, purchaser: Purchaser, full_name: str) -> Purchaser:
        clean_name = full_name.strip()
        if len(clean_name) < 2:
            raise OTPInvalidError("Full legal name must be at least 2 characters.")
        purchaser.full_name = clean_name
        db.commit()
        db.refresh(purchaser)
        return purchaser

    @classmethod
    def request_email_change_otp(
        cls, db: Session, purchaser: Purchaser, new_email: str
    ) -> Dict[str, Any]:
        norm_new_email = validate_email_format(new_email)
        if norm_new_email == purchaser.email_normalized:
            raise OTPInvalidError("New email address must be different from your current email.")

        # Check collision
        existing = db.execute(
            select(Purchaser).where(Purchaser.email_normalized == norm_new_email)
        ).scalar_one_or_none()
        if existing and existing.id != purchaser.id:
            raise PurchaserAlreadyExistsError("This email address is already registered to another account.")

        now = datetime.now(timezone.utc)

        # Invalidate older email change challenges for this purchaser
        prev_challenges = db.execute(
            select(PurchaserOTPChallenge).where(
                PurchaserOTPChallenge.purchaser_id == purchaser.id,
                PurchaserOTPChallenge.purpose == "email_change",
                PurchaserOTPChallenge.consumed_at.is_(None),
            )
        ).scalars().all()
        for c in prev_challenges:
            c.consumed_at = now

        # Also invalidate older records in PurchaserEmailChange
        prev_requests = db.execute(
            select(PurchaserEmailChange).where(
                PurchaserEmailChange.purchaser_id == purchaser.id,
                PurchaserEmailChange.completed_at.is_(None),
            )
        ).scalars().all()
        for r in prev_requests:
            r.completed_at = now

        otp = generate_six_digit_otp()
        salt = secrets.token_hex(16)
        otp_hash_val = hash_otp(otp, salt)

        # Challenge record: email holds CURRENT email where OTP is sent
        challenge = PurchaserOTPChallenge(
            purchaser_id=purchaser.id,
            email=purchaser.email_normalized,
            purpose="email_change",
            otp_hash=otp_hash_val,
            salt=salt,
            attempts_count=0,
            max_attempts=settings.OTP_MAX_ATTEMPTS,
            expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
            resend_available_at=now + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS),
        )
        db.add(challenge)

        # Track proposed email
        email_change_rec = PurchaserEmailChange(
            purchaser_id=purchaser.id,
            current_email=purchaser.email,
            proposed_email=norm_new_email,
            verification_token_hash=hash_token(otp),
            expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
        )
        db.add(email_change_rec)
        db.commit()

        # Dispatch OTP to PREVIOUS (current) email
        email_svc = get_email_service()
        email_svc.send_otp_email(
            to_email=purchaser.email,
            hospital_name="Aarogya Enterprise Portal",
            otp=otp,
            expires_minutes=settings.OTP_EXPIRE_MINUTES,
        )

        res: Dict[str, Any] = {
            "current_email": purchaser.email,
            "proposed_email": norm_new_email,
            "message": f"A single-use 6-digit verification code has been dispatched to your current email address ({purchaser.email}).",
        }
        if is_development_environment():
            res["dev_otp"] = otp
        return res

    @classmethod
    def verify_email_change_otp(
        cls, db: Session, purchaser: Purchaser, new_email: str, otp: str
    ) -> Purchaser:
        norm_new_email = validate_email_format(new_email)
        cleaned_otp = otp.strip()
        now = datetime.now(timezone.utc)

        challenge = db.execute(
            select(PurchaserOTPChallenge).where(
                PurchaserOTPChallenge.purchaser_id == purchaser.id,
                PurchaserOTPChallenge.purpose == "email_change",
                PurchaserOTPChallenge.consumed_at.is_(None),
            ).order_by(PurchaserOTPChallenge.created_at.desc())
        ).scalars().first()

        if not challenge:
            raise OTPInvalidError("Verification challenge not found or already consumed. Please request a new code.")

        if now > to_utc(challenge.expires_at):
            raise OTPExpiredError("Verification code has expired. Please request a fresh code.")

        challenge.attempts_count += 1
        if not verify_otp_hash(cleaned_otp, challenge.salt, challenge.otp_hash):
            db.commit()
            remaining = challenge.max_attempts - challenge.attempts_count
            if remaining <= 0:
                raise OTPMaxAttemptsError("Maximum attempts exceeded. Please initiate a new change request.")
            raise OTPInvalidError(f"Incorrect verification code. {remaining} attempt(s) remaining.")

        challenge.consumed_at = now

        # Update PurchaserEmailChange record
        email_change_rec = db.execute(
            select(PurchaserEmailChange).where(
                PurchaserEmailChange.purchaser_id == purchaser.id,
                PurchaserEmailChange.completed_at.is_(None),
            ).order_by(PurchaserEmailChange.created_at.desc())
        ).scalars().first()
        if email_change_rec:
            email_change_rec.verified_at = now
            email_change_rec.completed_at = now

        # Update purchaser email in DB
        purchaser.email = norm_new_email
        purchaser.email_normalized = norm_new_email.lower()
        db.commit()
        db.refresh(purchaser)

        # Send security confirmation to new email
        email_svc = get_email_service()
        email_svc.send_notification_email(
            to_email=purchaser.email,
            subject="Aarogya: Email Address Updated",
            message=f"Hello {purchaser.full_name},\n\nYour Aarogya Enterprise Portal account email has been successfully updated to {purchaser.email}.",
        )
        return purchaser

    @classmethod
    def schedule_account_deletion(
        cls, db: Session, purchaser: Purchaser, password: str, reason: Optional[str] = None
    ) -> Dict[str, Any]:
        if not verify_password(password, purchaser.password_hash):
            raise InvalidCredentialsError("Incorrect password. Deletion authorization failed.")

        now = datetime.now(timezone.utc)
        scheduled_date = now + timedelta(days=60)

        purchaser.account_status = "pending_deletion"
        purchaser.deletion_scheduled_at = scheduled_date

        # Business rules for subscriptions:
        # Mark all subscriptions of this purchaser as auto_renew=False
        subscriptions = db.execute(
            select(PurchaserSubscription).where(
                PurchaserSubscription.purchaser_id == purchaser.id,
                PurchaserSubscription.status == "ACTIVE",
            )
        ).scalars().all()
        for sub in subscriptions:
            sub.auto_renew = False

        # Gather all hospital facilities and their administrators
        hospitals = db.execute(
            select(Hospital).where(Hospital.purchaser_id == purchaser.id)
        ).scalars().all()

        affected_admin_emails: List[str] = []
        for hosp in hospitals:
            admins = db.execute(
                select(HospitalAdministrator).where(
                    HospitalAdministrator.hospital_id == hosp.id,
                    HospitalAdministrator.status == "active",
                )
            ).scalars().all()
            for admin in admins:
                if admin.user and admin.user.email and admin.user.email not in affected_admin_emails:
                    affected_admin_emails.append(admin.user.email)

            invitations = db.execute(
                select(HospitalAdminInvitation).where(
                    HospitalAdminInvitation.hospital_id == hosp.id,
                    HospitalAdminInvitation.status == "PENDING",
                )
            ).scalars().all()
            for inv in invitations:
                if inv.invitee_email and inv.invitee_email not in affected_admin_emails:
                    affected_admin_emails.append(inv.invitee_email)

        email_svc = get_email_service()
        formatted_date = scheduled_date.strftime("%B %d, %Y")

        # 1. Inform all affected hospital administrators
        for admin_email in affected_admin_emails:
            email_svc.send_notification_email(
                to_email=admin_email,
                subject="URGENT: Enterprise Account Scheduled for Decommissioning",
                message=(
                    f"Notice to Hospital Administrator:\n\n"
                    f"The enterprise purchaser ({purchaser.full_name}) for your hospital facility has initiated an organization account deletion request.\n"
                    f"A 60-day recovery grace period is now in effect. If not cancelled, the enterprise account and its associated hospital licenses will be permanently decommissioned on {formatted_date}.\n\n"
                    f"If this action was taken in error or requires coordination, please contact your institutional purchaser immediately."
                ),
            )

        # 2. Inform purchaser with confirmation and recovery instructions
        email_svc.send_notification_email(
            to_email=purchaser.email,
            subject="Aarogya: Enterprise Account Deletion Scheduled (60-Day Recovery Window)",
            message=(
                f"Hello {purchaser.full_name},\n\n"
                f"Your request to delete your enterprise organization account has been scheduled.\n"
                f"A 60-day recovery window has begun. Your account and all associated hospital systems will be permanently removed on {formatted_date}.\n\n"
                f"RECOVERY INSTRUCTIONS:\n"
                f"You may log into your enterprise account at any time prior to {formatted_date} and click 'Cancel Deletion & Restore Account' to revoke this request with zero service disruption.\n"
                f"All affected hospital administrators have been formally notified."
            ),
        )

        db.commit()
        return {
            "status": "pending_deletion",
            "scheduled_deletion_at": scheduled_date.isoformat(),
            "affected_admins_notified": len(affected_admin_emails),
            "message": f"Account scheduled for permanent deletion on {formatted_date}. A 60-day recovery window is active.",
        }

    @classmethod
    def cancel_account_deletion(cls, db: Session, purchaser: Purchaser) -> Dict[str, Any]:
        if purchaser.account_status != "pending_deletion":
            return {"message": "Account is not pending deletion."}

        purchaser.account_status = "active"
        purchaser.deletion_scheduled_at = None

        # Restore subscriptions auto-renewal
        subscriptions = db.execute(
            select(PurchaserSubscription).where(
                PurchaserSubscription.purchaser_id == purchaser.id,
            )
        ).scalars().all()
        for sub in subscriptions:
            if sub.status == "ACTIVE":
                sub.auto_renew = True

        # Inform hospital administrators that deletion request was cancelled
        hospitals = db.execute(
            select(Hospital).where(Hospital.purchaser_id == purchaser.id)
        ).scalars().all()

        affected_admin_emails: List[str] = []
        for hosp in hospitals:
            admins = db.execute(
                select(HospitalAdministrator).where(
                    HospitalAdministrator.hospital_id == hosp.id,
                    HospitalAdministrator.status == "active",
                )
            ).scalars().all()
            for admin in admins:
                if admin.user and admin.user.email and admin.user.email not in affected_admin_emails:
                    affected_admin_emails.append(admin.user.email)

        email_svc = get_email_service()
        for admin_email in affected_admin_emails:
            email_svc.send_notification_email(
                to_email=admin_email,
                subject="RESOLVED: Enterprise Deletion Request Cancelled",
                message=(
                    f"Notice to Hospital Administrator:\n\n"
                    f"The enterprise purchaser ({purchaser.full_name}) has cancelled the scheduled account deletion request.\n"
                    f"Your hospital facility and administrative permissions remain fully active with zero disruption."
                ),
            )

        db.commit()
        return {
            "status": "active",
            "message": "Account deletion request successfully cancelled. Full enterprise access and subscription standing restored.",
        }
