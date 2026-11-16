import pytest
from unittest.mock import MagicMock, patch
from app.core.config import settings
from app.services.email_service import (
    AntideployEmailService,
    get_email_service,
    mock_email_service,
    MockEmailService,
)


def test_antideploy_email_service_initialization():
    service = AntideployEmailService()
    assert service is not None


def test_antideploy_get_email_service_factory(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "antideploy")
    svc = get_email_service()
    assert isinstance(svc, AntideployEmailService)

    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "resend")
    svc2 = get_email_service()
    assert isinstance(svc2, AntideployEmailService)

    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "mock")
    monkeypatch.setattr(settings, "ENVIRONMENT", "testing")
    svc3 = get_email_service()
    assert isinstance(svc3, MockEmailService)


def test_antideploy_send_otp_email_success(monkeypatch):
    service = AntideployEmailService()
    mock_resend_emails = MagicMock()
    mock_resend_emails.send.return_value = {"id": "msg_test_123"}
    monkeypatch.setattr(service._resend.Emails, "send", mock_resend_emails.send)

    result = service.send_otp_email(
        to_email="bajpaijitamanyu176@gmail.com",
        hospital_name="St. Jude Metro Hospital",
        otp="123456",
        expires_minutes=10,
    )

    assert result is True
    mock_resend_emails.send.assert_called_once()
    call_args = mock_resend_emails.send.call_args[0][0]
    assert call_args["to"] == ["bajpaijitamanyu176@gmail.com"]
    assert "Verification Code" in call_args["subject"]
    assert "123456" in call_args["html"]
    assert "123456" in call_args["text"]


def test_antideploy_send_password_reset_email_success(monkeypatch):
    service = AntideployEmailService()
    mock_resend_emails = MagicMock()
    mock_resend_emails.send.return_value = {"id": "msg_test_456"}
    monkeypatch.setattr(service._resend.Emails, "send", mock_resend_emails.send)

    result = service.send_password_reset_email(
        to_email="bajpaijitamanyu176@gmail.com",
        reset_link="https://aura-hims.org/reset?token=xyz",
        expires_minutes=15,
    )

    assert result is True
    call_args = mock_resend_emails.send.call_args[0][0]
    assert call_args["to"] == ["bajpaijitamanyu176@gmail.com"]
    assert "Password Reset" in call_args["subject"]
    assert "https://aura-hims.org/reset?token=xyz" in call_args["html"]


def test_antideploy_send_invitation_email_success(monkeypatch):
    service = AntideployEmailService()
    mock_resend_emails = MagicMock()
    mock_resend_emails.send.return_value = {"id": "msg_test_789"}
    monkeypatch.setattr(service._resend.Emails, "send", mock_resend_emails.send)

    result = service.send_invitation_email(
        to_email="admin.invitee@stjude.org",
        recipient_name="Dr. Alex Carter",
        hospital_name="St. Jude Metro Hospital",
        role_type="Hospital Administrator",
        invitation_url="https://aura-hims.org/admin/accept-invitation?token=abc",
        expires_hours=48,
    )

    assert result is True
    call_args = mock_resend_emails.send.call_args[0][0]
    assert call_args["to"] == ["admin.invitee@stjude.org"]
    assert "Invitation" in call_args["subject"]
    assert "Dr. Alex Carter" in call_args["html"]
    assert "https://aura-hims.org/admin/accept-invitation?token=abc" in call_args["html"]


def test_antideploy_send_notification_email_success(monkeypatch):
    service = AntideployEmailService()
    mock_resend_emails = MagicMock()
    mock_resend_emails.send.return_value = {"id": "msg_test_000"}
    monkeypatch.setattr(service._resend.Emails, "send", mock_resend_emails.send)

    result = service.send_notification_email(
        to_email="staff@stjude.org",
        subject="Clinical System Maintenance",
        message="System update scheduled for 02:00 UTC.",
    )

    assert result is True
    call_args = mock_resend_emails.send.call_args[0][0]
    assert call_args["to"] == ["staff@stjude.org"]
    assert "Clinical System Maintenance" in call_args["subject"]
    assert "02:00 UTC" in call_args["html"]


def test_antideploy_rate_limit_error_handled_gracefully(monkeypatch):
    service = AntideployEmailService()
    mock_resend_emails = MagicMock()
    mock_resend_emails.send.side_effect = Exception("429 Client Error: daily_quota_exceeded for application")
    monkeypatch.setattr(service._resend.Emails, "send", mock_resend_emails.send)

    result = service.send_otp_email(
        to_email="bajpaijitamanyu176@gmail.com",
        hospital_name="St. Jude",
        otp="654321",
        expires_minutes=10,
    )

    # Must return False without raising exception
    assert result is False


def test_antideploy_generic_provider_error_handled_gracefully(monkeypatch):
    service = AntideployEmailService()
    mock_resend_emails = MagicMock()
    mock_resend_emails.send.side_effect = Exception("503 Service Unavailable: upstream connection timeout")
    monkeypatch.setattr(service._resend.Emails, "send", mock_resend_emails.send)

    result = service.send_notification_email(
        to_email="staff@stjude.org",
        subject="Test",
        message="Test content",
    )

    assert result is False

