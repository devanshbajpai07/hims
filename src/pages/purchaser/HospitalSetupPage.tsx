import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Info,
  UserPlus,
  Send,
  RotateCcw,
  XCircle,
  Trash2,
  Mail,
  Phone,
  Briefcase,
  AlertTriangle,
  User,
  History,
  ArrowRight,
} from 'lucide-react';
import { PurchaserNavbar } from '../../components/purchaser/PurchaserNavbar';
import { InstitutionalLoadingScreen } from '../../components/common/InstitutionalLoadingScreen';
import {
  hospitalAdminApi,
  HospitalAdministratorsManagementResponse,
  ActiveAdminItem,
} from '../../services/hospitalAdminApiClient';
import { purchaserService } from '../../services/purchaserService';

interface HospitalSetupPageProps {
  onNavigate: (path: string) => void;
}

export const HospitalSetupPage: React.FC<HospitalSetupPageProps> = ({ onNavigate }) => {
  const searchParams = new URLSearchParams(window.location.search);
  const subscriptionIdParam = searchParams.get('subscriptionId') || '';
  const hospitalIdParam = searchParams.get('hospitalId') || '';

  const currentPurchaser = useMemo(() => purchaserService.getCurrentPurchaser(), []);
  const purchaserId = currentPurchaser?.id;
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;

  // State
  const [data, setData] = useState<HospitalAdministratorsManagementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tab State: 4 options
  const [activeTab, setActiveTab] = useState<'invite' | 'active' | 'pending' | 'history'>('invite');

  // Invitation Form State
  const [inviteeName, setInviteeName] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteePhone, setInviteePhone] = useState('');
  const [inviteeDesignation, setInviteeDesignation] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Removal Confirmation Modal
  const [adminToRemove, setAdminToRemove] = useState<ActiveAdminItem | null>(null);
  const [removingAdmin, setRemovingAdmin] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    if (!purchaserId) {
      navigateRef.current('/account/login');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. If hospitalId is provided, fetch directly
      if (hospitalIdParam) {
        const res = await hospitalAdminApi.getHospitalManagement(hospitalIdParam);
        setData(res);
        return;
      }

      // 2. Otherwise list hospitals to find by subscriptionId or pick first
      let hospitals: any[] = [];
      try {
        hospitals = await hospitalAdminApi.listPurchaserHospitals();
      } catch (e) {
        hospitals = [];
      }

      if (!hospitals || hospitals.length === 0) {
        // Fallback to local storage if registered locally
        const localHosp = purchaserService.getAllHospitals();
        const localSubs = purchaserService.getPurchaserSubscriptions(purchaserId);
        const targetLocalHosp = subscriptionIdParam
          ? localHosp.find((h) => h.subscriptionId === subscriptionIdParam) ||
            localHosp.find((h) => {
              const subMatch = localSubs.find((s) => s.id === subscriptionIdParam);
              return subMatch?.hospitalId === h.id || subMatch?.hospitalUid === h.hospitalUid;
            })
          : localHosp[0];

        if (targetLocalHosp) {
          const subMatch = localSubs.find((s) => s.id === targetLocalHosp.subscriptionId) || localSubs[0];
          setData({
            hospital: {
              id: targetLocalHosp.id,
              name: targetLocalHosp.officialName,
              hospital_uid: targetLocalHosp.hospitalUid,
              facility_type: targetLocalHosp.hospitalType,
              plan_code: String(subMatch?.planId || 'pro').toUpperCase() as any,
              plan_name: (subMatch?.planName || 'Pro').replace(/\s+Tier$/i, ''),
              city: targetLocalHosp.city,
              state: targetLocalHosp.state,
              country: targetLocalHosp.country,
              contact_email: targetLocalHosp.officialContactEmail,
              contact_phone: targetLocalHosp.contactPhone,
              website: targetLocalHosp.website,
              licence_number: targetLocalHosp.licenceNumber,
              is_active: true,
              subscription_id: targetLocalHosp.subscriptionId,
              subscription_status: 'ACTIVE',
              current_period_ends_at: null,
              active_admins_count: 0,
              pending_invites_count: 0,
              max_administrators: subMatch?.maxAdministrators || 3,
              max_employees: 500,
              features: [],
              created_at: targetLocalHosp.registeredAt,
            },
            active_administrators: [],
            invitations: [],
            max_administrators: subMatch?.maxAdministrators || 3,
            remaining_seats: subMatch?.maxAdministrators || 3,
          });
          return;
        }

        setData(null);
        return;
      }

      let targetHospital = hospitals[0];
      if (subscriptionIdParam) {
        const match = hospitals.find((h) => h.subscription_id === subscriptionIdParam);
        if (match) {
          targetHospital = match;
        } else {
          setData(null);
          return;
        }
      }

      const res = await hospitalAdminApi.getHospitalManagement(targetHospital.id);
      setData(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load hospital administrator management data.');
    } finally {
      setLoading(false);
    }
  }, [purchaserId, hospitalIdParam, subscriptionIdParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Handlers
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    if (!inviteeName.trim() || !inviteeEmail.trim()) {
      setErrorMessage('Full Legal Name and Work Email Address are required.');
      return;
    }

    setSendingInvite(true);
    setErrorMessage(null);

    try {
      await hospitalAdminApi.inviteAdministrator(data.hospital.id, {
        invitee_name: inviteeName.trim(),
        invitee_email: inviteeEmail.trim(),
        invitee_phone: inviteePhone.trim() || undefined,
        invitee_designation: inviteeDesignation.trim() || undefined,
      });

      // Clear form
      setInviteeName('');
      setInviteeEmail('');
      setInviteePhone('');
      setInviteeDesignation('');
      showSuccess(`Official administrator invitation sent to ${inviteeEmail.trim()}.`);
      setActiveTab('pending');
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to issue administrator invitation.');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!data) return;
    try {
      await hospitalAdminApi.revokeAdministratorInvitation(data.hospital.id, invitationId);
      showSuccess('Invitation revoked successfully. Administrator seat released.');
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to revoke invitation.');
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    if (!data) return;
    try {
      await hospitalAdminApi.resendAdministratorInvitation(data.hospital.id, invitationId);
      showSuccess('Invitation regenerated and fresh email link sent.');
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend invitation.');
    }
  };

  const handleConfirmRemoveAdmin = async () => {
    if (!data || !adminToRemove) return;
    setRemovingAdmin(true);
    try {
      await hospitalAdminApi.removeAdministrator(data.hospital.id, adminToRemove.id);
      showSuccess(`Administrator privileges revoked for ${adminToRemove.full_name}. Active sessions invalidated.`);
      setAdminToRemove(null);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove administrator.');
    } finally {
      setRemovingAdmin(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('');
  };

  if (!currentPurchaser) return null;

  const pendingInvitations = data?.invitations.filter((i) => i.status === 'PENDING') || [];
  const activeAdminsCount = data?.active_administrators.length || 0;
  const pendingCount = pendingInvitations.length;
  const assignedSeatsCount = activeAdminsCount + pendingCount;
  const maxSeatsCount = data?.max_administrators || 1;
  const remainingSeatsCount = data?.remaining_seats ?? Math.max(0, maxSeatsCount - assignedSeatsCount);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between font-sans">
      <PurchaserNavbar currentPath="/account/hospital-setup" onNavigate={onNavigate} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        {/* Living Medical Motion Loading State */}
        {loading && (
          <InstitutionalLoadingScreen
            badge="CLINICAL TENANT HANDSHAKE"
            title="Loading Institutional Facility Workspace"
            subtitle="Synchronizing hospital credentials, administrator seats, and encrypted clinical records."
            stages={[
              'Establishing secure clinical tenant handshake...',
              'Verifying hospital facility UID and regulatory accreditation...',
              'Synchronizing administrator seats and governance matrix...',
              'Calibrating tenant security policies & audit logs...',
              'Preparing executive hospital administration workspace...',
            ]}
          />
        )}

        {/* Empty State: No Registered Hospital */}
        {!loading && !data && (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm p-12 text-center max-w-xl mx-auto">
            <Building2 className="w-12 h-12 text-amber-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold font-sans text-slate-900">Hospital Facility Not Registered</h2>
            <p className="text-xs text-slate-600 mt-2 font-normal mb-6">
              You must register hospital facility details and generate an official Hospital UID before inviting institutional administrators.
            </p>
            <button
              onClick={() => onNavigate('/account/hospital-registration')}
              className="px-6 py-3 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all cursor-pointer whitespace-nowrap"
            >
              Register Facility Now
            </button>
          </div>
        )}

        {/* Content State */}
        {!loading && data && (
          <div className="space-y-8">
            {/* 1. Main Page Header matching editorial design system */}
            <div className="text-center max-w-5xl mx-auto mb-8 sm:mb-10">
              <div className="flex items-center justify-center gap-4 mb-4 sm:mb-5">
                <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
                <span className="text-xs sm:text-sm font-mono font-semibold text-slate-600 uppercase tracking-[0.25em]">
                  EXECUTIVE GOVERNANCE &amp; ADMINISTRATION
                </span>
                <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-serif font-normal text-slate-950 tracking-[-0.02em] leading-[1.12]">
                Hospital Administrator <span className="text-[#1A6865] font-serif font-medium">Management</span>
              </h1>

              <p className="mt-5 text-base sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed w-full max-w-xl md:max-w-3xl mx-auto px-4 sm:px-0">
                Invite, oversee and manage institutional administrators authorized to govern this healthcare facility.
              </p>
            </div>

            {/* Flash Alerts */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-900 flex items-start gap-3 shadow-xs">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-normal">{errorMessage}</div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-500 hover:text-rose-800 font-bold cursor-pointer text-base leading-none"
                >
                  &times;
                </button>
              </div>
            )}

            {successMessage && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-900 flex items-center gap-3 shadow-xs">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                <span className="font-medium">{successMessage}</span>
              </div>
            )}

            {/* 2. First Box: Facility Overview & Administrator Seats Header Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Hospital Information */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl sm:text-3xl font-bold font-sans text-slate-950 tracking-tight">
                      {data.hospital.name}
                    </h2>
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                      {data.hospital.plan_name} Tier
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs sm:text-sm text-slate-500">
                    <span className="font-mono text-teal-900 font-semibold bg-teal-50/80 px-2.5 py-1 rounded-lg border border-teal-200">
                      UID: {data.hospital.hospital_uid}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="font-medium text-slate-600">{data.hospital.facility_type || 'Hospital Facility'}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-600">
                      {data.hospital.city}
                      {data.hospital.country ? `, ${data.hospital.country}` : ''}
                    </span>
                  </div>
                </div>

                {/* Administrator Seats Quota Box */}
                <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 sm:p-5 min-w-[220px] sm:min-w-[240px] flex flex-col justify-center text-left sm:text-right shrink-0">
                  <span className="text-[11px] font-mono uppercase tracking-[0.14em] font-bold text-slate-500 block mb-1">
                    Administrator Seats
                  </span>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-slate-950">
                    {assignedSeatsCount} <span className="text-slate-400 font-light">/</span> {maxSeatsCount}
                  </div>
                  <div className="text-xs text-teal-800 font-semibold mt-1">
                    {assignedSeatsCount} assigned · {remainingSeatsCount} available
                  </div>
                </div>
              </div>

              {/* Refined Equal Administrative Governance Notice */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-3.5 text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                <div className="w-5 h-5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="font-semibold text-slate-900">Equal Administrative Governance:</strong>{' '}
                  In Aarogya, all administrators have equal administrative authority for this hospital. No hierarchy or primary/secondary distinction exists. Seat management and commercial arrangements remain purchaser-controlled.
                </div>
              </div>
            </div>

            {/* 3. Single Big Box with 4 Consolidated Options */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-lg overflow-hidden transition-all w-full">
              {/* 4 Tab Options Header */}
              <div className="border-b border-slate-200/80 bg-[#FAF7F2]/60 px-4 sm:px-6 pt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('invite')}
                  className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                    activeTab === 'invite'
                      ? 'border-teal-800 text-teal-950 bg-white shadow-xs font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <UserPlus className="w-4 h-4 text-teal-700" />
                  <span>Invite Administrator</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                    activeTab === 'active'
                      ? 'border-teal-800 text-teal-950 bg-white shadow-xs font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  <span>Active Administrators ({activeAdminsCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('pending')}
                  className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                    activeTab === 'pending'
                      ? 'border-teal-800 text-teal-950 bg-white shadow-xs font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Clock className="w-4 h-4 text-teal-700" />
                  <span>Pending Invitations ({pendingCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                    activeTab === 'history'
                      ? 'border-teal-800 text-teal-950 bg-white shadow-xs font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <History className="w-4 h-4 text-teal-700" />
                  <span>Invitation History</span>
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-6 sm:p-10">
                {/* OPTION 1: Details Intake Form (Invite Administrator) */}
                {activeTab === 'invite' && (
                  <div>
                    {remainingSeatsCount <= 0 ? (
                      <div className="p-6 sm:p-8 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                          <span>Administrator Quota Reached</span>
                        </div>
                        <p className="text-xs sm:text-sm text-amber-800 font-normal leading-relaxed">
                          All {maxSeatsCount} allowed administrator seats are currently occupied by active administrators or pending invitations. Upgrade your subscription plan or revoke pending invitations to invite additional administrators.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleInviteSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                          {/* Full Legal Name */}
                          <div>
                            <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-2">
                              Full Legal Name <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <input
                                type="text"
                                required
                                value={inviteeName}
                                onChange={(e) => setInviteeName(e.target.value)}
                                placeholder="e.g. Administrator Full Legal Name"
                                className="w-full pl-11 pr-4 py-3.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition-colors"
                              />
                            </div>
                          </div>

                          {/* Work Email Address */}
                          <div>
                            <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-2">
                              Work Email Address <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <input
                                type="email"
                                required
                                value={inviteeEmail}
                                onChange={(e) => setInviteeEmail(e.target.value)}
                                placeholder="administrator@hospital.org"
                                className="w-full pl-11 pr-4 py-3.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition-colors"
                              />
                            </div>
                          </div>

                          {/* Contact Phone Number */}
                          <div>
                            <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-2">
                              Contact Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <input
                                type="tel"
                                value={inviteePhone}
                                onChange={(e) => setInviteePhone(e.target.value)}
                                placeholder="+1 (555) 000-0000"
                                className="w-full pl-11 pr-4 py-3.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition-colors"
                              />
                            </div>
                          </div>

                          {/* Executive Designation */}
                          <div>
                            <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-2">
                              Executive Designation <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <div className="relative">
                              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <input
                                type="text"
                                value={inviteeDesignation}
                                onChange={(e) => setInviteeDesignation(e.target.value)}
                                placeholder="e.g. Chief Medical Officer, Clinical Director"
                                className="w-full pl-11 pr-4 py-3.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition-colors"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Submit Action Strip */}
                        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
                          <span className="text-xs text-slate-500">
                            Cryptographically hashed invitation links remain active for 72 hours.
                          </span>
                          <button
                            type="submit"
                            disabled={sendingInvite}
                            className="w-full sm:w-auto px-8 py-4 rounded-full text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          >
                            <Send className="w-4 h-4 stroke-[2.2]" />
                            <span>{sendingInvite ? 'Dispatching Invitation...' : 'Send Administrator Invitation →'}</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* OPTION 2: Active Administrators */}
                {activeTab === 'active' && (
                  <div>
                    {data.active_administrators.length === 0 ? (
                      <div className="py-14 text-center max-w-md mx-auto">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h4 className="text-base font-bold text-slate-900">No Active Administrators</h4>
                        <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1 mb-6">
                          Issue an administrator invitation using the intake option to authorize institutional leadership for this facility.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('invite')}
                          className="px-6 py-3 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all cursor-pointer whitespace-nowrap"
                        >
                          Invite First Administrator →
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {data.active_administrators.map((admin) => (
                          <div
                            key={admin.id}
                            className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-start sm:items-center gap-4">
                              <div className="w-11 h-11 rounded-full bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold text-sm font-mono shrink-0">
                                {getInitials(admin.full_name)}
                              </div>
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-bold text-slate-950 font-sans">{admin.full_name}</h4>
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Active Administrator
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                  <span className="font-mono text-teal-800 font-medium bg-teal-50/60 px-2 py-0.5 rounded border border-teal-200/80">
                                    UID: {admin.employee_uid}
                                  </span>
                                  <span>{admin.email}</span>
                                  <span>Username: {admin.username}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setAdminToRemove(admin)}
                              className="px-4 py-2 rounded-full text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer self-start sm:self-auto shrink-0 flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove Administrator</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* OPTION 3: Pending Invitations */}
                {activeTab === 'pending' && (
                  <div>
                    {pendingInvitations.length === 0 ? (
                      <div className="py-14 text-center max-w-md mx-auto">
                        <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h4 className="text-base font-bold text-slate-900">No Pending Invitations</h4>
                        <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
                          All issued administrator invitations have been verified, expired, or revoked.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {pendingInvitations.map((inv) => (
                          <div
                            key={inv.id}
                            className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-bold text-slate-950 font-sans">{inv.invitee_name}</h4>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  Pending Verification
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 space-x-2">
                                <span>{inv.invitee_email}</span>
                                <span>•</span>
                                <span>Expires: {new Date(inv.expires_at).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleResendInvitation(inv.id)}
                                title="Resend invitation email with a fresh 72-hour token"
                                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Resend</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRevokeInvitation(inv.id)}
                                title="Revoke invitation and release seat quota immediately"
                                className="px-4 py-2 rounded-full text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Revoke</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* OPTION 4: Invitation History */}
                {activeTab === 'history' && (
                  <div>
                    {data.invitations.length === 0 ? (
                      <div className="py-14 text-center max-w-md mx-auto text-xs sm:text-sm text-slate-500">
                        No administrator invitation history recorded.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {data.invitations.map((inv) => (
                          <div
                            key={inv.id}
                            className="py-4 first:pt-0 last:pb-0 flex items-center justify-between text-xs sm:text-sm"
                          >
                            <div>
                              <span className="font-semibold text-slate-900 block">{inv.invitee_name}</span>
                              <span className="text-slate-500 font-mono text-[11px]">{inv.invitee_email}</span>
                            </div>

                            <div className="text-right">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                  inv.status === 'ACCEPTED'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : inv.status === 'PENDING'
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : inv.status === 'EXPIRED'
                                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {inv.status}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {new Date(inv.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Connected Lower Dock: Footnote Quote */}
              <div className="bg-slate-50/80 border-t border-slate-200/80 px-6 sm:px-10 py-6 sm:py-7 text-center">
                <p className="italic text-xs sm:text-[13.5px] text-slate-600 leading-normal">
                  &ldquo;Aarogya unified intake across our hospital wings with zero administrative friction.&rdquo;
                  <strong className="text-slate-900 font-semibold not-italic ml-2">
                    &mdash; Victoria Sterling, VP of Health Informatics &amp; Procurement
                  </strong>
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CONFIRMATION MODAL: REMOVE ADMINISTRATOR */}
      {adminToRemove && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-base font-bold font-sans text-slate-950">
                Revoke Administrator Authority?
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
              Are you sure you want to remove <strong className="text-slate-900">{adminToRemove.full_name}</strong> ({adminToRemove.email}) from hospital administrator governance?
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <div>• Active administrator sessions at this hospital will be terminated immediately.</div>
              <div>• The employee user account and historical clinical records will remain safely preserved.</div>
              <div>• An administrator seat will be released back into your subscription quota.</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={removingAdmin}
                onClick={() => setAdminToRemove(null)}
                className="px-5 py-2.5 rounded-full text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-all cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingAdmin}
                onClick={handleConfirmRemoveAdmin}
                className="px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{removingAdmin ? 'Revoking Access...' : 'Confirm Revocation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard subtle footer strip */}
      <footer className="w-full border-t border-slate-200/60 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>&copy; 2026 Aarogya Health Systems Inc. &bull; Institutional Procurement</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Systems Normal
            </span>
            <span>&bull;</span>
            <span>HIPAA &amp; FHIR Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  );
};