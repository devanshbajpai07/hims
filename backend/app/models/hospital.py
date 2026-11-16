import uuid
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.role import Role
    from app.models.membership import TenantMembership
    from app.models.registration import RegistrationRequest
    from app.models.purchaser import Purchaser
    from app.models.purchaser_subscription import PurchaserSubscription
    from app.models.admin_invitation import HospitalAdminInvitation, HospitalAdministrator
    from app.models.employee_invitation import EmployeeInvitation
    from app.models.notification import HospitalNotification


class Hospital(Base, TimestampMixin):
    __tablename__ = "hospitals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_uid: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    registration_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Multi-tenancy and Subscription mapping
    purchaser_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchasers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    subscription_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchaser_subscriptions.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )

    # Institutional Facility Details
    facility_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    licence_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Relationships
    purchaser: Mapped[Optional["Purchaser"]] = relationship("Purchaser")
    subscription: Mapped[Optional["PurchaserSubscription"]] = relationship("PurchaserSubscription")

    departments: Mapped[List["Department"]] = relationship(
        "Department", back_populates="hospital", cascade="all, delete-orphan"
    )
    roles: Mapped[List["Role"]] = relationship(
        "Role", back_populates="hospital", cascade="all, delete-orphan"
    )
    memberships: Mapped[List["TenantMembership"]] = relationship(
        "TenantMembership", back_populates="hospital"
    )
    registration_requests: Mapped[List["RegistrationRequest"]] = relationship(
        "RegistrationRequest", back_populates="hospital"
    )
    admin_invitations: Mapped[List["HospitalAdminInvitation"]] = relationship(
        "HospitalAdminInvitation", back_populates="hospital", cascade="all, delete-orphan"
    )
    administrators: Mapped[List["HospitalAdministrator"]] = relationship(
        "HospitalAdministrator", back_populates="hospital", cascade="all, delete-orphan"
    )
    employee_invitations: Mapped[List["EmployeeInvitation"]] = relationship(
        "EmployeeInvitation", back_populates="hospital", cascade="all, delete-orphan"
    )
    notifications: Mapped[List["HospitalNotification"]] = relationship(
        "HospitalNotification", back_populates="hospital", cascade="all, delete-orphan"
    )
