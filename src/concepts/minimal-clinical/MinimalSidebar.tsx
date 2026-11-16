import React from 'react';
import {
  Heart,
  LayoutGrid,
  Users,
  Calendar,
  UserCheck,
  FileText,
  Activity,
  Settings,
  HelpCircle,
  Building2,
  Stethoscope,
  Clock,
  Shield,
} from 'lucide-react';

interface MinimalSidebarProps {
  currentTab?: string;
  onSelectTab?: (tab: string) => void;
  openRegisterModal: () => void;
  openScheduleModal: () => void;
}

export const MinimalSidebar: React.FC<MinimalSidebarProps> = ({
  currentTab = 'overview',
  onSelectTab,
  openRegisterModal,
  openScheduleModal,
}) => {
  const mainNav = [
    { id: 'overview', label: 'Clinical Overview', icon: LayoutGrid },
    { id: 'patients', label: 'Patient Registry', icon: Users, badge: '1,482' },
    { id: 'appointments', label: 'Appointments & Slots', icon: Calendar, badge: '48' },
    { id: 'doctors', label: 'Physician Roster', icon: Stethoscope },
    { id: 'consultations', label: 'Consultations', icon: UserCheck },
    { id: 'records', label: 'Electronic Records', icon: FileText },
  ];

  const secondaryNav = [
    { id: 'settings', label: 'Clinic Preferences', icon: Settings },
    { id: 'support', label: 'Clinical Support', icon: HelpCircle },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/70 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-800 flex items-center gap-1.5">
              <span>Aarogya Health</span>
              <span className="text-[10px] font-normal uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                Clinic
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Metropolitan Medical Centre</div>
          </div>
        </div>

        {/* Quick Action Buttons (Restrained) */}
        <div className="p-4 space-y-2 border-b border-slate-100">
          <button
            onClick={openRegisterModal}
            className="w-full py-2 px-3 text-xs font-medium text-teal-800 bg-teal-50/80 hover:bg-teal-100/80 border border-teal-200/60 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-teal-600" />
            <span>Register New Patient</span>
          </button>
          <button
            onClick={openScheduleModal}
            className="w-full py-2 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-soft-sm"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Schedule Appointment</span>
          </button>
        </div>

        {/* Primary Navigation */}
        <div className="px-3 py-4">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Main Management
          </div>
          <nav className="space-y-0.5">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab && onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-teal-50/80 text-teal-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-teal-700' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                        isActive
                          ? 'bg-teal-100/70 text-teal-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer / Department Badge */}
      <div className="p-4 border-t border-slate-100 space-y-3">
        <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <div className="text-xs">
            <div className="font-medium text-slate-700">East Wing Clinic</div>
            <div className="text-[11px] text-slate-400">Shift A • Normal Status</div>
          </div>
        </div>

        <nav className="space-y-0.5 pt-1">
          {secondaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <Icon className="w-4 h-4 text-slate-400" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
