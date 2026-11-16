import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import jwt
from pwdlib import PasswordHash
from app.core.config import settings

# Initialize password hasher with Argon2
password_hash = PasswordHash.recommended()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored Argon2 hash."""
    return password_hash.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hashes a password using Argon2."""
    return password_hash.hash(password)


def generate_six_digit_otp() -> str:
    """Generates a cryptographically secure 6-digit OTP string."""
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(6))


def hash_otp(otp: str, salt: str) -> str:
    """
    Computes a cryptographic HMAC-SHA256 hash of the OTP bound to a salt
    (typically the challenge ID or registration session ID).
    Never stores the plaintext OTP in the database.
    """
    key = settings.SECRET_KEY.encode("utf-8")
    msg = f"{salt}:{otp}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def verify_otp_hash(plain_otp: str, salt: str, expected_hash: str) -> bool:
    """Constant-time verification of OTP against stored hash."""
    computed = hash_otp(plain_otp, salt)
    return hmac.compare_digest(computed, expected_hash)


def hash_token(token: str) -> str:
    """Computes SHA-256 hash of an opaque token for secure database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()



def create_access_token(
    subject: str,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Creates a signed JWT session or bearer token."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {
        "sub": subject,
        "jti": secrets.token_hex(16),
        "iat": now,
        "exp": expire,
        "iss": "HIMS-Auth-Service",
    }
    if extra_claims:
        to_encode.update(extra_claims)

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """Decodes and validates a signed JWT token."""
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        issuer="HIMS-Auth-Service",
    )
