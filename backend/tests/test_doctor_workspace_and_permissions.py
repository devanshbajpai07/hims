import pytest
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.clinical import PatientRecord, AppointmentRecord
from app.models.department import Department
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.assignment import RoleAssignment
from app.models.role import Role
from app.models.user import User
from app.core.security import get_password_hash


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


def test_doctor_dashboard_summary_and_queue_flow(client: TestClient, db: Session):
    """Verifies that Doctor dashboard summary returns real database metrics,
    and Doctor can call next patient from queue and conclude consultation.
    """
    token = _login(client, "sarah.almansoor", "Doctor@123")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Fetch Doctor dashboard summary
    res_dash = client.get("/api/v1/clinical/doctor/dashboard-summary", headers=headers)
    assert res_dash.status_code == 200
    dash_data = res_dash.json()
    assert "waiting_patients_count" in dash_data
    assert "new_patients_count" in dash_data
    assert "returning_patients_count" in dash_data
    assert dash_data["department_name"] == "General Medicine"

    # 2. Get appointments
    res_appts = client.get("/api/v1/clinical/appointments", headers=headers)
    assert res_appts.status_code == 200
    appts = res_appts.json()
    assert len(appts) >= 1
    target_appt = next((a for a in appts if a["status"] in ("checked-in", "pending")), appts[0])

    # 3. Call patient into consultation
    res_call = client.post(f"/api/v1/clinical/queue/{target_appt['id']}/call", headers=headers)
    assert res_call.status_code == 200
    called = res_call.json()
    assert called["status"] == "in-progress"
    assert "Physician" in called["doctor_name"] or "Dr." in called["doctor_name"] or "Sarah" in called["doctor_name"]

    # 4. Conclude consultation
    res_complete = client.post(
        f"/api/v1/clinical/consultations/{target_appt['id']}/complete",
        json={
            "clinical_notes": "Follow-up visit. Symptom improvement observed. No adverse reactions.",
            "diagnosis": "Resolving Respiratory Infection",
            "prescriptions": "Completed course",
        },
        headers=headers,
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["status"] == "completed"

    # 5. Doctor Patient History
    res_history = client.get("/api/v1/clinical/doctor/patient-history", headers=headers)
    assert res_history.status_code == 200
    hist = res_history.json()
    assert hist["total"] >= 1
    found_pat = next((p for p in hist["items"] if p["patient_mrn"] == target_appt["patient_mrn"]), hist["items"][0])
    assert found_pat["patient_mrn"] == target_appt["patient_mrn"]
    assert "Resolving Respiratory Infection" in (found_pat["diagnosis"] or "")


def test_doctor_department_scoping_isolation(client: TestClient, db: Session):
    """Verifies that two Doctors assigned to different departments (e.g. General Medicine vs Cardiology)
    do not access each other's restricted departmental patients.
    """
    hosp = db.execute(select(Hospital).where(Hospital.hospital_uid == "STJUDE-METRO-01")).scalar_one()
    cardio_dept = db.execute(select(Department).where(Department.hospital_id == hosp.id, Department.code == "CARDIO")).scalar_one()
    genmed_dept = db.execute(select(Department).where(Department.hospital_id == hosp.id, Department.code == "GEN-MED")).scalar_one()

    # Ensure Rahul's cardio assignment is active
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

    # Clean up any leftover test record
    existing_p = db.execute(select(PatientRecord).where(PatientRecord.mrn == "MRN-CARDIO-999")).scalar_one_or_none()
    if existing_p:
        db.delete(existing_p)
    db.commit()

    # sarah.almansoor is Doctor in General Medicine
    token_sarah = _login(client, "sarah.almansoor", "Doctor@123")
    headers_sarah = {"Authorization": f"Bearer {token_sarah}"}

    # rahul is Doctor in Cardiology
    token_rahul = _login(client, "rahul", "Rahul@123")
    headers_rahul = {"Authorization": f"Bearer {token_rahul}"}

    # Create a cardiology-specific patient
    p_cardio = PatientRecord(
        hospital_id=hosp.id,
        mrn="MRN-CARDIO-999",
        full_name="Cardio Patient Test",
        age=65,
        gender="M",
        contact_phone="+1 555 111 2222",
        department_id=cardio_dept.id,
        triage_category="Routine",
        chief_complaint="Arrhythmia checkup",
        clinical_notes="Confidential Cardiology consultation notes",
        admission_status="outpatient",
    )
    db.add(p_cardio)
    db.commit()

    # Sarah (General Medicine) retrieves patients -> should NOT see p_cardio
    res_sarah = client.get("/api/v1/clinical/patients", headers=headers_sarah)
    assert res_sarah.status_code == 200
    sarah_mrns = [p["mrn"] for p in res_sarah.json()]
    assert "MRN-CARDIO-999" not in sarah_mrns

    # Rahul (Cardiology) retrieves patients -> CAN see p_cardio
    res_rahul = client.get("/api/v1/clinical/patients", headers=headers_rahul)
    assert res_rahul.status_code == 200
    rahul_mrns = [p["mrn"] for p in res_rahul.json()]
    assert "MRN-CARDIO-999" in rahul_mrns
