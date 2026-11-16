import React, { useState } from 'react';
import { Appointment } from '../../types';
import { Clock, MapPin, MoreHorizontal, Calendar, ChevronRight, Check } from 'lucide-react';

interface ModernScheduleProps {
  appointments: Appointment[];
  openScheduleModal: () => void;
  searchFilter: string;
}

export const ModernSchedule: React.FC<ModernScheduleProps> = ({
  appointments,
  openScheduleModal,
  searchFilter,
}) => {
  const [filter, setFilter] = useState<'all' | 'in-progress' | 'pending' | 'completed'>('all');

  const filtered = appointments.filter((apt) => {
    const matchFilter = filter === 'all' ? true : apt.status === filter;
    const matchSearch =
      searchFilter === '' ||
      apt.patientName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      apt.doctorName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      apt.department.toLowerCase().includes(searchFilter.toLowerCase());
    return matchFilter && matchSearch;
  });

  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            Active Visit
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Waiting Room
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <Check className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/80">
            Confirmed
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
      {/* Header bar */}
      <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 font-display">
              Patient Consultation Schedule
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-100 text-slate-700">
              {filtered.length} today
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-wing appointments with doctor room sync
          </p>
        </div>

        {/* Linear style segmented switch */}
        <div className="flex items-center bg-slate-100/80 p-1 rounded-xl text-xs font-medium border border-slate-200/60 self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'in-progress', label: 'Active' },
              { id: 'pending', label: 'Waiting' },
              { id: 'completed', label: 'Concluded' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Appointment Rows */}
      <div className="divide-y divide-slate-100/90">
        {filtered.map((apt) => (
          <div
            key={apt.id}
            className="p-4 sm:px-6 hover:bg-slate-50/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
          >
            {/* Slot & Patient Info */}
            <div className="flex items-center gap-4">
              <div className="w-20 shrink-0 text-left">
                <span className="text-xs font-bold font-mono text-slate-900 block">
                  {apt.time}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {apt.duration}
                </span>
              </div>

              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-200/80 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0 shadow-xs">
                {apt.patientName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer">
                    {apt.patientName}
                  </h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                    {apt.patientMrn}
                  </span>
                  {apt.priority === 'High' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200/60">
                      Priority
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">
                  {apt.type}
                </div>
              </div>
            </div>

            {/* Doctor & Room */}
            <div className="flex items-center gap-6 md:px-4">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  {apt.doctorName}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span>{apt.department}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {apt.room}
                  </span>
                </div>
              </div>
            </div>

            {/* Status & Menu */}
            <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
              {getStatusBadge(apt.status)}
              <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer bar */}
      <div className="p-4 px-6 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Sync status: <strong className="text-emerald-600 font-medium">Active (WebSocket connected)</strong>
        </span>
        <button
          onClick={openScheduleModal}
          className="font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 transition-colors"
        >
          <span>Schedule New Appointment</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
