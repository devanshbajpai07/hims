from datetime import datetime, timedelta, timezone
import logging
import uuid
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import get_password_hash
from app.models import (
    Hospital,
    Department,
    Role,
    User,
    TenantMembership,
    RoleAssignment,
    Purchaser,
    PurchaserSubscription,
    HospitalAdministrator,
)

logger = logging.getLogger("hims.seed")


def seed_database(db: Session):
    """
    Test-only fixture helper for automated test environments.
    Strictly disabled and eliminated in development and production runtime environments.
    """
    if settings.ENVIRONMENT.lower() != "testing":
        logger.info(
            "seed_database skipped: runtime demo seeding eliminated for environment '%s'.",
            settings.ENVIRONMENT,
        )
        return
    now = datetime.now(timezone.utc)
    # 0. Test Purchaser & Subscription for St. Jude
    purchaser = db.execute(select(Purchaser).where(Purchaser.email == "board.chair@stjude.org")).scalar_one_or_none()
    if not purchaser:
        purchaser = Purchaser(
            id=uuid.uuid4(),
            full_name="St. Jude Healthcare Board",
            email="board.chair@stjude.org",
            email_normalized="board.chair@stjude.org",
            password_hash=get_password_hash("BoardPass123!"),
            is_email_verified=True,
            account_status="active",
        )
        db.add(purchaser)
        db.flush()

    sub_metro = db.execute(select(PurchaserSubscription).where(PurchaserSubscription.purchaser_id == purchaser.id)).scalar_one_or_none()
    if not sub_metro:
        sub_metro = PurchaserSubscription(
            id=uuid.uuid4(),
            purchaser_id=purchaser.id,
            plan_code="BASIC",
            status="active",
            billing_interval="monthly",
            starts_at=now,
            current_period_ends_at=now + timedelta(days=365),
            auto_renew=True,
        )
        db.add(sub_metro)
        db.flush()

    # 1. Hospitals
    hosp_metro = db.execute(select(Hospital).where(Hospital.hospital_uid == "STJUDE-METRO-01")).scalar_one_or_none()
    if not hosp_metro:
        hosp_metro = Hospital(
            hospital_uid="STJUDE-METRO-01",
            name="St. Jude Metro Hospital",
            city="Metro City",
            purchaser_id=purchaser.id,
            subscription_id=sub_metro.id,
            registration_enabled=True,
            is_active=True,
        )
        db.add(hosp_metro)
    else:
        if not hosp_metro.subscription_id:
            hosp_metro.subscription_id = sub_metro.id
            hosp_metro.purchaser_id = purchaser.id

    hosp_apollo = db.execute(select(Hospital).where(Hospital.hospital_uid == "APOLLO-CARE-02")).scalar_one_or_none()
    if not hosp_apollo:
        hosp_apollo = Hospital(
            hospital_uid="APOLLO-CARE-02",
            name="Apollo Care Center",
            city="Apollo Hills",
            registration_enabled=True,
            is_active=True,
        )
        db.add(hosp_apollo)

    hosp_closed = db.execute(select(Hospital).where(Hospital.hospital_uid == "CLOSED-CLINIC-03")).scalar_one_or_none()
    if not hosp_closed:
        hosp_closed = Hospital(
            hospital_uid="CLOSED-CLINIC-03",
            name="Closed Clinic Institution",
            city="Metro South",
            registration_enabled=False,  # Registration explicitly disabled!
            is_active=True,
        )
        db.add(hosp_closed)

    db.flush()

    # 2. Departments for St. Jude Metro
    stjude_depts = [
        ("General Medicine", "GEN-MED", "Primary adult healthcare & outpatient consultations"),
        ("Emergency Medicine", "EMERG", "Acute trauma & emergency triage services"),
        ("Cardiology", "CARDIO", "Cardiovascular diagnostics and cardiac care"),
        ("Pediatrics", "PEDIA", "Child healthcare and neonatal medicine"),
        ("Outpatient Services", "OPD", "General outpatient clinic and scheduling"),
    ]
    for d_name, d_code, d_desc in stjude_depts:
        existing = db.execute(
            select(Department).where(Department.hospital_id == hosp_metro.id, Department.code == d_code)
        ).scalar_one_or_none()
        if not existing:
            db.add(Department(hospital_id=hosp_metro.id, name=d_name, code=d_code, description=d_desc))

    # 3. Roles for St. Jude Metro
    stjude_roles = [
        ("Doctor", "doctor", "department", "Medical consultations, prescribing and orders"),
        ("Department Head", "dept_head", "department", "Department clinical leadership and Level-1 approval"),
        ("Clinical Supervisor", "clinical_sup", "department", "Supervises residents and clinical staff"),
        ("Department Supervisor", "dept_sup", "department", "Operational and nursing workflow management"),
        ("Receptionist", "receptionist", "hospital", "Hospital-wide patient check-in, appointments, triage routing, and queue management"),
        ("Hospital Administrator", "admin", "hospital", "Executive governance, user management, and Level-2 approval"),
        ("General Staff", "staff", "hospital", "Internal communications, requests, and assigned task execution"),
    ]
    for r_name, r_code, r_scope, r_desc in stjude_roles:
        existing = db.execute(
            select(Role).where(Role.hospital_id == hosp_metro.id, Role.code == r_code)
        ).scalar_one_or_none()
        if not existing:
            db.add(Role(hospital_id=hosp_metro.id, name=r_name, code=r_code, scope=r_scope, description=r_desc))
        else:
            existing.scope = r_scope

    # Departments and Roles for Apollo Care
    apollo_depts = [
        ("General Medicine", "GEN-MED", "General adult medicine"),
        ("Emergency", "EMERG", "Emergency services"),
        ("Cardiology", "CARDIO", "Heart and vascular medicine"),
    ]
    for d_name, d_code, d_desc in apollo_depts:
        existing = db.execute(
            select(Department).where(Department.hospital_id == hosp_apollo.id, Department.code == d_code)
        ).scalar_one_or_none()
        if not existing:
            db.add(Department(hospital_id=hosp_apollo.id, name=d_name, code=d_code, description=d_desc))

    for r_name, r_code, r_scope, r_desc in stjude_roles:
        existing = db.execute(
            select(Role).where(Role.hospital_id == hosp_apollo.id, Role.code == r_code)
        ).scalar_one_or_none()
        if not existing:
            db.add(Role(hospital_id=hosp_apollo.id, name=r_name, code=r_code, scope=r_scope, description=r_desc))

    db.flush()

    # Get Dept & Role references for St. Jude
    gen_med = db.execute(select(Department).where(Department.hospital_id == hosp_metro.id, Department.code == "GEN-MED")).scalar_one()
    emerg_dept = db.execute(select(Department).where(Department.hospital_id == hosp_metro.id, Department.code == "EMERG")).scalar_one()
    cardio_dept = db.execute(select(Department).where(Department.hospital_id == hosp_metro.id, Department.code == "CARDIO")).scalar_one()
    doc_role = db.execute(select(Role).where(Role.hospital_id == hosp_metro.id, Role.code == "doctor")).scalar_one()
    dept_head_role = db.execute(select(Role).where(Role.hospital_id == hosp_metro.id, Role.code == "dept_head")).scalar_one()
    rec_role = db.execute(select(Role).where(Role.hospital_id == hosp_metro.id, Role.code == "receptionist")).scalar_one()
    admin_role = db.execute(select(Role).where(Role.hospital_id == hosp_metro.id, Role.code == "admin")).scalar_one()
    staff_role = db.execute(select(Role).where(Role.hospital_id == hosp_metro.id, Role.code == "staff")).scalar_one()

    # 4. Seed Test Users
    test_users = [
        ("sarah.almansoor", "sarah.almansoor@stjude.org", "Doctor@123", "Attending Physician", "EMP-DOC-101", "active", gen_med.id, doc_role.id),
        ("priya.pending", "priya.nair@stjude.org", "Priya@123", "Dr. Priya Nair", "EMP-DOC-102", "pending", gen_med.id, doc_role.id),
        ("vikram.suspended", "vikram.mehta@stjude.org", "Vikram@123", "Dr. Vikram Mehta", "EMP-DOC-103", "suspended", gen_med.id, doc_role.id),
        ("anita.terminated", "anita.desai@stjude.org", "Anita@123", "Anita Desai", "EMP-REC-202", "terminated", gen_med.id, rec_role.id),
        ("clara.receptionist", "clara.bennett@stjude.org", "Receptionist@123", "Front Desk Receptionist", "EMP-REC-101", "active", None, rec_role.id),
        ("admin.stjude", "admin@stjude.org", "Admin@123", "Administrator Robert Vance", "EMP-ADM-001", "active", None, admin_role.id),
        ("depthead.genmed", "head.genmed@stjude.org", "DeptHead@123", "Dr. Elena Rostova", "EMP-DOC-005", "active", gen_med.id, dept_head_role.id),
        ("staff.general", "staff.general@stjude.org", "Staff@123", "Hospital Support Staff", "EMP-STF-101", "active", None, staff_role.id),
        ("staff.transport", "staff.transport@stjude.org", "Staff@123", "Patient Transport Staff", "EMP-STF-102", "active", None, staff_role.id),
    ]

    for uname, email, pwd, fname, emp_uid, stat, dept_id, r_id in test_users:
        u = db.execute(select(User).where(func.lower(User.username) == uname.lower())).scalar_one_or_none()
        if not u:
            u = User(
                username=uname,
                email=email,
                password_hash=get_password_hash(pwd),
                full_name=fname,
                is_active=(stat == "active"),
            )
            db.add(u)
            db.flush()

            mem = TenantMembership(
                user_id=u.id,
                hospital_id=hosp_metro.id,
                employee_uid=emp_uid,
                employee_uid_verified=(stat == "active"),
                status=stat,
            )
            db.add(mem)
            db.flush()

            if stat == "active":
                db.add(RoleAssignment(
                    membership_id=mem.id,
                    department_id=dept_id,
                    role_id=r_id,
                    is_active=True,
                ))

            if uname == "admin.stjude":
                h_admin = db.execute(
                    select(HospitalAdministrator).where(
                        HospitalAdministrator.user_id == u.id,
                        HospitalAdministrator.hospital_id == hosp_metro.id,
                    )
                ).scalar_one_or_none()
                if not h_admin:
                    db.add(HospitalAdministrator(
                        id=uuid.uuid4(),
                        hospital_id=hosp_metro.id,
                        user_id=u.id,
                        membership_id=mem.id,
                        status="active",
                    ))

    # Multi-hospital doctor: Rahul
    u_rahul = db.execute(select(User).where(func.lower(User.username) == "rahul")).scalar_one_or_none()
    if not u_rahul:
        u_rahul = User(
            username="rahul",
            email="rahul.kapoor@hims.org",
            password_hash=get_password_hash("Rahul@123"),
            full_name="Dr. Rahul Kapoor",
            is_active=True,
        )
        db.add(u_rahul)
        db.flush()

        # Membership at St. Jude
        mem_sj = TenantMembership(
            user_id=u_rahul.id,
            hospital_id=hosp_metro.id,
            employee_uid="EMP-DOC-901",
            employee_uid_verified=True,
            status="active",
        )
        db.add(mem_sj)
        db.flush()
        db.add(RoleAssignment(
            membership_id=mem_sj.id,
            department_id=cardio_dept.id,
            role_id=doc_role.id,
            is_active=True,
        ))

        # Membership at Apollo Care
        apollo_doc_role = db.execute(select(Role).where(Role.hospital_id == hosp_apollo.id, Role.code == "doctor")).scalar_one()
        apollo_cardio = db.execute(select(Department).where(Department.hospital_id == hosp_apollo.id, Department.code == "CARDIO")).scalar_one()
        mem_ap = TenantMembership(
            user_id=u_rahul.id,
            hospital_id=hosp_apollo.id,
            employee_uid="EMP-DOC-AP-901",
            employee_uid_verified=True,
            status="active",
        )
        db.add(mem_ap)
        db.flush()
        db.add(RoleAssignment(
            membership_id=mem_ap.id,
            department_id=apollo_cardio.id,
            role_id=apollo_doc_role.id,
            is_active=True,
        ))

    # Test clinical records for test fixtures
    from app.models.clinical import PatientRecord, AppointmentRecord, PatientVitalRecord, NursingTaskRecord
    metro_genmed = db.execute(select(Department).where(Department.hospital_id == hosp_metro.id, Department.code == "GEN-MED")).scalar_one_or_none()
    genmed_id = metro_genmed.id if metro_genmed else None

    p_test = db.execute(select(PatientRecord).where(PatientRecord.mrn == "MRN-10024")).scalar_one_or_none()
    if not p_test:
        p_test = PatientRecord(
            hospital_id=hosp_metro.id,
            mrn="MRN-10024",
            full_name="Eleanor Vance",
            age=48,
            gender="F",
            blood_group="O+",
            contact_phone="+1 (555) 234-5678",
            department_id=genmed_id,
            triage_category="Priority",
            attending_physician_name="Attending Physician",
            bed_or_room="Consultation Suite",
            chief_complaint="Persistent dry cough and mild dyspnea on exertion.",
            clinical_notes="Patient presented with mild respiratory symptoms.",
            allergies="Penicillin",
            chronic_conditions="Mild Hypertension",
            admission_status="outpatient",
        )
        db.add(p_test)
        db.flush()

        # Add appointment
        db.add(AppointmentRecord(
            hospital_id=hosp_metro.id,
            patient_id=p_test.id,
            patient_mrn=p_test.mrn,
            patient_name=p_test.full_name,
            doctor_name="Attending Physician",
            department_id=genmed_id,
            department_name="General Medicine",
            appointment_time="09:30 AM",
            duration="30 mins",
            appointment_type="Clinical Consultation",
            status="checked-in",
            room="Consultation Suite",
            priority="Priority",
            checked_in_at=now,
        ))

        # Add vital
        db.add(PatientVitalRecord(
            hospital_id=hosp_metro.id,
            patient_id=p_test.id,
            recorded_by_name="Staff Nurse",
            bp="122/80 mmHg",
            heart_rate=74,
            temperature="98.6 °F",
            spo2=99,
            recorded_at=now,
        ))

        # Add nursing task
        db.add(NursingTaskRecord(
            hospital_id=hosp_metro.id,
            department_id=genmed_id,
            patient_id=p_test.id,
            patient_name=p_test.full_name,
            bed_number="Bed 101",
            task_type="vitals",
            description="Routine morning vitals check and oxygen saturation monitoring",
            scheduled_time="10:00 AM",
            priority="Routine",
            is_completed=False,
        ))

    db.commit()
    logger.info("Test database seed completed successfully.")

