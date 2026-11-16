import React from 'react';
import {
  Sparkles,
  Check,
  DoorOpen,
  Users,
  Activity,
  Calendar,
  Clock,
  ShieldCheck,
  PlayCircle,
  ArrowRight,
} from 'lucide-react';

interface ProductIntroSectionProps {
  onLaunchApp: () => void;
}

export const ProductIntroSection: React.FC<ProductIntroSectionProps> = ({ onLaunchApp }) => {
  return (
    <section id="platform" className="py-24 px-6 bg-[#FAF7F2] border-t border-stone-200/60 select-none">
      <div className="max-w-6xl mx-auto">
        {/* Section Heading */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            <span>The Platform</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-sans text-slate-950 tracking-tight leading-tight">
            Designed to restore sanity and quiet confidence to medical operations.
          </h2>
          <p className="mt-5 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            Legacy hospital software was built for billing accountants, not doctors or front-desk coordinators. AURA strips away every piece of redundant UI chrome, presenting only the decisive tasks each role requires to deliver exceptional care.
          </p>
        </div>

        {/* High-Fidelity Product UI Preview Frame */}
        <div className="relative rounded-2xl border border-slate-200/90 bg-white shadow-soft-lg overflow-hidden group">
          {/* Mock Window Top Bar */}
          <div className="h-11 px-4 bg-slate-100/90 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-3 text-[11px] font-mono text-slate-500">
                st-jude.aura-health.app/general-medicine
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
                General Medicine • Single Specialty
              </span>
              <button
                onClick={onLaunchApp}
                className="text-xs font-semibold text-teal-800 hover:text-teal-900 flex items-center gap-1 pl-2 transition-colors cursor-pointer"
              >
                <span>Launch Interactive Prototype</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive UI Mock View */}
          <div className="p-6 md:p-8 space-y-6">
            {/* Mock Header & Role Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/70">
              <div>
                <span className="text-xs font-semibold text-teal-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                  Active Doctor Portal
                </span>
                <div className="text-lg font-semibold text-slate-900 mt-0.5">
                  Consultation Flow — Attending Physician (Exam Room 101)
                </div>
              </div>

              {/* Persona Navigation Pills */}
              <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-full text-xs font-medium border border-slate-200 self-start sm:self-auto">
                <span className="px-3 py-1 rounded-full bg-teal-800 text-white font-semibold shadow-xs">
                  Doctor
                </span>
                <span className="px-3 py-1 rounded-full text-slate-600">
                  Receptionist
                </span>
                <span className="px-3 py-1 rounded-full text-slate-600">
                  Administrator
                </span>
              </div>
            </div>

            {/* Mock Metric Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-soft-sm">
                <div className="text-[11px] text-slate-400 font-medium">My Schedule Today</div>
                <div className="text-xl font-bold text-slate-900 mt-0.5 font-mono">8 Slots</div>
              </div>
              <div className="bg-teal-50/40 p-3.5 rounded-xl border border-teal-200 shadow-soft-sm">
                <div className="text-[11px] text-teal-800 font-medium">Patients Waiting Outside</div>
                <div className="text-xl font-bold text-teal-900 mt-0.5 font-mono">2 Ready</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-soft-sm">
                <div className="text-[11px] text-slate-400 font-medium">Completed Consults</div>
                <div className="text-xl font-bold text-slate-900 mt-0.5 font-mono">4 Concluded</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-soft-sm">
                <div className="text-[11px] text-slate-400 font-medium">Assigned Exam Room</div>
                <div className="text-xl font-bold text-slate-900 mt-0.5 font-mono">Room 101</div>
              </div>
            </div>

            {/* Mock Active Hero & Queue */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8 p-4 rounded-xl border border-teal-200 bg-teal-50/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs">
                    <PlayCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      Admitted Patient (MRN-90214) — In Room 101
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Hypertension follow-up • BP: 138/88 mmHg • HR: 74 bpm
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-teal-900 bg-white px-3 py-1 rounded-md border border-teal-200 shadow-soft-sm">
                  Reviewing EMR
                </span>
              </div>

              <div className="md:col-span-4 p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Next: David Kim</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Waiting in Bay 2 (12m)</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  CALL NEXT
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Core Value Props */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-xl border border-slate-200/80 bg-slate-50/40">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Reduced Visual Density
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-light">
              Doctors make split-second clinical evaluations. We eliminate flashing warning banners, irrelevant billing fields, and dense nested tables in favor of high-legibility medical editorial typography.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200/80 bg-slate-50/40">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              1-Click Arrival Flow
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-light">
              Receptionists check in patients with one touch. The doctor's queue instantly updates with arrival timestamps, vitals, and chief complaints—removing intercom interruptions and clipboard delays.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200/80 bg-slate-50/40">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Executive Transparency
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-light">
              Hospital administrators gain live oversight over room occupancy, physician throughput, and daily registration velocity without disturbing clinical consultations.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
