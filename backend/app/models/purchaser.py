import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.purchaser_subscription import PurchaserSubscription


class Purchaser(Base, TimestampMixin):
    __tablename__ = "purchasers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    email_normalized: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    account_status: Mapped[str] = mapped_column(
        String(32), default="active", nullable=False
    )  # "active", "suspended", "deactivated", "pending_deletion"
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deletion_scheduled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    sessions: Mapped[List["PurchaserSession"]] = relationship(
        "PurchaserSession",
        back_populates="purchaser",
        cascade="all, delete-orphan",
    )
    otp_challenges: Mapped[List["PurchaserOTPChallenge"]] = relationship(
        "PurchaserOTPChallenge",
        back_populates="purchaser",
        cascade="all, delete-orphan",
    )
    password_reset_tokens: Mapped[List["PurchaserPasswordResetToken"]] = relationship(
        "PurchaserPasswordResetToken",
        back_populates="purchaser",
        cascade="all, delete-orphan",
    )
    email_changes: Mapped[List["PurchaserEmailChange"]] = relationship(
        "PurchaserEmailChange",
        back_populates="purchaser",
        cascade="all, delete-orphan",
    )
    subscriptions: Mapped[List["PurchaserSubscription"]] = relationship(
        "PurchaserSubscription",
        back_populates="purchaser",
        cascade="all, delete-orphan",
    )


class PurchaserSession(Base, TimestampMixin):
    __tablename__ = "purchaser_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    purchaser_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchasers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    remember_device: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    purchaser: Mapped["Purchaser"] = relationship(
        "Purchaser", back_populates="sessions"
    )


class PurchaserOTPChallenge(Base, TimestampMixin):
    __tablename__ = "purchaser_otp_challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    purchaser_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchasers.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(
        String(32), default="registration", nullable=False
    )  # "registration", "email_change", "login_2fa"
    otp_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    salt: Mapped[str] = mapped_column(String(64), nullable=False)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resend_available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    consumed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    purchaser: Mapped[Optional["Purchaser"]] = relationship(
        "Purchaser", back_populates="otp_challenges"
    )


class PurchaserPasswordResetToken(Base, TimestampMixin):
    __tablename__ = "purchaser_password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    purchaser_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchasers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    purchaser: Mapped["Purchaser"] = relationship(
        "Purchaser", back_populates="password_reset_tokens"
    )


class PurchaserEmailChange(Base, TimestampMixin):
    __tablename__ = "purchaser_email_changes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    purchaser_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchasers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    current_email: Mapped[str] = mapped_column(String(255), nullable=False)
    proposed_email: Mapped[str] = mapped_column(String(255), nullable=False)
    verification_token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    purchaser: Mapped["Purchaser"] = relationship(
        "Purchaser", back_populates="email_changes"
    )

