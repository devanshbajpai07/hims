import React from 'react';
import { UserRole } from '../types';
import { User, Stethoscope, BarChart3, Info } from 'lucide-react';

interface RoleSwitcherProps {
  activeRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  activeDoctorName?: string;
  onToggleDoctor?: (name: string) => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  activeRole,
  onSelectRole,
  activeDoctorName = 'Attending Physician',
  onToggleDoctor,
}) => {
  const roles: {
    id: UserRole;
    label: string;
    personName: string;
    badge: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'receptionist',
      label: 'Receptionist',
      personName: 'Front Desk Coordinator',
      badge: 'Front Desk',
      icon: <User className="w-3.5 h-3.5" />,
    },
    {
      id: 'doctor',
      label: 'Doctor',
      personName: activeDoctorName,
      badge: 'General Med',
      icon: <Stethoscope className="w-3.5 h-3.5" />,
    },
    {
      id: 'admin',
      label: 'Hospital Administrator',
      personName: 'Hospital Administrator',
      badge: 'Management',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur-md px-3 py-1.5 rounded-full shadow-xl border border-slate-700/80 flex items-center gap-2 max-w-[95vw] overflow-x-auto transition-all select-none">
      <div className="flex items-center gap-1.5 pl-2 pr-2.5 border-r border-slate-700 text-xs font-semibold text-slate-300 whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
        <span className="hidden sm:inline">Role Preview:</span>
      </div>

      <div className="flex items-center gap-1">
        {roles.map((r) => {
          const isActive = activeRole === r.id;
          return (
            <button
              key={r.id}
              onClick={() => onSelectRole(r.id)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-teal-700 text-white shadow-sm font-semibold ring-1 ring-teal-500/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {r.icon}
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold">{r.label}</span>
                <span className="text-[11px] opacity-80 hidden md:inline">({r.personName})</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sub-selector for Doctor when active */}
      {activeRole === 'doctor' && onToggleDoctor && (
        <div className="pl-2 border-l border-slate-700 flex items-center gap-1 text-[11px] whitespace-nowrap">
          <span className="text-slate-400 hidden lg:inline">Doctor:</span>
          <button
            onClick={() => onToggleDoctor('Attending Physician 1')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              activeDoctorName === 'Attending Physician 1'
                ? 'bg-teal-500/30 text-teal-200 border border-teal-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Physician 1 (101)
          </button>
          <button
            onClick={() => onToggleDoctor('Attending Physician 2')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              activeDoctorName === 'Attending Physician 2'
                ? 'bg-teal-500/30 text-teal-200 border border-teal-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Physician 2 (102)
          </button>
        </div>
      )}
    </div>
  );
};
