import { Patient, Appointment, Doctor, StaffMember } from '../types';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL
  ? String((import.meta as any).env.VITE_API_URL).replace(/\/$/, '')
  : '') + '/api/v1';

export function checkUnauthorized(res: Response): void {
  if ((res.status === 401 || res.status === 403) && typeof window !== 'undefined') {
    try {
      window.sessionStorage?.removeItem('hims_employee_session');
      window.localStorage?.removeItem('hims_employee_session');
      window.sessionStorage?.removeItem('hims_session');
      window.localStorage?.removeItem('hims_session');
    } catch {}
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('hims:unauthorized'));
    }
  }
}

export interface VitalItem {
  id: string;
  bp: string;
  heartRate: number;
  temperature: string;
  spo2: number;
  respiratoryRate?: number;
  bloodGlucose?: string;
  recordedByName: string;
  recordedAt: string;
}

export interface NursingTask {
  id: string;
  patientId?: string;
  patientName?: string;
  bedNumber?: string;
  taskType: string;
  description: string;
  scheduledTime: string;
  priority: string;
  isCompleted: boolean;
  completedByName?: string;
  completedAt?: string;
  notes?: string;
}

export interface DepartmentCoverage {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  totalBeds: number;
  occupiedBeds: number;
  occupancyRate: number;
  activeNurses: number;
  nurseToPatientRatio: string;
  criticalPatientsCount: number;
  pendingTasksCount: number;
}

export interface SupervisorNursingOverview {
  facilityName: string;
  facilityUid: string;
  totalInpatientCensus: number;
  totalBedCapacity: number;
  overallOccupancyRate: number;
  totalOnDutyNurses: number;
  departments: DepartmentCoverage[];
  escalationAlerts: { severity: string; department: string; message: string }[];
}

export interface DoctorDashboardSummary {
  waitingPatientsCount: number;
  newPatientsCount?: number;
  returningPatientsCount?: number;
  departmentName?: string;
  totalToday?: number;
  examRoom?: string;
  inConsultationCount?: number;
  completedTodayCount?: number;
  todayTotalAppointmentsCount?: number;
}

export interface DoctorPatientHistoryItem {
  id: string;
  appointmentId?: string;
  patientId: string;
  patientMrn: string;
  patientName: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  diagnosis?: string;
  clinicalNotes?: string;
  prescriptions?: string;
  appointmentTime?: string;
  appointmentDate?: string;
  appointmentType?: string;
  isReturning?: boolean;
  documentCount?: number;
  completedAt?: string;
}

export interface DoctorPatientHistoryResponse {
  items: DoctorPatientHistoryItem[];
  total: number;
}

export interface PatientDocumentItem {
  id: string;
  hospitalId: string;
  patientId?: string;
  patientMrn?: string;
  patientName?: string;
  departmentId?: string;
  departmentName?: string;
  title: string;
  originalFileName: string;
  originalFilename?: string;
  fileSizeBytes: number;
  fileSize?: number;
  mimeType: string;
  category: string;
  status: string;
  uploadedByName: string;
  uploaderName?: string;
  downloadUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageStatus {
  configured: boolean;
  status: string;
  bucket?: string;
  message?: string;
  tier?: string;
  totalStorageBytes?: number;
  maxStorageBytes?: number;
  percentageUsed?: number;
  totalDocumentsCount?: number;
}

export interface SaveConsultationReportPayload {
  clinicalNotes: string;
  diagnosis?: string;
  prescriptions?: string;
  followUp?: string;
}

export interface ConsultationReportResult {
  status: string;
  appointmentId: string;
  documentId: string;
  patientMrn: string;
  filename: string;
  downloadUrl?: string;
  reportPreview?: string;
}

export interface PatientConsultancyReportDetail {
  hasReport: boolean;
  documentId?: string;
  title?: string;
  filename?: string;
  createdAt?: string;
  doctorName?: string;
  downloadUrl?: string;
  fileContent?: string;
  patientName: string;
  patientMrn: string;
  detail?: string;
}

export interface EligibleRecipient {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  roleName: string;
  departmentName?: string;
}

export type CommunicationRecipient = EligibleRecipient;

export interface DepartmentHeadSummary {
  departmentId: string;
  departmentName: string;
  departmentCode?: string;
  registeredPatientsCount: number;
  todayScheduledCount: number;
  checkedInCount: number;
  waitingCount: number;
  inConsultationCount: number;
  completedTodayCount: number;
  activeAdmissionsCount: number;
  departmentStaffCount: number;
  pendingRevocationRequestsCount: number;
  urgentAlertsCount: number;
}

export interface DepartmentEmployee {
  id: string; // membership_id
  userId: string;
  employeeUid: string;
  name: string;
  email: string;
  phone?: string;
  roleName: string;
  roleCode: string;
  assignmentId: string;
  scopeType: string;
  assignmentStatus?: string;
  joinedDate?: string;
  isRevocationEligible: boolean;
  departmentName?: string;
  departments?: string[];
}

export interface RevocationRequest {
  id: string;
  hospitalId: string;
  departmentId: string;
  departmentName?: string;
  requesterMembershipId: string;
  requesterName: string;
  targetMembershipId: string;
  targetAssignmentId?: string;
  targetName: string;
  targetEmployeeUid: string;
  revocationScope: 'DEPARTMENT_ASSIGNMENT' | 'FULL_MEMBERSHIP';
  reason: string;
  supportingDetails?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewerName?: string;
  reviewedAt?: string;
  decisionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentReportSummary {
  departmentId: string;
  departmentName: string;
  totalDepartmentPatients: number;
  admittedPatients: number;
  outpatientPatients: number;
  dischargedPatients: number;
  triageBreakdown: Record<string, number>;
  appointmentStats: Record<string, number>;
  averageWaitEstimateMins: number;
}

export interface SupervisorDashboardSummary {
  facilityName: string;
  facilityUid: string;
  totalActiveNurses: number;
  departmentsCount: number;
  admittedPatientsCount: number;
  scheduledShiftsToday: number;
  onDutyNursesCount: number;
  unfilledShiftsCount: number;
  criticalPatientsCount: number;
  pendingNursingTasks: number;
  pendingRevocationsCount: number;
  departmentDistribution: DepartmentCoverage[];
}

export interface NursingWorkforceMember {
  id: string;
  userId: string;
  employeeUid: string;
  fullName: string;
  email: string;
  phone?: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  departmentId?: string;
  departmentName: string;
  assignmentId: string;
  assignmentStatus: string;
  scopeType: string;
  isActive: boolean;
  currentShiftStatus?: string;
  isRevocationEligible: boolean;
}

export interface NursingShiftItem {
  id: string;
  hospitalId: string;
  departmentId: string;
  departmentName: string;
  shiftName: string;
  nurseId?: string;
  nurseName: string;
  assignedWard: string;
  assignedBedCount: number;
  status: string;
  shiftDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNursingShiftPayload {
  departmentId: string;
  shiftName: string;
  nurseId?: string;
  nurseName: string;
  assignedWard: string;
  assignedBedCount?: number;
  shiftDate: string;
  status?: string;
}

export interface UpdateNursingShiftPayload {
  departmentId?: string;
  shiftName?: string;
  nurseId?: string;
  nurseName?: string;
  assignedWard?: string;
  assignedBedCount?: number;
  shiftDate?: string;
  status?: string;
}

export interface NursingPatientCensusItem {
  id: string;
  mrn: string;
  fullName: string;
  age: number;
  gender: string;
  departmentId?: string;
  departmentName: string;
  bedOrRoom: string;
  admissionStatus: string;
  triageCategory: string;
  chiefComplaint?: string;
  attendingPhysicianName: string;
  latestVital?: VitalItem;
  createdAt: string;
}

export interface DepartmentWorkforceStats {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  activeNurses: number;
  patientCensus: number;
  bedCapacity: number;
  occupancyRate: number;
  nurseToPatientRatio: string;
}

export interface ShiftCoverageStats {
  totalShifts: number;
  scheduledCount: number;
  onDutyCount: number;
  completedCount: number;
  unfilledCount: number;
}

export interface TriageBreakdownStats {
  critical: number;
  urgent: number;
  priority: number;
  routine: number;
}

export interface SupervisorReportSummary {
  hospitalName: string;
  hospitalUid: string;
  generatedAt: string;
  totalNurses: number;
  totalPatients: number;
  totalBeds: number;
  overallOccupancyRate: number;
  workforceByDepartment: DepartmentWorkforceStats[];
  shiftCoverage: ShiftCoverageStats;
  triageBreakdown: TriageBreakdownStats;
}

export interface DepartmentNurseStaffItem {
  userId: string;
  name: string;
  roleName: string;
  employeeUid: string;
  status: string;
}

export interface SupervisorDepartmentItem {
  id: string;
  name: string;
  code: string;
  bedCapacity: number;
  patientCensus: number;
  occupancyRate: number;
  nurseCount: number;
  nurses: DepartmentNurseStaffItem[];
}

export interface EmployeeMessage {
  id: string;
  hospitalId: string;
  senderMembershipId: string;
  senderUserId: string;
  senderName: string;
  senderRoleName: string;
  senderDepartmentName?: string;
  recipientMembershipId: string;
  recipientUserId: string;
  recipientName: string;
  recipientRoleName: string;
  recipientDepartmentName?: string;
  subject: string;
  messageBody: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  isRead: boolean;
  readAt?: string;
  completedAt?: string;
  completedByName?: string;
  completionNotes?: string;
  createdAt: string;
}

export interface EligibleRecipient {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  roleName: string;
  departmentName?: string;
}

function getAuthHeaders(explicitToken?: string, hasBody = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  let token = explicitToken;
  let assignmentId: string | undefined;
  if (typeof window !== 'undefined') {
    try {
      const adminTok =
        window.sessionStorage?.getItem('hims_admin_token') ||
        window.localStorage?.getItem('hims_admin_token');
      if (!token && adminTok) token = adminTok;

      const raw =
        window.sessionStorage?.getItem('hims_employee_session') ||
        window.localStorage?.getItem('hims_employee_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!token && parsed?.token) token = parsed.token;
        if (parsed?.activeAssignment?.id) {
          assignmentId = parsed.activeAssignment.id;
        } else if (parsed?.activeMembership?.activeAssignmentId) {
          assignmentId = parsed.activeMembership.activeAssignmentId;
        }
      }
    } catch {}
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (assignmentId) {
    headers['X-Assignment-Id'] = assignmentId;
  }
  return headers;
}

export const clinicalApiClient = {
  async getPatients(token?: string): Promise<Patient[]> {
    const headers = getAuthHeaders(token);

    const res = await fetch(`${API_BASE}/clinical/patients`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch authorized patients.');
    }
    const data = await res.json();
    return data.map((p: any) => ({
      id: p.id,
      mrn: p.mrn,
      name: p.full_name,
      age: p.age,
      gender: p.gender,
      bloodGroup: p.blood_group,
      contact: p.contact_phone,
      registeredAt: p.created_at,
      chiefComplaint: p.chief_complaint || '',
      department: p.department_name || 'General Medicine',
      departmentId: p.department_id,
      triageCategory: p.triage_category,
      attendingPhysician: p.attending_physician_name || 'Attending Staff',
      attendingPhysicianId: p.attending_physician_id,
      bedOrRoom: p.bed_or_room || 'Consultation Suite',
      clinicalNotes: p.clinical_notes || '',
      allergies: p.allergies ? [p.allergies] : [],
      chronicConditions: p.chronic_conditions ? [p.chronic_conditions] : [],
      vitals: p.latest_vitals
        ? {
            bp: p.latest_vitals.bp,
            heartRate: p.latest_vitals.heart_rate,
            temperature: p.latest_vitals.temperature,
            spo2: p.latest_vitals.spo2,
            respiratoryRate: p.latest_vitals.respiratory_rate,
            bloodGlucose: p.latest_vitals.blood_glucose,
            recordedByName: p.latest_vitals.recorded_by_name,
            recordedAt: p.latest_vitals.recorded_at,
          }
        : undefined,
    }));
  },

  async getPatientByMrn(mrn: string, token?: string): Promise<Patient | null> {
    const headers = getAuthHeaders(token);
    const cleanMrn = encodeURIComponent(mrn.trim());

    const res = await fetch(`${API_BASE}/clinical/patients/by-mrn/${cleanMrn}`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to find patient with MRN ${mrn}`);
    }
    const p = await res.json();
    return {
      id: p.id,
      mrn: p.mrn,
      name: p.full_name,
      age: p.age,
      gender: p.gender,
      bloodGroup: p.blood_group,
      contact: p.contact_phone,
      registeredAt: p.created_at,
      chiefComplaint: p.chief_complaint || '',
      department: p.department_name || 'General Medicine',
      departmentId: p.department_id,
      triageCategory: p.triage_category,
      attendingPhysician: p.attending_physician_name || 'Attending Staff',
      attendingPhysicianId: p.attending_physician_id,
      bedOrRoom: p.bed_or_room || 'Consultation Suite',
      clinicalNotes: p.clinical_notes || '',
      allergies: p.allergies ? [p.allergies] : [],
      chronicConditions: p.chronic_conditions ? [p.chronic_conditions] : [],
      vitals: p.latest_vitals
        ? {
            bp: p.latest_vitals.bp,
            heartRate: p.latest_vitals.heart_rate,
            temperature: p.latest_vitals.temperature,
            spo2: p.latest_vitals.spo2,
            respiratoryRate: p.latest_vitals.respiratory_rate,
            bloodGlucose: p.latest_vitals.blood_glucose,
            recordedByName: p.latest_vitals.recorded_by_name,
            recordedAt: p.latest_vitals.recorded_at,
          }
        : undefined,
    };
  },

  async registerPatient(
    payload: {
      fullName: string;
      age: number;
      gender: string;
      bloodGroup: string;
      contactPhone: string;
      departmentId?: string;
      departmentName?: string;
      triageCategory: string;
      attendingPhysicianId?: string;
      attendingPhysicianName?: string;
      bedOrRoom?: string;
      chiefComplaint?: string;
      allergies?: string;
      chronicConditions?: string;
      scheduleAppointment?: boolean;
    },
    token?: string
  ): Promise<Patient> {
    const headers = getAuthHeaders(token, true);

    const res = await fetch(`${API_BASE}/clinical/patients`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        full_name: payload.fullName,
        age: payload.age,
        gender: payload.gender,
        blood_group: payload.bloodGroup,
        contact_phone: payload.contactPhone,
        department_id: payload.departmentId,
        department_name: payload.departmentName,
        triage_category: payload.triageCategory,
        attending_physician_id: payload.attendingPhysicianId,
        attending_physician_name: payload.attendingPhysicianName,
        bed_or_room: payload.bedOrRoom,
        chief_complaint: payload.chiefComplaint,
        allergies: payload.allergies,
        chronic_conditions: payload.chronicConditions,
        schedule_appointment: payload.scheduleAppointment ?? true,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to register patient.');
    }
    const p = await res.json();
    return {
      id: p.id,
      mrn: p.mrn,
      name: p.full_name,
      age: p.age,
      gender: p.gender,
      bloodGroup: p.blood_group,
      contact: p.contact_phone,
      registeredAt: p.created_at,
      chiefComplaint: p.chief_complaint || '',
      department: p.department_name || 'General Medicine',
      departmentId: p.department_id,
      triageCategory: p.triage_category,
      attendingPhysician: p.attending_physician_name || 'Attending Staff',
      attendingPhysicianId: p.attending_physician_id,
      bedOrRoom: p.bed_or_room || 'Consultation Room',
      clinicalNotes: p.clinical_notes || '',
      allergies: p.allergies ? [p.allergies] : [],
      chronicConditions: p.chronic_conditions ? [p.chronic_conditions] : [],
    };
  },

  async getAppointments(token?: string): Promise<Appointment[]> {
    const headers = getAuthHeaders(token);

    const res = await fetch(`${API_BASE}/clinical/appointments`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch appointments.');
    }
    const data = await res.json();
    return data.map((a: any) => ({
      id: a.id,
      patientId: a.patient_id,
      time: a.appointment_time,
      duration: a.duration,
      patientName: a.patient_name,
      patientMrn: a.patient_mrn,
      doctorId: a.doctor_id,
      doctorName: a.doctor_name,
      department: a.department_name,
      departmentId: a.department_id,
      type: a.appointment_type,
      status: a.status,
      room: a.room,
      priority: a.priority,
      checkedInAt: a.checked_in_at,
      completedAt: a.completed_at,
      notes: a.notes,
    }));
  },

  async bookAppointment(
    payload: {
      patientId: string;
      doctorName: string;
      doctorId?: string;
      departmentId?: string;
      departmentName?: string;
      appointmentTime: string;
      duration?: string;
      appointmentType?: string;
      status?: string;
      room?: string;
      priority?: string;
      notes?: string;
    },
    token?: string
  ): Promise<Appointment> {
    const headers = getAuthHeaders(token, true);

    const res = await fetch(`${API_BASE}/clinical/appointments`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        patient_id: payload.patientId,
        doctor_name: payload.doctorName,
        doctor_id: payload.doctorId,
        department_id: payload.departmentId,
        department_name: payload.departmentName,
        appointment_time: payload.appointmentTime,
        duration: payload.duration || '30 mins',
        appointment_type: payload.appointmentType || 'Clinical Consultation',
        status: payload.status || 'pending',
        room: payload.room || 'Consultation Room',
        priority: payload.priority || 'Normal',
        notes: payload.notes,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to book appointment.');
    }
    const a = await res.json();
    return {
      id: a.id,
      patientId: a.patient_id,
      time: a.appointment_time,
      duration: a.duration,
      patientName: a.patient_name,
      patientMrn: a.patient_mrn,
      doctorId: a.doctor_id,
      doctorName: a.doctor_name,
      department: a.department_name,
      departmentId: a.department_id,
      type: a.appointment_type,
      status: a.status,
      room: a.room,
      priority: a.priority,
      notes: a.notes,
    };
  },

  async checkInAppointment(appointmentId: string, token?: string): Promise<void> {
    const headers = getAuthHeaders(token);

    const res = await fetch(`${API_BASE}/clinical/appointments/${appointmentId}/check-in`, {
      method: 'PATCH',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to check in appointment.');
    }
  },

  async startConsultation(appointmentId: string, token?: string): Promise<void> {
    const headers = getAuthHeaders(token);

    const res = await fetch(`${API_BASE}/clinical/consultations/${appointmentId}/start`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to start consultation.');
    }
  },

  async completeConsultation(
    appointmentId: string,
    payload: { clinicalNotes: string; diagnosis?: string; prescriptions?: string; followUp?: string },
    token?: string
  ): Promise<void> {
    const headers = getAuthHeaders(token, true);

    const res = await fetch(`${API_BASE}/clinical/consultations/${appointmentId}/complete`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        clinical_notes: payload.clinicalNotes,
        diagnosis: payload.diagnosis,
        prescriptions: payload.prescriptions,
        follow_up: payload.followUp,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to complete consultation.');
    }
  },

  async saveConsultationReport(
    appointmentId: string,
    payload: SaveConsultationReportPayload,
    token?: string
  ): Promise<ConsultationReportResult> {
    const headers = getAuthHeaders(token, true);

    const res = await fetch(`${API_BASE}/clinical/consultations/${appointmentId}/save-report`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        clinical_notes: payload.clinicalNotes,
        diagnosis: payload.diagnosis,
        prescriptions: payload.prescriptions,
        follow_up: payload.followUp,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to save consultation report to Filebase S3.');
    }
    const data = await res.json();
    return {
      status: data.status,
      appointmentId: data.appointment_id,
      documentId: data.document_id,
      patientMrn: data.patient_mrn,
      filename: data.filename,
      downloadUrl: data.download_url,
      reportPreview: data.report_preview,
    };
  },

  async getPatientConsultancyReport(
    patientIdOrMrn: string,
    token?: string
  ): Promise<PatientConsultancyReportDetail> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/patients/${encodeURIComponent(patientIdOrMrn)}/consultancy-report`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch patient consultancy report.');
    }
    const data = await res.json();
    return {
      hasReport: Boolean(data.has_report),
      documentId: data.document_id,
      title: data.title,
      filename: data.filename,
      createdAt: data.created_at,
      doctorName: data.doctor_name,
      downloadUrl: data.download_url,
      fileContent: data.file_content,
      patientName: data.patient_name,
      patientMrn: data.patient_mrn,
      detail: data.detail,
    };
  },

  async recordVitals(
    patientId: string,
    vitals: { bp: string; heartRate: number; temperature: string; spo2: number; bloodGlucose?: string },
    token?: string
  ): Promise<VitalItem> {
    const headers = getAuthHeaders(token, true);

    const res = await fetch(`${API_BASE}/clinical/patients/${patientId}/vitals`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        bp: vitals.bp,
        heart_rate: vitals.heartRate,
        temperature: vitals.temperature,
        spo2: vitals.spo2,
        blood_glucose: vitals.bloodGlucose,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to record vitals.');
    }
    const v = await res.json();
    return {
      id: v.id,
      bp: v.bp,
      heartRate: v.heart_rate,
      temperature: v.temperature,
      spo2: v.spo2,
      bloodGlucose: v.blood_glucose,
      recordedByName: v.recorded_by_name,
      recordedAt: v.recorded_at,
    };
  },

  async getNursingTasks(token?: string): Promise<NursingTask[]> {
    const headers = getAuthHeaders(token);

    const res = await fetch(`${API_BASE}/clinical/nursing/tasks`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch nursing tasks.');
    }
    const data = await res.json();
    return data.map((t: any) => ({
      id: t.id,
      patientId: t.patient_id,
      patientName: t.patient_name,
      bedNumber: t.bed_number,
      taskType: t.task_type,
      description: t.description,
      scheduledTime: t.scheduled_time,
      priority: t.priority,
      isCompleted: t.is_completed,
      completedByName: t.completed_by_name,
      completedAt: t.completed_at,
      notes: t.notes,
    }));
  },

  async completeNursingTask(taskId: string, token?: string): Promise<void> {
    const headers = getAuthHeaders(token);

    const res = await fetch(`${API_BASE}/clinical/nursing/tasks/${taskId}/complete`, {
      method: 'PATCH',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to complete nursing task.');
    }
  },

  async createNursingTask(
    payload: { patientName?: string; bedNumber?: string; taskType: string; description: string; scheduledTime: string; priority?: string },
    token?: string
  ): Promise<NursingTask> {
    const headers = getAuthHeaders(token, true);

    const res = await fetch(`${API_BASE}/clinical/nursing/tasks`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        patient_name: payload.patientName,
        bed_number: payload.bedNumber,
        task_type: payload.taskType,
        description: payload.description,
        scheduled_time: payload.scheduledTime,
        priority: payload.priority || 'Routine',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create nursing task.');
    }
    const t = await res.json();
    return {
      id: t.id,
      patientName: t.patient_name,
      bedNumber: t.bed_number,
      taskType: t.task_type,
      description: t.description,
      scheduledTime: t.scheduled_time,
      priority: t.priority,
      isCompleted: t.is_completed,
    };
  },

  async deleteNursingTask(taskId: string, token?: string): Promise<void> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/nursing/tasks/${taskId}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete nursing task.');
    }
  },

  async getStaffTasks(token?: string): Promise<NursingTask[]> {
    return this.getNursingTasks(token);
  },

  async completeStaffTask(taskId: string, token?: string): Promise<void> {
    return this.completeNursingTask(taskId, token);
  },

  async createStaffTask(
    payload: { patientName?: string; taskType?: string; description: string; scheduledTime: string; priority?: string },
    token?: string
  ): Promise<NursingTask> {
    return this.createNursingTask({
      patientName: payload.patientName,
      taskType: payload.taskType || 'general_task',
      description: payload.description,
      scheduledTime: payload.scheduledTime,
      priority: payload.priority,
    }, token);
  },

  async deleteStaffTask(taskId: string, token?: string): Promise<void> {
    return this.deleteNursingTask(taskId, token);
  },

  async getNurses(departmentId?: string, query?: string, token?: string): Promise<any[]> {
    const headers = getAuthHeaders(token);
    const params = new URLSearchParams();
    if (departmentId && departmentId !== 'all') params.append('department_id', departmentId);
    if (query) params.append('query', query);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/clinical/supervisor/nurses${qs}`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch nurses directory.');
    }
    return await res.json();
  },

  async getSupervisorNursingAuditLogs(token?: string, query?: string, action?: string): Promise<any[]> {
    const headers = getAuthHeaders(token);
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (action && action !== 'ALL') params.append('action', action);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/clinical/supervisor/nursing-audit-logs${qs}`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch nurse activity logs.');
    }
    const data = await res.json();
    return data.map((d: any) => ({
      id: d.id,
      timestamp: d.timestamp,
      nurseName: d.nurse_name,
      nurseEmail: d.nurse_email,
      departmentName: d.department_name,
      action: d.action,
      details: d.details,
      resourceType: d.resource_type,
    }));
  },

  async contactHospitalAdmin(
    payload: { subject: string; message: string; priority?: string },
    token?: string
  ): Promise<any> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/clinical/supervisor/contact-admin`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to dispatch administrator escalation.');
    }
    return await res.json();
  },

  async getNotifications(token?: string): Promise<any[]> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/notifications`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch notifications.');
    }
    return await res.json();
  },

  async markNotificationRead(notificationId: string, token?: string): Promise<any> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/notifications/${notificationId}/read`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to mark notification as read.');
    }
    return await res.json();
  },

  async markAllNotificationsRead(token?: string): Promise<any> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/notifications/read-all`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to mark all notifications as read.');
    }
    return await res.json();
  },

  async getSupervisorNursingOverview(token?: string): Promise<SupervisorNursingOverview> {
    const headers = getAuthHeaders(token);

    const res = await fetch(`${API_BASE}/clinical/supervisor/nursing-overview`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch nursing supervisor overview.');
    }
    const data = await res.json();
    return {
      facilityName: data.facility_name,
      facilityUid: data.facility_uid,
      totalInpatientCensus: data.total_inpatient_census,
      totalBedCapacity: data.total_bed_capacity,
      overallOccupancyRate: data.overall_occupancy_rate,
      totalOnDutyNurses: data.total_on_duty_nurses,
      departments: data.departments.map((d: any) => ({
        departmentId: d.department_id,
        departmentName: d.department_name,
        departmentCode: d.department_code,
        totalBeds: d.total_beds,
        occupiedBeds: d.occupied_beds,
        occupancyRate: d.occupancy_rate,
        activeNurses: d.active_nurses,
        nurseToPatientRatio: d.nurse_to_patient_ratio,
        criticalPatientsCount: d.critical_patients_count,
        pendingTasksCount: d.pending_tasks_count,
      })),
      escalationAlerts: data.escalation_alerts || [],
    };
  },

  async getDoctors(token?: string): Promise<Doctor[]> {
    const headers = getAuthHeaders(token);

    const res = await fetch(`${API_BASE}/clinical/doctors`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch clinical doctors.');
    }
    const data = await res.json();
    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      title: d.title || 'Attending Physician',
      department: d.department,
      departmentId: d.department_id,
      departments: d.departments || (d.department ? [d.department] : []),
      departmentIds: d.department_ids || (d.department_id ? [d.department_id] : []),
      specialty: d.specialty || d.department,
      avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=250',
      status: (d.status as any) || 'Available',
      patientsToday: d.patients_today,
      nextSlot: d.next_slot || 'Available',
      room: d.room || 'Consultation Suite',
    }));
  },

  async getStaff(token?: string): Promise<StaffMember[]> {
    const headers = getAuthHeaders(token);

    const res = await fetch(`${API_BASE}/clinical/staff`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch staff members.');
    }
    const data = await res.json();
    return data.map((s: any) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      department: s.department,
      departmentId: s.department_id,
      email: s.email,
      employeeUid: s.employee_uid,
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
      status: (s.status as any) || 'Active',
      location: s.location || 'Main Hospital Facility',
      todayMetric: s.today_metric || 'Active in facility directory',
    }));
  },

  async getDepartments(token?: string): Promise<any[]> {
    const headers = getAuthHeaders(token);

    const res = await fetch(`${API_BASE}/clinical/departments`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch departments.');
    }
    return res.json();
  },

  async getShifts(token?: string): Promise<any[]> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/shifts`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch shifts.');
    }
    return res.json();
  },

  async updateAppointmentStatus(
    appointmentId: string,
    payload: { status: string; notes?: string; appointmentTime?: string; room?: string },
    token?: string
  ): Promise<Appointment> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/clinical/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        status: payload.status,
        notes: payload.notes,
        appointment_time: payload.appointmentTime,
        room: payload.room,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update appointment status.');
    }
    const a = await res.json();
    return {
      id: a.id,
      time: a.appointment_time,
      duration: a.duration,
      patientName: a.patient_name,
      patientMrn: a.patient_mrn,
      doctorName: a.doctor_name,
      department: a.department_name,
      type: a.appointment_type,
      status: a.status,
      room: a.room,
      priority: a.priority,
      notes: a.notes,
    };
  },

  async updatePatient(
    patientId: string,
    payload: {
      contactPhone?: string;
      emergencyContact?: string;
      bloodGroup?: string;
      triageCategory?: string;
      bedOrRoom?: string;
      attendingPhysicianName?: string;
    },
    token?: string
  ): Promise<Patient> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/clinical/patients/${patientId}`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        contact_phone: payload.contactPhone,
        emergency_contact: payload.emergencyContact,
        blood_group: payload.bloodGroup,
        triage_category: payload.triageCategory,
        bed_or_room: payload.bedOrRoom,
        attending_physician_name: payload.attendingPhysicianName,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update patient details.');
    }
    const p = await res.json();
    return {
      id: p.id,
      mrn: p.mrn,
      name: p.full_name,
      age: p.age,
      gender: p.gender,
      bloodGroup: p.blood_group,
      contact: p.contact_phone,
      emergencyContact: p.emergency_contact,
      department: p.department_name,
      triageCategory: p.triage_category,
      attendingPhysician: p.attending_physician_name,
      bedOrRoom: p.bed_or_room || 'Waiting Area',
      chiefComplaint: p.chief_complaint,
      clinicalNotes: p.clinical_notes,
      registeredAt: p.created_at,
      allergies: p.allergies ? [p.allergies] : [],
      chronicConditions: p.chronic_conditions ? [p.chronic_conditions] : [],
      vitals: p.latest_vitals
        ? {
            bp: p.latest_vitals.bp,
            heartRate: p.latest_vitals.heart_rate,
            temperature: p.latest_vitals.temperature,
            spo2: p.latest_vitals.spo2,
            recordedAt: p.latest_vitals.recorded_at,
          }
        : undefined,
    };
  },

  async getProfile(token?: string): Promise<any> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/employee/profile`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch profile.');
    }
    return res.json();
  },

  async updateProfile(fullName: string, token?: string): Promise<any> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/employee/profile`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify({ full_name: fullName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update employee profile.');
    }
    return res.json();
  },

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string, token?: string): Promise<{ success: boolean; message: string }> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/employee/change-password`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Password change failed.');
    }
    return res.json();
  },

  async changeUsername(newUsername: string, token?: string): Promise<{ success: boolean; message: string }> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/employee/change-username`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        new_username: newUsername,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Username change failed.');
    }
    return res.json();
  },

  async switchAssignment(assignmentId: string, token?: string): Promise<any> {
    const headers = getAuthHeaders(token, true);

    const res = await fetch(`${API_BASE}/employee/switch-assignment`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ assignment_id: assignmentId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to switch active assignment.');
    }
    return res.json();
  },

  // -------------------------------------------------------------------------
  // DOCTOR / CLINICIAN WORKSPACE CLIENT METHODS
  // -------------------------------------------------------------------------

  async getDoctorDashboardSummary(token?: string): Promise<DoctorDashboardSummary> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/doctor/dashboard-summary`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch doctor dashboard summary.');
    }
    const d = await res.json();
    return {
      waitingPatientsCount: d.waiting_patients_count || 0,
      newPatientsCount: d.new_patients_count || 0,
      returningPatientsCount: d.returning_patients_count || 0,
      departmentName: d.department_name,
      totalToday: d.total_today || 0,
      examRoom: d.exam_room || 'Consultation Suite',
      inConsultationCount: d.in_consultation_count || 0,
      completedTodayCount: d.completed_today_count || 0,
      todayTotalAppointmentsCount: d.total_today || 0,
    };
  },

  async getDoctorPatientHistory(params?: any, token?: string): Promise<DoctorPatientHistoryResponse> {
    const headers = getAuthHeaders(token);
    let url = `${API_BASE}/clinical/doctor/patient-history`;
    if (typeof params === 'string') {
      url += `?patient_id=${encodeURIComponent(params)}`;
    } else if (params && typeof params === 'object') {
      const sp = new URLSearchParams();
      if (params.search) sp.append('search', params.search);
      if (params.date) sp.append('date', params.date);
      if (params.startDate) sp.append('start_date', params.startDate);
      if (params.endDate) sp.append('end_date', params.endDate);
      if (params.offset !== undefined) sp.append('offset', String(params.offset));
      if (params.limit !== undefined) sp.append('limit', String(params.limit));
      const qs = sp.toString();
      if (qs) url += `?${qs}`;
    }
    const res = await fetch(url, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch patient history.');
    }
    const d = await res.json();
    const items = (d.items || []).map((i: any) => ({
      id: i.id,
      appointmentId: i.appointment_id || i.id,
      patientId: i.patient_id,
      patientMrn: i.patient_mrn,
      patientName: i.patient_name,
      age: i.age || 45,
      gender: i.gender || 'M',
      bloodGroup: i.blood_group || 'O+',
      diagnosis: i.diagnosis,
      clinicalNotes: i.clinical_notes,
      prescriptions: i.prescriptions,
      appointmentTime: i.appointment_time,
      appointmentDate: i.appointment_date || i.appointment_time,
      appointmentType: i.appointment_type || 'Consultation',
      isReturning: i.is_returning ?? false,
      documentCount: i.document_count || 0,
      completedAt: i.completed_at,
    }));
    return {
      items,
      total: d.total || items.length,
    };
  },

  async callNextPatient(token?: string): Promise<any> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/clinical/doctor/call-next`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to call next patient.');
    }
    return res.json();
  },

  async callPatient(appointmentId: string, token?: string): Promise<any> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/clinical/doctor/call-patient/${appointmentId}`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to call patient.');
    }
    return res.json();
  },

  async getStorageStatus(token?: string): Promise<StorageStatus> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/documents/storage-status`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch storage status.');
    }
    const d = await res.json();
    return {
      configured: d.configured ?? true,
      status: d.status || 'Active',
      bucket: d.bucket,
      message: d.message,
      tier: d.tier,
      totalStorageBytes: d.total_storage_bytes,
      maxStorageBytes: d.max_storage_bytes,
      percentageUsed: d.percentage_used,
      totalDocumentsCount: d.total_documents_count,
    };
  },

  async getPatientDocuments(patientId: string, token?: string): Promise<PatientDocumentItem[]> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/documents?patient_id=${encodeURIComponent(patientId)}`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch patient documents.');
    }
    const d = await res.json();
    return (d.items || []).map((i: any) => ({
      id: i.id,
      hospitalId: i.hospital_id,
      patientId: i.patient_id,
      patientMrn: i.patient_mrn,
      patientName: i.patient_name,
      departmentId: i.department_id,
      departmentName: i.department_name,
      title: i.title,
      originalFileName: i.original_file_name || i.original_filename,
      originalFilename: i.original_file_name || i.original_filename,
      fileSizeBytes: i.file_size_bytes || i.file_size,
      fileSize: i.file_size_bytes || i.file_size,
      mimeType: i.mime_type,
      category: i.category,
      status: i.status,
      uploadedByName: i.uploaded_by_name || i.uploader_name,
      uploaderName: i.uploaded_by_name || i.uploader_name,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
    }));
  },

  async getDocumentDownloadUrl(docId: string, token?: string): Promise<string> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/documents/${docId}/download`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to get document download URL.');
    }
    const d = await res.json();
    return d.download_url;
  },

  async uploadPatientDocument(formData: FormData, token?: string): Promise<any> {
    const headers: Record<string, string> = {};
    let t = token;
    if (!t && typeof window !== 'undefined') {
      try {
        const raw =
          window.sessionStorage?.getItem('hims_employee_session') ||
          window.localStorage?.getItem('hims_employee_session');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token) t = parsed.token;
        }
      } catch {}
    }
    if (t) headers['Authorization'] = `Bearer ${t}`;

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload document.');
    }
    return res.json();
  },

  // -------------------------------------------------------------------------
  // DEPARTMENT HEAD WORKSPACE CLIENT METHODS
  // -------------------------------------------------------------------------

  async getDepartmentHeadSummary(token?: string): Promise<DepartmentHeadSummary> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/department-head/dashboard-summary`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch department head summary.');
    }
    const d = await res.json();
    return {
      departmentId: d.department_id,
      departmentName: d.department_name,
      departmentCode: d.department_code,
      registeredPatientsCount: d.registered_patients_count,
      todayScheduledCount: d.today_scheduled_count,
      checkedInCount: d.checked_in_count,
      waitingCount: d.waiting_count,
      inConsultationCount: d.in_consultation_count,
      completedTodayCount: d.completed_today_count,
      activeAdmissionsCount: d.active_admissions_count,
      departmentStaffCount: d.department_staff_count,
      pendingRevocationRequestsCount: d.pending_revocation_requests_count,
      urgentAlertsCount: d.urgent_alerts_count,
    };
  },

  async getDepartmentEmployees(token?: string): Promise<DepartmentEmployee[]> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/department-head/employees`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch department employees.');
    }
    const data = await res.json();
    return data.map((e: any) => ({
      id: e.membership_id || e.id,
      userId: e.user_id,
      employeeUid: e.employee_uid,
      name: e.name,
      email: e.email,
      phone: e.phone || '',
      roleName: e.role_name,
      roleCode: e.role_code,
      assignmentId: e.assignment_id,
      scopeType: e.scope_type,
      assignmentStatus: e.assignment_status || 'active',
      joinedDate: e.joined_date || '',
      isRevocationEligible: e.is_revocation_eligible,
      departmentName: e.department_name,
      departments: e.departments || (e.department_name ? e.department_name.split(', ') : []),
    }));
  },

  async submitRevocationRequest(
    payload: {
      targetMembershipId: string;
      targetAssignmentId?: string;
      revocationScope: string;
      reason: string;
      supportingDetails?: string;
    },
    token?: string
  ): Promise<RevocationRequest> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/clinical/department-head/revocation-requests`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        target_membership_id: payload.targetMembershipId,
        target_assignment_id: payload.targetAssignmentId,
        revocation_scope: payload.revocationScope,
        reason: payload.reason,
        supporting_details: payload.supportingDetails,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to submit revocation escalation request.');
    }
    const r = await res.json();
    return {
      id: r.id,
      hospitalId: r.hospital_id,
      departmentId: r.department_id,
      departmentName: r.department_name,
      requesterMembershipId: r.requester_membership_id,
      requesterName: r.requester_name,
      targetMembershipId: r.target_membership_id,
      targetAssignmentId: r.target_assignment_id,
      targetName: r.target_name,
      targetEmployeeUid: r.target_employee_uid,
      revocationScope: r.revocation_scope,
      reason: r.reason,
      supportingDetails: r.supporting_details,
      status: r.status,
      reviewerName: r.reviewer_name,
      reviewedAt: r.reviewed_at,
      decisionNotes: r.decision_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },

  async getDepartmentRevocationRequests(token?: string): Promise<RevocationRequest[]> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/department-head/revocation-requests`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch department revocation requests.');
    }
    const data = await res.json();
    return data.map((r: any) => ({
      id: r.id,
      hospitalId: r.hospital_id,
      departmentId: r.department_id,
      departmentName: r.department_name,
      requesterMembershipId: r.requester_membership_id,
      requesterName: r.requester_name,
      targetMembershipId: r.target_membership_id,
      targetAssignmentId: r.target_assignment_id,
      targetName: r.target_name,
      targetEmployeeUid: r.target_employee_uid,
      revocationScope: r.revocation_scope,
      reason: r.reason,
      supportingDetails: r.supporting_details,
      status: r.status,
      reviewerName: r.reviewer_name,
      reviewedAt: r.reviewed_at,
      decisionNotes: r.decision_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async cancelRevocationRequest(requestId: string, token?: string): Promise<RevocationRequest> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/clinical/department-head/revocation-requests/${requestId}/cancel`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to cancel revocation request.');
    }
    const r = await res.json();
    return {
      id: r.id,
      hospitalId: r.hospital_id,
      departmentId: r.department_id,
      departmentName: r.department_name,
      requesterMembershipId: r.requester_membership_id,
      requesterName: r.requester_name,
      targetMembershipId: r.target_membership_id,
      targetAssignmentId: r.target_assignment_id,
      targetName: r.target_name,
      targetEmployeeUid: r.target_employee_uid,
      revocationScope: r.revocation_scope,
      reason: r.reason,
      supportingDetails: r.supporting_details,
      status: r.status,
      reviewerName: r.reviewer_name,
      reviewedAt: r.reviewed_at,
      decisionNotes: r.decision_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },

  async getDepartmentReports(token?: string): Promise<DepartmentReportSummary> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/department-head/reports`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch department reports.');
    }
    const d = await res.json();
    return {
      departmentId: d.department_id,
      departmentName: d.department_name,
      totalDepartmentPatients: d.total_department_patients,
      admittedPatients: d.admitted_patients,
      outpatientPatients: d.outpatient_patients,
      dischargedPatients: d.discharged_patients,
      triageBreakdown: d.triage_breakdown || {},
      appointmentStats: d.appointment_stats || {},
      averageWaitEstimateMins: d.average_wait_estimate_mins,
    };
  },

  async getDepartmentShifts(token?: string): Promise<any[]> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/department-head/shifts`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch department shifts.');
    }
    return res.json();
  },

  // -------------------------------------------------------------------------
  // EMPLOYEE MESSAGING / COMMUNICATION CLIENT METHODS
  // -------------------------------------------------------------------------

  async getCommunicationRecipients(token?: string): Promise<EligibleRecipient[]> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/communication/recipients`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch communication recipients.');
    }
    const data = await res.json();
    return data.map((r: any) => ({
      membershipId: r.membership_id,
      userId: r.user_id,
      fullName: r.full_name,
      email: r.email,
      roleName: r.role_name,
      departmentName: r.department_name,
    }));
  },

  async getCommunicationInbox(token?: string): Promise<EmployeeMessage[]> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/communication/inbox`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch inbox messages.');
    }
    const data = await res.json();
    return data.map((m: any) => ({
      id: m.id,
      hospitalId: m.hospital_id,
      senderMembershipId: m.sender_membership_id,
      senderUserId: m.sender_user_id,
      senderName: m.sender_name,
      senderRoleName: m.sender_role_name,
      senderDepartmentName: m.sender_department_name,
      recipientMembershipId: m.recipient_membership_id,
      recipientUserId: m.recipient_user_id,
      recipientName: m.recipient_name,
      recipientRoleName: m.recipient_role_name,
      recipientDepartmentName: m.recipient_department_name,
      subject: m.subject,
      messageBody: m.message_body,
      status: m.status,
      isRead: m.is_read,
      readAt: m.read_at,
      completedAt: m.completed_at,
      completedByName: m.completed_by_name,
      completionNotes: m.completion_notes,
      createdAt: m.created_at,
    }));
  },

  async getCommunicationSent(token?: string): Promise<EmployeeMessage[]> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/communication/sent`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch sent messages.');
    }
    const data = await res.json();
    return data.map((m: any) => ({
      id: m.id,
      hospitalId: m.hospital_id,
      senderMembershipId: m.sender_membership_id,
      senderUserId: m.sender_user_id,
      senderName: m.sender_name,
      senderRoleName: m.sender_role_name,
      senderDepartmentName: m.sender_department_name,
      recipientMembershipId: m.recipient_membership_id,
      recipientUserId: m.recipient_user_id,
      recipientName: m.recipient_name,
      recipientRoleName: m.recipient_role_name,
      recipientDepartmentName: m.recipient_department_name,
      subject: m.subject,
      messageBody: m.message_body,
      status: m.status,
      isRead: m.is_read,
      readAt: m.read_at,
      completedAt: m.completed_at,
      completedByName: m.completed_by_name,
      completionNotes: m.completion_notes,
      createdAt: m.created_at,
    }));
  },

  async sendCommunicationMessage(
    payload: { recipientMembershipId: string; subject: string; messageBody: string },
    token?: string
  ): Promise<EmployeeMessage> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/communication/messages`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        recipient_membership_id: payload.recipientMembershipId,
        subject: payload.subject,
        message_body: payload.messageBody,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to send message.');
    }
    const m = await res.json();
    return {
      id: m.id,
      hospitalId: m.hospital_id,
      senderMembershipId: m.sender_membership_id,
      senderUserId: m.sender_user_id,
      senderName: m.sender_name,
      senderRoleName: m.sender_role_name,
      senderDepartmentName: m.sender_department_name,
      recipientMembershipId: m.recipient_membership_id,
      recipientUserId: m.recipient_user_id,
      recipientName: m.recipient_name,
      recipientRoleName: m.recipient_role_name,
      recipientDepartmentName: m.recipient_department_name,
      subject: m.subject,
      messageBody: m.message_body,
      status: m.status,
      isRead: m.is_read,
      readAt: m.read_at,
      completedAt: m.completed_at,
      completedByName: m.completed_by_name,
      completionNotes: m.completion_notes,
      createdAt: m.created_at,
    };
  },

  async completeCommunicationMessage(
    messageId: string,
    completionNotes?: string,
    token?: string
  ): Promise<EmployeeMessage> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/communication/messages/${messageId}/complete`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ completion_notes: completionNotes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to complete task.');
    }
    const m = await res.json();
    return {
      id: m.id,
      hospitalId: m.hospital_id,
      senderMembershipId: m.sender_membership_id,
      senderUserId: m.sender_user_id,
      senderName: m.sender_name,
      senderRoleName: m.sender_role_name,
      senderDepartmentName: m.sender_department_name,
      recipientMembershipId: m.recipient_membership_id,
      recipientUserId: m.recipient_user_id,
      recipientName: m.recipient_name,
      recipientRoleName: m.recipient_role_name,
      recipientDepartmentName: m.recipient_department_name,
      subject: m.subject,
      messageBody: m.message_body,
      status: m.status,
      isRead: m.is_read,
      readAt: m.read_at,
      completedAt: m.completed_at,
      completedByName: m.completed_by_name,
      completionNotes: m.completion_notes,
      createdAt: m.created_at,
    };
  },

  async updateCommunicationMessageStatus(
    messageId: string,
    status: string,
    token?: string
  ): Promise<EmployeeMessage> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/communication/messages/${messageId}/status`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update message status.');
    }
    const m = await res.json();
    return {
      id: m.id,
      hospitalId: m.hospital_id,
      senderMembershipId: m.sender_membership_id,
      senderUserId: m.sender_user_id,
      senderName: m.sender_name,
      senderRoleName: m.sender_role_name,
      senderDepartmentName: m.sender_department_name,
      recipientMembershipId: m.recipient_membership_id,
      recipientUserId: m.recipient_user_id,
      recipientName: m.recipient_name,
      recipientRoleName: m.recipient_role_name,
      recipientDepartmentName: m.recipient_department_name,
      subject: m.subject,
      messageBody: m.message_body,
      status: m.status,
      isRead: m.is_read,
      readAt: m.read_at,
      completedAt: m.completed_at,
      completedByName: m.completed_by_name,
      completionNotes: m.completion_notes,
      createdAt: m.created_at,
    };
  },

  async getUnreadCommunicationCount(token?: string): Promise<number> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/communication/unread-count`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      return 0;
    }
    const data = await res.json();
    return data.unread_count || 0;
  },

  // -------------------------------------------------------------------------
  // ADMINISTRATOR REVOCATION DECISION METHODS
  // -------------------------------------------------------------------------

  async adminGetRevocationRequests(statusFilter?: string, token?: string): Promise<RevocationRequest[]> {
    const headers = getAuthHeaders(token);
    const url = statusFilter
      ? `${API_BASE}/admin/revocation-requests?status=${encodeURIComponent(statusFilter)}`
      : `${API_BASE}/admin/revocation-requests`;
    const res = await fetch(url, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch admin revocation requests.');
    }
    const data = await res.json();
    return data.map((r: any) => ({
      id: r.id,
      hospitalId: r.hospital_id,
      departmentId: r.department_id,
      departmentName: r.department_name,
      requesterMembershipId: r.requester_membership_id,
      requesterName: r.requester_name,
      targetMembershipId: r.target_membership_id,
      targetAssignmentId: r.target_assignment_id,
      targetName: r.target_name,
      targetEmployeeUid: r.target_employee_uid,
      revocationScope: r.revocation_scope,
      reason: r.reason,
      supportingDetails: r.supporting_details,
      status: r.status,
      reviewerName: r.reviewer_name,
      reviewedAt: r.reviewed_at,
      decisionNotes: r.decision_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async adminDecideRevocationRequest(
    requestId: string,
    action: 'APPROVE' | 'REJECT',
    decisionNotes?: string,
    token?: string
  ): Promise<RevocationRequest> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/admin/revocation-requests/${requestId}/decide`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ action, decision_notes: decisionNotes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to submit revocation decision.');
    }
    const r = await res.json();
    return {
      id: r.id,
      hospitalId: r.hospital_id,
      departmentId: r.department_id,
      departmentName: r.department_name,
      requesterMembershipId: r.requester_membership_id,
      requesterName: r.requester_name,
      targetMembershipId: r.target_membership_id,
      targetAssignmentId: r.target_assignment_id,
      targetName: r.target_name,
      targetEmployeeUid: r.target_employee_uid,
      revocationScope: r.revocation_scope,
      reason: r.reason,
      supportingDetails: r.supporting_details,
      status: r.status,
      reviewerName: r.reviewer_name,
      reviewedAt: r.reviewed_at,
      decisionNotes: r.decision_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },

  // ---------------------------------------------------------------------------
  // NURSING SERVICES SUPERVISOR METHODS
  // ---------------------------------------------------------------------------

  async getSupervisorDashboardSummary(token?: string): Promise<SupervisorDashboardSummary> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/supervisor/dashboard-summary`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch supervisor dashboard summary.');
    }
    const d = await res.json();
    return {
      facilityName: d.facility_name,
      facilityUid: d.facility_uid,
      totalActiveNurses: d.total_active_nurses,
      departmentsCount: d.departments_count,
      admittedPatientsCount: d.admitted_patients_count,
      scheduledShiftsToday: d.scheduled_shifts_today,
      onDutyNursesCount: d.on_duty_nurses_count,
      unfilledShiftsCount: d.unfilled_shifts_count,
      criticalPatientsCount: d.critical_patients_count,
      pendingNursingTasks: d.pending_nursing_tasks,
      pendingRevocationsCount: d.pending_revocations_count,
      departmentDistribution: (d.department_distribution || []).map((item: any) => ({
        departmentId: item.department_id,
        departmentName: item.department_name,
        departmentCode: item.department_code,
        totalBeds: item.total_beds,
        occupiedBeds: item.occupied_beds,
        occupancyRate: item.occupancy_rate,
        activeNurses: item.active_nurses,
        nurseToPatientRatio: item.nurse_to_patient_ratio,
        criticalPatientsCount: item.critical_patients_count,
        pendingTasksCount: item.pending_tasks_count,
      })),
    };
  },

  async getSupervisorNursingWorkforce(
    params?: { query?: string; departmentId?: string; roleCode?: string; status?: string },
    token?: string
  ): Promise<NursingWorkforceMember[]> {
    const headers = getAuthHeaders(token);
    const qs = new URLSearchParams();
    if (params?.query) qs.append('query', params.query);
    if (params?.departmentId) qs.append('department_id', params.departmentId);
    if (params?.roleCode) qs.append('role_code', params.roleCode);
    if (params?.status) qs.append('status', params.status);

    const url = `${API_BASE}/clinical/supervisor/nursing-workforce${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetch(url, { headers, credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch nursing workforce directory.');
    }
    const data = await res.json();
    return data.map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      employeeUid: m.employee_uid,
      fullName: m.full_name,
      email: m.email,
      phone: m.phone,
      roleId: m.role_id,
      roleCode: m.role_code,
      roleName: m.role_name,
      departmentId: m.department_id,
      departmentName: m.department_name,
      assignmentId: m.assignment_id,
      assignmentStatus: m.assignment_status,
      scopeType: m.scope_type,
      isActive: m.is_active,
      currentShiftStatus: m.current_shift_status,
      isRevocationEligible: m.is_revocation_eligible,
    }));
  },

  async getSupervisorShifts(
    params?: { date?: string; startDate?: string; endDate?: string; departmentId?: string; nurseId?: string; status?: string },
    token?: string
  ): Promise<NursingShiftItem[]> {
    const headers = getAuthHeaders(token);
    const qs = new URLSearchParams();
    if (params?.date) qs.append('date', params.date);
    if (params?.startDate) qs.append('start_date', params.startDate);
    if (params?.endDate) qs.append('end_date', params.endDate);
    if (params?.departmentId) qs.append('department_id', params.departmentId);
    if (params?.nurseId) qs.append('nurse_id', params.nurseId);
    if (params?.status) qs.append('status', params.status);

    const url = `${API_BASE}/clinical/supervisor/shifts${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetch(url, { headers, credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch nursing shifts.');
    }
    const data = await res.json();
    return data.map((s: any) => ({
      id: s.id,
      hospitalId: s.hospital_id,
      departmentId: s.department_id,
      departmentName: s.department_name,
      shiftName: s.shift_name,
      nurseId: s.nurse_id,
      nurseName: s.nurse_name,
      assignedWard: s.assigned_ward,
      assignedBedCount: s.assigned_bed_count,
      status: s.status,
      shiftDate: s.shift_date,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  },

  async createSupervisorShift(
    payload: CreateNursingShiftPayload,
    token?: string
  ): Promise<NursingShiftItem> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/clinical/supervisor/shifts`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        department_id: payload.departmentId,
        shift_name: payload.shiftName,
        nurse_id: payload.nurseId,
        nurse_name: payload.nurseName,
        assigned_ward: payload.assignedWard,
        assigned_bed_count: payload.assignedBedCount ?? 6,
        shift_date: payload.shiftDate,
        status: payload.status ?? 'scheduled',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create nursing shift.');
    }
    const s = await res.json();
    return {
      id: s.id,
      hospitalId: s.hospital_id,
      departmentId: s.department_id,
      departmentName: s.department_name,
      shiftName: s.shift_name,
      nurseId: s.nurse_id,
      nurseName: s.nurse_name,
      assignedWard: s.assigned_ward,
      assignedBedCount: s.assigned_bed_count,
      status: s.status,
      shiftDate: s.shift_date,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    };
  },

  async updateSupervisorShift(
    shiftId: string,
    payload: UpdateNursingShiftPayload,
    token?: string
  ): Promise<NursingShiftItem> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/clinical/supervisor/shifts/${shiftId}`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        department_id: payload.departmentId,
        shift_name: payload.shiftName,
        nurse_id: payload.nurseId,
        nurse_name: payload.nurseName,
        assigned_ward: payload.assignedWard,
        assigned_bed_count: payload.assignedBedCount,
        shift_date: payload.shiftDate,
        status: payload.status,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update nursing shift.');
    }
    const s = await res.json();
    return {
      id: s.id,
      hospitalId: s.hospital_id,
      departmentId: s.department_id,
      departmentName: s.department_name,
      shiftName: s.shift_name,
      nurseId: s.nurse_id,
      nurseName: s.nurse_name,
      assignedWard: s.assigned_ward,
      assignedBedCount: s.assigned_bed_count,
      status: s.status,
      shiftDate: s.shift_date,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    };
  },

  async deleteSupervisorShift(shiftId: string, token?: string): Promise<{ success: boolean; message: string }> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/supervisor/shifts/${shiftId}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to cancel nursing shift.');
    }
    return res.json();
  },

  async getSupervisorPatientCensus(
    params?: { departmentId?: string; admissionStatus?: string },
    token?: string
  ): Promise<NursingPatientCensusItem[]> {
    const headers = getAuthHeaders(token);
    const qs = new URLSearchParams();
    if (params?.departmentId) qs.append('department_id', params.departmentId);
    if (params?.admissionStatus) qs.append('admission_status', params.admissionStatus);

    const url = `${API_BASE}/clinical/supervisor/patient-census${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetch(url, { headers, credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch patient census.');
    }
    const data = await res.json();
    return data.map((p: any) => ({
      id: p.id,
      mrn: p.mrn,
      fullName: p.full_name,
      age: p.age,
      gender: p.gender,
      departmentId: p.department_id,
      departmentName: p.department_name,
      bedOrRoom: p.bed_or_room,
      admissionStatus: p.admission_status,
      triageCategory: p.triage_category,
      chiefComplaint: p.chief_complaint,
      attendingPhysicianName: p.attending_physician_name,
      latestVital: p.latest_vital
        ? {
            id: p.latest_vital.id,
            bp: p.latest_vital.bp,
            heartRate: p.latest_vital.heart_rate,
            temperature: p.latest_vital.temperature,
            spo2: p.latest_vital.spo2,
            respiratoryRate: p.latest_vital.respiratory_rate,
            bloodGlucose: p.latest_vital.blood_glucose,
            recordedByName: p.latest_vital.recorded_by_name,
            recordedAt: p.latest_vital.recorded_at,
          }
        : undefined,
      createdAt: p.created_at,
    }));
  },

  async getSupervisorReports(token?: string): Promise<SupervisorReportSummary> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/supervisor/reports`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch nursing reports.');
    }
    const d = await res.json();
    return {
      hospitalName: d.hospital_name,
      hospitalUid: d.hospital_uid,
      generatedAt: d.generated_at,
      totalNurses: d.total_nurses,
      totalPatients: d.total_patients,
      totalBeds: d.total_beds,
      overallOccupancyRate: d.overall_occupancy_rate,
      workforceByDepartment: (d.workforce_by_department || []).map((w: any) => ({
        departmentId: w.department_id,
        departmentName: w.department_name,
        departmentCode: w.department_code,
        activeNurses: w.active_nurses,
        patientCensus: w.patient_census,
        bedCapacity: w.bed_capacity,
        occupancyRate: w.occupancy_rate,
        nurseToPatientRatio: w.nurse_to_patient_ratio,
      })),
      shiftCoverage: {
        totalShifts: d.shift_coverage.total_shifts,
        scheduledCount: d.shift_coverage.scheduled_count,
        onDutyCount: d.shift_coverage.on_duty_count,
        completedCount: d.shift_coverage.completed_count,
        unfilledCount: d.shift_coverage.unfilled_count,
      },
      triageBreakdown: {
        critical: d.triage_breakdown.critical,
        urgent: d.triage_breakdown.urgent,
        priority: d.triage_breakdown.priority,
        routine: d.triage_breakdown.routine,
      },
    };
  },

  async getSupervisorDepartmentsOverview(token?: string): Promise<SupervisorDepartmentItem[]> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/supervisor/departments-overview`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch department nursing overview.');
    }
    const data = await res.json();
    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      bedCapacity: d.bed_capacity,
      patientCensus: d.patient_census,
      occupancyRate: d.occupancy_rate,
      nurseCount: d.nurse_count,
      nurses: (d.nurses || []).map((n: any) => ({
        userId: n.user_id,
        name: n.name,
        roleName: n.role_name,
        employeeUid: n.employee_uid,
        status: n.status,
      })),
    }));
  },

  async submitSupervisorRevocationRequest(
    payload: {
      targetMembershipId: string;
      targetAssignmentId?: string;
      revocationScope: 'DEPARTMENT_ASSIGNMENT' | 'FULL_MEMBERSHIP';
      reason: string;
      supportingDetails?: string;
    },
    token?: string
  ): Promise<RevocationRequest> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE}/clinical/supervisor/revocation-requests`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        target_membership_id: payload.targetMembershipId,
        target_assignment_id: payload.targetAssignmentId,
        revocation_scope: payload.revocationScope,
        reason: payload.reason,
        supporting_details: payload.supportingDetails,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to submit supervisor revocation request.');
    }
    const r = await res.json();
    return {
      id: r.id,
      hospitalId: r.hospital_id,
      departmentId: r.department_id,
      departmentName: r.department_name,
      requesterMembershipId: r.requester_membership_id,
      requesterName: r.requester_name,
      targetMembershipId: r.target_membership_id,
      targetAssignmentId: r.target_assignment_id,
      targetName: r.target_name,
      targetEmployeeUid: r.target_employee_uid,
      revocationScope: r.revocation_scope,
      reason: r.reason,
      supportingDetails: r.supporting_details,
      status: r.status,
      reviewerName: r.reviewer_name,
      reviewedAt: r.reviewed_at,
      decisionNotes: r.decision_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },

  async getSupervisorRevocationRequests(token?: string): Promise<RevocationRequest[]> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/supervisor/revocation-requests`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch supervisor revocation requests.');
    }
    const data = await res.json();
    return data.map((r: any) => ({
      id: r.id,
      hospitalId: r.hospital_id,
      departmentId: r.department_id,
      departmentName: r.department_name,
      requesterMembershipId: r.requester_membership_id,
      requesterName: r.requester_name,
      targetMembershipId: r.target_membership_id,
      targetAssignmentId: r.target_assignment_id,
      targetName: r.target_name,
      targetEmployeeUid: r.target_employee_uid,
      revocationScope: r.revocation_scope,
      reason: r.reason,
      supportingDetails: r.supporting_details,
      status: r.status,
      reviewerName: r.reviewer_name,
      reviewedAt: r.reviewed_at,
      decisionNotes: r.decision_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async cancelSupervisorRevocationRequest(requestId: string, token?: string): Promise<RevocationRequest> {
    const headers = getAuthHeaders(token);
    const res = await fetch(`${API_BASE}/clinical/supervisor/revocation-requests/${requestId}/cancel`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to cancel revocation request.');
    }
    const r = await res.json();
    return {
      id: r.id,
      hospitalId: r.hospital_id,
      departmentId: r.department_id,
      departmentName: r.department_name,
      requesterMembershipId: r.requester_membership_id,
      requesterName: r.requester_name,
      targetMembershipId: r.target_membership_id,
      targetAssignmentId: r.target_assignment_id,
      targetName: r.target_name,
      targetEmployeeUid: r.target_employee_uid,
      revocationScope: r.revocation_scope,
      reason: r.reason,
      supportingDetails: r.supporting_details,
      status: r.status,
      reviewerName: r.reviewer_name,
      reviewedAt: r.reviewed_at,
      decisionNotes: r.decision_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },
};

