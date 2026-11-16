import React from 'react';
import { Users, MessageSquare, Globe, ArrowUpRight, Award, HeartPulse, Sparkles } from 'lucide-react';
import { AnimatedReviewCard } from './AnimatedReviewCard';

export const CommunitySection: React.FC = () => {
  const members = [
    {
      name: 'Dr. Marcus Vance, MD',
      role: 'Chief Medical Officer',
      org: 'Pacific Metro Health System',
      quote:
        'AURA finally bridges the gap between high-acuity medical consultations and human-centric software. It saved our clinic over 40 hours of clerical burnout weekly.',
    },
    {
      name: 'Linda Lindqvist, RN',
      role: 'Lead Triage Coordinator',
      org: 'Nordic Clinical Alliance',
      quote:
        'The 1-click arrival flow and zero-clutter interface completely eliminated the chaos of our Monday morning outpatient queues.',
    },
    {
      name: 'David Sterling, MHA',
      role: 'Healthcare Operations Director',
      org: 'Metropolitan Hospital Network',
      quote:
        'Having real-time room utilization and physician roster velocity without hovering over consultation doors is revolutionary for hospital administrators.',
    },
  ];

  return (
    <section id="community" className="py-24 px-6 bg-[#FAF7F2] border-t border-stone-200/60 select-none font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Section Heading & Featured Animated Review Card Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-16">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-teal-600" />
              <span>Clinical Community & Reviews</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-sans text-slate-950 tracking-tight leading-tight">
              Built in dialogue with practicing clinicians and hospital leaders.
            </h2>
            <p className="mt-5 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
              Our clinical advisory council spans attending physicians, head triage nurses, and hospital system executives dedicated to building humane health technology that eliminates alarm fatigue.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Zero Deployment Friction</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <span>HIPAA & HL7 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                <span>Verified Hospital Leaders</span>
              </div>
            </div>
          </div>

          {/* Featured Animated Review Card (Video 1 Inspiration) */}
          <div className="lg:col-span-6 flex justify-center">
            <AnimatedReviewCard />
          </div>
        </div>

        {/* Member Endorsement Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {members.map((m, i) => (
            <div
              key={i}
              className="p-8 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-between hover:border-slate-300 transition-all shadow-soft-sm hover:-translate-y-0.5 duration-200"
            >
              <p className="text-sm text-slate-700 font-normal font-sans leading-relaxed mb-6">
                "{m.quote}"
              </p>
              <div>
                <div className="text-xs font-bold text-slate-950">{m.name}</div>
                <div className="text-[11px] text-teal-800 font-medium">{m.role}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{m.org}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Community Action Banner */}
        <div className="mt-14 p-8 rounded-2xl border border-teal-200 bg-teal-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold shrink-0 shadow-soft-sm">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-900">
                Join the Clinical Innovation Forum
              </h4>
              <p className="text-xs text-slate-600 font-light mt-0.5">
                Participate in monthly design reviews, early-access clinical trials, and open FHIR standard integrations.
              </p>
            </div>
          </div>

          <a
            href="#cta-demo"
            className="px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-colors shrink-0 text-center shadow-soft-sm"
          >
            Request Forum Access
          </a>
        </div>
      </div>
    </section>
  );
};
