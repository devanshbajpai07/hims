import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.hospital import Hospital
    from app.models.department import Department
    from app.models.user import User


class PatientRecord(Base, TimestampMixin):
    __tablename__ = "patients"
    __table_args__ = (
        UniqueConstraint("hospital_id", "mrn", name="uq_patient_hospital_mrn"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mrn: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    gender: Mapped[str] = mapped_column(String(32), nullable=False)
    blood_group: Mapped[str] = mapped_column(String(16), default="Unknown", nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(64), nullable=False)
    emergency_contact: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    triage_category: Mapped[str] = mapped_column(String(32), default="Routine", nullable=False)
    attending_physician_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    attending_physician_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bed_or_room: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    chief_complaint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    clinical_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    allergies: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chronic_conditions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    admission_status: Mapped[str] = mapped_column(String(32), default="outpatient", nullable=False)

    # Relationships
    hospital: Mapped["Hospital"] = relationship("Hospital")
    department: Mapped[Optional["Department"]] = relationship("Department")
    attending_physician: Mapped[Optional["User"]] = relationship("User", foreign_keys=[attending_physician_id])


class AppointmentRecord(Base, TimestampMixin):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_mrn: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    patient_name: Mapped[str] = mapped_column(String(255), nullable=False)

    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    doctor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    department_name: Mapped[str] = mapped_column(String(255), nullable=False)

    appointment_time: Mapped[str] = mapped_column(String(32), nullable=False)
    duration: Mapped[str] = mapped_column(String(32), default="30 mins", nullable=False)
    appointment_type: Mapped[str] = mapped_column(String(64), default="Clinical Consultation", nullable=False)
    # Status: pending, checked-in, in-progress, completed, cancelled
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    room: Mapped[str] = mapped_column(String(64), default="Consultation Suite", nullable=False)
    priority: Mapped[str] = mapped_column(String(32), default="Normal", nullable=False)

    checked_in_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    hospital: Mapped["Hospital"] = relationship("Hospital")
    patient: Mapped["PatientRecord"] = relationship("PatientRecord")
    department: Mapped[Optional["Department"]] = relationship("Department")


class PatientVitalRecord(Base, TimestampMixin):
    __tablename__ = "patient_vitals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recorded_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    recorded_by_name: Mapped[str] = mapped_column(String(255), nullable=False)

    bp: Mapped[str] = mapped_column(String(32), nullable=False)
    heart_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    temperature: Mapped[str] = mapped_column(String(32), nullable=False)
    spo2: Mapped[int] = mapped_column(Integer, nullable=False)
    respiratory_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    blood_glucose: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    patient: Mapped["PatientRecord"] = relationship("PatientRecord")


class NursingTaskRecord(Base, TimestampMixin):
    __tablename__ = "nursing_tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=True, index=True
    )
    patient_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bed_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    assigned_to_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    task_type: Mapped[str] = mapped_column(String(64), nullable=False)  # medication, vitals, wound_care, iv_line, handover, discharge
    description: Mapped[str] = mapped_column(Text, nullable=False)
    scheduled_time: Mapped[str] = mapped_column(String(32), nullable=False)
    priority: Mapped[str] = mapped_column(String(32), default="Routine", nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_by_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class NursingShiftRecord(Base, TimestampMixin):
    __tablename__ = "nursing_shifts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shift_name: Mapped[str] = mapped_column(String(64), nullable=False)  # Morning Shift, Afternoon Shift, Night Shift
    nurse_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    nurse_name: Mapped[str] = mapped_column(String(255), nullable=False)
    assigned_ward: Mapped[str] = mapped_column(String(64), nullable=False)
    assigned_bed_count: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="on_duty", nullable=False)  # on_duty, break, completed
    shift_date: Mapped[str] = mapped_column(String(32), nullable=False)

    department: Mapped["Department"] = relationship("Department")

