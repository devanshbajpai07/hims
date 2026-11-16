import React, { useState } from 'react';
import { Appointment } from '../../types';
import { Clock, MapPin, Play, Check, Filter, Terminal, User } from 'lucide-react';

interface CommandScheduleProps {
  appointments: Appointment[];
  openScheduleModal: () => void;
  searchFilter: string;
}

export const CommandSchedule: React.FC<CommandScheduleProps> = ({
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
      apt.patientMrn.toLowerCase().includes(searchFilter.toLowerCase()) ||
      apt.doctorName.toLowerCase().includes(searchFilter.toLowerCase());
    return matchFilter && matchSearch;
  });

  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/50">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            IN SESSION
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            QUEUED
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Check className="w-3 h-3 text-emerald-400" />
            DISCHARGED
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-700 text-slate-300 border border-slate-600">
            CONFIRMED
          </span>
        );
    }
  };

  return (
    <div className="bg-[#111827] rounded-lg border border-[#1F2E47] shadow-command-card overflow-hidden font-mono">
      {/* Table Header Controls */}
      <div className="p-3.5 bg-[#0E1524] border-b border-[#1F2E47] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            CLINICAL APPOINTMENT SCHEDULE & ACTIVE ROSTER
          </h3>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded border border-slate-700">
            TOTAL: {filtered.length}
          </span>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 bg-[#0A0F1D] p-1 rounded border border-[#1F2E47] text-[11px]">
          {(
            [
              { id: 'all', label: 'ALL' },
              { id: 'in-progress', label: 'IN SESSION' },
              { id: 'pending', label: 'QUEUED' },
              { id: 'completed', label: 'DONE' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                filter === tab.id
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dense Data Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#0A0F1D] text-slate-400 text-[10px] border-b border-[#1F2E47] uppercase tracking-wider">
              <th className="py-2 px-3">Slot</th>
              <th className="py-2 px-3">Patient / MRN</th>
              <th className="py-2 px-3">Physician</th>
              <th className="py-2 px-3">Wing / Bay</th>
              <th className="py-2 px-3">Protocol / Type</th>
              <th className="py-2 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2E47] text-slate-200">
            {filtered.map((apt) => (
              <tr
                key={apt.id}
                className="hover:bg-[#162032] transition-colors group cursor-pointer"
                onClick={() => alert(`Reviewing slot: ${apt.patientName} - ${apt.type}`)}
              >
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="font-bold text-white text-xs">{apt.time}</div>
                  <div className="text-[10px] text-slate-500">{apt.duration}</div>
                </td>

                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="font-bold text-sky-300 group-hover:text-sky-200 flex items-center gap-1.5">
                    <span>{apt.patientName}</span>
                    {apt.priority === 'High' && (
                      <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        PRIORITY
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">{apt.patientMrn}</div>
                </td>

                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="text-white text-xs font-medium">{apt.doctorName}</div>
                  <div className="text-[10px] text-slate-400">{apt.department}</div>
                </td>

                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className="px-1.5 py-0.5 rounded bg-[#0A0F1D] border border-[#243550] text-[11px] text-slate-300">
                    {apt.room}
                  </span>
                </td>

                <td className="py-2.5 px-3">
                  <div className="text-xs text-slate-300 line-clamp-1">{apt.type}</div>
                </td>

                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  {getStatusBadge(apt.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Status Bar */}
      <div className="p-2.5 px-3 bg-[#0E1524] border-t border-[#1F2E47] flex items-center justify-between text-[11px] text-slate-400">
        <span>GRID REFRESH INTERVAL: 3000ms</span>
        <button
          onClick={openScheduleModal}
          className="text-sky-400 hover:text-sky-300 font-bold"
        >
          [+ INJECT SLOT F2]
        </button>
      </div>
    </div>
  );
};
