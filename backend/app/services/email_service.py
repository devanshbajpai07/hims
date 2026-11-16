import logging
import smtplib
from abc import ABC, abstractmethod
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Optional
from app.core.config import settings

logger = logging.getLogger("hims.email")


class EmailService(ABC):
    @abstractmethod
    def send_otp_email(self, to_email: str, hospital_name: str, otp: str, expires_minutes: int) -> bool:
        pass

    @abstractmethod
    def send_password_reset_email(self, to_email: str, reset_link: str, expires_minutes: int) -> bool:
        pass

    @abstractmethod
    def send_notification_email(self, to_email: str, subject: str, message: str) -> bool:
        pass

    @abstractmethod
    def send_invitation_email(
        self,
        to_email: str,
        recipient_name: str,
        hospital_name: str,
        role_type: str,
        invitation_url: str,
        expires_hours: int,
    ) -> bool:
        pass


class MockEmailService(EmailService):
    """
    Development & test email adapter.
    Logs email dispatch securely and stores last sent OTP in an in-memory dictionary
    for automated test assertion without exposing it in API responses.
    """
    def __init__(self):
        self.sent_otps: Dict[str, str] = {}  # email -> latest_otp
        self.sent_resets: Dict[str, str] = {}  # email -> latest_reset_link
        self.sent_notifications: Dict[str, str] = {}  # email -> latest_message
        self.sent_invitations: Dict[str, str] = {}  # email -> latest_invitation_url

    def send_invitation_email(
        self,
        to_email: str,
        recipient_name: str,
        hospital_name: str,
        role_type: str,
        invitation_url: str,
        expires_hours: int,
    ) -> bool:
        self.sent_invitations[to_email.lower().strip()] = invitation_url
        is_dev = settings.ENVIRONMENT.lower() in ("development", "dev", "test", "testing", "local")
        if is_dev:
            logger.info(
                "[DEV EMAIL ADAPTER] To: %s | Recipient: %s | Hospital: %s | Role: %s | Link: %s | Expires in: %d hrs",
                to_email,
                recipient_name,
                hospital_name,
                role_type,
                invitation_url,
                expires_hours,
            )
        else:
            logger.info(
                "[EMAIL ADAPTER] Invitation link dispatched to %s (token suppressed in non-dev environment)",
                to_email,
            )
        return True

    def send_otp_email(self, to_email: str, hospital_name: str, otp: str, expires_minutes: int) -> bool:
        self.sent_otps[to_email.lower().strip()] = otp
        is_dev = settings.ENVIRONMENT.lower() in ("development", "dev", "test", "testing", "local")
        if is_dev:
            logger.info(
                "[DEV EMAIL ADAPTER] To: %s | Subject: HIMS Verification Code | Hospital: %s | OTP: %s | Expires in: %d mins",
                to_email,
                hospital_name,
                otp,
                expires_minutes,
            )
        else:
            logger.info(
                "[EMAIL ADAPTER] Verification code dispatched to %s (credentials suppressed in non-dev environment)",
                to_email,
            )
        return True

    def send_password_reset_email(self, to_email: str, reset_link: str, expires_minutes: int) -> bool:
        self.sent_resets[to_email.lower().strip()] = reset_link
        is_dev = settings.ENVIRONMENT.lower() in ("development", "dev", "test", "testing", "local")
        if is_dev:
            logger.info(
                "[DEV EMAIL ADAPTER] To: %s | Subject: Password Reset Request | Link: %s | Expires in: %d mins",
                to_email,
                reset_link,
                expires_minutes,
            )
        else:
            logger.info(
                "[EMAIL ADAPTER] Password reset link dispatched to %s (token suppressed in non-dev environment)",
                to_email,
            )
        return True

    def send_notification_email(self, to_email: str, subject: str, message: str) -> bool:
        self.sent_notifications[to_email.lower().strip()] = message
        logger.info(
            "[DEV EMAIL ADAPTER] To: %s | Subject: %s | Message: %s",
            to_email,
            subject,
            message,
        )
        return True

    def get_last_otp(self, email: str) -> Optional[str]:
        return self.sent_otps.get(email.lower().strip())

    def get_last_reset_link(self, email: str) -> Optional[str]:
        return self.sent_resets.get(email.lower().strip())

    def get_last_invitation_link(self, email: str) -> Optional[str]:
        return self.sent_invitations.get(email.lower().strip())


class SMTPEmailService(EmailService):
    """Production SMTP email adapter."""
    def send_otp_email(self, to_email: str, hospital_name: str, otp: str, expires_minutes: int) -> bool:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"Your Verification Code for {hospital_name} — HIMS"
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email

            text_content = (
                f"Hello,\n\n"
                f"Your 6-digit verification code for {hospital_name} is:\n\n"
                f"  {otp}\n\n"
                f"This code will expire in {expires_minutes} minutes. If you did not request this code, please ignore this email.\n\n"
                f"— HIMS Security Team"
            )
            msg.attach(MIMEText(text_content, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
            return True
        except Exception as e:
            logger.error("Failed to send SMTP email to %s: %s", to_email, e)
            return False

    def send_password_reset_email(self, to_email: str, reset_link: str, expires_minutes: int) -> bool:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Password Reset Request — Aarogya Purchaser Portal"
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email

            text_content = (
                f"Hello,\n\n"
                f"We received a request to reset your Aarogya purchaser account password.\n\n"
                f"Reset your password by following this link:\n{reset_link}\n\n"
                f"This link will expire in {expires_minutes} minutes. If you did not make this request, you can safely ignore this email.\n\n"
                f"— Aarogya Security Team"
            )
            msg.attach(MIMEText(text_content, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
            return True
        except Exception as e:
            logger.error("Failed to send password reset email to %s: %s", to_email, e)
            return False

    def send_notification_email(self, to_email: str, subject: str, message: str) -> bool:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"{subject} — Aarogya"
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email
            msg.attach(MIMEText(message, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
            return True
        except Exception as e:
            logger.error("Failed to send notification email to %s: %s", to_email, e)
            return False

    def send_invitation_email(
        self,
        to_email: str,
        recipient_name: str,
        hospital_name: str,
        role_type: str,
        invitation_url: str,
        expires_hours: int,
    ) -> bool:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"Invitation to join {hospital_name} as {role_type} — Aarogya"
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email

            text_content = (
                f"Dear {recipient_name},\n\n"
                f"You have been officially invited to join {hospital_name} as {role_type} on Aarogya.\n\n"
                f"To accept this invitation and configure your credentials, visit the following secure link:\n"
                f"{invitation_url}\n\n"
                f"This invitation link is valid for {expires_hours} hours. If you did not anticipate this invitation, please contact your institution's executive leadership.\n\n"
                f"— Aarogya Healthcare Information Management System"
            )
            msg.attach(MIMEText(text_content, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
            return True
        except Exception as e:
            logger.error("Failed to send invitation email to %s: %s", to_email, e)
            return False


class AntideployEmailService(EmailService):
    """
    Antideploy transactional email provider using the Resend Python SDK.
    Relays through Antideploy's high-reputation transactional email infrastructure.
    """
    def __init__(self):
        try:
            import resend
            self._resend = resend
        except ImportError:
            raise RuntimeError(
                "resend package is required for Antideploy email integration. "
                "Install with `pip install resend`."
            )

    def _configure_client(self):
        if settings.RESEND_API_KEY:
            self._resend.api_key = settings.RESEND_API_KEY
        if settings.RESEND_API_URL:
            self._resend.api_url = settings.RESEND_API_URL

    def _send(self, to_email: str, subject: str, html_content: str, text_content: str) -> bool:
        self._configure_client()
        sender = settings.EMAIL_FROM or "Aarogya <onboarding@mail.antideploy.app>"
        params = {
            "from": sender,
            "to": [to_email.strip()],
            "subject": subject,
            "html": html_content,
            "text": text_content,
        }
        try:
            resp = self._resend.Emails.send(params)
            logger.info("Successfully dispatched transactional email via Antideploy to %s", to_email)
            return True
        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg or "quota" in err_msg.lower() or "rate_limit" in err_msg.lower():
                logger.warning("Antideploy email daily quota or rate limit exceeded for %s: %s", to_email, err_msg)
            else:
                logger.error("Failed to send transactional email via Antideploy to %s: %s", to_email, err_msg)
            return False

    def send_otp_email(self, to_email: str, hospital_name: str, otp: str, expires_minutes: int) -> bool:
        subject = f"Your Verification Code for {hospital_name} — Aarogya"
        text_content = (
            f"Hello,\n\n"
            f"Your 6-digit verification code for {hospital_name} is:\n\n"
            f"  {otp}\n\n"
            f"This code will expire in {expires_minutes} minutes. If you did not request this code, please ignore this email.\n\n"
            f"— Aarogya Healthcare Information Management System"
        )
        html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF7F2; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
    <div style="background: #064E3B; padding: 28px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Aarogya</h1>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">Hospital Information Management System</p>
    </div>
    <div style="padding: 36px 32px; color: #1E293B;">
      <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #0F172A;">Authentication Verification Code</h2>
      <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #475569;">
        Please use the following 6-digit security code to verify access for <strong>{hospital_name}</strong>:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="display: inline-block; background: #F0FDF4; border: 2px solid #86EFAC; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 0.25em; padding: 14px 28px; color: #166534; font-family: monospace;">{otp}</span>
      </div>
      <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.5; color: #64748B;">
        This single-use code expires in <strong>{expires_minutes} minutes</strong>. If you did not initiate this request, no action is required and you may safely disregard this notice.
      </p>
    </div>
    <div style="background: #F8FAFC; padding: 20px 32px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; text-align: center;">
      Enterprise Clinical Platform &bull; Protected Health Information Boundary
    </div>
  </div>
</body>
</html>"""
        return self._send(to_email, subject, html_content, text_content)

    def send_password_reset_email(self, to_email: str, reset_link: str, expires_minutes: int) -> bool:
        logger.info("[TRANSACTIONAL EMAIL] Password reset dispatched for %s -> %s", to_email, reset_link)
        subject = "Password Reset Request — Aarogya"
        text_content = (
            f"Hello,\n\n"
            f"We received a request to reset your password for Aarogya.\n\n"
            f"Reset your password by visiting this secure link:\n{reset_link}\n\n"
            f"This link will expire in {expires_minutes} minutes. If you did not request this, you can safely ignore this email.\n\n"
            f"— Aarogya Healthcare Information Management System"
        )
        html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF7F2; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
    <div style="background: #064E3B; padding: 28px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Aarogya</h1>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">Hospital Information Management System</p>
    </div>
    <div style="padding: 36px 32px; color: #1E293B;">
      <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #0F172A;">Password Reset Request</h2>
      <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #475569;">
        We received an official request to reset the credentials for your account. Click the button below to configure a new password:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{reset_link}" style="display: inline-block; background: #0D5C4D; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 2px 4px rgba(13,92,77,0.2);">Reset Password &rarr;</a>
      </div>
      <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.5; color: #64748B;">
        This reset token expires in <strong>{expires_minutes} minutes</strong>. If you did not make this request, your account remains secure and you may safely ignore this message.
      </p>
      <div style="margin-top: 20px; padding-top: 16px; border-top: 1px dashed #CBD5E1; word-break: break-all; font-size: 12px; color: #94A3B8;">
        Direct link: <a href="{reset_link}" style="color: #0D5C4D;">{reset_link}</a>
      </div>
    </div>
    <div style="background: #F8FAFC; padding: 20px 32px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; text-align: center;">
      Enterprise Clinical Platform &bull; Protected Health Information Boundary
    </div>
  </div>
</body>
</html>"""
        return self._send(to_email, subject, html_content, text_content)

    def send_notification_email(self, to_email: str, subject: str, message: str) -> bool:
        full_subject = f"{subject} — Aarogya"
        text_content = f"{message}\n\n— Aarogya Healthcare Information Management System"
        html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{full_subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF7F2; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
    <div style="background: #064E3B; padding: 28px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Aarogya</h1>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">Hospital Information Management System</p>
    </div>
    <div style="padding: 36px 32px; color: #1E293B;">
      <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #0F172A;">{subject}</h2>
      <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569; white-space: pre-wrap;">{message}</p>
    </div>
    <div style="background: #F8FAFC; padding: 20px 32px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; text-align: center;">
      Enterprise Clinical Platform &bull; Protected Health Information Boundary
    </div>
  </div>
</body>
</html>"""
        return self._send(to_email, full_subject, html_content, text_content)

    def send_invitation_email(
        self,
        to_email: str,
        recipient_name: str,
        hospital_name: str,
        role_type: str,
        invitation_url: str,
        expires_hours: int,
    ) -> bool:
        subject = f"Invitation to join {hospital_name} as {role_type} — Aarogya"
        text_content = (
            f"Dear {recipient_name},\n\n"
            f"You have been officially invited to join {hospital_name} as {role_type} on Aarogya.\n\n"
            f"To accept this invitation and configure your credentials, visit the following secure link:\n"
            f"{invitation_url}\n\n"
            f"This invitation link is valid for {expires_hours} hours. If you did not anticipate this invitation, please contact your institution's executive leadership.\n\n"
            f"— Aarogya Healthcare Information Management System"
        )
        html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF7F2; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
    <div style="background: #064E3B; padding: 28px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Aarogya</h1>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">Hospital Information Management System</p>
    </div>
    <div style="padding: 36px 32px; color: #1E293B;">
      <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #0F172A;">Official Healthcare Institution Invitation</h2>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: #475569;">
        Dear <strong>{recipient_name}</strong>,
      </p>
      <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #475569;">
        You have been officially invited to join <strong>{hospital_name}</strong> in the executive capacity of <strong>{role_type}</strong> on Aarogya.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{invitation_url}" style="display: inline-block; background: #0D5C4D; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 2px 4px rgba(13,92,77,0.2);">Accept Invitation &rarr;</a>
      </div>
      <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.5; color: #64748B;">
        This one-time security link is active for <strong>{expires_hours} hours</strong>. After expiration, your facility purchaser or administrator must re-issue an invitation.
      </p>
      <div style="margin-top: 20px; padding-top: 16px; border-top: 1px dashed #CBD5E1; word-break: break-all; font-size: 12px; color: #94A3B8;">
        Direct link: <a href="{invitation_url}" style="color: #0D5C4D;">{invitation_url}</a>
      </div>
    </div>
    <div style="background: #F8FAFC; padding: 20px 32px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; text-align: center;">
      Enterprise Clinical Platform &bull; Protected Health Information Boundary
    </div>
  </div>
</body>
</html>"""
        return self._send(to_email, subject, html_content, text_content)


# Singleton email service factory
def get_email_service() -> EmailService:
    provider = settings.EMAIL_PROVIDER.lower().strip()
    if provider in ("antideploy", "resend"):
        return AntideployEmailService()
    if provider == "smtp" and settings.SMTP_HOST:
        return SMTPEmailService()
    if settings.ENVIRONMENT.lower() in ("production", "prod"):
        raise RuntimeError(
            "Production environment cannot use mock email provider. "
            "Please configure a valid production email service (e.g. EMAIL_PROVIDER=antideploy or EMAIL_PROVIDER=smtp)."
        )
    return mock_email_service


mock_email_service = MockEmailService()

