import React, { useState, useEffect, useRef } from 'react';
import { Star, Sparkles, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

export interface TestimonialItem {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string;
  authorOrg: string;
  avatarUrl: string;
  stars: number;
}

export const TESTIMONIALS: TestimonialItem[] = [
  {
    id: 'maya',
    quote: 'Setup took one coffee, not one quarter. Our whole team was live by Friday, and stayed.',
    authorName: 'Maya Okonkwo',
    authorRole: 'Head of Operations',
    authorOrg: 'Lumen Health Network',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=80',
    stars: 5,
  },
  {
    id: 'marcus',
    quote: 'AURA restored calm to our consulting rooms. Clinicians examine patients, not 40-step billing drop-downs.',
    authorName: 'Dr. Marcus Vance, MD',
    authorRole: 'Chief Medical Officer',
    authorOrg: 'Pacific Metro Health System',
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=160&q=80',
    stars: 5,
  },
  {
    id: 'linda',
    quote: 'The 1-click arrival flow completely eliminated the chaos of our Monday morning outpatient triage queues.',
    authorName: 'Linda Lindqvist, RN',
    authorRole: 'Lead Triage Coordinator',
    authorOrg: 'Nordic Clinical Alliance',
    avatarUrl: 'https://images.unsplash.com/photo-1594824813576-96b6375f4c54?auto=format&fit=crop&w=160&q=80',
    stars: 5,
  },
];

const AUTO_INTERVAL_MS = 5000;

export const AnimatedReviewCard: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<any>(null);
  const progressTimerRef = useRef<any>(null);

  const current = TESTIMONIALS[activeIndex];

  // Seamless transition to a specific slide: zero opacity drop on card body (no green window flash)
  const transitionTo = (nextIndex: number) => {
    if (nextIndex === activeIndex || isTransitioning) return;
    setIsTransitioning(true);
    setProgress(0);

    // Fast inner content crossfade (140ms) with zero front card transparency
    setTimeout(() => {
      setActiveIndex(nextIndex);
      setIsTransitioning(false);
    }, 140);
  };

  const handleNext = () => {
    const nextIdx = (activeIndex + 1) % TESTIMONIALS.length;
    transitionTo(nextIdx);
  };

  const handlePrev = () => {
    const prevIdx = (activeIndex - 1 + TESTIMONIALS.length) % TESTIMONIALS.length;
    transitionTo(prevIdx);
  };

  // Continuous auto-transition timer & smooth linear progress bar
  useEffect(() => {
    setProgress(0);
    const progressInterval = 50; // update progress every 50ms
    const step = (progressInterval / AUTO_INTERVAL_MS) * 100;

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + step;
      });
    }, progressInterval);

    timerRef.current = setTimeout(() => {
      handleNext();
    }, AUTO_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [activeIndex]);

  return (
    <div className="relative w-full max-w-lg mx-auto select-none">
      {/* Outer Theater Container */}
      <div className="relative rounded-3xl bg-[#091F18] p-6 sm:p-9 shadow-2xl overflow-hidden border border-emerald-950/70">
        {/* Ambient Top-Right Corner Elements */}
        <div className="absolute top-4 right-5 flex items-center gap-3 z-20">
          <div className="animate-pulse duration-[3000ms]">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="w-8 h-8 rounded-full ring-2 ring-emerald-500/50 overflow-hidden shadow-md">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
              alt="Clinician"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Ambient Corner Decors */}
        <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full border border-dashed border-emerald-800/25 pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-emerald-900/20 blur-2xl pointer-events-none" />

        {/* ============================================================= */}
        {/* THE LAYERED TILTED CARD (Zero Green Window - Solid Ivory Card) */}
        {/* ============================================================= */}
        <div
          onClick={handleNext}
          className="relative my-3 flex items-center justify-center cursor-pointer group/card"
          title="Click to transition to next testimonial"
        >
          {/* 1. Tilted Warm Terracotta Backing Card (From Reference Video) */}
          <div
            className="absolute inset-0 rounded-2xl bg-[#F95738] -rotate-2 transition-transform duration-300 transform shadow-xl origin-bottom-center group-hover/card:-rotate-3"
            style={{
              transform: isTransitioning ? 'scale(0.98) rotate(-2deg)' : 'scale(1.02) rotate(-2deg)',
            }}
          />

          {/* 2. Front Cream/Ivory Card - ALWAYS 100% OPAQUE (Never shows green behind) */}
          <div className="relative z-10 w-full rounded-2xl bg-[#FAF7F0] p-6 sm:p-8 text-slate-900 shadow-2xl transition-transform duration-200">
            {/* Inner Content that transitions smoothly */}
            <div
              className={`transition-all duration-150 ease-out ${
                isTransitioning
                  ? 'opacity-0 translate-y-1.5'
                  : 'opacity-100 translate-y-0'
              }`}
            >
              {/* Top Row: Quotation Mark + 5 Stars */}
              <div className="flex items-start justify-between mb-4">
                <span className="text-4xl font-sans font-black leading-none select-none text-[#F95738]">
                  “
                </span>

                <div className="flex items-center gap-1 mt-1">
                  {[...Array(current.stars)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-current text-[#F95738]"
                    />
                  ))}
                </div>
              </div>

              {/* Testimonial Quote (Human typography) */}
              <blockquote className="text-lg sm:text-xl font-sans font-medium text-slate-900 leading-snug tracking-tight mb-6 min-h-[72px]">
                {current.quote}
              </blockquote>

              {/* Subtle Divider */}
              <div className="h-[1px] w-full bg-slate-200/90 mb-5" />

              {/* Author Profile Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={current.avatarUrl}
                      alt={current.authorName}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-950 tracking-tight">
                      {current.authorName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {current.authorRole} • <span className="text-slate-400">{current.authorOrg}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation & Continuous Progress Bar */}
        <div className="mt-5 flex items-center justify-between pt-2 border-t border-emerald-950/80">
          {/* Left: Previous / Next Arrows */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="p-1.5 rounded-full bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 transition-colors cursor-pointer"
              title="Previous testimonial"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="p-1.5 rounded-full bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 transition-colors cursor-pointer"
              title="Next testimonial"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Interactive Tabs with Active Progress Pill */}
          <div className="flex items-center gap-2">
            {TESTIMONIALS.map((t, idx) => {
              const isSelected = activeIndex === idx;
              return (
                <button
                  key={t.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    transitionTo(idx);
                  }}
                  className={`relative h-2 rounded-full transition-all duration-300 cursor-pointer overflow-hidden ${
                    isSelected ? 'w-10 bg-emerald-950' : 'w-2.5 bg-emerald-900/60 hover:bg-emerald-800'
                  }`}
                  title={`Switch to ${t.authorName}`}
                >
                  {isSelected && (
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-400 rounded-full transition-all duration-75 ease-linear"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: Counter badge */}
          <span className="text-[11px] font-mono text-emerald-500/80 font-medium">
            0{activeIndex + 1} / 0{TESTIMONIALS.length}
          </span>
        </div>
      </div>
    </div>
  );
};
