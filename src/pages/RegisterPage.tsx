import React, { useState, useEffect } from 'react';
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Plus,
  Trash2,
  Send,
  MessageSquare,
  Activity,
  User as UserIcon,
  Check,
} from 'lucide-react';
import { authService } from '../services/authService';
import {
  DepartmentOption,
  RoleOption,
  DepartmentRoleSlot,
  StartRegistrationResponse,
  VerifyOTPResponse,
} from '../types/auth';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  // Wizard Stage: 1 = Stage 1 (Hospital & Email OTP), 2 = Stage 2 (Details & Assignments), 3 = Submitted (Pending)
  const [stage, setStage] = useState<1 | 2 | 3>(1);

  // -------------------------------------------------------------------------
  // STAGE 1: Hospital Identification & Email OTP (ONLY 3 fields initially!)
  // -------------------------------------------------------------------------
  const [hospitalUid, setHospitalUid] = useState('');
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [challengeData, setChallengeData] = useState<StartRegistrationResponse | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verifiedContext, setVerifiedContext] = useState<VerifyOTPResponse | null>(null);

  // -------------------------------------------------------------------------
  // STAGE 2: Account Details & Access Request (Unlocked ONLY after OTP)
  // -------------------------------------------------------------------------
  const [fullName, setFullName] = useState('');
  const [employeeUidClaim, setEmployeeUidClaim] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
    suggestions?: string[];
  }>({ checking: false });

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Dynamic Department & Role options from backend
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Up to 5 Assignment Slots
  const [assignments, setAssignments] = useState<DepartmentRoleSlot[]>([
    { departmentId: '', roleId: '' },
  ]);

  // Contact Admin modal (Visible ONLY after all 5 slots are occupied!)
  const [showContactAdminModal, setShowContactAdminModal] = useState(false);
  const [additionalResponsibilities, setAdditionalResponsibilities] = useState('');
  const [additionalJustification, setAdditionalJustification] = useState('');
  const [submittingGrievance, setSubmittingGrievance] = useState(false);
  const [grievanceSuccessMessage, setGrievanceSuccessMessage] = useState<string | null>(null);

  // Submission & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedInfo, setSubmittedInfo] = useState<{
    registrationId: string;
    username: string;
    fullName: string;
  } | null>(null);

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Load departments and roles when Stage 2 is unlocked
  useEffect(() => {
    if (stage === 2 && verifiedContext) {
      setLoadingOptions(true);
      Promise.all([
        authService.getAvailableDepartments(verifiedContext.hospitalUid),
        authService.getAvailableRoles(verifiedContext.hospitalUid),
      ])
        .then(([depts, rls]) => {
          setDepartments(depts);
          setRoles(rls);
          if (depts.length > 0 && rls.length > 0) {
            setAssignments([{ departmentId: depts[0].id, roleId: rls[0].id }]);
          }
        })
        .finally(() => setLoadingOptions(false));
    }
  }, [stage, verifiedContext]);

  // -------------------------------------------------------------------------
  // STAGE 1 HANDLERS
  // -------------------------------------------------------------------------
  const handleSendOTP = async () => {
    setErrorMessage(null);
    if (!hospitalUid.trim()) {
      setErrorMessage('Hospital UID is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('A valid employee email address is required.');
      return;
    }

    setSendingOtp(true);
    try {
      const res = await authService.startRegistration(hospitalUid, email);
      setChallengeData(res);
      setOtpSent(true);
      setResendCooldown(res.resendAvailableInSeconds || 60);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification code.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOTP = async () => {
    setErrorMessage(null);
    if (!otpCode.trim() || otpCode.length !== 6) {
      setErrorMessage('Please enter the 6-digit code received via email.');
      return;
    }

    setVerifyingOtp(true);
    try {
      const cid = challengeData?.challengeId || 'chall-dev-session';
      const res = await authService.verifyOTP(cid, otpCode);
      setVerifiedContext(res);
      setStage(2); // Unlock Stage 2!
    } catch (err: any) {
      const msg =
        typeof err?.message === 'string' && err.message !== '[object Object]'
          ? err.message
          : 'Verification failed. Please check the code and try again.';
      setErrorMessage(msg);
    } finally {
      setVerifyingOtp(false);
    }
  };

  // -------------------------------------------------------------------------
  // STAGE 2 HANDLERS
  // -------------------------------------------------------------------------
  const handleCheckUsername = async (val: string) => {
    setUsername(val);
    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 3) {
      setUsernameStatus({ checking: false });
      return;
    }

    setUsernameStatus({ checking: true });
    try {
      const res = await authService.checkUsernameAvailability(trimmed);
      if (res.available) {
        setUsernameStatus({
          checking: false,
          available: true,
          message: 'Username is available globally.',
        });
      } else {
        setUsernameStatus({
          checking: false,
          available: false,
          message: res.error || 'Username is already taken across Aarogya.',
          suggestions: res.suggestions,
        });
      }
    } catch {
      setUsernameStatus({ checking: false });
    }
  };

  // Assignment slots management (Max 5 slots!)
  const handleAddSlot = () => {
    if (assignments.length >= 5) return;
    const defaultDept = departments.length > 0 ? departments[0].id : '';
    const defaultRole = roles.length > 0 ? roles[0].id : '';
    setAssignments([...assignments, { departmentId: defaultDept, roleId: defaultRole }]);
  };

  const handleRemoveSlot = (index: number) => {
    if (assignments.length <= 1) return;
    const updated = assignments.filter((_, i) => i !== index);
    setAssignments(updated);
  };

  const handleSlotChange = (index: number, field: 'departmentId' | 'roleId', val: string) => {
    const updated = [...assignments];
    updated[index] = { ...updated[index], [field]: val };
    setAssignments(updated);
  };

  // Submit Contact Admin grievance request
  const handleSubmitContactAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedContext) return;
    setSubmittingGrievance(true);
    try {
      const res = await authService.submitAdditionalAssignmentRequest({
        hospitalUid: verifiedContext.hospitalUid,
        email: verifiedContext.email,
        employeeUid: employeeUidClaim || 'UNVERIFIED',
        requestedResponsibilities: additionalResponsibilities,
        justification: additionalJustification,
      });
      setGrievanceSuccessMessage(res.message);
      setTimeout(() => {
        setShowContactAdminModal(false);
        setGrievanceSuccessMessage(null);
        setAdditionalResponsibilities('');
        setAdditionalJustification('');
      }, 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to submit additional request.');
    } finally {
      setSubmittingGrievance(false);
    }
  };

  // Submit Stage 2 Registration
  const handleSubmitStage2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!verifiedContext) {
      setErrorMessage('Session expired. Please restart email verification.');
      setStage(1);
      return;
    }
    if (!fullName.trim()) {
      setErrorMessage('Full Legal Name is required.');
      return;
    }
    if (!employeeUidClaim.trim()) {
      setErrorMessage('Official Employee UID claim is required.');
      return;
    }
    if (!username.trim()) {
      setErrorMessage('Please choose a username.');
      return;
    }
    if (usernameStatus.available === false) {
      setErrorMessage('Please select an available username before submitting.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (assignments.length > 5) {
      setErrorMessage('Maximum of five department-role assignments allowed.');
      return;
    }

    // Check for duplicate assignments
    const combos = new Set();
    for (const a of assignments) {
      const key = `${a.departmentId}-${a.roleId}`;
      if (combos.has(key)) {
        setErrorMessage(
          'Duplicate department-role assignments detected. Please select distinct combinations.'
        );
        return;
      }
      combos.add(key);
    }

    setSubmitting(true);
    try {
      const res = await authService.submitStage2Registration({
        verificationToken: verifiedContext.verificationToken,
        fullName,
        employeeUid: employeeUidClaim,
        username,
        password,
        confirmPassword,
        requestedAssignments: assignments,
      });

      setSubmittedInfo({
        registrationId: res.registrationId,
        username: res.username,
        fullName: res.fullName,
      });
      setStage(3); // Enter Stage 3: Awaiting Administrative Approval
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration submission failed.');
    } finally {
      setSubmitting(false);
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
              EMPLOYEE REGISTRATION PORTAL
            </span>
            <div className="h-[1.5px] w-8 sm:w-16 bg-slate-300" />
          </div>

          {/* Heading in editorial serif style */}
          <h1 className="text-2xl sm:text-4xl lg:text-[3.75rem] font-serif font-normal text-slate-950 tracking-[-0.02em] leading-[1.15]">
            <span className="text-[#1A6865] font-serif font-medium">Employee</span> Registration
          </h1>

          {/* Supporting description */}
          <p className="mt-3 sm:mt-5 text-sm sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed w-full max-w-xl md:max-w-3xl mx-auto px-2 sm:px-0">
            Request institutional access to your hospital workspace, complete identity verification, and establish your clinical role assignments.
          </p>
        </div>

        {/* Unified Integrated Container: Form + Docked Capabilities */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-lg overflow-hidden transition-all max-w-5xl mx-auto w-full">
          {/* Interactive 3-Step Process Indicator */}
          <div className="bg-slate-50/70 border-b border-slate-200/80 px-7 sm:px-12 py-6">
            <div className="max-w-2xl mx-auto relative">
              {/* Track line behind steps */}
              <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
              <div
                className="absolute top-5 left-8 h-0.5 bg-teal-800 -translate-y-1/2 z-0 transition-all duration-500 ease-in-out"
                style={{
                  width: stage === 1 ? '0%' : stage === 2 ? '50%' : 'calc(100% - 4rem)',
                }}
              />

              <div className="flex items-center justify-between relative z-10">
                {/* Step 1 */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                      stage > 1
                        ? 'bg-teal-800 text-white'
                        : stage === 1
                        ? 'bg-teal-800 text-white ring-4 ring-teal-100'
                        : 'bg-white border-2 border-slate-300 text-slate-400'
                    }`}
                  >
                    {stage > 1 ? <Check className="w-4 h-4 stroke-[2.5]" /> : '01'}
                  </div>
                  <span
                    className={`text-xs font-semibold mt-2.5 tracking-tight ${
                      stage >= 1 ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    Hospital &amp; OTP
                  </span>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                      stage > 2
                        ? 'bg-teal-800 text-white'
                        : stage === 2
                        ? 'bg-teal-800 text-white ring-4 ring-teal-100'
                        : 'bg-white border-2 border-slate-300 text-slate-400'
                    }`}
                  >
                    {stage > 2 ? <Check className="w-4 h-4 stroke-[2.5]" /> : '02'}
                  </div>
                  <span
                    className={`text-xs font-semibold mt-2.5 tracking-tight ${
                      stage >= 2 ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    Details &amp; Roles
                  </span>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                      stage === 3
                        ? 'bg-teal-800 text-white ring-4 ring-teal-100'
                        : 'bg-white border-2 border-slate-300 text-slate-400'
                    }`}
                  >
                    03
                  </div>
                  <span
                    className={`text-xs font-semibold mt-2.5 tracking-tight ${
                      stage === 3 ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    Approval Queue
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* STAGE 1: HOSPITAL IDENTIFICATION & EMAIL OTP                      */}
          {/* ================================================================= */}
          {stage === 1 && (
            <div className="px-7 sm:px-10 pt-10 sm:pt-14 pb-8 sm:pb-10 max-w-xl mx-auto w-full">
              {/* Stage Context Header */}
              <div className="text-center mb-8">
                <span className="text-[11px] font-mono font-semibold text-teal-800 uppercase tracking-widest px-3 py-1 rounded-full bg-teal-50 border border-teal-200/70 inline-block mb-3">
                  Step 1 • Institutional Authentication
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif font-normal text-slate-950 tracking-tight">
                  Verify Hospital Affiliation
                </h2>
                <p className="text-sm text-slate-500 font-normal mt-2 leading-relaxed">
                  Enter your assigned Hospital UID and official work email address to initiate cryptographic security verification.
                </p>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 text-rose-600 mt-0.5" />
                  <span className="leading-relaxed">
                    {typeof errorMessage === 'string' && errorMessage !== '[object Object]'
                      ? errorMessage
                      : 'Verification failed. Please check your credentials and try again.'}
                  </span>
                </div>
              )}

              {!otpSent ? (
                <div className="space-y-6 sm:space-y-7">
                  {/* Field 1: Hospital UID */}
                  <div>
                    <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                      Hospital UID <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={hospitalUid}
                        onChange={(e) => setHospitalUid(e.target.value.toUpperCase())}
                        placeholder="e.g. STJUDE-METRO-01"
                        className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900 font-mono uppercase tracking-wide"
                      />
                      <Building2 className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <p className="text-xs text-slate-400 mt-2 font-normal">
                      Provided by your hospital IT or HR department (e.g., <code className="text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded">STJUDE-METRO-01</code>).
                    </p>
                  </div>

                  {/* Field 2: Work Email Address */}
                  <div>
                    <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                      Official Work Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. yourname@stjude.org"
                        className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                      />
                      <Mail className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <p className="text-xs text-slate-400 mt-2 font-normal">
                      A cryptographically secure 6-digit OTP will be dispatched to this institutional inbox.
                    </p>
                  </div>

                  {/* Submit Verify Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={sendingOtp || !hospitalUid.trim() || !email.trim()}
                      className="no-hover-lift w-full py-4 px-8 rounded-full text-base sm:text-[17px] font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer disabled:opacity-50 font-sans tracking-wide"
                    >
                      {sendingOtp ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Validating Institution &amp; Dispatching Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify Email</span>
                          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* OTP Verification View */
                <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-200">
                  <div className="p-4.5 rounded-2xl bg-teal-50/70 border border-teal-200/90 text-teal-950 flex items-start justify-between">
                    <div>
                      <span className="font-bold text-sm block text-teal-950">{challengeData?.hospitalName}</span>
                      <span className="text-xs text-teal-800 mt-1 block">{challengeData?.message}</span>
                    </div>
                    <button
                      onClick={() => setOtpSent(false)}
                      className="text-teal-800 underline hover:text-teal-950 text-xs font-semibold cursor-pointer ml-3 shrink-0"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-3 text-center">
                      Enter 6-Digit Verification Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full max-w-xs mx-auto block px-4 py-3.5 text-center text-3xl tracking-[0.45em] font-mono bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 shadow-2xs text-slate-900"
                    />
                    <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Code valid for 10 minutes.</span>
                      {resendCooldown > 0 ? (
                        <span className="text-slate-400 font-medium">Resend in {resendCooldown}s</span>
                      ) : (
                        <button
                          onClick={handleSendOTP}
                          disabled={sendingOtp}
                          className="text-teal-800 hover:text-teal-950 hover:underline cursor-pointer font-semibold"
                        >
                          Resend code
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleVerifyOTP}
                      disabled={verifyingOtp || otpCode.length !== 6}
                      className="no-hover-lift w-full py-4 px-8 rounded-full text-base sm:text-[17px] font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer disabled:opacity-50 font-sans tracking-wide"
                    >
                      {verifyingOtp ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Verifying Security Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify Code &amp; Unlock Stage 2</span>
                          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Back to Login & Existing Account Prompt */}
              <div className="mt-8 pt-7 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <button
                  onClick={() => onNavigate('/login')}
                  className="hover:text-slate-800 flex items-center gap-1.5 cursor-pointer font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to login</span>
                </button>
                <span className="font-mono text-slate-400">Stage 1 of 3</span>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STAGE 2: ACCOUNT DETAILS & ACCESS REQUEST                         */}
          {/* ================================================================= */}
          {stage === 2 && verifiedContext && (
            <form onSubmit={handleSubmitStage2} className="px-7 sm:px-12 pt-10 sm:pt-14 pb-8 sm:pb-10 max-w-4xl mx-auto w-full">
              {/* Context Header */}
              <div className="p-4.5 rounded-2xl bg-teal-50/70 border border-teal-200/90 text-teal-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-semibold uppercase tracking-wider text-teal-800">
                      Verified Institution
                    </div>
                    <div className="text-base font-bold text-teal-950">
                      {verifiedContext.hospitalName}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-mono bg-white/80 px-3 py-1.5 rounded-lg border border-teal-200 text-teal-900 self-start sm:self-auto">
                  {verifiedContext.email}
                </div>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-600 mt-0.5" />
                  <span className="leading-relaxed">
                    {typeof errorMessage === 'string' && errorMessage !== '[object Object]'
                      ? errorMessage
                      : 'Verification failed. Please check your credentials and try again.'}
                  </span>
                </div>
              )}

              {/* Section A: Employee Information */}
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-xs font-mono font-bold text-teal-800 uppercase tracking-widest px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200">
                    Section A
                  </span>
                  <h3 className="text-lg font-serif font-medium text-slate-950">
                    Employee Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Full Legal Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Dr. Rajiv Sharma"
                        className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                      />
                      <UserIcon className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Official Employee UID <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={employeeUidClaim}
                        onChange={(e) => setEmployeeUidClaim(e.target.value.toUpperCase())}
                        placeholder="e.g. EMP-DOC-303"
                        className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900 font-mono uppercase"
                      />
                      <ShieldCheck className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Submitted as an unverified claim. Verified by Hospital Administrator during Level-2 review.
                    </p>
                  </div>
                </div>
              </div>

              {/* Section B: Account Credentials */}
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-xs font-mono font-bold text-teal-800 uppercase tracking-widest px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200">
                    Section B
                  </span>
                  <h3 className="text-lg font-serif font-medium text-slate-950">
                    Account Credentials
                  </h3>
                </div>

                <div className="space-y-6">
                  {/* Username */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Choose Username <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => handleCheckUsername(e.target.value)}
                        placeholder="e.g. rajiv.sharma"
                        className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                      />
                      <UserIcon className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {usernameStatus.checking && (
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
                        <span>Checking global uniqueness across Aarogya...</span>
                      </p>
                    )}

                    {usernameStatus.available === true && (
                      <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>{usernameStatus.message}</span>
                      </p>
                    )}

                    {usernameStatus.available === false && (
                      <div className="mt-2">
                        <p className="text-xs text-rose-700 flex items-center gap-1.5 font-medium">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          <span>{usernameStatus.message}</span>
                        </p>
                        {usernameStatus.suggestions && usernameStatus.suggestions.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                            <span>Suggestions:</span>
                            {usernameStatus.suggestions.map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => handleCheckUsername(sug)}
                                className="text-teal-800 hover:text-teal-950 hover:underline font-mono bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 cursor-pointer"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Passwords */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Create Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 8 characters"
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
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Confirm Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                        />
                        <Lock className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section C: Department & Role Requests (Max 5 Slots) */}
              <div className="mb-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-teal-800 uppercase tracking-widest px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200">
                      Section C
                    </span>
                    <div>
                      <h3 className="text-lg font-serif font-medium text-slate-950">
                        Department &amp; Role Assignments ({assignments.length} / 5 Slots)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Select up to 5 initial department-role responsibilities configured for {verifiedContext.hospitalName}.
                      </p>
                    </div>
                  </div>

                  {assignments.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddSlot}
                      className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100/80 border border-teal-200 px-4 py-2.5 rounded-full cursor-pointer transition-all shadow-2xs"
                    >
                      <Plus className="w-4 h-4 text-teal-700" />
                      <span>Add Assignment Slot</span>
                    </button>
                  )}
                </div>

                {loadingOptions ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Loading available departments and roles from hospital configuration...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignments.map((slot, index) => (
                      <div
                        key={index}
                        className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center gap-4 transition-all"
                      >
                        <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>

                        {/* Department Selector */}
                        <div className="flex-1 w-full sm:w-auto">
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Department
                          </label>
                          <select
                            value={slot.departmentId || ''}
                            onChange={(e) => handleSlotChange(index, 'departmentId', e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 text-slate-900"
                          >
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Role Selector */}
                        <div className="flex-1 w-full sm:w-auto">
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Requested Role
                          </label>
                          <select
                            value={slot.roleId}
                            onChange={(e) => handleSlotChange(index, 'roleId', e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 text-slate-900"
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.scope})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Delete Slot Button */}
                        {assignments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSlot(index)}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 cursor-pointer transition-colors sm:self-end sm:mb-1"
                            title="Remove Slot"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Contact Admin Prompt (Appears ONLY when all 5 slots are occupied!) */}
                {assignments.length >= 5 && (
                  <div className="mt-5 p-4.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <span className="font-bold text-amber-950 block mb-1">
                        Maximum Capacity Reached (5 of 5 slots utilised)
                      </span>
                      <p className="text-amber-800 text-xs leading-relaxed">
                        You have reached the maximum of five role assignments. If you require additional responsibilities, contact your Hospital Administrator.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowContactAdminModal(true)}
                      className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2.5 rounded-full text-xs cursor-pointer shadow-sm flex items-center gap-1.5 transition-all"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Contact Admin</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Submission Actions */}
              <div className="pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setStage(1)}
                  className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-2 cursor-pointer font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Stage 1</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="no-hover-lift w-full sm:w-auto py-4 px-9 rounded-full text-base font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer disabled:opacity-50 font-sans tracking-wide"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Registration Request...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit for Administrative Review</span>
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* STAGE 3: REGISTRATION SUBMITTED & PENDING APPROVAL                */}
          {/* ================================================================= */}
          {stage === 3 && submittedInfo && (
            <div className="px-7 sm:px-10 pt-12 sm:pt-16 pb-12 sm:pb-16 max-w-xl mx-auto w-full text-center">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-200/90 shadow-xs">
                <Clock className="w-8 h-8" />
              </div>

              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-200/80">
                Status: Pending Administrative Review
              </span>

              <h2 className="text-3xl sm:text-4xl font-serif text-slate-950 mt-4 mb-3">
                Registration Request Logged
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-8">
                Thank you, <strong className="text-slate-900">{submittedInfo.fullName}</strong>. Your account (<code className="font-mono text-teal-800 font-bold bg-slate-100 px-2 py-0.5 rounded">{submittedInfo.username}</code>) has been submitted into the verification queue. Operational dashboard access is blocked until both approval milestones are finalized.
              </p>

              {/* Two-Level Approval Governance Tracker */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-6 text-left mb-8 space-y-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Level 1: Department Head Clinical Review
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Department Heads evaluate and approve or reject each requested department-role assignment independently.
                    </p>
                  </div>
                </div>

                <div className="h-px bg-slate-200" />

                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Level 2: Hospital Administrator Verification
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Hospital Administrator verifies employee identity, checks Employee UID claim, and authorizes final account activation.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="no-hover-lift w-full py-4 px-8 rounded-full text-base font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer font-sans"
                >
                  <span>Return to Employee Login</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            </div>
          )}

          {/* Connected Lower Dock: Credentialing Leadership Testimonial Footnote */}
          <div className="bg-slate-50/80 border-t border-slate-200/80 px-7 sm:px-12 py-7 sm:py-8 text-center">
            <p className="italic text-xs sm:text-[13.5px] text-slate-600 leading-normal">
              &ldquo;Multi-department credentialing and automated verification cut our clinician onboarding from weeks to mere minutes.&rdquo;
              <strong className="text-slate-900 font-semibold not-italic ml-2">&mdash; Devante Brooks, Director of Medical Staff Credentialing</strong>
            </p>
          </div>
        </div>

        {/* ================================================================= */}
        {/* CONTACT ADMIN MODAL (Appears ONLY when all 5 slots occupied)      */}
        {/* ================================================================= */}
        {showContactAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-7 sm:p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-xl font-serif font-normal text-slate-950">
                    Contact Hospital Administrator
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Request additional responsibilities beyond the standard 5-slot initial registration limit.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContactAdminModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-2xl cursor-pointer leading-none"
                >
                  &times;
                </button>
              </div>

              {grievanceSuccessMessage ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                  <span>{grievanceSuccessMessage}</span>
                </div>
              ) : (
                <form onSubmit={handleSubmitContactAdmin} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Additional Responsibilities Required <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={additionalResponsibilities}
                      onChange={(e) => setAdditionalResponsibilities(e.target.value)}
                      placeholder="e.g. Need clinical supervision access in Neonatal Intensive Care Unit (NICU)..."
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Operational Justification <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={additionalJustification}
                      onChange={(e) => setAdditionalJustification(e.target.value)}
                      placeholder="e.g. Completed specialty fellowship; scheduled for rotational on-call coverage across both pediatric and NICU wards..."
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 text-slate-900"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowContactAdminModal(false)}
                      className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-full text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingGrievance}
                      className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 disabled:bg-slate-300 text-white rounded-full text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5 transition-all"
                    >
                      {submittingGrievance ? (
                        <span>Dispatching...</span>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Dispatch Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

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
