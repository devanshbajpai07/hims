import React from 'react';
import { MinimalSidebar } from './MinimalSidebar';
import { MinimalHeader } from './MinimalHeader';
import { MinimalStats } from './MinimalStats';
import { MinimalSchedule } from './MinimalSchedule';
import { MinimalPatients } from './MinimalPatients';
import { MinimalDoctors } from './MinimalDoctors';
import { HIMSContextState } from '../../types';
import { Plus, UserPlus, CalendarPlus, Sparkles, HeartPulse } from 'lucide-react';

export const MinimalClinicalDashboard: React.FC<HIMSContextState> = ({
  patients,
  appointments,
  doctors,
  stats,
  searchQuery,
  setSearchQuery,
  openRegisterModal,
  openScheduleModal,
}) => {
  return (
    <div className="flex h-screen bg-[#FAF7F2] text-slate-800 font-sans overflow-hidden">
      {/* Sidebar */}
      <MinimalSidebar
        openRegisterModal={openRegisterModal}
        openScheduleModal={openScheduleModal}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <MinimalHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          openRegisterModal={openRegisterModal}
          openScheduleModal={openScheduleModal}
        />

        {/* Scrollable Canvas */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Concept Header & Calm Context */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-teal-800 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                <span>Concept 1: Minimal Clinical Direction</span>
              </div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                Cardiology & Multi-Specialty Outpatient Hub
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Restrained Nordic aesthetics, optimal contrast ratio, and reduced cognitive load for high-stress clinical shifts.
              </p>
            </div>

            {/* Quick Actions (Minimalist) */}
            <div className="flex items-center gap-2">
              <button
                onClick={openRegisterModal}
                className="px-3.5 py-2 text-xs font-medium text-teal-900 bg-teal-50 hover:bg-teal-100/90 border border-teal-200/80 rounded-lg flex items-center gap-1.5 transition-colors shadow-soft-sm"
              >
                <UserPlus className="w-3.5 h-3.5 text-teal-700" />
                <span>Register Patient</span>
              </button>
              <button
                onClick={openScheduleModal}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg flex items-center gap-1.5 transition-colors shadow-soft-sm"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>Schedule Slot</span>
              </button>
            </div>
          </div>

          {/* Overview Statistics */}
          <MinimalStats stats={stats} />

          {/* Core Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (7 cols): Today's Schedule */}
            <div className="lg:col-span-7 space-y-6">
              <MinimalSchedule
                appointments={appointments}
                openScheduleModal={openScheduleModal}
                searchFilter={searchQuery}
              />
            </div>

            {/* Right Column (5 cols): Patient Intake & Doctor Roster */}
            <div className="lg:col-span-5 space-y-6">
              <MinimalPatients
                patients={patients}
                openRegisterModal={openRegisterModal}
                searchFilter={searchQuery}
              />
              <MinimalDoctors doctors={doctors} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
