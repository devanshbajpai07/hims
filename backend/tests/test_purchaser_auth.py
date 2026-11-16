import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.exceptions import PurchaserAlreadyExistsError
from app.models.purchaser import (
    Purchaser,
    PurchaserEmailChange,
    PurchaserOTPChallenge,
    PurchaserPasswordResetToken,
    PurchaserSession,
)
from app.services.email_service import MockEmailService
from app.services.purchaser_auth_service import PurchaserAuthService


def unique_email(prefix="purchaser"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@hospitalgroup.org"


def register_and_get_otp(client: TestClient, email_mock: MockEmailService, email: str, password="Password@123", name="Dr. Marcus Vance"):
    res = client.post(
        "/api/v1/purchaser/auth/register",
        json={
            "full_name": name,
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )
    assert res.status_code == 201
    otp = email_mock.get_last_otp(email)
    assert otp is not None
    assert len(otp) == 6
    return otp


# -----------------------------------------------------------------------------
# 1. Registration, Duplicate Email & Normalization Tests
# -----------------------------------------------------------------------------

def test_purchaser_successful_registration(client: TestClient, email_mock: MockEmailService):
    email = unique_email("register")
    res = client.post(
        "/api/v1/purchaser/auth/register",
        json={
            "full_name": "Dr. Marcus Vance",
            "email": email,
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert "purchaser_id" in data
    assert data["email"] == email.lower()
    assert email_mock.get_last_otp(email) is not None


def test_purchaser_duplicate_email_rejected(client: TestClient, email_mock: MockEmailService):
    email = unique_email("duplicate")
    otp = register_and_get_otp(client, email_mock, email)

    # Verify to mark account as verified
    verify_res = client.post(
        "/api/v1/purchaser/auth/verify-email",
        json={"email": email, "otp": otp},
    )
    assert verify_res.status_code == 200

    # Attempt second registration with same email
    res2 = client.post(
        "/api/v1/purchaser/auth/register",
        json={
            "full_name": "Another Name",
            "email": email,
            "password": "Password@456",
            "confirm_password": "Password@456",
        },
    )
    assert res2.status_code == 409
    assert res2.json()["code"] == "PURCHASER_ALREADY_EXISTS"


def test_purchaser_email_normalization(client: TestClient, email_mock: MockEmailService, db: Session):
    raw_email = f"  Marcus.{uuid.uuid4().hex[:6]}@HealthGroup.ORG  "
    norm_expected = raw_email.strip().lower()

    res = client.post(
        "/api/v1/purchaser/auth/register",
        json={
            "full_name": "Dr. Marcus Vance",
            "email": raw_email,
            "password": "Password@123",
            "confirm_password": "Password@123",
        },
    )
    assert res.status_code == 201
    assert res.json()["email"] == norm_expected

    purchaser = db.execute(
        select(Purchaser).where(Purchaser.email_normalized == norm_expected)
    ).scalar_one_or_none()
    assert purchaser is not None
    assert purchaser.email_normalized == norm_expected


def test_purchaser_concurrent_duplicate_registration(db: Session):
    email = unique_email("concurrent")
    PurchaserAuthService.register_purchaser(
        db, "First User", email, "Password@123", "Password@123"
    )
    # Mark verified
    p = db.execute(select(Purchaser).where(Purchaser.email_normalized == email.lower())).scalar_one()
    p.is_email_verified = True
    db.commit()

    # Second call should raise PurchaserAlreadyExistsError
    with pytest.raises(PurchaserAlreadyExistsError):
        PurchaserAuthService.register_purchaser(
            db, "Second User", email, "Password@123", "Password@123"
        )


# -----------------------------------------------------------------------------
# 2. OTP Verification, Attempt Limits, Expiry & Cooldown Tests
# -----------------------------------------------------------------------------

def test_purchaser_otp_success(client: TestClient, email_mock: MockEmailService):
    email = unique_email("otpsuccess")
    otp = register_and_get_otp(client, email_mock, email)

    res = client.post(
        "/api/v1/purchaser/auth/verify-email",
        json={"email": email, "otp": otp},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["purchaser"]["email"] == email.lower()
    assert data["purchaser"]["is_email_verified"] is True
    assert "csrf_token" in data
    # Verify auth cookie was set
    assert "hims_purchaser_session" in client.cookies


def test_purchaser_incorrect_otp_rejected(client: TestClient, email_mock: MockEmailService):
    email = unique_email("wrongotp")
    register_and_get_otp(client, email_mock, email)

    res = client.post(
        "/api/v1/purchaser/auth/verify-email",
        json={"email": email, "otp": "000000"},
    )
    assert res.status_code == 400
    assert res.json()["code"] == "OTP_INVALID"


def test_purchaser_expired_otp_rejected(client: TestClient, email_mock: MockEmailService, db: Session):
    email = unique_email("expiredotp")
    otp = register_and_get_otp(client, email_mock, email)

    # Manually expire challenge in DB
    challenge = db.execute(
        select(PurchaserOTPChallenge).where(PurchaserOTPChallenge.email == email.lower())
    ).scalar_one()
    challenge.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db.commit()

    res = client.post(
        "/api/v1/purchaser/auth/verify-email",
        json={"email": email, "otp": otp},
    )
    assert res.status_code == 400
    assert res.json()["code"] == "OTP_EXPIRED"


def test_purchaser_reused_otp_rejected(client: TestClient, email_mock: MockEmailService):
    email = unique_email("reusedotp")
    otp = register_and_get_otp(client, email_mock, email)

    # First verification succeeds
    res1 = client.post(
        "/api/v1/purchaser/auth/verify-email",
        json={"email": email, "otp": otp},
    )
    assert res1.status_code == 200

    # Second verification with same OTP is rejected
    res2 = client.post(
        "/api/v1/purchaser/auth/verify-email",
        json={"email": email, "otp": otp},
    )
    assert res2.status_code == 400
    assert res2.json()["code"] == "OTP_INVALID"


def test_purchaser_otp_attempt_limit_exceeded(client: TestClient, email_mock: MockEmailService):
    email = unique_email("attempts")
    register_and_get_otp(client, email_mock, email)

    for i in range(5):
        res = client.post(
            "/api/v1/purchaser/auth/verify-email",
            json={"email": email, "otp": "999999"},
        )
        if i < 4:
            assert res.status_code == 400
        else:
            assert res.status_code == 429
            assert res.json()["code"] == "OTP_MAX_ATTEMPTS_EXCEEDED"


def test_purchaser_resend_otp_cooldown(client: TestClient, email_mock: MockEmailService):
    email = unique_email("cooldown")
    register_and_get_otp(client, email_mock, email)

    # Immediate resend attempt should hit 60s cooldown limit
    res = client.post(
        "/api/v1/purchaser/auth/resend-otp",
        json={"email": email},
    )
    assert res.status_code == 429
    assert res.json()["code"] == "OTP_COOLDOWN_ACTIVE"


# -----------------------------------------------------------------------------
# 3. Login, Unverified Account & Password Tests
# -----------------------------------------------------------------------------

def test_purchaser_unverified_account_denied_login(client: TestClient, email_mock: MockEmailService):
    email = unique_email("unverified")
    register_and_get_otp(client, email_mock, email, password="Password@123")

    # Attempt login without verifying OTP
    res = client.post(
        "/api/v1/purchaser/auth/login",
        json={"email": email, "password": "Password@123"},
    )
    assert res.status_code == 403
    assert res.json()["code"] == "PURCHASER_EMAIL_UNVERIFIED"


def test_purchaser_login_success(client: TestClient, email_mock: MockEmailService):
    email = unique_email("loginsuccess")
    otp = register_and_get_otp(client, email_mock, email, password="Password@123")
    client.post("/api/v1/purchaser/auth/verify-email", json={"email": email, "otp": otp})

    # Clear cookies to simulate fresh login
    client.cookies.clear()

    res = client.post(
        "/api/v1/purchaser/auth/login",
        json={"email": email, "password": "Password@123", "remember_device": True},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["purchaser"]["email"] == email.lower()
    assert "hims_purchaser_session" in client.cookies


def test_purchaser_login_invalid_password(client: TestClient, email_mock: MockEmailService):
    email = unique_email("invalidpw")
    otp = register_and_get_otp(client, email_mock, email, password="Password@123")
    client.post("/api/v1/purchaser/auth/verify-email", json={"email": email, "otp": otp})

    client.cookies.clear()
    res = client.post(
        "/api/v1/purchaser/auth/login",
        json={"email": email, "password": "WrongPassword999!"},
    )
    assert res.status_code == 401
    assert res.json()["code"] == "INVALID_CREDENTIALS"


# -----------------------------------------------------------------------------
# 4. Session Expiry, Revocation & Remember Device Tests
# -----------------------------------------------------------------------------

def test_purchaser_session_expiry(client: TestClient, email_mock: MockEmailService, db: Session):
    email = unique_email("sessionexp")
    otp = register_and_get_otp(client, email_mock, email)
    client.post("/api/v1/purchaser/auth/verify-email", json={"email": email, "otp": otp})

    # Manually expire the session in DB
    purchaser = db.execute(select(Purchaser).where(Purchaser.email_normalized == email.lower())).scalar_one()
    session = db.execute(
        select(PurchaserSession).where(PurchaserSession.purchaser_id == purchaser.id)
    ).scalars().first()
    session.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db.commit()

    # Access /me endpoint with expired session
    res = client.get("/api/v1/purchaser/auth/me")
    assert res.status_code == 401


def test_purchaser_session_revocation(client: TestClient, email_mock: MockEmailService):
    email = unique_email("sessionrevoke")
    otp = register_and_get_otp(client, email_mock, email)
    verify_res = client.post("/api/v1/purchaser/auth/verify-email", json={"email": email, "otp": otp})
    csrf_token = verify_res.json()["csrf_token"]

    # Profile works
    res_me = client.get("/api/v1/purchaser/auth/me")
    assert res_me.status_code == 200

    # Logout
    logout_res = client.post(
        "/api/v1/purchaser/auth/logout",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert logout_res.status_code == 200

    # Subsequent request fails
    res_me_after = client.get("/api/v1/purchaser/auth/me")
    assert res_me_after.status_code == 401


def test_purchaser_remember_device_expiry(client: TestClient, email_mock: MockEmailService, db: Session):
    email = unique_email("remember")
    otp = register_and_get_otp(client, email_mock, email, password="Password@123")
    client.post("/api/v1/purchaser/auth/verify-email", json={"email": email, "otp": otp})

    client.cookies.clear()
    # Login with remember_device = True
    client.post(
        "/api/v1/purchaser/auth/login",
        json={"email": email, "password": "Password@123", "remember_device": True},
    )

    purchaser = db.execute(select(Purchaser).where(Purchaser.email_normalized == email.lower())).scalar_one()
    session = db.execute(
        select(PurchaserSession)
        .where(PurchaserSession.purchaser_id == purchaser.id, PurchaserSession.remember_device.is_(True))
        .order_by(PurchaserSession.created_at.desc())
    ).scalars().first()

    assert session is not None
    expiry = session.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    days_left = (expiry - datetime.now(timezone.utc)).total_seconds() / 86400
    assert 28 < days_left <= 31


# -----------------------------------------------------------------------------
# 5. Password Change & Forgot/Reset Password Tests
# -----------------------------------------------------------------------------

def test_purchaser_change_password(client: TestClient, email_mock: MockEmailService):
    email = unique_email("changepw")
    otp = register_and_get_otp(client, email_mock, email, password="OldPassword123!")
    verify_res = client.post("/api/v1/purchaser/auth/verify-email", json={"email": email, "otp": otp})
    csrf_token = verify_res.json()["csrf_token"]

    # Change password
    res = client.post(
        "/api/v1/purchaser/auth/change-password",
        json={
            "current_password": "OldPassword123!",
            "new_password": "NewPassword456!",
            "confirm_new_password": "NewPassword456!",
        },
        headers={"X-CSRF-Token": csrf_token},
    )
    assert res.status_code == 200

    # Old password fails login
    client.cookies.clear()
    login_old = client.post(
        "/api/v1/purchaser/auth/login",
        json={"email": email, "password": "OldPassword123!"},
    )
    assert login_old.status_code == 401

    # New password succeeds
    login_new = client.post(
        "/api/v1/purchaser/auth/login",
        json={"email": email, "password": "NewPassword456!"},
    )
    assert login_new.status_code == 200


def test_purchaser_forgot_and_reset_password(client: TestClient, email_mock: MockEmailService):
    email = unique_email("resetpw")
    otp = register_and_get_otp(client, email_mock, email, password="OriginalPassword1!")
    client.post("/api/v1/purchaser/auth/verify-email", json={"email": email, "otp": otp})

    client.cookies.clear()
    # Forgot password request
    res = client.post(
        "/api/v1/purchaser/auth/forgot-password",
        json={"email": email},
    )
    assert res.status_code == 200
    data = res.json()
    assert "dev_reset_token" in data
    raw_token = data["dev_reset_token"]

    # Complete password reset
    reset_res = client.post(
        "/api/v1/purchaser/auth/reset-password",
        json={
            "token": raw_token,
            "new_password": "BrandNewPassword2026!",
            "confirm_new_password": "BrandNewPassword2026!",
        },
    )
    assert reset_res.status_code == 200

    # Login with reset password
    login_res = client.post(
        "/api/v1/purchaser/auth/login",
        json={"email": email, "password": "BrandNewPassword2026!"},
    )
    assert login_res.status_code == 200


# -----------------------------------------------------------------------------
# 6. Email Change Workflow Tests
# -----------------------------------------------------------------------------

def test_purchaser_email_change_workflow(client: TestClient, email_mock: MockEmailService):
    email = unique_email("emailchange_old")
    new_email = unique_email("emailchange_new")
    otp = register_and_get_otp(client, email_mock, email, password="Password@123")
    verify_res = client.post("/api/v1/purchaser/auth/verify-email", json={"email": email, "otp": otp})
    csrf_token = verify_res.json()["csrf_token"]

    # Request email change
    req_res = client.post(
        "/api/v1/purchaser/auth/change-email/request",
        json={"current_password": "Password@123", "new_email": new_email},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert req_res.status_code == 200
    token = req_res.json().get("dev_verification_token")
    assert token is not None

    # Verify and complete email change
    complete_res = client.post(
        "/api/v1/purchaser/auth/change-email/verify",
        json={"token": token},
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["email"] == new_email.lower()

    # Login with new email succeeds
    client.cookies.clear()
    login_new = client.post(
        "/api/v1/purchaser/auth/login",
        json={"email": new_email, "password": "Password@123"},
    )
    assert login_new.status_code == 200
