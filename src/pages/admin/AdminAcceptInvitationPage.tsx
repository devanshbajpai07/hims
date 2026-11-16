import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Phone,
} from 'lucide-react';
import {
  hospitalAdminApi,
  InvitationVerifyResponse,
} from '../../services/hospitalAdminApiClient';
import { InstitutionalLoadingScreen } from '../../components/common/InstitutionalLoadingScreen';

interface AdminAcceptInvitationPageProps {
  onNavigate: (path: string) => void;
}

export const AdminAcceptInvitationPage: React.FC<AdminAcceptInvitationPageProps> = ({ onNavigate }) => {
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token') || '';

  const [verifying, setVerifying] = useState(true);
  const [invitation, setInvitation] = useState<InvitationVerifyResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMessage('Missing invitation token in URL query parameter.');
      setVerifying(false);
      return;
    }

    hospitalAdminApi
      .verifyInvitationToken(token)
      .then((inv) => {
        setInvitation(inv);
        // Pre-fill username suggestion based on email prefix
        const suggested = inv.invitee_email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
        setUsername(suggested || 'admin');
      })
      .catch((err: any) => {
        setErrorMessage(err.message || 'Invitation is invalid or has expired.');
      })
      .finally(() => {
        setVerifying(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters in length.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      await hospitalAdminApi.acceptInvitation({
        token,
        password,
        username: username.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setAcceptedSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete administrator registration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between font-sans">
      {/* Minimal Top Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md py-4 px-6 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-serif text-xl font-bold tracking-tight text-teal-900">Aarogya</span>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-medium">
              Administrator Acceptance
            </span>
          </div>
          <button
            onClick={() => onNavigate('/')}
            className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12 w-full flex-1 flex flex-col justify-center">
        {/* State 1: Verifying Token */}
        {verifying && (
          <InstitutionalLoadingScreen
            badge="CRYPTOGRAPHIC VERIFICATION"
            title="Verifying Administrator Invitation"
            subtitle="Validating single-use cryptographic token and hospital tenant assignment."
            stages={[
              'Validating single-use institutional signature...',
              'Resolving hospital facility tenant ID...',
              'Checking administrator seat availability...',
              'Preparing onboarding credential setup...',
            ]}
          />
        )}

        {/* State 2: Invalid or Expired Token */}
        {!verifying && errorMessage && !invitation && (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold font-sans text-slate-950">Invalid or Expired Invitation</h2>
            <p className="text-xs text-slate-600 font-normal leading-relaxed">{errorMessage}</p>
            <div className="pt-2">
              <button
                onClick={() => onNavigate('/')}
                className="px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all cursor-pointer shadow-sm"
              >
                Return to Aarogya Home
              </button>
            </div>
          </div>
        )}

        {/* State 3: Accepted Successfully */}
        {acceptedSuccess && (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm p-8 sm:p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
              Registration Activated
            </span>
            <h2 className="text-2xl font-bold font-sans text-slate-950">Administrator Account Configured</h2>
            <p className="text-xs text-slate-600 font-normal leading-relaxed max-w-sm mx-auto">
              You are now an authorized Hospital Administrator for{' '}
              <strong className="text-slate-900 font-semibold">{invitation?.hospital_name}</strong>.
              Your hospital-wide administrative permissions have been initialized.
            </p>
            <div className="pt-4">
              <button
                onClick={() => onNavigate('/admin/login')}
                className="w-full py-3 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Proceed to Administrator Sign-In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* State 4: Valid Invitation — Form Submission */}
        {!verifying && invitation && !acceptedSuccess && (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm p-8 sm:p-9 space-y-6">
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200 mb-2">
                <ShieldCheck className="w-3 h-3 text-teal-700" />
                <span>Executive Onboarding</span>
              </div>
              <h2 className="text-2xl font-bold font-sans text-slate-950">Accept Administrator Role</h2>
              <p className="text-xs text-slate-500 font-normal mt-1">
                Configure your employee credentials to activate governance access.
              </p>
            </div>

            {/* Hospital Identification Banner */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Institution:</span>
                <span className="font-bold text-slate-900 font-sans">{invitation.hospital_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Hospital UID:</span>
                <span className="font-mono text-teal-800 font-semibold">{invitation.hospital_uid}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Authorized Email:</span>
                <span className="font-mono text-slate-700">{invitation.invitee_email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Subscription Tier:</span>
                <span className="font-semibold text-slate-800">{invitation.plan_code} Plan</span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Full Name (Authorized)
                </label>
                <input
                  type="text"
                  disabled
                  value={invitation.invitee_name}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Administrator Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. administrator_username"
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Create Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle no-lift absolute top-0 bottom-0 right-0 px-3 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer select-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password exactly"
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Contact Phone (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{submitting ? 'Activating Credentials...' : 'Accept Invitation & Activate Account'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200/60">
        &copy; {new Date().getFullYear()} Aarogya Healthcare Information Management System. All rights reserved.
      </footer>
    </div>
  );
};

