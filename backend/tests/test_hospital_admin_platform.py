import secrets
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.plans import PlanCode
from app.core.security import get_password_hash, hash_token
from app.models.admin_invitation import (
    HospitalAdminInvitation,
    HospitalAdministrator,
)
from app.models.audit import AuditLog
from app.models.department import Department
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.purchaser import Purchaser, PurchaserSession
from app.models.purchaser_subscription import PurchaserSubscription
from app.models.role import Role
from app.models.user import User
from app.services.email_service import mock_email_service


def create_test_purchaser_account(db: Session, email: str = "purchaser@aura.org") -> Purchaser:
    norm_email = email.lower().strip()
    existing = db.query(Purchaser).filter(Purchaser.email_normalized == norm_email).first()
    if existing:
        return existing
    p = Purchaser(
        id=uuid.uuid4(),
        full_name="Executive Purchaser",
        email=email,
        email_normalized=norm_email,
        password_hash=get_password_hash("StrongPass123!"),
        is_email_verified=True,
        account_status="active",
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def create_test_subscription(
    db: Session, purchaser_id: uuid.UUID, plan_code: str = "BASIC"
) -> PurchaserSubscription:
    now = datetime.now(timezone.utc)
    sub = PurchaserSubscription(
        id=uuid.uuid4(),
        purchaser_id=purchaser_id,
        plan_code=plan_code.upper(),
        status="active",
        billing_interval="monthly",
        starts_at=now,
        current_period_ends_at=now + timedelta(days=30),
        auto_renew=False,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def authenticate_purchaser_client(client: TestClient, db: Session, purchaser: Purchaser):
    token = f"purchaser-token-{uuid.uuid4().hex}"
    t_hash = hash_token(token)
    now = datetime.now(timezone.utc)
    session = PurchaserSession(
        purchaser_id=purchaser.id,
        token_hash=t_hash,
        expires_at=now + timedelta(days=1),
        user_agent="Pytest Client",
        ip_address="127.0.0.1",
    )
    db.add(session)
    db.commit()
    client.headers["Authorization"] = f"Bearer {token}"
    return token


# =========================================================================
# TEST SUITE: HOSPITAL REGISTRATION & TENANT ISOLATION
# =========================================================================

def test_purchaser_can_register_hospital(client: TestClient, db: Session):
    purchaser = create_test_purchaser_account(db, "purchaser1@hospital.org")
    sub = create_test_subscription(db, purchaser.id, "PRO")
    authenticate_purchaser_client(client, db, purchaser)

    payload = {
        "subscription_id": str(sub.id),
        "name": "St. Jude Metropolitan Center",
        "city": "Chicago",
        "facility_type": "Specialty Center",
        "address": "500 N Michigan Ave",
        "state": "IL",
        "country": "United States",
    }
    response = client.post("/api/v1/purchaser/hospitals/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "St. Jude Metropolitan Center"
    assert data["city"] == "Chicago"
    assert data["plan_code"] == "PRO"
    assert data["max_administrators"] == 3
    assert data["max_employees"] == 500
    assert data["hospital_uid"].startswith("AURA-")

    # Verify default departments and roles were created
    h_id = uuid.UUID(data["id"])
    depts = db.query(Department).filter(Department.hospital_id == h_id).all()
    assert len(depts) >= 5

    roles = db.query(Role).filter(Role.hospital_id == h_id).all()
    assert any(r.code == "admin" for r in roles)
    assert any(r.code == "doctor" for r in roles)


def test_cannot_assign_same_subscription_twice(client: TestClient, db: Session):
    purchaser = create_test_purchaser_account(db, "purchaser2@hospital.org")
    sub = create_test_subscription(db, purchaser.id, "BASIC")
    authenticate_purchaser_client(client, db, purchaser)

    payload1 = {
        "subscription_id": str(sub.id),
        "name": "Primary Clinic",
        "city": "Boston",
    }
    res1 = client.post("/api/v1/purchaser/hospitals/register", json=payload1)
    assert res1.status_code == 201

    payload2 = {
        "subscription_id": str(sub.id),
        "name": "Secondary Clinic",
        "city": "Boston",
    }
    res2 = client.post("/api/v1/purchaser/hospitals/register", json=payload2)
    assert res2.status_code == 400
    assert "already assigned" in res2.json()["detail"].lower()


# =========================================================================
# TEST SUITE: ADMINISTRATOR INVITATIONS & QUOTA ENFORCEMENT
# =========================================================================

def test_purchaser_can_invite_administrator_and_quota_enforced(client: TestClient, db: Session):
    purchaser = create_test_purchaser_account(db, "purchaser_quota@hospital.org")
    # Basic tier allows exactly 1 administrator
    sub = create_test_subscription(db, purchaser.id, "BASIC")
    authenticate_purchaser_client(client, db, purchaser)

    # Register hospital
    reg_res = client.post(
        "/api/v1/purchaser/hospitals/register",
        json={"subscription_id": str(sub.id), "name": "Basic Memorial", "city": "Denver"},
    )
    assert reg_res.status_code == 201
    hospital_id = reg_res.json()["id"]

    # First invitation: should succeed (1 of 1 seat)
    inv_res1 = client.post(
        f"/api/v1/purchaser/hospitals/{hospital_id}/administrators/invite",
        json={
            "invitee_name": "Dr. Elena Fisher",
            "invitee_email": "elena.fisher@basicmemorial.org",
            "invitee_designation": "Chief Administrator",
        },
    )
    assert inv_res1.status_code == 201
    inv1_data = inv_res1.json()
    assert inv1_data["status"] == "PENDING"
    assert inv1_data["invitee_name"] == "Dr. Elena Fisher"
    assert "token" not in inv1_data  # Raw token must not be exposed in API response

    # Check that invitation email was dispatched
    last_link = mock_email_service.get_last_invitation_link("elena.fisher@basicmemorial.org")
    assert last_link is not None
    assert "/admin/accept-invitation?token=" in last_link

    # Second invitation: should be REJECTED with 403 quota exceeded
    inv_res2 = client.post(
        f"/api/v1/purchaser/hospitals/{hospital_id}/administrators/invite",
        json={
            "invitee_name": "Dr. Nathan Drake",
            "invitee_email": "nathan.drake@basicmemorial.org",
        },
    )
    assert inv_res2.status_code == 403
    assert "quota exceeded" in inv_res2.json()["detail"].lower()


def test_invitation_acceptance_and_administrator_sign_in(client: TestClient, db: Session):
    purchaser = create_test_purchaser_account(db, "purchaser_accept@hospital.org")
    sub = create_test_subscription(db, purchaser.id, "PRO")
    authenticate_purchaser_client(client, db, purchaser)

    reg_res = client.post(
        "/api/v1/purchaser/hospitals/register",
        json={"subscription_id": str(sub.id), "name": "Apollo Specialty", "city": "Seattle"},
    )
    hospital_id = reg_res.json()["id"]

    # Invite administrator
    invitee_email = "marcus.vance@apolloclinic.org"
    client.post(
        f"/api/v1/purchaser/hospitals/{hospital_id}/administrators/invite",
        json={"invitee_name": "Dr. Marcus Vance", "invitee_email": invitee_email},
    )
    invitation_link = mock_email_service.get_last_invitation_link(invitee_email)
    raw_token = invitation_link.split("token=")[1]

    # Verify token endpoint (Public verification landing)
    verify_res = client.get(f"/api/v1/admin/invitations/verify-token?token={raw_token}")
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    assert v_data["valid"] is True
    assert v_data["hospital_name"] == "Apollo Specialty"
    assert v_data["invitee_email"] == invitee_email
    assert v_data["plan_code"] == "PRO"

    # Accept invitation
    accept_payload = {
        "token": raw_token,
        "password": "SecureAdminPassword123!",
        "username": "dr_marcus_vance",
    }
    accept_res = client.post("/api/v1/admin/invitations/accept", json=accept_payload)
    assert accept_res.status_code == 200
    acc_data = accept_res.json()
    assert acc_data["success"] is True

    # Token cannot be reused (Single-use check)
    reuse_res = client.post("/api/v1/admin/invitations/accept", json=accept_payload)
    assert reuse_res.status_code == 400
    assert "no longer valid" in reuse_res.json()["detail"].lower()

    # Dedicated Administrator Login
    login_payload = {
        "username_or_email": "dr_marcus_vance",
        "password": "SecureAdminPassword123!",
        "remember_me": True,
    }
    login_res = client.post("/api/v1/admin/auth/login", json=login_payload)
    assert login_res.status_code == 200
    l_data = login_res.json()
    assert l_data["success"] is True
    assert l_data["hospital"]["name"] == "Apollo Specialty"
    assert l_data["hospital"]["plan_code"] == "PRO"
    assert l_data["token"] is not None

    # Check cookies set
    assert "aura_employee_session" in client.cookies or l_data["token"] is not None

    # Use authenticated session to query /admin/auth/me
    client.headers["Authorization"] = f"Bearer {l_data['token']}"
    me_res = client.get("/api/v1/admin/auth/me")
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["user"]["username"] == "dr_marcus_vance"
    assert me_data["hospital"]["plan_code"] == "PRO"

    # Query overview metrics
    overview_res = client.get("/api/v1/admin/dashboard/overview")
    assert overview_res.status_code == 200
    ov_data = overview_res.json()
    assert ov_data["active_admin_count"] == 1
    assert ov_data["quota_usage"]["admins_used"] == 1
    assert ov_data["quota_usage"]["admins_allowed"] == 3


def test_normal_employee_cannot_access_administrator_portal(client: TestClient, db: Session):
    # Create hospital and normal doctor user
    purchaser = create_test_purchaser_account(db, "purchaser_norm@hospital.org")
    sub = create_test_subscription(db, purchaser.id, "BASIC")
    hosp = Hospital(
        hospital_uid="AURA-NORM-01",
        name="Normal Hospital",
        city="Austin",
        purchaser_id=purchaser.id,
        subscription_id=sub.id,
    )
    db.add(hosp)
    db.flush()

    norm_user = User(
        username="normal_doctor",
        email="doctor@normalhospital.org",
        password_hash=get_password_hash("DocPass123!"),
        full_name="Dr. Normal Doctor",
        is_active=True,
    )
    db.add(norm_user)
    db.flush()

    mem = TenantMembership(
        user_id=norm_user.id,
        hospital_id=hosp.id,
        employee_uid="DOC-001",
        employee_uid_verified=True,
        status="active",
    )
    db.add(mem)
    db.commit()

    # Attempt to sign in to /admin/auth/login
    login_res = client.post(
        "/api/v1/admin/auth/login",
        json={"username_or_email": "normal_doctor", "password": "DocPass123!"},
    )
    assert login_res.status_code == 403
    assert "administrator membership" in login_res.json()["detail"].lower()


def test_tier_restrictions_on_department_and_role_creation(client: TestClient, db: Session):
    purchaser = create_test_purchaser_account(db, "purchaser_tiers@hospital.org")

    # 1. BASIC Tier Hospital
    sub_basic = create_test_subscription(db, purchaser.id, "BASIC")
    authenticate_purchaser_client(client, db, purchaser)
    reg_b = client.post(
        "/api/v1/purchaser/hospitals/register",
        json={"subscription_id": str(sub_basic.id), "name": "Basic Clinic", "city": "Dallas"},
    )
    hosp_b_id = reg_b.json()["id"]

    # Invite and accept admin for Basic hospital
    client.post(
        f"/api/v1/purchaser/hospitals/{hosp_b_id}/administrators/invite",
        json={"invitee_name": "Admin Basic", "invitee_email": "admin@basicclinic.org"},
    )
    link_b = mock_email_service.get_last_invitation_link("admin@basicclinic.org")
    token_b = link_b.split("token=")[1]
    client.post(
        "/api/v1/admin/invitations/accept",
        json={"token": token_b, "password": "AdminPassword123!", "username": "admin_basic"},
    )

    # Login as Basic admin
    l_b = client.post(
        "/api/v1/admin/auth/login",
        json={"username_or_email": "admin_basic", "password": "AdminPassword123!"},
    )
    client.headers["Authorization"] = f"Bearer {l_b.json()['token']}"

    # Basic tier CANNOT create custom department (predefined only)
    dept_res = client.post(
        "/api/v1/admin/departments",
        json={"name": "Neurology Specialty", "code": "NEURO"},
    )
    assert dept_res.status_code == 403
    assert "restricted under the basic" in dept_res.json()["detail"].lower()

    # Basic tier CANNOT create custom role
    role_res = client.post(
        "/api/v1/admin/roles",
        json={"name": "Chief of Neurology", "code": "chief_neuro"},
    )
    assert role_res.status_code == 403
    assert "restricted under the basic" in role_res.json()["detail"].lower()

    # 2. PRO Tier Hospital
    sub_pro = create_test_subscription(db, purchaser.id, "PRO")
    authenticate_purchaser_client(client, db, purchaser)
    reg_p = client.post(
        "/api/v1/purchaser/hospitals/register",
        json={"subscription_id": str(sub_pro.id), "name": "Pro Hospital", "city": "Miami"},
    )
    hosp_p_id = reg_p.json()["id"]

    client.post(
        f"/api/v1/purchaser/hospitals/{hosp_p_id}/administrators/invite",
        json={"invitee_name": "Admin Pro", "invitee_email": "admin@prohospital.org"},
    )
    link_p = mock_email_service.get_last_invitation_link("admin@prohospital.org")
    token_p = link_p.split("token=")[1]
    client.post(
        "/api/v1/admin/invitations/accept",
        json={"token": token_p, "password": "AdminPassword123!", "username": "admin_pro"},
    )

    l_p = client.post(
        "/api/v1/admin/auth/login",
        json={"username_or_email": "admin_pro", "password": "AdminPassword123!"},
    )
    client.headers["Authorization"] = f"Bearer {l_p.json()['token']}"

    # Pro tier CAN create custom department
    p_dept = client.post(
        "/api/v1/admin/departments",
        json={"name": "Neurology Specialty", "code": "NEURO"},
    )
    assert p_dept.status_code == 201
    assert p_dept.json()["department"]["code"] == "NEURO"

    # Pro tier CAN create custom role
    p_role = client.post(
        "/api/v1/admin/roles",
        json={"name": "Chief of Neurology", "code": "chief_neuro"},
    )
    assert p_role.status_code == 201
    assert p_role.json()["role"]["code"] == "chief_neuro"


def test_revoking_and_resending_invitations(client: TestClient, db: Session):
    purchaser = create_test_purchaser_account(db, "purchaser_revoke@hospital.org")
    sub = create_test_subscription(db, purchaser.id, "BASIC")
    authenticate_purchaser_client(client, db, purchaser)

    reg_res = client.post(
        "/api/v1/purchaser/hospitals/register",
        json={"subscription_id": str(sub.id), "name": "Revoke Clinic", "city": "Phoenix"},
    )
    h_id = reg_res.json()["id"]

    inv_res = client.post(
        f"/api/v1/purchaser/hospitals/{h_id}/administrators/invite",
        json={"invitee_name": "Temp Admin", "invitee_email": "temp@revokeclinic.org"},
    )
    inv_id = inv_res.json()["id"]
    old_link = mock_email_service.get_last_invitation_link("temp@revokeclinic.org")
    old_token = old_link.split("token=")[1]

    # Revoke invitation
    rev_res = client.post(
        f"/api/v1/purchaser/hospitals/{h_id}/administrators/invitations/{inv_id}/revoke"
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["status"] == "REVOKED"

    # Old token cannot be accepted
    acc_res = client.post(
        "/api/v1/admin/invitations/accept",
        json={"token": old_token, "password": "Password123!"},
    )
    assert acc_res.status_code == 400
    assert "no longer valid" in acc_res.json()["detail"].lower()

    # Resend invitation
    resend_res = client.post(
        f"/api/v1/purchaser/hospitals/{h_id}/administrators/invitations/{inv_id}/resend"
    )
    assert resend_res.status_code == 200
    assert resend_res.json()["status"] == "PENDING"

    # Fresh link can be accepted
    new_link = mock_email_service.get_last_invitation_link("temp@revokeclinic.org")
    new_token = new_link.split("token=")[1]
    assert new_token != old_token

    acc_new = client.post(
        "/api/v1/admin/invitations/accept",
        json={"token": new_token, "password": "Password123!", "username": "temp_admin"},
    )
    assert acc_new.status_code == 200
    assert acc_new.json()["success"] is True
