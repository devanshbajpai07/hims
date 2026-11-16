import uuid
from typing import Optional, TYPE_CHECKING
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.registration import RegistrationAssignmentRequest
    from app.models.user import User


class ApprovalRecord(Base, TimestampMixin):
    __tablename__ = "approval_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    assignment_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("registration_assignment_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    approver_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    approval_level: Mapped[str] = mapped_column(String(32), nullable=False)  # "department_head" or "hospital_admin"
    decision: Mapped[str] = mapped_column(String(32), nullable=False)  # "approved" or "rejected"
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    assignment_request: Mapped["RegistrationAssignmentRequest"] = relationship("RegistrationAssignmentRequest")
    approver: Mapped["User"] = relationship("User")

