import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.hospital import Hospital
    from app.models.department import Department
    from app.models.membership import TenantMembership
    from app.models.user import User
    from app.models.assignment import RoleAssignment


class EmployeeRevocationRequest(Base, TimestampMixin):
    """Formal employee access revocation request submitted by a Department Head
    to a Hospital Administrator. Tracks the full request and administrative review lifecycle.
    """
    __tablename__ = "employee_revocation_requests"
    __table_args__ = (
        CheckConstraint(
            "requester_user_id != target_user_id",
            name="ck_revocation_request_no_self_target",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')",
            name="ck_revocation_request_status",
        ),
        CheckConstraint(
            "revocation_scope IN ('DEPARTMENT_ASSIGNMENT', 'FULL_MEMBERSHIP')",
            name="ck_revocation_request_scope",
        ),
        Index("ix_rev_req_hospital_dept", "hospital_id", "department_id", "status"),
        Index("ix_rev_req_target", "target_membership_id", "status"),
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
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Requester (Department Head)
    requester_membership_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_memberships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requester_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requester_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Target Employee
    target_membership_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_memberships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_assignment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("role_assignments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_employee_uid: Mapped[str] = mapped_column(String(64), nullable=False)

    # Scope and Reasons
    revocation_scope: Mapped[str] = mapped_column(
        String(32), default="DEPARTMENT_ASSIGNMENT", nullable=False
    )  # "DEPARTMENT_ASSIGNMENT" | "FULL_MEMBERSHIP"
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    supporting_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Lifecycle State
    status: Mapped[str] = mapped_column(
        String(32), default="PENDING", nullable=False, index=True
    )  # "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"

    # Reviewer decision (Hospital Administrator)
    reviewer_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    hospital: Mapped["Hospital"] = relationship("Hospital")
    department: Mapped["Department"] = relationship("Department")
    requester_user: Mapped["User"] = relationship("User", foreign_keys=[requester_user_id])
    target_user: Mapped["User"] = relationship("User", foreign_keys=[target_user_id])
    target_assignment: Mapped[Optional["RoleAssignment"]] = relationship("RoleAssignment", foreign_keys=[target_assignment_id])

