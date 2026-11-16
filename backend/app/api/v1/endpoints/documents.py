import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps_admin import AdminContext, get_current_admin
from app.api.deps_employee import EmployeeContext, get_current_employee
from app.db.database import get_db
from app.schemas.document import (
    DocumentItemResponse,
    DocumentListResponse,
    PresignedDownloadResponse,
    StorageStatusResponse,
)
from app.services.authorization_service import require_permission
from app.services.document_service import DocumentService
from app.services.storage_service import StorageService

router = APIRouter(prefix="/documents", tags=["Clinical & Institutional Documents"])


@router.get("/storage-status", response_model=StorageStatusResponse)
def get_storage_status():
    """Non-destructive status check verifying whether Filebase storage is configured and online."""
    health = StorageService.check_health()
    return StorageStatusResponse(
        configured=health.get("configured", False),
        status=health.get("status", "UNCONFIGURED"),
        bucket=health.get("bucket"),
        endpoint=health.get("endpoint"),
        message=health.get("message"),
    )


@router.post("/upload", response_model=DocumentItemResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form("clinical_chart"),
    patient_id: Optional[str] = Form(None),
    encounter_id: Optional[str] = Form(None),
    department_id: Optional[uuid.UUID] = Form(None),
    access_classification: str = Form("standard"),
    request: Request = None,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    _: Any = Depends(require_permission("document:upload")),
    db: Session = Depends(get_db),
):
    """Securely uploads a document binary to Filebase S3-compatible storage and indexes
    its metadata in PostgreSQL. Enforces size limits, MIME type signature checks, and HIPAA audit trails.
    """
    file_bytes = await file.read()
    ip_addr = request.client.host if request and request.client else None

    doc = DocumentService.upload_document(
        db=db,
        hospital_id=emp_ctx.hospital.id,
        uploader_user_id=emp_ctx.user.id,
        file_bytes=file_bytes,
        original_filename=file.filename or "uploaded_file",
        declared_mime=file.content_type or "application/octet-stream",
        title=title,
        category=category,
        patient_id=patient_id,
        encounter_id=encounter_id,
        department_id=department_id,
        access_classification=access_classification,
        ip_address=ip_addr,
    )
    return DocumentItemResponse(
        id=doc.id,
        hospital_id=doc.hospital_id,
        patient_id=doc.patient_id,
        encounter_id=doc.encounter_id,
        department_id=doc.department_id,
        department_name=doc.department.name if doc.department else None,
        category=doc.category,
        title=doc.title,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        file_size=doc.file_size,
        checksum_sha256=doc.checksum_sha256,
        status=doc.status,
        access_classification=doc.access_classification,
        uploaded_by_user_id=doc.uploaded_by_user_id,
        uploader_name=doc.uploader.full_name if doc.uploader else None,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        archived_at=doc.archived_at,
    )


@router.get("", response_model=DocumentListResponse)
def list_documents(
    patient_id: Optional[str] = Query(None),
    encounter_id: Optional[str] = Query(None),
    department_id: Optional[uuid.UUID] = Query(None),
    category: Optional[str] = Query(None),
    status_filter: str = Query("active"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    _: Any = Depends(require_permission("document:read")),
    db: Session = Depends(get_db),
):
    """Lists indexed documents within the active hospital facility context."""
    docs, total = DocumentService.list_documents(
        db=db,
        hospital_id=emp_ctx.hospital.id,
        patient_id=patient_id,
        encounter_id=encounter_id,
        department_id=department_id,
        category=category,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )
    items = [
        DocumentItemResponse(
            id=d.id,
            hospital_id=d.hospital_id,
            patient_id=d.patient_id,
            encounter_id=d.encounter_id,
            department_id=d.department_id,
            department_name=d.department.name if d.department else None,
            category=d.category,
            title=d.title,
            original_filename=d.original_filename,
            mime_type=d.mime_type,
            file_size=d.file_size,
            checksum_sha256=d.checksum_sha256,
            status=d.status,
            access_classification=d.access_classification,
            uploaded_by_user_id=d.uploaded_by_user_id,
            uploader_name=d.uploader.full_name if d.uploader else None,
            created_at=d.created_at,
            updated_at=d.updated_at,
            archived_at=d.archived_at,
        )
        for d in docs
    ]
    return DocumentListResponse(total=total, documents=items)


@router.get("/{document_id}", response_model=DocumentItemResponse)
def get_document_detail(
    document_id: uuid.UUID,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    _: Any = Depends(require_permission("document:read")),
    db: Session = Depends(get_db),
):
    """Retrieves document metadata by ID, strictly enforcing tenant isolation."""
    d = DocumentService.get_document_by_id(db, document_id, emp_ctx.hospital.id)
    return DocumentItemResponse(
        id=d.id,
        hospital_id=d.hospital_id,
        patient_id=d.patient_id,
        encounter_id=d.encounter_id,
        department_id=d.department_id,
        department_name=d.department.name if d.department else None,
        category=d.category,
        title=d.title,
        original_filename=d.original_filename,
        mime_type=d.mime_type,
        file_size=d.file_size,
        checksum_sha256=d.checksum_sha256,
        status=d.status,
        access_classification=d.access_classification,
        uploaded_by_user_id=d.uploaded_by_user_id,
        uploader_name=d.uploader.full_name if d.uploader else None,
        created_at=d.created_at,
        updated_at=d.updated_at,
        archived_at=d.archived_at,
    )


@router.get("/{document_id}/download", response_model=PresignedDownloadResponse)
def get_document_download_url(
    document_id: uuid.UUID,
    expires_in_seconds: int = Query(300, ge=60, le=3600),
    request: Request = None,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    _: Any = Depends(require_permission("document:download")),
    db: Session = Depends(get_db),
):
    """Generates a secure, short-lived presigned download URL for verified documents.
    Presigned URLs expire after the specified lifespan and are never stored or logged in plaintext.
    """
    ip_addr = request.client.host if request and request.client else None
    return DocumentService.generate_download_url(
        db=db,
        document_id=document_id,
        hospital_id=emp_ctx.hospital.id,
        user_id=emp_ctx.user.id,
        expires_in_seconds=expires_in_seconds,
        ip_address=ip_addr,
    )


@router.post("/{document_id}/archive", response_model=DocumentItemResponse)
def archive_document(
    document_id: uuid.UUID,
    request: Request = None,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    _: Any = Depends(require_permission("document:archive")),
    db: Session = Depends(get_db),
):
    """Soft-archives a document while retaining the underlying encrypted file in storage."""
    ip_addr = request.client.host if request and request.client else None
    d = DocumentService.archive_document(
        db=db,
        document_id=document_id,
        hospital_id=emp_ctx.hospital.id,
        user_id=emp_ctx.user.id,
        ip_address=ip_addr,
    )
    return DocumentItemResponse(
        id=d.id,
        hospital_id=d.hospital_id,
        patient_id=d.patient_id,
        encounter_id=d.encounter_id,
        department_id=d.department_id,
        department_name=d.department.name if d.department else None,
        category=d.category,
        title=d.title,
        original_filename=d.original_filename,
        mime_type=d.mime_type,
        file_size=d.file_size,
        checksum_sha256=d.checksum_sha256,
        status=d.status,
        access_classification=d.access_classification,
        uploaded_by_user_id=d.uploaded_by_user_id,
        uploader_name=d.uploader.full_name if d.uploader else None,
        created_at=d.created_at,
        updated_at=d.updated_at,
        archived_at=d.archived_at,
    )


@router.delete("/{document_id}")
def delete_document(
    document_id: uuid.UUID,
    request: Request = None,
    admin_ctx: AdminContext = Depends(get_current_admin),
    _: Any = Depends(require_permission("document:delete")),
    db: Session = Depends(get_db),
):
    """Permanently deletes document record and purge object from Filebase storage.
    Restricted to higher subscription tiers and verified institutional administrators.
    """
    ip_addr = request.client.host if request and request.client else None
    return DocumentService.delete_document(
        db=db,
        document_id=document_id,
        hospital_id=admin_ctx.hospital.id,
        user_id=admin_ctx.user.id,
        ip_address=ip_addr,
    )

