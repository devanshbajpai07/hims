import React from 'react';
import { Compass, Target, ShieldCheck } from 'lucide-react';

export const AboutUsSection: React.FC = () => {
  return (
    <section id="about" className="py-24 px-6 bg-[#FAF7F2] border-t border-stone-200/60 select-none font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Section Heading */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            <span>About AURA Health</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-sans text-slate-950 tracking-tight leading-tight">
            We believe healthcare software should be an instrument of calm, not an obstacle to care.
          </h2>
        </div>

        {/* 3 Human Story Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold font-sans text-slate-950">
              The Philosophy
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
              Modern medicine possesses miraculous diagnostics and treatments, yet clinicians spend over a third of their shifts struggling with clunky, 1990s-era database forms. Our philosophy is radical reduction: eliminate every field, button, and animation that does not directly serve patient health.
            </p>
          </div>

          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold font-sans text-slate-950">
              The Mission
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
              To build the architectural operating system for 21st-century hospital networks. We harmonize the front desk, the consultation room, and executive administration into a quiet, seamless data loop that protects clinicians from burnout and ensures patients are treated with dignity.
            </p>
          </div>

          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200/60 flex items-center justify-center text-sky-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold font-sans text-slate-950">
              Why We Build
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
              Because clinical mistakes frequently stem from alarm fatigue, miscommunicated arrival queues, and buried medical records. By creating a unified, role-oriented platform, we give healthcare teams the situational clarity they need when it matters most.
            </p>
          </div>
        </div>

        {/* Quality Principles Banner */}
        <div className="mt-16 p-8 rounded-2xl bg-white border border-slate-200/80 shadow-soft-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              System Benchmark
            </div>
            <div className="text-lg font-semibold font-sans text-slate-900">
              Certified for SOC-2 Type II, HIPAA Title II, and HL7 FHIR Release 4
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500 font-medium">
            <span>UPTIME: 99.99%</span>
            <span>DATA RESIDENCY: LOCAL</span>
          </div>
        </div>
      </div>
    </section>
  );
};
