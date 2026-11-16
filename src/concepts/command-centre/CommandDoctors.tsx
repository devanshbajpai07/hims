import React from 'react';
import { Doctor } from '../../types';
import { Radio, PhoneCall, AlertCircle } from 'lucide-react';

interface CommandDoctorsProps {
  doctors: Doctor[];
  onToggleStatus?: (doctorId: string) => void;
}

export const CommandDoctors: React.FC<CommandDoctorsProps> = ({ doctors, onToggleStatus }) => {
  const getStatusBadge = (status: Doctor['status']) => {
    switch (status) {
      case 'Available':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            AVAILABLE
          </span>
        );
      case 'In Consultation':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40">
            IN CLINIC
          </span>
        );
      case 'In Surgery':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
            SURGERY OR
          </span>
        );
      case 'On Break':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
            RESTING
          </span>
        );
      case 'Off Duty':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-500">
            OFFLINE
          </span>
        );
    }
  };

  return (
    <div className="bg-[#111827] rounded-lg border border-[#1F2E47] shadow-command-card overflow-hidden font-mono">
      <div className="p-3 bg-[#0E1524] border-b border-[#1F2E47] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-sky-400 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            ON-DUTY PHYSICIANS & OPERATIONAL ROSTER
          </h3>
        </div>
        <button
          onClick={() => alert('Broadcasting paging alert to active physicians')}
          className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-colors"
        >
          BROADCAST PAGE
        </button>
      </div>

      <div className="divide-y divide-[#1F2E47]">
        {doctors.map((doc) => (
          <div
            key={doc.id}
            className="p-3 hover:bg-[#162032] transition-colors flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={doc.avatar}
                  alt={doc.name}
                  className="w-8 h-8 rounded object-cover border border-[#243550]"
                />
                <span
                  className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                    doc.status === 'Available'
                      ? 'bg-emerald-400 animate-ping'
                      : doc.status === 'In Surgery'
                      ? 'bg-rose-400'
                      : 'bg-amber-400'
                  }`}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate">
                    {doc.name}
                  </span>
                  {doc.onCall && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                      ON-CALL
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {doc.specialty} • {doc.room}
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <div className="text-right hidden sm:block text-[10px]">
                <div className="text-slate-400">SLOT</div>
                <div className="text-sky-400 font-bold">{doc.nextSlot}</div>
              </div>
              {getStatusBadge(doc.status)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
