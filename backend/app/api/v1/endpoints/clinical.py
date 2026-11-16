import hashlib
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session

from app.api.deps_employee import EmployeeContext, get_current_employee
from app.db.database import get_db
from app.models.clinical import (
    AppointmentRecord,
    NursingShiftRecord,
    NursingTaskRecord,
    PatientRecord,
    PatientVitalRecord,
)
from app.models.department import Department
from app.models.document import DocumentRecord
from app.models.user import User
from app.models.audit import AuditLog
from app.models.notification import HospitalNotification
from app.services.storage_service import StorageService
from app.services.authorization_service import AuthorizationService

logger = logging.getLogger("hims.clinical")

router = APIRouter(prefix="/clinical", tags=["Clinical Operations & Patient Care"])


# -----------------------------------------------------------------------------
# SCHEMAS
# -----------------------------------------------------------------------------

class VitalItemResponse(BaseModel):
    id: str
    bp: str
    heart_rate: int
    temperature: str
    spo2: int
    respiratory_rate: Optional[int] = None
    blood_glucose: Optional[str] = None
    recorded_by_name: str
    recorded_at: str


class PatientItemResponse(BaseModel):
    id: str
    mrn: str
    full_name: str
    age: int
    gender: str
    blood_group: str
    contact_phone: str
    emergency_contact: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    triage_category: str
    attending_physician_id: Optional[str] = None
    attending_physician_name: Optional[str] = None
    bed_or_room: Optional[str] = None
    chief_complaint: Optional[str] = None
    clinical_notes: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    admission_status: str
    created_at: str
    latest_vitals: Optional[VitalItemResponse] = None


class CreatePatientRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    age: int = Field(..., ge=0, le=130)
    gender: str
    blood_group: str = "Unknown"
    contact_phone: str = Field(..., min_length=5)
    emergency_contact: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    triage_category: str = "Routine"
    attending_physician_id: Optional[str] = None
    attending_physician_name: Optional[str] = None
    bed_or_room: Optional[str] = None
    chief_complaint: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    schedule_appointment: bool = True
    appointment_type: str = "Routine Check-In"


class UpdatePatientRequest(BaseModel):
    contact_phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    blood_group: Optional[str] = None
    triage_category: Optional[str] = None
    bed_or_room: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    chief_complaint: Optional[str] = None


class UpdateAppointmentStatusRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class AppointmentItemResponse(BaseModel):
    id: str
    patient_id: str
    patient_mrn: str
    patient_name: str
    doctor_id: Optional[str] = None
    doctor_name: str
    department_id: Optional[str] = None
    department_name: str
    appointment_time: str
    duration: str
    appointment_type: str
    status: str
    room: str
    priority: str
    checked_in_at: Optional[str] = None
    completed_at: Optional[str] = None
    notes: Optional[str] = None


class CreateAppointmentRequest(BaseModel):
    patient_id: str
    doctor_name: str
    doctor_id: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    appointment_time: str
    duration: str = "30 mins"
    appointment_type: str = "Clinical Consultation"
    status: Optional[str] = "pending"
    room: str = "Room 101"
    priority: str = "Normal"
    notes: Optional[str] = None


class RecordVitalRequest(BaseModel):
    bp: str = Field(..., description="e.g. 120/80 mmHg")
    heart_rate: int = Field(..., ge=30, le=250)
    temperature: str = Field(..., description="e.g. 98.6 °F")
    spo2: int = Field(..., ge=50, le=100)
    respiratory_rate: Optional[int] = None
    blood_glucose: Optional[str] = None


class DirectRecordVitalRequest(BaseModel):
    patient_id: str
    bp: str = Field(..., description="e.g. 120/80 mmHg")
    heart_rate: int = Field(..., ge=30, le=250)
    temperature: str = Field(..., description="e.g. 98.6 °F")
    spo2: int = Field(..., ge=50, le=100)
    respiratory_rate: Optional[int] = None
    blood_glucose: Optional[str] = None


class CompleteConsultationRequest(BaseModel):
    clinical_notes: str = Field(..., min_length=5)
    diagnosis: Optional[str] = None
    prescriptions: Optional[str] = None
    follow_up: Optional[str] = None


class SaveConsultationReportRequest(BaseModel):
    clinical_notes: str = Field(..., min_length=5)
    diagnosis: Optional[str] = None
    prescriptions: Optional[str] = None
    follow_up: Optional[str] = None
    report_format: Optional[str] = "txt"


class ConsultationReportResponse(BaseModel):
    status: str
    appointment_id: str
    document_id: str
    patient_mrn: str
    filename: str
    download_url: Optional[str] = None
    report_preview: Optional[str] = None


class PatientConsultancyReportDetailResponse(BaseModel):
    has_report: bool
    document_id: Optional[str] = None
    title: Optional[str] = None
    filename: Optional[str] = None
    created_at: Optional[str] = None
    doctor_name: Optional[str] = None
    download_url: Optional[str] = None
    file_content: Optional[str] = None
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    detail: Optional[str] = None


class NursingTaskResponse(BaseModel):
    id: str
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    bed_number: Optional[str] = None
    task_type: str
    description: str
    scheduled_time: str
    priority: str
    is_completed: bool
    completed_by_name: Optional[str] = None
    completed_at: Optional[str] = None
    notes: Optional[str] = None


class CreateNursingTaskRequest(BaseModel):
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    department_id: Optional[str] = None
    bed_number: Optional[str] = None
    task_type: str
    description: str
    scheduled_time: str
    priority: str = "Routine"


class DepartmentCoverageItem(BaseModel):
    department_id: str
    department_name: str
    department_code: str
    total_beds: int
    occupied_beds: int
    occupancy_rate: float
    active_nurses: int
    nurse_to_patient_ratio: str
    critical_patients_count: int
    pending_tasks_count: int


class SupervisorNursingOverviewResponse(BaseModel):
    facility_name: str
    facility_uid: str
    total_inpatient_census: int
    total_bed_capacity: int
    overall_occupancy_rate: float
    total_on_duty_nurses: int
    departments: List[DepartmentCoverageItem]
    escalation_alerts: List[Dict[str, Any]]


class DoctorSummaryResponse(BaseModel):
    id: str
    name: str
    title: Optional[str] = None
    department: str
    department_id: Optional[str] = None
    departments: Optional[List[str]] = []
    department_ids: Optional[List[str]] = []
    specialty: str
    status: str
    patients_today: int
    next_slot: Optional[str] = None
    room: str


class DoctorDashboardSummaryResponse(BaseModel):
    waiting_patients_count: int
    new_patients_count: int
    returning_patients_count: int
    department_name: str
    total_today: int
    exam_room: str
    in_consultation_count: int
    completed_today_count: int


class DoctorPatientHistoryItemResponse(BaseModel):
    id: str
    appointment_id: Optional[str] = None
    patient_id: str
    patient_mrn: str
    patient_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    diagnosis: Optional[str] = None
    clinical_notes: Optional[str] = None
    prescriptions: Optional[str] = None
    appointment_time: Optional[str] = None
    appointment_date: Optional[str] = None
    appointment_type: Optional[str] = None
    is_returning: bool = False
    document_count: int = 0
    completed_at: Optional[str] = None


class DoctorPatientHistoryResponse(BaseModel):
    items: List[DoctorPatientHistoryItemResponse]
    total: int


class StaffSummaryResponse(BaseModel):
    id: str
    name: str
    role: str
    department: str
    department_id: Optional[str] = None
    email: Optional[str] = None
    employee_uid: Optional[str] = None
    status: str
    location: Optional[str] = None
    today_metric: Optional[str] = None


class NurseAuditLogItem(BaseModel):
    id: str
    timestamp: str
    nurse_name: str
    nurse_email: str
    department_name: Optional[str] = "Inpatient Nursing Care"
    action: str
    details: Optional[str] = None
    resource_type: str


class SupervisorContactAdminRequest(BaseModel):
    subject: str
    message: str
    priority: Optional[str] = "Routine"


class DepartmentSummaryResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    bed_capacity: int


# -----------------------------------------------------------------------------
# HELPER FUNCTIONS
# -----------------------------------------------------------------------------

def _get_active_assignment(emp_ctx: EmployeeContext, db: Session):
    """Finds the primary active assignment for the employee."""
    if not emp_ctx.active_assignments:
        return None, "staff", "Hospital-Wide", None, "FACILITY"
    a = emp_ctx.active_assignments[0]
    rcode = a.role.code if a.role else "staff"
    dname = a.department.name if a.department else "Hospital-Wide"
    did = a.department_id
    stype = a.scope_type
    return a, rcode, dname, did, stype


# -----------------------------------------------------------------------------
# ENDPOINTS
# -----------------------------------------------------------------------------

@router.get("/patients", response_model=List[PatientItemResponse])
def get_patients(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieves patient roster governed by the employee's active role and scope:
    - Receptionists: Hospital-wide intake records, but clinical notes/prescriptions are redacted.
    - Doctors: Department patients with complete clinical EMR history and notes.
    - Nurses: Ward patients in assigned department with vitals and care observations.
    - Nursing Supervisors: Hospital-wide census across all departments.
    """
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="patient:read"
    )
    _, role_code, _, dept_id, scope_type = _get_active_assignment(emp_ctx, db)

    query = db.query(PatientRecord).filter(PatientRecord.hospital_id == emp_ctx.hospital.id)

    # Department scoping for doctors and nurses
    if role_code in ("doctor", "nurse", "dept_head") and scope_type != "FACILITY" and dept_id is not None:
        query = query.filter(
            or_(
                PatientRecord.department_id == dept_id,
                PatientRecord.attending_physician_id == emp_ctx.user.id,
            )
        )

    patients = query.order_by(desc(PatientRecord.created_at)).all()

    # Pre-fetch latest vitals
    vitals_map: Dict[uuid.UUID, PatientVitalRecord] = {}
    if patients:
        p_ids = [p.id for p in patients]
        all_vitals = (
            db.query(PatientVitalRecord)
            .filter(PatientVitalRecord.patient_id.in_(p_ids))
            .order_by(desc(PatientVitalRecord.recorded_at))
            .all()
        )
        for v in all_vitals:
            if v.patient_id not in vitals_map:
                vitals_map[v.patient_id] = v

    results: List[PatientItemResponse] = []
    for p in patients:
        v_rec = vitals_map.get(p.id)
        v_resp = None
        if v_rec:
            v_resp = VitalItemResponse(
                id=str(v_rec.id),
                bp=v_rec.bp,
                heart_rate=v_rec.heart_rate,
                temperature=v_rec.temperature,
                spo2=v_rec.spo2,
                respiratory_rate=v_rec.respiratory_rate,
                blood_glucose=v_rec.blood_glucose,
                recorded_by_name=v_rec.recorded_by_name,
                recorded_at=v_rec.recorded_at.isoformat(),
            )

        # REDACT clinical charts for Receptionist and Nursing Supervisor roles
        clinical_notes = p.clinical_notes
        chief_complaint = p.chief_complaint
        if role_code in ("receptionist", "nursing_supervisor") or "supervisor" in (role_code or ""):
            clinical_notes = "[PROTECTED: Clinical Consultation & EMR notes restricted to attending medical doctors under HIMS Privacy Governance]"

        results.append(
            PatientItemResponse(
                id=str(p.id),
                mrn=p.mrn,
                full_name=p.full_name,
                age=p.age,
                gender=p.gender,
                blood_group=p.blood_group,
                contact_phone=p.contact_phone,
                emergency_contact=p.emergency_contact,
                department_id=str(p.department_id) if p.department_id else None,
                department_name=p.department.name if p.department else "Outpatient Intake",
                triage_category=p.triage_category,
                attending_physician_id=str(p.attending_physician_id) if p.attending_physician_id else None,
                attending_physician_name=p.attending_physician_name or "On-Duty Attending",
                bed_or_room=p.bed_or_room or "Waiting Area",
                chief_complaint=chief_complaint,
                clinical_notes=clinical_notes,
                allergies=p.allergies,
                chronic_conditions=p.chronic_conditions,
                admission_status=p.admission_status,
                created_at=p.created_at.isoformat(),
                latest_vitals=v_resp,
            )
        )

    return results


@router.get("/patients/by-mrn/{mrn}", response_model=PatientItemResponse)
def get_patient_by_mrn(
    mrn: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Fetches a patient demographic record by their unique MRN identifier."""
    patient = (
        db.query(PatientRecord)
        .filter(
            PatientRecord.hospital_id == emp_ctx.hospital.id,
            func.lower(PatientRecord.mrn) == mrn.strip().lower(),
        )
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No registered patient found with MRN '{mrn}' in this hospital facility.",
        )
    return PatientItemResponse(
        id=str(patient.id),
        mrn=patient.mrn,
        full_name=patient.full_name,
        age=patient.age,
        gender=patient.gender,
        blood_group=patient.blood_group,
        contact_phone=patient.contact_phone,
        emergency_contact=patient.emergency_contact,
        department_id=str(patient.department_id) if patient.department_id else None,
        department_name=patient.department.name if patient.department else "Outpatient Intake",
        triage_category=patient.triage_category,
        attending_physician_id=str(patient.attending_physician_id) if patient.attending_physician_id else None,
        attending_physician_name=patient.attending_physician_name or "On-Duty Attending",
        bed_or_room=patient.bed_or_room or "Waiting Area",
        chief_complaint=patient.chief_complaint,
        clinical_notes=patient.clinical_notes,
        allergies=patient.allergies,
        chronic_conditions=patient.chronic_conditions,
        admission_status=patient.admission_status,
        created_at=patient.created_at.isoformat(),
        latest_vitals=None,
    )


@router.get("/patients/{patient_id}", response_model=PatientItemResponse)
def get_patient_by_id(
    patient_id: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Fetches a patient demographic record by their unique ID."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="patient:read"
    )
    try:
        p_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invalid patient ID '{patient_id}'.",
        )

    patient = (
        db.query(PatientRecord)
        .filter(
            PatientRecord.hospital_id == emp_ctx.hospital.id,
            PatientRecord.id == p_uuid,
        )
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No registered patient found with ID '{patient_id}' in this hospital facility.",
        )

    _, role_code, _, dept_id, scope_type = _get_active_assignment(emp_ctx, db)
    if role_code in ("doctor", "nurse", "dept_head") and scope_type != "FACILITY" and dept_id is not None:
        if patient.department_id and patient.department_id != dept_id:
            msg = "Department Head can only access patients within their assigned department." if role_code == "dept_head" else "Access denied: Patient record is outside your assigned departmental scope."
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=msg,
            )

    clinical_notes = patient.clinical_notes
    if role_code == "receptionist":
        clinical_notes = "[PROTECTED: Clinical Consultation & EMR notes restricted to licensed medical personnel under HIMS Privacy Governance]"

    v_rec = (
        db.query(PatientVitalRecord)
        .filter(PatientVitalRecord.patient_id == patient.id)
        .order_by(desc(PatientVitalRecord.recorded_at))
        .first()
    )
    v_resp = None
    if v_rec:
        v_resp = VitalItemResponse(
            id=str(v_rec.id),
            bp=v_rec.bp,
            heart_rate=v_rec.heart_rate,
            temperature=v_rec.temperature,
            spo2=v_rec.spo2,
            respiratory_rate=v_rec.respiratory_rate,
            blood_glucose=v_rec.blood_glucose,
            recorded_by_name=v_rec.recorded_by_name,
            recorded_at=v_rec.recorded_at.isoformat(),
        )

    return PatientItemResponse(
        id=str(patient.id),
        mrn=patient.mrn,
        full_name=patient.full_name,
        age=patient.age,
        gender=patient.gender,
        blood_group=patient.blood_group,
        contact_phone=patient.contact_phone,
        emergency_contact=patient.emergency_contact,
        department_id=str(patient.department_id) if patient.department_id else None,
        department_name=patient.department.name if patient.department else "Outpatient Intake",
        triage_category=patient.triage_category,
        attending_physician_id=str(patient.attending_physician_id) if patient.attending_physician_id else None,
        attending_physician_name=patient.attending_physician_name or "On-Duty Attending",
        bed_or_room=patient.bed_or_room or "Waiting Area",
        chief_complaint=patient.chief_complaint,
        clinical_notes=clinical_notes,
        allergies=patient.allergies,
        chronic_conditions=patient.chronic_conditions,
        admission_status=patient.admission_status,
        created_at=patient.created_at.isoformat(),
        latest_vitals=v_resp,
    )


@router.put("/patients/{patient_id}", response_model=PatientItemResponse)
@router.patch("/patients/{patient_id}", response_model=PatientItemResponse)
def update_patient(
    patient_id: str,
    payload: UpdatePatientRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Updates patient demographics and contact details."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="patient:update"
    )
    try:
        p_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invalid patient ID '{patient_id}'.",
        )

    patient = (
        db.query(PatientRecord)
        .filter(
            PatientRecord.hospital_id == emp_ctx.hospital.id,
            PatientRecord.id == p_uuid,
        )
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{patient_id}' not found.",
        )

    if payload.contact_phone is not None:
        patient.contact_phone = payload.contact_phone.strip()
    if payload.emergency_contact is not None:
        patient.emergency_contact = payload.emergency_contact.strip()
    if payload.blood_group is not None:
        patient.blood_group = payload.blood_group
    if payload.triage_category is not None:
        patient.triage_category = payload.triage_category
    if payload.bed_or_room is not None:
        patient.bed_or_room = payload.bed_or_room
    if payload.allergies is not None:
        patient.allergies = payload.allergies
    if payload.chronic_conditions is not None:
        patient.chronic_conditions = payload.chronic_conditions
    if payload.chief_complaint is not None:
        patient.chief_complaint = payload.chief_complaint

    db.commit()
    db.refresh(patient)

    return PatientItemResponse(
        id=str(patient.id),
        mrn=patient.mrn,
        full_name=patient.full_name,
        age=patient.age,
        gender=patient.gender,
        blood_group=patient.blood_group,
        contact_phone=patient.contact_phone,
        emergency_contact=patient.emergency_contact,
        department_id=str(patient.department_id) if patient.department_id else None,
        department_name=patient.department.name if patient.department else "Outpatient Intake",
        triage_category=patient.triage_category,
        attending_physician_id=str(patient.attending_physician_id) if patient.attending_physician_id else None,
        attending_physician_name=patient.attending_physician_name or "On-Duty Attending",
        bed_or_room=patient.bed_or_room or "Waiting Area",
        chief_complaint=patient.chief_complaint,
        clinical_notes=patient.clinical_notes,
        allergies=patient.allergies,
        chronic_conditions=patient.chronic_conditions,
        admission_status=patient.admission_status,
        created_at=patient.created_at.isoformat(),
        latest_vitals=None,
    )


@router.post("/patients", response_model=PatientItemResponse)
def register_patient(
    payload: CreatePatientRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Registers a new patient with authoritative demographic and intake data."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="patient:create"
    )
    # Generate unique, deterministic sequential hospital MRN from real records
    max_mrn_patient = (
        db.query(PatientRecord)
        .filter(PatientRecord.hospital_id == emp_ctx.hospital.id)
        .order_by(desc(PatientRecord.created_at))
        .first()
    )
    next_num = 10001
    if max_mrn_patient and max_mrn_patient.mrn and max_mrn_patient.mrn.startswith("MRN-"):
        try:
            next_num = int(max_mrn_patient.mrn.replace("MRN-", "")) + 1
        except ValueError:
            next_num = 10001

    candidate_mrn = f"MRN-{next_num}"
    while (
        db.query(PatientRecord)
        .filter(
            PatientRecord.hospital_id == emp_ctx.hospital.id,
            PatientRecord.mrn == candidate_mrn,
        )
        .first()
    ):
        next_num += 1
        candidate_mrn = f"MRN-{next_num}"

    dept_uuid = None
    if payload.department_id:
        try:
            dept_uuid = uuid.UUID(payload.department_id)
        except (ValueError, AttributeError):
            dept_by_name = (
                db.query(Department)
                .filter(
                    Department.hospital_id == emp_ctx.hospital.id,
                    Department.name.ilike(f"%{payload.department_id}%"),
                )
                .first()
            )
            if dept_by_name:
                dept_uuid = dept_by_name.id

    if not dept_uuid and payload.department_name:
        dept_by_name = (
            db.query(Department)
            .filter(
                Department.hospital_id == emp_ctx.hospital.id,
                Department.name.ilike(f"%{payload.department_name}%"),
            )
            .first()
        )
        if dept_by_name:
            dept_uuid = dept_by_name.id

    # If department not specified, pick default General Medicine
    if not dept_uuid:
        first_dept = (
            db.query(Department)
            .filter(Department.hospital_id == emp_ctx.hospital.id)
            .first()
        )
        if first_dept:
            dept_uuid = first_dept.id

    # Resolve attending physician user
    attending_user = None
    if payload.attending_physician_id:
        try:
            attending_user = db.query(User).filter(User.id == uuid.UUID(payload.attending_physician_id)).first()
        except (ValueError, AttributeError):
            pass
    if not attending_user and payload.attending_physician_name:
        attending_user = (
            db.query(User)
            .filter(
                or_(
                    User.full_name == payload.attending_physician_name,
                    User.full_name.ilike(f"%{payload.attending_physician_name}%"),
                )
            )
            .first()
        )

    doc_name = attending_user.full_name if attending_user else (payload.attending_physician_name or "Attending Staff")

    patient = PatientRecord(
        hospital_id=emp_ctx.hospital.id,
        mrn=candidate_mrn,
        full_name=payload.full_name.strip(),
        age=payload.age,
        gender=payload.gender,
        blood_group=payload.blood_group,
        contact_phone=payload.contact_phone.strip(),
        emergency_contact=payload.emergency_contact,
        department_id=dept_uuid,
        triage_category=payload.triage_category,
        attending_physician_id=attending_user.id if attending_user else None,
        attending_physician_name=doc_name,
        bed_or_room=payload.bed_or_room or "Room 101",
        chief_complaint=payload.chief_complaint,
        allergies=payload.allergies,
        chronic_conditions=payload.chronic_conditions,
        admission_status="outpatient",
    )
    db.add(patient)
    db.flush()

    # Automatically schedule initial intake appointment if requested
    if payload.schedule_appointment:
        now_time = datetime.now().strftime("%I:%M %p")
        dept_record = db.query(Department).filter(Department.id == dept_uuid).first()
        dname = dept_record.name if dept_record else "General Medicine"

        appt = AppointmentRecord(
            hospital_id=emp_ctx.hospital.id,
            patient_id=patient.id,
            patient_mrn=patient.mrn,
            patient_name=patient.full_name,
            doctor_id=attending_user.id if attending_user else None,
            doctor_name=doc_name,
            department_id=dept_uuid,
            department_name=dname,
            appointment_time=now_time,
            duration="30 mins",
            appointment_type=payload.appointment_type,
            status="checked-in",
            room=patient.bed_or_room or "Room 101",
            priority="Normal" if payload.triage_category == "Routine" else "High",
            checked_in_at=datetime.now(timezone.utc),
        )
        db.add(appt)

    # Operational event notification
    db.add(
        HospitalNotification(
            hospital_id=emp_ctx.hospital.id,
            title="New Patient Intake Registered",
            message=f"{patient.full_name} ({patient.mrn}) registered by reception. Intake triage: {payload.triage_category}.",
            category="clinical",
            is_read=False,
        )
    )

    db.commit()
    db.refresh(patient)

    return PatientItemResponse(
        id=str(patient.id),
        mrn=patient.mrn,
        full_name=patient.full_name,
        age=patient.age,
        gender=patient.gender,
        blood_group=patient.blood_group,
        contact_phone=patient.contact_phone,
        emergency_contact=patient.emergency_contact,
        department_id=str(patient.department_id) if patient.department_id else None,
        department_name=patient.department.name if patient.department else "Outpatient Intake",
        triage_category=patient.triage_category,
        attending_physician_id=str(patient.attending_physician_id) if patient.attending_physician_id else None,
        attending_physician_name=patient.attending_physician_name,
        bed_or_room=patient.bed_or_room,
        chief_complaint=patient.chief_complaint,
        clinical_notes=patient.clinical_notes,
        allergies=patient.allergies,
        chronic_conditions=patient.chronic_conditions,
        admission_status=patient.admission_status,
        created_at=patient.created_at.isoformat(),
    )


@router.get("/appointments", response_model=List[AppointmentItemResponse])
def get_appointments(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieves appointments filtered according to active employee role and scope."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="appointment:read"
    )
    _, role_code, _, dept_id, scope_type = _get_active_assignment(emp_ctx, db)

    query = db.query(AppointmentRecord).filter(AppointmentRecord.hospital_id == emp_ctx.hospital.id)

    # Doctor filtering: within doctor's department or assigned to doctor
    if role_code == "doctor" and scope_type != "FACILITY" and dept_id is not None:
        query = query.filter(
            or_(
                AppointmentRecord.department_id == dept_id,
                AppointmentRecord.doctor_id == emp_ctx.user.id,
            )
        )
    # Nurse filtering: department ward
    elif role_code in ("nurse", "dept_head") and scope_type != "FACILITY" and dept_id is not None:
        query = query.filter(AppointmentRecord.department_id == dept_id)

    appts = query.order_by(desc(AppointmentRecord.created_at)).all()

    return [
        AppointmentItemResponse(
            id=str(a.id),
            patient_id=str(a.patient_id),
            patient_mrn=a.patient_mrn,
            patient_name=a.patient_name,
            doctor_id=str(a.doctor_id) if a.doctor_id else None,
            doctor_name=a.doctor_name,
            department_id=str(a.department_id) if a.department_id else None,
            department_name=a.department_name,
            appointment_time=a.appointment_time,
            duration=a.duration,
            appointment_type=a.appointment_type,
            status=a.status,
            room=a.room,
            priority=a.priority,
            checked_in_at=a.checked_in_at.isoformat() if a.checked_in_at else None,
            completed_at=a.completed_at.isoformat() if a.completed_at else None,
            notes=a.notes,
        )
        for a in appts
    ]


@router.post("/appointments", response_model=AppointmentItemResponse)
def book_appointment(
    payload: CreateAppointmentRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Books a clinic appointment."""
    patient = (
        db.query(PatientRecord)
        .filter(
            PatientRecord.id == uuid.UUID(payload.patient_id),
            PatientRecord.hospital_id == emp_ctx.hospital.id,
        )
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found in this hospital facility.",
        )

    dept_uuid = None
    dept_name = payload.department_name or "General Medicine"
    if payload.department_id:
        try:
            dept_uuid = uuid.UUID(payload.department_id)
            d_record = db.query(Department).filter(Department.id == dept_uuid).first()
            if d_record:
                dept_name = d_record.name
        except (ValueError, AttributeError):
            d_record = db.query(Department).filter(Department.hospital_id == emp_ctx.hospital.id, Department.name.ilike(f"%{payload.department_id}%")).first()
            if d_record:
                dept_uuid = d_record.id
                dept_name = d_record.name

    if not dept_uuid and payload.department_name:
        d_record = db.query(Department).filter(Department.hospital_id == emp_ctx.hospital.id, Department.name.ilike(f"%{payload.department_name}%")).first()
        if d_record:
            dept_uuid = d_record.id
            dept_name = d_record.name

    if not dept_uuid and patient.department_id:
        dept_uuid = patient.department_id
        if patient.department:
            dept_name = patient.department.name

    doc_user = None
    if payload.doctor_id:
        try:
            doc_user = db.query(User).filter(User.id == uuid.UUID(payload.doctor_id)).first()
        except (ValueError, AttributeError):
            pass
    if not doc_user and payload.doctor_name:
        clean_name = payload.doctor_name.replace("Dr.", "").replace("Dr ", "").strip()
        doc_user = (
            db.query(User)
            .filter(
                or_(
                    User.full_name == payload.doctor_name,
                    User.full_name.ilike(f"%{payload.doctor_name}%"),
                    User.full_name.ilike(f"%{clean_name}%"),
                )
            )
            .first()
        )
    try:
        resolved_doc_id = doc_user.id if doc_user else (uuid.UUID(payload.doctor_id) if payload.doctor_id else None)
    except (ValueError, AttributeError):
        resolved_doc_id = None
    resolved_doc_name = doc_user.full_name if doc_user else payload.doctor_name

    status_val = payload.status if payload.status in ["pending", "checked-in", "in-progress", "completed"] else "pending"
    checked_in_val = datetime.now(timezone.utc) if status_val == "checked-in" else None

    appt = AppointmentRecord(
        hospital_id=emp_ctx.hospital.id,
        patient_id=patient.id,
        patient_mrn=patient.mrn,
        patient_name=patient.full_name,
        doctor_id=resolved_doc_id,
        doctor_name=resolved_doc_name,
        department_id=dept_uuid,
        department_name=dept_name,
        appointment_time=payload.appointment_time,
        duration=payload.duration,
        appointment_type=payload.appointment_type,
        status=status_val,
        room=payload.room,
        priority=payload.priority,
        notes=payload.notes,
        checked_in_at=checked_in_val,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    return AppointmentItemResponse(
        id=str(appt.id),
        patient_id=str(appt.patient_id),
        patient_mrn=appt.patient_mrn,
        patient_name=appt.patient_name,
        doctor_id=str(appt.doctor_id) if appt.doctor_id else None,
        doctor_name=appt.doctor_name,
        department_id=str(appt.department_id) if appt.department_id else None,
        department_name=appt.department_name,
        appointment_time=appt.appointment_time,
        duration=appt.duration,
        appointment_type=appt.appointment_type,
        status=appt.status,
        room=appt.room,
        priority=appt.priority,
        notes=appt.notes,
    )


@router.patch("/appointments/{appointment_id}/check-in", response_model=AppointmentItemResponse)
def check_in_patient(
    appointment_id: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Receptionist arrival check-in action."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="queue:manage"
    )
    appt = (
        db.query(AppointmentRecord)
        .filter(
            AppointmentRecord.id == uuid.UUID(appointment_id),
            AppointmentRecord.hospital_id == emp_ctx.hospital.id,
        )
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    appt.status = "checked-in"
    appt.checked_in_at = datetime.now(timezone.utc)

    db.add(
        HospitalNotification(
            hospital_id=emp_ctx.hospital.id,
            title="Patient Arrival Checked In",
            message=f"{appt.patient_name} ({appt.patient_mrn}) checked in for Dr. {appt.doctor_name}.",
            category="clinical",
            is_read=False,
        )
    )

    db.commit()
    db.refresh(appt)

    return AppointmentItemResponse(
        id=str(appt.id),
        patient_id=str(appt.patient_id),
        patient_mrn=appt.patient_mrn,
        patient_name=appt.patient_name,
        doctor_name=appt.doctor_name,
        department_name=appt.department_name,
        appointment_time=appt.appointment_time,
        duration=appt.duration,
        appointment_type=appt.appointment_type,
        status=appt.status,
        room=appt.room,
        priority=appt.priority,
        checked_in_at=appt.checked_in_at.isoformat(),
        notes=appt.notes,
    )


@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentItemResponse)
def update_appointment_status(
    appointment_id: str,
    payload: UpdateAppointmentStatusRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Updates appointment lifecycle status or administrative notes."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="appointment:manage"
    )
    try:
        a_uuid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid appointment ID.")

    appt = (
        db.query(AppointmentRecord)
        .filter(
            AppointmentRecord.id == a_uuid,
            AppointmentRecord.hospital_id == emp_ctx.hospital.id,
        )
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if payload.status:
        appt.status = payload.status
    if payload.notes:
        appt.notes = payload.notes

    db.commit()
    db.refresh(appt)

    return AppointmentItemResponse(
        id=str(appt.id),
        patient_id=str(appt.patient_id),
        patient_mrn=appt.patient_mrn,
        patient_name=appt.patient_name,
        doctor_id=str(appt.doctor_id) if appt.doctor_id else None,
        doctor_name=appt.doctor_name,
        department_id=str(appt.department_id) if appt.department_id else None,
        department_name=appt.department_name,
        appointment_time=appt.appointment_time,
        duration=appt.duration,
        appointment_type=appt.appointment_type,
        status=appt.status,
        room=appt.room,
        priority=appt.priority,
        checked_in_at=appt.checked_in_at.isoformat() if appt.checked_in_at else None,
        notes=appt.notes,
    )


@router.get("/shifts")
def get_shifts(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieves operational facility shifts for clinical scheduling."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="shift:read"
    )
    return [
        {
            "id": "shift-morning",
            "name": "Morning Shift",
            "start_time": "08:00",
            "end_time": "16:00",
            "department": "Facility Wide",
        },
        {
            "id": "shift-evening",
            "name": "Evening Shift",
            "start_time": "16:00",
            "end_time": "00:00",
            "department": "Facility Wide",
        },
        {
            "id": "shift-night",
            "name": "Night Shift",
            "start_time": "00:00",
            "end_time": "08:00",
            "department": "Facility Wide",
        },
    ]


@router.post("/consultations/{appointment_id}/start")
def start_consultation(
    appointment_id: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Doctor marks consultation encounter in progress."""
    appt = (
        db.query(AppointmentRecord)
        .filter(
            AppointmentRecord.id == uuid.UUID(appointment_id),
            AppointmentRecord.hospital_id == emp_ctx.hospital.id,
        )
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    appt.status = "in-progress"
    db.commit()
    return {"status": "in-progress", "appointment_id": str(appt.id)}


@router.post("/consultations/{appointment_id}/complete")
def complete_consultation(
    appointment_id: str,
    payload: CompleteConsultationRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Doctor concludes clinical consultation and records notes/diagnosis into patient record."""
    appt = (
        db.query(AppointmentRecord)
        .filter(
            AppointmentRecord.id == uuid.UUID(appointment_id),
            AppointmentRecord.hospital_id == emp_ctx.hospital.id,
        )
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    appt.status = "completed"
    appt.completed_at = datetime.now(timezone.utc)
    appt_notes = payload.clinical_notes
    if payload.diagnosis:
        appt_notes += f"\nDiagnosis: {payload.diagnosis}"
    if payload.prescriptions:
        appt_notes += f"\nPrescribed: {payload.prescriptions}"
    appt.notes = appt_notes

    # Update patient record with doctor's clinical findings
    patient = db.query(PatientRecord).filter(PatientRecord.id == appt.patient_id).first()
    if patient:
        timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        notes_entry = f"[{timestamp_str} - Dr. {emp_ctx.user.full_name}]\n{payload.clinical_notes}"
        if payload.diagnosis:
            notes_entry += f"\nDiagnosis: {payload.diagnosis}"
        if payload.prescriptions:
            notes_entry += f"\nPrescribed: {payload.prescriptions}"

        if patient.clinical_notes:
            patient.clinical_notes = notes_entry + "\n\n" + patient.clinical_notes
        else:
            patient.clinical_notes = notes_entry

    db.add(
        HospitalNotification(
            hospital_id=emp_ctx.hospital.id,
            title="Clinical Consultation Concluded",
            message=f"Dr. {emp_ctx.user.full_name or 'Attending Doctor'} completed consultation for {appt.patient_name} ({appt.patient_mrn}).",
            category="clinical",
            is_read=False,
        )
    )

    db.commit()
    return {"status": "completed", "appointment_id": str(appt.id)}


@router.post("/doctor/call-next", response_model=AppointmentItemResponse)
def doctor_call_next(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Doctor calls the next waiting patient into the examination room, setting appointment to in-progress."""
    _, _, dname, dept_id, _ = _get_active_assignment(emp_ctx, db)

    clean_name = emp_ctx.user.full_name.replace("Dr.", "").replace("Dr ", "").strip()
    doc_filter = or_(
        AppointmentRecord.doctor_id == emp_ctx.user.id,
        AppointmentRecord.doctor_name == emp_ctx.user.full_name,
        AppointmentRecord.doctor_name.ilike(f"%{clean_name}%"),
    )

    appt = (
        db.query(AppointmentRecord)
        .filter(
            AppointmentRecord.hospital_id == emp_ctx.hospital.id,
            AppointmentRecord.status == "checked-in",
            doc_filter,
        )
        .order_by(AppointmentRecord.checked_in_at.asc(), AppointmentRecord.appointment_time.asc())
        .first()
    )

    if not appt and dept_id:
        appt = (
            db.query(AppointmentRecord)
            .filter(
                AppointmentRecord.hospital_id == emp_ctx.hospital.id,
                AppointmentRecord.status == "checked-in",
                AppointmentRecord.department_id == dept_id,
            )
            .order_by(AppointmentRecord.checked_in_at.asc(), AppointmentRecord.appointment_time.asc())
            .first()
        )

    if not appt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No waiting patients currently in the queue for your workspace.",
        )

    appt.status = "in-progress"
    db.add(
        HospitalNotification(
            hospital_id=emp_ctx.hospital.id,
            title="Patient In Consultation",
            message=f"{appt.patient_name} ({appt.patient_mrn}) called into examination room {appt.room} by Dr. {emp_ctx.user.full_name}.",
            category="clinical",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(appt)

    return AppointmentItemResponse(
        id=str(appt.id),
        patient_id=str(appt.patient_id),
        patient_mrn=appt.patient_mrn,
        patient_name=appt.patient_name,
        doctor_id=str(appt.doctor_id) if appt.doctor_id else None,
        doctor_name=appt.doctor_name,
        department_id=str(appt.department_id) if appt.department_id else None,
        department_name=appt.department_name,
        appointment_time=appt.appointment_time,
        duration=appt.duration,
        appointment_type=appt.appointment_type,
        status=appt.status,
        room=appt.room,
        priority=appt.priority,
        checked_in_at=appt.checked_in_at.isoformat() if appt.checked_in_at else None,
        notes=appt.notes,
    )


@router.post("/doctor/call-patient/{appointment_id}", response_model=AppointmentItemResponse)
@router.post("/queue/{appointment_id}/call", response_model=AppointmentItemResponse)
def doctor_call_patient(
    appointment_id: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Doctor calls an individual waiting patient into the consultation room, setting status to in-progress."""
    try:
        a_uuid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid appointment ID.")

    appt = (
        db.query(AppointmentRecord)
        .filter(
            AppointmentRecord.id == a_uuid,
            AppointmentRecord.hospital_id == emp_ctx.hospital.id,
        )
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment record not found.")

    appt.status = "in-progress"
    if not appt.doctor_name or appt.doctor_name in ("Attending Staff", "General Duty Medical Officer") or not appt.doctor_id:
        appt.doctor_id = emp_ctx.user.id
        appt.doctor_name = emp_ctx.user.full_name or "Attending Physician"
    db.add(
        HospitalNotification(
            hospital_id=emp_ctx.hospital.id,
            title="Patient In Consultation",
            message=f"{appt.patient_name} ({appt.patient_mrn}) called into examination room by Dr. {emp_ctx.user.full_name}.",
            category="clinical",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(appt)

    return AppointmentItemResponse(
        id=str(appt.id),
        patient_id=str(appt.patient_id),
        patient_mrn=appt.patient_mrn,
        patient_name=appt.patient_name,
        doctor_id=str(appt.doctor_id) if appt.doctor_id else None,
        doctor_name=appt.doctor_name,
        department_id=str(appt.department_id) if appt.department_id else None,
        department_name=appt.department_name,
        appointment_time=appt.appointment_time,
        duration=appt.duration,
        appointment_type=appt.appointment_type,
        status=appt.status,
        room=appt.room,
        priority=appt.priority,
        checked_in_at=appt.checked_in_at.isoformat() if appt.checked_in_at else None,
        notes=appt.notes,
    )


@router.post("/consultations/{appointment_id}/save-report", response_model=ConsultationReportResponse)
def save_consultation_report(
    appointment_id: str,
    payload: SaveConsultationReportRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Doctor concludes clinical consultation, compiles official encounter report,
    and saves report file into Filebase S3. Replaces any prior report for this patient."""
    appt = (
        db.query(AppointmentRecord)
        .filter(
            AppointmentRecord.id == uuid.UUID(appointment_id),
            AppointmentRecord.hospital_id == emp_ctx.hospital.id,
        )
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment encounter not found.")

    patient = db.query(PatientRecord).filter(PatientRecord.id == appt.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient demographic record not found.")

    latest_vital = (
        db.query(PatientVitalRecord)
        .filter(
            PatientVitalRecord.hospital_id == emp_ctx.hospital.id,
            PatientVitalRecord.patient_id == patient.id,
        )
        .order_by(desc(PatientVitalRecord.recorded_at))
        .first()
    )

    bp_val = latest_vital.bp if latest_vital else "120/80 mmHg"
    hr_val = str(latest_vital.heart_rate) if latest_vital else "72"
    temp_val = latest_vital.temperature if latest_vital else "98.6 °F"
    spo2_val = str(latest_vital.spo2) if latest_vital else "98"

    now_utc = datetime.now(timezone.utc)
    now_str = now_utc.strftime("%Y-%m-%d %H:%M:%S UTC")

    report_text = f"""================================================================================
                            AAROGYA HEALTH SYSTEM
               OFFICIAL MEDICAL CONSULTATION ENCOUNTER REPORT
================================================================================
Facility:             {emp_ctx.hospital.name} ({emp_ctx.hospital.hospital_uid})
Encounter ID:         {appt.id}
Date & Time:          {now_str}
Department:           {appt.department_name}
Consultation Room:    {appt.room}
Attending Physician:  Dr. {emp_ctx.user.full_name} ({emp_ctx.user.username})
Encounter Status:     CONCLUDED & CERTIFIED

--------------------------------------------------------------------------------
PATIENT IDENTIFICATION & DEMOGRAPHICS
--------------------------------------------------------------------------------
Full Legal Name:      {patient.full_name}
Medical Record Number:{patient.mrn}
Age & Gender:         {patient.age} years / {patient.gender}
Blood Group:          {patient.blood_group}
Contact Phone:        {patient.contact_phone}
Known Allergies:      {patient.allergies or 'No Known Drug Allergies (NKDA)'}
Chronic Conditions:   {patient.chronic_conditions or 'None documented'}

--------------------------------------------------------------------------------
MEASURED INTAKE VITALS
--------------------------------------------------------------------------------
Blood Pressure:       {bp_val}
Heart Rate / Pulse:   {hr_val} bpm
Body Temperature:     {temp_val}
Oxygen Saturation:    {spo2_val}%

--------------------------------------------------------------------------------
CHIEF COMPLAINT & PRESENTING SYMPTOMS
--------------------------------------------------------------------------------
Visit Slot Type:      {appt.type}
Intake Complaint:     {patient.chief_complaint or 'Routine Medical Consultation'}

--------------------------------------------------------------------------------
CLINICAL DIAGNOSIS & ASSESSMENT
--------------------------------------------------------------------------------
{payload.diagnosis or 'Clinical Consultation Assessment completed successfully.'}

--------------------------------------------------------------------------------
ATTENDING PHYSICIAN CONSULTANCY NOTES & OBSERVATIONS
--------------------------------------------------------------------------------
{payload.clinical_notes}

--------------------------------------------------------------------------------
PRESCRIPTIONS & PHARMACEUTICAL ORDERS
--------------------------------------------------------------------------------
{payload.prescriptions or 'None prescribed. Patient advised to maintain current lifestyle regimen.'}

--------------------------------------------------------------------------------
FOLLOW-UP & DISCHARGE INSTRUCTIONS
--------------------------------------------------------------------------------
{payload.follow_up or 'Return for clinical evaluation if symptoms persist or worsen.'}

================================================================================
ELECTRONIC HEALTH RECORD VERIFICATION & AUDIT SIGNATURE
Certified By:         Dr. {emp_ctx.user.full_name}
Storage Repository:   Filebase S3 Encrypted Institutional Storage
Checksum Algorithm:   SHA-256 Authenticated
================================================================================
END OF ENCOUNTER CONSULTATION REPORT
"""

    report_bytes = report_text.encode("utf-8")
    safe_filename = f"Consultation_Report_{patient.mrn}.txt"
    object_key = f"{emp_ctx.hospital.id}/consultation_reports/{patient.mrn}_{uuid.uuid4().hex[:8]}_{safe_filename}"
    checksum = hashlib.sha256(report_bytes).hexdigest()

    if StorageService.is_configured():
        try:
            StorageService.upload_bytes(
                data=report_bytes,
                object_key=object_key,
                content_type="text/plain",
                metadata={
                    "patient-mrn": patient.mrn,
                    "patient-id": str(patient.id),
                    "hospital-id": str(emp_ctx.hospital.id),
                    "encounter-id": str(appt.id),
                },
            )
        except Exception as e:
            logger.error("Filebase S3 upload failed: %s", str(e))

    old_reports = (
        db.query(DocumentRecord)
        .filter(
            DocumentRecord.hospital_id == emp_ctx.hospital.id,
            or_(
                DocumentRecord.patient_id == str(patient.id),
                DocumentRecord.patient_id == patient.mrn,
            ),
            DocumentRecord.category == "consultation_report",
            DocumentRecord.status == "active",
        )
        .all()
    )
    for old_doc in old_reports:
        old_doc.status = "archived"
        old_doc.archived_by_user_id = emp_ctx.user.id

    doc_record = DocumentRecord(
        hospital_id=emp_ctx.hospital.id,
        patient_id=str(patient.id),
        encounter_id=str(appt.id),
        department_id=appt.department_id,
        category="consultation_report",
        title=f"Consultation Report - {patient.full_name} ({patient.mrn})",
        original_filename=safe_filename,
        storage_key=object_key,
        mime_type="text/plain",
        file_size=len(report_bytes),
        checksum_sha256=checksum,
        status="active",
        access_classification="standard",
        uploaded_by_user_id=emp_ctx.user.id,
    )
    db.add(doc_record)

    appt.status = "completed"
    appt.completed_at = now_utc
    appt.notes = payload.clinical_notes

    notes_entry = f"[{now_utc.strftime('%Y-%m-%d %H:%M')} - Dr. {emp_ctx.user.full_name}]\n{payload.clinical_notes}"
    if payload.diagnosis:
        notes_entry += f"\nDiagnosis: {payload.diagnosis}"
    if payload.prescriptions:
        notes_entry += f"\nPrescribed: {payload.prescriptions}"

    if patient.clinical_notes:
        patient.clinical_notes = notes_entry + "\n\n" + patient.clinical_notes
    else:
        patient.clinical_notes = notes_entry

    db.add(
        HospitalNotification(
            hospital_id=emp_ctx.hospital.id,
            title="Clinical Consultation Concluded & Report Saved",
            message=f"Dr. {emp_ctx.user.full_name} completed consultation and saved report for {patient.full_name} ({patient.mrn}). Report stored in Filebase S3.",
            category="clinical",
            is_read=False,
        )
    )

    db.commit()
    db.refresh(doc_record)

    download_url = None
    if StorageService.is_configured():
        try:
            download_url = StorageService.generate_presigned_download_url(
                object_key=doc_record.storage_key,
                expires_in_seconds=3600,
                download_filename=safe_filename,
            )
        except Exception:
            pass

    return ConsultationReportResponse(
        status="completed",
        appointment_id=str(appt.id),
        document_id=str(doc_record.id),
        patient_mrn=patient.mrn,
        filename=safe_filename,
        download_url=download_url,
        report_preview=report_text,
    )


@router.get("/patients/{patient_id_or_mrn}/consultancy-report", response_model=PatientConsultancyReportDetailResponse)
def get_patient_consultancy_report(
    patient_id_or_mrn: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieves the latest authoritative Filebase consultation report for a patient."""
    patient = None
    try:
        p_uuid = uuid.UUID(patient_id_or_mrn)
        patient = db.query(PatientRecord).filter(
            PatientRecord.id == p_uuid,
            PatientRecord.hospital_id == emp_ctx.hospital.id,
        ).first()
    except (ValueError, AttributeError):
        pass

    if not patient:
        patient = db.query(PatientRecord).filter(
            func.lower(PatientRecord.mrn) == patient_id_or_mrn.strip().lower(),
            PatientRecord.hospital_id == emp_ctx.hospital.id,
        ).first()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient demographic record not found.")

    doc = (
        db.query(DocumentRecord)
        .filter(
            DocumentRecord.hospital_id == emp_ctx.hospital.id,
            or_(
                DocumentRecord.patient_id == str(patient.id),
                DocumentRecord.patient_id == patient.mrn,
            ),
            DocumentRecord.category == "consultation_report",
            DocumentRecord.status == "active",
        )
        .order_by(desc(DocumentRecord.created_at))
        .first()
    )

    if not doc:
        return PatientConsultancyReportDetailResponse(
            has_report=False,
            patient_name=patient.full_name,
            patient_mrn=patient.mrn,
            detail="No consultation report on file for this patient.",
        )

    download_url = None
    file_content = None
    if StorageService.is_configured():
        try:
            download_url = StorageService.generate_presigned_download_url(
                object_key=doc.storage_key,
                expires_in_seconds=3600,
                download_filename=doc.original_filename,
            )
            raw_bytes, _ = StorageService.download_bytes(doc.storage_key)
            file_content = raw_bytes.decode("utf-8", errors="replace")
        except Exception as e:
            logger.warning("Could not fetch file bytes from Filebase: %s", str(e))

    uploader = db.query(User).filter(User.id == doc.uploaded_by_user_id).first()
    doctor_name = uploader.full_name if uploader else "Attending Physician"

    return PatientConsultancyReportDetailResponse(
        has_report=True,
        document_id=str(doc.id),
        title=doc.title,
        filename=doc.original_filename,
        created_at=doc.created_at.isoformat(),
        doctor_name=doctor_name,
        download_url=download_url,
        file_content=file_content,
        patient_name=patient.full_name,
        patient_mrn=patient.mrn,
    )


@router.post("/patients/{patient_id}/vitals", response_model=VitalItemResponse)
def record_patient_vitals(
    patient_id: str,
    payload: RecordVitalRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Nurse records vital signs for a patient."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="vitals:write"
    )
    p_uuid = uuid.UUID(patient_id)
    patient = (
        db.query(PatientRecord)
        .filter(PatientRecord.id == p_uuid, PatientRecord.hospital_id == emp_ctx.hospital.id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    vital = PatientVitalRecord(
        hospital_id=emp_ctx.hospital.id,
        patient_id=p_uuid,
        recorded_by_user_id=emp_ctx.user.id,
        recorded_by_name=emp_ctx.user.full_name or "Registered Nurse",
        bp=payload.bp,
        heart_rate=payload.heart_rate,
        temperature=payload.temperature,
        spo2=payload.spo2,
        respiratory_rate=payload.respiratory_rate,
        blood_glucose=payload.blood_glucose,
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(vital)
    db.commit()
    db.refresh(vital)

    return VitalItemResponse(
        id=str(vital.id),
        bp=vital.bp,
        heart_rate=vital.heart_rate,
        temperature=vital.temperature,
        spo2=vital.spo2,
        respiratory_rate=vital.respiratory_rate,
        blood_glucose=vital.blood_glucose,
        recorded_by_name=vital.recorded_by_name,
        recorded_at=vital.recorded_at.isoformat(),
    )


@router.post("/vitals", response_model=VitalItemResponse)
def record_vital_direct(
    payload: DirectRecordVitalRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Direct vital sign record entry validating vitals:write permission."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="vitals:write"
    )
    try:
        p_uuid = uuid.UUID(payload.patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid patient ID.")

    patient = (
        db.query(PatientRecord)
        .filter(PatientRecord.id == p_uuid, PatientRecord.hospital_id == emp_ctx.hospital.id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    vital = PatientVitalRecord(
        hospital_id=emp_ctx.hospital.id,
        patient_id=p_uuid,
        recorded_by_user_id=emp_ctx.user.id,
        recorded_by_name=emp_ctx.user.full_name or emp_ctx.user.username,
        bp=payload.bp,
        heart_rate=payload.heart_rate,
        temperature=payload.temperature,
        spo2=payload.spo2,
        respiratory_rate=payload.respiratory_rate,
        blood_glucose=payload.blood_glucose,
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(vital)
    db.commit()
    db.refresh(vital)

    return VitalItemResponse(
        id=str(vital.id),
        bp=vital.bp,
        heart_rate=vital.heart_rate,
        temperature=vital.temperature,
        spo2=vital.spo2,
        respiratory_rate=vital.respiratory_rate,
        blood_glucose=vital.blood_glucose,
        recorded_by_name=vital.recorded_by_name,
        recorded_at=vital.recorded_at.isoformat(),
    )


@router.get("/staff/tasks", response_model=List[NursingTaskResponse])
@router.get("/nursing/tasks", response_model=List[NursingTaskResponse])
def get_nursing_tasks(
    department_id: Optional[str] = None,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieves nursing task list for the ward/department or hospital facility."""
    _, role_code, _, my_dept_id, scope_type = _get_active_assignment(emp_ctx, db)

    query = db.query(NursingTaskRecord).filter(NursingTaskRecord.hospital_id == emp_ctx.hospital.id)

    # Scoped to department if departmental nurse or staff
    if role_code == "nurse" and scope_type != "FACILITY" and my_dept_id is not None:
        query = query.filter(NursingTaskRecord.department_id == my_dept_id)
    elif role_code == "staff" and scope_type != "FACILITY" and my_dept_id is not None:
        query = query.filter(NursingTaskRecord.department_id == my_dept_id)
    elif department_id and department_id != "all":
        try:
            d_uuid = uuid.UUID(department_id)
            query = query.filter(NursingTaskRecord.department_id == d_uuid)
        except ValueError:
            pass

    tasks = query.order_by(NursingTaskRecord.is_completed, desc(NursingTaskRecord.created_at)).all()

    return [
        NursingTaskResponse(
            id=str(t.id),
            patient_id=str(t.patient_id) if t.patient_id else None,
            patient_name=t.patient_name,
            bed_number=t.bed_number,
            task_type=t.task_type,
            description=t.description,
            scheduled_time=t.scheduled_time,
            priority=t.priority,
            is_completed=t.is_completed,
            completed_by_name=t.completed_by_name,
            completed_at=t.completed_at.isoformat() if t.completed_at else None,
            notes=t.notes,
        )
        for t in tasks
    ]


@router.patch("/staff/tasks/{task_id}/complete")
@router.patch("/nursing/tasks/{task_id}/complete")
def complete_nursing_task(
    task_id: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Marks a nursing care or staff task as completed."""
    _, role_code, _, _, _ = _get_active_assignment(emp_ctx, db)
    task = (
        db.query(NursingTaskRecord)
        .filter(
            NursingTaskRecord.id == uuid.UUID(task_id),
            NursingTaskRecord.hospital_id == emp_ctx.hospital.id,
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    default_title = "Nursing Supervisor" if role_code == "nursing_supervisor" else ("Registered Nurse" if role_code == "nurse" else "General Staff")
    task.is_completed = True
    task.completed_by_name = emp_ctx.user.full_name or default_title
    task.completed_at = datetime.now(timezone.utc)

    db.add(
        AuditLog(
            hospital_id=emp_ctx.hospital.id,
            user_id=emp_ctx.user.id,
            action="COMPLETE_NURSING_TASK",
            resource_type="nursing_task",
            resource_id=str(task.id),
            details=f"Completed task '{task.description}' ({default_title})",
        )
    )
    db.commit()

    return {"status": "completed", "task_id": str(task.id)}


@router.post("/staff/tasks", response_model=NursingTaskResponse)
@router.post("/nursing/tasks", response_model=NursingTaskResponse)
def create_nursing_task(
    payload: CreateNursingTaskRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Creates a new nursing task."""
    _, role_code, _, dept_id, _ = _get_active_assignment(emp_ctx, db)

    target_dept_id = dept_id
    if payload.department_id:
        try:
            target_dept_id = uuid.UUID(payload.department_id)
        except ValueError:
            pass

    task = NursingTaskRecord(
        hospital_id=emp_ctx.hospital.id,
        department_id=target_dept_id,
        patient_id=uuid.UUID(payload.patient_id) if payload.patient_id else None,
        patient_name=payload.patient_name,
        bed_number=payload.bed_number,
        task_type=payload.task_type or ("general_task" if role_code == "staff" else "nursing_care"),
        description=payload.description,
        scheduled_time=payload.scheduled_time,
        priority=payload.priority,
        is_completed=False,
    )
    db.add(task)
    db.add(
        AuditLog(
            hospital_id=emp_ctx.hospital.id,
            user_id=emp_ctx.user.id,
            action="CREATE_NURSING_TASK",
            resource_type="nursing_task",
            resource_id=str(task.id),
            details=f"Created shift task: '{task.description}' (Priority: {task.priority})",
        )
    )
    db.commit()
    db.refresh(task)

    return NursingTaskResponse(
        id=str(task.id),
        patient_id=str(task.patient_id) if task.patient_id else None,
        patient_name=task.patient_name,
        bed_number=task.bed_number,
        task_type=task.task_type,
        description=task.description,
        scheduled_time=task.scheduled_time,
        priority=task.priority,
        is_completed=task.is_completed,
    )


@router.delete("/staff/tasks/{task_id}")
@router.delete("/nursing/tasks/{task_id}")
def delete_nursing_task(
    task_id: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Deletes a nursing or staff task."""
    try:
        t_uuid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID format.")

    task = (
        db.query(NursingTaskRecord)
        .filter(
            NursingTaskRecord.id == t_uuid,
            NursingTaskRecord.hospital_id == emp_ctx.hospital.id,
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    db.delete(task)
    db.add(
        AuditLog(
            hospital_id=emp_ctx.hospital.id,
            user_id=emp_ctx.user.id,
            action="DELETE_NURSING_TASK",
            resource_type="nursing_task",
            resource_id=str(task.id),
            details=f"Deleted task '{task.description}'",
        )
    )
    db.commit()

    return {"status": "deleted", "task_id": task_id}


@router.get("/supervisor/nursing-overview", response_model=SupervisorNursingOverviewResponse)
def get_supervisor_nursing_overview(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Nursing Services Supervisor command center metrics across ALL hospital departments."""
    depts = db.query(Department).filter(Department.hospital_id == emp_ctx.hospital.id).all()

    # Bed capacities standard for departments in HIMS
    dept_bed_capacities = {
        "GEN-MED": 30,
        "EMERG": 20,
        "CARDIO": 16,
        "PEDS": 18,
        "RAD": 8,
        "PATH": 6,
        "OPD": 12,
        "DISP": 4,
    }

    dept_items: List[DepartmentCoverageItem] = []
    total_census = 0
    total_beds = 0

    for d in depts:
        cap = dept_bed_capacities.get(d.code, 15)
        total_beds += cap

        # Count active patients in department
        p_count = (
            db.query(func.count(PatientRecord.id))
            .filter(
                PatientRecord.hospital_id == emp_ctx.hospital.id,
                PatientRecord.department_id == d.id,
            )
            .scalar()
            or 0
        )
        total_census += p_count

        crit_count = (
            db.query(func.count(PatientRecord.id))
            .filter(
                PatientRecord.hospital_id == emp_ctx.hospital.id,
                PatientRecord.department_id == d.id,
                PatientRecord.triage_category.in_(["Critical", "Urgent"]),
            )
            .scalar()
            or 0
        )

        task_count = (
            db.query(func.count(NursingTaskRecord.id))
            .filter(
                NursingTaskRecord.hospital_id == emp_ctx.hospital.id,
                NursingTaskRecord.department_id == d.id,
                NursingTaskRecord.is_completed == False,
            )
            .scalar()
            or 0
        )

        # Query actual on-duty or assigned nurses for this department from DB
        from app.models.membership import TenantMembership
        from app.models.assignment import RoleAssignment
        from app.models.role import Role

        assigned_nurses = (
            db.query(func.count(TenantMembership.id))
            .join(RoleAssignment, RoleAssignment.membership_id == TenantMembership.id)
            .join(Role, Role.id == RoleAssignment.role_id)
            .filter(
                TenantMembership.hospital_id == emp_ctx.hospital.id,
                TenantMembership.status == "active",
                RoleAssignment.department_id == d.id,
                RoleAssignment.is_active == True,
                or_(
                    func.lower(Role.code).contains("nurse"),
                    func.lower(Role.name).contains("nurse"),
                ),
            )
            .scalar()
            or 0
        )
        on_duty_shifts = (
            db.query(func.count(NursingShiftRecord.id))
            .filter(
                NursingShiftRecord.hospital_id == emp_ctx.hospital.id,
                NursingShiftRecord.department_id == d.id,
                NursingShiftRecord.status == "on_duty",
            )
            .scalar()
            or 0
        )
        active_nurse_count = max(assigned_nurses, on_duty_shifts)
        if active_nurse_count == 0 and p_count > 0:
            ratio = "1:0"
        elif active_nurse_count > 0:
            ratio = f"1:{max(1, p_count // active_nurse_count)}"
        else:
            ratio = "0:0"
        occ_rate = round((p_count / cap) * 100, 1) if cap > 0 else 0.0

        dept_items.append(
            DepartmentCoverageItem(
                department_id=str(d.id),
                department_name=d.name,
                department_code=d.code,
                total_beds=cap,
                occupied_beds=p_count,
                occupancy_rate=occ_rate,
                active_nurses=active_nurse_count,
                nurse_to_patient_ratio=ratio,
                critical_patients_count=crit_count,
                pending_tasks_count=task_count,
            )
        )

    overall_occ = round((total_census / total_beds) * 100, 1) if total_beds > 0 else 0.0
    total_nurses = sum(d.active_nurses for d in dept_items)

    alerts = []
    for item in dept_items:
        if item.occupancy_rate >= 85.0:
            alerts.append({
                "severity": "high",
                "department": item.department_name,
                "message": f"High bed occupancy ({item.occupancy_rate}%). Consider requesting inter-department bed reallocations.",
            })
        if item.critical_patients_count >= 3:
            alerts.append({
                "severity": "urgent",
                "department": item.department_name,
                "message": f"{item.critical_patients_count} critical/urgent patients. Review staffing coverage.",
            })

    return SupervisorNursingOverviewResponse(
        facility_name=emp_ctx.hospital.name,
        facility_uid=emp_ctx.hospital.hospital_uid,
        total_inpatient_census=total_census,
        total_bed_capacity=total_beds,
        overall_occupancy_rate=overall_occ,
        total_on_duty_nurses=total_nurses,
        departments=dept_items,
        escalation_alerts=alerts,
    )


@router.get("/doctors", response_model=List[DoctorSummaryResponse])
def get_doctors(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve actual physicians/doctors assigned to the hospital with all their active departments."""
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role

    doctor_assignments = (
        db.query(TenantMembership, RoleAssignment, Role, User, Department)
        .join(RoleAssignment, RoleAssignment.membership_id == TenantMembership.id)
        .join(Role, Role.id == RoleAssignment.role_id)
        .join(User, User.id == TenantMembership.user_id)
        .outerjoin(Department, Department.id == RoleAssignment.department_id)
        .filter(
            TenantMembership.hospital_id == emp_ctx.hospital.id,
            TenantMembership.status == "active",
            RoleAssignment.is_active == True,
            or_(
                func.lower(Role.code).contains("doc"),
                func.lower(Role.name).contains("doctor"),
                func.lower(Role.name).contains("physician"),
            ),
        )
        .all()
    )

    user_info_map: Dict[uuid.UUID, Any] = {}
    user_dept_map: Dict[uuid.UUID, List[str]] = {}
    user_dept_id_map: Dict[uuid.UUID, List[str]] = {}

    for mem, assign, role, user, dept in doctor_assignments:
        if user.id not in user_info_map:
            user_info_map[user.id] = (user, role)
            user_dept_map[user.id] = []
            user_dept_id_map[user.id] = []
        d_name = dept.name if dept else "General Medicine"
        if d_name not in user_dept_map[user.id]:
            user_dept_map[user.id].append(d_name)
        if dept and str(dept.id) not in user_dept_id_map[user.id]:
            user_dept_id_map[user.id].append(str(dept.id))

    doctors: List[DoctorSummaryResponse] = []
    for user_id, (user, role) in user_info_map.items():
        apt_count = (
            db.query(func.count(AppointmentRecord.id))
            .filter(
                AppointmentRecord.hospital_id == emp_ctx.hospital.id,
                or_(
                    AppointmentRecord.doctor_id == user.id,
                    AppointmentRecord.doctor_name == user.full_name,
                ),
            )
            .scalar()
            or 0
        )

        depts = user_dept_map.get(user_id, ["General Medicine"])
        dept_ids = user_dept_id_map.get(user_id, [])
        primary_dept = depts[0] if depts else "General Medicine"
        primary_dept_id = dept_ids[0] if dept_ids else None

        doctors.append(
            DoctorSummaryResponse(
                id=str(user.id),
                name=user.full_name or user.username,
                title=role.name,
                department=primary_dept,
                department_id=primary_dept_id,
                departments=depts,
                department_ids=dept_ids,
                specialty=primary_dept,
                status="Available" if apt_count == 0 else "In Consultation",
                patients_today=apt_count,
                next_slot="Available" if apt_count == 0 else "Next Slot Scheduled",
                room="Exam Room 101" if len(doctors) == 0 else f"Exam Room 10{len(doctors)+1}",
            )
        )

    return doctors


@router.get("/doctor/dashboard-summary", response_model=DoctorDashboardSummaryResponse)
def get_doctor_dashboard_summary(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Calculates live KPI metrics for attending doctor's consultation queue and caseload."""
    _, _, dname, dept_id, _ = _get_active_assignment(emp_ctx, db)

    clean_emp_name = emp_ctx.user.full_name.replace("Dr.", "").replace("Dr ", "").strip()
    doc_filter = or_(
        AppointmentRecord.doctor_id == emp_ctx.user.id,
        AppointmentRecord.doctor_name == emp_ctx.user.full_name,
        AppointmentRecord.doctor_name == emp_ctx.user.username,
        AppointmentRecord.doctor_name.ilike(f"%{emp_ctx.user.full_name}%"),
        AppointmentRecord.doctor_name.ilike(f"%{clean_emp_name}%"),
    )

    appts = (
        db.query(AppointmentRecord)
        .filter(
            AppointmentRecord.hospital_id == emp_ctx.hospital.id,
            doc_filter,
        )
        .all()
    )

    waiting_count = sum(1 for a in appts if a.status == "checked-in")
    in_consult_count = sum(1 for a in appts if a.status == "in-progress")
    completed_count = sum(1 for a in appts if a.status == "completed")
    total_today = len(appts)

    patient_ids = [a.patient_id for a in appts]
    ret_count = 0
    new_count = 0
    if patient_ids:
        pat_appt_counts = (
            db.query(AppointmentRecord.patient_id, func.count(AppointmentRecord.id))
            .filter(
                AppointmentRecord.hospital_id == emp_ctx.hospital.id,
                AppointmentRecord.patient_id.in_(patient_ids),
            )
            .group_by(AppointmentRecord.patient_id)
            .all()
        )
        count_map = {pid: cnt for pid, cnt in pat_appt_counts}
        for a in appts:
            if count_map.get(a.patient_id, 0) > 1:
                ret_count += 1
            else:
                new_count += 1

    exam_room = appts[0].room if appts and appts[0].room else "Consultation Suite"

    return DoctorDashboardSummaryResponse(
        waiting_patients_count=waiting_count,
        new_patients_count=new_count,
        returning_patients_count=ret_count,
        department_name=dname or "Clinical Practice",
        total_today=total_today,
        exam_room=exam_room,
        in_consultation_count=in_consult_count,
        completed_today_count=completed_count,
    )


@router.get("/doctor/patient-history", response_model=DoctorPatientHistoryResponse)
def get_doctor_patient_history(
    search: Optional[str] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    patient_id: Optional[str] = None,
    offset: int = 0,
    limit: int = 20,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieves full clinical consultation history for the attending doctor."""
    clean_emp_name = emp_ctx.user.full_name.replace("Dr.", "").replace("Dr ", "").strip()
    doc_filter = or_(
        AppointmentRecord.doctor_id == emp_ctx.user.id,
        AppointmentRecord.doctor_name == emp_ctx.user.full_name,
        AppointmentRecord.doctor_name == emp_ctx.user.username,
        AppointmentRecord.doctor_name.ilike(f"%{emp_ctx.user.full_name}%"),
        AppointmentRecord.doctor_name.ilike(f"%{clean_emp_name}%"),
    )

    query = (
        db.query(AppointmentRecord, PatientRecord)
        .join(PatientRecord, PatientRecord.id == AppointmentRecord.patient_id)
        .filter(
            AppointmentRecord.hospital_id == emp_ctx.hospital.id,
            doc_filter,
        )
    )

    if patient_id:
        try:
            p_uuid = uuid.UUID(patient_id)
            query = query.filter(AppointmentRecord.patient_id == p_uuid)
        except ValueError:
            pass

    if search:
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(AppointmentRecord.patient_name).like(s),
                func.lower(AppointmentRecord.patient_mrn).like(s),
                func.lower(AppointmentRecord.notes).like(s),
            )
        )

    if date:
        query = query.filter(func.to_char(AppointmentRecord.created_at, "YYYY-MM-DD") == date)

    total = query.count()
    records = query.order_by(desc(AppointmentRecord.created_at)).offset(offset).limit(limit).all()

    items = []
    for appt, pat in records:
        diag = pat.chief_complaint
        notes_text = appt.notes or pat.clinical_notes
        if appt.notes and "Diagnosis:" in appt.notes:
            parts = appt.notes.split("Diagnosis:")
            if len(parts) > 1:
                diag = parts[1].split("\n")[0].split("|")[0].strip()
        elif pat.clinical_notes and "Diagnosis:" in pat.clinical_notes:
            parts = pat.clinical_notes.split("Diagnosis:")
            if len(parts) > 1:
                diag = parts[1].split("\n")[0].split("|")[0].strip()

        items.append(
            DoctorPatientHistoryItemResponse(
                id=str(appt.id),
                appointment_id=str(appt.id),
                patient_id=str(pat.id),
                patient_mrn=pat.mrn,
                patient_name=pat.full_name,
                age=pat.age,
                gender=pat.gender,
                blood_group=pat.blood_group,
                diagnosis=diag,
                clinical_notes=notes_text,
                prescriptions=None,
                appointment_time=appt.appointment_time,
                appointment_date=appt.created_at.strftime("%Y-%m-%d") if appt.created_at else None,
                appointment_type=appt.appointment_type,
                is_returning=False,
                document_count=0,
                completed_at=appt.completed_at.isoformat() if appt.completed_at else None,
            )
        )

    return DoctorPatientHistoryResponse(items=items, total=total)


@router.get("/staff", response_model=List[StaffSummaryResponse])
def get_staff(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve actual staff members currently active in the hospital.
    Excludes hospital administrators and deduplicates users with multiple assignments.
    """
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role

    memberships = (
        db.query(TenantMembership, User)
        .join(User, User.id == TenantMembership.user_id)
        .filter(
            TenantMembership.hospital_id == emp_ctx.hospital.id,
            TenantMembership.status == "active",
        )
        .all()
    )

    staff_list: List[StaffSummaryResponse] = []
    seen_users = set()

    for mem, user in memberships:
        if user.id in seen_users:
            continue

        # Fetch all active role assignments for this membership
        assignments = (
            db.query(RoleAssignment, Role, Department)
            .join(Role, Role.id == RoleAssignment.role_id)
            .outerjoin(Department, Department.id == RoleAssignment.department_id)
            .filter(
                RoleAssignment.membership_id == mem.id,
                RoleAssignment.is_active == True,
            )
            .all()
        )

        # Identify employee assignments in departments outside Hospital Administration
        employee_assignments = []
        for ra, r, d in assignments:
            r_code = r.code.lower() if r and r.code else ""
            r_name = r.name.lower() if r and r.name else ""
            d_name = d.name.lower() if d and d.name else ""

            is_admin_role = (
                "admin" in r_code
                or "administrator" in r_name
                or r_code in ("admin", "superadmin", "hosp_admin")
            )
            is_admin_dept = (
                "hospital administration" in d_name
                or d_name == "administration"
                or d_name == "hospital-wide administration"
                or d_name == "hospital governance"
            )

            # Skip administrator role and hospital administration department
            if is_admin_role or is_admin_dept:
                continue

            employee_assignments.append((ra, r, d))

        # If user has no employee assignments in any non-administration department, skip
        if not employee_assignments:
            continue

        # Combine distinct role names and non-administration departments (listed as one)
        distinct_roles = []
        distinct_depts = []
        for ra, r, d in employee_assignments:
            if r and r.name and r.name not in distinct_roles:
                distinct_roles.append(r.name)
            if d and d.name and d.name not in distinct_depts:
                distinct_depts.append(d.name)

        role_name = ", ".join(distinct_roles) if distinct_roles else "Staff Member"
        dept_name = ", ".join(distinct_depts) if distinct_depts else "Clinical Department"
        dept_id_str = str(employee_assignments[0][2].id) if employee_assignments[0][2] else None

        seen_users.add(user.id)

        staff_list.append(
            StaffSummaryResponse(
                id=str(mem.id),
                name=user.full_name,
                role=role_name,
                department=dept_name,
                department_id=dept_id_str,
                email=user.email,
                employee_uid=mem.employee_uid,
                status="Active Duty",
                location=dept_name,
                today_metric="On Active Roster",
            )
        )

    return staff_list


@router.get("/departments", response_model=List[DepartmentSummaryResponse])
def get_hospital_departments(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve active clinical departments configured for this hospital."""
    depts = (
        db.query(Department)
        .filter(Department.hospital_id == emp_ctx.hospital.id, Department.is_active == True)
        .order_by(Department.name.asc())
        .all()
    )

    dept_bed_capacities = {
        "GEN-MED": 30,
        "EMERG": 20,
        "CARDIO": 16,
        "PEDS": 18,
        "RAD": 8,
        "PATH": 6,
        "OPD": 12,
        "DISP": 4,
    }

    return [
        DepartmentSummaryResponse(
            id=str(d.id),
            name=d.name,
            code=d.code,
            description=d.description,
            bed_capacity=dept_bed_capacities.get(d.code, 15),
        )
        for d in depts
    ]


@router.get("/supervisor/nurses", response_model=List[StaffSummaryResponse])
@router.get("/nurses", response_model=List[StaffSummaryResponse])
def get_nurses(
    department_id: Optional[str] = None,
    query: Optional[str] = None,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve all active nurses assigned to the hospital, filterable by department."""
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role

    db_query = (
        db.query(TenantMembership, RoleAssignment, Role, User, Department)
        .join(RoleAssignment, RoleAssignment.membership_id == TenantMembership.id)
        .join(Role, Role.id == RoleAssignment.role_id)
        .join(User, User.id == TenantMembership.user_id)
        .outerjoin(Department, Department.id == RoleAssignment.department_id)
        .filter(
            TenantMembership.hospital_id == emp_ctx.hospital.id,
            TenantMembership.status == "active",
            RoleAssignment.is_active == True,
            or_(
                func.lower(Role.code).contains("nurse"),
                func.lower(Role.name).contains("nurse"),
            ),
        )
    )

    if department_id and department_id != "all":
        try:
            d_uuid = uuid.UUID(department_id)
            db_query = db_query.filter(RoleAssignment.department_id == d_uuid)
        except ValueError:
            pass

    if query:
        q_clean = f"%{query.strip().lower()}%"
        db_query = db_query.filter(
            or_(
                func.lower(User.full_name).contains(q_clean),
                func.lower(User.username).contains(q_clean),
                func.lower(User.email).contains(q_clean),
                func.lower(TenantMembership.employee_uid).contains(q_clean),
            )
        )

    nurse_assignments = db_query.order_by(User.full_name.asc()).all()

    nurses: List[StaffSummaryResponse] = []
    seen = set()

    for mem, assign, role, user, dept in nurse_assignments:
        key = (user.id, assign.department_id)
        if key in seen:
            continue
        seen.add(key)

        dept_name = dept.name if dept else "Hospital-Wide"
        nurses.append(
            StaffSummaryResponse(
                id=str(mem.id),
                name=user.full_name or user.username,
                role=role.name,
                department=dept_name,
                department_id=str(dept.id) if dept else None,
                email=user.email,
                employee_uid=mem.employee_uid,
                status="Active Duty",
                location=dept_name,
                today_metric="On Active Roster",
            )
        )

    return nurses


@router.get("/supervisor/nursing-audit-logs", response_model=List[NurseAuditLogItem])
def get_supervisor_nursing_audit_logs(
    query: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieves authoritative audit logging history strictly for nursing activity across hospital departments."""
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role

    # Identify nursing workforce user IDs
    nurse_user_ids = {
        u_id for (u_id,) in db.query(TenantMembership.user_id)
        .join(RoleAssignment, RoleAssignment.membership_id == TenantMembership.id)
        .join(Role, Role.id == RoleAssignment.role_id)
        .filter(
            TenantMembership.hospital_id == emp_ctx.hospital.id,
            or_(
                func.lower(Role.code).contains("nurse"),
                func.lower(Role.name).contains("nurse"),
            )
        ).all()
    }

    nursing_actions = [
        "RECORD_VITALS",
        "CREATE_NURSING_TASK",
        "COMPLETE_NURSING_TASK",
        "DELETE_NURSING_TASK",
        "PATIENT_INTAKE",
        "REVOCATION_REQUEST_SUBMITTED",
        "CONTACT_ADMIN_DISPATCHED",
    ]

    log_query = db.query(AuditLog, User).outerjoin(User, User.id == AuditLog.user_id).filter(
        AuditLog.hospital_id == emp_ctx.hospital.id,
        or_(
            AuditLog.user_id.in_(nurse_user_ids),
            AuditLog.action.in_(nursing_actions),
        )
    )

    if action and action != "ALL":
        log_query = log_query.filter(AuditLog.action == action)

    if query:
        q_clean = f"%{query.strip().lower()}%"
        log_query = log_query.filter(
            or_(
                func.lower(AuditLog.details).contains(q_clean),
                func.lower(AuditLog.action).contains(q_clean),
                func.lower(User.full_name).contains(q_clean),
                func.lower(User.email).contains(q_clean),
            )
        )

    logs = log_query.order_by(desc(AuditLog.created_at)).limit(limit).all()

    results: List[NurseAuditLogItem] = []
    for audit, user in logs:
        uname = user.full_name if user else "Ward Nurse"
        uemail = user.email if user else "nurse@hospital.org"
        results.append(
            NurseAuditLogItem(
                id=str(audit.id),
                timestamp=audit.created_at.isoformat() if audit.created_at else datetime.now(timezone.utc).isoformat(),
                nurse_name=uname,
                nurse_email=uemail,
                department_name="Inpatient Nursing Care",
                action=audit.action,
                details=audit.details or f"Action {audit.action} executed on {audit.resource_type}",
                resource_type=audit.resource_type,
            )
        )

    return results


@router.post("/supervisor/contact-admin")
def supervisor_contact_admin(
    payload: SupervisorContactAdminRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Enables Nursing Services Supervisor to dispatch an urgent escalation or administrative message to Hospital Administrators."""
    sender_name = emp_ctx.user.full_name or "Nursing Services Supervisor"

    notif = HospitalNotification(
        hospital_id=emp_ctx.hospital.id,
        title=f"Nursing Supervisor Alert: {payload.subject}",
        message=f"{sender_name} [{payload.priority}]: {payload.message}",
        category="escalation" if payload.priority in ("Urgent", "Critical") else "admin_notice",
        is_read=False,
    )
    db.add(notif)

    audit = AuditLog(
        hospital_id=emp_ctx.hospital.id,
        user_id=emp_ctx.user.id,
        action="CONTACT_ADMIN_DISPATCHED",
        resource_type="hospital_notification",
        resource_id=str(notif.id),
        details=f"Dispatched admin notice: '{payload.subject}' (Priority: {payload.priority})",
    )
    db.add(audit)
    db.commit()

    return {"status": "dispatched", "notification_id": str(notif.id), "message": "Administrative escalation dispatched successfully."}


# -----------------------------------------------------------------------------
# EMPLOYEE NOTIFICATIONS & CLINICAL ALERTS
# -----------------------------------------------------------------------------

@router.get("/notifications")
def get_employee_notifications(
    limit: int = 50,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve hospital notifications and clinical event alerts for active employees."""
    notifs = (
        db.query(HospitalNotification)
        .filter(HospitalNotification.hospital_id == emp_ctx.hospital.id)
        .order_by(desc(HospitalNotification.created_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(n.id),
            "title": n.title,
            "message": n.message,
            "category": n.category,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else datetime.now(timezone.utc).isoformat(),
        }
        for n in notifs
    ]


@router.post("/notifications/{notification_id}/read")
def mark_employee_notification_read(
    notification_id: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Mark a specific notification as read."""
    try:
        n_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID format.")
    notif = (
        db.query(HospitalNotification)
        .filter(
            HospitalNotification.id == n_uuid,
            HospitalNotification.hospital_id == emp_ctx.hospital.id,
        )
        .first()
    )
    if notif:
        notif.is_read = True
        db.commit()
    return {"status": "ok", "id": notification_id}


@router.post("/notifications/read-all")
def mark_all_employee_notifications_read(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Mark all notifications for this hospital as read."""
    db.query(HospitalNotification).filter(
        HospitalNotification.hospital_id == emp_ctx.hospital.id,
        HospitalNotification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"status": "ok"}




# -----------------------------------------------------------------------------
# DEPARTMENT HEAD CLINICAL WORKSPACE & EMPLOYEE GOVERNANCE
# -----------------------------------------------------------------------------

class DepartmentHeadDashboardSummaryResponse(BaseModel):
    department_id: str
    department_name: str
    department_code: Optional[str] = None
    registered_patients_count: int
    today_scheduled_count: int
    checked_in_count: int
    waiting_count: int
    in_consultation_count: int
    completed_today_count: int
    active_admissions_count: int
    department_staff_count: int
    pending_revocation_requests_count: int
    urgent_alerts_count: int


class DepartmentEmployeeItemResponse(BaseModel):
    id: str
    membership_id: str
    user_id: str
    employee_uid: str
    name: str
    email: str
    phone: Optional[str] = ""
    role_name: str
    role_code: str
    assignment_id: str
    scope_type: str
    is_revocation_eligible: bool
    departments: List[str] = []
    department_name: Optional[str] = None


class RevocationRequestCreatePayload(BaseModel):
    target_membership_id: str
    target_assignment_id: Optional[str] = None
    revocation_scope: str = "DEPARTMENT_ASSIGNMENT"
    reason: str
    supporting_details: Optional[str] = None


class RevocationRequestResponse(BaseModel):
    id: str
    hospital_id: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    requester_membership_id: str
    requester_name: str
    target_membership_id: str
    target_assignment_id: Optional[str] = None
    target_name: str
    target_employee_uid: str
    revocation_scope: str
    reason: str
    supporting_details: Optional[str] = None
    status: str
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[str] = None
    decision_notes: Optional[str] = None
    created_at: str


@router.get("/department-head/dashboard-summary", response_model=DepartmentHeadDashboardSummaryResponse)
def get_department_head_summary(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve operational summary for Department Head workspace, strictly scoped to their department."""
    _, role_code, dname, dept_id, _ = _get_active_assignment(emp_ctx, db)

    dept = None
    if dept_id:
        dept = db.query(Department).filter(Department.id == dept_id, Department.hospital_id == emp_ctx.hospital.id).first()
    if not dept:
        dept = db.query(Department).filter(Department.hospital_id == emp_ctx.hospital.id).first()
        if dept:
            dept_id = dept.id
            dname = dept.name

    if not dept_id:
        raise HTTPException(status_code=400, detail="No department associated with current assignment.")

    # 1. Registered Patients count in this department
    reg_patients_count = db.query(PatientRecord).filter(
        PatientRecord.hospital_id == emp_ctx.hospital.id,
        PatientRecord.department_id == dept_id,
    ).count()

    # 2. Appointments counts in this department
    appts = db.query(AppointmentRecord).filter(
        AppointmentRecord.hospital_id == emp_ctx.hospital.id,
        AppointmentRecord.department_id == dept_id,
    ).all()

    today_scheduled = len(appts)
    checked_in = sum(1 for a in appts if a.status.upper() in ("CHECKED_IN", "CHECKED-IN", "IN_CONSULTATION"))
    waiting = sum(1 for a in appts if a.status.upper() in ("SCHEDULED", "CHECKED_IN", "CHECKED-IN", "WAITING"))
    in_consultation = sum(1 for a in appts if a.status.upper() == "IN_CONSULTATION")
    completed_today = sum(1 for a in appts if a.status.upper() in ("COMPLETED", "CONCLUDED"))

    # 3. Active Admissions
    active_admissions = db.query(PatientRecord).filter(
        PatientRecord.hospital_id == emp_ctx.hospital.id,
        PatientRecord.department_id == dept_id,
        func.lower(PatientRecord.admission_status).in_(("admitted", "inpatient")),
    ).count()

    # 4. Department Staff count (doctors, nurses, staff assigned to this department, excluding dept_head/self)
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role

    staff_count = db.query(RoleAssignment.membership_id).join(
        TenantMembership, TenantMembership.id == RoleAssignment.membership_id
    ).join(
        Role, Role.id == RoleAssignment.role_id
    ).filter(
        TenantMembership.hospital_id == emp_ctx.hospital.id,
        TenantMembership.status == "active",
        TenantMembership.user_id != emp_ctx.user.id,
        RoleAssignment.is_active == True,
        RoleAssignment.department_id == dept_id,
        Role.code != "dept_head",
    ).distinct().count()

    # 5. Revocation requests count
    from app.models.revocation_request import EmployeeRevocationRequest
    pending_revocations = db.query(EmployeeRevocationRequest).filter(
        EmployeeRevocationRequest.hospital_id == emp_ctx.hospital.id,
        EmployeeRevocationRequest.department_id == dept_id,
        EmployeeRevocationRequest.status == "PENDING",
    ).count()

    # 6. Urgent alerts count
    urgent_alerts = db.query(HospitalNotification).filter(
        HospitalNotification.hospital_id == emp_ctx.hospital.id,
        HospitalNotification.is_read == False,
        HospitalNotification.category.in_(["urgent", "escalation", "critical"]),
    ).count()

    return DepartmentHeadDashboardSummaryResponse(
        department_id=str(dept_id),
        department_name=dname,
        department_code=dept.code if dept else None,
        registered_patients_count=reg_patients_count,
        today_scheduled_count=today_scheduled,
        checked_in_count=checked_in,
        waiting_count=waiting,
        in_consultation_count=in_consultation,
        completed_today_count=completed_today,
        active_admissions_count=active_admissions,
        department_staff_count=staff_count,
        pending_revocation_requests_count=pending_revocations,
        urgent_alerts_count=urgent_alerts,
    )


@router.get("/department-head/employees", response_model=List[DepartmentEmployeeItemResponse])
def get_department_employees(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve all active employees assigned to this department for staff oversight & access governance,
    including employees who hold assignments in multiple departments alongside this department."""
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role

    _, _, dname, dept_id, _ = _get_active_assignment(emp_ctx, db)
    if not dept_id:
        dept = db.query(Department).filter(Department.hospital_id == emp_ctx.hospital.id).first()
        if dept:
            dept_id = dept.id
            dname = dept.name
    if not dept_id:
        return []

    # 1. Find all memberships that have an active assignment in this department
    target_membership_ids = [
        m_id for (m_id,) in db.query(RoleAssignment.membership_id)
        .filter(
            RoleAssignment.is_active == True,
            RoleAssignment.assignment_status == "active",
            RoleAssignment.department_id == dept_id,
        )
        .distinct()
        .all()
    ]
    if not target_membership_ids:
        return []

    memberships = (
        db.query(TenantMembership, User)
        .join(User, User.id == TenantMembership.user_id)
        .filter(
            TenantMembership.id.in_(target_membership_ids),
            TenantMembership.hospital_id == emp_ctx.hospital.id,
            TenantMembership.status == "active",
        )
        .all()
    )

    results: List[DepartmentEmployeeItemResponse] = []
    for mem, usr in memberships:
        user_asgns = (
            db.query(RoleAssignment, Role, Department)
            .join(Role, Role.id == RoleAssignment.role_id)
            .outerjoin(Department, Department.id == RoleAssignment.department_id)
            .filter(
                RoleAssignment.membership_id == mem.id,
                RoleAssignment.is_active == True,
                RoleAssignment.assignment_status == "active",
            )
            .all()
        )

        roles_list: List[str] = []
        depts_list: List[str] = []
        primary_asgn = None

        for a, r, d in user_asgns:
            if r.name not in roles_list:
                roles_list.append(r.name)
            dept_label = d.name if d else "Hospital-Wide"
            if dept_label not in depts_list:
                depts_list.append(dept_label)
            if a.department_id == dept_id and not primary_asgn:
                primary_asgn = a

        if not primary_asgn and user_asgns:
            primary_asgn = user_asgns[0][0]

        is_revocation_eligible = (
            usr.id != emp_ctx.user.id
            and not any(r.code == "dept_head" for a, r, d in user_asgns if a.department_id == dept_id)
        )

        results.append(
            DepartmentEmployeeItemResponse(
                id=str(mem.id),
                membership_id=str(mem.id),
                user_id=str(usr.id),
                employee_uid=mem.employee_uid or "EMP-N/A",
                name=usr.full_name or usr.username,
                email=usr.email,
                phone="",
                role_name=", ".join(roles_list),
                role_code=primary_asgn.role.code if primary_asgn and primary_asgn.role else "dept_staff",
                assignment_id=str(primary_asgn.id) if primary_asgn else str(mem.id),
                scope_type=primary_asgn.scope_type if primary_asgn else "DEPARTMENT",
                is_revocation_eligible=is_revocation_eligible,
                departments=depts_list,
                department_name=", ".join(depts_list),
            )
        )
    return results


@router.post(
    "/department-head/revocation-requests",
    response_model=RevocationRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_department_head_revocation_request(
    payload: RevocationRequestCreatePayload,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Department Head submits an employee access revocation request to hospital administrators."""
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role
    from app.models.revocation_request import EmployeeRevocationRequest

    _, _, dname, dept_id, _ = _get_active_assignment(emp_ctx, db)

    try:
        target_mem_id = uuid.UUID(payload.target_membership_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid target membership ID format.")

    target_mem = db.query(TenantMembership).filter(
        TenantMembership.id == target_mem_id,
        TenantMembership.hospital_id == emp_ctx.hospital.id,
    ).first()
    if not target_mem:
        raise HTTPException(status_code=404, detail="Target employee membership not found in this hospital.")

    target_user = db.query(User).filter(User.id == target_mem.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user account not found.")

    if target_user.id == emp_ctx.user.id:
        raise HTTPException(status_code=400, detail="Department Head cannot submit a revocation request against themselves.")

    target_asgn_id = None
    if payload.target_assignment_id:
        try:
            target_asgn_id = uuid.UUID(payload.target_assignment_id)
        except ValueError:
            target_asgn_id = None

    target_name = target_user.full_name or target_user.username
    requester_name = emp_ctx.user.full_name or emp_ctx.user.username

    existing_pending = db.query(EmployeeRevocationRequest).filter(
        EmployeeRevocationRequest.hospital_id == emp_ctx.hospital.id,
        EmployeeRevocationRequest.target_membership_id == target_mem.id,
        EmployeeRevocationRequest.status == "PENDING",
    ).first()
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending revocation request already exists for this employee in this department.",
        )

    rev_req = EmployeeRevocationRequest(
        hospital_id=emp_ctx.hospital.id,
        department_id=dept_id,
        requester_membership_id=emp_ctx.membership.id,
        requester_user_id=emp_ctx.user.id,
        requester_name=requester_name,
        target_membership_id=target_mem.id,
        target_user_id=target_user.id,
        target_assignment_id=target_asgn_id,
        target_name=target_name,
        target_employee_uid=target_mem.employee_uid or "EMP-N/A",
        revocation_scope=payload.revocation_scope,
        reason=payload.reason.strip(),
        supporting_details=payload.supporting_details.strip() if payload.supporting_details else None,
        status="PENDING",
    )
    db.add(rev_req)

    notif = HospitalNotification(
        hospital_id=emp_ctx.hospital.id,
        title=f"Access Revocation Escalation: {target_name}",
        message=f"Department Head {requester_name} ({dname}) requested access revocation for {target_name} ({target_mem.employee_uid}). Reason: {payload.reason}",
        category="security",
        is_read=False,
    )
    db.add(notif)

    audit = AuditLog(
        hospital_id=emp_ctx.hospital.id,
        user_id=emp_ctx.user.id,
        action="REVOCATION_REQUEST_SUBMITTED",
        details=f"Revocation request submitted for {target_name} ({target_mem.employee_uid}) by {requester_name}. Reason: {payload.reason}",
        resource_type="employee_revocation_request",
    )
    db.add(audit)
    db.commit()
    db.refresh(rev_req)

    return RevocationRequestResponse(
        id=str(rev_req.id),
        hospital_id=str(rev_req.hospital_id),
        department_id=str(rev_req.department_id) if rev_req.department_id else None,
        department_name=dname,
        requester_membership_id=str(rev_req.requester_membership_id),
        requester_name=rev_req.requester_name,
        target_membership_id=str(rev_req.target_membership_id),
        target_assignment_id=str(rev_req.target_assignment_id) if rev_req.target_assignment_id else None,
        target_name=rev_req.target_name,
        target_employee_uid=rev_req.target_employee_uid,
        revocation_scope=rev_req.revocation_scope,
        reason=rev_req.reason,
        supporting_details=rev_req.supporting_details,
        status=rev_req.status,
        reviewer_name=rev_req.reviewer_name,
        reviewed_at=rev_req.reviewed_at.isoformat() if rev_req.reviewed_at else None,
        decision_notes=rev_req.decision_notes,
        created_at=rev_req.created_at.isoformat() if rev_req.created_at else datetime.now(timezone.utc).isoformat(),
    )


@router.get("/department-head/revocation-requests", response_model=List[RevocationRequestResponse])
def get_department_head_revocation_requests(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve all revocation requests submitted by or for this department."""
    from app.models.revocation_request import EmployeeRevocationRequest
    _, _, dname, dept_id, _ = _get_active_assignment(emp_ctx, db)

    query = db.query(EmployeeRevocationRequest, Department).outerjoin(
        Department, Department.id == EmployeeRevocationRequest.department_id
    ).filter(
        EmployeeRevocationRequest.hospital_id == emp_ctx.hospital.id,
    )
    if dept_id:
        query = query.filter(
            or_(
                EmployeeRevocationRequest.department_id == dept_id,
                EmployeeRevocationRequest.requester_user_id == emp_ctx.user.id,
            )
        )
    else:
        query = query.filter(EmployeeRevocationRequest.requester_user_id == emp_ctx.user.id)

    results = query.order_by(desc(EmployeeRevocationRequest.created_at)).all()

    return [
        RevocationRequestResponse(
            id=str(r.id),
            hospital_id=str(r.hospital_id),
            department_id=str(r.department_id) if r.department_id else None,
            department_name=dept.name if dept else dname,
            requester_membership_id=str(r.requester_membership_id),
            requester_name=r.requester_name,
            target_membership_id=str(r.target_membership_id),
            target_assignment_id=str(r.target_assignment_id) if r.target_assignment_id else None,
            target_name=r.target_name,
            target_employee_uid=r.target_employee_uid,
            revocation_scope=r.revocation_scope,
            reason=r.reason,
            supporting_details=r.supporting_details,
            status=r.status,
            reviewer_name=r.reviewer_name,
            reviewed_at=r.reviewed_at.isoformat() if r.reviewed_at else None,
            decision_notes=r.decision_notes,
            created_at=r.created_at.isoformat() if r.created_at else datetime.now(timezone.utc).isoformat(),
        )
        for r, dept in results
    ]


@router.post("/department-head/revocation-requests/{request_id}/cancel", response_model=RevocationRequestResponse)
def cancel_department_head_revocation_request(
    request_id: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Cancel a pending revocation request submitted by this Department Head."""
    from app.models.revocation_request import EmployeeRevocationRequest
    try:
        req_uuid = uuid.UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID format.")

    r = db.query(EmployeeRevocationRequest).filter(
        EmployeeRevocationRequest.id == req_uuid,
        EmployeeRevocationRequest.hospital_id == emp_ctx.hospital.id,
        EmployeeRevocationRequest.requester_user_id == emp_ctx.user.id,
    ).first()

    if not r:
        raise HTTPException(status_code=404, detail="Revocation request not found or unauthorized to cancel.")

    if r.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot cancel request in '{r.status}' state.")

    r.status = "CANCELLED"
    db.commit()
    db.refresh(r)

    return RevocationRequestResponse(
        id=str(r.id),
        hospital_id=str(r.hospital_id),
        department_id=str(r.department_id) if r.department_id else None,
        department_name=r.department.name if r.department else None,
        requester_membership_id=str(r.requester_membership_id),
        requester_name=r.requester_name,
        target_membership_id=str(r.target_membership_id),
        target_assignment_id=str(r.target_assignment_id) if r.target_assignment_id else None,
        target_name=r.target_name,
        target_employee_uid=r.target_employee_uid,
        revocation_scope=r.revocation_scope,
        reason=r.reason,
        supporting_details=r.supporting_details,
        status=r.status,
        reviewer_name=r.reviewer_name,
        reviewed_at=r.reviewed_at.isoformat() if r.reviewed_at else None,
        decision_notes=r.decision_notes,
        created_at=r.created_at.isoformat() if r.created_at else datetime.now(timezone.utc).isoformat(),
    )


# -----------------------------------------------------------------------------
# NURSING SERVICES SUPERVISOR WORKSPACE & CLINICAL OVERSIGHT
# -----------------------------------------------------------------------------

class CreateSupervisorShiftRequest(BaseModel):
    department_id: str
    shift_name: str
    nurse_name: str
    assigned_ward: str
    assigned_bed_count: int = 6
    shift_date: str
    status: str = "scheduled"
    nurse_id: Optional[str] = None


class UpdateSupervisorShiftRequest(BaseModel):
    department_id: Optional[str] = None
    shift_name: Optional[str] = None
    nurse_name: Optional[str] = None
    assigned_ward: Optional[str] = None
    assigned_bed_count: Optional[int] = None
    shift_date: Optional[str] = None
    status: Optional[str] = None
    nurse_id: Optional[str] = None


class NursingShiftItemResponse(BaseModel):
    id: str
    hospital_id: str
    department_id: str
    department_name: Optional[str] = None
    shift_name: str
    nurse_id: Optional[str] = None
    nurse_name: str
    assigned_ward: str
    assigned_bed_count: int
    status: str
    shift_date: str
    created_at: str
    updated_at: str


class NursingWorkforceItemResponse(BaseModel):
    id: str
    user_id: str
    employee_uid: str
    full_name: str
    email: str
    phone: Optional[str] = ""
    role_id: str
    role_code: str
    role_name: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    assignment_id: str
    assignment_status: str
    scope_type: str
    is_active: bool
    current_shift_status: str
    is_revocation_eligible: bool


class SupervisorPatientCensusItem(BaseModel):
    id: str
    mrn: str
    full_name: str
    age: int
    gender: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    bed_or_room: Optional[str] = None
    admission_status: str
    triage_category: str
    chief_complaint: Optional[str] = None
    attending_physician_name: Optional[str] = None
    latest_vital: Optional[VitalItemResponse] = None
    created_at: str


class SupervisorReportCoverage(BaseModel):
    total_shifts: int
    scheduled_count: int
    on_duty_count: int
    completed_count: int
    unfilled_count: int


class SupervisorReportTriage(BaseModel):
    critical: int
    urgent: int
    priority: int
    routine: int


class SupervisorDeptWorkforce(BaseModel):
    department_id: str
    department_name: str
    department_code: str
    active_nurses: int
    patient_census: int
    bed_capacity: int
    occupancy_rate: float
    nurse_to_patient_ratio: str


class SupervisorReportResponse(BaseModel):
    hospital_name: str
    hospital_uid: str
    generated_at: str
    total_nurses: int
    total_patients: int
    total_beds: int
    overall_occupancy_rate: float
    workforce_by_department: List[SupervisorDeptWorkforce]
    shift_coverage: SupervisorReportCoverage
    triage_breakdown: SupervisorReportTriage


class SupervisorNurseStaffItem(BaseModel):
    user_id: str
    name: str
    role_name: str
    employee_uid: str
    status: str


class SupervisorDepartmentOverviewItem(BaseModel):
    id: str
    name: str
    code: str
    bed_capacity: int
    patient_census: int
    occupancy_rate: float
    nurse_count: int
    nurses: List[SupervisorNurseStaffItem]


class SupervisorDashboardSummaryResponse(BaseModel):
    facility_name: str
    facility_uid: str
    total_active_nurses: int
    departments_count: int
    admitted_patients_count: int
    scheduled_shifts_today: int
    on_duty_nurses_count: int
    unfilled_shifts_count: int
    critical_patients_count: int
    pending_nursing_tasks: int
    pending_revocations_count: int
    department_distribution: List[DepartmentCoverageItem]


@router.get("/supervisor/patient-census", response_model=List[SupervisorPatientCensusItem])
def get_supervisor_patient_census(
    department_id: Optional[str] = None,
    admission_status: Optional[str] = None,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve hospital-wide patient census for Nursing Supervisor with clinical notes redacted."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="patient:read"
    )
    query = db.query(PatientRecord).filter(PatientRecord.hospital_id == emp_ctx.hospital.id)
    if department_id and department_id != "all":
        try:
            d_uuid = uuid.UUID(department_id)
            query = query.filter(PatientRecord.department_id == d_uuid)
        except ValueError:
            pass
    if admission_status and admission_status != "all":
        query = query.filter(func.lower(PatientRecord.admission_status) == admission_status.lower())

    patients = query.order_by(desc(PatientRecord.created_at)).all()

    vitals_map: Dict[uuid.UUID, PatientVitalRecord] = {}
    if patients:
        p_ids = [p.id for p in patients]
        all_vitals = (
            db.query(PatientVitalRecord)
            .filter(PatientVitalRecord.patient_id.in_(p_ids))
            .order_by(desc(PatientVitalRecord.recorded_at))
            .all()
        )
        for v in all_vitals:
            if v.patient_id not in vitals_map:
                vitals_map[v.patient_id] = v

    results: List[SupervisorPatientCensusItem] = []
    for p in patients:
        v_rec = vitals_map.get(p.id)
        v_resp = None
        if v_rec:
            v_resp = VitalItemResponse(
                id=str(v_rec.id),
                bp=v_rec.bp,
                heart_rate=v_rec.heart_rate,
                temperature=v_rec.temperature,
                spo2=v_rec.spo2,
                respiratory_rate=v_rec.respiratory_rate,
                blood_glucose=v_rec.blood_glucose,
                recorded_by_name=v_rec.recorded_by_name,
                recorded_at=v_rec.recorded_at.isoformat(),
            )
        results.append(
            SupervisorPatientCensusItem(
                id=str(p.id),
                mrn=p.mrn,
                full_name=p.full_name,
                age=p.age,
                gender=p.gender,
                department_id=str(p.department_id) if p.department_id else None,
                department_name=p.department.name if p.department else "Hospital-Wide",
                bed_or_room=p.bed_or_room or "Ward Bed",
                admission_status=p.admission_status,
                triage_category=p.triage_category,
                chief_complaint=p.chief_complaint,
                attending_physician_name=p.attending_physician_name or "Attending Physician",
                latest_vital=v_resp,
                created_at=p.created_at.isoformat() if p.created_at else datetime.now(timezone.utc).isoformat(),
            )
        )
    return results


@router.get("/supervisor/nursing-workforce", response_model=List[NursingWorkforceItemResponse])
def get_supervisor_nursing_workforce(
    query: Optional[str] = None,
    department_id: Optional[str] = None,
    role_code: Optional[str] = None,
    status: Optional[str] = None,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve nursing workforce directory strictly excluding doctors, receptionists, and administrators."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="employee:read"
    )
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role

    db_query = (
        db.query(TenantMembership, RoleAssignment, Role, User, Department)
        .join(RoleAssignment, RoleAssignment.membership_id == TenantMembership.id)
        .join(Role, Role.id == RoleAssignment.role_id)
        .join(User, User.id == TenantMembership.user_id)
        .outerjoin(Department, Department.id == RoleAssignment.department_id)
        .filter(
            TenantMembership.hospital_id == emp_ctx.hospital.id,
            TenantMembership.status == "active",
            RoleAssignment.is_active == True,
            or_(
                func.lower(Role.code).contains("nurse"),
                func.lower(Role.name).contains("nurse"),
            ),
            ~func.lower(Role.code).in_(["doctor", "receptionist", "hospital_admin", "purchaser"]),
        )
    )

    if department_id and department_id != "all":
        try:
            d_uuid = uuid.UUID(department_id)
            db_query = db_query.filter(RoleAssignment.department_id == d_uuid)
        except ValueError:
            pass

    if role_code and role_code != "all":
        db_query = db_query.filter(func.lower(Role.code) == role_code.lower())

    if status and status != "all":
        db_query = db_query.filter(RoleAssignment.assignment_status == status)

    if query:
        q_clean = f"%{query.strip().lower()}%"
        db_query = db_query.filter(
            or_(
                func.lower(User.full_name).contains(q_clean),
                func.lower(User.username).contains(q_clean),
                func.lower(User.email).contains(q_clean),
                func.lower(TenantMembership.employee_uid).contains(q_clean),
            )
        )

    rows = db_query.order_by(User.full_name.asc()).all()

    today_str = datetime.now().strftime("%Y-%m-%d")
    nurse_shifts = db.query(NursingShiftRecord).filter(
        NursingShiftRecord.hospital_id == emp_ctx.hospital.id,
        NursingShiftRecord.shift_date == today_str,
    ).all()
    shift_status_map = {s.nurse_id: s.status for s in nurse_shifts if s.nurse_id}
    shift_name_status_map = {s.nurse_name.lower(): s.status for s in nurse_shifts if s.nurse_name}

    results: List[NursingWorkforceItemResponse] = []
    seen = set()
    for mem, assign, role, user, dept in rows:
        key = (user.id, assign.id)
        if key in seen:
            continue
        seen.add(key)

        is_self = (user.id == emp_ctx.user.id or mem.id == emp_ctx.membership.id)
        current_status = shift_status_map.get(user.id) or shift_name_status_map.get(user.full_name.lower() if user.full_name else "") or "off_duty"

        results.append(
            NursingWorkforceItemResponse(
                id=str(mem.id),
                user_id=str(user.id),
                employee_uid=mem.employee_uid,
                full_name=user.full_name or user.username,
                email=user.email,
                phone=getattr(user, "phone", "") or "",
                role_id=str(role.id),
                role_code=role.code,
                role_name=role.name,
                department_id=str(dept.id) if dept else None,
                department_name=dept.name if dept else "Hospital-Wide",
                assignment_id=str(assign.id),
                assignment_status=assign.assignment_status or "active",
                scope_type=assign.scope_type or "DEPARTMENT",
                is_active=assign.is_active,
                current_shift_status=current_status,
                is_revocation_eligible=not is_self,
            )
        )

    return results


@router.post("/supervisor/revocation-requests", response_model=RevocationRequestResponse, status_code=status.HTTP_201_CREATED)
def create_supervisor_revocation_request(
    payload: RevocationRequestCreatePayload,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Nursing Supervisor submits an access revocation escalation request for subordinate nursing personnel."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="employee:access:revoke:request"
    )
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.revocation_request import EmployeeRevocationRequest

    try:
        target_mem_uuid = uuid.UUID(payload.target_membership_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid target membership ID format.")

    if target_mem_uuid == emp_ctx.membership.id:
        raise HTTPException(status_code=400, detail="Employees cannot submit an access revocation request against themselves.")

    target_mem = db.query(TenantMembership).filter(
        TenantMembership.id == target_mem_uuid,
        TenantMembership.hospital_id == emp_ctx.hospital.id,
    ).first()
    if not target_mem:
        raise HTTPException(status_code=404, detail="Target employee membership not found.")

    if target_mem.user_id == emp_ctx.user.id:
        raise HTTPException(status_code=400, detail="Employees cannot submit an access revocation request against themselves.")

    target_user = db.query(User).filter(User.id == target_mem.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user account not found.")

    target_asgn_id = None
    target_dept_id = None
    if payload.target_assignment_id:
        try:
            target_asgn_id = uuid.UUID(payload.target_assignment_id)
            asgn = db.query(RoleAssignment).filter(
                RoleAssignment.id == target_asgn_id,
                RoleAssignment.membership_id == target_mem.id,
            ).first()
            if asgn:
                target_dept_id = asgn.department_id
        except ValueError:
            target_asgn_id = None

    if not target_dept_id:
        first_asgn = db.query(RoleAssignment).filter(
            RoleAssignment.membership_id == target_mem.id,
            RoleAssignment.is_active == True,
        ).first()
        if first_asgn:
            target_asgn_id = target_asgn_id or first_asgn.id
            target_dept_id = first_asgn.department_id

    # Duplicate check: check if an existing PENDING revocation request is already registered
    existing_pending = db.query(EmployeeRevocationRequest).filter(
        EmployeeRevocationRequest.hospital_id == emp_ctx.hospital.id,
        EmployeeRevocationRequest.target_membership_id == target_mem.id,
        EmployeeRevocationRequest.status == "PENDING",
    ).first()
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A pending access revocation escalation already exists for {target_user.full_name or target_user.username}.",
        )

    requester_name = emp_ctx.user.full_name or emp_ctx.user.username
    target_name = target_user.full_name or target_user.username

    rev_req = EmployeeRevocationRequest(
        hospital_id=emp_ctx.hospital.id,
        department_id=target_dept_id,
        requester_membership_id=emp_ctx.membership.id,
        requester_user_id=emp_ctx.user.id,
        requester_name=requester_name,
        target_membership_id=target_mem.id,
        target_user_id=target_user.id,
        target_assignment_id=target_asgn_id,
        target_name=target_name,
        target_employee_uid=target_mem.employee_uid or "EMP-N/A",
        revocation_scope=payload.revocation_scope,
        reason=payload.reason.strip(),
        supporting_details=payload.supporting_details.strip() if payload.supporting_details else None,
        status="PENDING",
    )
    db.add(rev_req)

    notif = HospitalNotification(
        hospital_id=emp_ctx.hospital.id,
        title=f"Access Revocation Escalation: {target_name}",
        message=f"Nursing Supervisor {requester_name} requested access revocation for {target_name} ({target_mem.employee_uid}). Reason: {payload.reason}",
        category="security",
        is_read=False,
    )
    db.add(notif)

    audit = AuditLog(
        hospital_id=emp_ctx.hospital.id,
        user_id=emp_ctx.user.id,
        action="REVOCATION_REQUEST_SUBMITTED",
        details=f"Revocation request submitted for {target_name} ({target_mem.employee_uid}) by {requester_name}. Reason: {payload.reason}",
        resource_type="employee_revocation_request",
    )
    db.add(audit)
    db.commit()
    db.refresh(rev_req)

    dept_name = None
    if target_dept_id:
        d = db.query(Department).filter(Department.id == target_dept_id).first()
        if d:
            dept_name = d.name

    return RevocationRequestResponse(
        id=str(rev_req.id),
        hospital_id=str(rev_req.hospital_id),
        department_id=str(rev_req.department_id) if rev_req.department_id else None,
        department_name=dept_name,
        requester_membership_id=str(rev_req.requester_membership_id),
        requester_name=rev_req.requester_name,
        target_membership_id=str(rev_req.target_membership_id),
        target_assignment_id=str(rev_req.target_assignment_id) if rev_req.target_assignment_id else None,
        target_name=rev_req.target_name,
        target_employee_uid=rev_req.target_employee_uid,
        revocation_scope=rev_req.revocation_scope,
        reason=rev_req.reason,
        supporting_details=rev_req.supporting_details,
        status=rev_req.status,
        reviewer_name=rev_req.reviewer_name,
        reviewed_at=rev_req.reviewed_at.isoformat() if rev_req.reviewed_at else None,
        decision_notes=rev_req.decision_notes,
        created_at=rev_req.created_at.isoformat() if rev_req.created_at else datetime.now(timezone.utc).isoformat(),
    )


@router.get("/supervisor/revocation-requests", response_model=List[RevocationRequestResponse])
def get_supervisor_revocation_requests(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve revocation requests submitted by or accessible to Nursing Supervisor."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="employee:access:revoke:request"
    )
    from app.models.revocation_request import EmployeeRevocationRequest

    results = (
        db.query(EmployeeRevocationRequest, Department)
        .outerjoin(Department, Department.id == EmployeeRevocationRequest.department_id)
        .filter(
            EmployeeRevocationRequest.hospital_id == emp_ctx.hospital.id,
            EmployeeRevocationRequest.requester_user_id == emp_ctx.user.id,
        )
        .order_by(desc(EmployeeRevocationRequest.created_at))
        .all()
    )

    return [
        RevocationRequestResponse(
            id=str(r.id),
            hospital_id=str(r.hospital_id),
            department_id=str(r.department_id) if r.department_id else None,
            department_name=dept.name if dept else None,
            requester_membership_id=str(r.requester_membership_id),
            requester_name=r.requester_name,
            target_membership_id=str(r.target_membership_id),
            target_assignment_id=str(r.target_assignment_id) if r.target_assignment_id else None,
            target_name=r.target_name,
            target_employee_uid=r.target_employee_uid,
            revocation_scope=r.revocation_scope,
            reason=r.reason,
            supporting_details=r.supporting_details,
            status=r.status,
            reviewer_name=r.reviewer_name,
            reviewed_at=r.reviewed_at.isoformat() if r.reviewed_at else None,
            decision_notes=r.decision_notes,
            created_at=r.created_at.isoformat() if r.created_at else datetime.now(timezone.utc).isoformat(),
        )
        for r, dept in results
    ]


@router.post("/supervisor/revocation-requests/{request_id}/cancel", response_model=RevocationRequestResponse)
def cancel_supervisor_revocation_request(
    request_id: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Cancel a pending revocation request submitted by this Nursing Supervisor."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="employee:access:revoke:request"
    )
    from app.models.revocation_request import EmployeeRevocationRequest
    try:
        req_uuid = uuid.UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID format.")

    r = db.query(EmployeeRevocationRequest).filter(
        EmployeeRevocationRequest.id == req_uuid,
        EmployeeRevocationRequest.hospital_id == emp_ctx.hospital.id,
        EmployeeRevocationRequest.requester_user_id == emp_ctx.user.id,
    ).first()

    if not r:
        raise HTTPException(status_code=404, detail="Revocation request not found or unauthorized to cancel.")

    if r.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot cancel request in '{r.status}' state.")

    r.status = "CANCELLED"
    db.commit()
    db.refresh(r)

    return RevocationRequestResponse(
        id=str(r.id),
        hospital_id=str(r.hospital_id),
        department_id=str(r.department_id) if r.department_id else None,
        department_name=r.department.name if r.department else None,
        requester_membership_id=str(r.requester_membership_id),
        requester_name=r.requester_name,
        target_membership_id=str(r.target_membership_id),
        target_assignment_id=str(r.target_assignment_id) if r.target_assignment_id else None,
        target_name=r.target_name,
        target_employee_uid=r.target_employee_uid,
        revocation_scope=r.revocation_scope,
        reason=r.reason,
        supporting_details=r.supporting_details,
        status=r.status,
        reviewer_name=r.reviewer_name,
        reviewed_at=r.reviewed_at.isoformat() if r.reviewed_at else None,
        decision_notes=r.decision_notes,
        created_at=r.created_at.isoformat() if r.created_at else datetime.now(timezone.utc).isoformat(),
    )


@router.post("/supervisor/shifts", response_model=NursingShiftItemResponse, status_code=status.HTTP_201_CREATED)
def create_supervisor_shift(
    payload: CreateSupervisorShiftRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Schedule a nursing shift for a nurse employee."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="shift:manage"
    )
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role

    try:
        dept_uuid = uuid.UUID(payload.department_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid department ID format.")

    dept = db.query(Department).filter(
        Department.id == dept_uuid,
        Department.hospital_id == emp_ctx.hospital.id,
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    nurse_user_uuid = None
    if payload.nurse_id:
        try:
            nurse_user_uuid = uuid.UUID(payload.nurse_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid nurse ID format.")

        nurse_roles = (
            db.query(Role.code, Role.name)
            .join(RoleAssignment, RoleAssignment.role_id == Role.id)
            .join(TenantMembership, TenantMembership.id == RoleAssignment.membership_id)
            .filter(
                TenantMembership.hospital_id == emp_ctx.hospital.id,
                TenantMembership.user_id == nurse_user_uuid,
                RoleAssignment.is_active == True,
            )
            .all()
        )
        is_nurse = any("nurse" in (r[0] or "").lower() or "nurse" in (r[1] or "").lower() for r in nurse_roles)
        if not is_nurse:
            raise HTTPException(status_code=400, detail="Cannot schedule non-nursing personnel for a nursing shift.")
    elif payload.nurse_name:
        candidate_user = (
            db.query(User)
            .join(TenantMembership, TenantMembership.user_id == User.id)
            .filter(
                TenantMembership.hospital_id == emp_ctx.hospital.id,
                or_(
                    User.full_name == payload.nurse_name,
                    User.username == payload.nurse_name,
                ),
            )
            .first()
        )
        if candidate_user:
            roles = (
                db.query(Role.code, Role.name)
                .join(RoleAssignment, RoleAssignment.role_id == Role.id)
                .join(TenantMembership, TenantMembership.id == RoleAssignment.membership_id)
                .filter(
                    TenantMembership.hospital_id == emp_ctx.hospital.id,
                    TenantMembership.user_id == candidate_user.id,
                    RoleAssignment.is_active == True,
                )
                .all()
            )
            if roles and not any("nurse" in (r[0] or "").lower() or "nurse" in (r[1] or "").lower() for r in roles):
                raise HTTPException(status_code=400, detail="Cannot schedule non-nursing personnel for a nursing shift.")
            nurse_user_uuid = candidate_user.id

    # Conflict check
    conflict = (
        db.query(NursingShiftRecord)
        .filter(
            NursingShiftRecord.hospital_id == emp_ctx.hospital.id,
            NursingShiftRecord.shift_date == payload.shift_date,
            NursingShiftRecord.shift_name == payload.shift_name,
            or_(
                NursingShiftRecord.nurse_name == payload.nurse_name,
                NursingShiftRecord.nurse_id == nurse_user_uuid if nurse_user_uuid else False,
            ),
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Nurse '{payload.nurse_name}' is already assigned to {payload.shift_name} on {payload.shift_date}.",
        )

    shift = NursingShiftRecord(
        hospital_id=emp_ctx.hospital.id,
        department_id=dept_uuid,
        shift_name=payload.shift_name,
        nurse_id=nurse_user_uuid,
        nurse_name=payload.nurse_name,
        assigned_ward=payload.assigned_ward,
        assigned_bed_count=payload.assigned_bed_count,
        status=payload.status,
        shift_date=payload.shift_date,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)

    return NursingShiftItemResponse(
        id=str(shift.id),
        hospital_id=str(shift.hospital_id),
        department_id=str(shift.department_id),
        department_name=dept.name,
        shift_name=shift.shift_name,
        nurse_id=str(shift.nurse_id) if shift.nurse_id else None,
        nurse_name=shift.nurse_name,
        assigned_ward=shift.assigned_ward,
        assigned_bed_count=shift.assigned_bed_count,
        status=shift.status,
        shift_date=shift.shift_date,
        created_at=shift.created_at.isoformat() if shift.created_at else datetime.now(timezone.utc).isoformat(),
        updated_at=shift.updated_at.isoformat() if shift.updated_at else datetime.now(timezone.utc).isoformat(),
    )


@router.get("/supervisor/shifts", response_model=List[NursingShiftItemResponse])
def get_supervisor_shifts(
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    department_id: Optional[str] = None,
    nurse_id: Optional[str] = None,
    status: Optional[str] = None,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve nursing shifts filterable by date range, department, and nurse."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="shift:read"
    )
    query = (
        db.query(NursingShiftRecord, Department)
        .join(Department, Department.id == NursingShiftRecord.department_id)
        .filter(NursingShiftRecord.hospital_id == emp_ctx.hospital.id)
    )

    if date:
        query = query.filter(NursingShiftRecord.shift_date == date)
    if start_date:
        query = query.filter(NursingShiftRecord.shift_date >= start_date)
    if end_date:
        query = query.filter(NursingShiftRecord.shift_date <= end_date)
    if department_id and department_id != "all":
        try:
            d_uuid = uuid.UUID(department_id)
            query = query.filter(NursingShiftRecord.department_id == d_uuid)
        except ValueError:
            pass
    if nurse_id:
        try:
            n_uuid = uuid.UUID(nurse_id)
            query = query.filter(NursingShiftRecord.nurse_id == n_uuid)
        except ValueError:
            pass
    if status and status != "all":
        query = query.filter(NursingShiftRecord.status == status)

    shifts = query.order_by(NursingShiftRecord.shift_date.desc(), NursingShiftRecord.created_at.desc()).all()

    return [
        NursingShiftItemResponse(
            id=str(s.id),
            hospital_id=str(s.hospital_id),
            department_id=str(s.department_id),
            department_name=dept.name if dept else None,
            shift_name=s.shift_name,
            nurse_id=str(s.nurse_id) if s.nurse_id else None,
            nurse_name=s.nurse_name,
            assigned_ward=s.assigned_ward,
            assigned_bed_count=s.assigned_bed_count,
            status=s.status,
            shift_date=s.shift_date,
            created_at=s.created_at.isoformat() if s.created_at else datetime.now(timezone.utc).isoformat(),
            updated_at=s.updated_at.isoformat() if s.updated_at else datetime.now(timezone.utc).isoformat(),
        )
        for s, dept in shifts
    ]


@router.put("/supervisor/shifts/{shift_id}", response_model=NursingShiftItemResponse)
def update_supervisor_shift(
    shift_id: str,
    payload: UpdateSupervisorShiftRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Modify details or on-duty status of a scheduled nursing shift."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="shift:manage"
    )
    try:
        s_uuid = uuid.UUID(shift_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid shift ID format.")

    shift = db.query(NursingShiftRecord).filter(
        NursingShiftRecord.id == s_uuid,
        NursingShiftRecord.hospital_id == emp_ctx.hospital.id,
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Nursing shift record not found.")

    if payload.department_id:
        try:
            shift.department_id = uuid.UUID(payload.department_id)
        except ValueError:
            pass
    if payload.shift_name is not None:
        shift.shift_name = payload.shift_name
    if payload.nurse_name is not None:
        shift.nurse_name = payload.nurse_name
    if payload.nurse_id is not None:
        try:
            shift.nurse_id = uuid.UUID(payload.nurse_id)
        except ValueError:
            pass
    if payload.assigned_ward is not None:
        shift.assigned_ward = payload.assigned_ward
    if payload.assigned_bed_count is not None:
        shift.assigned_bed_count = payload.assigned_bed_count
    if payload.shift_date is not None:
        shift.shift_date = payload.shift_date
    if payload.status is not None:
        shift.status = payload.status

    db.commit()
    db.refresh(shift)

    dept_name = None
    if shift.department:
        dept_name = shift.department.name

    return NursingShiftItemResponse(
        id=str(shift.id),
        hospital_id=str(shift.hospital_id),
        department_id=str(shift.department_id),
        department_name=dept_name,
        shift_name=shift.shift_name,
        nurse_id=str(shift.nurse_id) if shift.nurse_id else None,
        nurse_name=shift.nurse_name,
        assigned_ward=shift.assigned_ward,
        assigned_bed_count=shift.assigned_bed_count,
        status=shift.status,
        shift_date=shift.shift_date,
        created_at=shift.created_at.isoformat() if shift.created_at else datetime.now(timezone.utc).isoformat(),
        updated_at=shift.updated_at.isoformat() if shift.updated_at else datetime.now(timezone.utc).isoformat(),
    )


@router.delete("/supervisor/shifts/{shift_id}")
def delete_supervisor_shift(
    shift_id: str,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Cancel or remove a nursing shift assignment."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="shift:manage"
    )
    try:
        s_uuid = uuid.UUID(shift_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid shift ID format.")

    shift = db.query(NursingShiftRecord).filter(
        NursingShiftRecord.id == s_uuid,
        NursingShiftRecord.hospital_id == emp_ctx.hospital.id,
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Nursing shift record not found.")

    db.delete(shift)
    db.commit()

    return {"success": True, "message": "Nursing shift cancelled successfully."}


@router.get("/supervisor/reports", response_model=SupervisorReportResponse)
def get_supervisor_reports(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Authoritative nursing and patient census operational reports."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="reports:read"
    )
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role

    depts = db.query(Department).filter(Department.hospital_id == emp_ctx.hospital.id).all()
    dept_bed_capacities = {
        "GEN-MED": 30,
        "EMERG": 20,
        "CARDIO": 16,
        "PEDS": 18,
        "RAD": 8,
        "PATH": 6,
        "OPD": 12,
        "DISP": 4,
    }

    dept_workforce: List[SupervisorDeptWorkforce] = []
    total_beds = 0
    total_patients = 0

    for d in depts:
        cap = dept_bed_capacities.get(d.code, 15)
        total_beds += cap

        p_count = (
            db.query(func.count(PatientRecord.id))
            .filter(
                PatientRecord.hospital_id == emp_ctx.hospital.id,
                PatientRecord.department_id == d.id,
            )
            .scalar()
            or 0
        )
        total_patients += p_count

        assigned_nurses = (
            db.query(func.count(TenantMembership.id))
            .join(RoleAssignment, RoleAssignment.membership_id == TenantMembership.id)
            .join(Role, Role.id == RoleAssignment.role_id)
            .filter(
                TenantMembership.hospital_id == emp_ctx.hospital.id,
                TenantMembership.status == "active",
                RoleAssignment.department_id == d.id,
                RoleAssignment.is_active == True,
                or_(
                    func.lower(Role.code).contains("nurse"),
                    func.lower(Role.name).contains("nurse"),
                ),
                ~func.lower(Role.code).in_(["doctor", "receptionist", "hospital_admin", "purchaser"]),
            )
            .scalar()
            or 0
        )

        occ_rate = round((p_count / cap) * 100, 1) if cap > 0 else 0.0
        if assigned_nurses == 0 and p_count > 0:
            ratio = "1:0"
        elif assigned_nurses > 0:
            ratio = f"1:{max(1, p_count // assigned_nurses)}"
        else:
            ratio = "0:0"

        dept_workforce.append(
            SupervisorDeptWorkforce(
                department_id=str(d.id),
                department_name=d.name,
                department_code=d.code,
                active_nurses=assigned_nurses,
                patient_census=p_count,
                bed_capacity=cap,
                occupancy_rate=occ_rate,
                nurse_to_patient_ratio=ratio,
            )
        )

    # Facility-wide nurse count
    total_nurses = (
        db.query(func.count(TenantMembership.id))
        .join(RoleAssignment, RoleAssignment.membership_id == TenantMembership.id)
        .join(Role, Role.id == RoleAssignment.role_id)
        .filter(
            TenantMembership.hospital_id == emp_ctx.hospital.id,
            TenantMembership.status == "active",
            RoleAssignment.is_active == True,
            or_(
                func.lower(Role.code).contains("nurse"),
                func.lower(Role.name).contains("nurse"),
            ),
            ~func.lower(Role.code).in_(["doctor", "receptionist", "hospital_admin", "purchaser"]),
        )
        .scalar()
        or 0
    )

    overall_occ = round((total_patients / total_beds) * 100, 1) if total_beds > 0 else 0.0

    today_str = datetime.now().strftime("%Y-%m-%d")
    today_shifts = (
        db.query(NursingShiftRecord)
        .filter(
            NursingShiftRecord.hospital_id == emp_ctx.hospital.id,
            NursingShiftRecord.shift_date == today_str,
        )
        .all()
    )
    total_shifts_count = len(today_shifts)
    sched_count = sum(1 for s in today_shifts if s.status == "scheduled")
    on_duty_count = sum(1 for s in today_shifts if s.status == "on_duty")
    comp_count = sum(1 for s in today_shifts if s.status == "completed")
    unfilled = max(0, total_nurses - on_duty_count - sched_count)

    patients = db.query(PatientRecord.triage_category).filter(
        PatientRecord.hospital_id == emp_ctx.hospital.id
    ).all()
    crit = sum(1 for (tc,) in patients if tc and tc.lower() == "critical")
    urg = sum(1 for (tc,) in patients if tc and tc.lower() == "urgent")
    prio = sum(1 for (tc,) in patients if tc and tc.lower() == "priority")
    rout = sum(1 for (tc,) in patients if tc and tc.lower() in ("routine", "normal routine", "routine general consultation"))
    rout = rout if (crit + urg + prio + rout) > 0 else len(patients)

    return SupervisorReportResponse(
        hospital_name=emp_ctx.hospital.name,
        hospital_uid=emp_ctx.hospital.hospital_uid,
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_nurses=total_nurses,
        total_patients=total_patients,
        total_beds=total_beds,
        overall_occupancy_rate=overall_occ,
        workforce_by_department=dept_workforce,
        shift_coverage=SupervisorReportCoverage(
            total_shifts=total_shifts_count,
            scheduled_count=sched_count,
            on_duty_count=on_duty_count,
            completed_count=comp_count,
            unfilled_count=unfilled,
        ),
        triage_breakdown=SupervisorReportTriage(
            critical=crit,
            urgent=urg,
            priority=prio,
            routine=rout,
        ),
    )


@router.get("/supervisor/departments-overview", response_model=List[SupervisorDepartmentOverviewItem])
def get_supervisor_departments_overview(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve departments overview with bed capacity, occupancy, and active nurse rosters."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="department:read"
    )
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role

    depts = (
        db.query(Department)
        .filter(Department.hospital_id == emp_ctx.hospital.id)
        .order_by(Department.name.asc())
        .all()
    )

    dept_bed_capacities = {
        "GEN-MED": 30,
        "EMERG": 20,
        "CARDIO": 16,
        "PEDS": 18,
        "RAD": 8,
        "PATH": 6,
        "OPD": 12,
        "DISP": 4,
    }

    nurse_assignments = (
        db.query(TenantMembership, RoleAssignment, Role, User, Department)
        .join(RoleAssignment, RoleAssignment.membership_id == TenantMembership.id)
        .join(Role, Role.id == RoleAssignment.role_id)
        .join(User, User.id == TenantMembership.user_id)
        .outerjoin(Department, Department.id == RoleAssignment.department_id)
        .filter(
            TenantMembership.hospital_id == emp_ctx.hospital.id,
            TenantMembership.status == "active",
            RoleAssignment.is_active == True,
            or_(
                func.lower(Role.code).contains("nurse"),
                func.lower(Role.name).contains("nurse"),
            ),
            ~func.lower(Role.code).in_(["doctor", "receptionist", "hospital_admin", "purchaser"]),
        )
        .all()
    )

    nurses_by_dept: Dict[uuid.UUID, List[SupervisorNurseStaffItem]] = {}
    for mem, assign, role, user, dept in nurse_assignments:
        d_id = assign.department_id or (dept.id if dept else None)
        if d_id:
            nurses_by_dept.setdefault(d_id, []).append(
                SupervisorNurseStaffItem(
                    user_id=str(user.id),
                    name=user.full_name or user.username,
                    role_name=role.name,
                    employee_uid=mem.employee_uid,
                    status="active" if mem.status == "active" else mem.status,
                )
            )

    results: List[SupervisorDepartmentOverviewItem] = []
    for d in depts:
        cap = dept_bed_capacities.get(d.code, 15)
        p_count = (
            db.query(func.count(PatientRecord.id))
            .filter(
                PatientRecord.hospital_id == emp_ctx.hospital.id,
                PatientRecord.department_id == d.id,
            )
            .scalar()
            or 0
        )
        occ_rate = round((p_count / cap) * 100, 1) if cap > 0 else 0.0
        dept_nurses = nurses_by_dept.get(d.id, [])

        results.append(
            SupervisorDepartmentOverviewItem(
                id=str(d.id),
                name=d.name,
                code=d.code,
                bed_capacity=cap,
                patient_census=p_count,
                occupancy_rate=occ_rate,
                nurse_count=len(dept_nurses),
                nurses=dept_nurses,
            )
        )

    return results


@router.get("/supervisor/dashboard-summary", response_model=SupervisorDashboardSummaryResponse)
def get_supervisor_dashboard_summary(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieve comprehensive command-center operational metrics for Nursing Services Supervisor."""
    AuthorizationService.authorize_employee(
        db, emp_ctx.user.id, emp_ctx.hospital.id, required_permission="patient:read"
    )
    from app.models.membership import TenantMembership
    from app.models.assignment import RoleAssignment
    from app.models.role import Role
    from app.models.revocation_request import EmployeeRevocationRequest

    depts = db.query(Department).filter(Department.hospital_id == emp_ctx.hospital.id).all()
    dept_bed_capacities = {
        "GEN-MED": 30,
        "EMERG": 20,
        "CARDIO": 16,
        "PEDS": 18,
        "RAD": 8,
        "PATH": 6,
        "OPD": 12,
        "DISP": 4,
    }

    dept_items: List[DepartmentCoverageItem] = []
    total_census = 0
    total_beds = 0
    total_critical = 0

    for d in depts:
        cap = dept_bed_capacities.get(d.code, 15)
        total_beds += cap

        p_count = (
            db.query(func.count(PatientRecord.id))
            .filter(
                PatientRecord.hospital_id == emp_ctx.hospital.id,
                PatientRecord.department_id == d.id,
            )
            .scalar()
            or 0
        )
        total_census += p_count

        crit_count = (
            db.query(func.count(PatientRecord.id))
            .filter(
                PatientRecord.hospital_id == emp_ctx.hospital.id,
                PatientRecord.department_id == d.id,
                PatientRecord.triage_category.in_(["Critical", "Urgent"]),
            )
            .scalar()
            or 0
        )
        total_critical += crit_count

        task_count = (
            db.query(func.count(NursingTaskRecord.id))
            .filter(
                NursingTaskRecord.hospital_id == emp_ctx.hospital.id,
                NursingTaskRecord.department_id == d.id,
                NursingTaskRecord.is_completed == False,
            )
            .scalar()
            or 0
        )

        assigned_nurses = (
            db.query(func.count(TenantMembership.id))
            .join(RoleAssignment, RoleAssignment.membership_id == TenantMembership.id)
            .join(Role, Role.id == RoleAssignment.role_id)
            .filter(
                TenantMembership.hospital_id == emp_ctx.hospital.id,
                TenantMembership.status == "active",
                RoleAssignment.department_id == d.id,
                RoleAssignment.is_active == True,
                or_(
                    func.lower(Role.code).contains("nurse"),
                    func.lower(Role.name).contains("nurse"),
                ),
            )
            .scalar()
            or 0
        )
        on_duty_shifts = (
            db.query(func.count(NursingShiftRecord.id))
            .filter(
                NursingShiftRecord.hospital_id == emp_ctx.hospital.id,
                NursingShiftRecord.department_id == d.id,
                NursingShiftRecord.status == "on_duty",
            )
            .scalar()
            or 0
        )
        active_nurse_count = max(assigned_nurses, on_duty_shifts)
        if active_nurse_count == 0 and p_count > 0:
            ratio = "1:0"
        elif active_nurse_count > 0:
            ratio = f"1:{max(1, p_count // active_nurse_count)}"
        else:
            ratio = "0:0"
        occ_rate = round((p_count / cap) * 100, 1) if cap > 0 else 0.0

        dept_items.append(
            DepartmentCoverageItem(
                department_id=str(d.id),
                department_name=d.name,
                department_code=d.code,
                total_beds=cap,
                occupied_beds=p_count,
                occupancy_rate=occ_rate,
                active_nurses=active_nurse_count,
                nurse_to_patient_ratio=ratio,
                critical_patients_count=crit_count,
                pending_tasks_count=task_count,
            )
        )

    total_active_nurses = (
        db.query(func.count(TenantMembership.id))
        .join(RoleAssignment, RoleAssignment.membership_id == TenantMembership.id)
        .join(Role, Role.id == RoleAssignment.role_id)
        .filter(
            TenantMembership.hospital_id == emp_ctx.hospital.id,
            TenantMembership.status == "active",
            RoleAssignment.is_active == True,
            or_(
                func.lower(Role.code).contains("nurse"),
                func.lower(Role.name).contains("nurse"),
            ),
            ~func.lower(Role.code).in_(["doctor", "receptionist", "hospital_admin", "purchaser"]),
        )
        .scalar()
        or 0
    )

    admitted_count = (
        db.query(func.count(PatientRecord.id))
        .filter(
            PatientRecord.hospital_id == emp_ctx.hospital.id,
            func.lower(PatientRecord.admission_status).in_(["admitted", "inpatient"]),
        )
        .scalar()
        or 0
    )

    today_str = datetime.now().strftime("%Y-%m-%d")
    today_shifts = (
        db.query(NursingShiftRecord)
        .filter(
            NursingShiftRecord.hospital_id == emp_ctx.hospital.id,
            NursingShiftRecord.shift_date == today_str,
        )
        .all()
    )
    scheduled_today = len(today_shifts)
    on_duty_count = sum(1 for s in today_shifts if s.status == "on_duty")
    unfilled = max(0, total_active_nurses - on_duty_count)

    pending_tasks = (
        db.query(func.count(NursingTaskRecord.id))
        .filter(
            NursingTaskRecord.hospital_id == emp_ctx.hospital.id,
            NursingTaskRecord.is_completed == False,
        )
        .scalar()
        or 0
    )

    pending_revocations = (
        db.query(func.count(EmployeeRevocationRequest.id))
        .filter(
            EmployeeRevocationRequest.hospital_id == emp_ctx.hospital.id,
            EmployeeRevocationRequest.status == "PENDING",
        )
        .scalar()
        or 0
    )

    return SupervisorDashboardSummaryResponse(
        facility_name=emp_ctx.hospital.name,
        facility_uid=emp_ctx.hospital.hospital_uid,
        total_active_nurses=total_active_nurses,
        departments_count=len(depts),
        admitted_patients_count=admitted_count,
        scheduled_shifts_today=scheduled_today,
        on_duty_nurses_count=on_duty_count,
        unfilled_shifts_count=unfilled,
        critical_patients_count=total_critical,
        pending_nursing_tasks=pending_tasks,
        pending_revocations_count=pending_revocations,
        department_distribution=dept_items,
    )
