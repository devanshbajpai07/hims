import json
from pathlib import Path
from typing import List, Union
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
    FRONTEND_URL: str = "http://localhost:5173"
    FRONTEND_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "https://aarogya-rho-lovat.vercel.app",
        "https://aarogya-bngr.onrender.com",
    ]

    @field_validator("FRONTEND_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return [i.strip() for i in v.split(",") if i.strip()]
        return v

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

