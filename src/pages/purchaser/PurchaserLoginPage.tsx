import React, { useState } from 'react';
import {
  Activity,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  Lock,
  Mail,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { purchaserService } from '../../services/purchaserService';
import { purchaserApiClient } from '../../services/purchaserApiClient';
import { authService } from '../../services/authService';
import { SUBSCRIPTION_PLANS } from '../../data/subscriptionPlans';

interface PurchaserLoginPageProps {
  onNavigate: (path: string) => void;
}

export const PurchaserLoginPage: React.FC<PurchaserLoginPageProps> = ({ onNavigate }) => {
  const searchParams = new URLSearchParams(window.location.search);
  const rawPlan = searchParams.get('plan') || '';
  const selectedPlan = rawPlan === 'basic' ? 'basic' : '';
  const billingInterval = searchParams.get('interval') || '';
  const isResetSuccess = searchParams.get('reset') === 'success';

  const storedEmployee = authService.getStoredSession();
  const defaultEmail = storedEmployee?.user?.email || '';
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showResetPopup, setShowResetPopup] = useState(isResetSuccess);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    setLoading(true);
    try {
      const res = await purchaserApiClient.login({
        email,
        password,
        rememberDevice: rememberMe,
      });

      // Synchronize in-memory purchaserService for un-migrated downstream components
      purchaserService.setCurrentPurchaser({
        id: res.purchaser.id,
        fullName: res.purchaser.full_name,
        email: res.purchaser.email,
        isEmailVerified: res.purchaser.is_email_verified,
        accountStatus: res.purchaser.account_status,
        createdAt: res.purchaser.created_at,
        lastLoginAt: res.purchaser.last_login_at,
      });

      // Resume selected purchase if intended, else dashboard
      if (selectedPlan) {
        const intervalQuery = billingInterval ? `&interval=${encodeURIComponent(billingInterval)}` : '';
        onNavigate(`/account/checkout?plan=${encodeURIComponent(selectedPlan)}${intervalQuery}`);
      } else {
        // Direct homepage login -> straight to dashboard
        onNavigate('/account/dashboard');
      }
    } catch (err: any) {
      if (
        err.data?.code === 'PURCHASER_EMAIL_UNVERIFIED' ||
        err.code === 'PURCHASER_EMAIL_UNVERIFIED' ||
        err.status === 403
      ) {
        const params = new URLSearchParams();
        params.set('email', email);
        if (selectedPlan) params.set('plan', selectedPlan);
        if (billingInterval) params.set('interval', billingInterval);
        onNavigate(`/account/verify-email?${params.toString()}`);
        return;
      }
      setErrorMessage(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter your work email address above first.');
      return;
    }
    setErrorMessage(null);
    try {
      const res = await purchaserApiClient.forgotPassword(email.trim());
      setInfoMessage(res.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process password reset request.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Password Reset Success Popup */}
      {showResetPopup && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-8 max-w-md w-full text-center animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl sm:text-2xl font-serif font-normal text-slate-950">
              Password Changed Successfully
            </h3>
            <p className="text-xs sm:text-[13.5px] text-slate-600 mt-2 mb-6 leading-relaxed">
              Your password has been securely updated. All previous sessions have been closed. Please sign in with your new password to access your enterprise portal.
            </p>
            <button
              type="button"
              onClick={() => setShowResetPopup(false)}
              className="w-full py-3.5 px-6 rounded-full text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 transition-colors shadow-md cursor-pointer"
            >
              Sign In with New Password
            </button>
          </div>
        </div>
      )}

      {/* Background Soft Atmospheric Radiance */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-teal-500/5 via-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Header Bar (Exact alignment, size, and position match with Homepage) */}
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
                aura
              </span>
            </div>
          </button>

          {/* Back to Home Button (Matched in size, position, and visual style to Homepage Login CTA) */}
          <button
            onClick={() => onNavigate('/')}
            className="px-7 py-3 sm:px-8 sm:py-3.5 rounded-full text-base sm:text-[17px] font-semibold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 shadow-md hover:shadow-native-glow transition-all duration-200 flex items-center gap-2.5 group cursor-pointer border border-emerald-400/30 font-sans"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span>Back to Home</span>
          </button>
        </div>
      </header>

      {/* Main Unified Connected Flow */}
      <main className="relative z-10 flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col justify-center">
        {/* Centered Brand Title & Platform Context */}
        <div className="text-center max-w-5xl xl:max-w-6xl mx-auto mb-10 sm:mb-12">
          {/* Overline with flanking accent hairlines, exactly like Pricing Page */}
          <div className="flex items-center justify-center gap-4 mb-4 sm:mb-5">
            <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
            <span className="text-xs sm:text-sm font-mono font-semibold text-slate-600 uppercase tracking-[0.25em]">
              ENTERPRISE PORTAL
            </span>
            <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
          </div>

          {/* Heading in editorial serif style matching Pricing Page */}
          <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-serif font-normal text-slate-950 tracking-[-0.02em] leading-[1.12]">
            <span className="text-[#1A6865] font-serif font-medium">Enterprise</span> Sign-In
          </h1>

          {/* Supporting description with generous, relaxed human typography based on device width */}
          <p className="mt-5 text-base sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed w-full max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-0">
            Manage multi-hospital subscription quotas, register dedicated Hospital UIDs, and govern administrator permissions across your health network.
          </p>

          {/* Preserved Plan Notice if coming from pricing */}
          {selectedPlan && (
            <div className="mt-5 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-teal-50 border border-teal-200/90 text-xs text-teal-900 shadow-xs">
              <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
              <span>
                Preserved Selection: <strong>{(SUBSCRIPTION_PLANS[selectedPlan]?.name || selectedPlan).toUpperCase()} Plan</strong>
              </span>
              <button
                onClick={() => onNavigate('/pricing')}
                className="text-teal-800 underline font-medium hover:text-teal-950 cursor-pointer ml-1"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Unified Integrated Container: Form + Docked Capabilities */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-lg overflow-hidden transition-all max-w-5xl mx-auto w-full">
          {/* Top Form Region - Balanced generous top spacing */}
          <div className="px-7 sm:px-10 pt-10 sm:pt-14 pb-8 sm:pb-10 max-w-xl mx-auto w-full">
            {/* Segmented Auth Selector - Slightly bigger in length & text */}
            <div className="flex rounded-2xl bg-slate-100/90 p-1.5 mb-9 text-sm sm:text-[14.5px] font-semibold max-w-lg mx-auto w-full">
              <button
                type="button"
                className="flex-1 py-3 px-6 text-center rounded-xl bg-white text-slate-950 shadow-xs cursor-default font-bold no-lift"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (selectedPlan) params.set('plan', selectedPlan);
                  if (billingInterval) params.set('interval', billingInterval);
                  const qs = params.toString() ? `?${params.toString()}` : '';
                  onNavigate(`/account/register${qs}`);
                }}
                className="flex-1 py-3 px-6 text-center rounded-xl text-slate-600 hover:text-slate-950 transition-colors cursor-pointer no-lift font-semibold"
              >
                Create Account
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Info Message */}
            {infoMessage && (
              <div className="mb-5 p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{infoMessage}</span>
                </div>
                <div className="text-[11px] text-teal-700 font-mono mt-1 pt-1.5 border-t border-teal-200/60">
                  Please check your registered email inbox for the single-use reset password link.
                </div>
              </div>
            )}

            {/* Form - Increased vertical field spacing */}
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7">
              <div>
                <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="purchaser@healthgroup.org"
                    className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                  />
                  <Mail className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

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

                {/* Remember this device placed right below Password field with minimal in-spacing */}
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

              {/* Main Submit Button - Proportionately closer */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="no-hover-lift w-full py-4 px-8 rounded-full text-base sm:text-[17px] font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer disabled:opacity-50 font-sans tracking-wide"
                >
                  <span>{loading ? 'Authenticating...' : 'Sign In to Enterprise Portal'}</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            </form>
          </div>

          {/* Connected Lower Dock: Dr. Marcus Testimonial Footnote in single balanced line with generous vertical padding */}
          <div className="bg-slate-50/80 border-t border-slate-200/80 px-7 sm:px-12 py-7 sm:py-8 text-center">
            <p className="italic text-xs sm:text-[13.5px] text-slate-600 leading-normal">
              "AURA unified intake across our hospital wings with zero administrative friction."
              <strong className="text-slate-900 font-semibold not-italic ml-2">— Chief Medical Officer</strong>
            </p>
          </div>
        </div>
      </main>

      {/* Subtle Bottom Footer Strip */}
      <footer className="relative z-10 w-full max-w-[1536px] mx-auto px-6 sm:px-10 lg:px-14 py-6 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>© 2026 AURA Health Systems Inc.</span>
          <span>•</span>
          <span>Institutional Procurement</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Systems Normal</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">HIPAA & FHIR Compliant</span>
        </div>
      </footer>
    </div>
  );
};
