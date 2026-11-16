import uuid
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.hospital import Hospital
    from app.models.permission import RoleVersion


class Role(Base, TimestampMixin):
    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("hospital_id", "code", name="uq_role_hospital_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    scope: Mapped[str] = mapped_column(String(32), default="department", nullable=False)  # "hospital" or "department"
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    active_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("role_versions.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    hospital: Mapped["Hospital"] = relationship("Hospital", back_populates="roles")
    versions: Mapped[List["RoleVersion"]] = relationship(
        "RoleVersion",
        foreign_keys="RoleVersion.role_id",
        back_populates="role",
        cascade="all, delete-orphan",
    )
    active_version: Mapped[Optional["RoleVersion"]] = relationship(
        "RoleVersion",
        foreign_keys=[active_version_id],
        post_update=True,
    )

