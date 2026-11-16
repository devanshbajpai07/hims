import React, { useState } from 'react';
import { X, KeyRound, Mail, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { authService } from '../services/authService';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  registeredEmail?: string;
  token?: string;
  onSuccessToast: (msg: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  registeredEmail,
  token,
  onSuccessToast,
}) => {
  const [reenteredEmail, setReenteredEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setReenteredEmail('');
    setErrorMsg(null);
    setSentSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = reenteredEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    // If registeredEmail is provided, strictly enforce matching
    if (registeredEmail && cleanEmail !== registeredEmail.trim().toLowerCase()) {
      setErrorMsg('The email entered does not match your registered hospital employee email address.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await authService.requestPasswordReset(cleanEmail);
      setSentSuccess(true);
      onSuccessToast(`Password reset link dispatched to ${cleanEmail}. Check your inbox.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch password reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn select-none">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Change Password via Reset Link
              </h2>
              <p className="text-xs text-slate-500">
                Verified Security Link Protocol
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sentSuccess ? (
          /* Confirmation Success State */
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Reset Password Link Dispatched
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                We have generated a secure, single-use password reset link and dispatched it to:
              </p>
              <div className="font-mono text-xs font-bold text-teal-900 bg-teal-50 border border-teal-200/80 rounded-lg py-1.5 px-3 mt-2 inline-block">
                {reenteredEmail}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 text-left space-y-1">
              <div>• The link will remain active for 60 minutes.</div>
              <div>• Click the link in your email to open the password reset page and set your new password.</div>
              <div>• No direct password modifications are allowed within the workspace.</div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-teal-800 hover:bg-teal-900 text-white transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Input Form: Re-enter Email */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Security Notice</span>
              </div>
              <p className="text-[11.5px] text-amber-800 leading-relaxed">
                Direct in-session password changes are prohibited. To protect clinical access, you must re-enter your registered email address to receive an encrypted password reset link.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Re-enter Official Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="name@hospital.org"
                  value={reenteredEmail}
                  onChange={(e) => {
                    setReenteredEmail(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                A single-use reset password link will be delivered to this address.
              </p>
            </div>

            {/* Footer actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !reenteredEmail.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-800 hover:bg-teal-900 text-white flex items-center gap-1.5 shadow-soft-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span>Sending Link...</span>
                ) : (
                  <>
                    <span>Send Reset Password Link</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
