import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.clinical import PatientRecord, AppointmentRecord, PatientVitalRecord, NursingTaskRecord
from app.models.membership import TenantMembership
from app.models.assignment import RoleAssignment
from app.models.role import Role
from app.models.department import Department
from app.models.user import User


def _login(client: TestClient, username: str, password: str = "SecurePass123!") -> str:
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    data = res.json()
    assert data.get("session") is not None
    return data["session"]["access_token"]


def test_receptionist_patient_intake_and_redaction(client: TestClient, db: Session):
    """Verifies that Medical Receptionists can view patients but clinical notes are strictly redacted."""
    token = _login(client, "clara.receptionist", "Receptionist@123")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. List patients
    res = client.get("/api/v1/clinical/patients", headers=headers)
    assert res.status_code == 200
    patients = res.json()
    assert len(patients) >= 1
    p = next((x for x in patients if x["mrn"] == "MRN-10024"), patients[0])
    assert p["mrn"] == "MRN-10024"
    assert p["full_name"] == "Eleanor Vance"
    # Clinical notes must be redacted for receptionist
    assert "PROTECTED" in p["clinical_notes"]

    # 2. Register new patient
    new_pat_payload = {
        "full_name": "Arthur Pendelton",
        "age": 52,
        "gender": "M",
        "blood_group": "A+",
        "contact_phone": "+1 (555) 888-9999",
        "triage_category": "Priority",
        "attending_physician_name": "Attending Physician",
        "schedule_appointment": True,
    }
    res_reg = client.post("/api/v1/clinical/patients", json=new_pat_payload, headers=headers)
    assert res_reg.status_code == 200
    created = res_reg.json()
    assert created["full_name"] == "Arthur Pendelton"
    assert created["mrn"].startswith("MRN-")

    # 3. Check-in appointment
    res_appts = client.get("/api/v1/clinical/appointments", headers=headers)
    assert res_appts.status_code == 200
    appts = res_appts.json()
    assert len(appts) >= 1
    first_appt = appts[0]

    res_checkin = client.patch(f"/api/v1/clinical/appointments/{first_appt['id']}/check-in", headers=headers)
    assert res_checkin.status_code == 200
    assert res_checkin.json()["status"] == "checked-in"


def test_doctor_consultation_workflow(client: TestClient, db: Session):
    """Verifies doctor view includes clinical notes and doctor can complete consultation."""
    token = _login(client, "sarah.almansoor", "Doctor@123")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Doctor retrieves patients - clinical notes must NOT be redacted
    res = client.get("/api/v1/clinical/patients", headers=headers)
    assert res.status_code == 200
    patients = res.json()
    assert len(patients) >= 1
    p = next(x for x in patients if x["mrn"] == "MRN-10024")
    assert "Patient presented with mild respiratory symptoms" in p["clinical_notes"]

    # 2. Get appointments
    res_appts = client.get("/api/v1/clinical/appointments", headers=headers)
    assert res_appts.status_code == 200
    appts = res_appts.json()
    assert len(appts) >= 1
    appt_id = appts[0]["id"]

    # 3. Start consultation
    res_start = client.post(f"/api/v1/clinical/consultations/{appt_id}/start", headers=headers)
    assert res_start.status_code == 200
    assert res_start.json()["status"] == "in-progress"

    # 4. Complete consultation
    res_complete = client.post(
        f"/api/v1/clinical/consultations/{appt_id}/complete",
        json={
            "clinical_notes": "Chest clear on auscultation. Upper respiratory infection resolving.",
            "diagnosis": "Acute Bronchitis (mild)",
            "prescriptions": "Amoxicillin 500mg TID x 7 days",
        },
        headers=headers,
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["status"] == "completed"

    # 5. Save consultation report (official Filebase S3 report compilation)
    res_report = client.post(
        f"/api/v1/clinical/consultations/{appt_id}/save-report",
        json={
            "clinical_notes": "Patient examined and evaluated. All vital signs reviewed. Prescribed medications.",
            "diagnosis": "Acute Bronchitis (mild)",
            "prescriptions": "Amoxicillin 500mg TID x 7 days",
            "follow_up": "Return in 5-7 days if symptoms persist.",
        },
        headers=headers,
    )
    assert res_report.status_code == 200
    report_data = res_report.json()
    assert report_data["status"] == "completed"
    assert "Consultation_Report_" in report_data["filename"]
    assert "AAROGYA HEALTH SYSTEM" in report_data["report_preview"]


def test_nurse_vitals_and_tasks(client: TestClient, db: Session):
    """Verifies nurse can record vitals and complete nursing tasks."""
    # Create a test nurse user if not present
    u_nurse = db.execute(select(User).where(User.username == "nurse.joy")).scalar_one_or_none()
    if not u_nurse:
        from app.core.security import get_password_hash
        u_nurse = User(
            username="nurse.joy",
            email="nurse.joy@stjude.org",
            password_hash=get_password_hash("SecurePass123!"),
            full_name="Nurse Joy Bennett",
            is_active=True,
        )
        db.add(u_nurse)
        db.flush()

        from app.models.hospital import Hospital
        hosp = db.execute(select(Hospital).where(Hospital.hospital_uid == "STJUDE-METRO-01")).scalar_one()
        role_nurse = db.execute(select(Role).where(Role.hospital_id == hosp.id, Role.code == "nurse")).scalar_one()
        dept_gen = db.execute(select(Department).where(Department.hospital_id == hosp.id, Department.code == "GEN-MED")).scalar_one()

        mem = TenantMembership(
            user_id=u_nurse.id,
            hospital_id=hosp.id,
            employee_uid="EMP-NURSE-01",
            employee_uid_verified=True,
            status="active",
        )
        db.add(mem)
        db.flush()

        db.add(RoleAssignment(
            membership_id=mem.id,
            role_id=role_nurse.id,
            department_id=dept_gen.id,
            is_active=True,
        ))
        db.commit()

    token = _login(client, "nurse.joy")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Record vitals
    patients = client.get("/api/v1/clinical/patients", headers=headers).json()
    assert len(patients) >= 1
    p_id = patients[0]["id"]

    res_vital = client.post(
        f"/api/v1/clinical/patients/{p_id}/vitals",
        json={"bp": "118/76 mmHg", "heart_rate": 70, "temperature": "98.4 °F", "spo2": 99},
        headers=headers,
    )
    assert res_vital.status_code == 200
    assert res_vital.json()["bp"] == "118/76 mmHg"

    # 2. Get and complete nursing tasks
    res_tasks = client.get("/api/v1/clinical/nursing/tasks", headers=headers)
    assert res_tasks.status_code == 200
    tasks = res_tasks.json()
    assert len(tasks) >= 1

    t_id = tasks[0]["id"]
    res_done = client.patch(f"/api/v1/clinical/nursing/tasks/{t_id}/complete", headers=headers)
    assert res_done.status_code == 200
    assert res_done.json()["status"] == "completed"


def test_nursing_services_supervisor_hospital_scope(client: TestClient, db: Session):
    """Verifies Nursing Services Supervisor gets facility-wide overview across all departments."""
    u_sup = db.execute(select(User).where(User.username == "supervisor.mary")).scalar_one_or_none()
    if not u_sup:
        from app.core.security import get_password_hash
        u_sup = User(
            username="supervisor.mary",
            email="supervisor.mary@stjude.org",
            password_hash=get_password_hash("SecurePass123!"),
            full_name="Mary Jenkins, RN MSN",
            is_active=True,
        )
        db.add(u_sup)
        db.flush()

        from app.models.hospital import Hospital
        hosp = db.execute(select(Hospital).where(Hospital.hospital_uid == "STJUDE-METRO-01")).scalar_one()
        role_sup = db.execute(select(Role).where(Role.hospital_id == hosp.id, Role.code == "nursing_supervisor")).scalar_one()

        mem = TenantMembership(
            user_id=u_sup.id,
            hospital_id=hosp.id,
            employee_uid="EMP-SUP-01",
            employee_uid_verified=True,
            status="active",
        )
        db.add(mem)
        db.flush()

        # FACILITY scoped role assignment (no department)
        db.add(RoleAssignment(
            membership_id=mem.id,
            role_id=role_sup.id,
            department_id=None,
            scope_type="FACILITY",
            is_active=True,
        ))
        db.commit()

    token = _login(client, "supervisor.mary")
    headers = {"Authorization": f"Bearer {token}"}

    # Supervisor hospital overview
    res = client.get("/api/v1/clinical/supervisor/nursing-overview", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["facility_uid"] == "STJUDE-METRO-01"
    assert "departments" in data
    assert len(data["departments"]) >= 5
    assert data["total_bed_capacity"] > 0
    assert "overall_occupancy_rate" in data


def test_employee_switch_assignment(client: TestClient, db: Session):
    """Verifies multi-assigned employee can switch their active assignment."""
    token = _login(client, "sarah.almansoor", "Doctor@123")
    headers = {"Authorization": f"Bearer {token}"}

    # Get employee profile
    prof_res = client.get("/api/v1/employee/profile", headers=headers)
    assert prof_res.status_code == 200
    prof = prof_res.json()
    assert len(prof["active_assignments"]) >= 1

    first_assign_id = prof["active_assignments"][0]["id"]
    res_switch = client.post(
        "/api/v1/employee/switch-assignment",
        json={"assignment_id": first_assign_id},
        headers=headers,
    )
    assert res_switch.status_code == 200
    switched = res_switch.json()
    assert switched["status"] == "success"
    assert switched["active_assignment_id"] == first_assign_id


def test_employee_notifications_and_staff_deduplication(client: TestClient, db: Session):
    """Verifies that employee notifications list, mark read, and staff deduplication without admin work properly."""
    from app.models.hospital import Hospital
    from app.models.notification import HospitalNotification

    token = _login(client, "clara.receptionist", "Receptionist@123")
    headers = {"Authorization": f"Bearer {token}"}

    test_hospital = db.query(Hospital).first()
    assert test_hospital is not None

    # Add a test notification
    notif = HospitalNotification(
        hospital_id=test_hospital.id,
        title="Test Clinical Alert",
        message="Patient John intake completed.",
        category="clinical",
        is_read=False,
    )
    db.add(notif)
    db.commit()

    # 1. Fetch notifications
    res_notif = client.get("/api/v1/clinical/notifications", headers=headers)
    assert res_notif.status_code == 200
    notifs = res_notif.json()
    assert len(notifs) >= 1
    target = next((n for n in notifs if n["title"] == "Test Clinical Alert"), None)
    assert target is not None
    assert target["is_read"] is False

    # 2. Mark notification read
    res_read = client.post(f"/api/v1/clinical/notifications/{target['id']}/read", headers=headers)
    assert res_read.status_code == 200

    # 3. Fetch staff and verify deduplication and admin exclusion
    res_staff = client.get("/api/v1/clinical/staff", headers=headers)
    assert res_staff.status_code == 200
    staff = res_staff.json()
    # Ensure no admin is present in staff
    assert all("admin" not in s["role"].lower() for s in staff)
    # Ensure no duplicate names
    staff_names = [s["name"] for s in staff]
    assert len(staff_names) == len(set(staff_names))

    # 4. Verify that an admin who is ALSO an employee in a clinical dept appears listed as one with that dept
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role
    from app.models.department import Department
    from app.models.user import User

    cardio_dept = db.query(Department).filter(Department.hospital_id == test_hospital.id).first()
    doc_role = db.query(Role).filter(Role.code.contains("doc")).first()
    admin_role = db.query(Role).filter(Role.code == "admin").first()

    multi_user = User(
        username="dr.admin.dual",
        email="admin_and_doc@hospital.org",
        full_name="Dr. Admin Dual",
        password_hash="test_hash_val",
        is_active=True,
    )
    db.add(multi_user)
    db.flush()

    mem_multi = TenantMembership(
        hospital_id=test_hospital.id,
        user_id=multi_user.id,
        status="active",
        employee_uid="EMP-DUAL-001",
    )
    db.add(mem_multi)
    db.flush()

    # Assign Admin role (Hospital Administration)
    assign_admin = RoleAssignment(
        membership_id=mem_multi.id,
        role_id=admin_role.id,
        department_id=None,
        scope_type="FACILITY",
        is_active=True,
    )
    db.add(assign_admin)

    # Assign Doctor role (Clinical Dept)
    assign_doc = RoleAssignment(
        membership_id=mem_multi.id,
        role_id=doc_role.id,
        department_id=cardio_dept.id if cardio_dept else None,
        scope_type="DEPARTMENT",
        is_active=True,
    )
    db.add(assign_doc)
    db.commit()

    res_staff2 = client.get("/api/v1/clinical/staff", headers=headers)
    assert res_staff2.status_code == 200
    staff2 = res_staff2.json()
    dual_entry = [s for s in staff2 if s["name"] == "Dr. Admin Dual"]
    # Must be listed as exactly one entry
    assert len(dual_entry) == 1
    # Role must not contain admin
    assert "admin" not in dual_entry[0]["role"].lower()
    # Department must reflect their clinical dept
    if cardio_dept:
        assert cardio_dept.name in dual_entry[0]["department"]

