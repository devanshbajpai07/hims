import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.permissions import MASTER_PERMISSION_CATALOGUE, get_tier_allowed_permissions
from app.core.security import get_password_hash, hash_token
from app.models.admin_invitation import HospitalAdministrator
from app.models.assignment import RoleAssignment
from app.models.department import Department
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.permission import (
    MembershipPermissionOverride,
    Permission,
    RoleVersion,
    RoleVersionPermission,
)
from app.models.purchaser import Purchaser, PurchaserSession
from app.models.purchaser_subscription import PurchaserSubscription
from app.models.role import Role
from app.models.user import User
from app.services.email_service import mock_email_service


def setup_test_hospital_and_admin(
    client: TestClient,
    db: Session,
    plan_code: str = "PRO",
    hospital_name: str = "Central Clinical Hospital",
) -> dict:
    """Helper to provision purchaser, subscription, registered hospital, and authenticated admin."""
    # 1. Purchaser & Subscription
    p_email = f"purchaser-{uuid.uuid4().hex[:8]}@hims-test.org"
    purchaser = Purchaser(
        id=uuid.uuid4(),
        full_name="Executive Purchaser",
        email=p_email,
        email_normalized=p_email.lower(),
        password_hash=get_password_hash("Pass123!"),
        is_email_verified=True,
        account_status="active",
    )
    db.add(purchaser)

    now = datetime.now(timezone.utc)
    sub = PurchaserSubscription(
        id=uuid.uuid4(),
        purchaser_id=purchaser.id,
        plan_code=plan_code.upper(),
        status="active",
        billing_interval="monthly",
        starts_at=now,
        current_period_ends_at=now + timedelta(days=30),
        auto_renew=False,
    )
    db.add(sub)
    db.commit()

    # Authenticate Purchaser
    token = f"p-tok-{uuid.uuid4().hex}"
    db.add(
        PurchaserSession(
            purchaser_id=purchaser.id,
            token_hash=hash_token(token),
            expires_at=now + timedelta(days=1),
            user_agent="Pytest",
            ip_address="127.0.0.1",
        )
    )
    db.commit()
    client.headers["Authorization"] = f"Bearer {token}"

    # Register Hospital
    reg_res = client.post(
        "/api/v1/purchaser/hospitals/register",
        json={"subscription_id": str(sub.id), "name": hospital_name, "city": "Boston"},
    )
    assert reg_res.status_code == 201
    hospital_data = reg_res.json()
    hospital_id = uuid.UUID(hospital_data["id"])

    # Invite Administrator
    admin_email = f"admin-{uuid.uuid4().hex[:8]}@hospital.org"
    client.post(
        f"/api/v1/purchaser/hospitals/{hospital_id}/administrators/invite",
        json={"invitee_name": "Dr. Sarah Connor", "invitee_email": admin_email},
    )
    invitation_link = mock_email_service.get_last_invitation_link(admin_email)
    raw_token = invitation_link.split("token=")[1]

    # Accept Invitation
    client.post(
        "/api/v1/admin/invitations/accept",
        json={
            "token": raw_token,
            "password": "AdminPassword123!",
            "username": f"admin_{uuid.uuid4().hex[:6]}",
        },
    )

    # Login Administrator
    login_res = client.post(
        "/api/v1/admin/auth/login",
        json={"username_or_email": admin_email, "password": "AdminPassword123!"},
    )
    assert login_res.status_code == 200
    admin_token = login_res.json()["token"]
    admin_user_id = uuid.UUID(login_res.json()["user"]["id"])

    return {
        "purchaser": purchaser,
        "subscription": sub,
        "hospital_id": hospital_id,
        "hospital_name": hospital_name,
        "admin_token": admin_token,
        "admin_user_id": admin_user_id,
        "plan_code": plan_code.upper(),
    }


def create_test_employee(
    db: Session, hospital_id: uuid.UUID, full_name: str = "Dr. Jane Roe"
) -> TenantMembership:
    """Helper to create an active employee membership in a hospital."""
    now = datetime.now(timezone.utc)
    email = f"emp-{uuid.uuid4().hex[:8]}@hims-test.org"
    user = User(
        id=uuid.uuid4(),
        full_name=full_name,
        username=f"user_{uuid.uuid4().hex[:8]}",
        email=email,
        password_hash=get_password_hash("EmpPass123!"),
        is_active=True,
    )
    db.add(user)
    db.flush()

    mem = TenantMembership(
        id=uuid.uuid4(),
        user_id=user.id,
        hospital_id=hospital_id,
        employee_uid=f"EMP-{uuid.uuid4().hex[:6].upper()}",
        status="active",
        employee_uid_verified=True,
        verified_at=now,
    )
    db.add(mem)
    db.commit()
    db.refresh(mem)
    return mem


# =============================================================================
# 1. MULTI-DEPARTMENT ROLE ASSIGNMENTS
# =============================================================================

def test_multi_department_role_assignments(client: TestClient, db: Session):
    """An employee must be able to hold multiple roles across distinct departments
    within the same hospital facility without database conflict.
    """
    ctx = setup_test_hospital_and_admin(client, db, plan_code="PRO")
    client.headers["Authorization"] = f"Bearer {ctx['admin_token']}"

    # Get departments and roles
    depts_res = client.get("/api/v1/admin/departments")
    roles_res = client.get("/api/v1/admin/roles")
    depts = depts_res.json()
    roles = roles_res.json()
    assert len(depts) >= 2
    assert len(roles) >= 2

    dept1 = depts[0]
    dept2 = depts[1]
    role_doctor = next(r for r in roles if r["code"] == "doctor")
    role_staff = next(r for r in roles if r["code"] == "staff")

    # Create employee
    mem = create_test_employee(db, ctx["hospital_id"], "Dr. Marcus Thorne")

    # 1. Assign Doctor role in Department 1
    assign1_res = client.post(
        f"/api/v1/admin/employees/{mem.id}/assignments",
        json={
            "department_id": dept1["id"],
            "role_id": role_doctor["id"],
            "scope_type": "DEPARTMENT",
        },
    )
    assert assign1_res.status_code == 201
    assign1_data = assign1_res.json()
    assert assign1_data["role_id"] == role_doctor["id"]
    assert assign1_data["department_id"] == dept1["id"]
    assert assign1_data["role_version_number"] is not None

    # 2. Assign Staff role in Department 2
    assign2_res = client.post(
        f"/api/v1/admin/employees/{mem.id}/assignments",
        json={
            "department_id": dept2["id"],
            "role_id": role_staff["id"],
            "scope_type": "DEPARTMENT",
        },
    )
    assert assign2_res.status_code == 201
    assign2_data = assign2_res.json()

    # 3. List employee assignments
    list_res = client.get(f"/api/v1/admin/employees/{mem.id}/assignments")
    assert list_res.status_code == 200
    active_assignments = [a for a in list_res.json() if a["is_active"]]
    assert len(active_assignments) == 2

    # 4. Revoke assignment 1
    revoke_res = client.delete(
        f"/api/v1/admin/employees/{mem.id}/assignments/{assign1_data['id']}"
    )
    assert revoke_res.status_code == 200

    list_res2 = client.get(f"/api/v1/admin/employees/{mem.id}/assignments")
    re_active = [a for a in list_res2.json() if a["is_active"]]
    assert len(re_active) == 1
    assert re_active[0]["id"] == assign2_data["id"]


# =============================================================================
# 2. DYNAMIC ROLE VERSION INHERITANCE
# =============================================================================

def test_dynamic_role_version_inheritance_and_versioning(client: TestClient, db: Session):
    """Permissions must be dynamically derived from active role version.
    Activating a new role version must update the employee's effective permissions
    without mutating employee membership rows.
    """
    ctx = setup_test_hospital_and_admin(client, db, plan_code="PRO")
    client.headers["Authorization"] = f"Bearer {ctx['admin_token']}"

    # 1. Create a custom role in PRO tier
    create_role_res = client.post(
        "/api/v1/admin/roles",
        json={
            "name": "Clinical Research Coordinator",
            "code": "research_coord",
            "scope": "department",
            "permission_codes": ["patient:read", "emr:read"],
        },
    )
    assert create_role_res.status_code == 201
    role_id = create_role_res.json()["role"]["id"]

    # 2. Assign this role to an employee
    mem = create_test_employee(db, ctx["hospital_id"], "Dr. Research Lead")
    client.post(
        f"/api/v1/admin/employees/{mem.id}/assignments",
        json={"role_id": role_id, "scope_type": "DEPARTMENT"},
    )

    # 3. Inspect effective permissions: should have patient:read and emr:read, but NOT prescription:create
    eff_res1 = client.get(f"/api/v1/admin/employees/{mem.id}/effective-permissions")
    assert eff_res1.status_code == 200
    eff1_map = {p["code"]: p for p in eff_res1.json()["permissions"]}
    assert eff1_map["patient:read"]["is_granted"] is True
    assert eff1_map["patient:read"]["source_role_version"] == 1
    assert eff1_map["emr:read"]["is_granted"] is True
    assert eff1_map["prescription:create"]["is_granted"] is False

    # 4. Create and activate Version 2 of this role with prescription:create added
    v2_res = client.post(
        f"/api/v1/admin/roles/{role_id}/versions",
        json={
            "permission_codes": ["patient:read", "emr:read", "prescription:create"],
            "change_reason": "Granted clinical trial prescription capabilities.",
        },
    )
    assert v2_res.status_code == 201
    assert v2_res.json()["version_number"] == 2

    # 5. Inspect effective permissions: prescription:create must now be GRANTED dynamically under v2!
    eff_res2 = client.get(f"/api/v1/admin/employees/{mem.id}/effective-permissions")
    assert eff_res2.status_code == 200
    eff2_map = {p["code"]: p for p in eff_res2.json()["permissions"]}
    assert eff2_map["prescription:create"]["is_granted"] is True
    assert eff2_map["prescription:create"]["status"] == "GRANTED"
    assert eff2_map["prescription:create"]["source_role_version"] == 2


# =============================================================================
# 3. EXPLICIT OVERRIDES PRECEDENCE ENGINE
# =============================================================================

def test_permission_override_precedence_and_denial_priority(client: TestClient, db: Session):
    """Strict evaluation engine rules:
    - Explicit DENY strictly overrides role-inherited grants.
    - Explicit GRANT adds permitted capability bounded by subscription tier.
    - Expired override is ignored.
    """
    ctx = setup_test_hospital_and_admin(client, db, plan_code="PRO")
    client.headers["Authorization"] = f"Bearer {ctx['admin_token']}"

    # Assign Doctor role
    roles = client.get("/api/v1/admin/roles").json()
    doctor_role = next(r for r in roles if r["code"] == "doctor")

    mem = create_test_employee(db, ctx["hospital_id"], "Dr. Supervised Doctor")
    client.post(
        f"/api/v1/admin/employees/{mem.id}/assignments",
        json={"role_id": doctor_role["id"], "scope_type": "DEPARTMENT"},
    )

    # Initial check: Doctor role has prescription:create GRANTED
    eff_res1 = client.get(f"/api/v1/admin/employees/{mem.id}/effective-permissions")
    eff1_map = {p["code"]: p for p in eff_res1.json()["permissions"]}
    assert eff1_map["prescription:create"]["is_granted"] is True

    # 1. Apply explicit DENY override on prescription:create
    deny_res = client.post(
        f"/api/v1/admin/employees/{mem.id}/overrides",
        json={
            "permission_code": "prescription:create",
            "override_type": "DENY",
            "reason": "Probationary supervision restriction on prescription privileges.",
        },
    )
    assert deny_res.status_code == 201
    deny_id = deny_res.json()["id"]

    # Re-inspect: DENY strictly overrides role grant!
    eff_res2 = client.get(f"/api/v1/admin/employees/{mem.id}/effective-permissions")
    eff2_map = {p["code"]: p for p in eff_res2.json()["permissions"]}
    assert eff2_map["prescription:create"]["is_granted"] is False
    assert eff2_map["prescription:create"]["status"] == "DENIED_BY_OVERRIDE"
    assert "Probationary" in eff2_map["prescription:create"]["reason"]

    # 2. Revoke DENY: access is restored from role
    client.delete(f"/api/v1/admin/employees/{mem.id}/overrides/{deny_id}")
    eff_res3 = client.get(f"/api/v1/admin/employees/{mem.id}/effective-permissions")
    eff3_map = {p["code"]: p for p in eff_res3.json()["permissions"]}
    assert eff3_map["prescription:create"]["is_granted"] is True

    # 3. Test expired override: past expires_at must be ignored
    past_iso = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    client.post(
        f"/api/v1/admin/employees/{mem.id}/overrides",
        json={
            "permission_code": "prescription:create",
            "override_type": "DENY",
            "reason": "Expired sanction",
            "expires_at": past_iso,
        },
    )
    eff_res4 = client.get(f"/api/v1/admin/employees/{mem.id}/effective-permissions")
    eff4_map = {p["code"]: p for p in eff_res4.json()["permissions"]}
    # Expired DENY does NOT block prescription:create
    assert eff4_map["prescription:create"]["is_granted"] is True


# =============================================================================
# 4. TIER ENFORCEMENT & RESTRICTIONS (BASIC, PRO, ULTRA)
# =============================================================================

def test_basic_tier_locked_catalogue_and_boundaries(client: TestClient, db: Session):
    """BASIC tier enforces locked institutional catalogue:
    - Custom department rejected
    - Custom role rejected
    - Custom role version rejected
    - Explicit GRANT override of higher tier permission rejected
    """
    ctx = setup_test_hospital_and_admin(client, db, plan_code="BASIC", hospital_name="Basic Community Clinic")
    client.headers["Authorization"] = f"Bearer {ctx['admin_token']}"

    # 1. Custom department creation rejected
    dept_res = client.post(
        "/api/v1/admin/departments",
        json={"name": "Specialized Oncology", "code": "ONCO"},
    )
    assert dept_res.status_code == 403
    assert "restricted under the basic" in dept_res.json()["detail"].lower()

    # 2. Custom role creation rejected
    role_res = client.post(
        "/api/v1/admin/roles",
        json={"name": "Research Fellow", "code": "fellow", "scope": "department"},
    )
    assert role_res.status_code == 403
    assert "restricted under the basic" in role_res.json()["detail"].lower()

    # 3. Role version creation rejected
    roles = client.get("/api/v1/admin/roles").json()
    any_role_id = roles[0]["id"]
    v_res = client.post(
        f"/api/v1/admin/roles/{any_role_id}/versions",
        json={"permission_codes": ["patient:read"], "change_reason": "Attempting basic edit"},
    )
    assert v_res.status_code == 403

    # 4. Explicit GRANT of higher-tier permission (e.g. patient:archive requires PRO/ULTRA) rejected
    mem = create_test_employee(db, ctx["hospital_id"], "Nurse Basic")
    grant_res = client.post(
        f"/api/v1/admin/employees/{mem.id}/overrides",
        json={
            "permission_code": "patient:archive",
            "override_type": "GRANT",
            "reason": "Attempting tier bypass",
        },
    )
    assert grant_res.status_code == 403
    assert "restricted under the basic" in grant_res.json()["detail"].lower()


def test_ultra_tier_role_inheritance_and_cyclic_prevention(client: TestClient, db: Session):
    """ULTRA tier supports parent role inheritance and prevents cyclic references."""
    ctx = setup_test_hospital_and_admin(client, db, plan_code="ULTRA", hospital_name="Enterprise Medical University")
    client.headers["Authorization"] = f"Bearer {ctx['admin_token']}"

    # 1. Create Base Clinical Role A
    res_a = client.post(
        "/api/v1/admin/roles",
        json={
            "name": "General Clinician",
            "code": "gen_clinician",
            "scope": "department",
            "permission_codes": ["patient:read", "vitals:read"],
        },
    )
    assert res_a.status_code == 201
    role_a_id = res_a.json()["role"]["id"]

    # 2. Create Child Specialist Role B that inherits from Role A
    res_b = client.post(
        "/api/v1/admin/roles",
        json={
            "name": "Senior Specialist",
            "code": "sr_specialist",
            "scope": "department",
            "permission_codes": ["prescription:create", "diagnosis:write"],
            "parent_role_id": role_a_id,
        },
    )
    assert res_b.status_code == 201
    role_b_id = res_b.json()["role"]["id"]

    # 3. Assign Role B to an employee: should inherit Role A's permissions dynamically!
    mem = create_test_employee(db, ctx["hospital_id"], "Dr. Ultra Specialist")
    client.post(
        f"/api/v1/admin/employees/{mem.id}/assignments",
        json={"role_id": role_b_id, "scope_type": "DEPARTMENT"},
    )

    eff_res = client.get(f"/api/v1/admin/employees/{mem.id}/effective-permissions")
    assert eff_res.status_code == 200
    eff_map = {p["code"]: p for p in eff_res.json()["permissions"]}

    # Direct child permissions
    assert eff_map["prescription:create"]["is_granted"] is True
    # Inherited parent permissions
    assert eff_map["patient:read"]["is_granted"] is True
    assert "Inherited" in eff_map["patient:read"]["source_role_name"]

    # 4. Cyclic inheritance prevention: Attempting to update Role A to inherit from Role B must be rejected!
    cycle_res = client.post(
        f"/api/v1/admin/roles/{role_a_id}/versions",
        json={
            "permission_codes": ["patient:read"],
            "parent_role_id": role_b_id,
            "change_reason": "Inducing cyclic graph A -> B -> A",
        },
    )
    assert cycle_res.status_code == 400
    assert "cyclic" in cycle_res.json()["detail"].lower()


# =============================================================================
# 5. CROSS-HOSPITAL ISOLATION
# =============================================================================

def test_cross_hospital_isolation_enforcement(client: TestClient, db: Session):
    """Administrators must not be able to assign roles or access records
    belonging to another hospital facility.
    """
    ctx1 = setup_test_hospital_and_admin(client, db, plan_code="PRO", hospital_name="Hospital Alpha")
    ctx2 = setup_test_hospital_and_admin(client, db, plan_code="PRO", hospital_name="Hospital Beta")

    # Employee in Hospital Beta
    mem_beta = create_test_employee(db, ctx2["hospital_id"], "Nurse Beta")

    # Admin of Hospital Alpha attempts to query or assign employee in Hospital Beta
    from app.core.config import settings
    client.cookies.clear()
    client.cookies[settings.SESSION_COOKIE_NAME] = ctx1["admin_token"]
    client.headers["Authorization"] = f"Bearer {ctx1['admin_token']}"

    # Query effective permissions
    eff_res = client.get(f"/api/v1/admin/employees/{mem_beta.id}/effective-permissions")
    assert eff_res.status_code in [400, 404]

    # Assign role
    roles_alpha = client.get("/api/v1/admin/roles").json()
    assign_res = client.post(
        f"/api/v1/admin/employees/{mem_beta.id}/assignments",
        json={"role_id": roles_alpha[0]["id"]},
    )
    assert assign_res.status_code in [400, 404]
