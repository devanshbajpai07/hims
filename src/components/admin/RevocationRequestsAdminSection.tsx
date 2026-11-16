import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Building2,
  FileText,
  Check,
  X,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { clinicalApiClient, RevocationRequest } from '../../services/clinicalApiClient';

interface RevocationRequestsAdminSectionProps {
  token?: string;
  onRequestDecided?: () => void;
}

export const RevocationRequestsAdminSection: React.FC<RevocationRequestsAdminSectionProps> = ({
  token,
  onRequestDecided,
}) => {
  const [requests, setRequests] = useState<RevocationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Decision Modal State
  const [selectedRequest, setSelectedRequest] = useState<RevocationRequest | null>(null);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Pass undefined if ALL to get full dataset
      const data = await clinicalApiClient.adminGetRevocationRequests(undefined, token);
      setRequests(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch access revocation requests.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleOpenDecisionModal = (req: RevocationRequest, action: 'APPROVE' | 'REJECT') => {
    setSelectedRequest(req);
    setDecisionAction(action);
    setDecisionNotes('');
  };

  const handleCloseDecisionModal = () => {
    setSelectedRequest(null);
    setDecisionAction(null);
    setDecisionNotes('');
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !decisionAction) return;

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await clinicalApiClient.adminDecideRevocationRequest(
        selectedRequest.id,
        decisionAction,
        decisionNotes.trim() || undefined,
        token
      );

      const actionText = decisionAction === 'APPROVE' ? 'approved' : 'rejected';
      setSuccessMsg(
        `Revocation request for ${selectedRequest.targetName} (${selectedRequest.targetEmployeeUid}) has been ${actionText}.`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
      handleCloseDecisionModal();
      await loadRequests();
      if (onRequestDecided) onRequestDecided();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit revocation decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  const filteredRequests = requests.filter((req) => {
    if (filterStatus !== 'ALL' && req.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = req.targetName.toLowerCase().includes(q);
      const matchUid = req.targetEmployeeUid.toLowerCase().includes(q);
      const matchRequester = req.requesterName.toLowerCase().includes(q);
      const matchDept = (req.departmentName || '').toLowerCase().includes(q);
      const matchReason = req.reason.toLowerCase().includes(q);
      if (!matchName && !matchUid && !matchRequester && !matchDept && !matchReason) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-rose-700" />
            <h3 className="text-xl font-bold font-sans text-slate-950">
              Department Head Access Revocation Escalations
            </h3>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-rose-600 text-white">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-normal">
            Review and adjudicate formal staff access revocation requests submitted by Department Heads and Nursing Supervisors.
          </p>
        </div>

        <button
          onClick={loadRequests}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterStatus('PENDING')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'PENDING'
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-amber-800">
              Pending Adjudication
            </span>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <div className="text-3xl font-mono font-bold text-amber-900 mt-2">{pendingCount}</div>
          <p className="text-[11px] text-amber-700 mt-1">Awaiting executive administrator decision</p>
        </div>

        <div
          onClick={() => setFilterStatus('APPROVED')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'APPROVED'
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/30'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-emerald-800">
              Revocations Enforced
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-3xl font-mono font-bold text-emerald-900 mt-2">{approvedCount}</div>
          <p className="text-[11px] text-emerald-700 mt-1">Access revoked / permissions retired</p>
        </div>

        <div
          onClick={() => setFilterStatus('REJECTED')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'REJECTED'
              ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400/30'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-rose-800">
              Requests Dismissed
            </span>
            <XCircle className="w-4 h-4 text-rose-700" />
          </div>
          <div className="text-3xl font-mono font-bold text-rose-900 mt-2">{rejectedCount}</div>
          <p className="text-[11px] text-rose-700 mt-1">Retained employee departmental access</p>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5 shadow-xs">
          <AlertTriangle className="w-4.5 h-4.5 text-rose-700 shrink-0 mt-0.5" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-700 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-soft-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by staff name, UID, requester..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-800"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
          {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                filterStatus === tab
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {tab === 'PENDING' ? `Pending (${pendingCount})` : tab === 'ALL' ? `All (${requests.length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Listing */}
      {loading ? (
        <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm">
          <div className="w-8 h-8 border-2 border-teal-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-mono">Loading revocation escalations...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-soft-sm space-y-3">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold font-sans text-slate-900">
            {filterStatus === 'PENDING'
              ? 'No Pending Revocation Escalations'
              : 'No Revocation Requests Found'}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {filterStatus === 'PENDING'
              ? 'All access revocation requests from Department Heads and Nursing Supervisors have been processed.'
              : 'No revocation requests matched your search or status filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const isPending = req.status === 'PENDING';
            const isApproved = req.status === 'APPROVED';
            const isRejected = req.status === 'REJECTED';

            return (
              <div
                key={req.id}
                className={`bg-white rounded-3xl border p-6 shadow-soft-sm transition-all space-y-4 ${
                  isPending ? 'border-amber-200/90 ring-1 ring-amber-300/20' : 'border-slate-200/90'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                        {req.targetEmployeeUid}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono tracking-wider font-bold px-2 py-0.5 rounded border ${
                          req.revocationScope === 'FULL_MEMBERSHIP'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-teal-50 text-teal-800 border-teal-200'
                        }`}
                      >
                        {req.revocationScope === 'FULL_MEMBERSHIP'
                          ? 'Full Membership Termination'
                          : 'Department Assignment Revocation'}
                      </span>
                    </div>

                    <h4 className="text-lg font-bold font-sans text-slate-950 flex items-center gap-2">
                      <span>{req.targetName}</span>
                      <span className="text-xs font-normal text-slate-500">
                        &bull; Department: <strong className="text-slate-800">{req.departmentName || 'Hospital-Wide'}</strong>
                      </span>
                    </h4>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${
                        isPending
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : isApproved
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : isRejected
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Submitted By:</span>
                      <span className="font-mono">{new Date(req.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <User className="w-4 h-4 text-teal-800" />
                      <span>{req.requesterName}</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      Leadership request for Department: <strong>{req.departmentName || 'Hospital'}</strong>
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                    <span className="text-slate-500 text-[11px] font-bold block uppercase tracking-wider">
                      Stated Justification:
                    </span>
                    <p className="font-semibold text-slate-900 text-sm">{req.reason}</p>
                    {req.supportingDetails && (
                      <p className="text-slate-600 text-xs leading-relaxed italic border-t border-slate-200/70 pt-1.5">
                        &ldquo;{req.supportingDetails}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                {/* Adjudication Outcome (if decided) */}
                {!isPending && (
                  <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-900">
                        Decision by: {req.reviewerName || 'Administrator'}
                      </span>
                      {req.reviewedAt && (
                        <span className="text-slate-500 font-mono">
                          {new Date(req.reviewedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {req.decisionNotes && (
                      <p className="text-slate-600 text-xs italic">
                        Notes: {req.decisionNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Action Bar for Pending Requests */}
                {isPending && (
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-end gap-2.5">
                    <button
                      onClick={() => handleOpenDecisionModal(req, 'REJECT')}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reject Request</span>
                    </button>
                    <button
                      onClick={() => handleOpenDecisionModal(req, 'APPROVE')}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve &amp; Enforce Revocation</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Confirmation Modal */}
      {selectedRequest && decisionAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-6 py-5 bg-[#FAF7F2] border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold font-sans text-slate-950">
                  {decisionAction === 'APPROVE' ? 'Approve Access Revocation' : 'Reject Revocation Request'}
                </h3>
              </div>
              <button
                onClick={handleCloseDecisionModal}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDecision} className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Target Employee:</span>
                  <span className="font-bold text-slate-900">
                    {selectedRequest.targetName} ({selectedRequest.targetEmployeeUid})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedRequest.departmentName || 'Hospital-Wide'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Requester:</span>
                  <span className="font-semibold text-slate-800">{selectedRequest.requesterName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Scope:</span>
                  <span className="font-mono font-bold text-rose-800">
                    {selectedRequest.revocationScope}
                  </span>
                </div>
              </div>

              {decisionAction === 'APPROVE' ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed">
                  <strong>Warning:</strong> Approving this request will immediately revoke the employee's{' '}
                  {selectedRequest.revocationScope === 'FULL_MEMBERSHIP'
                    ? 'full hospital access and terminate their membership'
                    : `assignment in ${selectedRequest.departmentName || 'this department'}`}
                  . This action is audited and cannot be undone without a new invitation or assignment.
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                  Rejecting this request will keep the employee's current role assignment intact and notify the requesting Department Head.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Administrator Decision Notes (Optional)
                </label>
                <textarea
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="Provide rationale or conditions for this executive determination..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseDecisionModal}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-all cursor-pointer ${
                    decisionAction === 'APPROVE'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                >
                  {submitting ? 'Recording Decision...' : `Confirm ${decisionAction === 'APPROVE' ? 'Revocation' : 'Rejection'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

