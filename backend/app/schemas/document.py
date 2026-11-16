import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DocumentItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hospital_id: uuid.UUID
    patient_id: Optional[str] = None
    encounter_id: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    department_name: Optional[str] = None
    category: str
    title: str
    original_filename: str
    mime_type: str
    file_size: int
    checksum_sha256: str
    status: str
    access_classification: str
    uploaded_by_user_id: uuid.UUID
    uploader_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    archived_at: Optional[datetime] = None


class DocumentListResponse(BaseModel):
    total: int
    documents: List[DocumentItemResponse]


class PresignedDownloadResponse(BaseModel):
    document_id: str
    download_url: str
    expires_in_seconds: int
    filename: str
    mime_type: str
    file_size: int
    checksum_sha256: str


class StorageStatusResponse(BaseModel):
    configured: bool
    status: str
    bucket: Optional[str] = None
    endpoint: Optional[str] = None
    message: Optional[str] = None
