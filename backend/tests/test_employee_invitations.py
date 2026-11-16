import uuid
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.testclient import TestClient

from app.core.security import get_password_hash, hash_token, verify_password
from app.db.rbac_seeder import provision_hospital_rbac_templates
from app.models.admin_invitation import HospitalAdministrator
from app.models.assignment import RoleAssignment
from app.models.department import Department
from app.models.employee_invitation import EmployeeInvitation
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.purchaser import Purchaser
from app.models.purchaser_subscription import PurchaserSubscription
from app.models.role import Role
from app.models.user import User
from app.services.hospital_admin_service import HospitalAdminService, QuotaExceededError
from app.schemas.hospital_admin import EmployeeAssignmentSlot, EmployeeInviteRequest, AcceptEmployeeInvitationRequest


def _setup_hospital_and_admin(client: TestClient, db: Session, plan_code: str = "BASIC"):
    p_email = f"purchaser_{uuid.uuid4().hex[:6]}@aura.org"
    purchaser = Purchaser(
        id=uuid.uuid4(),
        full_name="Executive Purchaser",
        email=p_email,
        email_normalized=p_email.lower(),
        password_hash=get_password_hash("StrongPass123!"),
        is_email_verified=True,
        account_status="active",
    )
    db.add(purchaser)
    db.flush()

    sub = PurchaserSubscription(
        id=uuid.uuid4(),
        purchaser_id=purchaser.id,
        plan_code=plan_code,
        status="active",
        billing_interval="monthly",
        current_period_starts_at=datetime.now(timezone.utc),
        current_period_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db.add(sub)
    db.flush()

    hospital = Hospital(
        id=uuid.uuid4(),
        name=f"Community Hospital {uuid.uuid4().hex[:4]}",
        hospital_uid=f"COMM-{uuid.uuid4().hex[:6].upper()}",
        city="Chicago",
        state="IL",
        country="USA",
        subscription_id=sub.id,
        purchaser_id=purchaser.id,
        is_active=True,
    )
    db.add(hospital)
    db.flush()

    gen_med = Department(id=uuid.uuid4(), hospital_id=hospital.id, name="General Medicine", code="GEN-MED", is_active=True)
    emerg = Department(id=uuid.uuid4(), hospital_id=hospital.id, name="Emergency Medicine", code="EMERG", is_active=True)
    disp = Department(id=uuid.uuid4(), hospital_id=hospital.id, name="Dispensary", code="DISP", is_active=True)
    peds = Department(id=uuid.uuid4(), hospital_id=hospital.id, name="Pediatrics", code="PEDS", is_active=True)
    db.add_all([gen_med, emerg, disp, peds])
    db.flush()

    provision_hospital_rbac_templates(db, hospital.id)

    admin_uname = f"admin_{uuid.uuid4().hex[:6]}"
    admin_pwd = "AdminPassword123!"
    admin_user = User(
        id=uuid.uuid4(),
        username=admin_uname,
        email=f"{admin_uname}@hospital.org",
        password_hash=get_password_hash(admin_pwd),
        full_name="Hospital Administrator",
        is_active=True,
    )
    db.add(admin_user)
    db.flush()

    admin_mem = TenantMembership(
        id=uuid.uuid4(),
        user_id=admin_user.id,
        hospital_id=hospital.id,
        employee_uid=f"ADM-{uuid.uuid4().hex[:6].upper()}",
        employee_uid_verified=True,
        status="active",
    )
    db.add(admin_mem)
    db.flush()

    admin_rec = HospitalAdministrator(
        id=uuid.uuid4(),
        user_id=admin_user.id,
        hospital_id=hospital.id,
        membership_id=admin_mem.id,
        status="active",
    )
    db.add(admin_rec)
    db.commit()

    l_res = client.post(
        "/api/v1/admin/auth/login",
        json={"username_or_email": admin_uname, "password": admin_pwd, "hospital_id": str(hospital.id)},
    )
    assert l_res.status_code == 200, l_res.text
    token = l_res.json()["token"]
    client.headers["Authorization"] = f"Bearer {token}"

    return hospital, admin_user


def test_employee_invitation_one_assignment(client: TestClient, db: Session):
    hosp, admin_user = _setup_hospital_and_admin(client, db)
    gen_med = db.query(Department).filter(Department.hospital_id == hosp.id, Department.code == "GEN-MED").first()
    doc_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "doctor").first()

    invite_email = f"single_{uuid.uuid4().hex[:6]}@stjude.org"
    res = client.post(
        "/api/v1/admin/employees/invite",
        json={
            "email": invite_email,
            "full_name": "Dr. Single Assignment",
            "phone": "+1-555-0101",
            "designation": "Associate Physician",
            "assignments": [
                {
                    "scope_type": "DEPARTMENT",
                    "department_id": str(gen_med.id),
                    "role_id": str(doc_role.id),
                }
            ],
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["success"] is True
    assert data["email"] == invite_email


def test_employee_invitation_five_assignments(client: TestClient, db: Session):
    hosp, admin_user = _setup_hospital_and_admin(client, db)
    gen_med = db.query(Department).filter(Department.hospital_id == hosp.id, Department.code == "GEN-MED").first()
    emerg = db.query(Department).filter(Department.hospital_id == hosp.id, Department.code == "EMERG").first()
    disp = db.query(Department).filter(Department.hospital_id == hosp.id, Department.code == "DISP").first()
    peds = db.query(Department).filter(Department.hospital_id == hosp.id, Department.code == "PEDS").first()

    doc_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "doctor").first()
    nurse_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "nurse").first()
    pharm_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "pharmacist").first()
    nursing_sup_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "nursing_supervisor").first()
    assert nursing_sup_role is not None

    invite_email = f"five_{uuid.uuid4().hex[:6]}@stjude.org"
    res = client.post(
        "/api/v1/admin/employees/invite",
        json={
            "email": invite_email,
            "full_name": "Dr. Polymath Clinician",
            "phone": "+1-555-0102",
            "designation": "Senior Attending & Coordinator",
            "assignments": [
                {"scope_type": "DEPARTMENT", "department_id": str(gen_med.id), "role_id": str(doc_role.id)},
                {"scope_type": "DEPARTMENT", "department_id": str(emerg.id), "role_id": str(doc_role.id)},
                {"scope_type": "DEPARTMENT", "department_id": str(disp.id), "role_id": str(pharm_role.id)},
                {"scope_type": "DEPARTMENT", "department_id": str(peds.id), "role_id": str(nurse_role.id)},
                {"scope_type": "FACILITY", "department_id": None, "role_id": str(nursing_sup_role.id)},
            ],
        },
    )
    assert res.status_code == 201, res.text


def test_employee_invitation_more_than_five_rejected(client: TestClient, db: Session):
    hosp, admin_user = _setup_hospital_and_admin(client, db)
    gen_med = db.query(Department).filter(Department.hospital_id == hosp.id, Department.code == "GEN-MED").first()
    doc_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "doctor").first()

    slots = [
        {"scope_type": "DEPARTMENT", "department_id": str(gen_med.id), "role_id": str(doc_role.id)}
        for _ in range(6)
    ]
    res = client.post(
        "/api/v1/admin/employees/invite",
        json={
            "email": "over_limit@stjude.org",
            "full_name": "Dr. Overload",
            "assignments": slots,
        },
    )
    assert res.status_code in (400, 422)


def test_employee_invitation_duplicate_assignment_rejected(client: TestClient, db: Session):
    hosp, admin_user = _setup_hospital_and_admin(client, db)
    gen_med = db.query(Department).filter(Department.hospital_id == hosp.id, Department.code == "GEN-MED").first()
    doc_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "doctor").first()

    res = client.post(
        "/api/v1/admin/employees/invite",
        json={
            "email": f"dup_{uuid.uuid4().hex[:6]}@stjude.org",
            "full_name": "Dr. Duplicate",
            "assignments": [
                {"scope_type": "DEPARTMENT", "department_id": str(gen_med.id), "role_id": str(doc_role.id)},
                {"scope_type": "DEPARTMENT", "department_id": str(gen_med.id), "role_id": str(doc_role.id)},
            ],
        },
    )
    assert res.status_code == 400
    assert "Duplicate department-role assignment detected" in res.json()["detail"]


def test_employee_invitation_admin_role_rejected(client: TestClient, db: Session):
    hosp, admin_user = _setup_hospital_and_admin(client, db)
    admin_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "admin").first()

    res = client.post(
        "/api/v1/admin/employees/invite",
        json={
            "email": f"bad_admin_{uuid.uuid4().hex[:6]}@stjude.org",
            "full_name": "Sneaky Admin Attempt",
            "assignments": [
                {"scope_type": "FACILITY", "department_id": None, "role_id": str(admin_role.id)},
            ],
        },
    )
    assert res.status_code == 400
    assert "Hospital Administrator access cannot be granted through employee invitations" in res.json()["detail"]


def test_employee_invitation_scope_mismatch_rejected(client: TestClient, db: Session):
    hosp, admin_user = _setup_hospital_and_admin(client, db)
    gen_med = db.query(Department).filter(Department.hospital_id == hosp.id, Department.code == "GEN-MED").first()
    doc_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "doctor").first()
    nursing_sup = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "nursing_supervisor").first()

    # 1. Department-scoped role assigned at FACILITY scope
    res1 = client.post(
        "/api/v1/admin/employees/invite",
        json={
            "email": f"mismatch1_{uuid.uuid4().hex[:6]}@stjude.org",
            "full_name": "Doctor Everywhere",
            "assignments": [
                {"scope_type": "FACILITY", "department_id": None, "role_id": str(doc_role.id)},
            ],
        },
    )
    assert res1.status_code == 400
    assert "cannot be assigned hospital-wide" in res1.json()["detail"]

    # 2. Hospital-wide role assigned at DEPARTMENT scope
    res2 = client.post(
        "/api/v1/admin/employees/invite",
        json={
            "email": f"mismatch2_{uuid.uuid4().hex[:6]}@stjude.org",
            "full_name": "Supervisor Bound to Ward",
            "assignments": [
                {"scope_type": "DEPARTMENT", "department_id": str(gen_med.id), "role_id": str(nursing_sup.id)},
            ],
        },
    )
    assert res2.status_code == 400
    assert "cannot be constrained to a single department" in res2.json()["detail"]


def test_employee_invitation_acceptance_new_user(client: TestClient, db: Session):
    hosp, admin_user = _setup_hospital_and_admin(client, db)
    gen_med = db.query(Department).filter(Department.hospital_id == hosp.id, Department.code == "GEN-MED").first()
    doc_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "doctor").first()
    nursing_sup = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "nursing_supervisor").first()

    new_email = f"new_hire_{uuid.uuid4().hex[:6]}@stjude.org"

    payload = EmployeeInviteRequest(
        email=new_email,
        full_name="Dr. Brand New Hire",
        phone="+1-555-8888",
        designation="Resident Physician",
        assignments=[
            EmployeeAssignmentSlot(scope_type="DEPARTMENT", department_id=gen_med.id, role_id=doc_role.id),
            EmployeeAssignmentSlot(scope_type="FACILITY", department_id=None, role_id=nursing_sup.id),
        ],
    )
    inv, raw_token = HospitalAdminService.invite_employee(
        db, hospital_id=hosp.id, admin_user_id=admin_user.id, payload=payload
    )

    # 1. Verify invitation token
    ver_res = client.get(f"/api/v1/invitations/employee/verify?token={raw_token}")
    assert ver_res.status_code == 200, ver_res.text
    ver_data = ver_res.json()
    assert ver_data["valid"] is True
    assert ver_data["hospital_name"] == hosp.name
    assert ver_data["has_existing_account"] is False
    assert len(ver_data["assignments"]) == 2

    # 2. Accept invitation creating new credentials
    unique_username = f"newhire_{uuid.uuid4().hex[:6]}"
    acc_res = client.post(
        "/api/v1/invitations/employee/accept",
        json={
            "token": raw_token,
            "username": unique_username,
            "password": "SecurePassword123!",
        },
    )
    assert acc_res.status_code == 200, acc_res.text
    acc_data = acc_res.json()
    assert acc_data["success"] is True
    assert acc_data["username"] == unique_username
    assert acc_data["assignments_count"] == 2

    # 3. Verify membership and assignments in DB
    created_user = db.query(User).filter(User.username == unique_username).first()
    assert created_user is not None
    assert created_user.is_active is True
    assert verify_password("SecurePassword123!", created_user.password_hash)

    membership = db.query(TenantMembership).filter(
        TenantMembership.user_id == created_user.id,
        TenantMembership.hospital_id == hosp.id,
    ).first()
    assert membership is not None
    assert membership.status == "active"
    assert membership.employee_uid_verified is True

    assignments = db.query(RoleAssignment).filter(RoleAssignment.membership_id == membership.id).all()
    assert len(assignments) == 2
    assert all(a.is_active and a.assignment_status == "active" for a in assignments)

    # 4. Replay attack rejection (token cannot be used twice)
    replay_res = client.post(
        "/api/v1/invitations/employee/accept",
        json={
            "token": raw_token,
            "username": "replay_attempt",
            "password": "SecurePassword123!",
        },
    )
    assert replay_res.status_code == 400
    assert "already been accepted" in replay_res.json()["detail"].lower()


def test_employee_invitation_acceptance_existing_user(client: TestClient, db: Session):
    hosp, admin_user = _setup_hospital_and_admin(client, db)
    emerg = db.query(Department).filter(Department.hospital_id == hosp.id, Department.code == "EMERG").first()
    nurse_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "nurse").first()

    existing_email = f"existing_staff_{uuid.uuid4().hex[:6]}@hospitalnetwork.org"
    existing_user = User(
        username=f"staff_{uuid.uuid4().hex[:6]}",
        email=existing_email,
        password_hash=get_password_hash("ExistingSecretPass123!"),
        full_name="Nurse Existing Staff",
        is_active=True,
    )
    db.add(existing_user)
    db.commit()

    payload = EmployeeInviteRequest(
        email=existing_email,
        full_name="Nurse Existing Staff",
        assignments=[
            EmployeeAssignmentSlot(scope_type="DEPARTMENT", department_id=emerg.id, role_id=nurse_role.id)
        ],
    )
    inv, raw_token = HospitalAdminService.invite_employee(
        db, hospital_id=hosp.id, admin_user_id=admin_user.id, payload=payload
    )

    # 1. Verify endpoint detects existing account
    ver_res = client.get(f"/api/v1/invitations/employee/verify?token={raw_token}")
    assert ver_res.status_code == 200
    assert ver_res.json()["has_existing_account"] is True

    # 2. Rejects wrong password for existing user
    bad_pass_res = client.post(
        "/api/v1/invitations/employee/accept",
        json={
            "token": raw_token,
            "password": "WrongPassword!",
        },
    )
    assert bad_pass_res.status_code == 400
    assert "incorrect password" in bad_pass_res.json()["detail"].lower()

    # 3. Accepts with correct existing password
    good_res = client.post(
        "/api/v1/invitations/employee/accept",
        json={
            "token": raw_token,
            "password": "ExistingSecretPass123!",
        },
    )
    assert good_res.status_code == 200
    assert good_res.json()["user_id"] == str(existing_user.id)

    # 4. Confirm TenantMembership created and existing password unchanged
    db.refresh(existing_user)
    assert verify_password("ExistingSecretPass123!", existing_user.password_hash)

    mem = db.query(TenantMembership).filter(
        TenantMembership.user_id == existing_user.id,
        TenantMembership.hospital_id == hosp.id,
    ).first()
    assert mem is not None
    assert mem.status == "active"


def test_revoked_invitation_cannot_be_verified_or_accepted(client: TestClient, db: Session):
    hosp, admin_user = _setup_hospital_and_admin(client, db)
    gen_med = db.query(Department).filter(Department.hospital_id == hosp.id, Department.code == "GEN-MED").first()
    doc_role = db.query(Role).filter(Role.hospital_id == hosp.id, Role.code == "doctor").first()

    payload = EmployeeInviteRequest(
        email=f"revokeme_{uuid.uuid4().hex[:6]}@stjude.org",
        full_name="Dr. Revoked Soon",
        assignments=[
            EmployeeAssignmentSlot(scope_type="DEPARTMENT", department_id=gen_med.id, role_id=doc_role.id)
        ],
    )
    inv, raw_token = HospitalAdminService.invite_employee(
        db, hospital_id=hosp.id, admin_user_id=admin_user.id, payload=payload
    )

    # Revoke it
    rev_res = client.post(f"/api/v1/admin/employees/invitations/{inv.id}/revoke")
    assert rev_res.status_code == 200
    assert rev_res.json()["status"] == "REVOKED"

    # Attempt verify
    ver_res = client.get(f"/api/v1/invitations/employee/verify?token={raw_token}")
    assert ver_res.status_code == 400
    assert "revoked" in ver_res.json()["detail"].lower()

    # Attempt accept
    acc_res = client.post(
        "/api/v1/invitations/employee/accept",
        json={"token": raw_token, "password": "Password123!"},
    )
    assert acc_res.status_code == 400
    assert "revoked" in acc_res.json()["detail"].lower()
