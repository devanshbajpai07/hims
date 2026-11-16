import React, { useState, useEffect, useMemo } from 'react';
import { X, UserPlus, Check, Building2, Stethoscope, AlertTriangle } from 'lucide-react';
import { Patient, TriageCategory, Doctor } from '../types';
import { clinicalApiClient } from '../services/clinicalApiClient';

interface RegisterPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (patient: Omit<Patient, 'id' | 'mrn' | 'registeredAt'>) => void;
  doctors?: Doctor[];
  departments?: any[];
  hospitalName?: string;
  departmentName?: string;
  token?: string;
}

export const RegisterPatientModal: React.FC<RegisterPatientModalProps> = ({
  isOpen,
  onClose,
  onRegister,
  doctors = [],
  departments = [],
  hospitalName = 'Hospital Facility',
  departmentName = 'General Medicine',
  token,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'Other'>('F');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [contact, setContact] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [triageCategory, setTriageCategory] = useState<TriageCategory>('Routine');

  // Department State
  const [deptList, setDeptList] = useState<any[]>(departments);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedDeptName, setSelectedDeptName] = useState<string>(departmentName);

  // Physician State
  const [attendingPhysician, setAttendingPhysician] = useState<string>('');

  // Fetch live departments if not passed as prop
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
            setSelectedDeptId(fetched[0].id);
            setSelectedDeptName(fetched[0].name);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, departments, token, departmentName, selectedDeptId]);

  // Handle department change
  const handleDepartmentChange = (deptIdOrName: string) => {
    const found = deptList.find((d) => d.id === deptIdOrName || d.name === deptIdOrName);
    if (found) {
      setSelectedDeptId(found.id);
      setSelectedDeptName(found.name);
    } else {
      setSelectedDeptId(deptIdOrName);
      setSelectedDeptName(deptIdOrName);
    }
  };

  // Doctors relevant to the selected department
  const departmentDoctors = useMemo(() => {
    if (!doctors || doctors.length === 0) return [];
    if (!selectedDeptName && !selectedDeptId) return doctors;

    const targetName = selectedDeptName?.toLowerCase().trim() || '';
    const targetId = selectedDeptId?.toLowerCase().trim() || '';

    const matched = doctors.filter((d) => {
      // 1. Direct ID match
      if (targetId) {
        if (d.departmentId && d.departmentId.toLowerCase() === targetId) return true;
        if (d.departmentIds && d.departmentIds.some((id) => id.toLowerCase() === targetId)) return true;
      }
      // 2. Name match (primary department or assigned departments)
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

  // Keep attending physician in sync
  useEffect(() => {
    if (departmentDoctors.length > 0) {
      const match = departmentDoctors.find((d) => d.name === attendingPhysician);
      if (!match) {
        setAttendingPhysician(departmentDoctors[0].name);
      }
    } else {
      setAttendingPhysician('');
    }
  }, [departmentDoctors]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !age || !chiefComplaint) return;

    const matchedDoc = doctors.find((d) => d.name === attendingPhysician);
    const room = matchedDoc?.room || 'Consultation Suite';
    const finalDept = selectedDeptName || matchedDoc?.department || 'General Medicine';

    onRegister({
      name,
      age: parseInt(age, 10) || 30,
      gender,
      bloodGroup,
      contact: contact || '+1 (555) 000-0000',
      chiefComplaint,
      department: finalDept,
      departmentId: selectedDeptId || matchedDoc?.departmentId,
      triageCategory,
      attendingPhysician: attendingPhysician || 'General Duty Medical Officer',
      attendingPhysicianId: matchedDoc?.id,
      bedOrRoom: room,
      vitals: {
        bp: '122/80 mmHg',
        heartRate: 72,
        temperature: '98.6 °F',
        spo2: 98,
        recordedAt: 'Intake Desk',
      },
      allergies: ['No Known Drug Allergies (NKDA)'],
      chronicConditions: [],
      pastVisitsCount: 1,
      lastVisitDate: 'Today (New Intake)',
      clinicalNotes: `Initial intake registered at front desk. Transferred to ${finalDept} for consultation.`,
    });

    // Reset and close
    setName('');
    setAge('');
    setContact('');
    setChiefComplaint('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn select-none">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Patient Registration & Front Desk Intake
              </h2>
              <p className="text-xs text-slate-500">
                {departmentName} • {hospitalName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Legal Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Thomas Alvarez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Age *</label>
                <input
                  type="number"
                  required
                  placeholder="38"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
              <div className="flex gap-4 text-xs pt-1.5">
                {(['F', 'M', 'Other'] as const).map((g) => (
                  <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      checked={gender === g}
                      onChange={() => setGender(g)}
                      className="accent-teal-700"
                    />
                    <span>{g === 'F' ? 'Female' : g === 'M' ? 'Male' : 'Other'}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                placeholder="+1 (555) 481-9920"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Chief Complaint / Reason for Visit *
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Mild persistent cough for 4 days, mild fatigue, no shortness of breath"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-700"
            />
          </div>

          {/* Clinical Department & Attending Physician Selection for Transfer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-teal-800" />
                <span>Transfer to Clinical Department *</span>
              </label>
              <select
                value={selectedDeptId || selectedDeptName}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700 bg-white"
              >
                {deptList.length > 0 ? (
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
                <span>Assigned Attending Physician *</span>
              </label>
              <select
                value={attendingPhysician}
                onChange={(e) => setAttendingPhysician(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700 bg-white"
              >
                {departmentDoctors && departmentDoctors.length > 0 ? (
                  departmentDoctors.map((doc) => (
                    <option key={doc.id || doc.name} value={doc.name}>
                      {doc.name} — {selectedDeptName} ({doc.room || 'Consultation Room'})
                    </option>
                  ))
                ) : (
                  <option value="">
                    No physicians assigned to {selectedDeptName}
                  </option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Triage Priority
              </label>
              <select
                value={triageCategory}
                onChange={(e) => setTriageCategory(e.target.value as TriageCategory)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
              >
                <option value="Routine">Routine General Consultation</option>
                <option value="Priority">Priority Follow-up</option>
                <option value="Urgent">Urgent / Acute Evaluation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Clinical Workflow Destination
              </label>
              <div className="px-3 py-2 text-xs rounded-lg border border-teal-100 bg-teal-50/60 text-teal-900 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Queued for {selectedDeptName} consultation</span>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-800 hover:bg-teal-900 text-white flex items-center gap-1.5 shadow-soft-sm transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Complete Patient Intake</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
