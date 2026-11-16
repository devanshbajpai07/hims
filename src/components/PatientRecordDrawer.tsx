import React, { useState } from 'react';
import {
  X,
  Heart,
  ShieldAlert,
  Activity,
  FileText,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  Pill,
  User,
  Phone,
  Building2,
  Stethoscope,
  FolderOpen,
  CloudUpload,
  ShieldCheck,
  Thermometer,
  ExternalLink,
} from 'lucide-react';
import { Patient, Appointment } from '../types';
import { ConsultationCompletionModal } from './clinical/ConsultationCompletionModal';
import { ConsultancyReportViewerModal } from './clinical/ConsultancyReportViewerModal';
import { clinicalApiClient, PatientConsultancyReportDetail } from '../services/clinicalApiClient';

export interface PatientRecordDrawerProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onStartConsultation?: (patientId: string) => void;
  onCompleteConsultation?: (appointmentId: string) => void;
  onOpenUploadReportForm?: (appointment: Appointment, patient: Patient) => void;
  onViewConsultancyReport?: (mrn: string, patientName: string) => void;
  appointments?: Appointment[];
  activeAppointment?: Appointment | null;
  doctorName?: string;
  departmentName?: string;
  token?: string;
  onToast?: (title: string, desc: string) => void;
}

export const PatientRecordDrawer: React.FC<PatientRecordDrawerProps> = ({
  patient,
  isOpen,
  onClose,
  onStartConsultation,
  onCompleteConsultation,
  onOpenUploadReportForm,
  onViewConsultancyReport,
  appointments = [],
  activeAppointment,
  doctorName = 'Attending Physician',
  departmentName = 'General Medicine',
  token,
  onToast,
}) => {
  // Modals inside drawer for report upload and viewing
  const [internalUploadOpen, setInternalUploadOpen] = useState(false);
  const [internalReportOpen, setInternalReportOpen] = useState(false);
  const [reportDetail, setReportDetail] = useState<PatientConsultancyReportDetail | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  if (!isOpen || !patient) return null;

  // Match active or recent appointment for this patient
  const matchedAppointment: Appointment =
    activeAppointment ||
    appointments.find(
      (a) =>
        (a.patientMrn && a.patientMrn === patient.mrn) ||
        (a.patientName && a.patientName === patient.name)
    ) || {
      id: `apt-${patient.id}`,
      patientId: patient.id,
      patientName: patient.name,
      patientMrn: patient.mrn,
      doctorName: patient.attendingPhysician || doctorName,
      department: patient.department || departmentName,
      type: patient.chiefComplaint || 'Clinical Consultation',
      status: 'in-progress',
      room: patient.bedOrRoom || 'Consultation Suite',
      time: 'Today',
      duration: '30 mins',
    };

  const isInRoom =
    matchedAppointment.status === 'in-progress' ||
    matchedAppointment.status === 'confirmed';
  const isWaiting = matchedAppointment.status === 'checked-in';

  // Format date helper
  const formatDateTime = (raw?: string) => {
    if (!raw) return 'N/A';
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return raw;
    }
  };

  const handleOpenUploadPopup = () => {
    if (onOpenUploadReportForm) {
      onOpenUploadReportForm(matchedAppointment, patient);
    } else {
      setInternalUploadOpen(true);
    }
  };

  const handleViewReport = async () => {
    if (onViewConsultancyReport) {
      onViewConsultancyReport(patient.mrn, patient.name);
      return;
    }
    try {
      setReportLoading(true);
      setInternalReportOpen(true);
      const res = await clinicalApiClient.getPatientConsultancyReport(
        patient.mrn || patient.id,
        token
      );
      setReportDetail(res);
    } catch (err: any) {
      setReportDetail({
        hasReport: false,
        patientName: patient.name,
        patientMrn: patient.mrn,
        detail: err.message || 'Unable to load consultancy report from Filebase S3.',
      });
    } finally {
      setReportLoading(false);
    }
  };

  const handleSaveInternalReport = async (payload: {
    clinicalNotes: string;
    diagnosis?: string;
    prescriptions?: string;
    followUp?: string;
  }) => {
    try {
      setIsSubmittingReport(true);
      const res = await clinicalApiClient.saveConsultationReport(
        matchedAppointment.id,
        payload,
        token
      );
      if (onToast) {
        onToast(
          'Consultation Report Saved',
          `Report file (${res.filename}) compiled and saved to Filebase S3 for ${patient.name}.`
        );
      }
      setInternalUploadOpen(false);
      if (onCompleteConsultation) {
        onCompleteConsultation(matchedAppointment.id);
      }
    } catch (err: any) {
      throw err;
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleMarkCompleteDirectly = () => {
    if (onCompleteConsultation) {
      onCompleteConsultation(matchedAppointment.id);
      if (onToast) {
        onToast(
          'Consultation Concluded',
          `Encounter for ${patient.name} (${patient.mrn}) marked as completed.`
        );
      }
      onClose();
    } else {
      handleOpenUploadPopup();
    }
  };

  // Vitals metadata
  const recordedBy =
    patient.vitals?.recordedByName || 'Triage Nurse / Intake Clinician';
  const recordedAtFormatted = patient.vitals?.recordedAt
    ? formatDateTime(patient.vitals.recordedAt)
    : 'At Intake Triage';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs animate-fadeIn select-none">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-6 sm:pl-12">
        <div className="w-screen max-w-2xl bg-[#FAF7F2] shadow-2xl flex flex-col border-l border-slate-300/80">
          {/* ================================================================= */}
          {/* HEADER: PATIENT IDENTITY BANNER */}
          {/* ================================================================= */}
          <div className="p-6 border-b border-slate-200 bg-white shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-teal-800 text-white flex items-center justify-center font-bold text-lg shadow-soft-sm shrink-0">
                {patient.gender === 'F' ? '♀' : '♂'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900 truncate font-sans">
                    {patient.name}
                  </h2>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                    {patient.mrn}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {patient.age}y &bull; {patient.gender === 'F' ? 'Female' : 'Male'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                  <span>Blood: <strong className="text-slate-800">{patient.bloodGroup || 'O+'}</strong></span>
                  <span>&bull;</span>
                  <span>{patient.department || departmentName}</span>
                  <span>&bull;</span>
                  <span className="font-mono text-slate-600">{patient.bedOrRoom || 'Consultation Suite'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close EMR Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ================================================================= */}
          {/* QUICK ACTION TOOLBAR */}
          {/* ================================================================= */}
          <div className="px-6 py-3 bg-white/70 border-b border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Encounter Status:
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1.5 ${
                  isInRoom
                    ? 'bg-amber-50 text-amber-900 border border-amber-300'
                    : isWaiting
                    ? 'bg-teal-50 text-teal-800 border border-teal-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isInRoom
                      ? 'bg-amber-500 animate-pulse'
                      : isWaiting
                      ? 'bg-teal-600 animate-pulse'
                      : 'bg-emerald-500'
                  }`}
                />
                <span>
                  {isInRoom
                    ? 'In Consultation Room'
                    : isWaiting
                    ? 'Waiting for Consultation'
                    : 'Encounter Logged'}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleViewReport}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="View Filebase S3 Report"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>View Report</span>
              </button>

              <button
                onClick={handleOpenUploadPopup}
                className="px-3 py-1.5 text-xs font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Upload or compile clinical report"
              >
                <CloudUpload className="w-3.5 h-3.5 text-teal-700" />
                <span>Upload Report</span>
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* DRAWER BODY: PROPER EMR STRUCTURE */}
          {/* ================================================================= */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* ------------------------------------------------------------- */}
            {/* 1. BASIC PATIENT DETAILS & ADMINISTRATIVE FILE */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-800" />
                  Basic Patient Details & Demographics
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Intake: {formatDateTime(patient.registeredAt)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Full Legal Name
                  </span>
                  <span className="font-bold text-slate-900 text-[13px]">
                    {patient.name}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    MRN (Identifier)
                  </span>
                  <span className="font-mono font-bold text-teal-800 text-[13px]">
                    {patient.mrn}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Age & Gender
                  </span>
                  <span className="font-medium text-slate-800">
                    {patient.age} yrs &bull; {patient.gender === 'F' ? 'Female' : 'Male'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Blood Group
                  </span>
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500 inline fill-rose-50" />
                    {patient.bloodGroup || 'O+'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Contact Phone
                  </span>
                  <span className="font-mono text-slate-700">
                    {patient.contact || 'None listed'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Emergency Contact
                  </span>
                  <span className="font-mono text-slate-700">
                    {patient.emergencyContact || patient.contact || 'Standard on file'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Clinical Department
                  </span>
                  <span className="font-medium text-slate-800">
                    {patient.department || departmentName}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Attending Physician
                  </span>
                  <span className="font-bold text-teal-950">
                    {patient.attendingPhysician || doctorName}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Triage Classification
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    {patient.triageCategory || 'Routine'} Priority
                  </span>
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 2. KNOWN ALLERGIES & CONTRAINDICATIONS */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Known Allergies & Contraindications
                </span>
                <span className="text-[10.5px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Patient Safety Alert
                </span>
              </div>

              {patient.allergies &&
              patient.allergies.length > 0 &&
              patient.allergies[0] &&
              !patient.allergies[0].toLowerCase().includes('no known') &&
              !patient.allergies[0].toLowerCase().includes('none') ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {patient.allergies.map((allergy, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-950 border border-amber-300 shadow-2xs flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{allergy}</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-amber-800 italic">
                    Exercise strict clinical diligence when administering pharmacotherapy or ordering interventions.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">No Known Drug Allergies (NKDA)</span>
                    <span className="text-[11px] text-emerald-800 block">
                      Patient has no recorded hypersensitivities or contraindications on file.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 3. CLINICAL VITALS RECORDED (BY WHOM AND WHEN TOO) */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-700" />
                    Measured Clinical Vitals & Triage Observations
                  </span>
                  <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                    <span>
                      Recorded by: <strong className="text-slate-900">{recordedBy}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Recorded at: <strong className="text-slate-900 font-mono">{recordedAtFormatted}</strong>
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 self-start sm:self-center font-mono">
                  Verified Audit Trail
                </span>
              </div>

              {patient.vitals ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Blood Pressure */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Blood Pressure
                    </span>
                    <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                      {patient.vitals.bp || '120/80'}
                    </div>
                    <span className="text-[10px] text-slate-500">mmHg</span>
                  </div>

                  {/* Heart Rate */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Heart Rate
                    </span>
                    <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                      {patient.vitals.heartRate || 72}
                    </div>
                    <span className="text-[10px] text-slate-500">bpm (Pulse)</span>
                  </div>

                  {/* Temperature */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Body Temperature
                    </span>
                    <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                      {patient.vitals.temperature || '98.6'}
                    </div>
                    <span className="text-[10px] text-slate-500">&deg;F (Core)</span>
                  </div>

                  {/* SpO2 */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Oxygen Saturation
                    </span>
                    <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                      {patient.vitals.spo2 || 98}%
                    </div>
                    <span className="text-[10px] text-slate-500">SpO2 Ambient</span>
                  </div>

                  {/* Respiratory Rate */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Respiratory Rate
                    </span>
                    <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                      {patient.vitals.respiratoryRate || 16}
                    </div>
                    <span className="text-[10px] text-slate-500">breaths / min</span>
                  </div>

                  {/* Blood Glucose */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Blood Glucose
                    </span>
                    <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                      {patient.vitals.bloodGlucose || '104'}
                    </div>
                    <span className="text-[10px] text-slate-500">mg/dL (Random)</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 italic text-center">
                  No vitals logged yet for this patient encounter. Intake vitals will populate once triage is completed.
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 4. CHIEF COMPLAINT & CHRONIC CONDITIONS */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-teal-800" />
                  Presenting Chief Complaint & Clinical Intake
                </span>
                <span className="text-[11px] text-slate-400">
                  {patient.pastVisitsCount || 1} prior visit{(patient.pastVisitsCount || 1) > 1 ? 's' : ''}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50/40 border border-teal-200/80 text-xs text-slate-800 font-medium leading-relaxed">
                {patient.chiefComplaint || 'Routine medical examination and general health consultation.'}
              </div>

              {patient.chronicConditions && patient.chronicConditions.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                    Documented Chronic Conditions
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {patient.chronicConditions.map((cond, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                      >
                        {cond}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 5. PATIENT REPORT: CONSULTANCY NOTES & PRESCRIPTIONS */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-800" />
                  Patient Consultation Report & Clinical Orders
                </span>
                <button
                  onClick={handleViewReport}
                  className="text-xs text-teal-800 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>View Encrypted S3 Report</span>
                </button>
              </div>

              {/* Consultancy Notes */}
              <div>
                <span className="text-[10.5px] uppercase font-bold text-slate-500 block mb-1">
                  Consultancy Notes & Clinical Observations
                </span>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans">
                  {patient.clinicalNotes && patient.clinicalNotes.trim() ? (
                    <p className="whitespace-pre-line">{patient.clinicalNotes}</p>
                  ) : (
                    <p className="text-slate-400 italic">
                      No consultancy notes filed for this encounter yet. Click "Upload Report" below to complete examination notes and prescription.
                    </p>
                  )}
                </div>
              </div>

              {/* Prescriptions */}
              <div>
                <span className="text-[10.5px] uppercase font-bold text-slate-500 block mb-1 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-teal-700" />
                  Prescriptions & Medication Orders (If Any)
                </span>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 leading-relaxed">
                  {patient.clinicalNotes && patient.clinicalNotes.includes('Prescription') ? (
                    <p className="whitespace-pre-line">{patient.clinicalNotes}</p>
                  ) : (
                    <p className="text-slate-400 italic font-sans">
                      No active prescriptions documented for this session. Orders can be compiled and saved via the report form.
                    </p>
                  )}
                </div>
              </div>

              {/* S3 Report Callout */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-teal-50/80 via-white to-slate-50 border border-teal-200/80 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <FolderOpen className="w-4 h-4 text-teal-800 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">Filebase S3 Encrypted Report File</span>
                    <span className="text-[11px] text-slate-500">Official archived encounter document</span>
                  </div>
                </div>

                <button
                  onClick={handleViewReport}
                  className="px-3.5 py-1.5 text-xs font-bold text-teal-900 bg-white hover:bg-teal-50 border border-teal-200 rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-teal-700" />
                  <span>Open Report File</span>
                </button>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* DRAWER FOOTER: MANDATORY ACTION BUTTONS */}
          {/* ================================================================= */}
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-white shadow-soft-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-mono truncate">
              MRN: {patient.mrn} &bull; {patient.name}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Close EMR
              </button>

              {/* Action 1: Upload Patient Report (form popup) */}
              <button
                type="button"
                onClick={handleOpenUploadPopup}
                className="px-4 py-2 text-xs font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CloudUpload className="w-4 h-4 text-teal-700" />
                <span>Upload Patient Report</span>
              </button>

              {/* Action 2: Mark Consultation as Complete */}
              <button
                type="button"
                onClick={handleMarkCompleteDirectly}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-soft-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Consultation as Complete</span>
              </button>

              {/* If waiting outside: option to call in */}
              {isWaiting && onStartConsultation && (
                <button
                  type="button"
                  onClick={() => {
                    onStartConsultation(patient.id);
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                  <span>Call to Exam Room</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* INTERNAL CONSULTATION COMPLETION / REPORT UPLOAD POPUP MODAL */}
      {/* ===================================================================== */}
      {internalUploadOpen && (
        <ConsultationCompletionModal
          isOpen={internalUploadOpen}
          onClose={() => setInternalUploadOpen(false)}
          appointment={matchedAppointment}
          patient={patient}
          doctorName={doctorName}
          examRoom={matchedAppointment.room || patient.bedOrRoom || 'Consultation Suite'}
          departmentName={patient.department || departmentName}
          onSave={handleSaveInternalReport}
          isSubmitting={isSubmittingReport}
        />
      )}

      {/* ===================================================================== */}
      {/* INTERNAL CONSULTANCY REPORT VIEWER MODAL */}
      {/* ===================================================================== */}
      {internalReportOpen && (
        <ConsultancyReportViewerModal
          isOpen={internalReportOpen}
          onClose={() => {
            setInternalReportOpen(false);
            setReportDetail(null);
          }}
          report={reportDetail}
          loading={reportLoading}
          patientName={patient.name}
          patientMrn={patient.mrn}
          onRetry={() => {
            if (patient.mrn) handleViewReport();
          }}
        />
      )}
    </div>
  );
};
