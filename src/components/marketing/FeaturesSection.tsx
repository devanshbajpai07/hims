import React from 'react';
import {
  Users,
  FileText,
  Calendar,
  Stethoscope,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="py-24 px-6 bg-[#FAF7F2] border-t border-stone-200/50 select-none font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Section Heading */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            <span>Core Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-sans text-slate-950 tracking-tight leading-tight">
            Six architectural pillars engineered for healthcare excellence.
          </h2>
          <p className="mt-5 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            Every feature is purpose-built to solve a specific clinical friction point—from front-desk queue congestion to electronic medical record retrieval.
          </p>
        </div>

        {/* Bento Grid Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Card 1: Patient Management & Triage (Large 7 cols) */}
          <div className="md:col-span-7 bg-white p-8 rounded-2xl border border-slate-200/80 shadow-soft-sm hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700 mb-6">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                01 • Patient Registry & Intake
              </span>
              <h3 className="text-2xl font-bold font-sans text-slate-950 mt-2 mb-3">
                Comprehensive patient identification without administrative friction.
              </h3>
              <p className="text-sm text-slate-600 font-normal leading-relaxed">
                Streamlined electronic medical record intake generates verified Medical Record Numbers (MRN), captures baseline vitals, logs chief complaints, and classifies clinical triage priority in seconds.
              </p>
            </div>

            {/* Interactive Preview Element */}
            <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs">
                  CV
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Arrived Patient (MRN-90214)</div>
                  <div className="text-[11px] text-slate-500">Triage: Priority 2 (Urgent Care)</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                Intake Complete
              </span>
            </div>
          </div>

          {/* Card 2: Consultations & Clinical Records (5 cols) */}
          <div className="md:col-span-5 bg-white p-8 rounded-2xl border border-slate-200/80 shadow-soft-sm hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700 mb-6">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                02 • Clinical File & EMR Drawer
              </span>
              <h3 className="text-2xl font-bold font-sans text-slate-950 mt-2 mb-3">
                Immediate access to clinical vitals and allergy warnings.
              </h3>
              <p className="text-sm text-slate-600 font-normal leading-relaxed">
                Physicians slide open patient histories during consultations: blood pressure trends, heart rate telemetry, allergy contraindications, and previous clinical notes with zero tab switching.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-[10px] text-slate-400 block font-medium">BP</span>
                <span className="font-bold text-slate-800 text-sm">122/80</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-[10px] text-slate-400 block font-medium">HR</span>
                <span className="font-bold text-slate-800 text-sm">72 bpm</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-[10px] text-slate-400 block font-medium">SpO2</span>
                <span className="font-bold text-slate-800 text-sm">98%</span>
              </div>
            </div>
          </div>

          {/* Card 3: Appointment Scheduling (4 cols) */}
          <div className="md:col-span-4 bg-white p-7 rounded-2xl border border-slate-200/80 shadow-soft-sm hover:border-slate-300 transition-all">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-700 mb-5">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              03 • Smart Slot Scheduling
            </span>
            <h4 className="text-lg font-bold font-sans text-slate-950 mt-2 mb-2">
              Slot duration and room allocation sync.
            </h4>
            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              Dynamically assigns appointment durations (20m, 30m, 45m) and maps slots directly to specific examination rooms to prevent scheduling overlap.
            </p>
          </div>

          {/* Card 4: Doctor & Staff Management (4 cols) */}
          <div className="md:col-span-4 bg-white p-7 rounded-2xl border border-slate-200/80 shadow-soft-sm hover:border-slate-300 transition-all">
            <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200/60 flex items-center justify-center text-violet-700 mb-5">
              <Stethoscope className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">
              04 • Staff & Physician Roster
            </span>
            <h4 className="text-lg font-bold font-sans text-slate-950 mt-2 mb-2">
              Real-time shift status and active load.
            </h4>
            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              Track active attending physicians, consultation counts, and front-desk reception coordinator performance in real time.
            </p>
          </div>

          {/* Card 5: Role-Based Access & Governance (4 cols) */}
          <div className="md:col-span-4 bg-white p-7 rounded-2xl border border-slate-200/80 shadow-soft-sm hover:border-slate-300 transition-all">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700 mb-5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              05 • Role-Based Access (RBAC)
            </span>
            <h4 className="text-lg font-bold font-sans text-slate-950 mt-2 mb-2">
              Strict compartmentalization by duty.
            </h4>
            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              Receptionists only see arrival desks; doctors see patient files and consultation queues; administrators monitor operational throughput without clinical noise.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
