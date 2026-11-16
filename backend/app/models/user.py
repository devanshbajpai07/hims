import uuid
from typing import List, TYPE_CHECKING
from sqlalchemy import Boolean, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.membership import TenantMembership
    from app.models.session import SessionRecord
    from app.models.user_reset_token import UserPasswordResetToken


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_username_lower", func.lower(mapped_column("username")), unique=True),
        Index("ix_users_email_lower", func.lower(mapped_column("email")), unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    memberships: Mapped[List["TenantMembership"]] = relationship(
        "TenantMembership",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="[TenantMembership.user_id]",
    )
    sessions: Mapped[List["SessionRecord"]] = relationship(
        "SessionRecord", back_populates="user", cascade="all, delete-orphan"
    )
    password_reset_tokens: Mapped[List["UserPasswordResetToken"]] = relationship(
        "UserPasswordResetToken", back_populates="user", cascade="all, delete-orphan"
    )
