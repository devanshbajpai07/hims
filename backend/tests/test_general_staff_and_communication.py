import uuid
import pytest
from fastapi.testclient import TestClient

from app.core.permissions import SYSTEM_ROLE_PERMISSIONS
from app.db.database import SessionLocal
from app.main import app
from app.models.assignment import RoleAssignment
from app.models.communication import EmployeeMessage
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.permission import RoleVersion
from app.models.role import Role
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.authorization_service import AuthorizationService


@pytest.fixture
def client():
    return TestClient(app)


def _login(client: TestClient, username: str, password: str = "Password@123") -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    session = res.json().get("session") or {}
    return session.get("access_token") or session.get("token")


def test_general_staff_canonical_permission_count():
    """Asserts that General Staff has strictly 6 canonical permissions and zero clinical/patient permissions."""
    staff_perms = SYSTEM_ROLE_PERMISSIONS["staff"]
    assert len(staff_perms) == 6, f"Expected exactly 6 permissions for General Staff, got {len(staff_perms)}: {staff_perms}"
    
    # Required retained
    assert "account:profile:read" in staff_perms
    assert "account:password:change" in staff_perms
    
    # Required communication
    assert "communication:read" in staff_perms
    assert "communication:create" in staff_perms
    assert "communication:respond" in staff_perms
    assert "communication:complete" in staff_perms
    
    # Strictly prohibited clinical / operational / administrative permissions
    prohibited = [
        "patient:read",
        "patient:create",
        "patient:update",
        "queue:read",
        "queue:manage",
        "appointment:read",
        "appointment:create",
        "appointment:manage",
        "department:read",
        "document:read",
        "document:upload",
        "account:profile:update",
        "account:session:revoke",
    ]
    for p in prohibited:
        assert p not in staff_perms, f"Prohibited permission '{p}' found in General Staff default permissions!"


def test_receptionist_canonical_13_permissions_preserved():
    """Verifies that Receptionist canonical permissions remain exactly 13."""
    rec_perms = SYSTEM_ROLE_PERMISSIONS["receptionist"]
    assert len(rec_perms) == 13, f"Expected exactly 13 permissions for Receptionist, got {len(rec_perms)}"


def test_general_staff_cannot_access_clinical_endpoints(client):
    """Verifies that a General Staff member is blocked with 403 from all clinical patient/appointment endpoints."""
    db = SessionLocal()
    try:
        # Find active staff membership in database
        staff_asgn = (
            db.query(RoleAssignment)
            .join(Role, RoleAssignment.role_id == Role.id)
            .join(TenantMembership, RoleAssignment.membership_id == TenantMembership.id)
            .filter(Role.code == "staff", TenantMembership.status == "active", RoleAssignment.is_active == True)
            .first()
        )
        if not staff_asgn:
            pytest.skip("No active staff employee found for test.")
            
        mem = staff_asgn.membership
        user = mem.user
        token = _login(client, user.username, "Staff@123")
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Blocked from patient:read
    res = client.get("/api/v1/clinical/patients", headers=headers)
    assert res.status_code == 403, f"Expected 403 for General Staff on /patients, got {res.status_code}"
    
    # 2. Blocked from appointment:read
    res = client.get("/api/v1/clinical/appointments", headers=headers)
    assert res.status_code == 403, f"Expected 403 for General Staff on /appointments, got {res.status_code}"
    
    # 3. Blocked from queue:manage (check-in)
    res = client.patch("/api/v1/clinical/appointments/00000000-0000-0000-0000-000000000000/check-in", headers=headers)
    assert res.status_code == 403, f"Expected 403 for General Staff on check-in, got {res.status_code}"


def test_communication_recipients_excludes_self(client):
    """Verifies that /api/v1/communication/recipients returns only active General Staff in same hospital, excluding self."""
    db = SessionLocal()
    try:
        # Find an active staff employee
        staff_asgns = (
            db.query(RoleAssignment)
            .join(Role, RoleAssignment.role_id == Role.id)
            .join(TenantMembership, RoleAssignment.membership_id == TenantMembership.id)
            .filter(Role.code == "staff", TenantMembership.status == "active", RoleAssignment.is_active == True)
            .all()
        )
        if len(staff_asgns) < 1:
            pytest.skip("Not enough staff employees for recipient testing.")
        
        caller_user = staff_asgns[0].membership.user
        caller_mem = staff_asgns[0].membership
        token = _login(client, caller_user.username, "Staff@123")
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/communication/recipients", headers=headers)
    assert res.status_code == 200
    recipients = res.json()
    
    # Assert caller is NEVER in recipient list
    for r in recipients:
        assert r["membership_id"] != str(caller_mem.id)
        assert r["user_id"] != str(caller_user.id)


def test_communication_self_messaging_rejected(client):
    """Verifies that an employee attempting to message themselves is rejected with 400 Bad Request."""
    db = SessionLocal()
    try:
        staff_asgn = (
            db.query(RoleAssignment)
            .join(Role, RoleAssignment.role_id == Role.id)
            .join(TenantMembership, RoleAssignment.membership_id == TenantMembership.id)
            .filter(Role.code == "staff", TenantMembership.status == "active", RoleAssignment.is_active == True)
            .first()
        )
        if not staff_asgn:
            pytest.skip("No active staff employee found.")
        
        caller_mem = staff_asgn.membership
        caller_user = caller_mem.user
        token = _login(client, caller_user.username, "Staff@123")
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/v1/communication/messages",
        headers=headers,
        json={
            "recipient_membership_id": str(caller_mem.id),
            "subject": "Self Message Attempt",
            "message_body": "This must be rejected by backend.",
        },
    )
    assert res.status_code == 400
    assert "oneself" in res.json()["detail"].lower()


def test_end_to_end_communication_and_completion_lifecycle(client):
    """Tests the full lifecycle of an internal communication request:
    1. Receptionist sends request to General Staff member.
    2. Message is persisted in DB with PENDING status and is_read=False.
    3. General Staff inbox returns the message.
    4. General Staff unread-count increments.
    5. General Staff opens message -> auto-marked is_read=True.
    6. General Staff completes task -> status COMPLETED, completed_at recorded.
    7. Receptionist checks sent items -> sees status COMPLETED synchronized.
    """
    db = SessionLocal()
    try:
        # Find a receptionist and a staff in the same hospital
        rec_asgn = (
            db.query(RoleAssignment)
            .join(Role, RoleAssignment.role_id == Role.id)
            .join(TenantMembership, RoleAssignment.membership_id == TenantMembership.id)
            .filter(Role.code == "receptionist", TenantMembership.status == "active", RoleAssignment.is_active == True)
            .first()
        )
        assert rec_asgn, "Receptionist assignment not found in DB."
        hosp_id = rec_asgn.membership.hospital_id
        rec_user = rec_asgn.membership.user

        staff_asgn = (
            db.query(RoleAssignment)
            .join(Role, RoleAssignment.role_id == Role.id)
            .join(TenantMembership, RoleAssignment.membership_id == TenantMembership.id)
            .filter(
                Role.code == "staff",
                TenantMembership.hospital_id == hosp_id,
                TenantMembership.status == "active",
                RoleAssignment.is_active == True,
            )
            .first()
        )
        assert staff_asgn, "General Staff assignment in same hospital not found in DB."
        staff_mem = staff_asgn.membership
        staff_user = staff_mem.user

        rec_token = _login(client, rec_user.username, "Receptionist@123")
        staff_token = _login(client, staff_user.username, "Staff@123")
    finally:
        db.close()

    rec_headers = {"Authorization": f"Bearer {rec_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Step 1: Receptionist checks unread count for staff before
    res_count_before = client.get("/api/v1/communication/unread-count", headers=staff_headers)
    assert res_count_before.status_code == 200
    initial_unread = res_count_before.json()["unread_count"]

    # Step 2: Receptionist creates request to General Staff
    subj = f"Wheelchair transport requested - Bay {uuid.uuid4().hex[:4]}"
    body = "Please bring a standard wheelchair to reception triage for an arriving patient."
    res_create = client.post(
        "/api/v1/communication/messages",
        headers=rec_headers,
        json={
            "recipient_membership_id": str(staff_mem.id),
            "subject": subj,
            "message_body": body,
        },
    )
    assert res_create.status_code == 201, f"Create message failed: {res_create.text}"
    msg_data = res_create.json()
    msg_id = msg_data["id"]
    assert msg_data["subject"] == subj
    assert msg_data["status"] == "PENDING"
    assert msg_data["is_read"] is False
    assert msg_data["completed_at"] is None

    # Step 3: General Staff unread count is incremented
    res_count_after = client.get("/api/v1/communication/unread-count", headers=staff_headers)
    assert res_count_after.status_code == 200
    assert res_count_after.json()["unread_count"] == initial_unread + 1

    # Step 4: General Staff checks inbox
    res_inbox = client.get("/api/v1/communication/inbox", headers=staff_headers)
    assert res_inbox.status_code == 200
    inbox_items = res_inbox.json()
    found = next((m for m in inbox_items if m["id"] == msg_id), None)
    assert found is not None, "Created message not found in General Staff inbox!"
    assert found["sender_name"] == rec_user.full_name

    # Step 5: General Staff views message detail -> auto-read
    res_detail = client.get(f"/api/v1/communication/messages/{msg_id}", headers=staff_headers)
    assert res_detail.status_code == 200
    detail_data = res_detail.json()
    assert detail_data["is_read"] is True
    assert detail_data["read_at"] is not None

    # Step 6: General Staff completes task
    res_complete = client.post(
        f"/api/v1/communication/messages/{msg_id}/complete",
        headers=staff_headers,
        json={"completion_notes": "Wheelchair delivered to reception bay."},
    )
    assert res_complete.status_code == 200
    completed_data = res_complete.json()
    assert completed_data["status"] == "COMPLETED"
    assert completed_data["completed_at"] is not None
    assert completed_data["completed_by_name"] == staff_user.full_name
    assert completed_data["completion_notes"] == "Wheelchair delivered to reception bay."

    # Step 7: Receptionist checks sent items and verifies real-time synchronized completion
    res_sent = client.get("/api/v1/communication/sent", headers=rec_headers)
    assert res_sent.status_code == 200
    sent_items = res_sent.json()
    sent_msg = next((m for m in sent_items if m["id"] == msg_id), None)
    assert sent_msg is not None
    assert sent_msg["status"] == "COMPLETED"
    assert sent_msg["completed_at"] is not None
    assert sent_msg["completed_by_name"] == staff_user.full_name


def test_unauthorized_user_cannot_access_message(client):
    """Verifies that an unrelated employee who is neither sender nor recipient cannot read another employee's message."""
    db = SessionLocal()
    try:
        # Create a message between receptionist and staff
        rec_asgn = (
            db.query(RoleAssignment)
            .join(Role, RoleAssignment.role_id == Role.id)
            .join(TenantMembership, RoleAssignment.membership_id == TenantMembership.id)
            .filter(Role.code == "receptionist", TenantMembership.status == "active", RoleAssignment.is_active == True)
            .first()
        )
        staff_asgn = (
            db.query(RoleAssignment)
            .join(Role, RoleAssignment.role_id == Role.id)
            .join(TenantMembership, RoleAssignment.membership_id == TenantMembership.id)
            .filter(Role.code == "staff", TenantMembership.status == "active", RoleAssignment.is_active == True)
            .first()
        )
        assert rec_asgn and staff_asgn
        sender_mem = rec_asgn.membership
        recip_mem = staff_asgn.membership

        msg = EmployeeMessage(
            id=uuid.uuid4(),
            hospital_id=sender_mem.hospital_id,
            sender_membership_id=sender_mem.id,
            sender_user_id=sender_mem.user_id,
            sender_name=sender_mem.user.full_name,
            sender_role_name="Receptionist",
            recipient_membership_id=recip_mem.id,
            recipient_user_id=recip_mem.user_id,
            recipient_name=recip_mem.user.full_name,
            recipient_role_name="General Staff",
            subject="Confidential Request",
            message_body="Internal hospital body",
            status="PENDING",
            is_read=False,
        )
        db.add(msg)
        db.commit()
        msg_id = str(msg.id)

        # Login as Dr. Sarah (unrelated doctor who is neither sender nor recipient)
        third_party_token = _login(client, "sarah.almansoor", "Doctor@123")
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {third_party_token}"}
    res = client.get(f"/api/v1/communication/messages/{msg_id}", headers=headers)
    assert res.status_code == 403
    assert "neither the sender nor the recipient" in res.json()["detail"].lower()
