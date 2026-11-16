import React from 'react';
import { Search, Bell, Calendar, ChevronDown, ShieldCheck, Heart } from 'lucide-react';

interface MinimalHeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  openRegisterModal: () => void;
  openScheduleModal: () => void;
}

export const MinimalHeader: React.FC<MinimalHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  openRegisterModal,
  openScheduleModal,
}) => {
  return (
    <header className="h-16 px-8 bg-white border-b border-slate-200/70 flex items-center justify-between gap-6 shrink-0">
      {/* Search Bar */}
      <div className="flex-1 max-w-md relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search patient by MRN, name, or physician..."
          className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200/80 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white transition-all"
        />
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-4">
        {/* Date indication */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Wednesday, 5 November 2026</span>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden lg:block" />

        {/* Action button */}
        <div className="flex items-center gap-2">
          <button
            onClick={openRegisterModal}
            className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200/70 rounded-lg hover:bg-teal-100 transition-colors"
          >
            + Register Patient
          </button>
        </div>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          title="Clinical Alerts"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal-600" />
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-200/80">
          <img
            src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=120"
            alt="Attending Physician"
            className="w-8 h-8 rounded-full object-cover border border-slate-200"
          />
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-800 leading-tight">
              Attending Physician
            </div>
            <div className="text-[11px] text-slate-500">Chief of Cardiology</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </header>
  );
};
