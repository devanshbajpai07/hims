import React, { useState } from 'react';
import { X, UserCog, AlertCircle, Check } from 'lucide-react';
import { clinicalApiClient } from '../services/clinicalApiClient';

interface ChangeUsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername?: string;
  token?: string;
  onSuccessToast: (msg: string, newUsername?: string) => void;
}

export const ChangeUsernameModal: React.FC<ChangeUsernameModalProps> = ({
  isOpen,
  onClose,
  currentUsername = '',
  token,
  onSuccessToast,
}) => {
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = newUsername.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters long.');
      return;
    }
    if (cleanUsername === currentUsername.toLowerCase()) {
      setErrorMsg('New username must be different from your current username.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await clinicalApiClient.changeUsername(cleanUsername, token);
      onSuccessToast(res.message || `Username successfully updated to ${cleanUsername}.`, cleanUsername);
      setNewUsername('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change username.');
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
              <UserCog className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Change Account Username
              </h2>
              <p className="text-xs text-slate-500">
                Authorized Employee Account Identifier
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Current Username
            </label>
            <input
              type="text"
              readOnly
              value={currentUsername || 'Current User'}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-500 select-none cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              New Username *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. sarah.nurse or nurse_jane"
              value={newUsername}
              onChange={(e) => {
                setNewUsername(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Must be 3–64 characters. Allowed characters: letters, numbers, dots, underscores.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !newUsername.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-soft-sm"
            >
              {loading ? (
                <span>Updating...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Update Username</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

