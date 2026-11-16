import React, { useState } from 'react';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, KeyRound, Shield } from 'lucide-react';
import { Navbar } from '../components/marketing/Navbar';
import { FlowingBackgroundLines } from '../components/marketing/FlowingBackgroundLines';
import { authService } from '../services/authService';

interface ForgotPasswordPageProps {
  onNavigate: (path: string) => void;
  role?: 'admin' | 'employee';
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onNavigate,
  role = 'employee',
}) => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loginPath = role === 'admin' ? '/admin/login' : '/login';
  const roleLabel = role === 'admin' ? 'Administrator' : 'Employee';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Please enter your registered username or official email address.');
      return;
    }

    setLoading(true);
    try {
      const res: any = await authService.requestPasswordReset(identifier);
      setSubmitted(true);
      setConfirmationMessage(res.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch password recovery.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between selection:bg-emerald-500 selection:text-white font-sans">
      {/* Top Navbar */}
      <Navbar currentPath="/forgot-password" onNavigate={onNavigate} />

      {/* Main Container */}
      <main className="relative flex-1 flex items-center justify-center pt-28 pb-20 px-6 overflow-hidden">
        {/* Flowing background lines */}
        <FlowingBackgroundLines theme="light" />

        <div className="relative z-10 w-full max-w-md animate-fadeIn">
          {/* Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-lg p-8 sm:p-10">
            {submitted ? (
              <div className="text-center space-y-5 animate-fadeIn">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-soft-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold font-sans text-slate-950">
                    Recovery Instructions Dispatched
                  </h2>
                  <p className="text-xs text-slate-600 font-normal mt-2.5 leading-relaxed">
                    {confirmationMessage}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 text-[11px] text-teal-950 text-left font-mono space-y-1.5">
                  <div className="font-semibold text-teal-900 mb-1 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-teal-700" />
                    <span>SECURITY &amp; ACCESS NOTICE</span>
                  </div>
                  <div>• TOKEN LIFESPAN: 60 MINUTES</div>
                  <div>• CIPHER: TIME-LIMITED CRYPTOGRAPHIC HMAC-SHA256</div>
                  <div>• AUDIT EVENT: DISPATCH_LOGGED</div>
                  <div className="pt-1.5 text-[11.5px] text-teal-800 font-sans leading-relaxed border-t border-teal-200/60 mt-1">
                    Please open your official email inbox and click the password reset link to proceed. For security, password reset links can only be accessed from the email dispatch.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate(loginPath)}
                  className="w-full py-3 rounded-full text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 transition-colors shadow-soft-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to {roleLabel} Sign-In</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="text-center mb-6">
                  <span className="text-[10px] font-mono font-medium text-teal-800 uppercase tracking-widest px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200/70 inline-block mb-3">
                    {role === 'admin' ? 'Administrator Recovery' : 'Credential Recovery'}
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold font-sans text-slate-950 tracking-tight">
                    Reset Password
                  </h1>
                  <p className="text-xs text-slate-500 font-normal mt-1.5 max-w-xs mx-auto">
                    {role === 'admin'
                      ? 'Enter your administrator username or registered work email to receive password reset instructions.'
                      : 'Enter your globally unique username or registered official hospital email to receive reset instructions.'}
                  </p>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Username or Hospital Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. employee username or official email"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:border-teal-700 font-sans"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-pill hover:shadow-native-glow transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <span>Dispatching Reset Token...</span>
                    ) : (
                      <>
                        <span>Send Recovery Instructions</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Return link */}
                <div className="text-center pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onNavigate(loginPath)}
                    className="text-slate-500 hover:text-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to {roleLabel} Sign In</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200/80 text-center text-xs text-slate-400">
        © 2026 AURA Health Technologies • Hospital Information Management System
      </footer>
    </div>
  );
};

