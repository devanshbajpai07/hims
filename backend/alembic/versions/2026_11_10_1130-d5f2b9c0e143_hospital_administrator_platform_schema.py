"""hospital_administrator_platform_schema

Revision ID: d5f2b9c0e143
Revises: c4e1a8b9d032
Create Date: 2026-11-10 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d5f2b9c0e143"
down_revision: Union[str, None] = "c4e1a8b9d032"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add hospital multi-tenancy and institutional facility fields
    op.add_column(
        "hospitals",
        sa.Column(
            "purchaser_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("purchasers.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "hospitals",
        sa.Column(
            "subscription_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("purchaser_subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("hospitals", sa.Column("facility_type", sa.String(length=64), nullable=True))
    op.add_column("hospitals", sa.Column("address", sa.Text(), nullable=True))
    op.add_column("hospitals", sa.Column("state", sa.String(length=64), nullable=True))
    op.add_column("hospitals", sa.Column("country", sa.String(length=64), nullable=True))
    op.add_column("hospitals", sa.Column("contact_email", sa.String(length=255), nullable=True))
    op.add_column("hospitals", sa.Column("contact_phone", sa.String(length=32), nullable=True))
    op.add_column("hospitals", sa.Column("website", sa.String(length=255), nullable=True))
    op.add_column("hospitals", sa.Column("licence_number", sa.String(length=64), nullable=True))

    op.create_index("ix_hospitals_purchaser_id", "hospitals", ["purchaser_id"])
    op.create_index("ix_hospitals_subscription_id", "hospitals", ["subscription_id"], unique=True)

    # 2. Create hospital_admin_invitations
    op.create_table(
        "hospital_admin_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "inviting_purchaser_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("purchasers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("invitee_name", sa.String(length=128), nullable=False),
        sa.Column("invitee_email", sa.String(length=255), nullable=False),
        sa.Column("invitee_phone", sa.String(length=32), nullable=True),
        sa.Column("invitee_designation", sa.String(length=128), nullable=True),
        sa.Column("token_hash", sa.String(length=255), nullable=False, unique=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_hospital_admin_invitations_hospital_id", "hospital_admin_invitations", ["hospital_id"])
    op.create_index("ix_hospital_admin_invitations_inviting_purchaser_id", "hospital_admin_invitations", ["inviting_purchaser_id"])
    op.create_index("ix_hospital_admin_invitations_invitee_email", "hospital_admin_invitations", ["invitee_email"])
    op.create_index("ix_hospital_admin_invitations_status", "hospital_admin_invitations", ["status"])

    # 3. Create hospital_administrators
    op.create_table(
        "hospital_administrators",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "membership_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenant_memberships.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invitation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospital_admin_invitations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("hospital_id", "user_id", name="uq_hospital_admin_user"),
    )
    op.create_index("ix_hospital_administrators_hospital_id", "hospital_administrators", ["hospital_id"])
    op.create_index("ix_hospital_administrators_user_id", "hospital_administrators", ["user_id"])
    op.create_index("ix_hospital_administrators_membership_id", "hospital_administrators", ["membership_id"])
    op.create_index("ix_hospital_administrators_status", "hospital_administrators", ["status"])

    # 4. Create employee_invitations
    op.create_table(
        "employee_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invited_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=128), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("designation", sa.String(length=128), nullable=True),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("departments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("role_ids", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("token_hash", sa.String(length=255), nullable=False, unique=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_employee_invitations_hospital_id", "employee_invitations", ["hospital_id"])
    op.create_index("ix_employee_invitations_invited_by_user_id", "employee_invitations", ["invited_by_user_id"])
    op.create_index("ix_employee_invitations_email", "employee_invitations", ["email"])
    op.create_index("ix_employee_invitations_department_id", "employee_invitations", ["department_id"])
    op.create_index("ix_employee_invitations_status", "employee_invitations", ["status"])

    # 5. Create hospital_notifications
    op.create_table(
        "hospital_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False, server_default="system"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_hospital_notifications_hospital_id", "hospital_notifications", ["hospital_id"])
    op.create_index("ix_hospital_notifications_recipient_user_id", "hospital_notifications", ["recipient_user_id"])


def downgrade() -> None:
    op.drop_table("hospital_notifications")
    op.drop_table("employee_invitations")
    op.drop_table("hospital_administrators")
    op.drop_table("hospital_admin_invitations")

    op.drop_index("ix_hospitals_subscription_id", table_name="hospitals")
    op.drop_index("ix_hospitals_purchaser_id", table_name="hospitals")
    op.drop_column("hospitals", "licence_number")
    op.drop_column("hospitals", "website")
    op.drop_column("hospitals", "contact_phone")
    op.drop_column("hospitals", "contact_email")
    op.drop_column("hospitals", "country")
    op.drop_column("hospitals", "state")
    op.drop_column("hospitals", "address")
    op.drop_column("hospitals", "facility_type")
    op.drop_column("hospitals", "subscription_id")
    op.drop_column("hospitals", "purchaser_id")

