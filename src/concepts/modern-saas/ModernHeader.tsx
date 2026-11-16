import React from 'react';
import { Search, Bell, Sparkles, Plus, Calendar, Command, ChevronDown } from 'lucide-react';

interface ModernHeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  openRegisterModal: () => void;
  openScheduleModal: () => void;
}

export const ModernHeader: React.FC<ModernHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  openRegisterModal,
  openScheduleModal,
}) => {
  return (
    <header className="h-16 px-6 md:px-8 bg-white border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0 shadow-soft-sm">
      {/* Command Palette Search Box */}
      <div className="flex-1 max-w-lg relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search patients, medical records, ICD codes, or doctors..."
          className="w-full pl-10 pr-16 py-2 text-xs rounded-xl bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm font-mono pointer-events-none">
          <Command className="w-3 h-3 inline" />
          <span>K</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Quick Action Schedule button */}
        <button
          onClick={openScheduleModal}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm hover:shadow"
        >
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>Schedule</span>
        </button>

        {/* Quick Action Register button */}
        <button
          onClick={openRegisterModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-sm shadow-indigo-600/20 hover:shadow-indigo-600/30"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Patient</span>
        </button>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* Notification Icon */}
        <button className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-white" />
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-1">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=120"
              alt="Attending Physician"
              className="w-8 h-8 rounded-xl object-cover ring-2 ring-indigo-500/20 shadow-sm"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-bold text-slate-900 leading-tight">
              Attending Physician
            </div>
            <div className="text-[11px] text-slate-500">Chief Attending Physician</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </header>
  );
};
