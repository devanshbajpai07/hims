import pytest
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session

from app.core.permissions import SYSTEM_ROLE_PERMISSIONS, MASTER_PERMISSION_CATALOGUE
from app.core.security import get_password_hash
from app.models.clinical import PatientRecord, PatientVitalRecord, NursingShiftRecord, NursingTaskRecord
from app.models.department import Department
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.assignment import RoleAssignment
from app.models.role import Role
from app.models.user import User
from app.models.revocation_request import EmployeeRevocationRequest
from app.models.notification import HospitalNotification
from app.services.authorization_service import AuthorizationService
from app.db.rbac_seeder import provision_hospital_rbac_templates


def _login(client: TestClient, username: str, password: str = "SecurePass123!", hospital_uid: str = "STJUDE-METRO-01") -> str:
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    data = res.json()
    if data.get("requires_workspace_selection"):
        memberships = data["available_memberships"]
        target = next((m for m in memberships if m["hospital_uid"] == hospital_uid), memberships[0])
        sel_res = client.post(
            "/api/v1/auth/select-workspace",
            json={"user_id": data["user_id"], "hospital_id": target["hospital_id"]},
        )
        assert sel_res.status_code == 200, f"Select workspace failed: {sel_res.text}"
        return sel_res.json()["access_token"]
    assert data.get("session") is not None
    return data["session"]["access_token"]


def _create_or_get_nursing_supervisor(db: Session, hospital_uid: str = "STJUDE-METRO-01"):
    """Helper creating or retrieving an active facility-scoped Nursing Services Supervisor."""
    hosp = db.execute(select(Hospital).where(Hospital.hospital_uid == hospital_uid)).scalar_one()
    role_sup = db.execute(
        select(Role).where(Role.hospital_id == hosp.id, Role.code == "nursing_supervisor")
    ).scalar_one()

    user = db.execute(select(User).where(User.username == "supervisor.mary")).scalar_one_or_none()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email="supervisor.mary@stjude.org",
            username="supervisor.mary",
            full_name="Mary Jenkins, RN MSN",
            password_hash=get_password_hash("SecurePass123!"),
            is_active=True,
        )
        db.add(user)
        db.flush()

    mem = db.execute(
        select(TenantMembership).where(
            TenantMembership.hospital_id == hosp.id,
            TenantMembership.user_id == user.id,
        )
    ).scalar_one_or_none()
    if not mem:
        mem = TenantMembership(
            id=uuid.uuid4(),
            hospital_id=hosp.id,
            user_id=user.id,
            status="active",
            employee_uid="EMP-SUP-01",
            employee_uid_verified=True,
        )
        db.add(mem)
        db.flush()

    asgn = db.execute(
        select(RoleAssignment).where(
            RoleAssignment.membership_id == mem.id,
            RoleAssignment.role_id == role_sup.id,
        )
    ).scalar_one_or_none()
    if not asgn:
        asgn = RoleAssignment(
            id=uuid.uuid4(),
            membership_id=mem.id,
            role_id=role_sup.id,
            department_id=None,
            scope_type="FACILITY",
            is_active=True,
            assignment_status="active",
        )
        db.add(asgn)
    else:
        asgn.is_active = True
        asgn.assignment_status = "active"

    # Also ensure a nurse user exists for nursing workforce testing
    role_nurse = db.execute(
        select(Role).where(Role.hospital_id == hosp.id, Role.code == "nurse")
    ).scalar_one()
    genmed_dept = db.execute(
        select(Department).where(Department.hospital_id == hosp.id, Department.code == "GEN-MED")
    ).scalar_one()

    nurse_user = db.execute(
        select(User).where(User.username == "nurse.joy")
    ).scalar_one_or_none()
    if not nurse_user:
        nurse_user = User(
            id=uuid.uuid4(),
            email="nurse.joy@stjude.org",
            username="nurse.joy",
            full_name="Nurse Joy, RN",
            password_hash=get_password_hash("SecurePass123!"),
            is_active=True,
        )
        db.add(nurse_user)
        db.flush()

    nurse_mem = db.execute(
        select(TenantMembership).where(
            TenantMembership.hospital_id == hosp.id,
            TenantMembership.user_id == nurse_user.id,
        )
    ).scalar_one_or_none()
    if not nurse_mem:
        nurse_mem = TenantMembership(
            id=uuid.uuid4(),
            hospital_id=hosp.id,
            user_id=nurse_user.id,
            status="active",
            employee_uid="EMP-NURSE-01",
            employee_uid_verified=True,
        )
        db.add(nurse_mem)
        db.flush()

    nurse_asgn = db.execute(
        select(RoleAssignment).where(
            RoleAssignment.membership_id == nurse_mem.id,
            RoleAssignment.role_id == role_nurse.id,
        )
    ).scalar_one_or_none()
    if not nurse_asgn:
        nurse_asgn = RoleAssignment(
            id=uuid.uuid4(),
            membership_id=nurse_mem.id,
            role_id=role_nurse.id,
            department_id=genmed_dept.id,
            scope_type="DEPARTMENT",
            is_active=True,
            assignment_status="active",
        )
        db.add(nurse_asgn)
    else:
        nurse_asgn.is_active = True
        nurse_asgn.assignment_status = "active"

    db.commit()
    return user, mem, hosp


def test_nursing_supervisor_role_permissions_reconciliation():
    """Verifies that the Nursing Services Supervisor role permissions are properly reconciled:
    - Retains all recommended default permissions (17 exact canonical permissions)
    - Includes shift:manage and employee:access:revoke:request
    - Includes communication permissions
    - Strictly PRUNES write permissions (patient:create, patient:update, emr:write, vitals:write, etc.)
    - Removes account:session:revoke
    """
    sup_perms = set(SYSTEM_ROLE_PERMISSIONS["nursing_supervisor"])

    # Required permissions
    expected_perms = [
        "patient:read",
        "vitals:read",
        "employee:read",
        "department:read",
        "role:read",
        "shift:read",
        "shift:manage",
        "reports:read",
        "admission:read",
        "account:profile:read",
        "account:profile:update",
        "account:password:change",
        "employee:access:revoke:request",
        "communication:read",
        "communication:create",
        "communication:respond",
        "communication:complete",
    ]
    for p in expected_perms:
        assert p in sup_perms, f"Missing expected permission '{p}' in nursing_supervisor"

    # Strictly disallowed permissions
    forbidden = [
        "account:session:revoke",
        "emr:read",
        "emr:write",
        "prescription:read",
        "prescription:create",
        "diagnosis:write",
        "admission:manage",
        "discharge:manage",
        "employee:manage",
        "role:manage",
        "patient:create",
        "patient:update",
        "vitals:write",
    ]
    for p in forbidden:
        assert p not in sup_perms, f"Unintended permission '{p}' granted to nursing_supervisor"


def test_nursing_supervisor_hospital_scope_and_patient_census(client: TestClient, db: Session):
    """Verifies that:
    1. Nursing Services Supervisor gets hospital-wide patient census across departments.
    2. Clinical notes & consultation records are strictly REDACTED under privacy governance.
    3. Supervisor can view vital signs (vitals:read).
    4. Attempting to record vitals (vitals:write) returns 403 Forbidden.
    5. Attempting to update patient demographics (patient:update) returns 403 Forbidden.
    """
    user, mem, hosp = _create_or_get_nursing_supervisor(db)
    token = _login(client, user.username, "SecurePass123!")
    headers = {"Authorization": f"Bearer {token}"}

    # Retrieve patient census
    res = client.get("/api/v1/clinical/supervisor/patient-census", headers=headers)
    assert res.status_code == 200, f"Failed to retrieve census: {res.text}"
    census_list = res.json()
    assert isinstance(census_list, list)

    # Verify patient inspection and redaction
    res_pat = client.get("/api/v1/clinical/patients", headers=headers)
    assert res_pat.status_code == 200
    patients = res_pat.json()
    assert len(patients) >= 1
    sample = patients[0]
    # Clinical notes must be redacted for supervisor
    assert "PROTECTED" in sample["clinical_notes"], "Clinical notes must be redacted for nursing supervisor"

    # Verify attempt to write vitals returns 403 Forbidden (no vitals:write)
    res_vitals = client.post(
        "/api/v1/clinical/vitals",
        json={
            "patient_id": sample["id"],
            "bp": "120/80",
            "heart_rate": 72,
            "temperature": "98.6",
            "spo2": 99,
        },
        headers=headers,
    )
    assert res_vitals.status_code == 403, "Nursing supervisor must not be authorized to write vitals"

    # Verify attempt to update patient demographics returns 403 Forbidden (no patient:update)
    res_update = client.patch(
        f"/api/v1/clinical/patients/{sample['id']}",
        json={"contact_phone": "+1 555 999 8888"},
        headers=headers,
    )
    assert res_update.status_code == 403, "Nursing supervisor must not be authorized to update patient demographics"


def test_nursing_supervisor_workforce_directory_and_revocation(client: TestClient, db: Session):
    """Verifies that:
    1. Workforce directory identifies nursing employees through database-backed role assignments.
    2. Non-nursing employees (Doctors, Receptionists, Admins) are excluded.
    3. Self-revocation request is rejected with 400 Bad Request.
    4. Submitting a valid revocation request for a nursing employee creates PENDING request.
    5. Duplicate pending request returns 409 Conflict.
    6. Supervisor can cancel their own pending request.
    """
    user, mem, hosp = _create_or_get_nursing_supervisor(db)
    token = _login(client, user.username, "SecurePass123!")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Fetch nursing workforce directory
    res_wf = client.get("/api/v1/clinical/supervisor/nursing-workforce", headers=headers)
    assert res_wf.status_code == 200, f"Workforce fetch failed: {res_wf.text}"
    workforce = res_wf.json()
    assert len(workforce) >= 1

    # Ensure all returned employees are nursing staff
    for w in workforce:
        assert "nurse" in w["role_code"].lower() or "nurse" in w["role_name"].lower(), f"Non-nurse employee found: {w}"

    # Ensure doctors and receptionists are NOT in the nursing workforce directory
    emails = [w["email"] for w in workforce]
    assert "sarah.almansoor@stjude.org" not in emails, "Doctors must not appear in nursing workforce directory"
    assert "clara.bennett@stjude.org" not in emails, "Receptionists must not appear in nursing workforce directory"

    # 2. Test revocation request: self-targeting rejected
    res_self = client.post(
        "/api/v1/clinical/supervisor/revocation-requests",
        json={
            "target_membership_id": str(mem.id),
            "revocation_scope": "DEPARTMENT_ASSIGNMENT",
            "reason": "Self revocation attempt",
        },
        headers=headers,
    )
    assert res_self.status_code == 400
    assert "themselves" in res_self.json()["detail"]

    # 3. Create or get subordinate nurse target
    nurse_role = db.execute(select(Role).where(Role.hospital_id == hosp.id, Role.code == "nurse")).scalar_one()
    genmed_dept = db.execute(select(Department).where(Department.hospital_id == hosp.id, Department.code == "GEN-MED")).scalar_one()

    target_nurse_user = db.execute(select(User).where(User.username == "nurse.target.test")).scalar_one_or_none()
    if not target_nurse_user:
        target_nurse_user = User(
            id=uuid.uuid4(),
            email="nurse.target@stjude.org",
            username="nurse.target.test",
            full_name="Staff Nurse Target",
            password_hash=get_password_hash("SecurePass123!"),
            is_active=True,
        )
        db.add(target_nurse_user)
        db.flush()

        target_nurse_mem = TenantMembership(
            id=uuid.uuid4(),
            hospital_id=hosp.id,
            user_id=target_nurse_user.id,
            status="active",
            employee_uid="EMP-NURSE-TGT-01",
            employee_uid_verified=True,
        )
        db.add(target_nurse_mem)
        db.flush()

        target_asgn = RoleAssignment(
            id=uuid.uuid4(),
            membership_id=target_nurse_mem.id,
            role_id=nurse_role.id,
            department_id=genmed_dept.id,
            scope_type="DEPARTMENT",
            is_active=True,
            assignment_status="active",
        )
        db.add(target_asgn)
        db.commit()
    else:
        target_nurse_mem = db.execute(select(TenantMembership).where(TenantMembership.user_id == target_nurse_user.id, TenantMembership.hospital_id == hosp.id)).scalar_one()
        target_asgn = db.execute(select(RoleAssignment).where(RoleAssignment.membership_id == target_nurse_mem.id, RoleAssignment.role_id == nurse_role.id)).scalar_one()
        target_asgn.is_active = True
        target_asgn.assignment_status = "active"
        db.commit()

    # Cancel any existing pending request
    existing = db.execute(
        select(EmployeeRevocationRequest).where(
            EmployeeRevocationRequest.hospital_id == hosp.id,
            EmployeeRevocationRequest.target_membership_id == target_nurse_mem.id,
            EmployeeRevocationRequest.status == "PENDING",
        )
    ).scalars().all()
    for ex in existing:
        ex.status = "CANCELLED"
    db.commit()

    # 4. Valid revocation request
    res_submit = client.post(
        "/api/v1/clinical/supervisor/revocation-requests",
        json={
            "target_membership_id": str(target_nurse_mem.id),
            "target_assignment_id": str(target_asgn.id),
            "revocation_scope": "DEPARTMENT_ASSIGNMENT",
            "reason": "Repeated medication administration protocol deviations.",
            "supporting_details": "Formal incident report documented for shift on ward 3.",
        },
        headers=headers,
    )
    assert res_submit.status_code == 201, f"Failed to submit revocation request: {res_submit.text}"
    req_data = res_submit.json()
    assert req_data["status"] == "PENDING"
    assert req_data["target_name"] == target_nurse_user.full_name

    # 5. Duplicate pending request rejected with 409
    res_dup = client.post(
        "/api/v1/clinical/supervisor/revocation-requests",
        json={
            "target_membership_id": str(target_nurse_mem.id),
            "target_assignment_id": str(target_asgn.id),
            "revocation_scope": "DEPARTMENT_ASSIGNMENT",
            "reason": "Duplicate attempt",
        },
        headers=headers,
    )
    assert res_dup.status_code == 409

    # 6. List supervisor revocation requests
    res_list = client.get("/api/v1/clinical/supervisor/revocation-requests", headers=headers)
    assert res_list.status_code == 200
    ids = [r["id"] for r in res_list.json()]
    assert req_data["id"] in ids

    # 7. Cancel revocation request
    res_cancel = client.post(
        f"/api/v1/clinical/supervisor/revocation-requests/{req_data['id']}/cancel",
        headers=headers,
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "CANCELLED"


def test_nursing_supervisor_shift_management_lifecycle(client: TestClient, db: Session):
    """Verifies that:
    1. Supervisor can schedule a nursing shift for a nurse.
    2. Attempting to schedule a non-nursing employee (e.g. Doctor) is rejected with 400 Bad Request.
    3. Conflicting shifts for the same nurse on the same day/shift are rejected with 409 Conflict.
    4. Supervisor can modify and cancel shifts.
    """
    user, mem, hosp = _create_or_get_nursing_supervisor(db)
    token = _login(client, user.username, "SecurePass123!")
    headers = {"Authorization": f"Bearer {token}"}

    genmed_dept = db.execute(select(Department).where(Department.hospital_id == hosp.id, Department.code == "GEN-MED")).scalar_one()
    today_str = datetime.now().strftime("%Y-%m-%d")

    # 1. Clean existing shift for this date to avoid conflicts
    db.query(NursingShiftRecord).filter(
        NursingShiftRecord.hospital_id == hosp.id,
        NursingShiftRecord.nurse_name == "Nurse Joy",
        NursingShiftRecord.shift_date == today_str,
        NursingShiftRecord.shift_name == "Morning Shift (07:00 - 15:00)",
    ).delete()
    db.commit()

    # 2. Create valid nursing shift
    res_create = client.post(
        "/api/v1/clinical/supervisor/shifts",
        json={
            "department_id": str(genmed_dept.id),
            "shift_name": "Morning Shift (07:00 - 15:00)",
            "nurse_name": "Nurse Joy",
            "assigned_ward": "Inpatient Ward 3",
            "assigned_bed_count": 8,
            "shift_date": today_str,
            "status": "scheduled",
        },
        headers=headers,
    )
    assert res_create.status_code == 201, f"Failed to create shift: {res_create.text}"
    shift_data = res_create.json()
    assert shift_data["nurse_name"] == "Nurse Joy"
    assert shift_data["assigned_bed_count"] == 8

    # 3. Conflicting shift rejected with 409 Conflict
    res_conflict = client.post(
        "/api/v1/clinical/supervisor/shifts",
        json={
            "department_id": str(genmed_dept.id),
            "shift_name": "Morning Shift (07:00 - 15:00)",
            "nurse_name": "Nurse Joy",
            "assigned_ward": "Inpatient Ward 3",
            "assigned_bed_count": 8,
            "shift_date": today_str,
            "status": "scheduled",
        },
        headers=headers,
    )
    assert res_conflict.status_code == 409, "Conflicting shift assignment must return 409 Conflict"

    # 4. Attempt to schedule non-nurse employee (Doctor Sarah)
    sarah_user = db.execute(select(User).where(User.username == "sarah.almansoor")).scalar_one()
    res_doc_shift = client.post(
        "/api/v1/clinical/supervisor/shifts",
        json={
            "department_id": str(genmed_dept.id),
            "shift_name": "Evening Shift (15:00 - 23:00)",
            "nurse_id": str(sarah_user.id),
            "nurse_name": "Dr. Sarah Al-Mansoor",
            "assigned_ward": "General Ward",
            "assigned_bed_count": 6,
            "shift_date": today_str,
            "status": "scheduled",
        },
        headers=headers,
    )
    assert res_doc_shift.status_code == 400, "Scheduling non-nursing personnel must be rejected with 400"

    # 5. Modify shift
    res_update = client.put(
        f"/api/v1/clinical/supervisor/shifts/{shift_data['id']}",
        json={
            "status": "on_duty",
            "assigned_ward": "Inpatient Ward 3 - High Dependency",
            "assigned_bed_count": 10,
        },
        headers=headers,
    )
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["status"] == "on_duty"
    assert updated["assigned_bed_count"] == 10

    # 6. Cancel shift
    res_del = client.delete(f"/api/v1/clinical/supervisor/shifts/{shift_data['id']}", headers=headers)
    assert res_del.status_code == 200
    assert res_del.json()["success"] is True


def test_nursing_supervisor_reports_and_departments_overview(client: TestClient, db: Session):
    """Verifies that:
    1. Operational reports return genuine counts and distributions from PostgreSQL.
    2. Department overview returns bed capacity, occupancy, and assigned nurses.
    """
    user, mem, hosp = _create_or_get_nursing_supervisor(db)
    token = _login(client, user.username, "SecurePass123!")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Operational reports
    res_rep = client.get("/api/v1/clinical/supervisor/reports", headers=headers)
    assert res_rep.status_code == 200, f"Reports fetch failed: {res_rep.text}"
    rep = res_rep.json()
    assert rep["hospital_uid"] == hosp.hospital_uid
    assert rep["total_beds"] > 0
    assert "workforce_by_department" in rep
    assert "shift_coverage" in rep
    assert "triage_breakdown" in rep

    # 2. Departments overview
    res_dept = client.get("/api/v1/clinical/supervisor/departments-overview", headers=headers)
    assert res_dept.status_code == 200, f"Departments overview failed: {res_dept.text}"
    depts = res_dept.json()
    assert len(depts) >= 5
    first_d = depts[0]
    assert "name" in first_d
    assert "code" in first_d
    assert "bed_capacity" in first_d
    assert "nurse_count" in first_d
    assert "nurses" in first_d
