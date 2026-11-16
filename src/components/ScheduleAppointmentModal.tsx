import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  CalendarPlus,
  Check,
  Building2,
  Stethoscope,
  Search,
  CheckCircle2,
  AlertCircle,
  User,
  Phone,
  Activity,
  Droplet,
  Loader2,
} from 'lucide-react';
import { Appointment, Doctor, Patient } from '../types';
import { clinicalApiClient } from '../services/clinicalApiClient';

interface ScheduleAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (apt: Omit<Appointment, 'id'> & { patientId?: string }) => void;
  doctors?: Doctor[];
  patients?: Patient[];
  departments?: any[];
  hospitalName?: string;
  departmentName?: string;
  token?: string;
}

export const ScheduleAppointmentModal: React.FC<ScheduleAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSchedule,
  doctors = [],
  patients = [],
  departments = [],
  hospitalName = 'Hospital Facility',
  departmentName = 'General Medicine',
  token,
}) => {
  // Patient lookup state
  const [mrnInput, setMrnInput] = useState('');
  const [matchedPatient, setMatchedPatient] = useState<Patient | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Department state
  const [deptList, setDeptList] = useState<any[]>(departments);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedDeptName, setSelectedDeptName] = useState<string>(departmentName);

  // Doctor & appointment details state
  const [doctorName, setDoctorName] = useState<string>('');
  const [time, setTime] = useState('11:30 AM');
  const [duration, setDuration] = useState('30 min');
  const [type, setType] = useState('Routine Medical Consultation');
  const [priority, setPriority] = useState<'Normal' | 'Priority'>('Normal');
  const [checkInImmediately, setCheckInImmediately] = useState(true);

  // Sync departments prop or fetch if missing
  useEffect(() => {
    if (departments && departments.length > 0) {
      setDeptList(departments);
      if (!selectedDeptId) {
        setSelectedDeptId(departments[0].id || '');
        setSelectedDeptName(departments[0].name || departmentName);
      }
    } else if (isOpen) {
      clinicalApiClient
        .getDepartments(token)
        .then((fetched) => {
          if (Array.isArray(fetched) && fetched.length > 0) {
            setDeptList(fetched);
            if (!selectedDeptId) {
              setSelectedDeptId(fetched[0].id);
              setSelectedDeptName(fetched[0].name);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, departments, token, departmentName, selectedDeptId]);

  // Doctors filtered strictly by selected department
  const departmentDoctors = useMemo(() => {
    if (!doctors || doctors.length === 0) return [];
    if (!selectedDeptName && !selectedDeptId) return doctors;

    const targetName = selectedDeptName?.toLowerCase().trim() || '';
    const targetId = selectedDeptId?.toLowerCase().trim() || '';

    const matched = doctors.filter((d) => {
      // 1. Match by ID
      if (targetId) {
        if (d.departmentId && d.departmentId.toLowerCase() === targetId) return true;
        if (d.departmentIds && d.departmentIds.some((id) => id.toLowerCase() === targetId)) return true;
      }
      // 2. Match by department name
      if (targetName) {
        if (
          d.department &&
          (d.department.toLowerCase() === targetName ||
            d.department.toLowerCase().includes(targetName) ||
            targetName.includes(d.department.toLowerCase()))
        ) {
          return true;
        }
        if (
          d.departments &&
          d.departments.some(
            (dept) =>
              dept.toLowerCase() === targetName ||
              dept.toLowerCase().includes(targetName) ||
              targetName.includes(dept.toLowerCase())
          )
        ) {
          return true;
        }
      }
      return false;
    });

    return matched;
  }, [doctors, selectedDeptName, selectedDeptId]);

  // Synchronize doctor selection when department doctors change
  useEffect(() => {
    if (departmentDoctors.length > 0) {
      const match = departmentDoctors.find((d) => d.name === doctorName);
      if (!match) setDoctorName(departmentDoctors[0].name);
    } else {
      setDoctorName('');
    }
  }, [departmentDoctors]);

  // Auto-fetch patient when MRN changes
  const resolvePatientByMrn = useCallback(
    async (cleanMrn: string) => {
      if (!cleanMrn) {
        setMatchedPatient(null);
        setLookupError(null);
        setLookupLoading(false);
        return;
      }

      // Check in patients prop first
      const normalizedQuery = cleanMrn.toLowerCase().trim();
      const localMatch = patients.find(
        (p) =>
          p.mrn.toLowerCase() === normalizedQuery ||
          p.mrn.toLowerCase() === `mrn-${normalizedQuery}` ||
          p.id.toLowerCase() === normalizedQuery
      );

      if (localMatch) {
        setMatchedPatient(localMatch);
        setLookupError(null);
        setLookupLoading(false);
        // Pre-fill type if patient had a chief complaint
        if (localMatch.chiefComplaint && !type) {
          setType(localMatch.chiefComplaint);
        }
        return;
      }

      // If not in local cache, query backend by MRN
      try {
        setLookupLoading(true);
        setLookupError(null);
        const remoteMatch = await clinicalApiClient.getPatientByMrn(cleanMrn, token);
        if (remoteMatch) {
          setMatchedPatient(remoteMatch);
          setLookupError(null);
          if (remoteMatch.chiefComplaint && !type) {
            setType(remoteMatch.chiefComplaint);
          }
        } else {
          setMatchedPatient(null);
          setLookupError(`No registered patient found with MRN "${cleanMrn}".`);
        }
      } catch (err: any) {
        setMatchedPatient(null);
        setLookupError(err.message || `No registered patient found with MRN "${cleanMrn}".`);
      } finally {
        setLookupLoading(false);
      }
    },
    [patients, token, type]
  );

  // Debounced MRN input lookup
  useEffect(() => {
    const trimmed = mrnInput.trim();
    if (!trimmed) {
      setMatchedPatient(null);
      setLookupError(null);
      return;
    }

    const timer = setTimeout(() => {
      resolvePatientByMrn(trimmed);
    }, 350);

    return () => clearTimeout(timer);
  }, [mrnInput, resolvePatientByMrn]);

  if (!isOpen) return null;

  const handleDepartmentChange = (val: string) => {
    const found = deptList.find((d) => d.id === val || d.name === val);
    if (found) {
      setSelectedDeptId(found.id);
      setSelectedDeptName(found.name);
    } else {
      setSelectedDeptId(val);
      setSelectedDeptName(val);
    }
  };

  const handleSelectRecentPatient = (patient: Patient) => {
    setMrnInput(patient.mrn);
    setMatchedPatient(patient);
    setLookupError(null);
    if (patient.chiefComplaint) {
      setType(patient.chiefComplaint);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedPatient) {
      setLookupError('Please enter a valid, registered Patient MRN before booking.');
      return;
    }

    const matchedDoc =
      departmentDoctors.find((d) => d.name === doctorName) ||
      doctors.find((d) => d.name === doctorName);
    const room = matchedDoc?.room || 'Consultation Suite';
    const finalDept = selectedDeptName || matchedDoc?.department || departmentName;

    onSchedule({
      patientId: matchedPatient.id,
      patientName: matchedPatient.name,
      patientMrn: matchedPatient.mrn,
      doctorName: doctorName || matchedDoc?.name || `${finalDept} Duty Physician`,
      doctorId: matchedDoc?.id,
      department: finalDept,
      departmentId: selectedDeptId || matchedDoc?.departmentId,
      time,
      duration,
      type: type || matchedPatient.chiefComplaint || 'Routine Medical Consultation',
      status: checkInImmediately ? 'checked-in' : 'pending',
      room,
      priority,
      notes: `Scheduled via front desk booking module for ${finalDept}.`,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn select-none">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
              <CalendarPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Book Clinic Appointment Slot
              </h2>
              <p className="text-xs text-slate-500">
                {selectedDeptName || departmentName} Schedule • {hospitalName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Patient MRN Search Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-teal-800" />
                <span>Patient MRN (Unique Identifier) *</span>
              </span>
              <span className="text-[11px] font-normal text-slate-400">
                Auto-fetches patient details
              </span>
            </label>

            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                placeholder="Enter MRN (e.g. MRN-10001, MRN-10002)"
                value={mrnInput}
                onChange={(e) => setMrnInput(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border transition-colors pr-10 focus:outline-none ${
                  lookupError
                    ? 'border-rose-300 focus:border-rose-500 bg-rose-50/20'
                    : matchedPatient
                    ? 'border-emerald-300 focus:border-emerald-500 bg-emerald-50/20'
                    : 'border-slate-200 focus:border-teal-700 bg-white'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                {lookupLoading ? (
                  <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
                ) : matchedPatient ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Search className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* Quick Picker from Registered Patients if MRN not yet entered */}
            {!mrnInput && patients && patients.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] text-slate-500 mb-1.5 font-medium">
                  Recent Registered Patients (Click to populate MRN):
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                  {patients.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectRecentPatient(p)}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer text-left"
                    >
                      {p.name} <span className="font-mono text-slate-400">({p.mrn})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error banner if MRN not found */}
            {lookupError && !lookupLoading && (
              <div className="mt-2 p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-900">Patient Record Not Found</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">{lookupError}</p>
                </div>
              </div>
            )}

            {/* Verified Patient Card when found */}
            {matchedPatient && (
              <div className="mt-2.5 p-3.5 bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-slate-50/80 rounded-xl border border-emerald-200/90 shadow-soft-xs animate-fadeIn">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-soft-xs shrink-0">
                      {matchedPatient.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {matchedPatient.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 font-mono font-semibold border border-emerald-200">
                          {matchedPatient.mrn}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5">
                        <span>{matchedPatient.age} yrs</span>
                        <span>•</span>
                        <span>
                          {matchedPatient.gender === 'F'
                            ? 'Female'
                            : matchedPatient.gender === 'M'
                            ? 'Male'
                            : 'Other'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Droplet className="w-3 h-3 text-rose-500" />
                          {matchedPatient.bloodGroup || 'Blood N/A'}
                        </span>
                        {matchedPatient.contact && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {matchedPatient.contact}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/60 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified
                  </span>
                </div>

                {matchedPatient.chiefComplaint && (
                  <div className="mt-2 pt-2 border-t border-emerald-200/50 text-[11px] text-slate-600 flex items-start gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-800">Primary Complaint:</strong>{' '}
                      {matchedPatient.chiefComplaint}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Department and Doctor Selection (Strictly Filtered) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-teal-800" />
                <span>Target Department *</span>
              </label>
              <select
                value={selectedDeptId || selectedDeptName}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700 bg-white"
              >
                {deptList && deptList.length > 0 ? (
                  deptList.map((d) => (
                    <option key={d.id || d.name} value={d.id || d.name}>
                      {d.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="General Medicine">General Medicine</option>
                    <option value="Emergency Medicine">Emergency Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Outpatient Clinics">Outpatient Clinics</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Radiology">Radiology</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-teal-800" />
                <span>Select Attending Doctor *</span>
              </label>
              <select
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700 bg-white"
              >
                {departmentDoctors && departmentDoctors.length > 0 ? (
                  departmentDoctors.map((doc) => (
                    <option key={doc.id || doc.name} value={doc.name}>
                      {doc.name} — {selectedDeptName} ({doc.room || 'Consultation Suite'})
                    </option>
                  ))
                ) : (
                  <option value="">No physicians assigned to {selectedDeptName}</option>
                )}
              </select>
            </div>
          </div>

          {/* Time, Duration, Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Preferred Slot Time
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
              >
                <option value="09:00 AM">09:00 AM (Morning Slot)</option>
                <option value="09:30 AM">09:30 AM (Morning Slot)</option>
                <option value="10:00 AM">10:00 AM (Morning Slot)</option>
                <option value="10:30 AM">10:30 AM (Morning Slot)</option>
                <option value="11:00 AM">11:00 AM (Morning Slot)</option>
                <option value="11:30 AM">11:30 AM (Morning Slot)</option>
                <option value="12:00 PM">12:00 PM (Midday Slot)</option>
                <option value="01:30 PM">01:30 PM (Afternoon Slot)</option>
                <option value="02:00 PM">02:00 PM (Afternoon Slot)</option>
                <option value="02:30 PM">02:30 PM (Afternoon Slot)</option>
                <option value="03:00 PM">03:00 PM (Afternoon Slot)</option>
                <option value="03:30 PM">03:30 PM (Afternoon Slot)</option>
                <option value="04:00 PM">04:00 PM (Afternoon Slot)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Visit Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
              >
                <option value="20 min">20 min (Brief Follow-up)</option>
                <option value="30 min">30 min (Standard Consult)</option>
                <option value="45 min">45 min (Comprehensive Checkup)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'Normal' | 'Priority')}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
              >
                <option value="Normal">Normal Routine</option>
                <option value="Priority">Priority Fast-Track</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Purpose / Reason for Appointment
            </label>
            <input
              type="text"
              placeholder="e.g. Hypertension medication adjustment, metabolic check"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
            />
          </div>

          {/* Immediate Queue Option */}
          <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="checkInImmediately"
              checked={checkInImmediately}
              onChange={(e) => setCheckInImmediately(e.target.checked)}
              className="mt-0.5 rounded text-teal-800 focus:ring-teal-700 cursor-pointer"
            />
            <label htmlFor="checkInImmediately" className="text-xs text-slate-700 cursor-pointer">
              <span className="font-semibold text-teal-900 block">
                Queue for Immediate Live Doctor Consultation (Check In Now)
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Places this patient directly into {doctorName || 'the assigned doctor'}&apos;s live waiting queue.
              </span>
            </label>
          </div>

          {/* Footer actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!matchedPatient}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-800 hover:bg-teal-900 text-white flex items-center gap-1.5 shadow-soft-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm Appointment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
