import React, { useState, useEffect, useCallback } from 'react';
import { UserRole } from '../../types';
import { EmployeeAssignment } from '../../types/auth';
import { clinicalApiClient } from '../../services/clinicalApiClient';
import {
  Search,
  Bell,
  Calendar,
  ChevronDown,
  Stethoscope,
  User,
  BarChart3,
  LogOut,
  Bed,
  Shield,
  Building2,
  Check,
  Briefcase,
  Send,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';

interface RoleHeaderProps {
  role: UserRole;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  activeDoctorName?: string;
  openRegisterModal?: () => void;
  openContactModal?: () => void;
  onLogout?: () => void;
  userName?: string;
  userEmail?: string;
  hospitalName?: string;
  hospitalUid?: string;
  departmentName?: string;
  scopeType?: string;
  assignments?: EmployeeAssignment[];
  activeAssignmentId?: string;
  onSwitchAssignment?: (assignmentId: string) => void;
  token?: string;
}

export const RoleHeader: React.FC<RoleHeaderProps> = ({
  role,
  searchQuery = '',
  setSearchQuery,
  activeDoctorName,
  openRegisterModal,
  openContactModal,
  onLogout,
  userName = 'Staff Member',
  userEmail,
  hospitalName = 'Hospital Facility',
  hospitalUid = '',
  departmentName = 'General Medicine',
  scopeType = 'DEPARTMENT',
  assignments = [],
  activeAssignmentId,
  onSwitchAssignment,
  token,
}) => {
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setNotifLoading(true);
      const data = await clinicalApiClient.getNotifications(token);
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.warn('Failed to fetch employee notifications:', err);
    } finally {
      setNotifLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await clinicalApiClient.markNotificationRead(id, token);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await clinicalApiClient.markAllNotificationsRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.warn('Failed to mark all notifications read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getHeaderRoleTitle = (r: UserRole) => {
    switch (r) {
      case 'nurse':
        return 'Registered Nurse';
      case 'doctor':
        return 'Doctor';
      case 'receptionist':
        return 'Medical Receptionist';
      case 'nursing_supervisor':
        return 'Nursing Services Supervisor';
      case 'dept_head':
        return 'Department Head';
      case 'admin':
        return 'Hospital Administrator';
      case 'staff':
        return 'General Staff';
      case 'pharmacist':
        return 'Pharmacist';
      default:
        return 'Employee';
    }
  };

  const activeAssign = assignments.find((a) => a.id === activeAssignmentId) || assignments[0];

  return (
    <header className="h-16 px-6 md:px-8 bg-white border-b border-slate-200/70 flex items-center justify-between gap-6 shrink-0 select-none">
      {/* Left: Role Name & Department */}
      <div className="flex items-center gap-2.5 min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans truncate">
          {getHeaderRoleTitle(role)}
        </h1>
        {departmentName && (
          <span className="text-xs font-medium text-slate-500 bg-slate-100/90 border border-slate-200/60 px-2 py-0.5 rounded-md truncate">
            {departmentName}
          </span>
        )}
      </div>

      {/* Right controls: Switch Role, User Name & Email, Logout Button */}
      <div className="flex items-center gap-4">
        {/* Multi-Assignment Switcher */}
        {assignments.length > 0 && onSwitchAssignment && (
          <div className="relative">
            <button
              onClick={() => setAssignDropdownOpen(!assignDropdownOpen)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100/80 border border-teal-200/90 rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-teal-700" />
              <span>Switch Role{assignments.length > 1 ? ` (${assignments.length})` : ''}</span>
              <ChevronDown className="w-3.5 h-3.5 text-teal-700" />
            </button>

            {assignDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-fadeIn space-y-1">
                <div className="px-3 py-1.5 text-[10.5px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                  <span>Verified Role Placements</span>
                  <span className="text-teal-700 font-mono text-[10px]">{assignments.length} Roles</span>
                </div>
                {assignments.map((a) => {
                  const isCurrent = a.id === activeAssign?.id || a.roleCode === role;
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        onSwitchAssignment(a.id);
                        setAssignDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-start justify-between cursor-pointer ${
                        isCurrent
                          ? 'bg-teal-50 text-teal-950 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{a.roleName}</div>
                        <div className="text-[11px] text-teal-700 mt-0.5">
                          {a.departmentName || 'Hospital-Wide'} • {a.scopeType}
                        </div>
                      </div>
                      {isCurrent && <Check className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Real-time Notifications Bell with Badge & Dropdown Popover */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2.5 text-slate-600 hover:text-teal-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200/80 bg-white shadow-2xs"
            title="Hospital Operations & Patient Care Notifications"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-teal-800 text-white font-mono text-[10.5px] font-bold rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-0 z-50 animate-fadeIn overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-teal-800" />
                  <span className="text-xs font-bold text-slate-900">Hospital Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-900">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No hospital notifications recorded at this time.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={(e) => !n.is_read && handleMarkAsRead(n.id, e)}
                      className={`p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-start gap-3 ${
                        n.is_read ? 'opacity-70 bg-white' : 'bg-teal-50/20'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          n.is_read ? 'bg-transparent' : 'bg-teal-700 animate-pulse'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {n.created_at
                              ? new Date(n.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Card (Avatar, Name, Email) and Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-teal-800 text-white flex items-center justify-center font-bold text-xs uppercase shadow-2xs shrink-0">
            {userName ? userName[0] : 'U'}
          </div>
          <div className="text-left min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate max-w-[180px] leading-tight">
              {userName}
            </div>
            {userEmail && (
              <div className="text-[11px] text-slate-500 font-sans truncate max-w-[180px] leading-tight mt-0.5" title={userEmail}>
                {userEmail}
              </div>
            )}
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 ml-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Sign out of workspace"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
