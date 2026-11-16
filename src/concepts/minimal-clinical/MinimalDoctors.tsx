import React from 'react';
import { Doctor } from '../../types';
import { Phone, CheckCircle, Clock, AlertTriangle, Shield } from 'lucide-react';

interface MinimalDoctorsProps {
  doctors: Doctor[];
  onToggleStatus?: (doctorId: string) => void;
}

export const MinimalDoctors: React.FC<MinimalDoctorsProps> = ({ doctors, onToggleStatus }) => {
  const getStatusColor = (status: Doctor['status']) => {
    switch (status) {
      case 'Available':
        return {
          dot: 'bg-emerald-500',
          text: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        };
      case 'In Consultation':
        return {
          dot: 'bg-teal-500',
          text: 'text-teal-700 bg-teal-50 border-teal-200',
        };
      case 'In Surgery':
        return {
          dot: 'bg-indigo-500',
          text: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        };
      case 'On Break':
        return {
          dot: 'bg-amber-500',
          text: 'text-amber-700 bg-amber-50 border-amber-200',
        };
      case 'Off Duty':
        return {
          dot: 'bg-slate-400',
          text: 'text-slate-600 bg-slate-100 border-slate-200',
        };
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/70 shadow-soft-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Attending Medical Staff Availability
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            5 On-Duty Specialists • Live clinic room allocation
          </p>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
          Shift: Day 08:00 - 18:00
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {doctors.map((doc) => {
          const statusStyle = getStatusColor(doc.status);
          return (
            <div
              key={doc.id}
              className="p-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={doc.avatar}
                    alt={doc.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${statusStyle.dot}`}
                  />
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate flex items-center gap-2">
                    <span>{doc.name}</span>
                    {doc.onCall && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        On-Call
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{doc.title}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{doc.room}</span>
                    <span>•</span>
                    <span>{doc.patientsToday} patients seen today</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] text-slate-400">Next Slot</div>
                  <div className="text-xs font-mono font-medium text-slate-700">
                    {doc.nextSlot}
                  </div>
                </div>

                <span
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${statusStyle.text}`}
                >
                  {doc.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
