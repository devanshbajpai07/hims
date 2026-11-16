"""comprehensive_rbac_and_tier_authorization

Revision ID: e6a3c8f1d045
Revises: d5f2b9c0e143
Create Date: 2026-11-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e6a3c8f1d045"
down_revision: Union[str, None] = "d5f2b9c0e143"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create permissions table
    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(32), nullable=False, index=True),
        sa.Column("module", sa.String(32), nullable=False, index=True),
        sa.Column("risk_level", sa.String(16), nullable=False, server_default="standard"),
        sa.Column("tier_availability", sa.String(16), nullable=False, server_default="BASIC", index=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # 2. Add is_system to roles
    op.add_column(
        "roles",
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
    )

    # 3. Create role_versions table
    op.create_table(
        "role_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "role_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("roles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column(
            "parent_role_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("roles.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false", index=True),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("change_reason", sa.Text(), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("role_id", "version_number", name="uq_role_version_number"),
    )

    # 4. Add active_version_id to roles
    op.add_column(
        "roles",
        sa.Column(
            "active_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("role_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # 5. Create role_version_permissions join table
    op.create_table(
        "role_version_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "role_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("role_versions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "permission_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("permissions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("role_version_id", "permission_id", name="uq_role_version_perm"),
    )

    # 6. Create membership_permission_overrides table
    op.create_table(
        "membership_permission_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "membership_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenant_memberships.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "permission_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("permissions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("override_type", sa.String(16), nullable=False, index=True),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("departments.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "granted_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "revoked_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # 7. Add columns to role_assignments
    op.add_column("role_assignments", sa.Column("assignment_status", sa.String(32), nullable=False, server_default="active"))
    op.create_index("ix_role_assignments_assignment_status", "role_assignments", ["assignment_status"])
    op.add_column("role_assignments", sa.Column("assignment_source", sa.String(32), nullable=False, server_default="admin_assigned"))
    op.create_index("ix_role_assignments_assignment_source", "role_assignments", ["assignment_source"])
    op.add_column(
        "role_assignments",
        sa.Column("assigned_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "role_assignments",
        sa.Column("approved_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "role_assignments",
        sa.Column("role_version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("role_versions.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_role_assignments_role_version_id", "role_assignments", ["role_version_id"])
    op.add_column("role_assignments", sa.Column("scope_type", sa.String(32), nullable=False, server_default="DEPARTMENT"))
    op.add_column("role_assignments", sa.Column("scope_department_ids", sa.Text(), nullable=True))
    op.add_column("role_assignments", sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("role_assignments", sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "role_assignments",
        sa.Column("revoked_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )

    # 8. Add columns to departments
    op.add_column("departments", sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column(
        "departments",
        sa.Column("department_head_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_departments_department_head_user_id", "departments", ["department_head_user_id"])


def downgrade() -> None:
    op.drop_index("ix_departments_department_head_user_id", table_name="departments")
    op.drop_column("departments", "department_head_user_id")
    op.drop_column("departments", "is_system")

    op.drop_column("role_assignments", "revoked_by_user_id")
    op.drop_column("role_assignments", "revoked_at")
    op.drop_column("role_assignments", "activated_at")
    op.drop_column("role_assignments", "scope_department_ids")
    op.drop_column("role_assignments", "scope_type")
    op.drop_index("ix_role_assignments_role_version_id", table_name="role_assignments")
    op.drop_column("role_assignments", "role_version_id")
    op.drop_column("role_assignments", "approved_by_user_id")
    op.drop_column("role_assignments", "assigned_by_user_id")
    op.drop_index("ix_role_assignments_assignment_source", table_name="role_assignments")
    op.drop_column("role_assignments", "assignment_source")
    op.drop_index("ix_role_assignments_assignment_status", table_name="role_assignments")
    op.drop_column("role_assignments", "assignment_status")

    op.drop_table("membership_permission_overrides")
    op.drop_table("role_version_permissions")
    op.drop_column("roles", "active_version_id")
    op.drop_table("role_versions")
    op.drop_column("roles", "is_system")
    op.drop_table("permissions")

