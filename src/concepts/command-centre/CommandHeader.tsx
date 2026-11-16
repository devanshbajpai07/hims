import React, { useState, useEffect } from 'react';
import { Search, Radio, Bell, AlertTriangle, ShieldCheck, Clock, UserCheck } from 'lucide-react';

interface CommandHeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  openRegisterModal: () => void;
  openScheduleModal: () => void;
}

export const CommandHeader: React.FC<CommandHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  openRegisterModal,
  openScheduleModal,
}) => {
  const [time, setTime] = useState('12:44:00 UTC+05:30');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', { hour12: false }) +
          ' • 05-NOV-2026'
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 px-6 bg-[#0E1524] border-b border-[#1F2E47] flex items-center justify-between gap-4 shrink-0 text-slate-200 select-none">
      {/* Search Input (High Contrast Terminal Style) */}
      <div className="flex-1 max-w-md relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-sky-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="QUERY PATIENT MRN, ATTENDING MD, OR CLINICAL WING..."
          className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-[#0A0F1D] border border-[#243550] rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all uppercase"
        />
      </div>

      {/* Telemetry Status Center */}
      <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#162032] border border-[#243550]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-slate-300">TELEMETRY: ACTIVE</span>
          <span className="text-emerald-400 font-bold">100% FEED</span>
        </div>

        <div className="flex items-center gap-1.5 text-amber-400 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>TRIAGE LOAD: ELEVATED (OPD 1)</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-bold text-white">{time}</span>
        </div>
      </div>

      {/* Right User & Paging Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={openRegisterModal}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors"
        >
          <span>+ INTAKE</span>
        </button>

        <button
          onClick={() => alert('Code Silver / Code Blue Alert broadcast simulated')}
          className="p-1.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
          title="Emergency Broadcast"
        >
          <Bell className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-[#1F2E47]">
          <div className="w-7 h-7 rounded bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-xs font-mono font-bold text-sky-300">
            MD
          </div>
          <div className="text-left hidden sm:block font-mono">
            <div className="text-xs font-bold text-white leading-none">
              DR. S. AL-MANSOOR
            </div>
            <div className="text-[10px] text-sky-400 leading-tight">
              DUTY CHIEF • CARDIO
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
