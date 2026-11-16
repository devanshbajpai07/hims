import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  Stethoscope,
  BarChart3,
  ArrowRight,
  Activity,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { FlowingBackgroundLines } from './FlowingBackgroundLines';

export const ConnectedEcosystemSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps = [
    {
      id: 0,
      role: 'Patient',
      person: 'Patient Intake',
      action: 'Online Registration & Arrival',
      desc: 'Patient arrives at General Medicine clinic with acute or routine health complaint.',
      badge: 'Step 1: Arrival',
      icon: Users,
      color: 'border-sky-500/50 text-sky-400 bg-sky-500/10',
    },
    {
      id: 1,
      role: 'Receptionist',
      person: 'Reception Coordinator',
      action: '1-Click Arrival Check-In',
      desc: 'Front desk coordinator logs vitals, verifies identity, and clicks "Check In". Status transitions immediately.',
      badge: 'Step 2: Front Desk Intake',
      icon: UserCheck,
      color: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10',
    },
    {
      id: 2,
      role: 'Attending Doctor',
      person: 'Attending Physician',
      action: 'Waiting Room Notification & EMR Review',
      desc: 'Doctor sees incoming patient appear instantly in Waiting Room with wait duration. 1-click calls patient into Exam Room 101.',
      badge: 'Step 3: Clinical Consultation',
      icon: Stethoscope,
      color: 'border-teal-500/50 text-teal-300 bg-teal-500/10',
    },
    {
      id: 3,
      role: 'Administrator',
      person: 'Hospital Administrator',
      action: 'Live Operations & Room Tracking',
      desc: 'Executive dashboard reflects room occupancy (85%) and shift completion metrics without disturbing doctor.',
      badge: 'Step 4: Operational Governance',
      icon: BarChart3,
      color: 'border-indigo-500/50 text-indigo-400 bg-indigo-500/10',
    },
  ];

  return (
    <section className="relative py-28 px-6 bg-obsidian-950 text-white overflow-hidden select-none border-t border-slate-900">
      {/* Dark mode flowing lines matching Native reference Image 2 */}
      <FlowingBackgroundLines theme="dark" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Section Heading (Native Reference Style: Serif Headline in Dark Theme) */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>The Connected Ecosystem</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-sans text-white tracking-tight leading-tight">
            One continuous data loop across all four hospital personas.
          </h2>
          <p className="mt-5 text-base sm:text-lg text-slate-400 font-normal leading-relaxed">
            When a patient walks through the clinic doors, data flows effortlessly between the front desk, the consultation suite, and executive governance. No paper clipboards. No verbal intercom interruptions.
          </p>
        </div>

        {/* Interactive Animated Ecosystem Diagram */}
        <div className="rounded-2xl border border-white/10 bg-obsidian-900/80 backdrop-blur-md p-6 md:p-10 shadow-2xl">
          {/* Top Stage Indicator Pills */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isActive = activeStep === idx;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStep(idx)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'border-emerald-500/80 bg-emerald-500/10 ring-1 ring-emerald-500/50 shadow-native-glow'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      0{idx + 1}
                    </span>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </div>
                  <div className="text-xs font-bold text-white">{s.role}</div>
                  <div className="text-[11px] text-slate-400 truncate">{s.person}</div>
                </button>
              );
            })}
          </div>

          {/* Interactive Flow Stage Details */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pt-6 border-t border-white/10">
            <div className="md:col-span-7 space-y-4">
              <span className="text-xs font-mono font-medium text-emerald-400 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                {steps[activeStep].badge}
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold font-sans text-white leading-snug">
                {steps[activeStep].action}
              </h3>
              <p className="text-sm text-slate-300 font-light leading-relaxed">
                {steps[activeStep].desc}
              </p>

              <div className="pt-4 flex items-center gap-4 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Real-time Synchronization
                </span>
                <span>Latency: &lt;15ms</span>
              </div>
            </div>

            {/* Visual Micro-Terminal Card */}
            <div className="md:col-span-5 p-5 rounded-xl bg-obsidian-800/90 border border-white/10 font-mono text-xs text-slate-300 space-y-3 shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 text-[10px] text-slate-400">
                <span>SIGNAL FEED: GENERAL_MED_BUS</span>
                <span className="text-emerald-400 font-bold">100% ONLINE</span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="text-slate-400 font-mono">
                  [08:50:00] PATIENT: Arrived at Reception Desk
                </div>
                <div className="text-emerald-400 font-mono">
                  [08:50:12] FRONT_DESK: Receptionist marked status = 'checked-in'
                </div>
                <div className="text-sky-300 font-mono">
                  [08:50:14] DOCTOR_QUEUE: Exam Room 101 notified (Attending Physician)
                </div>
                <div className="text-indigo-300 font-mono">
                  [08:50:15] ADMIN_OPS: Room 101 status transition pending (85% utilization)
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setActiveStep((prev) => (prev + 1) % 4)}
                  className="px-3 py-1 rounded text-[11px] font-sans font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                >
                  Next Step in Chain →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
