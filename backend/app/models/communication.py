import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    Boolean,
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
    from app.models.membership import TenantMembership
    from app.models.user import User


class EmployeeMessage(Base, TimestampMixin):
    """Normalized internal employee communication and actionable request tracking model.
    A single authoritative persisted record shared between sender and recipient,
    with synchronized lifecycle state in PostgreSQL.
    """
    __tablename__ = "employee_messages"
    __table_args__ = (
        CheckConstraint(
            "sender_membership_id != recipient_membership_id",
            name="ck_employee_message_no_self_membership",
        ),
        CheckConstraint(
            "sender_user_id != recipient_user_id",
            name="ck_employee_message_no_self_user",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')",
            name="ck_employee_message_status",
        ),
        Index("ix_emp_msg_hospital_recipient", "hospital_id", "recipient_membership_id", "status"),
        Index("ix_emp_msg_hospital_sender", "hospital_id", "sender_membership_id", "status"),
        Index("ix_emp_msg_recipient_unread", "recipient_membership_id", "is_read"),
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

    # Sender context
    sender_membership_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_memberships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sender_role_name: Mapped[str] = mapped_column(String(100), nullable=False)
    sender_department_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Recipient context
    recipient_membership_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_memberships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_name: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_role_name: Mapped[str] = mapped_column(String(100), default="General Staff", nullable=False)
    recipient_department_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Content
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    message_body: Mapped[str] = mapped_column(Text, nullable=False)

    # Lifecycle & Read state
    status: Mapped[str] = mapped_column(
        String(32), default="PENDING", nullable=False, index=True
    )  # "PENDING" | "IN_PROGRESS" | "COMPLETED"
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Completion metadata
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    completed_by_membership_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_memberships.id", ondelete="SET NULL"),
        nullable=True,
    )
    completed_by_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    completion_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    hospital: Mapped["Hospital"] = relationship("Hospital")
    sender_user: Mapped["User"] = relationship("User", foreign_keys=[sender_user_id])
    recipient_user: Mapped["User"] = relationship("User", foreign_keys=[recipient_user_id])
    sender_membership: Mapped["TenantMembership"] = relationship(
        "TenantMembership", foreign_keys=[sender_membership_id]
    )
    recipient_membership: Mapped["TenantMembership"] = relationship(
        "TenantMembership", foreign_keys=[recipient_membership_id]
    )

