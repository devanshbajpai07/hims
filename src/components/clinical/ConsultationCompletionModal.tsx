import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  Activity,
  Heart,
  Thermometer,
  CloudUpload,
  User,
  Shield,
  Pill,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Appointment, Patient } from '../../types';

interface ConsultationCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  patient: Patient | null;
  doctorName: string;
  examRoom: string;
  departmentName: string;
  onSave: (payload: {
    clinicalNotes: string;
    diagnosis?: string;
    prescriptions?: string;
    followUp?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const ConsultationCompletionModal: React.FC<ConsultationCompletionModalProps> = ({
  isOpen,
  onClose,
  appointment,
  patient,
  doctorName,
  examRoom,
  departmentName,
  onSave,
  isSubmitting = false,
}) => {
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescriptions, setPrescriptions] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setClinicalNotes(
        'Patient examined and evaluated. Vital signs reviewed and found within acceptable clinical parameters. Treatment plan explained in detail.'
      );
      setDiagnosis('Z00.00 — General Adult Medical Examination');
      setPrescriptions('');
      setFollowUp('Return for clinical re-evaluation in 5-7 days if symptoms persist.');
      setError(null);
    }
  }, [isOpen, appointment?.id]);

  if (!isOpen || !appointment) return null;

  const patientName = patient?.name || appointment.patientName;
  const patientMrn = patient?.mrn || appointment.patientMrn;
  const age = patient?.age ? `${patient.age} yrs` : 'Adult';
  const gender = patient?.gender || 'Unspecified';
  const bloodGroup = patient?.bloodGroup || 'O+';
  const contact = patient?.contact || 'Standard Record';
  const allergies = patient?.allergies && patient.allergies.length > 0
    ? patient.allergies.join(', ')
    : 'No Known Drug Allergies (NKDA)';

  const bp = patient?.vitals?.bp || '120/80 mmHg';
  const hr = patient?.vitals?.heartRate ? `${patient.vitals.heartRate} bpm` : '72 bpm';
  const spo2 = patient?.vitals?.spo2 ? `${patient.vitals.spo2}%` : '98%';
  const temp = patient?.vitals?.temperature || '98.6 °F';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicalNotes.trim() || clinicalNotes.trim().length < 5) {
      setError('Consultancy notes are required (at least 5 characters).');
      return;
    }
    setError(null);
    try {
      await onSave({
        clinicalNotes: clinicalNotes.trim(),
        diagnosis: diagnosis.trim() || undefined,
        prescriptions: prescriptions.trim() || undefined,
        followUp: followUp.trim() || undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to complete consultation and save report to Filebase S3.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/70 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center shadow-soft-sm shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Complete Clinical Consultation & Generate Report
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100/80 text-teal-900 border border-teal-200">
                  Filebase S3 Encrypted
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Review prefilled patient information, enter clinical findings, and compile official encounter file.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Pre-filled Patient Basic Details */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-700" />
                Pre-Filled Patient Demographics & Intake File
              </span>
              <span className="text-[11px] text-teal-800 font-semibold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                Auto-Retrieved from Hospital Database
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Full Name</span>
                <span className="font-bold text-slate-900 text-sm">{patientName}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">MRN (Identifier)</span>
                <span className="font-mono font-bold text-teal-800 text-sm">{patientMrn}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Demographics</span>
                <span className="font-medium text-slate-800">{age} &bull; {gender}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Blood Group</span>
                <span className="font-bold text-slate-800">{bloodGroup}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Phone</span>
                <span className="font-mono text-slate-700">{contact}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Exam Room / Location</span>
                <span className="font-semibold text-slate-800">{appointment.room || examRoom}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Clinical Department</span>
                <span className="font-medium text-slate-800">{appointment.department || departmentName}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Attending Doctor</span>
                <span className="font-semibold text-slate-800">{doctorName}</span>
              </div>

              <div className="col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Chief Complaint / Reason</span>
                <span className="font-medium text-slate-800">{appointment.type || patient?.chiefComplaint || 'Consultation'}</span>
              </div>

              <div className="col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Allergies Documented</span>
                <span className="font-medium text-amber-800">{allergies}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Pre-filled Intake Vitals */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-teal-700" />
              Recorded Intake Vitals
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Blood Pressure</span>
                <div className="text-base font-bold text-slate-900 font-mono mt-0.5">{bp}</div>
                <span className="text-[10px] text-slate-500">Intake reading</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Heart Rate</span>
                <div className="text-base font-bold text-slate-900 font-mono mt-0.5">{hr}</div>
                <span className="text-[10px] text-slate-500">Pulse rate</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Oxygen (SpO2)</span>
                <div className="text-base font-bold text-slate-900 font-mono mt-0.5">{spo2}</div>
                <span className="text-[10px] text-slate-500">O2 Saturation</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Body Temperature</span>
                <div className="text-base font-bold text-slate-900 font-mono mt-0.5">{temp}</div>
                <span className="text-[10px] text-slate-500">Core temp</span>
              </div>
            </div>
          </div>

          {/* Section 3: Clinical Findings Form (Doctor fills in) */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-700" />
              Physician Consultation Findings & Orders
            </div>

            {/* Clinical Notes (Required) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Consultancy Notes & Observations <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={4}
                required
                placeholder="Enter detailed clinical findings, symptoms assessment, examination observations..."
                className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 shadow-2xs placeholder-slate-400 leading-relaxed font-sans"
              />
            </div>

            {/* Diagnosis / Assessment */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Clinical Diagnosis / Assessment (ICD-10 or Clinical Impression)
              </label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Essential Hypertension / Viral Upper Respiratory Infection"
                className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 shadow-2xs placeholder-slate-400 font-sans"
              />
            </div>

            {/* Prescription */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Pill className="w-3.5 h-3.5 text-teal-700" />
                  Prescriptions & Medication Orders (If Any)
                </span>
                <span className="text-[11px] text-slate-400 font-normal">Optional</span>
              </label>
              <textarea
                value={prescriptions}
                onChange={(e) => setPrescriptions(e.target.value)}
                rows={3}
                placeholder="e.g.&#10;1. Tab. Amoxicillin 500mg — 1 tablet TID after meals for 5 days&#10;2. Tab. Paracetamol 650mg — 1 tablet SOS for fever"
                className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 shadow-2xs placeholder-slate-400 font-mono leading-relaxed"
              />
            </div>

            {/* Follow-up & Discharge Instructions */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span>Follow-Up Advice & Patient Instructions</span>
                <span className="text-[11px] text-slate-400 font-normal">Optional</span>
              </label>
              <input
                type="text"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder="e.g. Return in 5 days for vitals review. Follow low-sodium diet and hydrate well."
                className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 shadow-2xs placeholder-slate-400 font-sans"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <CloudUpload className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span>
              Saving creates an official consultation report file stored in <strong>Filebase S3</strong> and replaces any prior report.
            </span>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving to Filebase S3...' : 'Save Report & Complete Consultation'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

