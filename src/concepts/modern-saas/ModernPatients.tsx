import React from 'react';
import { Patient } from '../../types';
import { User, Activity, Clock, ArrowRight, UserPlus, FileText } from 'lucide-react';

interface ModernPatientsProps {
  patients: Patient[];
  openRegisterModal: () => void;
  searchFilter: string;
}

export const ModernPatients: React.FC<ModernPatientsProps> = ({
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

  const getAcuityBadge = (category: Patient['triageCategory']) => {
    switch (category) {
      case 'Critical':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
            Critical (P1)
          </span>
        );
      case 'Urgent':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
            Urgent (P2)
          </span>
        );
      case 'Priority':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
            Priority (P3)
          </span>
        );
      case 'Routine':
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
            Routine (P4)
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 font-display">
            Recent Patient Intake
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Admissions and triage classification stream
          </p>
        </div>
        <button
          onClick={openRegisterModal}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>New Intake</span>
        </button>
      </div>

      <div className="divide-y divide-slate-100/90">
        {filtered.slice(0, 4).map((patient) => (
          <div
            key={patient.id}
            className="p-4 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3 group"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0 border border-slate-200/60">
                {patient.gender === 'F' ? '♀' : '♂'}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                    {patient.name}
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    {patient.mrn}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                    {patient.age}y • {patient.bloodGroup}
                  </span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-1 mt-1 font-medium">
                  {patient.chiefComplaint}
                </p>

                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1.5">
                  <span className="text-indigo-600 font-semibold">{patient.department}</span>
                  <span>•</span>
                  <span>{patient.attendingPhysician}</span>
                  <span>•</span>
                  <span>{patient.registeredAt}</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1.5">
              {getAcuityBadge(patient.triageCategory)}
              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                {patient.bedOrRoom}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-slate-50/70 border-t border-slate-100 text-center">
        <button className="text-xs font-semibold text-slate-600 hover:text-indigo-600 inline-flex items-center gap-1.5 transition-colors">
          <FileText className="w-3.5 h-3.5" />
          <span>Open Full Patient Directory (1,482)</span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
        </button>
      </div>
    </div>
  );
};
