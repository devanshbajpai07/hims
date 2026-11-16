import React from 'react';
import { Patient } from '../../types';
import { User, Activity, Clock, ShieldAlert, ArrowRight } from 'lucide-react';

interface MinimalPatientsProps {
  patients: Patient[];
  openRegisterModal: () => void;
  searchFilter: string;
}

export const MinimalPatients: React.FC<MinimalPatientsProps> = ({
  patients,
  openRegisterModal,
  searchFilter,
}) => {
  const filtered = patients.filter(
    (p) =>
      searchFilter === '' ||
      p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.mrn.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.chiefComplaint.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const getTriagePill = (category: Patient['triageCategory']) => {
    switch (category) {
      case 'Critical':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            Critical
          </span>
        );
      case 'Urgent':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Urgent
          </span>
        );
      case 'Priority':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
            Priority
          </span>
        );
      case 'Routine':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Routine
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/70 shadow-soft-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Recent Patient Registrations
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time intake queue with triage classification
          </p>
        </div>
        <button
          onClick={openRegisterModal}
          className="text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors"
        >
          + Register
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {filtered.slice(0, 5).map((patient) => (
          <div
            key={patient.id}
            className="p-4 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
                {patient.gender === 'F' ? '♀' : '♂'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {patient.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {patient.mrn}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                    {patient.age}y • {patient.bloodGroup}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {patient.chiefComplaint}
                </p>
                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                  <span>{patient.department}</span>
                  <span>•</span>
                  <span>Assigned: {patient.attendingPhysician}</span>
                  <span>•</span>
                  <span>{patient.registeredAt}</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
              {getTriagePill(patient.triageCategory)}
              <span className="text-[10px] text-slate-400 font-mono">
                {patient.bedOrRoom}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
        <button className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 transition-colors">
          <span>View All Patient Records in Registry</span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
        </button>
      </div>
    </div>
  );
};
