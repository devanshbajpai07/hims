import React from 'react';
import { CommandSidebar } from './CommandSidebar';
import { CommandHeader } from './CommandHeader';
import { CommandStats } from './CommandStats';
import { CommandSchedule } from './CommandSchedule';
import { CommandPatients } from './CommandPatients';
import { CommandDoctors } from './CommandDoctors';
import { HIMSContextState } from '../../types';
import { Activity, ShieldAlert, Zap, Radio, BellRing, BedDouble } from 'lucide-react';

export const CommandCentreDashboard: React.FC<HIMSContextState> = ({
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
    <div className="flex h-screen bg-[#0A0F1D] text-slate-100 font-mono overflow-hidden">
      {/* Command Cockpit Sidebar */}
      <CommandSidebar
        openRegisterModal={openRegisterModal}
        openScheduleModal={openScheduleModal}
      />

      {/* Main Console Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Command Header */}
        <CommandHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          openRegisterModal={openRegisterModal}
          openScheduleModal={openScheduleModal}
        />

        {/* Ticker Banner */}
        <div className="bg-[#111827] border-b border-[#1F2E47] px-6 py-2 flex items-center justify-between text-xs overflow-x-auto text-slate-300">
          <div className="flex items-center gap-4 whitespace-nowrap">
            <span className="flex items-center gap-1.5 text-sky-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              STATUS FEED:
            </span>
            <span>TRAUMA OR-2: OPEN</span>
            <span className="text-slate-600">|</span>
            <span>ER TRIAGE QUEUE: 4 PATIENTS (AVG WAIT 12 MIN)</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400">CARDIAC CATH LAB: IDLE</span>
            <span className="text-slate-600">|</span>
            <span>CODE SILVER: NONE</span>
          </div>
          <div className="text-[10px] text-slate-400 hidden md:block">
            SECURITY PROTOCOL: ENCRYPTED AES-256
          </div>
        </div>

        {/* Scrollable Cockpit Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* Concept Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-1">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400 mb-0.5">
                <Activity className="w-3.5 h-3.5" />
                <span>CONCEPT 3: CLINICAL COMMAND CENTRE ARCHITECTURE</span>
              </div>
              <h1 className="text-lg md:text-xl font-black tracking-tight text-white uppercase">
                EMERGENCY OPERATIONS & CENTRAL DISPATCH HUB
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                High information density, immediate situational awareness, and high-contrast OLED-ready visual hierarchy.
              </p>
            </div>

            {/* Quick Actions (Command Centre) */}
            <div className="flex items-center gap-2">
              <button
                onClick={openScheduleModal}
                className="px-3 py-1.5 text-xs font-bold bg-[#162032] hover:bg-[#1C2940] border border-[#243550] text-slate-200 rounded transition-colors flex items-center gap-1.5"
              >
                <span>[F2] DISPATCH SLOT</span>
              </button>

              <button
                onClick={openRegisterModal}
                className="px-3.5 py-1.5 text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>[F1] RAPID INTAKE</span>
              </button>
            </div>
          </div>

          {/* High Density Metric Cards */}
          <CommandStats stats={stats} />

          {/* Core Telemetry Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left 7 cols: Schedule Data Table */}
            <div className="lg:col-span-7 space-y-4">
              <CommandSchedule
                appointments={appointments}
                openScheduleModal={openScheduleModal}
                searchFilter={searchQuery}
              />
            </div>

            {/* Right 5 cols: Patient Triage & Duty Roster */}
            <div className="lg:col-span-5 space-y-4">
              <CommandPatients
                patients={patients}
                openRegisterModal={openRegisterModal}
                searchFilter={searchQuery}
              />
              <CommandDoctors doctors={doctors} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
