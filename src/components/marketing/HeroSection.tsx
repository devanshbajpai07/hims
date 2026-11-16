import React from 'react';
import { ArrowRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface HeroSectionProps {
  onScheduleDemo: () => void;
  onExploreProduct: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onScheduleDemo,
  onExploreProduct,
}) => {
  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-28 pb-20 px-6 sm:px-10 overflow-hidden bg-transparent select-none font-sans">
      <div className="relative z-10 max-w-6xl mx-auto w-full">
        {/* Top Subtitle Pill */}
        <div className="mb-8 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-100/90 border border-slate-200/80 text-slate-700 text-xs sm:text-sm font-medium backdrop-blur-xs animate-fadeIn font-sans">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Clinical guardrails that prevent administrative fatigue before it causes burnout.</span>
          <button
            onClick={onExploreProduct}
            className="hidden sm:inline-flex items-center gap-1 text-slate-900 font-semibold hover:text-emerald-700 transition-colors ml-1 cursor-pointer"
          >
            <span>Explore Architecture</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Humanistic Sans-Serif Headline (Canva / Modern Tech Clean Typography) */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[72px] font-bold tracking-tight text-slate-950 leading-[1.08] max-w-5xl font-sans">
          All the building blocks for modern hospital intelligence are already in your clinic.
        </h1>

        {/* Cohesive Sans-Serif Supporting Description */}
        <p className="mt-8 text-lg sm:text-xl text-slate-600 font-normal max-w-2xl leading-relaxed font-sans">
          Aarogya unifies patient intake, physician consultation queues, and operational governance into one calm, single-specialty intelligence layer.
        </p>

        {/* CTA Buttons with Proportionate Sizing */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button
            onClick={onScheduleDemo}
            className="px-8 py-4 rounded-full text-base font-semibold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-pill hover:shadow-native-glow transition-all duration-200 flex items-center gap-2.5 group cursor-pointer border border-emerald-400/25 font-sans"
          >
            <span>Schedule a Clinical Demo</span>
            <ArrowUpRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>

          <button
            onClick={onExploreProduct}
            className="px-8 py-4 rounded-full text-base font-semibold text-slate-800 bg-white/90 hover:bg-white border border-slate-200/90 hover:border-slate-400 transition-all shadow-soft-sm flex items-center gap-2.5 group cursor-pointer backdrop-blur-xs font-sans"
          >
            <span>Explore the Platform</span>
            <ArrowRight className="w-5 h-5 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-slate-700" />
          </button>
        </div>

        {/* Micro Credibility Indicators */}
        <div className="mt-16 pt-8 border-t border-slate-200/60 flex flex-wrap items-center gap-8 text-sm text-slate-600 font-medium font-sans">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
            <span>Zero Cognitive Overload</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
            <span>Role-Oriented Workflow Desks</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
            <span>1-Click Arrival Check-In</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
            <span>HIPAA & FHIR Standard Architecture</span>
          </div>
        </div>
      </div>
    </section>
  );
};
