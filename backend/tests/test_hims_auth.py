import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.security import verify_password
from app.models import (
    Hospital,
    Department,
    Role,
    User,
    TenantMembership,
    RegistrationRequest,
    RegistrationAssignmentRequest,
    ApprovalRecord,
    AuditLog,
)
from app.services.email_service import MockEmailService


def test_health_check(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


# -----------------------------------------------------------------------------
# STAGE 1: REGISTRATION & OTP TESTS
# -----------------------------------------------------------------------------

def test_stage1_valid_hospital_starts_registration(client: TestClient, email_mock: MockEmailService):
    email = f"resident_{uuid.uuid4().hex[:6]}@stjude.org"
    res = client.post(
        "/api/v1/registration/start",
        json={"hospital_uid": "STJUDE-METRO-01", "email": email},
    )
    assert res.status_code == 200
    data = res.json()
    assert "challenge_id" in data
    assert data["hospital_uid"] == "STJUDE-METRO-01"
    assert data["email"] == email

    # Verify OTP delivered through email adapter
    otp = email_mock.get_last_otp(email)
    assert otp is not None
    assert len(otp) == 6
    assert otp.isdigit()


def test_stage1_invalid_hospital_rejected(client: TestClient):
    res = client.post(
        "/api/v1/registration/start",
        json={"hospital_uid": "NON-EXISTENT-999", "email": f"test_{uuid.uuid4().hex[:6]}@unknown.org"},
    )
    assert res.status_code == 404
    assert res.json()["code"] == "HOSPITAL_NOT_FOUND"


def test_stage1_disabled_hospital_registration_rejected(client: TestClient):
    res = client.post(
        "/api/v1/registration/start",
        json={"hospital_uid": "CLOSED-CLINIC-03", "email": f"doc_{uuid.uuid4().hex[:6]}@closedclinic.org"},
    )
    assert res.status_code == 403
    assert res.json()["code"] == "REGISTRATION_DISABLED"


def test_stage1_invalid_otp_rejected(client: TestClient, email_mock: MockEmailService):
    email = f"invalid_otp_{uuid.uuid4().hex[:6]}@stjude.org"
    start_res = client.post(
        "/api/v1/registration/start",
        json={"hospital_uid": "STJUDE-METRO-01", "email": email},
    )
    assert start_res.status_code == 200
    challenge_id = start_res.json()["challenge_id"]

    verify_res = client.post(
        "/api/v1/registration/verify-otp",
        json={"challenge_id": challenge_id, "otp": "000000"},  # Wrong OTP
    )
    assert verify_res.status_code == 400
    assert verify_res.json()["code"] == "OTP_INVALID"


def test_stage1_otp_attempt_limits(client: TestClient, email_mock: MockEmailService):
    email = f"limits_{uuid.uuid4().hex[:6]}@stjude.org"
    start_res = client.post(
        "/api/v1/registration/start",
        json={"hospital_uid": "STJUDE-METRO-01", "email": email},
    )
    assert start_res.status_code == 200
    challenge_id = start_res.json()["challenge_id"]

    for _ in range(5):
        verify_res = client.post(
            "/api/v1/registration/verify-otp",
            json={"challenge_id": challenge_id, "otp": "999999"},
        )
    assert verify_res.status_code in [400, 429]


def test_stage1_otp_verification_unlocks_stage2(client: TestClient, email_mock: MockEmailService):
    email = f"unlock_{uuid.uuid4().hex[:6]}@stjude.org"
    start_res = client.post(
        "/api/v1/registration/start",
        json={"hospital_uid": "STJUDE-METRO-01", "email": email},
    )
    assert start_res.status_code == 200
    challenge_id = start_res.json()["challenge_id"]
    otp = email_mock.get_last_otp(email)

    verify_res = client.post(
        "/api/v1/registration/verify-otp",
        json={"challenge_id": challenge_id, "otp": otp},
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["verified"] is True
    assert "verification_token" in data
    assert data["email"] == email


# -----------------------------------------------------------------------------
# STAGE 2: ACCOUNT DETAILS & ACCESS REQUEST TESTS
# -----------------------------------------------------------------------------

def test_stage2_registration_submission_and_unverified_claim(
    client: TestClient, email_mock: MockEmailService, db: Session
):
    suffix = uuid.uuid4().hex[:6]
    email = f"rajiv_{suffix}@stjude.org"
    uname = f"rajiv_{suffix}"

    start_res = client.post(
        "/api/v1/registration/start",
        json={"hospital_uid": "STJUDE-METRO-01", "email": email},
    )
    assert start_res.status_code == 200
    challenge_id = start_res.json()["challenge_id"]
    otp = email_mock.get_last_otp(email)

    verify_res = client.post(
        "/api/v1/registration/verify-otp",
        json={"challenge_id": challenge_id, "otp": otp},
    )
    verification_token = verify_res.json()["verification_token"]

    # Get available departments and roles
    depts_res = client.get("/api/v1/registration/available-departments?hospital_uid=STJUDE-METRO-01")
    roles_res = client.get("/api/v1/registration/available-roles?hospital_uid=STJUDE-METRO-01")
    dept_id = depts_res.json()[0]["id"]
    role_id = roles_res.json()[0]["id"]

    # Submit Stage 2
    # Note: EMP-DOC-CLAIM-999 is an unverified claim, no employee directory match needed!
    sub_res = client.post(
        "/api/v1/registration/submit",
        json={
            "verification_token": verification_token,
            "full_name": "Dr. Rajiv Sharma",
            "employee_uid": "EMP-DOC-CLAIM-999",
            "username": uname,
            "password": "RajivPassword@123",
            "confirm_password": "RajivPassword@123",
            "requested_assignments": [
                {"department_id": dept_id, "role_id": role_id}
            ],
        },
    )
    assert sub_res.status_code == 201
    data = sub_res.json()
    assert data["status"] == "pending_approval"
    assert data["username"] == uname
    assert data["requested_slots_count"] == 1

    # Verify password stored ONLY as Argon2 hash in database
    user = db.execute(select(User).where(User.username == uname)).scalar_one()
    assert user.password_hash != "RajivPassword@123"
    assert verify_password("RajivPassword@123", user.password_hash) is True
    assert user.is_active is False  # Inactive until approved!

    # Verify membership created with unverified claim
    mem = db.execute(select(TenantMembership).where(TenantMembership.user_id == user.id)).scalar_one()
    assert mem.employee_uid == "EMP-DOC-CLAIM-999"
    assert mem.employee_uid_verified is False  # Unverified!
    assert mem.status == "pending"             # Pending!


def test_stage2_otp_cannot_be_reused(client: TestClient, email_mock: MockEmailService):
    suffix = uuid.uuid4().hex[:6]
    email = f"single_use_{suffix}@stjude.org"
    start_res = client.post(
        "/api/v1/registration/start",
        json={"hospital_uid": "STJUDE-METRO-01", "email": email},
    )
    assert start_res.status_code == 200
    challenge_id = start_res.json()["challenge_id"]
    otp = email_mock.get_last_otp(email)

    verify_res = client.post(
        "/api/v1/registration/verify-otp",
        json={"challenge_id": challenge_id, "otp": otp},
    )
    token = verify_res.json()["verification_token"]

    depts_res = client.get("/api/v1/registration/available-departments?hospital_uid=STJUDE-METRO-01")
    roles_res = client.get("/api/v1/registration/available-roles?hospital_uid=STJUDE-METRO-01")
    dept_id = depts_res.json()[0]["id"]
    role_id = roles_res.json()[0]["id"]

    # First submission consumes the token
    res1 = client.post(
        "/api/v1/registration/submit",
        json={
            "verification_token": token,
            "full_name": "Test Single Use",
            "employee_uid": "EMP-CLAIM-111",
            "username": f"single_u_{suffix}",
            "password": "Password@123",
            "confirm_password": "Password@123",
            "requested_assignments": [{"department_id": dept_id, "role_id": role_id}],
        },
    )
    assert res1.status_code == 201

    # Second submission using same token must be rejected!
    res2 = client.post(
        "/api/v1/registration/submit",
        json={
            "verification_token": token,
            "full_name": "Test Single Use",
            "employee_uid": "EMP-CLAIM-111",
            "username": f"single_u2_{suffix}",
            "password": "Password@123",
            "confirm_password": "Password@123",
            "requested_assignments": [{"department_id": dept_id, "role_id": role_id}],
        },
    )
    assert res2.status_code == 400
    assert res2.json()["code"] == "OTP_INVALID"


def test_username_uniqueness_case_insensitive(client: TestClient):
    # Existing user is 'sarah.almansoor'
    res1 = client.get("/api/v1/registration/check-username?username=sarah.almansoor")
    assert res1.status_code == 200
    assert res1.json()["available"] is False
    assert len(res1.json()["suggestions"]) > 0

    # UPPERCASE must also be rejected
    res2 = client.get("/api/v1/registration/check-username?username=SARAH.ALMANSOOR")
    assert res2.status_code == 200
    assert res2.json()["available"] is False

    # New unused username must be available
    res3 = client.get(f"/api/v1/registration/check-username?username=brand_new_{uuid.uuid4().hex[:6]}")
    assert res3.status_code == 200
    assert res3.json()["available"] is True


def test_five_slot_limit_enforced(client: TestClient, email_mock: MockEmailService):
    suffix = uuid.uuid4().hex[:6]
    email = f"five_slot_{suffix}@stjude.org"
    start_res = client.post(
        "/api/v1/registration/start",
        json={"hospital_uid": "STJUDE-METRO-01", "email": email},
    )
    assert start_res.status_code == 200
    challenge_id = start_res.json()["challenge_id"]
    otp = email_mock.get_last_otp(email)

    verify_res = client.post(
        "/api/v1/registration/verify-otp",
        json={"challenge_id": challenge_id, "otp": otp},
    )
    token = verify_res.json()["verification_token"]

    depts_res = client.get("/api/v1/registration/available-departments?hospital_uid=STJUDE-METRO-01").json()
    roles_res = client.get("/api/v1/registration/available-roles?hospital_uid=STJUDE-METRO-01").json()

    # Attempt 6 slots (exceeds max of 5)
    slots = []
    for i in range(6):
        slots.append({
            "department_id": depts_res[i % len(depts_res)]["id"],
            "role_id": roles_res[i % len(roles_res)]["id"]
        })

    res = client.post(
        "/api/v1/registration/submit",
        json={
            "verification_token": token,
            "full_name": "Dr. Six Slots",
            "employee_uid": "EMP-6SLOT",
            "username": f"dr_6slots_{suffix}",
            "password": "Password@123",
            "confirm_password": "Password@123",
            "requested_assignments": slots,
        },
    )
    assert res.status_code in [400, 422]


def test_contact_admin_additional_assignment_request(client: TestClient):
    res = client.post(
        "/api/v1/registration/additional-assignment-request",
        json={
            "hospital_uid": "STJUDE-METRO-01",
            "email": f"doctor_{uuid.uuid4().hex[:6]}@stjude.org",
            "employee_uid": "EMP-DOC-MULTI",
            "requested_responsibilities": "Requesting additional clinical supervision privileges in ICU.",
            "justification": "I have completed ICU fellowship and need dual coverage.",
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "pending"


# -----------------------------------------------------------------------------
# TWO-LEVEL APPROVAL TESTS
# -----------------------------------------------------------------------------

def test_two_level_approval_and_partial_approval(client: TestClient, email_mock: MockEmailService, db: Session):
    # 1. Register a user with 2 assignments
    suffix = uuid.uuid4().hex[:6]
    email = f"candidate_{suffix}@stjude.org"
    uname = f"cand_{suffix}"

    start_res = client.post(
        "/api/v1/registration/start",
        json={"hospital_uid": "STJUDE-METRO-01", "email": email},
    )
    assert start_res.status_code == 200
    challenge_id = start_res.json()["challenge_id"]
    otp = email_mock.get_last_otp(email)

    verify_res = client.post(
        "/api/v1/registration/verify-otp",
        json={"challenge_id": challenge_id, "otp": otp},
    )
    token = verify_res.json()["verification_token"]

    depts_res = client.get("/api/v1/registration/available-departments?hospital_uid=STJUDE-METRO-01").json()
    roles_res = client.get("/api/v1/registration/available-roles?hospital_uid=STJUDE-METRO-01").json()
    gen_med_id = [d["id"] for d in depts_res if d["code"] == "GEN-MED"][0]
    emerg_id = [d["id"] for d in depts_res if d["code"] == "EMERG"][0]
    doc_role_id = [r["id"] for r in roles_res if r["code"] == "doctor"][0]

    sub_res = client.post(
        "/api/v1/registration/submit",
        json={
            "verification_token": token,
            "full_name": "Dr. Candidate",
            "employee_uid": f"EMP-CAND-{suffix}",
            "username": uname,
            "password": "Password@123",
            "confirm_password": "Password@123",
            "requested_assignments": [
                {"department_id": gen_med_id, "role_id": doc_role_id},
                {"department_id": emerg_id, "role_id": doc_role_id},
            ],
        },
    )
    assert sub_res.status_code == 201
    reg_id = sub_res.json()["registration_id"]

    # Retrieve assignments
    status_res = client.get(f"/api/v1/registration/status?registration_id={reg_id}")
    assignments = status_res.json()["assignments"]
    assert len(assignments) == 2
    assign1_id = assignments[0]["id"]
    assign2_id = assignments[1]["id"]

    # 2. Level 1: Dept Head Review
    dh_login = client.post(
        "/api/v1/auth/login",
        json={"username": "depthead.genmed", "password": "DeptHead@123"},
    )
    assert dh_login.status_code == 200
    dh_token = dh_login.json()["session"]["access_token"]

    dh_res = client.post(
        "/api/v1/approvals/department-head",
        headers={"Authorization": f"Bearer {dh_token}"},
        json={
            "assignment_request_id": assign1_id,
            "decision": "approved",
            "notes": "Verified credentials for General Medicine.",
        },
    )
    assert dh_res.status_code == 200
    assert dh_res.json()["status"] == "approved_by_dept"

    # 3. Level 2: Hospital Admin Final Approval with Partial Decision
    # Authenticate as admin.stjude
    admin_login = client.post(
        "/api/v1/admin/auth/login",
        json={"username_or_email": "admin.stjude", "password": "Admin@123"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["token"]

    admin_res = client.post(
        "/api/v1/approvals/admin-final",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "registration_request_id": reg_id,
            "verify_employee_uid": True,
            "assignment_decisions": [
                {"assignment_id": assign1_id, "decision": "approved"},
                {"assignment_id": assign2_id, "decision": "rejected"},
            ],
            "notes": "Verified against St. Jude HR database. Approved for GenMed.",
        },
    )
    assert admin_res.status_code == 200
    assert admin_res.json()["status"] == "partially_approved"
    assert admin_res.json()["employee_uid_verified"] is True

    # 4. Now the user can log in to operational features!
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username": uname, "password": "Password@123"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["session"]["active_membership"]["status"] == "active"
    assert login_res.json()["session"]["active_membership"]["role"] == "doctor"


# -----------------------------------------------------------------------------
# AUTHENTICATION & LOGIN TESTS
# -----------------------------------------------------------------------------

def test_login_valid_credentials(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "sarah.almansoor", "password": "Doctor@123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["session"] is not None
    assert data["session"]["user"]["username"] == "sarah.almansoor"
    assert data["session"]["active_membership"]["role"] == "doctor"
    assert data["session"]["active_membership"]["status"] == "active"
    # Check session cookie set
    assert "hims_session" in res.cookies


def test_login_case_insensitive_username(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "SaRaH.AlMaNsOoR", "password": "Doctor@123"},
    )
    assert res.status_code == 200
    assert res.json()["session"]["user"]["username"] == "sarah.almansoor"


def test_login_with_official_email(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "sarah.almansoor@stjude.org", "password": "Doctor@123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["session"] is not None
    assert data["session"]["user"]["username"] == "sarah.almansoor"
    assert data["session"]["user"]["email"] == "sarah.almansoor@stjude.org"


def test_login_invalid_password_rejected(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "sarah.almansoor", "password": "WrongPassword!999"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid username or password."


def test_login_nonexistent_user_rejected(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "ghost.nonexistent", "password": "AnyPassword@123"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid username or password."


def test_login_pending_account_denied(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "priya.pending", "password": "Priya@123"},
    )
    assert res.status_code == 403
    assert res.json()["code"] == "ACCOUNT_PENDING"


def test_login_suspended_account_denied(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "vikram.suspended", "password": "Vikram@123"},
    )
    assert res.status_code == 403
    assert res.json()["code"] == "ACCOUNT_SUSPENDED"


def test_login_terminated_account_denied(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "anita.terminated", "password": "Anita@123"},
    )
    assert res.status_code == 403
    assert res.json()["code"] == "ACCOUNT_TERMINATED"


def test_multi_hospital_login_prompts_workspace_selection(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "rahul", "password": "Rahul@123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["requires_workspace_selection"] is True
    assert len(data["available_memberships"]) == 2

    # Perform workspace selection
    hosp_id = data["available_memberships"][0]["hospital_id"]
    user_id = data["user_id"]

    sel_res = client.post(
        "/api/v1/auth/select-workspace",
        json={"user_id": user_id, "hospital_id": hosp_id},
    )
    assert sel_res.status_code == 200
    assert sel_res.json()["active_membership"]["hospital_id"] == hosp_id
    assert "hims_session" in sel_res.cookies


def test_forgot_password_generic_response(client: TestClient):
    # Existing user
    res1 = client.post(
        "/api/v1/auth/forgot-password",
        json={"identifier": "sarah.almansoor"},
    )
    assert res1.status_code == 200
    assert res1.json()["success"] is True

    # Non-existent user receives exact same message (no user enumeration)
    res2 = client.post(
        "/api/v1/auth/forgot-password",
        json={"identifier": "nonexistent@hospital.org"},
    )
    assert res2.status_code == 200
    assert res2.json()["message"] == res1.json()["message"]


# -----------------------------------------------------------------------------
# ADDITIONAL SECURITY & GOVERNANCE TESTS
# -----------------------------------------------------------------------------

def test_unauthorized_user_cannot_approve_registration(client: TestClient, db: Session):
    # Find any pending assignment request
    assign_req = db.execute(
        select(RegistrationAssignmentRequest).where(RegistrationAssignmentRequest.status == "pending_dept_review")
    ).scalars().first()

    if assign_req:
        # A. Unauthenticated request MUST be rejected with 401 Unauthorized (C-1)
        unauth_res = client.post(
            "/api/v1/approvals/department-head",
            json={
                "assignment_request_id": str(assign_req.id),
                "decision": "approved",
                "notes": "Unauthenticated caller trying to approve",
            },
        )
        assert unauth_res.status_code == 401

        # B. Authenticated regular doctor (Dr. Sarah) tries to act as Department Head for review -> 403 Forbidden
        doc_login = client.post(
            "/api/v1/auth/login",
            json={"username": "sarah.almansoor", "password": "Doctor@123"},
        )
        assert doc_login.status_code == 200
        doc_token = doc_login.json()["session"]["access_token"]

        res = client.post(
            "/api/v1/approvals/department-head",
            headers={"Authorization": f"Bearer {doc_token}"},
            json={
                "assignment_request_id": str(assign_req.id),
                "decision": "approved",
                "notes": "Unauthorized doctor trying to approve",
            },
        )
        assert res.status_code == 403
        assert res.json()["code"] == "DEPARTMENT_HEAD_UNAUTHORIZED"


def test_logout_clears_session_cookie(client: TestClient):
    # First log in
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username": "sarah.almansoor", "password": "Doctor@123"},
    )
    assert login_res.status_code == 200

    # Call logout
    logout_res = client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200
    assert logout_res.json()["success"] is True


def test_audit_logs_recorded_for_approvals(db: Session):
    # Verify that audit_logs table contains administrative and approval actions
    logs = db.execute(select(AuditLog)).scalars().all()
    assert len(logs) > 0
    actions = [l.action for l in logs]
    assert any("APPROVAL" in a or "DEPT_HEAD" in a for a in actions)
