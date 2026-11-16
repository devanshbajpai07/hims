"""Authoritative Filebase S3-Compatible Object Storage Service for AURA HIMS.

Securely handles private document binary storage, short-lived presigned URLs,
content verification, and cleanup. Never exposes storage credentials or permanent
public URLs.
"""
import io
import logging
from typing import Any, Dict, Optional, Tuple
import urllib.parse

from app.core.config import settings

logger = logging.getLogger("hims.storage")

# Lazy-loaded S3 client
_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is not None:
        return _s3_client

    if not StorageService.is_configured():
        return None

    try:
        import boto3
        from botocore.client import Config

        _s3_client = boto3.client(
            "s3",
            endpoint_url=settings.FILEBASE_ENDPOINT_URL,
            region_name=settings.FILEBASE_REGION or "auto",
            aws_access_key_id=settings.FILEBASE_ACCESS_KEY_ID,
            aws_secret_access_key=settings.FILEBASE_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
        return _s3_client
    except Exception as e:
        logger.error("Failed to initialize Filebase S3 client: %s", str(e))
        return None


class StorageService:
    @classmethod
    def is_configured(cls) -> bool:
        """Checks whether Filebase credentials and bucket are present."""
        return bool(
            settings.FILEBASE_ACCESS_KEY_ID
            and settings.FILEBASE_SECRET_ACCESS_KEY
            and settings.FILEBASE_BUCKET_NAME
            and settings.FILEBASE_ENDPOINT_URL
        )

    @classmethod
    def upload_bytes(
        cls,
        data: bytes,
        object_key: str,
        content_type: str,
        metadata: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Uploads binary data to Filebase bucket under the given non-guessable object key.
        Bucket remains strictly private; no public ACLs are set.
        """
        if not cls.is_configured():
            raise RuntimeError(
                "Filebase storage is not configured. Please verify environment credentials."
            )

        client = _get_s3_client()
        if client is None:
            raise RuntimeError("Filebase S3 client is unavailable.")

        extra_args: Dict[str, Any] = {
            "Bucket": settings.FILEBASE_BUCKET_NAME,
            "Key": object_key,
            "Body": data,
            "ContentType": content_type,
        }
        if metadata:
            extra_args["Metadata"] = metadata

        try:
            response = client.put_object(**extra_args)
            return {
                "etag": response.get("ETag", "").strip('"'),
                "version_id": response.get("VersionId"),
                "storage_key": object_key,
            }
        except Exception as e:
            logger.error("Filebase upload failed for key '%s': %s", object_key, str(e))
            raise RuntimeError(f"Storage upload failed: {str(e)}") from e

    @classmethod
    def generate_presigned_download_url(
        cls,
        object_key: str,
        expires_in_seconds: int = 300,
        download_filename: Optional[str] = None,
    ) -> str:
        """Generates a secure, time-limited presigned GET URL for verified medical documents.
        Never logs or exposes permanent URLs.
        """
        if not cls.is_configured():
            raise RuntimeError("Filebase storage is not configured.")

        client = _get_s3_client()
        if client is None:
            raise RuntimeError("Filebase S3 client is unavailable.")

        params: Dict[str, Any] = {
            "Bucket": settings.FILEBASE_BUCKET_NAME,
            "Key": object_key,
        }
        if download_filename:
            safe_name = urllib.parse.quote(download_filename)
            params["ResponseContentDisposition"] = f"attachment; filename=\"{safe_name}\""

        try:
            url = client.generate_presigned_url(
                ClientMethod="get_object",
                Params=params,
                ExpiresIn=expires_in_seconds,
            )
            return url
        except Exception as e:
            logger.error("Presigned URL generation failed for key '%s': %s", object_key, str(e))
            raise RuntimeError(f"Presigned URL generation failed: {str(e)}") from e

    @classmethod
    def download_bytes(cls, object_key: str) -> Tuple[bytes, str]:
        """Directly retrieves file bytes and MIME type from Filebase for backend streaming."""
        if not cls.is_configured():
            raise RuntimeError("Filebase storage is not configured.")

        client = _get_s3_client()
        if client is None:
            raise RuntimeError("Filebase S3 client is unavailable.")

        try:
            res = client.get_object(Bucket=settings.FILEBASE_BUCKET_NAME, Key=object_key)
            body = res["Body"].read()
            content_type = res.get("ContentType", "application/octet-stream")
            return body, content_type
        except Exception as e:
            logger.error("Failed to download object '%s': %s", object_key, str(e))
            raise RuntimeError(f"Storage download failed: {str(e)}") from e

    @classmethod
    def delete_object(cls, object_key: str) -> bool:
        """Deletes an object from the Filebase bucket."""
        if not cls.is_configured():
            return False

        client = _get_s3_client()
        if client is None:
            return False

        try:
            client.delete_object(Bucket=settings.FILEBASE_BUCKET_NAME, Key=object_key)
            return True
        except Exception as e:
            logger.error("Failed to delete object '%s': %s", object_key, str(e))
            return False

    @classmethod
    def check_health(cls) -> Dict[str, Any]:
        """Non-destructive health and connectivity probe for Filebase storage."""
        if not cls.is_configured():
            return {
                "configured": False,
                "status": "UNCONFIGURED",
                "message": "Filebase credentials are not present in backend configuration.",
            }

        client = _get_s3_client()
        if client is None:
            return {
                "configured": True,
                "status": "UNAVAILABLE",
                "message": "S3 client initialization failed.",
            }

        try:
            client.head_bucket(Bucket=settings.FILEBASE_BUCKET_NAME)
            return {
                "configured": True,
                "status": "ONLINE",
                "bucket": settings.FILEBASE_BUCKET_NAME,
                "endpoint": settings.FILEBASE_ENDPOINT_URL,
            }
        except Exception as e:
            logger.warning("Filebase health check warning: %s", str(e))
            return {
                "configured": True,
                "status": "DEGRADED",
                "message": str(e),
                "bucket": settings.FILEBASE_BUCKET_NAME,
            }

