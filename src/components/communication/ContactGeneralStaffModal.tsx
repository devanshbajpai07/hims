import React, { useState, useEffect } from 'react';
import { X, Send, AlertCircle, CheckCircle2, User, Building2, HelpCircle } from 'lucide-react';
import { clinicalApiClient, CommunicationRecipient, EmployeeMessage } from '../../services/clinicalApiClient';

interface ContactGeneralStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  onMessageSent?: (msg: EmployeeMessage) => void;
  senderRole?: string;
}

export const ContactGeneralStaffModal: React.FC<ContactGeneralStaffModalProps> = ({
  isOpen,
  onClose,
  token,
  onMessageSent,
  senderRole = 'Employee',
}) => {
  const [recipients, setRecipients] = useState<CommunicationRecipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [messageBody, setMessageBody] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setSubject('');
      setMessageBody('');
      setLoading(true);

      clinicalApiClient
        .getCommunicationRecipients(token)
        .then((recs) => {
          setRecipients(recs);
          if (recs.length > 0) {
            setSelectedRecipientId(recs[0].membershipId);
          } else {
            setSelectedRecipientId('');
          }
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Failed to load eligible General Staff recipients.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipientId || !subject.trim() || !messageBody.trim()) {
      setErrorMessage('Please specify recipient, subject, and message details.');
      return;
    }

    setSending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const created = await clinicalApiClient.sendCommunicationMessage(
        {
          recipientMembershipId: selectedRecipientId,
          subject: subject.trim(),
          messageBody: messageBody.trim(),
        },
        token
      );

      setSuccessMessage('Request sent to General Staff member.');
      if (onMessageSent) {
        onMessageSent(created);
      }
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-teal-600" />
              <span>Internal Communication</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              Contact General Staff
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Recipient Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select General Staff Recipient <span className="text-rose-500">*</span>
            </label>
            {loading ? (
              <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg animate-pulse flex items-center text-xs text-slate-400">
                Loading facility general staff roster...
              </div>
            ) : recipients.length === 0 ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                No active General Staff employees found in this facility.
              </div>
            ) : (
              <select
                value={selectedRecipientId}
                onChange={(e) => setSelectedRecipientId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700 bg-white"
                required
              >
                {recipients.map((r) => (
                  <option key={r.membershipId} value={r.membershipId}>
                    {r.fullName} — {r.roleName} ({r.departmentName || 'Facility-wide'})
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Recipients are active support and logistics employees in your hospital facility. Self-messaging is prohibited.
            </p>
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Request Subject / Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Wheelchair escort needed at Reception desk"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
              required
              maxLength={255}
            />
          </div>

          {/* Message Body Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Task Details / Action Required <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Describe the actionable task, patient room/bay, urgency, or logistical requirements..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
              required
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || loading || recipients.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg flex items-center gap-1.5 transition-colors shadow-soft-sm cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? 'Sending...' : 'Send Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

