"""create_clinical_tables

Revision ID: a8c5e3d7b921
Revises: f7b4c9e2d156
Create Date: 2026-11-13 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "a8c5e3d7b921"
down_revision: Union[str, None] = "f7b4c9e2d156"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # 1. patients table
    op.create_table(
        "patients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("mrn", sa.String(64), nullable=False, index=True),
        sa.Column("full_name", sa.String(255), nullable=False, index=True),
        sa.Column("age", sa.Integer(), nullable=False),
        sa.Column("gender", sa.String(32), nullable=False),
        sa.Column("blood_group", sa.String(16), nullable=False, server_default="Unknown"),
        sa.Column("contact_phone", sa.String(64), nullable=False),
        sa.Column("emergency_contact", sa.String(255), nullable=True),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("departments.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("triage_category", sa.String(32), nullable=False, server_default="Routine"),
        sa.Column(
            "attending_physician_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("attending_physician_name", sa.String(255), nullable=True),
        sa.Column("bed_or_room", sa.String(64), nullable=True),
        sa.Column("chief_complaint", sa.Text(), nullable=True),
        sa.Column("clinical_notes", sa.Text(), nullable=True),
        sa.Column("allergies", sa.Text(), nullable=True),
        sa.Column("chronic_conditions", sa.Text(), nullable=True),
        sa.Column("admission_status", sa.String(32), nullable=False, server_default="outpatient"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("hospital_id", "mrn", name="uq_patient_hospital_mrn"),
    )

    # 2. appointments table
    op.create_table(
        "appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("patient_mrn", sa.String(64), nullable=False, index=True),
        sa.Column("patient_name", sa.String(255), nullable=False),
        sa.Column(
            "doctor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("doctor_name", sa.String(255), nullable=False),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("departments.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("department_name", sa.String(255), nullable=False),
        sa.Column("appointment_time", sa.String(32), nullable=False),
        sa.Column("duration", sa.String(32), nullable=False, server_default="30 mins"),
        sa.Column("appointment_type", sa.String(64), nullable=False, server_default="Clinical Consultation"),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending", index=True),
        sa.Column("room", sa.String(64), nullable=False, server_default="Room 101"),
        sa.Column("priority", sa.String(32), nullable=False, server_default="Normal"),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # 3. patient_vitals table
    op.create_table(
        "patient_vitals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "recorded_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("recorded_by_name", sa.String(255), nullable=False),
        sa.Column("bp", sa.String(32), nullable=False),
        sa.Column("heart_rate", sa.Integer(), nullable=False),
        sa.Column("temperature", sa.String(32), nullable=False),
        sa.Column("spo2", sa.Integer(), nullable=False),
        sa.Column("respiratory_rate", sa.Integer(), nullable=True),
        sa.Column("blood_glucose", sa.String(32), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # 4. nursing_tasks table
    op.create_table(
        "nursing_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("departments.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("patient_name", sa.String(255), nullable=True),
        sa.Column("bed_number", sa.String(64), nullable=True),
        sa.Column(
            "assigned_to_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("task_type", sa.String(64), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("scheduled_time", sa.String(32), nullable=False),
        sa.Column("priority", sa.String(32), nullable=False, server_default="Routine"),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("completed_by_name", sa.String(255), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # 5. nursing_shifts table
    op.create_table(
        "nursing_shifts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("departments.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("shift_name", sa.String(64), nullable=False),
        sa.Column("nurse_name", sa.String(255), nullable=False),
        sa.Column("assigned_ward", sa.String(64), nullable=False),
        sa.Column("assigned_bed_count", sa.Integer(), nullable=False, server_default="6"),
        sa.Column("status", sa.String(32), nullable=False, server_default="on_duty"),
        sa.Column("shift_date", sa.String(32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("nursing_shifts")
    op.drop_table("nursing_tasks")
    op.drop_table("patient_vitals")
    op.drop_table("appointments")
    op.drop_table("patients")

