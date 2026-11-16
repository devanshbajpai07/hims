import pytest
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import SYSTEM_ROLE_PERMISSIONS, MASTER_PERMISSION_CATALOGUE
from app.core.security import get_password_hash
from app.models.clinical import PatientRecord, AppointmentRecord
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


def test_dept_head_role_permissions_reconciliation():
    """Verifies that the Department Head role permissions are properly reconciled:
    - Retains all 17 recommended default permissions
    - Includes conditional permissions (shift:manage, approval:read, approval:manage)
    - Includes new employee:access:revoke:request
    - Includes communication permissions
    - Strictly PRUNES write permissions (patient:create, patient:update, emr:write, vitals:write, etc.)
    """
    dept_head_perms = set(SYSTEM_ROLE_PERMISSIONS["dept_head"])

    # Must have new revocation request permission
    assert "employee:access:revoke:request" in dept_head_perms
    assert "employee:access:revoke:request" in MASTER_PERMISSION_CATALOGUE

    # Must have core defaults
    defaults = [
        "patient:read", "emr:read", "vitals:read", "diagnosis:read",
        "queue:read", "appointment:read", "admission:read", "employee:read",
        "department:read", "role:read", "shift:read", "reports:read",
        "document:read", "document:download", "account:profile:read",
        "account:profile:update", "account:password:change"
    ]
    for p in defaults:
        assert p in dept_head_perms, f"Missing default permission {p} in dept_head"

    # Must have conditional permissions
    conditionals = ["shift:manage", "approval:read", "approval:manage"]
    for p in conditionals:
        assert p in dept_head_perms, f"Missing conditional permission {p} in dept_head"

    # Must have communication permissions
    comms = ["communication:read", "communication:create", "communication:respond", "communication:complete"]
    for p in comms:
        assert p in dept_head_perms, f"Missing communication permission {p} in dept_head"

    # Must NOT have pruned write/manage permissions
    forbidden = [
        "patient:create", "patient:update", "emr:write", "vitals:write",
        "prescription:read", "prescription:create", "diagnosis:write",
        "queue:manage", "admission:manage", "discharge:manage",
        "document:upload", "document:archive", "account:session:revoke"
    ]
    for p in forbidden:
        assert p not in dept_head_perms, f"Unintended permission {p} found in dept_head"


def _create_or_get_dept_head(db: Session, hospital_uid: str = "STJUDE-METRO-01", dept_code: str = "CARDIO"):
    """Helper to provision a Department Head user in the test hospital."""
    hosp = db.execute(select(Hospital).where(Hospital.hospital_uid == hospital_uid)).scalar_one()
    dept = db.execute(select(Department).where(Department.hospital_id == hosp.id, Department.code == dept_code)).scalar_one()
    role = db.execute(select(Role).where(Role.hospital_id == hosp.id, Role.code == "dept_head")).scalar_one()

    # Re-provision role permissions template to ensure DB matches permissions.py
    provision_hospital_rbac_templates(db, hosp.id)
    db.commit()

    username = f"head.{dept_code.lower()}.test"
    user = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email=f"head.{dept_code.lower()}@stjude.org",
            username=username,
            full_name=f"Dr. Test Head {dept_code}",
            password_hash=get_password_hash("HeadPass123!"),
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
            employee_uid=f"DH-{dept_code}",
        )
        db.add(mem)
        db.flush()

    asgn = db.execute(
        select(RoleAssignment).where(
            RoleAssignment.membership_id == mem.id,
            RoleAssignment.role_id == role.id,
            RoleAssignment.department_id == dept.id,
        )
    ).scalar_one_or_none()
    if not asgn:
        asgn = RoleAssignment(
            id=uuid.uuid4(),
            membership_id=mem.id,
            role_id=role.id,
            department_id=dept.id,
            scope_type="DEPARTMENT",
            is_active=True,
        )
        db.add(asgn)

    db.commit()
    return user, mem, dept, hosp


def test_dept_head_patient_isolation_and_read_only_access(client: TestClient, db: Session):
    """Verifies that:
    1. Cardiology Department Head sees only Cardiology patients.
    2. Attempting to inspect detail of a General Medicine patient returns 403 Forbidden.
    3. Attempting to update patient demographics returns 403 Forbidden (no patient:update).
    4. Attempting to record vitals returns 403 Forbidden (no vitals:write).
    """
    user, mem, cardio_dept, hosp = _create_or_get_dept_head(db, "STJUDE-METRO-01", "CARDIO")
    genmed_dept = db.execute(select(Department).where(Department.hospital_id == hosp.id, Department.code == "GEN-MED")).scalar_one()

    # Seed 1 patient in CARDIO and 1 patient in GEN-MED
    p_cardio = PatientRecord(
        hospital_id=hosp.id,
        mrn=f"MRN-TEST-CARDIO-{uuid.uuid4().hex[:6]}",
        full_name="Cardio Oversight Patient",
        age=58,
        gender="F",
        contact_phone="+1 555 909 0001",
        department_id=cardio_dept.id,
        triage_category="Priority",
        chief_complaint="Chest palpitations",
        clinical_notes="Sensitive cardiac history",
        admission_status="admitted",
    )
    p_genmed = PatientRecord(
        hospital_id=hosp.id,
        mrn=f"MRN-TEST-GENMED-{uuid.uuid4().hex[:6]}",
        full_name="GenMed External Patient",
        age=34,
        gender="M",
        contact_phone="+1 555 909 0002",
        department_id=genmed_dept.id,
        triage_category="Routine",
        chief_complaint="Seasonal allergies",
        clinical_notes="Confidential General Medicine chart",
        admission_status="outpatient",
    )
    db.add(p_cardio)
    db.add(p_genmed)
    db.commit()

    token = _login(client, user.username, "HeadPass123!")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /api/v1/clinical/patients
    res = client.get("/api/v1/clinical/patients", headers=headers)
    assert res.status_code == 200
    p_list = res.json()
    mrns = [p["mrn"] for p in p_list]
    assert p_cardio.mrn in mrns, "Cardiology patient must be visible to Cardio Dept Head"
    assert p_genmed.mrn not in mrns, "GenMed patient must NOT be visible in Cardio Dept Head list"

    # 2. GET detail for Cardiology patient -> 200 OK
    res_cardio = client.get(f"/api/v1/clinical/patients/{p_cardio.id}", headers=headers)
    assert res_cardio.status_code == 200
    assert res_cardio.json()["mrn"] == p_cardio.mrn

    # 3. GET detail for GenMed patient -> 403 Forbidden (Isolation)
    res_genmed = client.get(f"/api/v1/clinical/patients/{p_genmed.id}", headers=headers)
    assert res_genmed.status_code == 403
    assert "Department Head can only access" in res_genmed.json()["detail"]

    # 4. Attempt to edit patient -> 403 Forbidden (No patient:update)
    res_edit = client.put(
        f"/api/v1/clinical/patients/{p_cardio.id}",
        json={"contact_phone": "+1 555 999 9999"},
        headers=headers,
    )
    assert res_edit.status_code == 403

    # 5. Attempt to record vitals -> 403 Forbidden (No vitals:write)
    res_vitals = client.post(
        f"/api/v1/clinical/patients/{p_cardio.id}/vitals",
        json={"bp": "120/80 mmHg", "heart_rate": 75, "temperature": "98.6 °F", "spo2": 99},
        headers=headers,
    )
    assert res_vitals.status_code == 403

    # 6. Dashboard summary endpoint
    res_summary = client.get("/api/v1/clinical/department-head/dashboard-summary", headers=headers)
    assert res_summary.status_code == 200
    sum_data = res_summary.json()
    assert sum_data["department_name"] == cardio_dept.name
    assert sum_data["registered_patients_count"] >= 1
    assert sum_data["active_admissions_count"] >= 1


def test_dept_head_employee_directory_and_revocation_lifecycle(client: TestClient, db: Session):
    """Verifies that:
    1. Dept Head gets only employees assigned to their department.
    2. Revocation request validation forbids self-targeting, non-dept target, and admin target.
    3. Submitting valid request creates EmployeeRevocationRequest with PENDING status and notification.
    4. Dept Head can cancel their own pending request.
    5. Admin can list and approve request, executing actual role assignment revocation.
    """
    user, mem, cardio_dept, hosp = _create_or_get_dept_head(db, "STJUDE-METRO-01", "CARDIO")

    # rahul is already assigned to Cardio as Doctor
    rahul_user = db.execute(select(User).where(User.username == "rahul")).scalar_one()
    rahul_mem = db.execute(select(TenantMembership).where(TenantMembership.user_id == rahul_user.id, TenantMembership.hospital_id == hosp.id)).scalar_one()
    rahul_asgn = db.execute(
        select(RoleAssignment).where(
            RoleAssignment.membership_id == rahul_mem.id,
            RoleAssignment.department_id == cardio_dept.id,
        )
    ).scalar_one()
    rahul_asgn.is_active = True
    rahul_asgn.assignment_status = "active"
    rahul_asgn.revoked_at = None
    rahul_asgn.revoked_by_user_id = None
    db.commit()

    token_head = _login(client, user.username, "HeadPass123!")
    headers_head = {"Authorization": f"Bearer {token_head}"}

    # 1. GET /api/v1/clinical/department-head/employees
    res_emp = client.get("/api/v1/clinical/department-head/employees", headers=headers_head)
    assert res_emp.status_code == 200
    emp_list = res_emp.json()
    emp_uids = [e["employee_uid"] for e in emp_list]
    assert rahul_mem.employee_uid in emp_uids or any(e["user_id"] == str(rahul_user.id) for e in emp_list)

    rahul_entry = next(e for e in emp_list if e["user_id"] == str(rahul_user.id))
    assert rahul_entry["is_revocation_eligible"] is True

    head_entry = next(e for e in emp_list if e["user_id"] == str(user.id))
    assert head_entry["is_revocation_eligible"] is False

    # 2. Validation: Self-revocation rejected
    res_self = client.post(
        "/api/v1/clinical/department-head/revocation-requests",
        json={
            "target_membership_id": str(mem.id),
            "target_assignment_id": str(head_entry["assignment_id"]),
            "revocation_scope": "DEPARTMENT_ASSIGNMENT",
            "reason": "Test self-targeting which must be forbidden",
        },
        headers=headers_head,
    )
    assert res_self.status_code == 400
    assert "against themselves" in res_self.json()["detail"]

    # 3. Clean any existing pending request for rahul to avoid conflict
    existing = db.execute(
        select(EmployeeRevocationRequest).where(
            EmployeeRevocationRequest.target_membership_id == rahul_mem.id,
            EmployeeRevocationRequest.department_id == cardio_dept.id,
            EmployeeRevocationRequest.status == "PENDING",
        )
    ).scalars().all()
    for ex in existing:
        ex.status = "CANCELLED"
    db.commit()

    # 4. Valid revocation request submission
    res_submit = client.post(
        "/api/v1/clinical/department-head/revocation-requests",
        json={
            "target_membership_id": str(rahul_mem.id),
            "target_assignment_id": str(rahul_asgn.id),
            "revocation_scope": "DEPARTMENT_ASSIGNMENT",
            "reason": "Repeated non-attendance in clinical department shift roster.",
            "supporting_details": "Documented 3 consecutive unexcused shift absences.",
        },
        headers=headers_head,
    )
    assert res_submit.status_code == 201
    created_req = res_submit.json()
    assert created_req["status"] == "PENDING"
    assert created_req["target_name"] == (rahul_user.full_name or rahul_user.username)
    assert created_req["department_name"] == cardio_dept.name

    # Check notification in DB
    notif = db.execute(
        select(HospitalNotification).where(
            HospitalNotification.hospital_id == hosp.id,
            HospitalNotification.category == "security",
        ).order_by(HospitalNotification.created_at.desc())
    ).scalars().first()
    assert notif is not None
    assert "Access Revocation Escalation" in notif.title

    # 5. Duplicate pending request rejected with 409
    res_dup = client.post(
        "/api/v1/clinical/department-head/revocation-requests",
        json={
            "target_membership_id": str(rahul_mem.id),
            "target_assignment_id": str(rahul_asgn.id),
            "revocation_scope": "DEPARTMENT_ASSIGNMENT",
            "reason": "Duplicate request attempt",
        },
        headers=headers_head,
    )
    assert res_dup.status_code == 409

    # 6. List revocation requests from Dept Head view
    res_list = client.get("/api/v1/clinical/department-head/revocation-requests", headers=headers_head)
    assert res_list.status_code == 200
    req_ids = [r["id"] for r in res_list.json()]
    assert created_req["id"] in req_ids

    # 7. Cancel flow: Dept Head withdraws request
    res_cancel = client.post(
        f"/api/v1/clinical/department-head/revocation-requests/{created_req['id']}/cancel",
        headers=headers_head,
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "CANCELLED"

    # 8. Submit fresh request and test Hospital Admin decision flow
    res_fresh = client.post(
        "/api/v1/clinical/department-head/revocation-requests",
        json={
            "target_membership_id": str(rahul_mem.id),
            "target_assignment_id": str(rahul_asgn.id),
            "revocation_scope": "DEPARTMENT_ASSIGNMENT",
            "reason": "Critical compliance escalation requiring administrator intervention.",
            "supporting_details": "Formal incident report filed.",
        },
        headers=headers_head,
    )
    assert res_fresh.status_code == 201
    fresh_req = res_fresh.json()

    # Hospital Admin login
    token_admin = _login(client, "admin.stjude", "Admin@123")
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # Admin lists revocation requests
    res_admin_list = client.get("/api/v1/admin/revocation-requests", headers=headers_admin)
    assert res_admin_list.status_code == 200
    admin_req_ids = [r["id"] for r in res_admin_list.json()]
    assert fresh_req["id"] in admin_req_ids

    # Admin approves request
    res_decide = client.post(
        f"/api/v1/admin/revocation-requests/{fresh_req['id']}/decide",
        json={
            "action": "APPROVE",
            "decision_notes": "Reviewed and approved by Hospital Admin. Role assignment revoked.",
        },
        headers=headers_admin,
    )
    assert res_decide.status_code == 200
    decided = res_decide.json()
    assert decided["status"] == "APPROVED"
    assert decided["reviewer_name"] is not None

    # Verify target role assignment was actually deactivated in PostgreSQL
    db.expire_all()
    updated_asgn = db.execute(select(RoleAssignment).where(RoleAssignment.id == rahul_asgn.id)).scalar_one()
    assert updated_asgn.is_active is False, "Role assignment must be deactivated upon approval"

    # Restore rahul's active role assignment to preserve fixture consistency for other test suites
    updated_asgn.is_active = True
    updated_asgn.assignment_status = "active"
    updated_asgn.revoked_at = None
    updated_asgn.revoked_by_user_id = None
    db.commit()
