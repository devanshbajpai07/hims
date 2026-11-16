import React from 'react';
import { UserRole } from '../../types';
import {
  Heart,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck,
  FileText,
  Building2,
  Stethoscope,
  BarChart3,
  Sliders,
  CalendarPlus,
  UserPlus,
  ShieldCheck,
  DoorOpen,
  Bed,
  ClipboardList,
  Pill,
  Activity,
  AlertTriangle,
  FolderOpen,
  Inbox,
  Send,
  KeyRound,
  Mail,
  History,
  UserCog,
  Shield,
  X,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: any;
  badge?: string;
  badgeHighlight?: boolean;
}

interface RoleSidebarProps {
  role: UserRole;
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  waitingPatientsCount: number;
  todayAppointmentsCount: number;
  openRegisterModal?: () => void;
  openScheduleModal?: () => void;
  openContactModal?: () => void;
  openChangePasswordModal?: () => void;
  openChangeUsernameModal?: () => void;
  activeDoctorName?: string;
  hospitalName?: string;
  departmentName?: string;
  scopeType?: string;
  effectivePermissions?: string[];
  pendingRequestsCount?: number;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export const RoleSidebar: React.FC<RoleSidebarProps> = ({
  role,
  currentTab,
  onSelectTab,
  waitingPatientsCount,
  todayAppointmentsCount,
  openRegisterModal,
  openScheduleModal,
  openContactModal,
  openChangePasswordModal,
  openChangeUsernameModal,
  activeDoctorName,
  hospitalName = 'Hospital Facility',
  departmentName = 'General Medicine',
  scopeType = 'DEPARTMENT',
  effectivePermissions,
  pendingRequestsCount = 0,
  isOpenOnMobile = false,
  onCloseMobile,
}) => {
  const hasPerm = (code: string) => {
    if (!effectivePermissions) return true;
    return effectivePermissions.includes(code);
  };

  // Role-specific navigation items
  const getNavItems = (): NavItem[] => {
    switch (role) {
      case 'receptionist': {
        return [
          {
            id: 'queue',
            label: "Today's Queue",
            icon: Clock,
            badge: waitingPatientsCount > 0 ? `${waitingPatientsCount} waiting` : undefined,
          },
          {
            id: 'patient-records',
            label: 'Patient Records',
            icon: FileText,
          },
          {
            id: 'on-duty-staff',
            label: 'On-Duty Staff',
            icon: Users,
          },
          {
            id: 'change-password',
            label: 'Change Password',
            icon: KeyRound,
          },
          {
            id: 'change-username',
            label: 'Change Username',
            icon: UserCog,
          },
        ];
      }

      case 'doctor':
        return [
          {
            id: 'overview',
            label: 'Patient Consultations',
            icon: Stethoscope,
            badge: waitingPatientsCount > 0 ? `${waitingPatientsCount} waiting` : undefined,
            badgeHighlight: waitingPatientsCount > 0,
          },
          {
            id: 'patient-history',
            label: 'Patient History',
            icon: History,
          },
          {
            id: 'change-username',
            label: 'Change Username',
            icon: UserCog,
          },
          {
            id: 'change-password',
            label: 'Change Password',
            icon: KeyRound,
          },
        ];

      case 'nurse':
        return [
          {
            id: 'patient-data',
            label: 'Patient Data',
            icon: Users,
          },
          {
            id: 'tasks',
            label: 'Nursing Staff Tasks',
            icon: ClipboardList,
          },
          {
            id: 'patient-history',
            label: 'Patient History',
            icon: History,
          },
          {
            id: 'patient-records',
            label: 'Patient Records',
            icon: FileText,
          },
          {
            id: 'change-password',
            label: 'Change Password',
            icon: KeyRound,
          },
          {
            id: 'change-username',
            label: 'Change Username',
            icon: UserCog,
          },
        ];

      case 'pharmacist':
        return [
          {
            id: 'future-scope',
            label: 'Dispensary Overview',
            icon: Pill,
            badge: 'Future Scope',
          },
        ];

      case 'nursing_supervisor':
        return [
          {
            id: 'active-nurses',
            label: 'Active Nurses Directory',
            icon: Users,
          },
          {
            id: 'tasks',
            label: 'Nursing Staff Tasks',
            icon: ClipboardList,
          },
          {
            id: 'nurse-logs',
            label: 'Nurse Activity Logs',
            icon: FileText,
          },
          {
            id: 'contact-admin',
            label: 'Contact Administrator',
            icon: Shield,
          },
          {
            id: 'change-password',
            label: 'Change Password',
            icon: KeyRound,
          },
          {
            id: 'change-username',
            label: 'Change Username',
            icon: UserCog,
          },
        ];

      case 'dept_head':
        return [
          {
            id: 'overview',
            label: 'Department Overview',
            icon: BarChart3,
          },
          {
            id: 'patient-details',
            label: 'Patient Details',
            icon: Users,
          },
          {
            id: 'dept-employees',
            label: 'Department Employees',
            icon: Stethoscope,
          },
          {
            id: 'dept-communication',
            label: 'Staff Communication',
            icon: Mail,
          },
          {
            id: 'change-password',
            label: 'Change Password',
            icon: KeyRound,
          },
          {
            id: 'change-username',
            label: 'Change Username',
            icon: UserCheck,
          },
        ];

      case 'admin':
        return [
          {
            id: 'overview',
            label: 'Operational Overview',
            icon: BarChart3,
          },
          {
            id: 'stats',
            label: 'Appointment & Intake Trends',
            icon: Users,
          },
          {
            id: 'staff-roster',
            label: 'Doctor & Staff Overview',
            icon: Stethoscope,
            badge: '4 on shift',
          },
          {
            id: 'facilities',
            label: 'Clinic Room Utilization',
            icon: Building2,
          },
        ];

      case 'staff':
        return [
          {
            id: 'inbox',
            label: 'Received Requests',
            icon: Inbox,
            badge: pendingRequestsCount > 0 ? `${pendingRequestsCount} pending` : undefined,
            badgeHighlight: pendingRequestsCount > 0,
          },
          {
            id: 'tasks',
            label: 'General Staff Tasks',
            icon: ClipboardList,
          },
          {
            id: 'sent',
            label: 'Sent Requests',
            icon: Send,
          },
          {
            id: 'change-password',
            label: 'Change Password',
            icon: KeyRound,
          },
          {
            id: 'change-username',
            label: 'Change Username',
            icon: UserCog,
          },
        ];

      default:
        return [
          {
            id: 'overview',
            label: 'Operational Overview',
            icon: BarChart3,
          },
        ];
    }
  };

  const navItems = getNavItems();

  const getRoleDisplayName = (r: UserRole) => {
    switch (r) {
      case 'receptionist':
        return 'Medical Receptionist';
      case 'doctor':
        return 'Doctor / Clinician';
      case 'nurse':
        return 'Registered Nurse';
      case 'nursing_supervisor':
        return 'Nursing Supervisor';
      case 'admin':
        return 'Hospital Administrator';
      case 'dept_head':
        return 'Department Head';
      case 'staff':
        return 'General Staff';
      case 'pharmacist':
        return 'Pharmacist (Future Scope)';
      default:
        return r;
    }
  };

  const renderSidebarContent = (isMobile = false) => (
    <>
      <div>
        {/* Brand & Hospital Context */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/70 flex items-center justify-center text-teal-700 shrink-0 shadow-2xs">
              <Building2 className="w-5.5 h-5.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[15px] font-bold tracking-tight text-slate-900 truncate block leading-tight">
                {hospitalName}
              </span>
            </div>
          </div>
          {isMobile && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Receptionist Quick Actions (Granularly gated by patient:create and appointment:create) */}
        {role === 'receptionist' && (hasPerm('patient:create') || hasPerm('appointment:create')) && (
          <div className="p-3.5 space-y-2.5 border-b border-slate-100">
            {openRegisterModal && hasPerm('patient:create') && (
              <button
                onClick={() => {
                  if (isMobile && onCloseMobile) onCloseMobile();
                  openRegisterModal();
                }}
                className="w-full py-3 px-4 text-sm font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200/90 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-soft-sm hover:shadow-md cursor-pointer"
              >
                <UserPlus className="w-4.5 h-4.5 text-teal-700" />
                <span>Register Patient</span>
              </button>
            )}
            {openScheduleModal && hasPerm('appointment:create') && (
              <button
                onClick={() => {
                  if (isMobile && onCloseMobile) onCloseMobile();
                  openScheduleModal();
                }}
                className="w-full py-3 px-4 text-sm font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-soft-sm hover:shadow-md cursor-pointer"
              >
                <CalendarPlus className="w-4.5 h-4.5 text-slate-600" />
                <span>Schedule Slot</span>
              </button>
            )}
          </div>
        )}

        {/* Doctor Quick Consultation Callout */}
        {role === 'doctor' && (
          <div className="p-3.5 border-b border-slate-100">
            <div className="p-2.5 rounded-lg bg-teal-50/60 border border-teal-100 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-teal-900 truncate">
                  {activeDoctorName || 'Doctor on Duty'}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-[11px] text-teal-700">
                {departmentName} • Clinic Active
              </div>
            </div>
          </div>
        )}

        {/* Navigation list */}
        <div className="px-3.5 py-4">
          <div className="px-3.5 pb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Menu Navigation
          </div>
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentTab === item.id ||
                (role === 'nurse' && item.id === 'patient-data' && currentTab === 'ward');
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (isMobile && onCloseMobile) {
                      onCloseMobile();
                    }
                    if (role !== 'nurse' && role !== 'staff' && role !== 'nursing_supervisor' && role !== 'receptionist' && role !== 'dept_head') {
                      if (item.id === 'change-password' && openChangePasswordModal) {
                        openChangePasswordModal();
                      }
                      if (item.id === 'change-username' && openChangeUsernameModal) {
                        openChangeUsernameModal();
                      }
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13.5px] transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-950 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4.5 h-4.5 shrink-0 ${
                        isActive ? 'text-teal-700' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ${
                        item.badgeHighlight
                          ? 'bg-teal-700 text-white font-bold animate-pulse'
                          : isActive
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

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 space-y-2">
        <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{scopeType === 'FACILITY' ? 'All Departments' : departmentName}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {scopeType === 'FACILITY' ? 'Hospital-Wide Level' : 'Departmental Scope'}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200/70 flex-col justify-between shrink-0 select-none">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Off-Canvas Drawer */}
      {isOpenOnMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex animate-fadeIn">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col justify-between z-10 overflow-y-auto">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
