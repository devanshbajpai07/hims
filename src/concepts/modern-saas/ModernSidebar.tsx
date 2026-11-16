import React from 'react';
import {
  Sparkles,
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  Activity,
  FileBarChart2,
  Settings,
  Layers,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface ModernSidebarProps {
  currentTab?: string;
  onSelectTab?: (tab: string) => void;
  openRegisterModal: () => void;
  openScheduleModal: () => void;
}

export const ModernSidebar: React.FC<ModernSidebarProps> = ({
  currentTab = 'overview',
  onSelectTab,
  openRegisterModal,
  openScheduleModal,
}) => {
  const navigation = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, badge: 'Live' },
    { id: 'patients', label: 'Patients', icon: Users, count: 1482 },
    { id: 'appointments', label: 'Appointments', icon: CalendarDays, count: 48 },
    { id: 'doctors', label: 'Clinical Staff', icon: Stethoscope },
    { id: 'telemetry', label: 'Vitals & Telemetry', icon: Activity },
    { id: 'analytics', label: 'Hospital Insights', icon: FileBarChart2 },
  ];

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col justify-between shrink-0 select-none border-r border-slate-800">
      <div>
        {/* Workspace Brand Switcher */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/25">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>PULSE EMR</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  PRO
                </span>
              </div>
              <div className="text-[11px] text-slate-400">Bayview Health System</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </div>

        {/* Quick Action CTA Box */}
        <div className="p-4 border-b border-slate-800/80">
          <button
            onClick={openRegisterModal}
            className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-between transition-all shadow-md shadow-indigo-600/30 group"
          >
            <span className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-indigo-200 group-hover:scale-110 transition-transform" />
              <span>Register Patient</span>
            </span>
            <kbd className="text-[10px] bg-indigo-700/60 text-indigo-200 px-1.5 py-0.5 rounded font-mono">
              ⌘N
            </kbd>
          </button>
        </div>

        {/* Main Nav Items */}
        <div className="p-3 space-y-1">
          <div className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Platform
          </div>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab && onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold ring-1 ring-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-indigo-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                    {item.badge}
                  </span>
                )}
                {item.count && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modern SaaS Footer Card */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-white">System Health</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              99.98%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            HIPAA Compliant Cloud Node • Active Encryption
          </p>
        </div>

        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors">
          <Settings className="w-4 h-4 text-slate-500" />
          <span>Workspace Settings</span>
        </button>
      </div>
    </aside>
  );
};
