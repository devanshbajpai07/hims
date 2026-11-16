import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
  Clock,
  Ban,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import { authService, AuthenticationError, MembershipStatusError } from '../services/authService';
import { AuthSession, TenantMembership, User } from '../types/auth';
import { WorkspaceSelectorModal } from '../components/auth/WorkspaceSelectorModal';
import { AssignmentSelectorModal } from '../components/auth/AssignmentSelectorModal';
import { clinicalApiClient } from '../services/clinicalApiClient';

interface LoginPageProps {
  onNavigate: (path: string) => void;
  onLoginSuccess: (session: AuthSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigate,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Interaction & submission states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<{
    status: 'pending' | 'suspended' | 'terminated';
    hospitalName: string;
    reason?: string;
  } | null>(null);

  // Multi-hospital workspace selection
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [multiUser, setMultiUser] = useState<User | null>(null);
  const [multiMemberships, setMultiMemberships] = useState<TenantMembership[]>([]);

  // Multi-role assignment selection for employees with >1 verified role
  const [roleSelectModalOpen, setRoleSelectModalOpen] = useState(false);
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusError(null);

    // Validation
    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setErrorMessage('Username or official email is required.');
      return;
    }

    if (!password) {
      setErrorMessage('Password is required. Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.login({
        username: trimmedUser,
        password,
        rememberMe,
      });

      if (result.requiresWorkspaceSelection && result.availableMemberships) {
        const uObj = result.user || {
          id: result.userId || '',
          username: trimmedUser,
          email: '',
          legalName: trimmedUser,
          createdAt: '',
        };
        setMultiUser(uObj);
        setMultiMemberships(result.availableMemberships);
        setWorkspaceModalOpen(true);
        setLoading(false);
        return;
      }

      if (result.session) {
        const assigns = result.session.activeMembership?.assignments || [];
        if (assigns.length > 1) {
          // Employee holds multiple verified roles: give option to choose which role to log into first!
          setPendingSession(result.session);
          setRoleSelectModalOpen(true);
          setLoading(false);
          return;
        }
        onLoginSuccess(result.session);
      }
    } catch (err: any) {
      if (err instanceof MembershipStatusError) {
        setStatusError({
          status: err.status,
          hospitalName: err.hospitalName,
          reason: err.reason,
        });
      } else if (err instanceof AuthenticationError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected network error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelected = async (assignmentId: string) => {
    if (!pendingSession) return;
    try {
      setLoading(true);
      const targetAssign = pendingSession.activeMembership.assignments?.find(
        (a) => a.id === assignmentId
      );
      if (targetAssign) {
        let updatedSession: AuthSession = { ...pendingSession };
        try {
          const switchRes = await clinicalApiClient.switchAssignment(assignmentId, pendingSession.token);
          const effectivePerms = switchRes.effective_permissions || targetAssign.permissions || [];
          updatedSession = {
            ...pendingSession,
            token: switchRes.access_token || pendingSession.token,
            effectivePermissions: effectivePerms,
            activeAssignment: targetAssign,
            activeMembership: {
              ...pendingSession.activeMembership,
              role: targetAssign.roleCode as any,
              activeAssignmentId: targetAssign.id,
              departmentId: targetAssign.departmentId,
              department: targetAssign.departmentName || pendingSession.activeMembership.department,
              departmentName: targetAssign.departmentName,
              scopeType: targetAssign.scopeType,
              effectivePermissions: effectivePerms,
            },
          };
        } catch {
          updatedSession = {
            ...pendingSession,
            activeAssignment: targetAssign,
            activeMembership: {
              ...pendingSession.activeMembership,
              role: targetAssign.roleCode as any,
              activeAssignmentId: targetAssign.id,
              departmentId: targetAssign.departmentId,
              department: targetAssign.departmentName || pendingSession.activeMembership.department,
              departmentName: targetAssign.departmentName,
              scopeType: targetAssign.scopeType,
              effectivePermissions: targetAssign.permissions || [],
            },
          };
        }
        setRoleSelectModalOpen(false);
        onLoginSuccess(updatedSession);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceSelected = async (membership: TenantMembership) => {
    if (!multiUser) return;
    try {
      setLoading(true);
      const session = await authService.selectWorkspace(multiUser.id, membership.hospitalId, rememberMe);
      setWorkspaceModalOpen(false);

      const assigns = session.activeMembership?.assignments || [];
      if (assigns.length > 1) {
        // Multi-role employee: show role selection modal for the selected hospital workspace
        setPendingSession(session);
        setRoleSelectModalOpen(true);
        setLoading(false);
        return;
      }

      onLoginSuccess(session);
    } catch (err: any) {
      if (err instanceof MembershipStatusError) {
        setStatusError({
          status: err.status,
          hospitalName: err.hospitalName,
          reason: err.reason,
        });
      } else {
        setErrorMessage(err.message || 'Workspace authorization failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Background Soft Atmospheric Radiance */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-teal-500/5 via-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Header Bar (Exact match with Enterprise Sign-In Header) */}
      <header className="relative z-10 w-full py-2 sm:py-3 font-sans">
        <div className="w-full max-w-[1536px] mx-auto px-4 sm:px-10 lg:px-14 h-16 sm:h-22 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2.5 sm:gap-3.5 group text-left outline-none cursor-pointer shrink min-w-0"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition-transform shrink-0">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-950 font-sans truncate">
                Aarogya
              </span>
            </div>
          </button>

          {/* Back to Home Button */}
          <button
            onClick={() => onNavigate('/')}
            className="px-3.5 py-2 sm:px-8 sm:py-3.5 rounded-full text-xs sm:text-[17px] font-semibold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 shadow-md hover:shadow-native-glow transition-all duration-200 flex items-center gap-1.5 sm:gap-2.5 group cursor-pointer border border-emerald-400/30 font-sans shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-5 sm:h-5 transition-transform group-hover:-translate-x-1" />
            <span className="hidden sm:inline">Back to Home</span>
            <span className="sm:hidden">Home</span>
          </button>
        </div>
      </header>

      {/* Main Unified Connected Flow */}
      <main className="relative z-10 flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 flex flex-col justify-center">
        {/* Centered Brand Title & Platform Context */}
        <div className="text-center max-w-5xl xl:max-w-6xl mx-auto mb-6 sm:mb-12">
          {/* Overline with flanking accent hairlines */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-3 sm:mb-5">
            <div className="h-[1.5px] w-8 sm:w-16 bg-slate-300" />
            <span className="text-xs sm:text-sm font-mono font-semibold text-slate-600 uppercase tracking-[0.2em] sm:tracking-[0.25em]">
              EMPLOYEE PORTAL
            </span>
            <div className="h-[1.5px] w-8 sm:w-16 bg-slate-300" />
          </div>

          {/* Heading in editorial serif style */}
          <h1 className="text-2xl sm:text-4xl lg:text-[3.75rem] font-serif font-normal text-slate-950 tracking-[-0.02em] leading-[1.15]">
            <span className="text-[#1A6865] font-serif font-medium">Employee</span> Sign-In
          </h1>

          {/* Supporting description */}
          <p className="mt-3 sm:mt-5 text-sm sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed w-full max-w-xl md:max-w-3xl mx-auto px-2 sm:px-0">
            Enter your global employee credentials to access your hospital workspace, clinical operations, and patient records.
          </p>
        </div>

        {/* Unified Integrated Container: Form + Docked Capabilities */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-lg overflow-hidden transition-all max-w-5xl mx-auto w-full">
          {/* Form Region */}
          <div className="px-7 sm:px-10 pt-10 sm:pt-14 pb-8 sm:pb-10 max-w-xl mx-auto w-full">
            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Membership Status Error: PENDING */}
            {statusError?.status === 'pending' && (
              <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Membership Pending Approval</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-800">
                  Your employee registration at <strong>{statusError.hospitalName}</strong> has been submitted, but is currently awaiting mandatory verification:
                </p>
                <div className="text-[11px] font-mono bg-white/70 p-2.5 rounded-lg border border-amber-200 space-y-1">
                  <div>1. Department Head Review: [PENDING]</div>
                  <div>2. Hospital Administrator Approval: [PENDING]</div>
                </div>
                <p className="text-[11px] text-amber-700 italic">
                  Operational dashboard access cannot be granted until approvals are finalized by administration.
                </p>
              </div>
            )}

            {/* Membership Status Error: SUSPENDED */}
            {statusError?.status === 'suspended' && (
              <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Membership Suspended</span>
                </div>
                <p className="text-xs leading-relaxed text-rose-800">
                  Your hospital membership at <strong>{statusError.hospitalName}</strong> has been suspended by administration.
                </p>
                {statusError.reason && (
                  <p className="text-[11px] font-mono bg-white/70 p-2 rounded-lg border border-rose-200">
                    Reason: {statusError.reason}
                  </p>
                )}
                <p className="text-xs text-rose-700">
                  Please contact your Hospital Administrator to resolve this administrative hold.
                </p>
              </div>
            )}

            {/* Membership Status Error: TERMINATED */}
            {statusError?.status === 'terminated' && (
              <div className="mb-5 p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs sm:text-sm space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Ban className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Account Terminated</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600">
                  Your employee account at <strong>{statusError.hospitalName}</strong> has been permanently terminated. Operational access is revoked.
                </p>
              </div>
            )}

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7">
              {/* Username or Official Email Field */}
              <div>
                <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                  Username or Official Email
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoComplete="username email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username or official email address"
                    className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                  />
                  <UserIcon className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('/forgot-password');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-sm font-medium text-teal-800 hover:text-teal-950 hover:underline cursor-pointer no-lift transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-11 pr-11 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                  />
                  <Lock className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle no-lift absolute top-0 bottom-0 right-0 px-3.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer select-none"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>

                {/* Remember this device */}
                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4.5 h-4.5 rounded text-teal-800 focus:ring-teal-700 border-slate-300 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-slate-700">Remember this device</span>
                  </label>
                </div>
              </div>

              {/* Main Submit Button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="no-hover-lift w-full py-4 px-8 rounded-full text-base sm:text-[17px] font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer disabled:opacity-50 font-sans tracking-wide"
                >
                  <span>{loading ? 'Authenticating...' : 'Sign In to Employee Portal'}</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            </form>

            {/* Registration Prompt Section - Cleanly designed at bottom */}
            <div className="mt-8 pt-7 border-t border-slate-100 text-center space-y-3">
              <p className="text-sm text-slate-500 font-normal">
                First time using this hospital&apos;s Aarogya system?
              </p>
              <button
                type="button"
                onClick={() => {
                  onNavigate('/register');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-3.5 px-6 rounded-full border border-teal-200/90 bg-teal-50/70 hover:bg-teal-100/80 text-teal-900 text-sm sm:text-[14.5px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs hover:border-teal-300 group"
              >
                <span>Register your employee account</span>
                <ArrowRight className="w-4 h-4 text-teal-700 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          {/* Connected Lower Dock: Clinical Staff Testimonial Footnote */}
          <div className="bg-slate-50/80 border-t border-slate-200/80 px-7 sm:px-12 py-7 sm:py-8 text-center">
            <p className="italic text-xs sm:text-[13.5px] text-slate-600 leading-normal">
              &ldquo;Shift handoffs, inpatient charting, and emergency triage feel natural and immediate. Aarogya gave our clinical staff hours back with our patients.&rdquo;
              <strong className="text-slate-900 font-semibold not-italic ml-2">&mdash; Clinical Staff Leadership</strong>
            </p>
          </div>
        </div>
      </main>

      {/* Multi-hospital workspace selection modal */}
      <WorkspaceSelectorModal
        isOpen={workspaceModalOpen}
        user={multiUser}
        memberships={multiMemberships}
        onSelect={handleWorkspaceSelected}
        onCancel={() => setWorkspaceModalOpen(false)}
      />

      {/* Multi-role assignment selector modal for employees holding > 1 verified role */}
      {pendingSession && (
        <AssignmentSelectorModal
          isOpen={roleSelectModalOpen}
          onClose={() => setRoleSelectModalOpen(false)}
          canClose={true}
          assignments={pendingSession.activeMembership?.assignments || []}
          activeAssignmentId={pendingSession.activeMembership?.activeAssignmentId}
          userName={pendingSession.user?.legalName}
          hospitalName={pendingSession.activeMembership?.hospitalName}
          onSelectAssignment={handleRoleSelected}
        />
      )}

      {/* Subtle Bottom Footer Strip */}
      <footer className="relative z-10 w-full max-w-[1536px] mx-auto px-6 sm:px-10 lg:px-14 py-6 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>© 2026 Aarogya Health Systems Inc.</span>
          <span>•</span>
          <span>Hospital Information Management System</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Systems Normal</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">HIPAA &amp; FHIR Compliant</span>
        </div>
      </footer>
    </div>
  );
};
