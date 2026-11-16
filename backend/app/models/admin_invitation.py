import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.hospital import Hospital
    from app.models.purchaser import Purchaser
    from app.models.user import User
    from app.models.membership import TenantMembership


class HospitalAdminInvitation(Base, TimestampMixin):
    __tablename__ = "hospital_admin_invitations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    inviting_purchaser_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchasers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invitee_name: Mapped[str] = mapped_column(String(128), nullable=False)
    invitee_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    invitee_phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    invitee_designation: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    # Status: "PENDING", "ACCEPTED", "EXPIRED", "REVOKED"
    status: Mapped[str] = mapped_column(
        String(32), default="PENDING", nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    hospital: Mapped["Hospital"] = relationship(
        "Hospital", back_populates="admin_invitations"
    )
    inviting_purchaser: Mapped["Purchaser"] = relationship("Purchaser")
    administrator: Mapped[Optional["HospitalAdministrator"]] = relationship(
        "HospitalAdministrator", back_populates="invitation", uselist=False
    )


class HospitalAdministrator(Base, TimestampMixin):
    __tablename__ = "hospital_administrators"
    __table_args__ = (
        UniqueConstraint("hospital_id", "user_id", name="uq_hospital_admin_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    membership_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_memberships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invitation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospital_admin_invitations.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Status: "active", "revoked", "suspended"
    status: Mapped[str] = mapped_column(
        String(32), default="active", nullable=False, index=True
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    hospital: Mapped["Hospital"] = relationship(
        "Hospital", back_populates="administrators"
    )
    user: Mapped["User"] = relationship("User")
    membership: Mapped["TenantMembership"] = relationship("TenantMembership")
    invitation: Mapped[Optional["HospitalAdminInvitation"]] = relationship(
        "HospitalAdminInvitation", back_populates="administrator"
    )

