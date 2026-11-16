import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowLeft,
  Mail,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { purchaserService } from '../../services/purchaserService';
import { purchaserApiClient } from '../../services/purchaserApiClient';

interface PurchaserVerifyEmailPageProps {
  onNavigate: (path: string) => void;
}

export const PurchaserVerifyEmailPage: React.FC<PurchaserVerifyEmailPageProps> = ({ onNavigate }) => {
  const searchParams = new URLSearchParams(window.location.search);
  const emailParam = searchParams.get('email') || '';
  const selectedPlan = searchParams.get('plan') || '';
  const billingInterval = searchParams.get('interval') || '';
  const [email] = useState(emailParam);
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await purchaserApiClient.verifyEmail({
        email,
        otp: otpCode.trim(),
      });
      setSuccessMessage(res.message);

      // Keep in-memory purchaserService synchronized for un-migrated downstream components
      purchaserService.setCurrentPurchaser({
        id: res.purchaser.id,
        fullName: res.purchaser.full_name,
        email: res.purchaser.email,
        isEmailVerified: res.purchaser.is_email_verified,
        accountStatus: res.purchaser.account_status,
        createdAt: res.purchaser.created_at,
        lastLoginAt: res.purchaser.last_login_at,
      });

      // If user had a plan selected, resume checkout! Otherwise dashboard
      setTimeout(() => {
        if (selectedPlan) {
          const intervalQuery = billingInterval ? `&interval=${encodeURIComponent(billingInterval)}` : '';
          onNavigate(`/account/checkout?plan=${encodeURIComponent(selectedPlan)}${intervalQuery}`);
        } else {
          onNavigate('/account/dashboard');
        }
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setErrorMessage(null);
    try {
      const res = await purchaserApiClient.resendOTP(email);
      setCooldown(60);
      setSuccessMessage(res.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend code.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
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
      <main className="relative z-10 flex-1 max-w-md w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        {/* Centered Brand Title & Platform Context */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-3.5">
            <div className="h-[1.5px] w-10 sm:w-14 bg-slate-300" />
            <span className="text-xs sm:text-sm font-mono font-semibold text-slate-600 uppercase tracking-[0.25em]">
              ENTERPRISE PORTAL
            </span>
            <div className="h-[1.5px] w-10 sm:w-14 bg-slate-300" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-serif font-normal text-slate-950 tracking-[-0.02em] leading-[1.15]">
            <span className="text-[#1A6865] font-serif font-medium">Verify</span> Enterprise Email
          </h1>

          <p className="mt-3.5 text-sm sm:text-base text-slate-600 font-normal leading-relaxed">
            We have dispatched a 6-digit confirmation code to{' '}
            <strong className="text-slate-800 font-semibold">{email || 'your email'}</strong>.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm p-6 sm:p-8">

          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 text-center mb-2">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • • • •"
                className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Verifying...' : 'Verify Code & Activate Portal'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {/* Resend Action */}
            <div className="pt-2 text-center">
              {cooldown > 0 ? (
                <span className="text-xs text-slate-400 font-mono">
                  Resend code available in {cooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-xs font-semibold text-teal-800 hover:underline flex items-center gap-1 mx-auto cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Resend Verification Code</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (selectedPlan) params.set('plan', selectedPlan);
              if (billingInterval) params.set('interval', billingInterval);
              const qs = params.toString() ? `?${params.toString()}` : '';
              onNavigate(`/account/register${qs}`);
            }}
            className="text-xs text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
          >
            ← Back to Registration
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-[1536px] mx-auto px-6 sm:px-10 lg:px-14 py-6 text-center text-xs text-slate-400 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span>© 2026 AURA Health Systems Inc.</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Institutional Procurement</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Systems Normal
          </span>
          <span>•</span>
          <span>HIPAA & FHIR Compliant</span>
        </div>
      </footer>
    </div>
  );
};

