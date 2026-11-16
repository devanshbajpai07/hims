import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  PlusCircle,
  ShieldCheck,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { purchaserService } from '../../services/purchaserService';
import { SubscriptionRecord, AdminSetupStatus } from '../../types/subscription';
import { PurchaserNavbar } from '../../components/purchaser/PurchaserNavbar';
import { EnterpriseAccountSettingsModal } from '../../components/purchaser/EnterpriseAccountSettingsModal';
import { hospitalAdminApi } from '../../services/hospitalAdminApiClient';
import { purchaserApiClient, PurchaserProfile } from '../../services/purchaserApiClient';
import { PurchaserAccount } from '../../types/subscription';

interface PurchaserDashboardPageProps {
  onNavigate: (path: string) => void;
}

export const PurchaserDashboardPage: React.FC<PurchaserDashboardPageProps> = ({ onNavigate }) => {
  const searchParams = new URLSearchParams(window.location.search);
  const activatedSubId = searchParams.get('activated');

  const currentPurchaser = useMemo(() => purchaserService.getCurrentPurchaser(), []);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const [activePurchaser, setActivePurchaser] = useState<PurchaserAccount | null>(currentPurchaser);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>(() => {
    const pId = currentPurchaser?.id;
    return pId ? purchaserService.getPurchaserSubscriptions(pId) : [];
  });
  const [loading, setLoading] = useState(true);

  // Sync fresh profile from backend
  useEffect(() => {
    let isMounted = true;
    const token = purchaserApiClient.getSessionToken();
    const cached = purchaserService.getCurrentPurchaser();

    if (!cached && !token) {
      onNavigateRef.current('/account/login');
      return;
    }

    purchaserApiClient
      .getMe()
      .then((profile) => {
        if (!isMounted) return;
        const verified: PurchaserAccount = {
          id: profile.id,
          fullName: profile.fullName,
          email: profile.email,
          isEmailVerified: profile.isEmailVerified,
          accountStatus: profile.accountStatus,
          createdAt: profile.createdAt,
          lastLoginAt: profile.lastLoginAt,
          deletionScheduledAt: profile.deletionScheduledAt,
        };
        setActivePurchaser(verified);
        purchaserService.setCurrentPurchaser(verified);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (!cached) {
          onNavigateRef.current('/account/login');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const token = purchaserApiClient.getSessionToken();
    const cached = purchaserService.getCurrentPurchaser();
    const pId = activePurchaser?.id || cached?.id;

    if (!pId && !token) {
      return;
    }

    let isMounted = true;
    setLoading(true);

    // Fetch live backend subscriptions and hospitals from Neon PostgreSQL
    Promise.all([
      purchaserApiClient.listSubscriptions().catch((err: any) => {
        console.warn('Backend subscription query fallback:', err);
        return null;
      }),
      hospitalAdminApi.listPurchaserHospitals().catch((err: any) => {
        console.warn('Backend hospital query fallback:', err);
        return null;
      }),
    ]).then(([backendSubsRes, backendHospitals]) => {
      if (!isMounted) return;

      let activeSubs: SubscriptionRecord[] = [];

      if (backendSubsRes && backendSubsRes.subscriptions) {
        // Map canonical backend subscriptions from PostgreSQL
        activeSubs = backendSubsRes.subscriptions.map((item: any) => {
          const sub = item.subscription || item;
          const ent = item.entitlements || {};
          const planCode = String(sub.plan_code || 'BASIC').toUpperCase();
          const planId = planCode === 'ULTRA' ? 'enterprise' : planCode === 'PRO' ? 'pro' : 'basic';
          const planName = ent.display_name || (planCode === 'ULTRA' ? 'Ultra' : planCode === 'PRO' ? 'Pro' : 'Basic');
          const maxAdmins = ent.max_administrators || (planCode === 'ULTRA' ? 8 : planCode === 'PRO' ? 3 : 1);
          const maxStaff = ent.max_employees || (planCode === 'ULTRA' ? 10000 : planCode === 'PRO' ? 500 : 50);

          const hospMatch = backendHospitals?.find(
            (h: any) => (h.subscription_id && h.subscription_id === sub.id) || h.id === sub.hospital_id
          );

          return {
            id: sub.id,
            purchaserId: sub.purchaser_id || pId,
            planId: planId as any,
            planName: planName,
            status: sub.status as any,
            purchasedAt: sub.created_at,
            maxAdministrators: maxAdmins,
            employeeCapacityText: `${maxStaff} Staff Accounts`,
            pricePaid: sub.billing_interval === 'free' ? 'Free ($0)' : 'Active License',
            billingFrequency: (sub.billing_interval || 'annual') as any,
            hospitalId: hospMatch?.id,
            hospitalName: hospMatch?.name,
            hospitalUid: hospMatch?.hospital_uid,
            hospitalType: hospMatch?.facility_type || undefined,
            adminSetupStatus: (hospMatch?.active_admins_count ? 'completed' : 'incomplete') as AdminSetupStatus,
            configuredAdminsCount: hospMatch?.active_admins_count || 0,
            pendingInvitesCount: hospMatch?.pending_invites_count || 0,
          };
        });
      }

      // Enrich subscriptions with real registered hospital details from backend
      if (backendHospitals && backendHospitals.length > 0) {
        for (const hosp of backendHospitals) {
          const match = activeSubs.find(
            (s) =>
              (hosp.subscription_id && s.id === hosp.subscription_id) ||
              s.hospitalId === hosp.id
          );
          if (match) {
            match.hospitalId = hosp.id;
            match.hospitalName = hosp.name;
            match.hospitalUid = hosp.hospital_uid;
            match.hospitalType = (hosp.facility_type as any) || 'General Hospital';
            match.configuredAdminsCount = hosp.active_admins_count;
            match.pendingInvitesCount = hosp.pending_invites_count;
            match.adminSetupStatus =
              hosp.active_admins_count > 0
                ? 'completed'
                : hosp.pending_invites_count > 0
                ? 'invitations_sent'
                : 'incomplete';
          }
        }
      }

      setSubscriptions(activeSubs);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [activePurchaser?.id]);

  const handleCancelDeletion = async () => {
    setCancelLoading(true);
    try {
      await purchaserApiClient.cancelAccountDeletion();
      if (activePurchaser) {
        purchaserService.cancelPendingDeletion(activePurchaser.id);
        setActivePurchaser({
          ...activePurchaser,
          accountStatus: 'active',
          deletionScheduledAt: null,
        });
      }
    } catch (e) {
      console.error('Failed to cancel deletion:', e);
    } finally {
      setCancelLoading(false);
    }
  };

  const effectivePurchaser = activePurchaser || currentPurchaser;
  if (!effectivePurchaser) return null;

  const totalSubs = subscriptions.length;
  const registeredCount = subscriptions.filter((s) => s.hospitalId).length;
  const pendingRegistrationCount = totalSubs - registeredCount;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between font-sans">
      <PurchaserNavbar
        currentPath="/account/dashboard"
        onNavigate={onNavigate}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isPendingDeletion={activePurchaser?.accountStatus === 'pending_deletion'}
      />

      {/* Account Settings Modal */}
      {activePurchaser && (
        <EnterpriseAccountSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          purchaser={{
            id: activePurchaser.id,
            fullName: activePurchaser.fullName,
            email: activePurchaser.email,
            isEmailVerified: activePurchaser.isEmailVerified,
            accountStatus: activePurchaser.accountStatus || 'active',
            createdAt: activePurchaser.createdAt,
            lastLoginAt: activePurchaser.lastLoginAt,
            deletionScheduledAt: activePurchaser.deletionScheduledAt,
          }}
          onProfileUpdated={(updated) => {
            setActivePurchaser({
              id: updated.id,
              fullName: updated.fullName,
              email: updated.email,
              isEmailVerified: updated.isEmailVerified,
              accountStatus: updated.accountStatus,
              createdAt: updated.createdAt,
              lastLoginAt: updated.lastLoginAt,
              deletionScheduledAt: updated.deletionScheduledAt,
            });
          }}
          onNavigate={onNavigate}
        />
      )}

      <main className="w-full max-w-[1536px] mx-auto px-6 sm:px-10 lg:px-14 py-8 sm:py-10 flex-1 font-sans">
        {/* 60-Day Recovery Grace Period Alert Banner if Account is Scheduled for Deletion */}
        {activePurchaser?.accountStatus === 'pending_deletion' && (
          <div className="mb-8 p-5 sm:p-6 rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-soft-sm animate-in fade-in">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg text-amber-950">
                    Account Scheduled for Deletion (60-Day Recovery Grace Period)
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 border border-amber-300">
                    Recovery Active
                  </span>
                </div>
                <p className="text-xs sm:text-[13.5px] text-amber-800 mt-1.5 leading-relaxed">
                  Your enterprise organization account and linked facilities are scheduled for permanent removal on{' '}
                  <strong>
                    {activePurchaser.deletionScheduledAt
                      ? new Date(activePurchaser.deletionScheduledAt).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'in 60 days'}
                  </strong>.
                  All affected hospital administrators have been formally notified. You can restore this account at any time prior to this date.
                </p>
              </div>
            </div>

            <button
              onClick={handleCancelDeletion}
              disabled={cancelLoading}
              className="px-6 py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-all shadow-md shrink-0 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{cancelLoading ? 'Restoring...' : 'Cancel Deletion & Restore Account'}</span>
            </button>
          </div>
        )}

        {/* Activated Subscription Notification */}
        {activatedSubId && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong className="font-semibold text-emerald-900 block">
                  Subscription Provisioned Successfully!
                </strong>
                <span className="text-[11px] text-emerald-700">
                  Your new hospital subscription is active in your portfolio. You may register its hospital facility now or return to it later.
                </span>
              </div>
            </div>
            <button
              onClick={() =>
                onNavigate(
                  `/account/hospital-registration?subscriptionId=${encodeURIComponent(
                    activatedSubId
                  )}`
                )
              }
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all cursor-pointer shrink-0 text-center"
            >
              Register Facility Now
            </button>
          </div>
        )}

        {/* Top Header & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-normal text-slate-950 tracking-[-0.02em] leading-tight">
              <span className="text-[#1A6865] font-serif font-medium">Purchaser</span> Subscription Portal
            </h1>
          </div>

          {/* Persistent Action: Purchase New Subscription */}
          <button
            onClick={() => onNavigate('/account/pricing')}
            className="px-7 py-3.5 sm:px-8 sm:py-4 rounded-full text-sm sm:text-base font-semibold text-white bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 hover:from-emerald-500 hover:to-teal-600 shadow-md hover:shadow-native-glow transition-all duration-200 flex items-center gap-2.5 cursor-pointer border border-emerald-400/30 shrink-0 self-start sm:self-auto font-sans"
          >
            <PlusCircle className="w-5 h-5 text-emerald-200" />
            <span>Purchase New Subscription</span>
          </button>
        </div>

        {/* Portfolio Metric Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-soft-sm hover:shadow-soft-md transition-shadow">
            <span className="text-xs sm:text-[13px] font-mono uppercase tracking-[0.14em] font-medium text-slate-500 block mb-2">
              Active Subscriptions
            </span>
            <div className="text-4xl sm:text-5xl font-mono font-bold text-slate-950 my-1">
              {totalSubs}
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 font-normal mt-2 leading-relaxed">
              Independent hospital licenses owned.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-soft-sm hover:shadow-soft-md transition-shadow">
            <span className="text-xs sm:text-[13px] font-mono uppercase tracking-[0.14em] font-medium text-slate-500 block mb-2">
              Registered Hospitals
            </span>
            <div className="text-4xl sm:text-5xl font-mono font-bold text-emerald-700 my-1">
              {registeredCount}
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 font-normal mt-2 leading-relaxed">
              Facilities with generated Hospital UIDs.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-soft-sm hover:shadow-soft-md transition-shadow">
            <span className="text-xs sm:text-[13px] font-mono uppercase tracking-[0.14em] font-medium text-slate-500 block mb-2">
              Registration Pending
            </span>
            <div className="text-4xl sm:text-5xl font-mono font-bold text-amber-600 my-1">
              {pendingRegistrationCount}
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 font-normal mt-2 leading-relaxed">
              Purchased licenses awaiting hospital details.
            </p>
          </div>
        </div>

        {/* Subscriptions List */}
        <div className="space-y-6">
          <div className="pt-2">
            <h2 className="text-2xl sm:text-[26px] font-bold font-sans text-slate-950 tracking-tight">
              Hospital Subscriptions ({subscriptions.length})
            </h2>
          </div>

          {subscriptions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-soft-sm">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold font-sans text-slate-900">
                No Subscriptions in this Account
              </h3>
              <p className="text-xs text-slate-500 font-normal max-w-sm mx-auto mt-1 mb-6">
                You haven't activated any hospital subscriptions yet. Explore our clinical tiers to get started.
              </p>
              <button
                onClick={() => onNavigate('/account/pricing')}
                className="px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 shadow-sm cursor-pointer"
              >
                Browse Subscription Plans
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {subscriptions.map((sub) => {
                const isRegistered = Boolean(sub.hospitalId && sub.hospitalUid);

                return (
                  <div
                    key={sub.id}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm hover:shadow-soft-md transition-all p-6 sm:p-8"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                      {/* Subscription & Hospital Info */}
                      <div className="flex-1 space-y-3.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              sub.planId === 'enterprise'
                                ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                : sub.planId === 'pro'
                                ? 'bg-teal-100 text-teal-950 border border-teal-200'
                                : 'bg-slate-100 text-slate-900 border border-slate-200'
                            }`}
                          >
                            {sub.planName} Tier
                          </span>

                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Active Subscription
                          </span>
                        </div>

                        {/* Hospital Name or Registration Pending */}
                        <div>
                          {isRegistered ? (
                            <h3 className="text-2xl sm:text-[26px] font-bold font-sans text-slate-950 tracking-tight">
                              {sub.hospitalName}
                            </h3>
                          ) : (
                            <h3 className="text-2xl sm:text-[26px] font-bold font-sans text-slate-950 tracking-tight flex items-center gap-2.5">
                              <Clock className="w-6 h-6 text-amber-600 shrink-0" />
                              <span>Registration Pending</span>
                            </h3>
                          )}
                        </div>

                        {/* UID & Admins Configured */}
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-1 text-sm">
                          {isRegistered ? (
                            <span className="font-mono text-teal-950 font-bold bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 text-xs sm:text-sm">
                              UID: {sub.hospitalUid}
                            </span>
                          ) : (
                            <span className="font-mono text-amber-950 font-semibold bg-amber-50/80 px-3 py-1.5 rounded-lg border border-amber-200 text-xs sm:text-sm">
                              UID: Pending Registration
                            </span>
                          )}

                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4.5 h-4.5 text-teal-700 shrink-0" />
                            <span className="text-slate-900 font-medium text-xs sm:text-sm">
                              Admins Configured:{' '}
                              <strong className="text-slate-950 font-bold font-sans">
                                {sub.configuredAdminsCount || 0}/{sub.maxAdministrators}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action Column: Identically sized single button */}
                      <div className="shrink-0 flex items-center lg:justify-end pt-2 lg:pt-0">
                        {!isRegistered ? (
                          <button
                            onClick={() =>
                              onNavigate(
                                `/account/hospital-registration?subscriptionId=${encodeURIComponent(
                                  sub.id
                                )}`
                              )
                            }
                            className="no-hover-lift w-full sm:w-[230px] py-4 px-7 rounded-full text-base font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2.5 shadow-md hover:shadow-native-glow cursor-pointer font-sans tracking-wide shrink-0 whitespace-nowrap"
                          >
                            <span>Register Hospital</span>
                            <ArrowRight className="w-4.5 h-4.5 stroke-[2.5]" />
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              onNavigate(
                                `/account/hospital-setup?subscriptionId=${encodeURIComponent(
                                  sub.id
                                )}`
                              )
                            }
                            className="no-hover-lift w-full sm:w-[230px] py-4 px-7 rounded-full text-base font-bold text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 transition-all flex items-center justify-center gap-2.5 shadow-xs hover:border-slate-400 cursor-pointer font-sans tracking-wide shrink-0 whitespace-nowrap"
                          >
                            <span>Manage Hospital</span>
                            <ArrowRight className="w-4.5 h-4.5 text-slate-500 stroke-[2.5]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Subtle Bottom Footer Strip */}
      <footer className="relative z-10 w-full max-w-[1536px] mx-auto px-6 sm:px-10 lg:px-14 py-6 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>© 2026 Aarogya Health Systems Inc.</span>
          <span>•</span>
          <span>Institutional Procurement</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Systems Normal</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">HIPAA & FHIR Compliant</span>
        </div>
      </footer>
    </div>
  );
};

