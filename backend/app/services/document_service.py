"""Authoritative Medical and Institutional Document Service for AURA HIMS.

Enforces MIME type signature validation, SHA-256 checksums, tenant isolation,
transactional Filebase storage uploads, and HIPAA audit logging.
"""
import hashlib
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.audit import AuditLog
from app.models.department import Department
from app.models.document import DocumentRecord
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.user import User
from app.services.storage_service import StorageService

logger = logging.getLogger("hims.documents")

ALLOWED_EXTENSIONS = {
    "pdf", "png", "jpg", "jpeg", "tif", "tiff", "dcm", "txt", "csv"
}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "application/dicom",
    "text/plain",
    "text/csv",
}

BLOCKED_EXTENSIONS = {
    "exe", "bat", "sh", "cmd", "ps1", "vbs", "js", "py", "bin", "dll", "so", "msi", "scr"
}

# Magic signatures
FILE_SIGNATURES = [
    (b"%PDF", "application/pdf"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"II*\x00", "image/tiff"),
    (b"MM\x00*", "image/tiff"),
]


def sanitize_filename(name: str) -> str:
    """Removes path traversal, control characters, and unsafe symbols."""
    base = os.path.basename(name).strip()
    clean = re.sub(r"[^\w\s\.-]", "_", base)
    return clean[:128] or "document"


def validate_file_content(content: bytes, original_filename: str, declared_mime: str) -> str:
    """Validates extension, size, MIME type, and magic bytes. Returns canonical MIME type."""
    # 1. Size check
    if len(content) > settings.MAX_DOCUMENT_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_DOCUMENT_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB.",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty (0 bytes).",
        )

    # 2. Extension check
    parts = original_filename.rsplit(".", 1)
    ext = parts[1].lower() if len(parts) > 1 else ""
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Executable and script files ('.{ext}') are strictly prohibited.",
        )

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file format '.{ext}'. Supported extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}.",
        )

    # 3. Magic signature verification
    canonical_mime = declared_mime.lower().split(";")[0].strip()
    for sig, sig_mime in FILE_SIGNATURES:
        if content.startswith(sig):
            canonical_mime = sig_mime
            break

    if canonical_mime not in ALLOWED_MIME_TYPES:
        # If text/csv/plain, verify ASCII/UTF-8
        if ext in ("txt", "csv"):
            try:
                content[:1024].decode("utf-8")
                canonical_mime = "text/csv" if ext == "csv" else "text/plain"
            except UnicodeDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail="Binary content detected in text file.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"MIME type '{declared_mime}' is not permitted.",
            )

    return canonical_mime


class DocumentService:
    @classmethod
    def upload_document(
        cls,
        db: Session,
        hospital_id: uuid.UUID,
        uploader_user_id: uuid.UUID,
        file_bytes: bytes,
        original_filename: str,
        declared_mime: str,
        title: str,
        category: str = "clinical_chart",
        patient_id: Optional[str] = None,
        encounter_id: Optional[str] = None,
        department_id: Optional[uuid.UUID] = None,
        access_classification: str = "standard",
        ip_address: Optional[str] = None,
    ) -> DocumentRecord:
        """Atomically stores binary into Filebase and persists metadata into Neon PostgreSQL."""
        # 1. Validate hospital
        hospital = db.query(Hospital).filter(Hospital.id == hospital_id, Hospital.is_active == True).first()
        if not hospital:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital not found.")

        # 2. Validate department if provided
        if department_id:
            dept = db.query(Department).filter(
                Department.id == department_id,
                Department.hospital_id == hospital_id,
            ).first()
            if not dept:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Department does not belong to this hospital facility.",
                )

        # 3. Validate content & compute SHA-256
        safe_name = sanitize_filename(original_filename)
        canonical_mime = validate_file_content(file_bytes, safe_name, declared_mime)
        checksum = hashlib.sha256(file_bytes).hexdigest()
        file_size = len(file_bytes)

        # 4. Generate random non-guessable storage key
        random_suffix = uuid.uuid4().hex
        object_key = f"{hospital_id}/{random_suffix}_{safe_name}"

        # 5. Upload to Filebase
        if not StorageService.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Filebase document storage is not configured on this institution server.",
            )

        try:
            StorageService.upload_bytes(
                data=file_bytes,
                object_key=object_key,
                content_type=canonical_mime,
                metadata={
                    "hospital-id": str(hospital_id),
                    "uploader-id": str(uploader_user_id),
                    "checksum": checksum,
                },
            )
        except Exception as e:
            logger.error("Storage upload failed: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Storage upload failed: {str(e)}",
            )

        # 6. Persist metadata record in PostgreSQL transaction
        try:
            doc = DocumentRecord(
                id=uuid.uuid4(),
                hospital_id=hospital_id,
                patient_id=patient_id,
                encounter_id=encounter_id,
                department_id=department_id,
                category=category,
                title=title.strip() or safe_name,
                original_filename=safe_name,
                storage_key=object_key,
                mime_type=canonical_mime,
                file_size=file_size,
                checksum_sha256=checksum,
                status="active",
                access_classification=access_classification,
                uploaded_by_user_id=uploader_user_id,
            )
            db.add(doc)

            # Audit record
            db.add(AuditLog(
                hospital_id=hospital_id,
                user_id=uploader_user_id,
                action="DOCUMENT_UPLOAD",
                resource_type="document",
                resource_id=str(doc.id),
                details=f"Uploaded '{safe_name}' ({file_size} bytes, SHA-256: {checksum[:8]}...) to category '{category}'",
                ip_address=ip_address,
            ))

            db.commit()
            db.refresh(doc)
            return doc
        except Exception as db_err:
            db.rollback()
            # Cleanup orphaned object in storage to prevent inconsistent storage state
            logger.warning("Database commit failed; rolling back Filebase object '%s'", object_key)
            StorageService.delete_object(object_key)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database persistence failed during document registration.",
            )

    @classmethod
    def list_documents(
        cls,
        db: Session,
        hospital_id: uuid.UUID,
        patient_id: Optional[str] = None,
        encounter_id: Optional[str] = None,
        department_id: Optional[uuid.UUID] = None,
        category: Optional[str] = None,
        status_filter: str = "active",
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[DocumentRecord], int]:
        """Lists document records with hospital isolation, patient-level ownership, and category filters."""
        query = db.query(DocumentRecord).options(
            joinedload(DocumentRecord.uploader),
            joinedload(DocumentRecord.department),
        ).filter(DocumentRecord.hospital_id == hospital_id)

        if status_filter != "all":
            query = query.filter(DocumentRecord.status == status_filter)
        if patient_id:
            from app.models.clinical import PatientRecord
            # Support patient-level document ownership across encounters and identifiers (UUID / MRN)
            patient_matches = {patient_id}
            try:
                p_uuid = uuid.UUID(patient_id)
                pat = db.query(PatientRecord).filter(
                    PatientRecord.hospital_id == hospital_id,
                    PatientRecord.id == p_uuid
                ).first()
            except ValueError:
                pat = db.query(PatientRecord).filter(
                    PatientRecord.hospital_id == hospital_id,
                    PatientRecord.mrn == patient_id
                ).first()

            if pat:
                patient_matches.add(str(pat.id))
                patient_matches.add(pat.mrn)

            query = query.filter(DocumentRecord.patient_id.in_(list(patient_matches)))
        if encounter_id:
            query = query.filter(DocumentRecord.encounter_id == encounter_id)
        if department_id:
            query = query.filter(DocumentRecord.department_id == department_id)
        if category:
            query = query.filter(DocumentRecord.category == category)

        total = query.count()
        docs = query.order_by(DocumentRecord.created_at.desc()).offset(offset).limit(limit).all()
        return docs, total

    @classmethod
    def get_document_by_id(
        cls,
        db: Session,
        document_id: uuid.UUID,
        hospital_id: uuid.UUID,
    ) -> DocumentRecord:
        """Retrieves single document with tenant isolation check."""
        doc = db.query(DocumentRecord).options(
            joinedload(DocumentRecord.uploader),
            joinedload(DocumentRecord.department),
        ).filter(
            DocumentRecord.id == document_id,
            DocumentRecord.hospital_id == hospital_id,
        ).first()

        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found or does not belong to your hospital facility.",
            )
        return doc

    @classmethod
    def generate_download_url(
        cls,
        db: Session,
        document_id: uuid.UUID,
        hospital_id: uuid.UUID,
        user_id: uuid.UUID,
        expires_in_seconds: int = 300,
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generates short-lived presigned URL after verifying tenant isolation and permissions."""
        doc = cls.get_document_by_id(db, document_id, hospital_id)

        if doc.status == "deleted":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Document has been deleted and cannot be downloaded.",
            )

        url = StorageService.generate_presigned_download_url(
            object_key=doc.storage_key,
            expires_in_seconds=expires_in_seconds,
            download_filename=doc.original_filename,
        )

        # Audit download event
        db.add(AuditLog(
            hospital_id=hospital_id,
            user_id=user_id,
            action="DOCUMENT_DOWNLOAD",
            resource_type="document",
            resource_id=str(doc.id),
            details=f"Generated presigned download link ({expires_in_seconds}s expiry) for '{doc.original_filename}'",
            ip_address=ip_address,
        ))
        db.commit()

        return {
            "document_id": str(doc.id),
            "download_url": url,
            "expires_in_seconds": expires_in_seconds,
            "filename": doc.original_filename,
            "mime_type": doc.mime_type,
            "file_size": doc.file_size,
            "checksum_sha256": doc.checksum_sha256,
        }

    @classmethod
    def archive_document(
        cls,
        db: Session,
        document_id: uuid.UUID,
        hospital_id: uuid.UUID,
        user_id: uuid.UUID,
        ip_address: Optional[str] = None,
    ) -> DocumentRecord:
        """Soft-archives a document while preserving immutable file in storage."""
        doc = cls.get_document_by_id(db, document_id, hospital_id)
        now = datetime.now(timezone.utc)
        doc.status = "archived"
        doc.archived_at = now
        doc.archived_by_user_id = user_id

        db.add(AuditLog(
            hospital_id=hospital_id,
            user_id=user_id,
            action="DOCUMENT_ARCHIVE",
            resource_type="document",
            resource_id=str(doc.id),
            details=f"Archived document '{doc.original_filename}'",
            ip_address=ip_address,
        ))
        db.commit()
        db.refresh(doc)
        return doc

    @classmethod
    def delete_document(
        cls,
        db: Session,
        document_id: uuid.UUID,
        hospital_id: uuid.UUID,
        user_id: uuid.UUID,
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Permanently deletes document record and object from Filebase storage."""
        doc = cls.get_document_by_id(db, document_id, hospital_id)

        # Delete from Filebase
        StorageService.delete_object(doc.storage_key)

        # Remove from database
        db.delete(doc)

        db.add(AuditLog(
            hospital_id=hospital_id,
            user_id=user_id,
            action="DOCUMENT_DELETE",
            resource_type="document",
            resource_id=str(document_id),
            details=f"Permanently deleted document '{doc.original_filename}'",
            ip_address=ip_address,
        ))
        db.commit()
        return {"success": True, "message": f"Document '{doc.original_filename}' has been permanently deleted."}

