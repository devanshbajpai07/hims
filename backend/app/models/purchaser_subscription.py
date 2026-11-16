import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.purchaser import Purchaser


class PurchaserSubscription(Base, TimestampMixin):
    __tablename__ = "purchaser_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    purchaser_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchasers.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    plan_code: Mapped[str] = mapped_column(
        String(32), index=True, nullable=False
    )  # "BASIC", "PRO", "ULTRA"
    status: Mapped[str] = mapped_column(
        String(32), default="active", index=True, nullable=False
    )  # "active", "past_due", "cancelled", "expired"
    billing_interval: Mapped[str] = mapped_column(
        String(32), default="annual", nullable=False
    )  # "monthly", "annual", "free"
    auto_renew: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    current_period_starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    current_period_ends_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    purchaser: Mapped["Purchaser"] = relationship(
        "Purchaser",
        back_populates="subscriptions",
    )

