import React, { useState } from 'react';
import { Appointment } from '../../types';
import { Clock, MapPin, User, ChevronRight, CheckCircle2, PlayCircle, AlertCircle } from 'lucide-react';

interface MinimalScheduleProps {
  appointments: Appointment[];
  openScheduleModal: () => void;
  searchFilter: string;
}

export const MinimalSchedule: React.FC<MinimalScheduleProps> = ({
  appointments,
  openScheduleModal,
  searchFilter,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'in-progress' | 'pending' | 'completed'>('all');

  const filtered = appointments.filter((apt) => {
    const matchesFilter = activeFilter === 'all' ? true : apt.status === activeFilter;
    const matchesSearch =
      searchFilter === '' ||
      apt.patientName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      apt.doctorName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      apt.patientMrn.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
            In Consultation
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-400" />
            Queued
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200/60">
            <CheckCircle2 className="w-3 h-3 text-slate-400" />
            Concluded
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
            Confirmed
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/70 shadow-soft-sm overflow-hidden">
      {/* Card Header with Calm Tabs */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Today's Clinical Appointment Schedule
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            48 appointments programmed across outpatient specialties
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-200/70 rounded-lg text-xs">
          {(
            [
              { id: 'all', label: 'All Slots' },
              { id: 'in-progress', label: 'In Progress' },
              { id: 'pending', label: 'Pending' },
              { id: 'completed', label: 'Completed' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeFilter === tab.id
                  ? 'bg-white text-slate-800 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Items List */}
      <div className="divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No appointments matching the selected view criteria.
          </div>
        ) : (
          filtered.map((apt) => (
            <div
              key={apt.id}
              className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              {/* Left: Time & Room */}
              <div className="flex items-center gap-4 min-w-[180px]">
                <div className="w-16 shrink-0">
                  <div className="text-xs font-semibold text-slate-800 font-mono">
                    {apt.time}
                  </div>
                  <div className="text-[11px] text-slate-400">{apt.duration}</div>
                </div>

                <div className="h-8 w-px bg-slate-200 hidden md:block" />

                <div>
                  <div className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                    <span>{apt.patientName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {apt.patientMrn}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{apt.room}</span>
                  </div>
                </div>
              </div>

              {/* Middle: Clinical Details */}
              <div className="flex-1 md:px-4">
                <div className="text-xs font-medium text-slate-700">{apt.type}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className="text-slate-700 font-medium">{apt.doctorName}</span>
                  <span>•</span>
                  <span>{apt.department}</span>
                </div>
              </div>

              {/* Right: Status and Details link */}
              <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                {getStatusBadge(apt.status)}
                <button
                  className="text-xs font-medium text-teal-700 hover:text-teal-900 group-hover:translate-x-0.5 transition-all flex items-center gap-1"
                  onClick={() => alert(`Reviewing appointment slot for ${apt.patientName} (${apt.patientMrn})`)}
                >
                  <span>Review</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer link */}
      <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-6">
        <span>Showing {filtered.length} scheduled slots</span>
        <button
          onClick={openScheduleModal}
          className="font-medium text-teal-700 hover:text-teal-900 transition-colors"
        >
          + Add New Schedule Slot
        </button>
      </div>
    </div>
  );
};
