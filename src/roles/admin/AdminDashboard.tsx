import React, { useMemo } from 'react';
import { Appointment, Patient, StaffMember, Doctor } from '../../types';
import {
  Users,
  Calendar,
  CheckCircle2,
  Building2,
  TrendingUp,
  Clock,
  DoorOpen,
} from 'lucide-react';

interface AdminDashboardProps {
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
  staff: StaffMember[];
  searchQuery: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  appointments,
  patients,
  doctors,
  staff,
  searchQuery,
}) => {
  // Operational calculations
  const totalAppointments = appointments.length;
  const completedAppointments = appointments.filter((a) => a.status === 'completed').length;
  const inProgressAppointments = appointments.filter((a) => a.status === 'in-progress').length;
  const checkedInWaiting = appointments.filter((a) => a.status === 'checked-in').length;
  const pendingAppointments = appointments.filter((a) => a.status === 'pending').length;

  const completionRate =
    totalAppointments > 0
      ? Math.round(((completedAppointments + inProgressAppointments) / totalAppointments) * 100)
      : 0;

  const roomUtilization =
    totalAppointments > 0
      ? Math.min(100, Math.round(((completedAppointments + inProgressAppointments) / totalAppointments) * 100))
      : 0;

  const newIntakesToday = useMemo(() => {
    return patients.filter((p) => {
      const reg = (p.registeredAt || '').toLowerCase();
      return reg.includes('today') || reg.includes('just') || reg.includes(new Date().toISOString().split('T')[0]);
    }).length;
  }, [patients]);

  // Dynamic hourly distribution computed directly from live appointment records
  const hourlySlots = useMemo(() => {
    const slotsMap: Record<string, { total: number; completed: number; active: number }> = {
      '08:00 - 10:00': { total: 0, completed: 0, active: 0 },
      '10:00 - 12:00': { total: 0, completed: 0, active: 0 },
      '12:00 - 14:00': { total: 0, completed: 0, active: 0 },
      '14:00 - 16:00': { total: 0, completed: 0, active: 0 },
      '16:00 - 18:00': { total: 0, completed: 0, active: 0 },
    };

    appointments.forEach((apt) => {
      const t = apt.time || '';
      let bucket = '10:00 - 12:00';
      if (t.includes('08:') || t.includes('09:')) bucket = '08:00 - 10:00';
      else if (t.includes('10:') || t.includes('11:')) bucket = '10:00 - 12:00';
      else if (t.includes('12:') || t.includes('13:')) bucket = '12:00 - 14:00';
      else if (t.includes('14:') || t.includes('15:')) bucket = '14:00 - 16:00';
      else if (t.includes('16:') || t.includes('17:')) bucket = '16:00 - 18:00';

      if (slotsMap[bucket]) {
        slotsMap[bucket].total += 1;
        if (apt.status === 'completed') slotsMap[bucket].completed += 1;
        if (apt.status === 'in-progress' || apt.status === 'checked-in') slotsMap[bucket].active += 1;
      }
    });

    return Object.entries(slotsMap).map(([time, stats]) => ({
      time,
      ...stats,
    }));
  }, [appointments]);

  const receptionistStaff = staff.find((s) => s.role.toLowerCase().includes('reception'));

  return (
    <div className="space-y-6">
      {/* Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 mb-1">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            <span>Executive Administration Portal</span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
            Clinical Operations &amp; Resource Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Single-specialty clinical throughput, staff shift roster, patient registration velocity, and room utilization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-medium">
            Shift: Active Clinical Operations
          </span>
        </div>
      </div>

      {/* 4 Executive Operational KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-soft-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1.5">
            <span>Enrolled Patients</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-semibold text-slate-900">{patients.length}</div>
          <div className="text-[11px] text-teal-700 mt-0.5 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>{newIntakesToday} intakes registered today</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-soft-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1.5">
            <span>Today's Total Slots</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-semibold text-slate-900">{totalAppointments}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {completedAppointments} completed • {checkedInWaiting} in queue
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-soft-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1.5">
            <span>Shift Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-semibold text-slate-900">{completionRate}%</div>
          <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">
            Based on active appointments
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-soft-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1.5">
            <span>Clinical Room Utilization</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-semibold text-slate-900">{roomUtilization}%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Active examination suites
          </div>
        </div>
      </div>

      {/* Main Grid: Clinical Rooms + Hourly Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (6 cols): Clinical Exam Room Status */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200/80 shadow-soft-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Examination Suites &amp; Station Status
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical examination suites and front-desk throughput.
              </p>
            </div>
            <DoorOpen className="w-4 h-4 text-slate-400" />
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {doctors.length > 0 ? (
              doctors.map((doc, idx) => {
                const activeConsultation = appointments.find(
                  (a) => (a.doctorName === doc.name || a.doctorName.includes(doc.name)) && a.status === 'in-progress'
                );
                const waitingPatient = appointments.find(
                  (a) => (a.doctorName === doc.name || a.doctorName.includes(doc.name)) && a.status === 'checked-in'
                );
                const roomName = doc.room || `Exam Room 10${idx + 1}`;
                const isOccupied = !!activeConsultation;

                return (
                  <div
                    key={doc.id || idx}
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      isOccupied ? 'border-teal-200 bg-teal-50/20' : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                          isOccupied ? 'bg-teal-50 border border-teal-200 text-teal-800' : 'bg-slate-100 border border-slate-200 text-slate-700'
                        }`}
                      >
                        {idx + 101}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          {roomName} — {doc.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {activeConsultation
                            ? `Currently: In Consultation (${activeConsultation.patientName} • ${activeConsultation.type})`
                            : waitingPatient
                            ? `Currently: Ready for next patient (${waitingPatient.patientName} in queue)`
                            : 'Currently: Available for next scheduled consultation'}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isOccupied ? 'bg-teal-100 text-teal-800' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isOccupied ? 'Occupied' : 'Available'}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                No active clinical suites configured.
              </div>
            )}

            {/* Reception Station */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                  REC
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Reception Intake Station — {receptionistStaff ? receptionistStaff.name : 'Front Desk Coordinator'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Front-desk check-in, patient queue triage, and registration
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (6 cols): Appointment Load Distribution */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200/80 shadow-soft-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Appointment Hourly Load Distribution
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Consultation distribution across the General Medicine shift.
              </p>
            </div>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>

          <div className="p-4 sm:p-6 space-y-3.5">
            {hourlySlots.map((slot, i) => (
              <div key={i} className="text-xs">
                <div className="flex items-center justify-between text-slate-700 mb-1">
                  <span className="font-medium font-mono text-[11px]">{slot.time}</span>
                  <span className="text-slate-500">
                    {slot.completed > 0 ? (
                      <span className="text-emerald-700 font-medium">
                        {slot.completed} completed
                      </span>
                    ) : slot.active > 0 ? (
                      <span className="text-teal-700 font-medium">
                        {slot.active} active / waiting
                      </span>
                    ) : (
                      <span>{slot.total} scheduled</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                  {slot.completed > 0 && (
                    <div
                      className="bg-emerald-600 h-full"
                      style={{ width: `${(slot.completed / (slot.total || 1)) * 100}%` }}
                    />
                  )}
                  {slot.active > 0 && (
                    <div
                      className="bg-teal-700 h-full"
                      style={{ width: `${(slot.active / (slot.total || 1)) * 100}%` }}
                    />
                  )}
                  {slot.total - slot.completed - slot.active > 0 && (
                    <div
                      className="bg-slate-300 h-full"
                      style={{
                        width: `${
                          ((slot.total - slot.completed - slot.active) / (slot.total || 1)) * 100
                        }%`,
                      }}
                    />
                  )}
                </div>
              </div>
            ))}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600" /> Completed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-700" /> In Session / Waiting
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300" /> Scheduled
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
