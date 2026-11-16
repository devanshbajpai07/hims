export type UserRole =
  | 'receptionist'
  | 'doctor'
  | 'nurse'
  | 'nursing_supervisor'
  | 'dept_head'
  | 'pharmacist'
  | 'admin'
  | 'staff';

export type ConceptId = 'minimal-clinical' | 'modern-saas' | 'command-centre';

export type TriageCategory = 'Routine' | 'Priority' | 'Urgent' | 'Critical';

export type AppointmentStatus =
  | 'pending'
  | 'checked-in'
  | 'in-progress'
  | 'completed'
  | 'no-show'
  | 'cancelled'
  | 'confirmed';

export type DoctorStatus = 'Available' | 'In Consultation' | 'In Surgery' | 'On Break' | 'Off Duty';

export interface Vitals {
  bp: string;
  heartRate: number;
  temperature: string;
  spo2: number;
  respiratoryRate?: number;
  bloodGlucose?: string;
  recordedByName?: string;
  recordedAt: string;
}

export interface Patient {
  id: string;
  mrn: string; // Medical Record Number e.g. MRN-90214
  name: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  bloodGroup: string;
  contact: string;
  emergencyContact?: string;
  registeredAt: string;
  chiefComplaint: string;
  department: string;
  departmentId?: string;
  triageCategory: TriageCategory;
  attendingPhysician: string;
  attendingPhysicianId?: string;
  bedOrRoom: string; // e.g. "Exam Room 101"
  vitals?: Vitals;
  allergies?: string[];
  chronicConditions?: string[];
  pastVisitsCount?: number;
  lastVisitDate?: string;
  clinicalNotes?: string;
}

export interface Appointment {
  id: string;
  patientId?: string;
  time: string;
  duration: string;
  patientName: string;
  patientMrn: string;
  doctorName: string;
  department: string;
  departmentId?: string;
  doctorId?: string;
  type: string;
  status: AppointmentStatus;
  room: string;
  priority?: 'Normal' | 'Priority' | 'High';
  checkedInAt?: string;
  completedAt?: string;
  notes?: string;
}

export interface Doctor {
  id: string;
  name: string;
  title: string;
  department: string;
  departmentId?: string;
  departments?: string[];
  departmentIds?: string[];
  specialty: string;
  avatar: string;
  status: DoctorStatus;
  patientsToday: number;
  nextSlot: string;
  room: string;
  onCall?: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  departmentId?: string;
  email?: string;
  employeeUid?: string;
  avatar: string;
  status: 'Active' | 'On Duty' | 'In Clinic' | 'Break' | string;
  location: string;
  todayMetric: string;
}

export interface StatMetric {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  timeframe: string;
  iconName: string;
}

export interface HIMSContextState {
  patients: Patient[];
  appointments: Appointment[];
  doctors: Doctor[];
  stats: StatMetric[];
  activeConcept: ConceptId;
  setActiveConcept: (concept: ConceptId) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  openRegisterModal: () => void;
  openScheduleModal: () => void;
  onRegisterPatient: (patient: Omit<Patient, 'id' | 'mrn' | 'registeredAt'>) => void;
  onScheduleAppointment: (apt: Omit<Appointment, 'id'>) => void;
  onToggleDoctorStatus?: (doctorId: string) => void;
}
