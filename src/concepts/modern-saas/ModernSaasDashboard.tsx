import React from 'react';
import { ModernSidebar } from './ModernSidebar';
import { ModernHeader } from './ModernHeader';
import { ModernStats } from './ModernStats';
import { ModernSchedule } from './ModernSchedule';
import { ModernPatients } from './ModernPatients';
import { ModernDoctors } from './ModernDoctors';
import { HIMSContextState } from '../../types';
import { Sparkles, CalendarPlus, UserPlus, Filter, Download } from 'lucide-react';

export const ModernSaasDashboard: React.FC<HIMSContextState> = ({
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
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      {/* Dark Modern Sidebar */}
      <ModernSidebar
        openRegisterModal={openRegisterModal}
        openScheduleModal={openScheduleModal}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <ModernHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          openRegisterModal={openRegisterModal}
          openScheduleModal={openScheduleModal}
        />

        {/* Dashboard Workspace */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Header Action Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Concept 2: Modern SaaS Architecture</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 font-display">
                Clinical Operations & Patient Flow
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Refined typography, micro-elevations, live presence indicators, and rapid keyboard-friendly navigation.
              </p>
            </div>

            {/* Quick Actions (Modern SaaS) */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={openScheduleModal}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-1.5"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-slate-500" />
                <span>Schedule Slot</span>
              </button>

              <button
                onClick={openRegisterModal}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-sm shadow-indigo-600/20 hover:shadow-indigo-600/35 flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register Patient</span>
              </button>
            </div>
          </div>

          {/* SaaS Metric Cards */}
          <ModernStats stats={stats} />

          {/* Dynamic Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 cols: Schedule */}
            <div className="lg:col-span-7 space-y-6">
              <ModernSchedule
                appointments={appointments}
                openScheduleModal={openScheduleModal}
                searchFilter={searchQuery}
              />
            </div>

            {/* Right 5 cols: Patient Intake & Doctors */}
            <div className="lg:col-span-5 space-y-6">
              <ModernPatients
                patients={patients}
                openRegisterModal={openRegisterModal}
                searchFilter={searchQuery}
              />
              <ModernDoctors doctors={doctors} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
