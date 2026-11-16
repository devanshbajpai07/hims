"""create_documents_table

Revision ID: f7b4c9e2d156
Revises: e6a3c8f1d045
Create Date: 2026-11-13 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f7b4c9e2d156"
down_revision: Union[str, None] = "e6a3c8f1d045"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("patient_id", sa.String(128), nullable=True, index=True),
        sa.Column("encounter_id", sa.String(128), nullable=True, index=True),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("departments.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("category", sa.String(64), nullable=False, server_default="clinical_chart", index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=False, unique=True, index=True),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("checksum_sha256", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="active", index=True),
        sa.Column("access_classification", sa.String(32), nullable=False, server_default="standard"),
        sa.Column(
            "uploaded_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "archived_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_documents_hospital_patient", "documents", ["hospital_id", "patient_id"])
    op.create_index("ix_documents_hospital_dept", "documents", ["hospital_id", "department_id"])
    op.create_index("ix_documents_hospital_category", "documents", ["hospital_id", "category"])


def downgrade() -> None:
    op.drop_index("ix_documents_hospital_category", table_name="documents")
    op.drop_index("ix_documents_hospital_dept", table_name="documents")
    op.drop_index("ix_documents_hospital_patient", table_name="documents")
    op.drop_table("documents")

