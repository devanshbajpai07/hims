import React from 'react';
import { Patient } from '../../types';
import { ShieldAlert, AlertTriangle, UserPlus, ArrowRight, HeartPulse } from 'lucide-react';

interface CommandPatientsProps {
  patients: Patient[];
  openRegisterModal: () => void;
  searchFilter: string;
}

export const CommandPatients: React.FC<CommandPatientsProps> = ({
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
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse">
            CRITICAL P1
          </span>
        );
      case 'Urgent':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/50">
            URGENT P2
          </span>
        );
      case 'Priority':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/50">
            PRIORITY P3
          </span>
        );
      case 'Routine':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">
            ROUTINE P4
          </span>
        );
    }
  };

  return (
    <div className="bg-[#111827] rounded-lg border border-[#1F2E47] shadow-command-card overflow-hidden font-mono">
      <div className="p-3 bg-[#0E1524] border-b border-[#1F2E47] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-rose-400 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            TRIAGE STREAM & INTAKE LOG
          </h3>
        </div>
        <button
          onClick={openRegisterModal}
          className="text-xs font-bold text-sky-400 hover:text-sky-300"
        >
          [+ REGISTER PATIENT]
        </button>
      </div>

      <div className="divide-y divide-[#1F2E47]">
        {filtered.slice(0, 4).map((patient) => (
          <div
            key={patient.id}
            className="p-3 hover:bg-[#162032] transition-colors flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-100 truncate">
                  {patient.name}
                </span>
                <span className="text-[10px] text-sky-400 font-mono">
                  {patient.mrn}
                </span>
                <span className="text-[10px] text-slate-400 px-1 rounded bg-[#0A0F1D] border border-slate-800">
                  {patient.age}Y • {patient.gender} • {patient.bloodGroup}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-1">
                {patient.chiefComplaint}
              </p>
              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-1">
                <span className="text-slate-400 font-bold">{patient.department}</span>
                <span>•</span>
                <span>ATTENDING: {patient.attendingPhysician}</span>
                <span>•</span>
                <span>{patient.registeredAt}</span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
              {getTriagePill(patient.triageCategory)}
              <span className="text-[10px] text-slate-400 bg-[#0A0F1D] px-1.5 py-0.5 rounded border border-[#1F2E47]">
                BAY: {patient.bedOrRoom}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-2.5 bg-[#0E1524] border-t border-[#1F2E47] text-center">
        <button
          onClick={() => alert('Accessing central medical records repository')}
          className="text-[11px] font-bold text-slate-400 hover:text-sky-400 inline-flex items-center gap-1.5 transition-colors"
        >
          <span>VIEW COMPLETE EMR REGISTRY (1,482 RECORDS)</span>
          <ArrowRight className="w-3 h-3 text-sky-400" />
        </button>
      </div>
    </div>
  );
};
