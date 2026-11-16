import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Sparkles } from 'lucide-react';

interface InstitutionalLoadingScreenProps {
  badge?: string;
  title?: string;
  subtitle?: string;
  stages?: string[];
  minHeight?: string;
}

const DEFAULT_STAGES = [
  'Establishing encrypted clinical handshake...',
  'Verifying institutional facility UID and accreditation...',
  'Synchronizing administrator seats and governance matrix...',
  'Calibrating tenant security policies & audit logs...',
  'Preparing institutional workspace...',
];

export const InstitutionalLoadingScreen: React.FC<InstitutionalLoadingScreenProps> = ({
  badge = 'SECURE TENANT HANDSHAKE',
  title = 'Synchronizing Facility Workspace',
  subtitle = 'Decrypting institutional credentials, administrator permissions, and clinical quota.',
  stages = DEFAULT_STAGES,
  minHeight = 'min-h-[460px]',
}) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [fadeState, setFadeState] = useState<'fade-in' | 'fade-out'>('fade-in');

  useEffect(() => {
    if (stages.length <= 1) return;

    const interval = setInterval(() => {
      setFadeState('fade-out');
      setTimeout(() => {
        setCurrentStageIndex((prev) => (prev + 1) % stages.length);
        setFadeState('fade-in');
      }, 250);
    }, 2200);

    return () => clearInterval(interval);
  }, [stages]);

  return (
    <div
      className={`w-full ${minHeight} flex flex-col items-center justify-center p-6 sm:p-10 font-sans select-none relative overflow-hidden`}
    >
      {/* Background Soft Radial Radiance */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-emerald-400/10 via-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Floating Glassmorphic Architectural Canvas */}
      <div className="relative z-10 w-full max-w-lg bg-white/90 backdrop-blur-md rounded-3xl border border-stone-200/90 shadow-soft-lg p-8 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Animated Multi-Orbital Medical Ring & Cardiac Heartbeat Center */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-7 flex items-center justify-center">
          {/* Outer Ring: Dashed Clockwise Orbit */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/30 animate-orbit-slow" />

          {/* Middle Ring: Dashed Counter-Clockwise Orbit with Accent Dots */}
          <div className="absolute inset-2 sm:inset-2.5 rounded-full border-2 border-dashed border-teal-600/40 animate-orbit-reverse" />

          {/* Concentric Ambient Pulse Glow */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-emerald-500/15 via-teal-500/20 to-emerald-600/25 blur-sm animate-pulse-subtle" />

          {/* Center Emblem: Dual-Lub-Dub Cardiac Heartbeat Scale Motion */}
          <div className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white flex items-center justify-center shadow-native-glow animate-heartbeat-soft border border-emerald-400/30">
            <Activity className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400" />
          </div>

          {/* Floating Orbiting Satellite Spark */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]" />
        </div>

        {/* Monospace Overline with Pulsing Emerald Status Beacon */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50/90 border border-emerald-200/80 text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-900 font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{badge}</span>
          </span>
        </div>

        {/* Serif Editorial Title */}
        <h3 className="text-2xl sm:text-[26px] font-serif font-normal text-slate-950 tracking-tight leading-snug">
          {title}
        </h3>

        {/* Dynamic Rotating Stage Message with Smooth Transition */}
        <div className="h-9 my-3 flex items-center justify-center overflow-hidden">
          <p
            className={`text-xs sm:text-[13.5px] font-medium text-teal-800 transition-all duration-200 flex items-center gap-2 ${
              fadeState === 'fade-in'
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-2'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0 animate-pulse" />
            <span>{stages[currentStageIndex]}</span>
          </p>
        </div>

        {/* Animated ECG Heartbeat Oscilloscope Waveform */}
        <div className="w-48 sm:w-56 mx-auto my-4 h-6 overflow-hidden relative">
          <svg
            viewBox="0 0 200 40"
            className="w-full h-full stroke-emerald-500 fill-none stroke-[2.2] stroke-linecap-round stroke-linejoin-round drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]"
          >
            <path
              d="M 0 20 L 45 20 L 52 8 L 60 32 L 68 14 L 76 26 L 84 20 L 200 20"
              className="animate-ecg"
            />
          </svg>
        </div>

        {/* Continuous Shimmer Light Beam Progress Bar */}
        <div className="w-48 sm:w-60 h-1.5 mx-auto rounded-full bg-slate-100 border border-slate-200/80 overflow-hidden relative mb-4">
          <div className="absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-shimmer-beam" />
        </div>

        {/* Supporting description */}
        <p className="text-xs text-slate-500 font-normal leading-relaxed max-w-sm mx-auto">
          {subtitle}
        </p>

        {/* Institutional Compliance Monospace Stamp */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-[10.5px] font-mono text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600/80" />
          <span>SOC2 TYPE II • HIPAA &amp; FHIR ENCRYPTED</span>
        </div>
      </div>
    </div>
  );
};

