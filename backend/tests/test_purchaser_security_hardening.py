from datetime import datetime, timedelta, timezone
import logging
import uuid
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import Settings, settings
from app.db.seed import seed_database
from app.models.purchaser import Purchaser, PurchaserSession
from app.services.email_service import MockEmailService, get_email_service, mock_email_service


def unique_email(prefix="harden"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@hospitalgroup.org"


def register_and_get_otp(client: TestClient, email_mock: MockEmailService, email: str, password="Password@123"):
    res = client.post(
        "/api/v1/purchaser/auth/register",
        json={
            "full_name": "Security Test User",
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )
    assert res.status_code == 201
    otp = email_mock.get_last_otp(email)
    assert otp is not None
    return otp


# -----------------------------------------------------------------------------
# 1 & 2: Production-Safe Demo Seeding
# -----------------------------------------------------------------------------

def test_demo_purchaser_not_seeded_in_production(db: Session, monkeypatch):
    """Proves demo purchaser is never created when ENVIRONMENT is production."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    # Clean demo purchaser if previously present
    db.execute(
        delete(Purchaser).where(Purchaser.email_normalized == "purchaser@healthgroup.org")
    )
    db.commit()

    # Run seed in production environment
    seed_database(db)

    # Verify demo purchaser was NOT created
    demo = db.execute(
        select(Purchaser).where(Purchaser.email_normalized == "purchaser@healthgroup.org")
    ).scalar_one_or_none()
    assert demo is None, "Demo purchaser must not be created in production!"


def test_demo_purchaser_eliminated_in_development(db: Session, monkeypatch):
    """Proves demo purchaser is eliminated in development runtime per Phase 2.2."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    # Run seed in development environment
    seed_database(db)

    # Verify demo purchaser was NOT created
    demo = db.execute(
        select(Purchaser).where(Purchaser.email_normalized == "purchaser@healthgroup.org")
    ).scalar_one_or_none()
    assert demo is None, "Demo purchaser must be eliminated across development and production!"


# -----------------------------------------------------------------------------
# 3 & 4: OTP and Token Exposure in Production & Configuration Fail-Closed
# -----------------------------------------------------------------------------

def test_production_never_returns_dev_otp_or_reset_token(client: TestClient, monkeypatch, email_mock: MockEmailService):
    """Proves production never returns dev_otp or dev_reset_token even if mock email is configured."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "mock")
    # Provide mock email delivery adapter so endpoint does not fail on transport
    monkeypatch.setattr("app.services.purchaser_auth_service.get_email_service", lambda: email_mock)

    email = unique_email("prod_no_leak")

    # Register
    reg_res = client.post(
        "/api/v1/purchaser/auth/register",
        json={
            "full_name": "Production User",
            "email": email,
            "password": "Password@123",
            "confirm_password": "Password@123",
        },
    )
    assert reg_res.status_code == 201
    assert "dev_otp" not in reg_res.json(), "dev_otp must not be in production response!"

    # Resend OTP
    resend_res = client.post(
        "/api/v1/purchaser/auth/resend-otp",
        json={"email": email},
    )
    if resend_res.status_code == 200:
        assert "dev_otp" not in resend_res.json(), "dev_otp must not be in production resend response!"

    # Request password reset
    reset_req = client.post(
        "/api/v1/purchaser/auth/forgot-password",
        json={"email": email},
    )
    assert reset_req.status_code == 200
    assert "dev_reset_token" not in reset_req.json(), "dev_reset_token must not be in production response!"


def test_production_startup_rejects_mock_email():
    """Proves production startup/configuration rejects mock email delivery with clear error."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            EMAIL_PROVIDER="mock",
            DATABASE_URL="sqlite:///./test_dummy.db",
        )
    assert "Production environment cannot use mock email provider" in str(exc_info.value)


def test_production_get_email_service_fails_closed(monkeypatch):
    """Proves get_email_service fails closed if production tries to use mock email."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "mock")

    with pytest.raises(RuntimeError) as exc_info:
        get_email_service()
    assert "Production environment cannot use mock email provider" in str(exc_info.value)


# -----------------------------------------------------------------------------
# 5: Development Workflow Preservation
# -----------------------------------------------------------------------------

def test_development_otp_testing_remains_functional(client: TestClient, monkeypatch, email_mock: MockEmailService):
    """Proves local/dev testing continues to receive dev_otp for frictionless testing."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "testing")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "mock")

    email = unique_email("dev_flow")
    reg_res = client.post(
        "/api/v1/purchaser/auth/register",
        json={
            "full_name": "Dev Flow User",
            "email": email,
            "password": "Password@123",
            "confirm_password": "Password@123",
        },
    )
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert "dev_otp" in data
    dev_otp = data["dev_otp"]

    # Verify using dev_otp
    verify_res = client.post(
        "/api/v1/purchaser/auth/verify-email",
        json={"email": email, "otp": dev_otp},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["purchaser"]["is_email_verified"] is True


# -----------------------------------------------------------------------------
# 6: Production Secret Sanitization in Logs
# -----------------------------------------------------------------------------

def test_production_logs_do_not_expose_plaintext_secrets(caplog, monkeypatch):
    """Proves mock email service suppresses plaintext OTP and reset token logging when non-dev."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    with caplog.at_level(logging.INFO):
        mock_email_service.send_otp_email(
            to_email="victim@hospital.org",
            hospital_name="AURA Staging",
            otp="987654",
            expires_minutes=10,
        )
        mock_email_service.send_password_reset_email(
            to_email="victim@hospital.org",
            reset_link="https://aura.health/reset?token=secrettoken999",
            expires_minutes=60,
        )

    log_content = caplog.text
    assert "987654" not in log_content, "Plaintext OTP must not be logged in production!"
    assert "secrettoken999" not in log_content, "Plaintext reset token must not be logged in production!"
    assert "suppressed" in log_content.lower()


# -----------------------------------------------------------------------------
# 7, 8, 9 & 10: Logout CSRF Protection & Session Revocation
# -----------------------------------------------------------------------------

def test_logout_rejects_missing_csrf_token(client: TestClient, email_mock: MockEmailService):
    """Proves logout rejects cookie-authenticated requests when X-CSRF-Token header is missing."""
    email = unique_email("logout_nocsrf")
    otp = register_and_get_otp(client, email_mock, email)
    verify_res = client.post("/api/v1/purchaser/auth/verify-email", json={"email": email, "otp": otp})
    assert verify_res.status_code == 200
    assert "hims_purchaser_session" in client.cookies

    # POST /logout without X-CSRF-Token header
    res = client.post("/api/v1/purchaser/auth/logout")
    assert res.status_code == 403
    assert res.json()["code"] == "CSRF_FAILED"
    assert "CSRF verification token mismatch" in res.json()["detail"]


def test_logout_rejects_mismatched_csrf_token(client: TestClient, email_mock: MockEmailService):
    """Proves logout rejects cookie-authenticated requests with mismatched CSRF token."""
    email = unique_email("logout_badcsrf")
    otp = register_and_get_otp(client, email_mock, email)
    verify_res = client.post("/api/v1/purchaser/auth/verify-email", json={"email": email, "otp": otp})
    assert verify_res.status_code == 200

    # POST /logout with invalid CSRF token
    res = client.post(
        "/api/v1/purchaser/auth/logout",
        headers={"X-CSRF-Token": "invalid-forged-csrf-token"},
    )
    assert res.status_code == 403
    assert res.json()["code"] == "CSRF_FAILED"


def test_logout_succeeds_with_valid_csrf_and_revokes_correct_session(
    client: TestClient, email_mock: MockEmailService, db: Session
):
    """Proves logout succeeds with valid CSRF token, revokes only caller session, and clears cookies."""
    # Register purchaser A
    email_a = unique_email("logout_user_a")
    otp_a = register_and_get_otp(client, email_mock, email_a)
    verify_a = client.post("/api/v1/purchaser/auth/verify-email", json={"email": email_a, "otp": otp_a})
    csrf_a = verify_a.json()["csrf_token"]
    user_a = db.execute(select(Purchaser).where(Purchaser.email_normalized == email_a.lower())).scalar_one()

    # Save session A id
    session_a = db.execute(
        select(PurchaserSession)
        .where(PurchaserSession.purchaser_id == user_a.id, PurchaserSession.revoked_at.is_(None))
    ).scalar_one()
    session_a_id = session_a.id

    # Register purchaser B (in separate record)
    email_b = unique_email("logout_user_b")
    otp_b = register_and_get_otp(client, email_mock, email_b)
    user_b = db.execute(select(Purchaser).where(Purchaser.email_normalized == email_b.lower())).scalar_one()
    # Create an active session directly for user B
    session_b = PurchaserSession(
        purchaser_id=user_b.id,
        token_hash=f"dummy_hash_for_b_session_{uuid.uuid4().hex}",
        remember_device=True,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db.add(session_b)
    db.commit()
    session_b_id = session_b.id

    # Logout User A with valid CSRF token
    logout_res = client.post(
        "/api/v1/purchaser/auth/logout",
        headers={"X-CSRF-Token": csrf_a},
    )
    assert logout_res.status_code == 200
    assert logout_res.json()["message"] == "Purchaser session terminated successfully."

    # Verify session A is revoked in database
    db.expire_all()
    session_a_db = db.execute(select(PurchaserSession).where(PurchaserSession.id == session_a_id)).scalar_one()
    assert session_a_db.revoked_at is not None, "User A active session must be marked revoked!"

    # User B session must NOT be revoked!
    session_b_db = db.execute(select(PurchaserSession).where(PurchaserSession.id == session_b_id)).scalar_one()
    assert session_b_db.revoked_at is None, "User B session must remain active and unaffected!"

    # Verify subsequent authenticated calls with User A cookies are rejected
    me_res = client.get("/api/v1/purchaser/auth/me")
    assert me_res.status_code == 401


def test_logout_prevents_csrf_bypass_with_authorization_header(client: TestClient, email_mock: MockEmailService):
    """Proves attacker cannot bypass cookie CSRF check by attaching an Authorization header."""
    email = unique_email("logout_bypass")
    otp = register_and_get_otp(client, email_mock, email)
    client.post("/api/v1/purchaser/auth/verify-email", json={"email": email, "otp": otp})

    # Request has cookies, but attacker tries to add Authorization header without valid CSRF
    res = client.post(
        "/api/v1/purchaser/auth/logout",
        headers={"Authorization": "Bearer bogus_token_attempting_bypass"},
    )
    assert res.status_code == 403, "Cookie-authenticated request must still enforce CSRF even if Authorization header is sent!"
    assert res.json()["code"] == "CSRF_FAILED"
