import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Building2,
  ArrowRight,
  ShieldCheck,
  LayoutDashboard,
  Sparkles,
  Info,
} from 'lucide-react';
import { purchaserService } from '../../services/purchaserService';
import { purchaserApiClient } from '../../services/purchaserApiClient';
import { PurchaserNavbar } from '../../components/purchaser/PurchaserNavbar';

interface PurchaseConfirmationPageProps {
  onNavigate: (path: string) => void;
}

export const PurchaseConfirmationPage: React.FC<PurchaseConfirmationPageProps> = ({ onNavigate }) => {
  const searchParams = new URLSearchParams(window.location.search);
  const subscriptionId = searchParams.get('subscriptionId') || '';

  const [subscription, setSubscription] = useState<any>(() =>
    purchaserService.getSubscriptionById(subscriptionId)
  );
  const currentPurchaser = purchaserService.getCurrentPurchaser();

  useEffect(() => {
    if (!subscription && subscriptionId) {
      purchaserApiClient
        .getSubscriptionDetail(subscriptionId)
        .then((detail) => {
          if (detail && detail.subscription) {
            const sub = detail.subscription;
            const ent = detail.entitlements || {};
            const planCode = String(sub.plan_code || 'BASIC').toUpperCase();
            const planName = ent.display_name || (planCode === 'ULTRA' ? 'Ultra' : planCode === 'PRO' ? 'Pro' : 'Basic');
            setSubscription({
              id: sub.id,
              purchaserId: sub.purchaser_id,
              planId: planCode.toLowerCase(),
              planName,
              status: sub.status,
              purchasedAt: sub.created_at,
              maxAdministrators: ent.max_administrators || 1,
              employeeCapacityText: `${ent.max_employees || 50} Staff Accounts`,
              pricePaid: sub.billing_interval === 'free' ? 'Free ($0)' : 'Annual Active License',
              billingFrequency: sub.billing_interval || 'annual',
            });
          }
        })
        .catch(() => {});
    }
  }, [subscription, subscriptionId]);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between font-sans">
      <PurchaserNavbar currentPath="/account/purchase-confirmation" onNavigate={onNavigate} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14 w-full">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-soft-sm p-6 sm:p-12 text-center">
          {/* Animated/Glowing Success Icon */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xs">
            <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9" />
          </div>

          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
            Subscription Activated Successfully
          </span>

          <h1 className="text-2xl sm:text-4xl font-bold font-sans text-slate-950">
            Welcome to the Aarogya Network
          </h1>

          <p className="text-sm text-slate-600 mt-3 font-normal max-w-lg mx-auto leading-relaxed">
            Your <strong className="font-semibold text-slate-900">{subscription?.planName || 'Aarogya'}</strong> subscription has been provisioned and linked to your purchaser account.
          </p>

          {/* Subscription Receipt Card */}
          <div className="mt-6 sm:mt-8 p-4 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200/80 text-left max-w-lg mx-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 text-xs">
              <span className="text-slate-500">Subscription ID:</span>
              <span className="font-mono font-semibold text-slate-800">
                {subscription?.id || 'SUB-PROVISIONED'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 text-xs border-b border-slate-200/60">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Tier</span>
                <span className="font-semibold text-teal-900">{subscription?.planName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Price Recorded</span>
                <span className="font-medium text-slate-800">{subscription?.pricePaid}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Admin Quota</span>
                <span className="font-medium text-slate-800">
                  {subscription?.maxAdministrators} {subscription?.maxAdministrators === 1 ? 'Admin' : 'Admins'} Max
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Staff Capacity</span>
                <span className="font-medium text-slate-800">{subscription?.employeeCapacityText}</span>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Hospital Status:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <span>Registration Pending</span>
              </span>
            </div>
          </div>

          {/* Action */}
          <div className="mt-8 flex items-center justify-center max-w-md mx-auto">
            <button
              onClick={() =>
                onNavigate(
                  `/account/hospital-registration?subscriptionId=${encodeURIComponent(
                    subscription?.id || ''
                  )}`
                )
              }
              className="no-hover-lift w-full sm:w-auto px-8 py-4 rounded-full text-base font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2.5 shadow-md hover:shadow-native-glow cursor-pointer font-sans tracking-wide shrink-0"
            >
              <Building2 className="w-5 h-5" />
              <span>Register Hospital Now</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

