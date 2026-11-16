import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.hospital import Hospital
    from app.models.assignment import RoleAssignment


class TenantMembership(Base, TimestampMixin):
    __tablename__ = "tenant_memberships"
    __table_args__ = (
        UniqueConstraint("hospital_id", "user_id", name="uq_membership_hospital_user"),
        # Note: Employee UID is unique within hospital context when verified, but NOT globally unique
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_uid: Mapped[str] = mapped_column(String(64), nullable=False)
    employee_uid_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Status: "pending", "active", "suspended", "terminated"
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)

    verified_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="memberships", foreign_keys=[user_id])
    hospital: Mapped["Hospital"] = relationship("Hospital", back_populates="memberships")
    role_assignments: Mapped[List["RoleAssignment"]] = relationship(
        "RoleAssignment", back_populates="membership", cascade="all, delete-orphan"
    )

