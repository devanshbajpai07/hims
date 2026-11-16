import React from 'react';
import {
  ShieldAlert,
  ArrowRight,
  LogOut,
  UserCheck,
  Building,
  AlertTriangle,
  Stethoscope,
  Users,
  Heart,
  ClipboardList,
  Shield,
  Briefcase,
  HelpCircle,
} from 'lucide-react';
import { UserRole } from '../../types';
import { AuthSession } from '../../types/auth';

interface UnauthorizedWorkspaceViewProps {
  requestedRole?: string | null;
  requestedPath?: string;
  session?: AuthSession | null;
  authorizedRoles: UserRole[];
  onNavigateToRole: (role: UserRole) => void;
  onLogout: () => void;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  doctor: 'Doctor / Clinician',
  receptionist: 'Medical Receptionist',
  nurse: 'Registered Nurse',
  nursing_supervisor: 'Nursing Supervisor',
  dept_head: 'Department Head',
  admin: 'Hospital Administrator',
  staff: 'General Staff',
  pharmacist: 'Pharmacist',
};

const ROLE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  doctor: Stethoscope,
  receptionist: Users,
  nurse: Heart,
  nursing_supervisor: ClipboardList,
  dept_head: Building,
  admin: Shield,
  staff: Briefcase,
  pharmacist: HelpCircle,
};

export const UnauthorizedWorkspaceView: React.FC<UnauthorizedWorkspaceViewProps> = ({
  requestedRole,
  requestedPath = window.location.pathname,
  session,
  authorizedRoles,
  onNavigateToRole,
  onLogout,
}) => {
  const roleName = requestedRole
    ? ROLE_DISPLAY_NAMES[requestedRole] || requestedRole
    : 'Requested';
  const userName = session?.user?.legalName || session?.user?.username || 'User';
  const userEmail = session?.user?.email || 'N/A';
  const hospitalName = session?.activeMembership?.hospitalName || 'ABC Hospital';

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-2xl w-full bg-white rounded-3xl border border-rose-200/80 shadow-soft-lg overflow-hidden animate-fadeIn">
        {/* Banner */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-rose-50/80 via-white to-amber-50/40 border-b border-rose-100 flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-soft-md shrink-0">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
              <span>403 Forbidden &bull; Access Denied</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Unauthorized Workspace Access
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              Your account does not hold the assignment or clinical permissions required to access the{' '}
              <strong className="text-slate-900 font-bold">{roleName}</strong> workspace.
            </p>
          </div>
        </div>

        {/* Details & Context */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Account Context Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 font-semibold uppercase tracking-wider text-[10.5px]">
              <span>Active Account Session</span>
              <span className="font-mono text-slate-400">{requestedPath}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-slate-400 text-[11px] block">Authenticated Employee</span>
                <span className="font-bold text-slate-800">{userName}</span>
                <span className="text-slate-500 block font-mono text-[11px]">{userEmail}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Assigned Institution</span>
                <span className="font-semibold text-slate-800">{hospitalName}</span>
                <span className="text-slate-500 block text-[11px]">
                  Scope: {session?.activeMembership?.departmentName || 'Facility-Wide'}
                </span>
              </div>
            </div>
          </div>

          {/* Authorized Alternatives */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-teal-700" />
              <span>Your Authorized Roles & Workspaces ({authorizedRoles.length})</span>
            </h3>

            {authorizedRoles.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                No active clinical or administrative roles are assigned to this account. Please contact your hospital administrator for role provisioning.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {authorizedRoles.map((role) => {
                  const Icon = ROLE_ICONS[role] || Briefcase;
                  const title = ROLE_DISPLAY_NAMES[role] || role;
                  return (
                    <button
                      key={role}
                      onClick={() => onNavigateToRole(role)}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-teal-50/50 hover:border-teal-300 transition-all text-left flex items-center justify-between group cursor-pointer shadow-2xs hover:shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 group-hover:bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60 transition-colors">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 group-hover:text-teal-950 block">
                            {title}
                          </span>
                          <span className="text-[10px] text-slate-500">Open authorized dashboard</span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-teal-700 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              Need access? Request a role assignment change from your Department Head or Hospital Administrator.
            </span>
            <button
              onClick={onLogout}
              className="px-4 py-2 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign In with Different Account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

