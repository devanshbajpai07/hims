import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.role import Role
    from app.models.membership import TenantMembership
    from app.models.department import Department
    from app.models.user import User


class Permission(Base, TimestampMixin):
    """Atomic permission item in the master catalogue.
    Represents discrete operations (e.g. 'patient:read', 'emr:write').
    """
    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Category: "clinical", "operational", "workforce", "administrative"
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # Module: "patient", "emr", "vitals", "prescription", "queue", "appointment", "employee", "department", "role", "approval", "audit", "billing"
    module: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # Risk Classification: "standard", "sensitive", "privileged"
    risk_level: Mapped[str] = mapped_column(String(16), default="standard", nullable=False)
    # Tier Availability: "BASIC", "PRO", "ULTRA" (minimum required tier)
    tier_availability: Mapped[str] = mapped_column(String(16), default="BASIC", nullable=False, index=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    role_version_permissions: Mapped[List["RoleVersionPermission"]] = relationship(
        "RoleVersionPermission", back_populates="permission", cascade="all, delete-orphan"
    )
    overrides: Mapped[List["MembershipPermissionOverride"]] = relationship(
        "MembershipPermissionOverride", back_populates="permission", cascade="all, delete-orphan"
    )


class RoleVersion(Base, TimestampMixin):
    """Immutable version of a Role containing its permission configuration.
    Enforces atomic version activation and dynamic permission inheritance.
    """
    __tablename__ = "role_versions"
    __table_args__ = (
        UniqueConstraint("role_id", "version_number", name="uq_role_version_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    # Optional parent role for ULTRA role inheritance
    parent_role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    change_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    role: Mapped["Role"] = relationship("Role", foreign_keys=[role_id], back_populates="versions")
    parent_role: Mapped[Optional["Role"]] = relationship("Role", foreign_keys=[parent_role_id])
    created_by: Mapped[Optional["User"]] = relationship("User")
    permissions: Mapped[List["RoleVersionPermission"]] = relationship(
        "RoleVersionPermission", back_populates="role_version", cascade="all, delete-orphan"
    )


class RoleVersionPermission(Base, TimestampMixin):
    """Join entity between RoleVersion and atomic Permission."""
    __tablename__ = "role_version_permissions"
    __table_args__ = (
        UniqueConstraint("role_version_id", "permission_id", name="uq_role_version_perm"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    role_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("role_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Relationships
    role_version: Mapped["RoleVersion"] = relationship("RoleVersion", back_populates="permissions")
    permission: Mapped["Permission"] = relationship("Permission", back_populates="role_version_permissions")


class MembershipPermissionOverride(Base, TimestampMixin):
    """Individual employee permission grant or denial.
    DENY strictly overrides inherited role grants.
    GRANT adds a permitted permission within subscription tier constraints.
    """
    __tablename__ = "membership_permission_overrides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    membership_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenant_memberships.id", ondelete="CASCADE"), nullable=False, index=True
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Type: "GRANT" or "DENY"
    override_type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    granted_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    membership: Mapped["TenantMembership"] = relationship("TenantMembership")
    permission: Mapped["Permission"] = relationship("Permission", back_populates="overrides")
    department: Mapped[Optional["Department"]] = relationship("Department")
    granted_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[granted_by_user_id])
    revoked_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[revoked_by_user_id])

