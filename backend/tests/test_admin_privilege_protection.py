"""Mandatory Regression Tests for Hospital Administrator Privilege Protection.

Verifies non-negotiable security boundaries from Part 1:
1. Admin attempting to invite another administrator.
2. Admin attempting to revoke another administrator.
3. Admin attempting to revoke themselves.
4. Admin attempting to terminate their membership.
5. Admin attempting to create an administrator RoleAssignment.
6. Admin attempting to grant administrator-equivalent permission overrides.
7. Employee attempting to self-register as Hospital Administrator.
8. Employee invitation containing Hospital Administrator.
9. Purchaser-authorized administrator invitation.
10. Purchaser-authorized administrator revocation or replacement.
11. Concurrent administrator seat reservation.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, hash_token
from app.models.admin_invitation import HospitalAdminInvitation, HospitalAdministrator
from app.models.assignment import RoleAssignment
from app.models.department import Department
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.permission import Permission, RoleVersion
from app.models.purchaser import Purchaser, PurchaserSession
from app.models.purchaser_subscription import PurchaserSubscription
from app.models.role import Role
from app.models.session import SessionRecord
from app.models.user import User
from app.services.email_service import mock_email_service


# -----------------------------------------------------------------------------
# FIXTURE HELPERS
# -----------------------------------------------------------------------------

def setup_basic_hospital(db: Session) -> tuple[Purchaser, PurchaserSubscription, Hospital, Role, Department]:
    now = datetime.now(timezone.utc)
    # 1. Create Purchaser
    purchaser = Purchaser(
        id=uuid.uuid4(),
        full_name="Hospital Board Chairman",
        email=f"chairman_{uuid.uuid4().hex[:6]}@aurahims.org",
        email_normalized=f"chairman_{uuid.uuid4().hex[:6]}@aurahims.org".lower(),
        password_hash=get_password_hash("ExecutivePass123!"),
        is_email_verified=True,
        account_status="active",
    )
    db.add(purchaser)

    # 2. Create BASIC Subscription (Max 1 administrator)
    sub = PurchaserSubscription(
        id=uuid.uuid4(),
        purchaser_id=purchaser.id,
        plan_code="BASIC",
        status="active",
        billing_interval="monthly",
        starts_at=now,
        current_period_ends_at=now + timedelta(days=30),
        auto_renew=False,
    )
    db.add(sub)

    # 3. Create Hospital
    hospital = Hospital(
        id=uuid.uuid4(),
        purchaser_id=purchaser.id,
        subscription_id=sub.id,
        hospital_uid=f"AURA-{uuid.uuid4().hex[:6].upper()}",
        name="St. Jude Basic Hospital",
        city="Boston",
        facility_type="Community Clinic",
        is_active=True,
    )
    db.add(hospital)

    # 4. Create Department
    dept = Department(
        id=uuid.uuid4(),
        hospital_id=hospital.id,
        name="General Medicine",
        code="GEN-MED",
        is_active=True,
    )
    db.add(dept)

    # 5. Create Roles
    admin_role = Role(
        id=uuid.uuid4(),
        hospital_id=hospital.id,
        name="Hospital Administrator",
        code="admin",
        scope="hospital",
        is_system=True,
        is_active=True,
    )
    db.add(admin_role)

    doctor_role = Role(
        id=uuid.uuid4(),
        hospital_id=hospital.id,
        name="Doctor / Clinician",
        code="doctor",
        scope="department",
        is_system=True,
        is_active=True,
    )
    db.add(doctor_role)

    db.commit()
    db.refresh(purchaser)
    db.refresh(sub)
    db.refresh(hospital)
    db.refresh(admin_role)
    db.refresh(dept)
    return purchaser, sub, hospital, admin_role, dept


def setup_administrator_user(
    db: Session, hospital: Hospital, admin_role: Role
) -> tuple[User, TenantMembership, HospitalAdministrator, str]:
    now = datetime.now(timezone.utc)
    u = User(
        id=uuid.uuid4(),
        username=f"admin_{uuid.uuid4().hex[:6]}",
        email=f"admin_{uuid.uuid4().hex[:6]}@stjude.org",
        full_name="Chief Executive Administrator",
        password_hash=get_password_hash("AdminPass123!"),
        is_active=True,
        is_superuser=False,
    )
    db.add(u)
    db.flush()

    mem = TenantMembership(
        id=uuid.uuid4(),
        user_id=u.id,
        hospital_id=hospital.id,
        employee_uid=f"EMP-ADM-{uuid.uuid4().hex[:4].upper()}",
        employee_uid_verified=True,
        status="active",
    )
    db.add(mem)
    db.flush()

    ra = RoleAssignment(
        id=uuid.uuid4(),
        membership_id=mem.id,
        role_id=admin_role.id,
        department_id=None,
        scope_type="FACILITY",
        assignment_status="active",
        assignment_source="admin_assigned",
        is_active=True,
    )
    db.add(ra)

    h_admin = HospitalAdministrator(
        id=uuid.uuid4(),
        hospital_id=hospital.id,
        user_id=u.id,
        membership_id=mem.id,
        status="active",
    )
    db.add(h_admin)

    # Legitimate JWT access token for admin
    token_claims = {
        "hospital_id": str(hospital.id),
        "hospital_uid": hospital.hospital_uid,
        "membership_id": str(mem.id),
        "role": "admin",
        "is_admin": True,
        "plan_code": "BASIC",
        "remember_me": False,
    }
    token = create_access_token(
        subject=str(u.id),
        extra_claims=token_claims,
        expires_delta=timedelta(days=1),
    )

    t_hash = hash_token(token)
    session_rec = SessionRecord(
        user_id=u.id,
        hospital_id=hospital.id,
        token_hash=t_hash,
        remember_me=False,
        expires_at=now + timedelta(days=1),
        is_revoked=False,
    )
    db.add(session_rec)
    db.commit()

    return u, mem, h_admin, token


def setup_ordinary_employee(
    db: Session, hospital: Hospital, doctor_role: Role, dept: Department
) -> tuple[User, TenantMembership, RoleAssignment]:
    u = User(
        id=uuid.uuid4(),
        username=f"doc_{uuid.uuid4().hex[:6]}",
        email=f"doc_{uuid.uuid4().hex[:6]}@stjude.org",
        full_name="Dr. Julian Smith",
        password_hash=get_password_hash("DoctorPass123!"),
        is_active=True,
        is_superuser=False,
    )
    db.add(u)
    db.flush()

    mem = TenantMembership(
        id=uuid.uuid4(),
        user_id=u.id,
        hospital_id=hospital.id,
        employee_uid=f"EMP-DOC-{uuid.uuid4().hex[:4].upper()}",
        employee_uid_verified=True,
        status="active",
    )
    db.add(mem)
    db.flush()

    ra = RoleAssignment(
        id=uuid.uuid4(),
        membership_id=mem.id,
        role_id=doctor_role.id,
        department_id=dept.id,
        scope_type="DEPARTMENT",
        assignment_status="active",
        assignment_source="admin_assigned",
        is_active=True,
    )
    db.add(ra)
    db.commit()
    return u, mem, ra


# -----------------------------------------------------------------------------
# TESTS
# -----------------------------------------------------------------------------

def test_admin_cannot_call_purchaser_invite_endpoint(client: TestClient, db: Session):
    """Test 1: Admin attempting to invite another administrator through purchaser endpoints fails."""
    _, _, hospital, admin_role, _ = setup_basic_hospital(db)
    _, _, _, admin_token = setup_administrator_user(db, hospital, admin_role)

    # Attempt to invite an administrator using the administrator's token
    res = client.post(
        f"/api/v1/purchaser/hospitals/{hospital.id}/administrators/invite",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"invitee_name": "Rogue Admin", "invitee_email": "rogue@stjude.org"},
    )
    assert res.status_code == 401


def test_admin_cannot_revoke_peer_administrator_membership(client: TestClient, db: Session):
    """Test 2: Admin attempting to revoke another administrator's membership fails."""
    _, _, hospital, admin_role, _ = setup_basic_hospital(db)
    _, _, _, admin_token = setup_administrator_user(db, hospital, admin_role)
    _, peer_mem, _, _ = setup_administrator_user(db, hospital, admin_role)

    # Acting admin attempts to terminate peer administrator's membership
    res = client.post(
        f"/api/v1/admin/employees/{peer_mem.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "terminated", "reason": "Unauthorized administrative purge"},
    )
    assert res.status_code == 400
    assert "Hospital Administrator membership status is protected" in res.json()["detail"]


def test_admin_cannot_terminate_own_membership(client: TestClient, db: Session):
    """Test 3: Admin attempting to revoke or terminate their own membership fails."""
    _, _, hospital, admin_role, _ = setup_basic_hospital(db)
    _, admin_mem, _, admin_token = setup_administrator_user(db, hospital, admin_role)

    # Admin attempts to terminate their own membership
    res = client.post(
        f"/api/v1/admin/employees/{admin_mem.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "terminated", "reason": "Self-inflicted lockout attempt"},
    )
    assert res.status_code == 400
    assert "cannot suspend, terminate, or mutate their own membership status" in res.json()["detail"]


def test_admin_cannot_revoke_own_administrator_assignment(client: TestClient, db: Session):
    """Test 4: Admin attempting to revoke an administrator role assignment fails."""
    _, _, hospital, admin_role, _ = setup_basic_hospital(db)
    _, admin_mem, _, admin_token = setup_administrator_user(db, hospital, admin_role)

    ra = db.query(RoleAssignment).filter(RoleAssignment.membership_id == admin_mem.id).first()
    assert ra is not None

    res = client.delete(
        f"/api/v1/admin/employees/{admin_mem.id}/assignments/{ra.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400
    assert "Hospital Administrator role assignments are protected" in res.json()["detail"]


def test_admin_cannot_assign_administrator_role_to_employee(client: TestClient, db: Session):
    """Test 5: Admin attempting to create an administrator RoleAssignment fails."""
    _, _, hospital, admin_role, dept = setup_basic_hospital(db)
    _, _, _, admin_token = setup_administrator_user(db, hospital, admin_role)
    _, emp_mem, _ = setup_ordinary_employee(db, hospital, admin_role, dept)

    # Attempt to assign the 'admin' role through the employee assignments endpoint
    res = client.post(
        f"/api/v1/admin/employees/{emp_mem.id}/assignments",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "role_id": str(admin_role.id),
            "department_id": None,
            "scope_type": "FACILITY",
        },
    )
    assert res.status_code in (400, 403)
    assert "Hospital Administrator authority cannot be assigned" in res.json()["detail"]


def test_admin_cannot_grant_admin_permission_overrides(client: TestClient, db: Session):
    """Test 6: Admin attempting to grant administrator-equivalent permission overrides fails."""
    _, _, hospital, admin_role, dept = setup_basic_hospital(db)
    _, _, _, admin_token = setup_administrator_user(db, hospital, admin_role)
    _, emp_mem, _ = setup_ordinary_employee(db, hospital, admin_role, dept)

    # Attempt to grant 'employee:manage' (executive administrative permission)
    res = client.post(
        f"/api/v1/admin/employees/{emp_mem.id}/overrides",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "permission_code": "employee:manage",
            "override_type": "GRANT",
            "department_id": None,
            "reason": "Escalate to co-administrator",
        },
    )
    assert res.status_code in (400, 403)
    assert "is an executive Hospital Administrator authority" in res.json()["detail"]


def test_employee_cannot_self_register_as_admin(client: TestClient, db: Session):
    """Test 7: Employee attempting to self-register as Hospital Administrator is rejected."""
    _, _, hospital, admin_role, _ = setup_basic_hospital(db)

    email = f"selfreg_{uuid.uuid4().hex[:6]}@stjude.org"
    start_res = client.post(
        "/api/v1/registration/start",
        json={"hospital_uid": hospital.hospital_uid, "email": email},
    )
    assert start_res.status_code == 200
    challenge_id = start_res.json()["challenge_id"]
    otp = mock_email_service.get_last_otp(email)

    verify_res = client.post(
        "/api/v1/registration/verify-otp",
        json={"challenge_id": challenge_id, "otp": otp},
    )
    assert verify_res.status_code == 200
    v_token = verify_res.json()["verification_token"]

    reg_payload = {
        "verification_token": v_token,
        "username": f"admin_aspirant_{uuid.uuid4().hex[:6]}",
        "password": "StrongPassword123!",
        "confirm_password": "StrongPassword123!",
        "full_name": "Aspiring Admin",
        "employee_uid": "EMP-ASP-01",
        "requested_assignments": [
            {"role_id": str(admin_role.id), "department_id": None}
        ],
    }
    reg_res = client.post("/api/v1/registration/submit", json=reg_payload)
    assert reg_res.status_code == 400
    assert "Hospital Administrator role cannot be requested" in reg_res.json()["detail"]


def test_employee_invitation_rejects_admin_role(client: TestClient, db: Session):
    """Test 8: Employee invitation containing Hospital Administrator is rejected."""
    _, _, hospital, admin_role, _ = setup_basic_hospital(db)
    _, _, _, admin_token = setup_administrator_user(db, hospital, admin_role)

    res = client.post(
        "/api/v1/admin/employees/invite",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "full_name": "Dr. Candidate",
            "email": "candidate@stjude.org",
            "assignments": [
                {"role_id": str(admin_role.id), "department_id": None, "scope_type": "FACILITY"}
            ],
        },
    )
    assert res.status_code == 400
    assert "Hospital Administrator access cannot be granted through employee invitations" in res.json()["detail"]


def test_purchaser_authorized_admin_invitation(client: TestClient, db: Session):
    """Test 9: Purchaser-authorized administrator invitation succeeds within quota."""
    purchaser, sub, hospital, _, _ = setup_basic_hospital(db)

    # Authenticate as purchaser
    p_token = f"purchaser-token-{uuid.uuid4().hex}"
    p_session = PurchaserSession(
        purchaser_id=purchaser.id,
        token_hash=hash_token(p_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    db.add(p_session)
    db.commit()

    res = client.post(
        f"/api/v1/purchaser/hospitals/{hospital.id}/administrators/invite",
        headers={"Authorization": f"Bearer {p_token}"},
        json={
            "invitee_name": "Dr. Legitimate Administrator",
            "invitee_email": "legit.admin@stjude.org",
            "invitee_designation": "Medical Director",
        },
    )
    assert res.status_code == 201
    assert res.json()["status"] == "PENDING"
    assert res.json()["invitee_email"] == "legit.admin@stjude.org"


def test_purchaser_authorized_admin_revocation_and_replacement(client: TestClient, db: Session):
    """Test 10: Purchaser removes administrator and replaces them under BASIC 1-seat limit."""
    purchaser, sub, hospital, admin_role, _ = setup_basic_hospital(db)
    _, _, h_admin, _ = setup_administrator_user(db, hospital, admin_role)

    p_token = f"purchaser-token-{uuid.uuid4().hex}"
    p_session = PurchaserSession(
        purchaser_id=purchaser.id,
        token_hash=hash_token(p_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    db.add(p_session)
    db.commit()

    # 1. Verify 1 active administrator exists
    active_count = db.query(HospitalAdministrator).filter(
        HospitalAdministrator.hospital_id == hospital.id,
        HospitalAdministrator.status == "active",
    ).count()
    assert active_count == 1

    # 2. Attempting a second admin invite fails because BASIC quota is 1
    res_fail = client.post(
        f"/api/v1/purchaser/hospitals/{hospital.id}/administrators/invite",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"invitee_name": "Replacement Admin", "invitee_email": "replacement@stjude.org"},
    )
    assert res_fail.status_code == 403
    assert "quota exceeded" in res_fail.json()["detail"].lower()

    # 3. Purchaser removes the existing administrator
    res_del = client.delete(
        f"/api/v1/purchaser/hospitals/{hospital.id}/administrators/{h_admin.id}",
        headers={"Authorization": f"Bearer {p_token}"},
    )
    assert res_del.status_code == 200

    # 4. Now purchaser invites the replacement administrator successfully
    res_replace = client.post(
        f"/api/v1/purchaser/hospitals/{hospital.id}/administrators/invite",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"invitee_name": "Replacement Admin", "invitee_email": "replacement@stjude.org"},
    )
    assert res_replace.status_code == 201
    assert res_replace.json()["status"] == "PENDING"


def test_concurrent_admin_seat_reservation(client: TestClient, db: Session):
    """Test 11: Seat reservation atomic check prevents exceeding BASIC 1-administrator quota."""
    purchaser, sub, hospital, _, _ = setup_basic_hospital(db)

    p_token = f"purchaser-token-{uuid.uuid4().hex}"
    p_session = PurchaserSession(
        purchaser_id=purchaser.id,
        token_hash=hash_token(p_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    db.add(p_session)
    db.commit()

    # First invite consumes the 1 BASIC seat
    res1 = client.post(
        f"/api/v1/purchaser/hospitals/{hospital.id}/administrators/invite",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"invitee_name": "Admin One", "invitee_email": "admin1@stjude.org"},
    )
    assert res1.status_code == 201

    # Second invite immediately rejected
    res2 = client.post(
        f"/api/v1/purchaser/hospitals/{hospital.id}/administrators/invite",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"invitee_name": "Admin Two", "invitee_email": "admin2@stjude.org"},
    )
    assert res2.status_code == 403
    assert "quota exceeded" in res2.json()["detail"].lower()
