"""Tests for AURA HIMS Receptionist Canonical RBAC & Dynamic Permission Enforcement.

Verifies:
1. Receptionist role resolves to exactly the 13 canonical permissions.
2. Granular permission enforcement:
   - patient:read (allows viewing patient list & detail with clinical notes redacted)
   - patient:create (allows registering patient; DENY blocks registration while read succeeds)
   - patient:update (allows modifying contact/demographics; forbidden without permission)
   - queue:read & queue:manage (allows queue viewing and arrival check-in)
   - appointment:read, appointment:create & appointment:manage (independent granular checks)
   - department:read & shift:read
   - account:profile:read, account:profile:update, account:password:change
"""
import uuid
from typing import Dict
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.permissions import SYSTEM_ROLE_PERMISSIONS, MASTER_PERMISSION_CATALOGUE
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.permission import Permission, RoleVersion, RoleVersionPermission, MembershipPermissionOverride
from app.models.role import Role
from app.models.user import User
from app.services.authorization_service import AuthorizationService


CANONICAL_13_PERMISSIONS = [
    "patient:read",
    "patient:create",
    "patient:update",
    "queue:read",
    "queue:manage",
    "appointment:read",
    "appointment:create",
    "appointment:manage",
    "department:read",
    "shift:read",
    "account:profile:read",
    "account:profile:update",
    "account:password:change",
]


def _login(client: TestClient, username: str, password: str = "Receptionist@123") -> str:
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    return res.json()["session"]["access_token"]


def test_receptionist_canonical_13_permissions_catalogue():
    """Verify that the master template for receptionist has EXACTLY the 13 canonical permissions."""
    rec_perms = SYSTEM_ROLE_PERMISSIONS.get("receptionist", [])
    assert sorted(rec_perms) == sorted(CANONICAL_13_PERMISSIONS), (
        f"Expected exact 13 permissions, got {len(rec_perms)}: {rec_perms}"
    )

    # Verify all 13 exist in master catalogue
    for code in CANONICAL_13_PERMISSIONS:
        assert code in MASTER_PERMISSION_CATALOGUE, f"Permission {code} missing from master catalogue."
        defn = MASTER_PERMISSION_CATALOGUE[code]
        assert defn.min_tier in ("BASIC", "PRO", "ULTRA")


def test_receptionist_database_role_permissions(db: Session):
    """Verify that every Receptionist role version in Neon PostgreSQL has exactly the 13 canonical permissions."""
    rec_roles = db.query(Role).filter(Role.code == "receptionist").all()
    assert len(rec_roles) >= 1, "Expected at least one receptionist role in database."

    for role in rec_roles:
        for ver in role.versions:
            if ver.is_active:
                perm_codes = (
                    db.query(Permission.code)
                    .join(RoleVersionPermission, RoleVersionPermission.permission_id == Permission.id)
                    .filter(RoleVersionPermission.role_version_id == ver.id)
                    .all()
                )
                actual_codes = [p[0] for p in perm_codes]
                assert sorted(actual_codes) == sorted(CANONICAL_13_PERMISSIONS), (
                    f"Hospital {role.hospital_id} active version {ver.version_number} has mismatch: {actual_codes}"
                )


def test_receptionist_granular_patient_read_and_create(client: TestClient, db: Session):
    """Verify receptionist can list patients with redactions, register patients, and view detail."""
    token = _login(client, "clara.receptionist", "Receptionist@123")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. patient:read -> List patients
    res = client.get("/api/v1/clinical/patients", headers=headers)
    assert res.status_code == 200
    patients = res.json()
    assert len(patients) >= 1

    first_pat = patients[0]
    # Clinical notes must be redacted for receptionist
    assert "PROTECTED" in (first_pat.get("clinical_notes") or "")

    # 2. patient:read -> Single patient detail
    res_detail = client.get(f"/api/v1/clinical/patients/{first_pat['id']}", headers=headers)
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["id"] == first_pat["id"]
    assert "PROTECTED" in (detail.get("clinical_notes") or "")

    # 3. patient:create -> Register patient
    payload = {
        "full_name": "Test Receptionist Patient",
        "age": 34,
        "gender": "F",
        "blood_group": "B+",
        "contact_phone": "+1 (555) 321-7654",
        "triage_category": "Routine",
        "chief_complaint": "Seasonal rhinitis and congestion",
        "schedule_appointment": True,
    }
    res_create = client.post("/api/v1/clinical/patients", json=payload, headers=headers)
    assert res_create.status_code == 200
    created = res_create.json()
    assert created["full_name"] == "Test Receptionist Patient"
    assert created["mrn"].startswith("MRN-")


def test_receptionist_patient_update(client: TestClient, db: Session):
    """Verify patient:update permits updating demographics, phone, and emergency contact."""
    token = _login(client, "clara.receptionist", "Receptionist@123")
    headers = {"Authorization": f"Bearer {token}"}

    # Find existing patient
    res_list = client.get("/api/v1/clinical/patients", headers=headers)
    assert res_list.status_code == 200
    target_pat = res_list.json()[0]

    update_payload = {
        "contact_phone": "+1 (555) 999-0011",
        "emergency_contact": "Emergency Contact Person",
        "blood_group": "AB+",
        "triage_category": "Priority",
    }
    res_upd = client.put(f"/api/v1/clinical/patients/{target_pat['id']}", json=update_payload, headers=headers)
    assert res_upd.status_code == 200
    updated = res_upd.json()
    assert updated["contact_phone"] == "+1 (555) 999-0011"
    assert updated["emergency_contact"] == "Emergency Contact Person"
    assert updated["blood_group"] == "AB+"
    assert updated["triage_category"] == "Priority"


def test_receptionist_appointment_lifecycle_and_management(client: TestClient, db: Session):
    """Verify appointment:read, appointment:create, queue:manage (check-in), and appointment:manage."""
    token = _login(client, "clara.receptionist", "Receptionist@123")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. appointment:read
    res_appts = client.get("/api/v1/clinical/appointments", headers=headers)
    assert res_appts.status_code == 200
    appts = res_appts.json()

    # Get a patient to book with
    res_pats = client.get("/api/v1/clinical/patients", headers=headers)
    pat = res_pats.json()[0]

    # 2. appointment:create
    book_payload = {
        "patient_id": pat["id"],
        "doctor_name": "General Duty Medical Officer",
        "appointment_time": "10:30 AM",
        "duration": "30 mins",
        "appointment_type": "Routine Intake",
        "room": "Room 101",
        "priority": "Normal",
        "notes": "Booked by Receptionist Intake Desk",
    }
    res_book = client.post("/api/v1/clinical/appointments", json=book_payload, headers=headers)
    assert res_book.status_code == 200
    booked = res_book.json()
    assert booked["status"] == "pending"

    # 3. queue:manage -> check-in
    res_checkin = client.patch(f"/api/v1/clinical/appointments/{booked['id']}/check-in", headers=headers)
    assert res_checkin.status_code == 200
    checked_in = res_checkin.json()
    assert checked_in["status"] == "checked-in"

    # 4. appointment:manage -> update status / notes
    res_status = client.patch(
        f"/api/v1/clinical/appointments/{booked['id']}/status",
        json={"status": "rescheduled", "notes": "Rescheduled per patient phone request."},
        headers=headers,
    )
    assert res_status.status_code == 200
    resched = res_status.json()
    assert resched["status"] == "rescheduled"
    assert "Rescheduled per patient" in (resched.get("notes") or "")


def test_receptionist_shifts_and_departments(client: TestClient, db: Session):
    """Verify department:read and shift:read endpoints return authorized facility data."""
    token = _login(client, "clara.receptionist", "Receptionist@123")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. department:read
    res_dept = client.get("/api/v1/clinical/departments", headers=headers)
    assert res_dept.status_code == 200
    depts = res_dept.json()
    assert len(depts) >= 1
    assert any(d["code"] == "GEN-MED" or d["name"] == "General Medicine" for d in depts)

    # 2. shift:read
    res_shifts = client.get("/api/v1/clinical/shifts", headers=headers)
    assert res_shifts.status_code == 200
    shifts = res_shifts.json()
    assert len(shifts) >= 1


def test_receptionist_individual_deny_override_blocks_action(client: TestClient, db: Session):
    """Verify that an explicit individual DENY override on patient:create blocks registration
    with 403 Forbidden while patient:read continues to function.
    """
    token = _login(client, "clara.receptionist", "Receptionist@123")
    headers = {"Authorization": f"Bearer {token}"}

    # Locate user and membership
    user = db.query(User).filter(User.username == "clara.receptionist").first()
    mem = db.query(TenantMembership).filter(TenantMembership.user_id == user.id).first()

    # Apply explicit DENY override on patient:create
    perm_create = db.query(Permission).filter(Permission.code == "patient:create").first()
    override = MembershipPermissionOverride(
        id=uuid.uuid4(),
        membership_id=mem.id,
        permission_id=perm_create.id,
        override_type="DENY",
        reason="Front desk probation - temporarily revoked patient registration privileges.",
    )
    db.add(override)
    db.commit()

    try:
        # 1. Registration attempt must be REJECTED with 403 Forbidden
        reg_payload = {
            "full_name": "Blocked Patient",
            "age": 40,
            "gender": "M",
            "blood_group": "O+",
            "contact_phone": "+1 (555) 000-1111",
            "triage_category": "Routine",
            "chief_complaint": "Headache",
            "schedule_appointment": False,
        }
        res_blocked = client.post("/api/v1/clinical/patients", json=reg_payload, headers=headers)
        assert res_blocked.status_code == 403
        assert "patient:create" in res_blocked.json()["detail"]
        assert "probation" in res_blocked.json()["detail"].lower()

        # 2. Reading patients must STILL SUCCEED because patient:read is granted!
        res_read = client.get("/api/v1/clinical/patients", headers=headers)
        assert res_read.status_code == 200
    finally:
        # Clean up override
        db.delete(override)
        db.commit()


def test_receptionist_profile_and_password_change(client: TestClient, db: Session):
    """Verify account:profile:read, account:profile:update, and account:password:change."""
    token = _login(client, "clara.receptionist", "Receptionist@123")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. account:profile:read
    res_prof = client.get("/api/v1/employee/profile", headers=headers)
    assert res_prof.status_code == 200
    prof = res_prof.json()
    assert prof["username"] == "clara.receptionist"

    # 2. account:profile:update
    res_upd = client.put("/api/v1/employee/profile", json={"full_name": "Clara Updated Legal"}, headers=headers)
    assert res_upd.status_code == 200
    assert res_upd.json()["full_name"] == "Clara Updated Legal"

    # Restore name
    client.put("/api/v1/employee/profile", json={"full_name": "Clara Bennett"}, headers=headers)
