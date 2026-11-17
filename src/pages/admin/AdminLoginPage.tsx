import React, { useState } from 'react';
import {
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Building2,
  AlertCircle,
  CheckCircle2,
  Activity,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import {
  hospitalAdminApi,
  AdminLoginResponse,
} from '../../services/hospitalAdminApiClient';
import { authService } from '../../services/authService';

interface AdminLoginPageProps {
  onNavigate: (path: string) => void;
  onLoginSuccess?: (res: AdminLoginResponse) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onNavigate,
  onLoginSuccess,
}) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Multi-hospital workspace selection state
  const [workspaceSelection, setWorkspaceSelection] = useState<AdminLoginResponse | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

  React.useEffect(() => {
    const stored = authService.getStoredSession();
    const hasAdminToken = typeof window !== 'undefined' && (
      window.sessionStorage?.getItem('hims_admin_token') ||
      window.localStorage?.getItem('hims_admin_token')
    );
    if (stored?.activeMembership?.role === 'admin' && hasAdminToken) {
      onNavigate('/admin/dashboard');
    }
  }, [onNavigate]);

  const handleLoginSubmit = async (e: React.FormEvent | null, hospitalIdToSelect?: string) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!usernameOrEmail.trim() || !password) {
      setErrorMessage('Please enter both your administrator username/email and password.');
      return;
    }

    if (hospitalIdToSelect) {
      setSelectedHospitalId(hospitalIdToSelect);
    }

    setLoading(true);
    try {
      const res = await hospitalAdminApi.loginAdmin({
        username_or_email: usernameOrEmail.trim(),
        password,
        hospital_id: hospitalIdToSelect,
        remember_me: rememberMe,
      });

      if (res.requires_hospital_selection && res.available_hospitals && res.available_hospitals.length > 1) {
        setWorkspaceSelection(res);
        setLoading(false);
        return;
      }

      if (res.user && res.hospital && res.token) {
        const adminAssign = {
          id: 'admin-slot',
          roleId: 'admin-role',
          roleCode: 'admin' as const,
          roleName: 'Hospital Administrator',
          departmentName: 'Administration',
          scopeType: 'FACILITY' as const,
          permissions: ['*'],
          isActive: true,
        };
        const adminSession = {
          user: {
            id: res.user.id,
            username: res.user.username,
            email: res.user.email,
            legalName: res.user.full_name,
            createdAt: new Date().toISOString(),
          },
          activeMembership: {
            id: res.user.id,
            userId: res.user.id,
            hospitalId: res.hospital.id,
            hospitalUid: res.hospital.hospital_uid,
            hospitalName: res.hospital.name,
            employeeUid: 'ADMIN',
            role: 'admin' as const,
            department: 'Administration',
            departmentName: 'Administration',
            scopeType: 'FACILITY' as const,
            status: 'active' as const,
            departmentHeadApproved: true,
            adminApproved: true,
            joinedAt: new Date().toISOString(),
            assignments: [adminAssign],
            activeAssignmentId: 'admin-slot',
            effectivePermissions: ['*'],
          },
          assignments: [adminAssign],
          activeAssignment: adminAssign,
          effectivePermissions: ['*'],
          availableMemberships: [],
          rememberMe,
          token: res.token,
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        };
        authService.setStoredSession(adminSession);
      }

      if (onLoginSuccess) {
        onLoginSuccess(res);
      }
      onNavigate('/admin/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
      setSelectedHospitalId(null);
    }
  };

  const handleForgotPassword = () => {
    onNavigate('/admin/forgot-password');
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
        <div className="w-full max-w-[1536px] mx-auto px-4 sm:px-10 lg:px-14 h-16 sm:h-22 flex items-center justify-between">
          {/* Brand Logo */}
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2.5 sm:gap-3.5 group text-left outline-none cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-950 font-sans">
                Aarogya
              </span>
            </div>
          </button>

          {/* Back to Home Button */}
          <button
            onClick={() => onNavigate('/')}
            className="px-3.5 py-2 sm:px-8 sm:py-3.5 rounded-full text-xs sm:text-[17px] font-semibold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 shadow-md hover:shadow-native-glow transition-all duration-200 flex items-center gap-1.5 sm:gap-2.5 group cursor-pointer border border-emerald-400/30 font-sans"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-translate-x-1" />
            <span className="hidden sm:inline">Back to Home</span>
            <span className="sm:hidden">Home</span>
          </button>
        </div>
      </header>

      {/* Main Unified Connected Flow */}
      <main className="relative z-10 flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col justify-center">
        {/* Centered Brand Title & Platform Context */}
        <div className="text-center max-w-5xl xl:max-w-6xl mx-auto mb-10 sm:mb-12">
          {/* Overline with flanking accent hairlines */}
          <div className="flex items-center justify-center gap-4 mb-4 sm:mb-5">
            <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
            <span className="text-xs sm:text-sm font-mono font-semibold text-slate-600 uppercase tracking-[0.25em]">
              {workspaceSelection ? 'MULTI-FACILITY AUTHORIZATION' : 'HOSPITAL ADMINISTRATOR PORTAL'}
            </span>
            <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
          </div>

          {/* Heading in editorial serif style */}
          <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-serif font-normal text-slate-950 tracking-[-0.02em] leading-[1.12]">
            {workspaceSelection ? (
              <>
                <span className="text-[#1A6865] font-serif font-medium">Select</span> Hospital Workspace
              </>
            ) : (
              <>
                <span className="text-[#1A6865] font-serif font-medium">Administrator</span> Sign-In
              </>
            )}
          </h1>

          {/* Supporting description */}
          <p className="mt-5 text-base sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed w-full max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-0">
            {workspaceSelection
              ? 'Your administrator credentials grant executive governance across multiple healthcare facilities. Select the workspace you wish to govern.'
              : 'Hospital administrator authentication with facility-scoped governance, clinical operations oversight, and full audit tracking.'}
          </p>
        </div>

        {/* Unified Integrated Container: Form + Docked Capabilities */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-lg overflow-hidden transition-all max-w-5xl mx-auto w-full">
            {/* Top Form Region - Balanced generous spacing */}
            <div className={`px-7 sm:px-10 pt-10 sm:pt-12 pb-10 sm:pb-12 ${workspaceSelection ? 'max-w-2xl' : 'max-w-xl'} mx-auto w-full transition-all`}>
              {/* WORKSPACE SELECTION VIEW */}
              {workspaceSelection ? (
                <div className="animate-in fade-in duration-200">
                  {/* Scope & Identity Status Header */}
                  <div className="text-center mb-7">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/90 text-teal-800 flex items-center justify-center mx-auto mb-3.5 shadow-2xs">
                      <Building2 className="w-6 h-6 text-[#1A6865]" />
                    </div>

                    <h2 className="text-2xl sm:text-[26px] font-serif font-bold text-slate-950 tracking-tight mb-2">
                      Select Hospital Workspace
                    </h2>

                    {workspaceSelection.user && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 mb-2.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          Signed in as <strong className="text-slate-950 font-semibold font-sans">{workspaceSelection.user.full_name}</strong>
                        </span>
                      </div>
                    )}

                    <p className="text-xs sm:text-sm text-slate-600 font-sans max-w-md mx-auto leading-relaxed">
                      Your administrator credentials grant executive governance across multiple healthcare facilities. Select the workspace you wish to govern.
                    </p>
                  </div>

                  {/* Error Message Banner (if facility selection fails) */}
                  {errorMessage && (
                    <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
                      <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Available Hospital Facility Cards */}
                  <div className="space-y-3 mb-7">
                    {workspaceSelection.available_hospitals?.map((h) => {
                      const isThisLoading = loading && selectedHospitalId === h.hospital_id;
                      const planCode = (h.plan_code || '').toUpperCase();
                      const planName =
                        h.plan_name ||
                        (planCode === 'PRO' ? 'Pro' : planCode === 'ULTRA' || planCode === 'ENTERPRISE' ? 'Ultra' : 'Basic');

                      return (
                        <button
                          key={h.hospital_id}
                          onClick={() => handleLoginSubmit(null, h.hospital_id)}
                          disabled={loading}
                          className={`w-full p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex items-center justify-between group cursor-pointer text-left ${
                            isThisLoading
                              ? 'border-teal-700 bg-teal-50/50 shadow-soft-sm'
                              : 'border-slate-200 hover:border-[#1A6865] bg-white hover:bg-teal-50/20 hover:shadow-soft-sm'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-4">
                            <div className="font-bold text-slate-950 text-sm sm:text-base group-hover:text-[#1A6865] transition-colors leading-snug truncate">
                              {h.hospital_name}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="font-mono text-[11px] font-bold text-teal-900 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200/90 shadow-2xs">
                                {h.hospital_uid}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider border ${
                                  planCode === 'ENTERPRISE' || planCode === 'ULTRA'
                                    ? 'bg-purple-50 text-purple-900 border-purple-200'
                                    : planCode === 'PRO'
                                    ? 'bg-teal-50 text-teal-900 border-teal-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {planName} Tier
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isThisLoading ? (
                              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                                <Loader2 className="w-4.5 h-4.5 animate-spin text-[#1A6865]" />
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-[#1A6865] flex items-center justify-center transition-colors">
                                <ArrowRight className="w-4.5 h-4.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Switch Credentials Action */}
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setWorkspaceSelection(null);
                        setErrorMessage(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer py-1 px-3"
                    >
                      <span>&larr; Switch account credentials</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* PRIMARY FORM FLOW */
                <div>
                  {/* Error Message Banner */}
                  {errorMessage && (
                  <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
                    <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                  )}

                {/* Info / Feedback Banner */}
                  {infoMessage && (
                    <div className="mb-6 p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs sm:text-sm flex items-start gap-2.5">
                      <CheckCircle2 className="w-4.5 h-4.5 text-teal-600 shrink-0 mt-0.5" />
                      <span>{infoMessage}</span>
                    </div>
                  )}

                    {/* SIGN IN FORM */}
                    <form onSubmit={(e) => handleLoginSubmit(e)} className="space-y-6 sm:space-y-7">
                      {/* Username or Work Email Field */}
                      <div>
                        <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                          Username or Work Email
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={usernameOrEmail}
                            onChange={(e) => setUsernameOrEmail(e.target.value)}
                            placeholder="admin_username or admin@hospital.org"
                            className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                          />
                          <User className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                              onClick={handleForgotPassword}
                              className="text-sm font-medium text-teal-800 hover:text-teal-950 hover:underline cursor-pointer no-lift transition-colors"
                            >
                              Forgot password?
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
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

                        {/* Remember this device placed right below Password field */}
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
              <div className="pt-2 sm:pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="no-hover-lift w-full py-4 px-8 rounded-full text-base sm:text-[17px] font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer disabled:opacity-50 font-sans tracking-wide"
                >
                  <span>{loading ? 'Authenticating...' : 'Sign In to Administrator Portal'}</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            </form>
          </div>
            )}
    </div>

  {/* Connected Lower Dock: Administrator Domain Testimonial Footnote */}
  <div className="bg-slate-50/70 border-t border-slate-200/80 px-6 sm:px-10 py-5 text-center">
    <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed font-serif italic max-w-2xl mx-auto">
      &ldquo;Facility-scoped governance, granular delegation, and automated audit trails give our hospital leadership absolute operational clarity.&rdquo;
    </p>
    <div className="text-[12px] font-sans font-medium text-slate-700 mt-1.5 flex items-center justify-center gap-1.5">
      <span className="text-slate-400">&mdash;</span>
      <span className="font-semibold text-slate-900">Hospital Administration</span>
      <span className="text-slate-400">&bull;</span>
      <span className="text-slate-600">Governance & Operations</span>
    </div>
  </div>
        </div >
      </main >

  {/* Subtle Bottom Footer Strip (Exact Match to Enterprise Sign-In) */ }
<footer className="relative z-10 w-full max-w-[1536px] mx-auto px-6 sm:px-10 lg:px-14 py-6 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
  <div className="flex items-center gap-2">
    <span>© 2026 Aarogya Health Systems Inc.</span>
    <span>•</span>
    <span>Hospital Administrator Portal</span>
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
    </div >
  );
};
