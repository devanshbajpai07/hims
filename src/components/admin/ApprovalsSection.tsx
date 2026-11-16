import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  Layers,
  Building2,
  ChevronRight,
  Info,
  ShieldAlert,
} from 'lucide-react';
import {
  hospitalAdminApi,
  PendingApprovalItem,
} from '../../services/hospitalAdminApiClient';
import { RevocationRequestsAdminSection } from './RevocationRequestsAdminSection';
import { clinicalApiClient } from '../../services/clinicalApiClient';

interface ApprovalsSectionProps {
  planCode: 'BASIC' | 'PRO' | 'ULTRA';
  onApprovalCompleted?: () => void;
  token?: string;
  initialSubTab?: 'registrations' | 'revocations';
}

export const ApprovalsSection: React.FC<ApprovalsSectionProps> = ({
  planCode,
  onApprovalCompleted,
  token,
  initialSubTab = 'registrations',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'registrations' | 'revocations'>(initialSubTab);
  const [pendingRevocationsCount, setPendingRevocationsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [requests, setRequests] = useState<PendingApprovalItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PendingApprovalItem | null>(null);

  // Form decision state for selected request
  const [verifyUid, setVerifyUid] = useState(true);
  const [slotDecisions, setSlotDecisions] = useState<{ [slotId: string]: 'approved' | 'rejected' }>({});
  const [decisionNotes, setDecisionNotes] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await hospitalAdminApi.listPendingApprovals();
      setRequests(data);
      if (data.length > 0 && !selectedRequest) {
        selectRequest(data[0]);
      } else if (data.length === 0) {
        setSelectedRequest(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load pending approvals.');
    } finally {
      setLoading(false);
    }
  }, [selectedRequest]);

  useEffect(() => {
    loadRequests();
    clinicalApiClient
      .adminGetRevocationRequests('PENDING', token)
      .then((data) => setPendingRevocationsCount(data.length))
      .catch(() => {});
  }, [loadRequests, token]);

  const selectRequest = (req: PendingApprovalItem) => {
    setSelectedRequest(req);
    // Initialize all slots to approved by default
    const initialDecisions: { [slotId: string]: 'approved' | 'rejected' } = {};
    req.assignment_requests.forEach((s) => {
      initialDecisions[s.id] = 'approved';
    });
    setSlotDecisions(initialDecisions);
    setVerifyUid(!req.employee_uid_verified);
    setDecisionNotes('');
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setActionLoading(true);
    setErrorMsg(null);

    const assignmentDecisions = Object.entries(slotDecisions).map(([slotId, dec]) => ({
      assignment_id: slotId,
      decision: dec,
    }));

    try {
      await hospitalAdminApi.decideRegistrationApproval(selectedRequest.id, {
        verify_employee_uid: verifyUid,
        assignment_decisions: assignmentDecisions,
        notes: decisionNotes.trim() || undefined,
      });

      setSuccessMsg(`Decision recorded successfully for ${selectedRequest.full_name}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setSelectedRequest(null);
      await loadRequests();
      if (onApprovalCompleted) onApprovalCompleted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record decision.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab Navigation Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
        <button
          onClick={() => setActiveSubTab('registrations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'registrations'
              ? 'bg-teal-800 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>New Hire Registrations ({requests.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('revocations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'revocations'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Access Revocation Requests</span>
          {pendingRevocationsCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeSubTab === 'revocations' ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
              }`}
            >
              {pendingRevocationsCount}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'revocations' ? (
        <RevocationRequestsAdminSection
          token={token}
          onRequestDecided={() => {
            clinicalApiClient
              .adminGetRevocationRequests('PENDING', token)
              .then((data) => setPendingRevocationsCount(data.length))
              .catch(() => {});
            if (onApprovalCompleted) onApprovalCompleted();
          }}
        />
      ) : (
        <>
          {/* Header */}
          <div>
            <h3 className="text-lg font-bold font-sans text-slate-950">
              Workforce Registration & Role Approvals ({requests.length})
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              {planCode === 'BASIC'
                ? 'Basic Tier: Single-level administrator verification and atomic role activation.'
                : planCode === 'PRO'
                ? 'Pro Tier: Two-level governance — Department Head operational review with Administrator final sign-off.'
                : 'Ultra Tier: Multi-stage sequential approval chains with delegated credential oversight.'}
            </p>
          </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-slate-200/90 shadow-soft-sm">
          <div className="w-8 h-8 border-2 border-teal-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-mono">Loading pending approvals...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-soft-sm space-y-3">
          <UserCheck className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold font-sans text-slate-900">All Registration Requests Approved</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            There are currently no outstanding self-registration or department placement requests awaiting administrator review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Requests List */}
          <div className="lg:col-span-5 space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                onClick={() => selectRequest(req)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                  selectedRequest?.id === req.id
                    ? 'bg-teal-50/50 border-teal-800/40 shadow-soft-sm ring-1 ring-teal-800/20'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-slate-950 font-sans">{req.full_name}</h5>
                    <p className="text-xs text-slate-500 font-mono">{req.email}</p>
                  </div>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-teal-900 border border-slate-200">
                    {req.employee_uid_claim}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>{req.assignment_requests.length} requested placement(s)</span>
                  <span className="text-[10px] font-mono">
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Decision Review Panel */}
          {selectedRequest && (
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-soft-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-900">
                    {selectedRequest.employee_uid_claim}
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    Status: {selectedRequest.status}
                  </span>
                </div>
                <h4 className="text-lg font-bold font-sans text-slate-950">
                  {selectedRequest.full_name}
                </h4>
                <p className="text-xs text-slate-500">{selectedRequest.email}</p>
              </div>

              <form onSubmit={handleDecisionSubmit} className="space-y-6">
                {/* Employee UID Verification */}
                <div className="p-4 rounded-xl bg-[#FAF7F2] border border-slate-200/80 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={verifyUid}
                      onChange={(e) => setVerifyUid(e.target.checked)}
                      className="mt-0.5 rounded text-teal-800 focus:ring-teal-800"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        Verify Institutional Employee UID
                      </span>
                      <span className="text-slate-600 text-[11px] leading-relaxed">
                        Confirms that the claimed UID matches the hospital's verified human resources register.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Requested Slots (Partial Approval Supported) */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-900 block uppercase tracking-wider">
                    Requested Role & Department Placements ({selectedRequest.assignment_requests.length})
                  </span>

                  {selectedRequest.assignment_requests.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-soft-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-950">{slot.role_name}</span>
                          <span className="font-mono text-[10px] text-slate-400">({slot.role_code})</span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Department: <span className="font-medium text-slate-800">{slot.department_name || 'Hospital-Wide'}</span>
                        </p>
                        {slot.dept_head_notes && (
                          <p className="text-[10px] text-teal-800 font-mono">
                            Dept Review: {slot.dept_head_notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setSlotDecisions((prev) => ({ ...prev, [slot.id]: 'approved' }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            slotDecisions[slot.id] === 'approved'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSlotDecisions((prev) => ({ ...prev, [slot.id]: 'rejected' }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            slotDecisions[slot.id] === 'rejected'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-slate-700 font-semibold text-xs mb-1">
                    Administrator Review Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="e.g. Credentials validated; approved for clinical duties"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-teal-800"
                  />
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {actionLoading ? 'Saving Decisions...' : 'Submit Institutional Decisions'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};

