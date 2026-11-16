import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Clock,
  ExternalLink,
  Sparkles,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { purchaserApiClient, PurchaserProfile } from '../../services/purchaserApiClient';
import { purchaserService } from '../../services/purchaserService';

interface EnterpriseAccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaser: PurchaserProfile;
  onProfileUpdated: (updated: PurchaserProfile) => void;
  onNavigate: (path: string) => void;
}

type TabType = 'name' | 'email' | 'password' | 'danger';

export const EnterpriseAccountSettingsModal: React.FC<EnterpriseAccountSettingsModalProps> = ({
  isOpen,
  onClose,
  purchaser,
  onProfileUpdated,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('name');

  // Change Name state
  const [newName, setNewName] = useState(purchaser.fullName);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Change Email state
  const [newEmail, setNewEmail] = useState('');
  const [emailOtpStep, setEmailOtpStep] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailDevOtp, setEmailDevOtp] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Change Password state
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  // Delete Account state
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletionReason, setDeletionReason] = useState('');
  const [showDeletionConfirm, setShowDeletionConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPendingDeletion = purchaser.accountStatus === 'pending_deletion';
  const scheduledDate = purchaser.deletionScheduledAt
    ? new Date(purchaser.deletionScheduledAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  // 1. Handle Update Name
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(null);

    if (newName.trim().length < 2) {
      setNameError('Full legal name must be at least 2 characters.');
      return;
    }

    setNameLoading(true);
    try {
      const updated = await purchaserApiClient.updateName(newName.trim());
      purchaserService.updatePurchaserName(purchaser.id, newName.trim());
      onProfileUpdated(updated);
      setNameSuccess('Your name has been updated successfully.');
    } catch (err: any) {
      setNameError(err.message || 'Failed to update name.');
    } finally {
      setNameLoading(false);
    }
  };

  // 2. Handle Request Email Change OTP
  const handleRequestEmailOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);
    setEmailDevOtp(null);

    if (!newEmail.trim()) {
      setEmailError('Please enter a valid new email address.');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await purchaserApiClient.requestEmailChangeOTP(newEmail.trim());
      setEmailOtpStep(true);
      if (res.dev_otp) {
        setEmailDevOtp(res.dev_otp);
      }
      setEmailSuccess(
        `Verification code dispatched to your previous email address (${purchaser.email}).`
      );
    } catch (err: any) {
      setEmailError(err.message || 'Failed to initiate email change.');
    } finally {
      setEmailLoading(false);
    }
  };

  // 3. Handle Confirm Email Change OTP
  const handleConfirmEmailOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    if (emailOtp.trim().length !== 6) {
      setEmailError('Please enter the 6-digit verification code.');
      return;
    }

    setEmailLoading(true);
    try {
      const updated = await purchaserApiClient.confirmEmailChangeOTP(
        newEmail.trim(),
        emailOtp.trim()
      );
      purchaserService.updatePurchaserEmail(purchaser.id, newEmail.trim());
      onProfileUpdated(updated);
      setEmailSuccess('Email address updated successfully.');
      setEmailOtpStep(false);
      setNewEmail('');
      setEmailOtp('');
    } catch (err: any) {
      setEmailError(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  // 4. Handle Send Password Reset Link
  const handleSendPasswordReset = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);
    setDevResetLink(null);
    setPasswordLoading(true);

    try {
      const res = await purchaserApiClient.forgotPassword(purchaser.email);
      setPasswordSuccess(
        `Password reset link dispatched to ${purchaser.email}. Click the link to set your new password.`
      );
      if (res.dev_reset_link) {
        setDevResetLink(res.dev_reset_link);
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to send password reset link.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // 5. Handle Schedule Account Deletion
  const handleScheduleDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleteSuccess(null);

    if (!confirmPassword) {
      setDeleteError('Password confirmation is required to authorize deletion.');
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await purchaserApiClient.scheduleAccountDeletion(
        confirmPassword,
        deletionReason || undefined
      );
      purchaserService.setPendingDeletion(purchaser.id, res.scheduled_deletion_at);
      onProfileUpdated({
        ...purchaser,
        accountStatus: 'pending_deletion',
        deletionScheduledAt: res.scheduled_deletion_at,
      });
      setDeleteSuccess(res.message);
      setShowDeletionConfirm(false);
      setConfirmPassword('');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to schedule account deletion.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 6. Handle Cancel Account Deletion
  const handleCancelDeletion = async () => {
    setDeleteError(null);
    setDeleteSuccess(null);
    setDeleteLoading(true);

    try {
      const res = await purchaserApiClient.cancelAccountDeletion();
      purchaserService.cancelPendingDeletion(purchaser.id);
      onProfileUpdated({
        ...purchaser,
        accountStatus: 'active',
        deletionScheduledAt: null,
      });
      setDeleteSuccess(res.message);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to cancel deletion request.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold shadow-xs">
              <User className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-serif font-normal text-slate-950">
                <span className="text-[#1A6865] font-serif font-medium">Enterprise</span> Settings
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Manage your credentials, organization email, and account lifecycle.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pending Deletion Warning Banner if Active */}
        {isPendingDeletion && scheduledDate && (
          <div className="bg-amber-50 border-b border-amber-200/90 px-6 sm:px-8 py-3.5 flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4.5 h-4.5 text-amber-600 shrink-0" />
              <span>
                <strong>Account Pending Deletion:</strong> Permanent decommissioning scheduled on{' '}
                <strong>{scheduledDate}</strong>.
              </span>
            </div>
            <button
              onClick={handleCancelDeletion}
              disabled={deleteLoading}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shrink-0 cursor-pointer shadow-xs"
            >
              Cancel Deletion
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-6 sm:px-8 pt-4 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs sm:text-sm font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('name')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'name'
                ? 'border-teal-700 text-teal-900 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Change Name</span>
          </button>

          <button
            onClick={() => setActiveTab('email')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'email'
                ? 'border-teal-700 text-teal-900 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Change Email</span>
          </button>

          <button
            onClick={() => setActiveTab('password')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'password'
                ? 'border-teal-700 text-teal-900 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Change Password</span>
          </button>

          <button
            onClick={() => setActiveTab('danger')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'danger'
                ? 'border-rose-600 text-rose-700 font-bold'
                : 'border-transparent text-rose-600/80 hover:text-rose-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        </div>

        {/* Tab Content Canvas */}
        <div className="p-6 sm:p-8">
          {/* TAB 1: CHANGE NAME */}
          {activeTab === 'name' && (
            <form onSubmit={handleUpdateName} className="space-y-5">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-2">
                  Legal Full Name / Organization Contact
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Legal Full Name"
                    className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white text-slate-900 transition-all"
                  />
                  <User className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  This name represents your institutional purchaser identity across all licensed hospital facilities.
                </p>
              </div>

              {nameError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{nameError}</span>
                </div>
              )}

              {nameSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{nameSuccess}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={nameLoading || newName.trim() === purchaser.fullName}
                  className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <span>{nameLoading ? 'Saving...' : 'Save Name Changes'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CHANGE EMAIL (VIA OTP TO PREVIOUS EMAIL) */}
          {activeTab === 'email' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/90 text-xs sm:text-[13px] text-teal-900 leading-relaxed">
                <strong className="block font-semibold mb-1">Institutional Security Verification</strong>
                To protect hospital subscriptions, changing your email requires confirming a single-use 6-digit OTP sent to your <strong>current (previous) email</strong> ({purchaser.email}).
              </div>

              {!emailOtpStep ? (
                <form onSubmit={handleRequestEmailOTP} className="space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-2">
                      New Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="new.email@hospitalgroup.org"
                        className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white text-slate-900 transition-all"
                      />
                      <Mail className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {emailError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{emailError}</span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={emailLoading || !newEmail.trim()}
                      className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <span>{emailLoading ? 'Sending OTP...' : 'Send OTP to Current Email'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleConfirmEmailOTP} className="space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-2">
                      Enter 6-Digit OTP sent to {purchaser.email}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={emailOtp}
                        onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        className="w-full pl-11 pr-4 py-3 text-lg font-mono tracking-widest rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white text-slate-900 transition-all"
                      />
                      <KeyRound className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {emailDevOtp && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-500">Test OTP:</span>
                        <button
                          type="button"
                          onClick={() => setEmailOtp(emailDevOtp)}
                          className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-mono text-xs font-bold hover:bg-emerald-200 transition-colors cursor-pointer"
                          title="Click to auto-fill development OTP"
                        >
                          {emailDevOtp} (Auto-Fill)
                        </button>
                      </div>
                    )}
                  </div>

                  {emailError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{emailError}</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setEmailOtpStep(false)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                    >
                      Change destination email
                    </button>

                    <button
                      type="submit"
                      disabled={emailLoading || emailOtp.length !== 6}
                      className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <span>{emailLoading ? 'Verifying...' : 'Confirm & Update Email'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {emailSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{emailSuccess}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CHANGE PASSWORD (VIA PASSWORD RESET LINK ON EMAIL) */}
          {activeTab === 'password' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-[13px] text-slate-700 leading-relaxed space-y-2">
                <p>
                  To change your password securely, an authenticated reset link will be sent to your registered email address:{' '}
                  <strong className="text-slate-950 font-semibold">{purchaser.email}</strong>.
                </p>
                <p className="text-slate-500 text-xs">
                  Once you submit your new password on the reset page, you will be automatically logged out of all active sessions and will need to sign in again with your new credentials.
                </p>
              </div>

              {passwordError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>

                  {devResetLink && (
                    <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="font-semibold block">Development Test Reset Link:</span>
                        <span className="font-mono text-[11px] text-teal-800 break-all">{devResetLink}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          const url = new URL(devResetLink, window.location.origin);
                          onNavigate(`${url.pathname}${url.search}`);
                        }}
                        className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Open Reset Page</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSendPasswordReset}
                  disabled={passwordLoading}
                  className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{passwordLoading ? 'Sending Reset Link...' : 'Send Password Reset Link to Email'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: DELETE ACCOUNT (60-DAY RECOVERY WINDOW & ADMIN NOTIFICATION) */}
          {activeTab === 'danger' && (
            <div className="space-y-5">
              {!isPendingDeletion ? (
                <>
                  <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs sm:text-[13px] text-rose-950 space-y-3 leading-relaxed">
                    <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>Enterprise Decommissioning Protocol</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1.5 text-rose-900/90 text-xs">
                      <li>
                        <strong>60-Day Recovery Window:</strong> Account enters a scheduled deletion state. All data, hospital UIDs, and access will be permanently removed in 60 days.
                      </li>
                      <li>
                        <strong>Administrator Notification:</strong> All active and pending hospital administrators across your facilities will receive automated warnings.
                      </li>
                      <li>
                        <strong>Subscription Business Rules:</strong> Subscription renewals are suspended immediately during the grace period.
                      </li>
                      <li>
                        <strong>Account Restoration:</strong> You may cancel this deletion request anytime within 60 days simply by logging in.
                      </li>
                    </ul>
                  </div>

                  {!showDeletionConfirm ? (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowDeletionConfirm(true)}
                        className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 transition-colors cursor-pointer"
                      >
                        Initiate Account Deletion Request
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleScheduleDeletion} className="space-y-4 pt-2">
                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-rose-950 mb-1.5">
                          Enter Password to Authorize Deletion Request <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Your current password"
                          className="w-full px-4 py-2.5 text-sm rounded-xl border border-rose-300 focus:outline-hidden focus:border-rose-600 focus:ring-1 focus:ring-rose-600 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Optional Reason for Decommissioning
                        </label>
                        <textarea
                          rows={2}
                          value={deletionReason}
                          onChange={(e) => setDeletionReason(e.target.value)}
                          placeholder="e.g. Organization restructuring or transitioning healthcare vendor"
                          className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-slate-500 bg-white"
                        />
                      </div>

                      {deleteError && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{deleteError}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeletionConfirm(false);
                            setConfirmPassword('');
                          }}
                          className="px-5 py-2.5 rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={deleteLoading || !confirmPassword}
                          className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white bg-rose-700 hover:bg-rose-800 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {deleteLoading ? 'Scheduling...' : 'Confirm 60-Day Deletion'}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                /* Already in Pending Deletion state */
                <div className="space-y-5">
                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-xs sm:text-[13px] text-amber-950 space-y-3 leading-relaxed">
                    <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                      <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                      <span>Account Scheduled for Deletion</span>
                    </div>
                    <p>
                      Your enterprise organization account is currently in the <strong>60-day recovery window</strong>.
                      Permanent decommissioning date: <strong>{scheduledDate}</strong>.
                    </p>
                    <p className="text-amber-800 text-xs">
                      All hospital administrators have received formal warning notices. If you wish to retain your facilities and continue subscriptions, cancel the deletion request below.
                    </p>
                  </div>

                  {deleteSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{deleteSuccess}</span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCancelDeletion}
                      disabled={deleteLoading}
                      className="px-7 py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-md cursor-pointer flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{deleteLoading ? 'Restoring Account...' : 'Cancel Deletion & Restore Full Access'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

