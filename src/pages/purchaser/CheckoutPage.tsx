import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  Check,
  ArrowRight,
  AlertCircle,
  Building2,
  Sparkles,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { purchaserService } from '../../services/purchaserService';
import { purchaserApiClient } from '../../services/purchaserApiClient';
import { authService } from '../../services/authService';
import { SUBSCRIPTION_PLANS } from '../../data/subscriptionPlans';
import { PurchaserAccount, SubscriptionPlanId } from '../../types/subscription';
import { PurchaserNavbar } from '../../components/purchaser/PurchaserNavbar';

interface CheckoutPageProps {
  onNavigate: (path: string) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onNavigate }) => {
  const searchParams = new URLSearchParams(window.location.search);
  const rawPlanParam = searchParams.get('plan') as SubscriptionPlanId | null;
  const isFutureScopeTier = rawPlanParam === 'pro' || rawPlanParam === 'enterprise';
  const planParam: SubscriptionPlanId = isFutureScopeTier ? rawPlanParam : 'basic';

  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>(planParam);
  const [billingFrequency, setBillingFrequency] = useState<'annual' | 'monthly'>('annual');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authoritative purchaser session verified directly with backend
  const [currentPurchaser, setCurrentPurchaser] = useState<PurchaserAccount | null>(null);
  const [isValidatingAuth, setIsValidatingAuth] = useState(true);

  // Real payment form fields
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Auth gate check: Strictly verify purchaser session with backend API
  useEffect(() => {
    let isMounted = true;
    setIsValidatingAuth(true);

    const storedEmployee = authService.getStoredSession();
    const cachedPurchaser = purchaserService.getCurrentPurchaser();
    // If employee and cached purchaser email conflict, purge stale purchaser data
    if (storedEmployee?.user?.email && cachedPurchaser?.email) {
      if (storedEmployee.user.email.toLowerCase() !== cachedPurchaser.email.toLowerCase()) {
        purchaserService.setCurrentPurchaser(null);
      }
    }

    purchaserApiClient
      .getMe()
      .then((profile) => {
        if (isMounted) {
          const verifiedAccount: PurchaserAccount = {
            id: profile.id,
            fullName: profile.fullName,
            email: profile.email,
            isEmailVerified: profile.isEmailVerified,
            accountStatus: profile.accountStatus,
            createdAt: profile.createdAt,
            lastLoginAt: profile.lastLoginAt,
          };
          purchaserService.setCurrentPurchaser(verifiedAccount);
          setCurrentPurchaser(verifiedAccount);
          setCardholderName(verifiedAccount.fullName || '');
          setIsValidatingAuth(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          purchaserService.setCurrentPurchaser(null);
          setCurrentPurchaser(null);
          setIsValidatingAuth(false);
          const intervalQuery = billingFrequency ? `&interval=${encodeURIComponent(billingFrequency)}` : '';
          onNavigate(`/account/login?plan=${encodeURIComponent(selectedPlanId)}${intervalQuery}`);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPlanId, billingFrequency, onNavigate]);

  const plan = SUBSCRIPTION_PLANS[selectedPlanId] || SUBSCRIPTION_PLANS.pro;

  // Dynamic Pricing by plan & frequency:
  // Pro: $99 (monthly), $999 (annual)
  // Ultra (enterprise): $149 (monthly), $1499 (annual)
  // Basic: Free ($0)
  const getPricingInfo = () => {
    if (plan.isFree) {
      return {
        amountText: 'Free',
        intervalText: '',
        subtext: 'No credit card required',
        orderAmount: 'Free ($0)',
      };
    }

    if (selectedPlanId === 'enterprise') {
      const isAnnual = billingFrequency === 'annual';
      return {
        amountText: isAnnual ? '$1499' : '$149',
        intervalText: isAnnual ? '/ year' : '/ month',
        subtext: 'Auto-renewal Enabled unless Cancelled',
        orderAmount: isAnnual ? '$1499' : '$149',
      };
    }

    // Default Pro
    const isAnnual = billingFrequency === 'annual';
    return {
      amountText: isAnnual ? '$999' : '$99',
      intervalText: isAnnual ? '/ year' : '/ month',
      subtext: 'Auto-renewal Enabled unless Cancelled',
      orderAmount: isAnnual ? '$999' : '$99',
    };
  };

  const pricing = getPricingInfo();

  const handleExecutePayment = () => {
    setErrorMessage(null);

    // Strictly enforce that Pro and Enterprise subscriptions cannot be purchased
    if (selectedPlanId !== 'basic') {
      setErrorMessage(
        'Subscription purchases for Pro and Enterprise (Ultra) tiers are temporarily disabled (Future Scope). Only Basic tier can be activated.'
      );
      return;
    }

    if (!plan.isFree) {
      if (!cardholderName.trim()) {
        setErrorMessage('Please enter the cardholder name.');
        return;
      }
      if (cardNumber.replace(/\s/g, '').length < 15) {
        setErrorMessage('Please enter a valid 16-digit card number.');
        return;
      }
      if (!cardExpiry.trim()) {
        setErrorMessage('Please enter the card expiry date (MM/YY).');
        return;
      }
      if (cardCvc.length < 3) {
        setErrorMessage('Please enter a valid 3 or 4-digit CVC.');
        return;
      }
    }

    setProcessing(true);

    const planCode = 'BASIC';
    const interval = plan.isFree ? 'free' : billingFrequency;

    purchaserApiClient
      .createSubscription({
        planCode,
        billingInterval: interval,
      })
      .then((createdDetail) => {
        const subId = createdDetail.subscription.id;
        try {
          purchaserService.createSubscription({
            planId: selectedPlanId,
            billingFrequency: interval,
          });
        } catch {}

        if (plan.isFree) {
          onNavigate(`/account/dashboard?activated=${encodeURIComponent(subId)}`);
        } else {
          onNavigate(`/account/purchase-confirmation?subscriptionId=${encodeURIComponent(subId)}`);
        }
      })
      .catch((err: any) => {
        setErrorMessage(err.message || 'Failed to complete subscription purchase in database.');
      })
      .finally(() => {
        setProcessing(false);
      });
  };

  if (isValidatingAuth) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <RefreshCw className="w-8 h-8 text-teal-800 animate-spin" />
          <p className="text-sm font-medium">Verifying enterprise authorization...</p>
        </div>
      </div>
    );
  }

  if (!currentPurchaser) return null;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between font-sans">
      <PurchaserNavbar currentPath="/account/checkout" onNavigate={onNavigate} />

      <main className="max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
        {/* Header */}
        <div className="mb-10 sm:mb-12 text-left">
          <div className="inline-flex flex-col items-center">
            {/* Overline with flanking accent hairlines, aligned to the center of the heading */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 mb-3 sm:mb-4 w-full">
              <div className="h-[1.5px] w-8 sm:w-12 bg-slate-300" />
              <span className="text-xs sm:text-sm font-mono font-semibold text-slate-600 uppercase tracking-[0.25em]">
                SUBSCRIPTION CHECKOUT
              </span>
              <div className="h-[1.5px] w-8 sm:w-12 bg-slate-300" />
            </div>

            {/* Heading - the highlight of the page */}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif font-normal text-slate-950 tracking-[-0.02em] leading-[1.12] text-left w-full">
              <span className="text-[#1A6865] font-serif font-medium">Confirm</span> Subscription & Entitlements
            </h1>
          </div>

          {/* Supporting description - full width, not limited to padding above, goes to normal end without wrapping */}
          <p className="mt-3.5 text-base sm:text-lg lg:text-[19px] text-slate-600 font-normal leading-normal">
            Review your institutional licensing tier and complete secure activation.
          </p>
        </div>

        {/* Future Scope Notice Banner if URL manipulated to Pro/Enterprise */}
        {selectedPlanId !== 'basic' && (
          <div className="mb-8 p-5 sm:p-6 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 shadow-soft-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-amber-950">
                  {plan.name} Tier Is Currently Future Scope
                </h3>
                <p className="text-xs sm:text-sm text-amber-800 mt-0.5 leading-relaxed">
                  Subscription purchases for Pro and Enterprise (Ultra) tiers are disabled as part of planned platform updates. To license a hospital facility today, please switch to the <strong>Basic Tier</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedPlanId('basic');
                onNavigate('/account/checkout?plan=basic');
              }}
              className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer self-start sm:self-center"
            >
              Switch to Basic Tier
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mb-8 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Payment Processing Notice</p>
              <p className="mt-0.5 font-light">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Left Column: Plan Entitlements & Order Summary (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-7 sm:gap-8">
            {/* Box 1: Plan Card Summary */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-md p-7 sm:p-9 transition-all">
              {/* Selected Tier Overline */}
              <div className="flex items-center justify-between mb-2 sm:mb-2.5">
                <span className="text-xs sm:text-[13px] font-mono uppercase tracking-[0.2em] text-[#1A6865] font-bold">
                  SELECTED TIER
                </span>
                {!plan.isFree && (
                  <span className="text-xs font-mono font-medium text-slate-400">
                    {billingFrequency === 'annual' ? 'Annual Billing' : 'Monthly Billing'}
                  </span>
                )}
              </div>

              {/* Main Heading & Price on the EXACT same baseline / level */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 sm:gap-6">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-bold font-sans text-slate-950 tracking-tight leading-tight">
                    {plan.name} Subscription
                  </h2>
                  {!plan.isFree && (
                    <p className="text-xs sm:text-sm text-slate-500 font-normal mt-2">
                      {pricing.subtext}
                    </p>
                  )}
                </div>

                <div className="sm:text-right shrink-0">
                  <div className="flex sm:flex-col items-baseline sm:items-end gap-2 sm:gap-0">
                    <span className="text-3xl sm:text-4xl lg:text-[2.65rem] font-mono font-extrabold text-slate-950 tracking-tight leading-none">
                      {pricing.amountText}
                    </span>
                    {!plan.isFree && (
                      <span className="text-xs sm:text-sm text-slate-500 font-mono sm:mt-1 font-normal">
                        {pricing.intervalText}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Billing Toggle if not free */}
              {!plan.isFree && (
                <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base font-semibold text-slate-800">
                      Billing Cycle:
                    </span>
                  </div>

                  <div className="inline-flex rounded-xl bg-slate-100/90 p-1.5 text-xs sm:text-sm font-semibold">
                    <button
                      type="button"
                      onClick={() => setBillingFrequency('annual')}
                      className={`px-4 sm:px-6 py-2.5 rounded-lg transition-all cursor-pointer no-lift ${
                        billingFrequency === 'annual'
                          ? 'bg-[#1A6865] text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-950 font-medium'
                      }`}
                    >
                      Annual (Recommended)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingFrequency('monthly')}
                      className={`px-4 sm:px-6 py-2.5 rounded-lg transition-all cursor-pointer no-lift ${
                        billingFrequency === 'monthly'
                          ? 'bg-[#1A6865] text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-950 font-medium'
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Box 2: Guaranteed Plan Entitlements */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-md p-7 sm:p-9 space-y-7 transition-all flex-1">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <ShieldCheck className="w-6 h-6 text-[#1A6865]" />
                <h3 className="text-lg sm:text-xl font-bold font-sans text-slate-950">
                  Subscription Entitlements for this Hospital
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-500 block mb-1.5 font-medium">
                    Hospital Administrator Quota
                  </span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-slate-950 block">
                    {plan.maxAdministrators} {plan.maxAdministrators === 1 ? 'Administrator' : 'Administrators'}
                  </span>
                  <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1 leading-normal">
                    Authorized executive sign-off limit.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-500 block mb-1.5 font-medium">
                    Employee Capacity Limit
                  </span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-slate-950 block">
                    {plan.employeeCapacityText}
                  </span>
                  <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1 leading-normal">
                    Doctors, nurses & reception staff seats.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <span className="text-sm sm:text-base font-bold text-slate-900 block">
                  Included Architectural Capabilities:
                </span>
                <div className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm sm:text-[14.5px] text-slate-700 font-normal leading-relaxed">
                      <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5 stroke-[2.25]" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Checkout Action & Simulation (5 cols) */}
          <div className="lg:col-span-5 flex flex-col h-full">
            {/* Box 3: Order Summary & Checkout Card - Aligns to bottom edge of left column */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-md p-7 sm:p-9 transition-all flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
                  <span className="text-lg sm:text-xl font-bold font-sans text-slate-950">Order Summary</span>
                  <span className="text-xl sm:text-2xl font-mono font-extrabold text-[#1A6865]">
                    {pricing.orderAmount}
                  </span>
                </div>

                <div className="space-y-3.5 text-sm sm:text-[14.5px] mb-7">
                  <div className="flex justify-between text-slate-600">
                    <span>Purchaser:</span>
                    <span className="font-semibold text-slate-950">{currentPurchaser.fullName}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Contact Email:</span>
                    <span className="font-mono text-slate-950">{currentPurchaser.email}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Selected Tier:</span>
                    <span className="font-bold text-[#1A6865]">{plan.name}</span>
                  </div>
                  {!plan.isFree && (
                    <div className="flex justify-between text-slate-600">
                      <span>Billing Cycle:</span>
                      <span className="font-semibold text-slate-950">
                        {billingFrequency === 'annual' ? 'Annual (Recommended)' : 'Monthly'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Administrator Seats:</span>
                    <span className="font-semibold text-slate-950">{plan.maxAdministrators} Max</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Staff Capacity:</span>
                    <span className="font-medium text-slate-900">{plan.employeeCapacityText}</span>
                  </div>
                </div>

                {/* Real Payment Method Form (for paid plans) */}
                {!plan.isFree && (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 mb-7 space-y-4">
                    <div className="flex items-center justify-between text-slate-700 text-xs sm:text-[13px]">
                      <span className="font-semibold flex items-center gap-1.5 text-slate-900">
                        <CreditCard className="w-4 h-4 text-teal-800" />
                        <span>Corporate Card Payment</span>
                      </span>
                      <span className="font-mono text-[11px] text-teal-800 font-semibold">256-BIT ENCRYPTED</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Cardholder Legal Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Victoria Sterling"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-teal-700 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Card Number
                      </label>
                      <input
                        type="text"
                        placeholder="•••• •••• •••• ••••"
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-teal-700 transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Expiry Date
                        </label>
                        <input
                          type="text"
                          placeholder="MM / YY"
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full px-3.5 py-2 text-center rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-teal-700 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Security CVC
                        </label>
                        <input
                          type="password"
                          placeholder="CVC"
                          maxLength={4}
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          className="w-full px-3.5 py-2 text-center rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-teal-700 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Primary Buttons & Safety Footnote */}
              <div className="space-y-3.5 pt-4">
                {selectedPlanId !== 'basic' ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="w-full py-4 px-8 rounded-full text-base sm:text-[17px] font-bold text-slate-400 bg-slate-100 border border-slate-200/90 cursor-not-allowed select-none shadow-none font-sans flex items-center justify-center gap-2"
                  >
                    <span>Future Scope — Plan Unavailable for Purchase</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={processing}
                    onClick={handleExecutePayment}
                    className="no-hover-lift w-full py-4 px-8 rounded-full text-base sm:text-[17px] font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer disabled:opacity-50 font-sans tracking-wide"
                  >
                    <span>{processing ? 'Activating Subscription...' : 'Confirm & Activate Basic Subscription'}</span>
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                  </button>
                )}

                {/* Safe Note */}
                <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <Lock className="w-3.5 h-3.5 text-teal-700" />
                  <span>Secure SSL Encrypted • Direct PostgreSQL Account Provisioning</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

