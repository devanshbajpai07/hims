import React from 'react';
import { Doctor } from '../../types';
import { Sparkles, MessageSquare, ChevronRight, Activity } from 'lucide-react';

interface ModernDoctorsProps {
  doctors: Doctor[];
  onToggleStatus?: (doctorId: string) => void;
}

export const ModernDoctors: React.FC<ModernDoctorsProps> = ({ doctors, onToggleStatus }) => {
  const getStatusBadge = (status: Doctor['status']) => {
    switch (status) {
      case 'Available':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Available
          </span>
        );
      case 'In Consultation':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Consultation
          </span>
        );
      case 'In Surgery':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            In OR
          </span>
        );
      case 'On Break':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Resting
          </span>
        );
      case 'Off Duty':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
            Offline
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 font-display">
            Physician Roster & Real-time Status
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            5 On-Shift Specialists • Integrated clinical paging
          </p>
        </div>
        <button
          onClick={() => alert('Broadcasting status sync ping to all attending clinicians')}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Page All
        </button>
      </div>

      <div className="divide-y divide-slate-100/90">
        {doctors.map((doc) => (
          <div
            key={doc.id}
            className="p-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-4 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={doc.avatar}
                  alt={doc.name}
                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-100 group-hover:ring-indigo-200 transition-all shadow-xs"
                />
                {doc.status === 'Available' && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {doc.name}
                  </h4>
                  {doc.onCall && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-100/70 text-amber-800">
                      On-Call
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 truncate font-medium">
                  {doc.specialty}
                </p>
                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 font-medium">
                  <span className="text-slate-600 font-semibold">{doc.room}</span>
                  <span>•</span>
                  <span>{doc.patientsToday} consults completed</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <span className="text-[10px] text-slate-400 block font-medium">
                  Next Opening
                </span>
                <span className="text-xs font-mono font-bold text-slate-800">
                  {doc.nextSlot}
                </span>
              </div>

              {getStatusBadge(doc.status)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
