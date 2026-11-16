import React, { useState, useEffect } from 'react';
import { X, UserCheck, Check, AlertCircle } from 'lucide-react';
import { Patient, TriageCategory, Doctor } from '../types';

interface EditPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  doctors?: Doctor[];
  onUpdate: (patientId: string, updates: {
    contactPhone?: string;
    emergencyContact?: string;
    bloodGroup?: string;
    triageCategory?: string;
    bedOrRoom?: string;
    attendingPhysicianName?: string;
  }) => Promise<void>;
}

export const EditPatientModal: React.FC<EditPatientModalProps> = ({
  isOpen,
  onClose,
  patient,
  doctors = [],
  onUpdate,
}) => {
  const [contact, setContact] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [triageCategory, setTriageCategory] = useState<TriageCategory>('Routine');
  const [attendingPhysician, setAttendingPhysician] = useState('');
  const [bedOrRoom, setBedOrRoom] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      setContact(patient.contact || '');
      setEmergencyContact(patient.emergencyContact || '');
      setBloodGroup(patient.bloodGroup || 'O+');
      setTriageCategory(patient.triageCategory || 'Routine');
      setAttendingPhysician(patient.attendingPhysician || (doctors[0]?.name || 'General Duty Medical Officer'));
      setBedOrRoom(patient.bedOrRoom || 'Waiting Area');
      setErrorMsg(null);
    }
  }, [patient, doctors]);

  if (!isOpen || !patient) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await onUpdate(patient.id, {
        contactPhone: contact.trim(),
        emergencyContact: emergencyContact.trim(),
        bloodGroup,
        triageCategory,
        bedOrRoom,
        attendingPhysicianName: attendingPhysician,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update patient demographic records.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn select-none">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Update Patient Demographics & Intake Record
              </h2>
              <p className="text-xs text-slate-500">
                {patient.name} • {patient.mrn}
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

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Emergency Contact
              </label>
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Name / Relationship / Phone"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Blood Group
              </label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700 bg-white"
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Triage Acuity Priority
              </label>
              <select
                value={triageCategory}
                onChange={(e) => setTriageCategory(e.target.value as TriageCategory)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700 bg-white"
              >
                <option value="Routine">Routine General Consultation</option>
                <option value="Priority">Priority Follow-up</option>
                <option value="Urgent">Urgent / Acute Evaluation</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Assigned Attending Doctor
              </label>
              <select
                value={attendingPhysician}
                onChange={(e) => setAttendingPhysician(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700 bg-white"
              >
                {doctors && doctors.length > 0 ? (
                  doctors.map((d) => (
                    <option key={d.id || d.name} value={d.name}>
                      {d.name} ({d.room || 'Consultation Suite'})
                    </option>
                  ))
                ) : (
                  <option value="General Duty Medical Officer">General Duty Medical Officer (Room 101)</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Intake Bed / Location
              </label>
              <input
                type="text"
                value={bedOrRoom}
                onChange={(e) => setBedOrRoom(e.target.value)}
                placeholder="e.g. Waiting Area Bay 2 / Room 101"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-800 hover:bg-teal-900 text-white flex items-center gap-1.5 shadow-soft-sm transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving Changes...' : 'Save Demographics'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

