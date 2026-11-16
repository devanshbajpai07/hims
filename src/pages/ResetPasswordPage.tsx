import React, { useState, useEffect } from 'react';
import { Activity, ArrowLeft, ArrowRight, Eye, EyeOff, Lock, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { purchaserApiClient } from '../services/purchaserApiClient';
import { hospitalAdminApiClient } from '../services/hospitalAdminApiClient';
import { authService } from '../services/authService';

interface ResetPasswordPageProps {
  onNavigate: (path: string) => void;
  context?: 'purchaser' | 'admin' | 'employee';
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  onNavigate,
  context = 'purchaser',
}) => {
  const [token, setToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(3);

  // Extract reset token from URL search parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token') || params.get('reset_token') || '';
    setToken(urlToken);

    if (!urlToken) {
      setErrorMessage(
        'Missing password reset token. Please check the link from your email or request a fresh reset link.'
      );
    }
  }, []);

  // Determine portal configuration based on context
  const getContextConfig = () => {
    switch (context) {
      case 'admin':
        return {
          overline: 'HOSPITAL ADMINISTRATOR PORTAL',
          portalTitle: 'Administrator',
          loginPath: '/admin/login',
          loginLabel: 'Return to Administrator Login',
          quote: '"Facility-scoped governance, granular delegation, and automated audit trails give our hospital leadership absolute operational clarity." — Hospital Operations & Clinical Leadership',
        };
      case 'employee':
        return {
          overline: 'CLINICAL EMPLOYEE ACCESS',
          portalTitle: 'Employee',
          loginPath: '/login',
          loginLabel: 'Return to Employee Login',
          quote: '"Shift handoffs, inpatient charting, and emergency triage feel natural and immediate. Aarogya gives clinical staff hours back with patients." — Clinical Staff Operations',
        };
      case 'purchaser':
      default:
        return {
          overline: 'ENTERPRISE PORTAL',
          portalTitle: 'Enterprise',
          loginPath: '/account/login',
          loginLabel: 'Return to Enterprise Login',
          quote: '"Licensing and provisioning multi-facility hospital infrastructure used to take fiscal quarters. With Aarogya, our health network was fully operational in minutes." — Victoria Sterling, VP of Health Informatics & Procurement',
        };
    }
  };

  const config = getContextConfig();

  // Redirect countdown effect when password reset is successful
  useEffect(() => {
    if (!successMessage) return;

    if (redirectCountdown <= 0) {
      onNavigate(`${config.loginPath}?reset=success`);
      return;
    }

    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [successMessage, redirectCountdown, onNavigate, config.loginPath]);

  // Validation rules
  const meetsMinLength = newPassword.length >= 8;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage('Missing password reset token. Please request a new reset email.');
      return;
    }

    if (!meetsMinLength) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter identical passwords.');
      return;
    }

    setLoading(true);

    try {
      if (context === 'purchaser') {
        const res = await purchaserApiClient.resetPassword(token, newPassword, confirmPassword);
        setSuccessMessage(res.message || 'Password has been successfully reset. You can now log in.');
      } else if (context === 'admin') {
        const res = await hospitalAdminApiClient.resetPassword(token, newPassword, confirmPassword);
        setSuccessMessage(res.message || 'Password has been successfully reset. You can now log in.');
      } else {
        const res = await authService.resetPassword({
          token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        });
        setSuccessMessage(res.message || 'Password has been successfully reset. You can now log in.');
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Unable to reset password. The link may have expired or is invalid.'
      );
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

      {/* Top Header Bar */}
      <header className="relative z-10 w-full py-3 font-sans">
        <div className="w-full max-w-[1536px] mx-auto px-6 sm:px-10 lg:px-14 h-22 flex items-center justify-between">
          {/* Brand Logo */}
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-3.5 group text-left outline-none cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition-transform">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-950 font-sans">
                Aarogya
              </span>
            </div>
          </button>

          {/* Back to Home Button */}
          <button
            onClick={() => onNavigate('/')}
            className="px-7 py-3 sm:px-8 sm:py-3.5 rounded-full text-base sm:text-[17px] font-semibold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 shadow-md hover:shadow-native-glow transition-all duration-200 flex items-center gap-2.5 group cursor-pointer border border-emerald-400/30 font-sans"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span>Back to Home</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col justify-center">
        {/* Centered Brand Title & Overline */}
        <div className="text-center max-w-5xl xl:max-w-6xl mx-auto mb-10 sm:mb-12">
          {/* Overline with flanking accent hairlines */}
          <div className="flex items-center justify-center gap-4 mb-4 sm:mb-5">
            <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
            <span className="text-xs sm:text-sm font-mono font-semibold text-slate-600 uppercase tracking-[0.25em]">
              {config.overline}
            </span>
            <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
          </div>

          {/* Heading in editorial serif style */}
          <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-serif font-normal text-slate-950 tracking-[-0.02em] leading-[1.12]">
            <span className="text-[#1A6865] font-serif font-medium">Reset</span> Password
          </h1>

          {/* Supporting description */}
          <p className="mt-5 text-base sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed w-full max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-0">
            Choose a new secure password for your account. It must differ from previously used passwords.
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-lg overflow-hidden transition-all max-w-5xl mx-auto w-full">
          <div className="px-7 sm:px-10 pt-10 sm:pt-14 pb-8 sm:pb-10 max-w-xl mx-auto w-full">
            {/* Success State */}
            {successMessage ? (
              <div className="text-center space-y-6 py-4 animate-fadeIn">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-soft-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-serif font-medium text-slate-950">
                    Password Reset Successfully
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                    {successMessage}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200/80 text-teal-900 text-xs sm:text-sm flex items-center justify-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0" />
                  <span>
                    Redirecting to sign-in in <strong>{redirectCountdown}</strong> seconds...
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate(config.loginPath)}
                  className="w-full py-4 rounded-xl text-base font-semibold text-white bg-[#1A6865] hover:bg-[#145350] shadow-soft-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Proceed to Sign In Now</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ) : !token ? (
              /* Missing Token Barrier State */
              <div className="text-center space-y-6 py-4 animate-fadeIn">
                <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-soft-sm">
                  <AlertCircle className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-serif font-medium text-slate-950">
                    Email Reset Link Required
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                    For your security, password resets can only be completed by accessing the time-limited link sent directly to your official email inbox.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-xs text-left font-mono space-y-1.5 max-w-md mx-auto">
                  <div className="font-semibold text-slate-800">• DIRECT ACCESS RESTRICTED</div>
                  <div>• ENCRYPTION: CRYPTOGRAPHIC SINGLE-USE HMAC-SHA256 TOKEN</div>
                  <div>• REQUIRED: CLICK LINK DISPATCHED TO REGISTERED EMAIL</div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(
                        context === 'admin'
                          ? '/admin/forgot-password'
                          : context === 'purchaser'
                          ? '/account/login'
                          : '/forgot-password'
                      )
                    }
                    className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all cursor-pointer shadow-sm"
                  >
                    Request Password Reset Link
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(config.loginPath)}
                    className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-all cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              </div>
            ) : (
              /* Password Reset Form */
              <div className="space-y-6">
                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 animate-fadeIn">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* New Password Field */}
                  <div>
                    <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                      New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full pl-11 pr-11 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900 font-sans"
                      />
                      <Lock className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="password-toggle no-lift absolute top-0 bottom-0 right-0 px-3.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer select-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4.5 h-4.5" />
                        ) : (
                          <Eye className="w-4.5 h-4.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password Field */}
                  <div>
                    <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                      Confirm Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full pl-11 pr-11 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900 font-sans"
                      />
                      <Lock className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="password-toggle no-lift absolute top-0 bottom-0 right-0 px-3.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer select-none"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4.5 h-4.5" />
                        ) : (
                          <Eye className="w-4.5 h-4.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Password requirements indicators */}
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          meetsMinLength ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                      <span>At least 8 characters in length</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          passwordsMatch ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                      <span>Passwords match</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Must differ from previous password (verified in database)</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !meetsMinLength || !passwordsMatch || !token}
                    className="w-full py-4 rounded-xl text-base font-semibold text-white bg-[#1A6865] hover:bg-[#145350] shadow-soft-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span>Verifying & Resetting Password...</span>
                    ) : (
                      <>
                        <span>Reset Password</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Return Link */}
                <div className="text-center pt-2 text-sm">
                  <button
                    type="button"
                    onClick={() => onNavigate(config.loginPath)}
                    className="text-slate-500 hover:text-slate-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{config.loginLabel}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Docked Quote / Institutional Verification Footer */}
          <div className="px-6 py-5 bg-slate-50/70 border-t border-slate-200/80 text-center text-xs sm:text-sm text-slate-500 italic">
            {config.quote}
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="relative z-10 w-full max-w-[1536px] mx-auto px-6 sm:px-10 lg:px-14 py-8 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-sans">
        <div>
          © 2026 Aarogya Health Systems Inc. • Institutional Authentication
        </div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Systems Normal
          </span>
          <span>•</span>
          <span>HIPAA &amp; FHIR Compliant</span>
        </div>
      </footer>
    </div>
  );
};

