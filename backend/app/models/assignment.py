import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.membership import TenantMembership
    from app.models.department import Department
    from app.models.role import Role
    from app.models.permission import RoleVersion
    from app.models.user import User


class RoleAssignment(Base, TimestampMixin):
    __tablename__ = "role_assignments"
    __table_args__ = (
        UniqueConstraint("membership_id", "department_id", "role_id", name="uq_assignment_member_dept_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    membership_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenant_memberships.id", ondelete="CASCADE"), nullable=False, index=True
    )
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Lifecycle & Authorization Scope
    # Status: "active", "pending", "revoked"
    assignment_status: Mapped[str] = mapped_column(String(32), default="active", nullable=False, index=True)
    # Source: "admin_assigned", "invitation", "self_registration"
    assignment_source: Mapped[str] = mapped_column(String(32), default="admin_assigned", nullable=False, index=True)
    assigned_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    role_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("role_versions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Scope Type: "DEPARTMENT", "MULTI_DEPARTMENT", "FACILITY"
    scope_type: Mapped[str] = mapped_column(String(32), default="DEPARTMENT", nullable=False)
    # JSON string of departmental UUIDs for multi-department scope in ULTRA
    scope_department_ids: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    membership: Mapped["TenantMembership"] = relationship("TenantMembership", back_populates="role_assignments")
    department: Mapped[Optional["Department"]] = relationship("Department")
    role: Mapped["Role"] = relationship("Role")
    role_version: Mapped[Optional["RoleVersion"]] = relationship("RoleVersion")
    assigned_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assigned_by_user_id])
    approved_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by_user_id])
    revoked_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[revoked_by_user_id])

