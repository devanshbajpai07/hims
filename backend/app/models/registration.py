import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.hospital import Hospital
    from app.models.user import User
    from app.models.department import Department
    from app.models.role import Role
    from app.models.verification import EmailVerificationChallenge


class RegistrationRequest(Base, TimestampMixin):
    __tablename__ = "registration_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    challenge_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("email_verification_challenges.id", ondelete="SET NULL"), nullable=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    employee_uid_claim: Mapped[str] = mapped_column(String(64), nullable=False)
    employee_uid_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Overall Status: "pending_approval", "partially_approved", "approved", "rejected"
    status: Mapped[str] = mapped_column(String(32), default="pending_approval", nullable=False, index=True)

    verified_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    hospital: Mapped["Hospital"] = relationship("Hospital", back_populates="registration_requests")
    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])
    challenge: Mapped[Optional["EmailVerificationChallenge"]] = relationship("EmailVerificationChallenge")
    assignment_requests: Mapped[List["RegistrationAssignmentRequest"]] = relationship(
        "RegistrationAssignmentRequest", back_populates="registration_request", cascade="all, delete-orphan"
    )
    additional_requests: Mapped[List["AdditionalAssignmentRequest"]] = relationship(
        "AdditionalAssignmentRequest", back_populates="registration_request", cascade="all, delete-orphan"
    )


class RegistrationAssignmentRequest(Base, TimestampMixin):
    __tablename__ = "registration_assignment_requests"
    __table_args__ = (
        UniqueConstraint("registration_request_id", "slot_number", name="uq_reg_slot_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    registration_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("registration_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
    )
    slot_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 to 5

    # Status: "pending_dept_review", "approved_by_dept", "rejected_by_dept", "approved_final", "rejected_final"
    status: Mapped[str] = mapped_column(String(32), default="pending_dept_review", nullable=False, index=True)

    # Level 1 Review (Department Head)
    dept_head_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    dept_head_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    dept_head_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Level 2 Review (Hospital Administrator)
    admin_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    admin_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    registration_request: Mapped["RegistrationRequest"] = relationship("RegistrationRequest", back_populates="assignment_requests")
    department: Mapped[Optional["Department"]] = relationship("Department")
    role: Mapped["Role"] = relationship("Role")


class AdditionalAssignmentRequest(Base, TimestampMixin):
    __tablename__ = "additional_assignment_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    registration_request_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("registration_requests.id", ondelete="SET NULL"), nullable=True, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_uid: Mapped[str] = mapped_column(String(64), nullable=False)
    requested_responsibilities: Mapped[str] = mapped_column(Text, nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)

    hospital: Mapped["Hospital"] = relationship("Hospital")
    registration_request: Mapped[Optional["RegistrationRequest"]] = relationship(
        "RegistrationRequest", back_populates="additional_requests"
    )

