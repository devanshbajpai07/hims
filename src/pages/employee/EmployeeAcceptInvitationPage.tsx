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
  Briefcase,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  hospitalAdminApi,
  EmployeeInvitationVerifyResponse,
} from '../../services/hospitalAdminApiClient';
import { InstitutionalLoadingScreen } from '../../components/common/InstitutionalLoadingScreen';

interface EmployeeAcceptInvitationPageProps {
  onNavigate: (path: string) => void;
}

export const EmployeeAcceptInvitationPage: React.FC<EmployeeAcceptInvitationPageProps> = ({ onNavigate }) => {
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token') || '';

  const [verifying, setVerifying] = useState(true);
  const [invitation, setInvitation] = useState<EmployeeInvitationVerifyResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [acceptedSuccessData, setAcceptedSuccessData] = useState<{
    employee_uid: string;
    hospital_name: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorMessage('Missing invitation token in URL query parameter.');
      setVerifying(false);
      return;
    }

    hospitalAdminApi
      .verifyEmployeeInvitation(token)
      .then((inv) => {
        setInvitation(inv);
        if (inv.has_existing_account && inv.existing_username) {
          setUsername(inv.existing_username);
        } else if (inv.suggested_username) {
          setUsername(inv.suggested_username);
        }
      })
      .catch((err: any) => {
        setErrorMessage(err.message || 'Invitation is invalid, expired, or has already been accepted.');
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

    if (!invitation?.has_existing_account) {
      if (!username.trim()) {
        setErrorMessage('Please provide a valid username.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-enter.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await hospitalAdminApi.acceptEmployeeInvitation({
        token,
        username: !invitation?.has_existing_account ? username.trim() : undefined,
        password,
      });

      setAcceptedSuccessData({
        employee_uid: res.employee_uid,
        hospital_name: res.hospital_name || invitation?.hospital_name || 'Hospital Facility',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete employee invitation acceptance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between font-sans">
      {/* Editorial Top Navigation Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md py-4 px-6 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-serif text-xl font-bold tracking-tight text-teal-900">Aarogya</span>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-medium">
              Staff Appointment Acceptance
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

      <main className="max-w-xl mx-auto px-4 py-10 w-full flex-1 flex flex-col justify-center">
        {/* State 1: Verifying Token */}
        {verifying && (
          <InstitutionalLoadingScreen
            badge="CRYPTOGRAPHIC VERIFICATION"
            title="Verifying Staff Appointment Invitation"
            subtitle="Validating institutional single-use cryptographic token and pre-authorized role assignments."
            stages={[
              'Validating single-use cryptographic signature...',
              'Resolving healthcare facility & department scopes...',
              'Verifying institutional headcount quotas...',
              'Preparing role assignment & credential provisioning...',
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

        {/* State 3: Acceptance Form */}
        {!verifying && invitation && !acceptedSuccessData && (
          <div className="space-y-6">
            {/* Top Introductory Banner */}
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider text-teal-900 bg-teal-50 border border-teal-200/80 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                <span>Pre-Authorized Appointment</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                Welcome to {invitation.hospital_name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                You have been invited to join the clinical workforce. Review your pre-authorized assignments below to activate your account.
              </p>
            </div>

            {/* Error Message if submit fails */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Institutional Summary Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">{invitation.hospital_name}</h3>
                    <div className="text-[11px] font-mono text-slate-500">{invitation.hospital_uid}</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {invitation.plan_code} Tier
                </span>
              </div>

              {/* Invitee Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono font-semibold">Invited Appointee</span>
                  <span className="font-bold text-slate-900">{invitation.invitee_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono font-semibold">Official Email</span>
                  <span className="font-medium text-slate-700">{invitation.invitee_email}</span>
                </div>
                {invitation.designation && (
                  <div className="sm:col-span-2 pt-1 border-t border-slate-200/60">
                    <span className="text-slate-400 block text-[10px] uppercase font-mono font-semibold">Designation</span>
                    <span className="font-semibold text-teal-900">{invitation.designation}</span>
                  </div>
                )}
              </div>

              {/* Pre-Authorized Scope & Role Placements */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-700 font-bold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-800" />
                    Pre-Authorized Placements ({invitation.assignments.length})
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Pre-Approved
                  </span>
                </div>

                <div className="space-y-2">
                  {invitation.assignments.map((asg, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-900 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-950">{asg.role_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {asg.scope_type === 'FACILITY' ? 'Hospital-wide (Facility Scope)' : `Department: ${asg.department_name || asg.department_code}`}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-teal-50 text-teal-900 border border-teal-200 shrink-0">
                        {asg.scope_type === 'FACILITY' ? 'Facility' : asg.department_code || 'Dept'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Credential Setup Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm p-6 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-teal-800" />
                  <span>
                    {invitation.has_existing_account ? 'Confirm Identity & Claim Placements' : 'Create Staff Credentials'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {invitation.has_existing_account
                    ? `An account for @${invitation.existing_username} already exists. Enter your password to link your new hospital placement.`
                    : 'Configure your username and secure password to activate your direct access.'}
                </p>
              </div>

              {!invitation.has_existing_account && (
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Aarogya Username <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                      placeholder="e.g. j_smith"
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-teal-700 font-mono transition-colors"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Your unique username for signing in across all authorized facilities.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  {invitation.has_existing_account ? 'Account Password' : 'New Password'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (min 8 characters)"
                    className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-teal-700 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!invitation.has_existing_account && (
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-teal-700 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Activating Membership...'
                      : invitation.has_existing_account
                      ? 'Link Facility & Accept Placements'
                      : 'Accept Placements & Activate Account'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* State 4: Acceptance Success View */}
        {acceptedSuccessData && (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-teal-50 border border-teal-200/80 text-teal-800 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200">
                <span>Account Activated</span>
              </div>
              <h2 className="text-2xl font-bold font-serif text-slate-950">
                Staff Onboarding Complete
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Your appointment at <strong>{acceptedSuccessData.hospital_name}</strong> is now officially active. Your assigned roles and clinical modules are ready.
              </p>
            </div>

            {/* Issued Employee UID Card */}
            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-slate-200/80 inline-block w-full max-w-sm mx-auto text-center">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">
                Issued Institutional Employee UID
              </span>
              <span className="font-mono text-base font-bold text-teal-950 mt-0.5 block tracking-wide">
                {acceptedSuccessData.employee_uid}
              </span>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onNavigate('/login')}
                className="w-full sm:w-auto px-8 py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer mx-auto"
              >
                <span>Proceed to Aarogya Sign-In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-slate-200/80 bg-white/60 py-4 px-6 text-center text-xs text-slate-400 font-mono">
        Aarogya Healthcare Information Management System &bull; Enterprise RBAC Engine
      </footer>
    </div>
  );
};

