import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.exceptions import (
    HospitalNotFoundError,
    RegistrationDisabledError,
    OTPCooldownError,
    OTPExpiredError,
    OTPInvalidError,
    OTPMaxAttemptsError,
)
from app.core.security import (
    generate_six_digit_otp,
    hash_otp,
    verify_otp_hash,
    create_access_token,
    decode_token,
)
from app.models.hospital import Hospital
from app.models.verification import EmailVerificationChallenge
from app.services.email_service import get_email_service


def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class VerificationService:
    @classmethod
    def start_verification(
        cls, db: Session, hospital_uid: str, email: str
    ) -> EmailVerificationChallenge:
        # 1. Hospital validation
        hosp = db.execute(
            select(Hospital).where(func.lower(Hospital.hospital_uid) == hospital_uid.strip().lower())
        ).scalar_one_or_none()

        if not hosp or not hosp.is_active:
            raise HospitalNotFoundError("The specified Hospital UID was not found in the HIMS registry.")

        if not hosp.registration_enabled:
            raise RegistrationDisabledError(
                f"Employee self-registration is currently disabled for {hosp.name}. Please contact your hospital administrator."
            )

        clean_email = email.strip().lower()
        now = datetime.now(timezone.utc)

        # 2. Check cooldown on existing recent challenge
        recent_challenge = db.execute(
            select(EmailVerificationChallenge)
            .where(
                EmailVerificationChallenge.hospital_id == hosp.id,
                EmailVerificationChallenge.email == clean_email,
                EmailVerificationChallenge.is_consumed == False,
            )
            .order_by(EmailVerificationChallenge.created_at.desc())
        ).scalars().first()

        if recent_challenge and recent_challenge.resend_available_at:
            resend_at = to_utc(recent_challenge.resend_available_at)
            if resend_at and now < resend_at:
                diff = int((resend_at - now).total_seconds())
                if diff > 0:
                    raise OTPCooldownError(diff)

        # 3. Invalidate previous unconsumed challenges
        if recent_challenge:
            recent_challenge.is_consumed = True

        # 4. Generate new secure 6-digit OTP
        plain_otp = generate_six_digit_otp()
        salt = secrets.token_hex(16)
        hashed = hash_otp(plain_otp, salt)

        challenge = EmailVerificationChallenge(
            hospital_id=hosp.id,
            email=clean_email,
            otp_hash=hashed,
            salt=salt,
            attempts_count=0,
            max_attempts=settings.OTP_MAX_ATTEMPTS,
            expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
            resend_available_at=now + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS),
            is_verified=False,
            is_consumed=False,
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)

        # 5. Dispatch OTP through email service
        email_svc = get_email_service()
        email_svc.send_otp_email(
            to_email=clean_email,
            hospital_name=hosp.name,
            otp=plain_otp,
            expires_minutes=settings.OTP_EXPIRE_MINUTES,
        )

        return challenge

    @classmethod
    def verify_otp(cls, db: Session, challenge_id: str, submitted_otp: str) -> dict:
        try:
            cid = uuid.UUID(challenge_id)
        except ValueError:
            raise OTPInvalidError("Invalid challenge identifier.")

        challenge = db.execute(
            select(EmailVerificationChallenge).where(EmailVerificationChallenge.id == cid)
        ).scalar_one_or_none()

        if not challenge or challenge.is_consumed:
            raise OTPInvalidError("Verification challenge not found or already consumed.")

        now = datetime.now(timezone.utc)
        expires_at = to_utc(challenge.expires_at)
        if expires_at and now > expires_at:
            raise OTPExpiredError()

        if challenge.attempts_count >= challenge.max_attempts:
            raise OTPMaxAttemptsError()

        # Increment attempt counter
        challenge.attempts_count += 1

        is_valid = verify_otp_hash(submitted_otp.strip(), challenge.salt, challenge.otp_hash)
        if not is_valid:
            db.commit()
            remaining = challenge.max_attempts - challenge.attempts_count
            if remaining <= 0:
                raise OTPMaxAttemptsError()
            raise OTPInvalidError(f"Incorrect verification code. {remaining} attempt(s) remaining.")

        # OTP verified! Mark challenge as verified
        challenge.is_verified = True
        jti = secrets.token_hex(16)
        challenge.verification_token_jti = jti
        db.commit()
        db.refresh(challenge)

        # Issue short-lived verification token (15 mins) for Stage 2
        token = create_access_token(
            subject=str(challenge.id),
            extra_claims={
                "type": "registration_verification",
                "hospital_id": str(challenge.hospital_id),
                "email": challenge.email,
                "jti": jti,
            },
            expires_delta=timedelta(minutes=15),
        )

        hosp = db.execute(select(Hospital).where(Hospital.id == challenge.hospital_id)).scalar_one()

        return {
            "verified": True,
            "verification_token": token,
            "hospital_id": str(hosp.id),
            "hospital_uid": hosp.hospital_uid,
            "hospital_name": hosp.name,
            "email": challenge.email,
        }

    @classmethod
    def validate_verification_token(cls, db: Session, token: str) -> EmailVerificationChallenge:
        try:
            payload = decode_token(token)
        except Exception:
            raise OTPInvalidError("Invalid or expired registration verification token. Please verify email again.")

        if payload.get("type") != "registration_verification":
            raise OTPInvalidError("Invalid verification token type.")

        challenge_id = payload.get("sub")
        jti = payload.get("jti")
        try:
            cid = uuid.UUID(challenge_id)
        except (ValueError, TypeError):
            raise OTPInvalidError("Malformed verification challenge identifier.")

        challenge = db.execute(
            select(EmailVerificationChallenge).where(
                EmailVerificationChallenge.id == cid,
                EmailVerificationChallenge.verification_token_jti == jti,
                EmailVerificationChallenge.is_verified == True,
                EmailVerificationChallenge.is_consumed == False,
            )
        ).scalar_one_or_none()

        if not challenge:
            raise OTPInvalidError("Verification challenge has already been used or expired. Please verify email again.")

        return challenge

