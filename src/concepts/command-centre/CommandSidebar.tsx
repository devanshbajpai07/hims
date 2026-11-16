import React from 'react';
import {
  Activity,
  Layers,
  Users,
  Calendar,
  AlertOctagon,
  Radio,
  Bed,
  Stethoscope,
  Terminal,
  Settings,
  Shield,
  Zap,
} from 'lucide-react';

interface CommandSidebarProps {
  currentTab?: string;
  onSelectTab?: (tab: string) => void;
  openRegisterModal: () => void;
  openScheduleModal: () => void;
}

export const CommandSidebar: React.FC<CommandSidebarProps> = ({
  currentTab = 'overview',
  onSelectTab,
  openRegisterModal,
  openScheduleModal,
}) => {
  const operationsNav = [
    { id: 'overview', label: 'Command Deck', icon: Activity, badge: 'LIVE', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
    { id: 'triage', label: 'Triage Stream (ER)', icon: AlertOctagon, badge: 'P1: 2', badgeColor: 'bg-rose-500/20 text-rose-400' },
    { id: 'patients', label: 'Inpatient Registry', icon: Users, count: '1,482' },
    { id: 'appointments', label: 'Consultation Matrix', icon: Calendar, count: '48' },
    { id: 'beds', label: 'Bed & Ward Alloc.', icon: Bed, badge: '88%', badgeColor: 'bg-amber-500/20 text-amber-400' },
    { id: 'doctors', label: 'On-Duty Duty Roster', icon: Stethoscope },
    { id: 'telemetry', label: 'ICU Telemetry Feed', icon: Radio },
  ];

  return (
    <aside className="w-64 bg-[#0B0F19] border-r border-[#1F2E47] text-slate-300 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Cockpit Title Bar */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#1F2E47] bg-[#0E1524]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold font-mono">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-wider uppercase text-white font-mono flex items-center gap-1.5">
                <span>MED-OPS V4</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div className="text-[10px] text-slate-400 font-mono">ST. JUDE TRAUMA CTR</div>
            </div>
          </div>
        </div>

        {/* Quick Rapid Response Action Buttons */}
        <div className="p-3 border-b border-[#1F2E47] space-y-2 bg-[#0E1524]/40">
          <button
            onClick={openRegisterModal}
            className="w-full py-2 px-3 text-xs font-mono font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg flex items-center justify-between transition-colors shadow-sm"
          >
            <span className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>RAPID TRIAGE INTAKE</span>
            </span>
            <span className="text-[10px] bg-sky-900/40 text-slate-900 px-1 rounded font-bold">
              F1
            </span>
          </button>
          <button
            onClick={openScheduleModal}
            className="w-full py-2 px-3 text-xs font-mono font-medium text-slate-200 bg-[#162032] hover:bg-[#1C2940] border border-[#243550] rounded-lg flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>DISPATCH APPOINTMENT</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">F2</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="p-2 space-y-0.5">
          <div className="px-3 pt-3 pb-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
            // CRITICAL DISPATCH
          </div>
          {operationsNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab && onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition-all ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-300 font-bold border-l-2 border-sky-400 bg-gradient-to-r from-sky-500/10 to-transparent'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#162032]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-sky-400' : 'text-slate-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold font-mono ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.count && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ward Status Box */}
      <div className="p-3 border-t border-[#1F2E47] bg-[#0E1524] space-y-2">
        <div className="p-2.5 rounded-lg bg-[#0A0F1D] border border-[#1F2E47] text-[11px] font-mono">
          <div className="flex justify-between text-slate-400 mb-1">
            <span>BED OCCUPANCY:</span>
            <span className="text-amber-400 font-bold">142/160</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-400 h-full w-[88%]" />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
            <span>ICU: 94%</span>
            <span>PACU: 72%</span>
            <span>OPD: 60%</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-mono">
          <span>STATUS: SECURE LEVEL 4</span>
          <span className="text-emerald-400 flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ONLINE
          </span>
        </div>
      </div>
    </aside>
  );
};
