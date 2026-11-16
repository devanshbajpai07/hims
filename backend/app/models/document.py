import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DocumentRecord(Base):
    """Authoritative metadata record for medical and institutional documents.
    Binary files are stored securely in S3-compatible Filebase storage with randomized,
    non-guessable storage keys. Neon PostgreSQL stores strict indexing, categorization,
    HIPAA audit attribution, and access classification.
    """
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, index=True
    )
    encounter_id: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, index=True
    )
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    category: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="clinical_chart",
        index=True,
    )  # "clinical_chart", "lab_report", "imaging_scan", "prescription_record", "referral_letter", "administrative"
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(
        String(512), nullable=False, unique=True, index=True
    )
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="active", index=True
    )  # "active", "archived", "deleted"
    access_classification: Mapped[str] = mapped_column(
        String(32), nullable=False, default="standard"
    )  # "standard", "restricted", "confidential"

    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    archived_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    hospital = relationship("Hospital", backref="documents")
    department = relationship("Department", backref="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by_user_id])
    archiver = relationship("User", foreign_keys=[archived_by_user_id])

    __table_args__ = (
        Index("ix_documents_hospital_patient", "hospital_id", "patient_id"),
        Index("ix_documents_hospital_dept", "hospital_id", "department_id"),
        Index("ix_documents_hospital_category", "hospital_id", "category"),
    )

