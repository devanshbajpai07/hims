import json
import os
from pathlib import Path
from typing import Any, List, Optional, Union
from urllib.parse import urlparse
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Aarogya - Hospital Information Management System"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Security & Tokens
    SECRET_KEY: str = "dev-hims-secret-key-change-in-production-1234567890abcdef"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    SESSION_COOKIE_NAME: str = "hims_session"
    SESSION_COOKIE_MAX_AGE_DAYS: int = 30

    # Embedded Dummy Database (No external PostgreSQL server required)
    DATABASE_URL: str = "sqlite:///./dummy_hims.db"

    @field_validator("DATABASE_URL", mode="before")
    def assemble_database_url(cls, v: Union[str, None]) -> str:
        # Automated test isolation: if running under pytest, route to isolated test database
        # unless FORCE_REMOTE_DB is explicitly set.
        import os, sys
        if ("pytest" in sys.modules or os.getenv("ENVIRONMENT") == "testing") and not os.getenv("FORCE_REMOTE_DB"):
            return os.getenv("TEST_DATABASE_URL", "sqlite:///./test_hims.db")

        if not v or not isinstance(v, str) or not v.strip():
            return "sqlite:///./dummy_hims.db"
        v = v.strip().strip('"').strip("'")
        if v.startswith("postgres://"):
            return "postgresql+psycopg://" + v[len("postgres://"):]
        if v.startswith("postgresql://") and not v.startswith("postgresql+psycopg://"):
            return "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    # CORS & Web Client
    FRONTEND_URL: str = "https://aarogya-rho-lovat.vercel.app" if os.getenv("ENVIRONMENT") == "production" or os.getenv("RENDER") else "http://localhost:5173"
    FRONTEND_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "https://aarogya-rho-lovat.vercel.app",
        "https://aarogya-bngr.onrender.com",
    ]

    @field_validator("FRONTEND_URL", mode="before")
    def assemble_frontend_url(cls, v: Union[str, None]) -> str:
        is_prod = (
            os.getenv("ENVIRONMENT", "").lower() == "production"
            or bool(os.getenv("RENDER"))
        )
        if v and isinstance(v, str) and v.strip():
            cleaned = v.strip().rstrip("/")
            if is_prod and "localhost" in cleaned:
                return "https://aarogya-rho-lovat.vercel.app"
            return cleaned
        if is_prod:
            return "https://aarogya-rho-lovat.vercel.app"
        return "http://localhost:5173"

    @field_validator("FRONTEND_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        origins: List[str] = []
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    origins = parsed
            except Exception:
                origins = [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            origins = list(v)

        essential = [
            "https://aarogya-rho-lovat.vercel.app",
            "https://aarogya-bngr.onrender.com",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:3000",
        ]
        for o in essential:
            if o not in origins:
                origins.append(o)
        return origins

    # OTP Configuration
    OTP_EXPIRE_MINUTES: int = 10
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    OTP_MAX_ATTEMPTS: int = 5

    # Email
    EMAIL_PROVIDER: str = "mock"  # "mock", "smtp", "antideploy", or "resend"
    SMTP_HOST: str = "smtp.example.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "no-reply@hims-health.org"

    # Antideploy / Resend Email
    RESEND_API_KEY: str = ""
    RESEND_API_URL: str = "https://api.antideploy.com"
    EMAIL_FROM: str = "Aarogya <onboarding@mail.antideploy.app>"

    # Filebase S3-Compatible Object Storage
    FILEBASE_ENDPOINT_URL: str = "https://s3.filebase.io"
    FILEBASE_REGION: str = "auto"
    FILEBASE_BUCKET_NAME: str = "aura-hims-documents"
    FILEBASE_ACCESS_KEY_ID: str = ""
    FILEBASE_SECRET_ACCESS_KEY: str = ""
    MAX_DOCUMENT_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB

    @model_validator(mode="after")
    def validate_production_configuration(self) -> "Settings":
        is_prod = self.ENVIRONMENT.lower() in ("production", "prod")
        if is_prod and self.EMAIL_PROVIDER.lower() == "mock":
            raise ValueError(
                "Production environment cannot use mock email provider ('EMAIL_PROVIDER=mock'). "
                "Please configure a valid production provider such as 'antideploy' or 'smtp'."
            )
        if self.EMAIL_PROVIDER.lower() in ("antideploy", "resend") and is_prod and not self.RESEND_API_KEY:
            raise ValueError(
                "Antideploy email provider selected but RESEND_API_KEY is not configured."
            )
        return self

    model_config = SettingsConfigDict(
        env_file=(str(Path(__file__).resolve().parent.parent.parent / ".env"), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()


def get_frontend_base_url(request: Optional[Any] = None) -> str:
    """Intelligently resolves the active frontend base URL for emails and links.

    1. Checks incoming HTTP request headers (Origin, Referer):
       - If Origin or Referer is present and matches an allowed domain / pattern,
         uses the exact scheme and host the user is currently browsing from.
    2. Falls back to configured settings.FRONTEND_URL.
    3. If settings.FRONTEND_URL is still localhost but we are in production or on Render,
       falls back to the production Vercel deployment: 'https://aarogya-rho-lovat.vercel.app'.
    """
    if request is not None:
        try:
            # Check Origin header (sent with POST/PUT/DELETE requests)
            origin = request.headers.get("origin") if hasattr(request, "headers") else None
            if origin and isinstance(origin, str) and origin.strip():
                candidate = origin.strip().rstrip("/")
                if candidate.startswith("http://") or candidate.startswith("https://"):
                    parsed = urlparse(candidate)
                    domain = parsed.hostname or ""
                    if (
                        domain == "localhost"
                        or domain == "127.0.0.1"
                        or domain.endswith(".vercel.app")
                        or domain.endswith(".onrender.com")
                        or candidate in settings.FRONTEND_ORIGINS
                    ):
                        return candidate

            # Check Referer header if Origin was absent
            referer = request.headers.get("referer") if hasattr(request, "headers") else None
            if referer and isinstance(referer, str) and referer.strip():
                candidate = referer.strip().rstrip("/")
                parsed = urlparse(candidate)
                if parsed.scheme in ("http", "https") and parsed.netloc:
                    domain = parsed.hostname or ""
                    base_candidate = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
                    if (
                        domain == "localhost"
                        or domain == "127.0.0.1"
                        or domain.endswith(".vercel.app")
                        or domain.endswith(".onrender.com")
                        or base_candidate in settings.FRONTEND_ORIGINS
                    ):
                        return base_candidate
        except Exception:
            pass

    # Fallback to configured FRONTEND_URL
    configured = (settings.FRONTEND_URL or "").strip().rstrip("/")
    is_prod = (
        os.getenv("ENVIRONMENT", "").lower() == "production"
        or bool(os.getenv("RENDER"))
        or settings.ENVIRONMENT.lower() == "production"
    )
    if not configured or (is_prod and "localhost" in configured):
        return "https://aarogya-rho-lovat.vercel.app"

    return configured or "https://aarogya-rho-lovat.vercel.app"

