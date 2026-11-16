import React, { useState, useEffect } from 'react';
import {
  Check,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Building2,
  Users,
  Shield,
  LogIn,
} from 'lucide-react';
import { FlowingBackgroundLines } from '../components/marketing/FlowingBackgroundLines';
import { Navbar } from '../components/marketing/Navbar';
import { PurchaserNavbar } from '../components/purchaser/PurchaserNavbar';
import { FooterSection } from '../components/marketing/FooterSection';
import { SUBSCRIPTION_PLANS, PLAN_COMPARISON_MATRIX } from '../data/subscriptionPlans';
import { purchaserService } from '../services/purchaserService';
import { purchaserApiClient } from '../services/purchaserApiClient';
import { authService } from '../services/authService';
import { PurchaserAccount, SubscriptionPlanId } from '../types/subscription';

interface PricingPageProps {
  onNavigate: (path: string) => void;
  context?: 'public' | 'enterprise';
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate, context = 'public' }) => {
  // Extract query parameters if redirected with preselected plan
  const searchParams = new URLSearchParams(window.location.search);
  const rawPlanParam = searchParams.get('plan') as SubscriptionPlanId | null;
  // Strictly enforce that Pro and Enterprise cannot be selected or carried over via URL
  const planParam = rawPlanParam === 'basic' ? 'basic' : null;
  const intervalParam = searchParams.get('interval') as 'annual' | 'monthly' | null;

  const isEnterprise =
    context === 'enterprise' ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/account/'));

  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>(
    intervalParam || 'annual'
  );

  const [verifiedPurchaser, setVerifiedPurchaser] = useState<PurchaserAccount | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Authenticate & verify purchaser session against backend
  useEffect(() => {
    let isMounted = true;

    purchaserApiClient
      .getMe()
      .then((profile) => {
        if (isMounted) {
          const verified: PurchaserAccount = {
            id: profile.id,
            fullName: profile.fullName,
            email: profile.email,
            isEmailVerified: profile.isEmailVerified,
            accountStatus: profile.accountStatus,
            createdAt: profile.createdAt,
            lastLoginAt: profile.lastLoginAt,
          };
          purchaserService.setCurrentPurchaser(verified);
          setVerifiedPurchaser(verified);
          setCheckingAuth(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          // No active valid session on backend: purge stale local storage
          purchaserService.setCurrentPurchaser(null);
          setVerifiedPurchaser(null);
          setCheckingAuth(false);
          if (isEnterprise) {
            const qs = planParam ? `?plan=${encodeURIComponent(planParam)}` : '';
            onNavigate(`/account/login${qs}`);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isEnterprise, planParam, onNavigate]);

  const plansList = [
    SUBSCRIPTION_PLANS.basic,
    SUBSCRIPTION_PLANS.pro,
    SUBSCRIPTION_PLANS.enterprise,
  ];

  const handleSelectPlan = async (planId: SubscriptionPlanId) => {
    // Pro and Enterprise plans are strictly Future Scope. Cannot be purchased!
    if (planId !== 'basic') {
      return;
    }
    const intervalQuery = billingCycle === 'annual' ? '&interval=annual' : '&interval=monthly';

    // Verify whether user is actively authenticated as an enterprise purchaser
    let activePurchaser = verifiedPurchaser;
    if (!activePurchaser) {
      try {
        const profile = await purchaserApiClient.getMe();
        activePurchaser = {
          id: profile.id,
          fullName: profile.fullName,
          email: profile.email,
          isEmailVerified: profile.isEmailVerified,
          accountStatus: profile.accountStatus,
          createdAt: profile.createdAt,
          lastLoginAt: profile.lastLoginAt,
        };
        purchaserService.setCurrentPurchaser(activePurchaser);
        setVerifiedPurchaser(activePurchaser);
      } catch {
        activePurchaser = null;
        purchaserService.setCurrentPurchaser(null);
        setVerifiedPurchaser(null);
      }
    }

    if (activePurchaser) {
      // User is verified and logged into enterprise: proceed to checkout
      onNavigate(`/account/checkout?plan=basic${intervalQuery}`);
    } else {
      // User is NOT logged in to enterprise: redirect to login / create account page!
      onNavigate(`/account/login?plan=basic${intervalQuery}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between selection:bg-emerald-500 selection:text-white font-sans">
      {/* Dynamic Header: PurchaserNavbar when inside enterprise portal, marketing Navbar when public */}
      {isEnterprise ? (
        <PurchaserNavbar currentPath="/account/pricing" onNavigate={onNavigate} />
      ) : (
        <Navbar currentPath="/pricing" onNavigate={onNavigate} />
      )}

      {/* Main Pricing Content */}
      <main className={`relative ${isEnterprise ? 'pt-6 sm:pt-12' : 'pt-24 sm:pt-36'} pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden`}>
        {/* Hairline Flowing Curves */}
        <FlowingBackgroundLines theme="light" />

        <div className="relative z-10 max-w-[1380px] mx-auto">
          {/* Header */}
          <div className="text-center max-w-5xl xl:max-w-6xl mx-auto mb-10 sm:mb-14">
            <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="h-[1.5px] w-8 sm:w-16 bg-slate-300" />
              <span className="text-xs sm:text-[15px] font-mono font-semibold text-slate-600 uppercase tracking-[0.2em] sm:tracking-[0.25em]">
                {isEnterprise ? 'ENTERPRISE SUBSCRIPTION CATALOG' : 'SOLUTION ALIGNMENT'}
              </span>
              <div className="h-[1.5px] w-8 sm:w-16 bg-slate-300" />
            </div>

            <h1 className="max-w-4xl mx-auto text-3xl sm:text-5xl lg:text-[4.25rem] font-serif font-normal text-slate-950 tracking-[-0.02em] leading-[1.15] text-balance">
              {isEnterprise ? (
                <>
                  <span className="text-[#1A6865] font-serif font-medium">Add Facility</span> Subscription Tier
                </>
              ) : (
                <>
                  <span className="text-[#1A6865] font-serif font-medium">Pricing</span> That Fits Your Healthcare Setting
                </>
              )}
            </h1>

            <p className="mt-4 sm:mt-6 text-sm sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed w-full max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-2 sm:px-0">
              {isEnterprise
                ? 'Choose an independent subscription tier to license another hospital facility under your enterprise account. Administrator and employee quotas apply strictly per hospital.'
                : 'Choose the operational classification that matches your facility. Every deployment quotation is calculated against authorized scope rather than one-size-fits-all bundles.'}
            </p>

            {/* Preselection notice if redirected after signing in */}
            {planParam && (
              <div className="mt-5 sm:mt-7 inline-flex items-center gap-2 sm:gap-2.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-emerald-50 border border-emerald-200/90 text-xs sm:text-sm text-emerald-900 font-medium shadow-xs">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                <span>
                  You selected <strong>{(SUBSCRIPTION_PLANS[planParam]?.name || planParam).toUpperCase()} Plan</strong>. Review details below and click checkout to finalize.
                </span>
              </div>
            )}

            {/* Public-only: Existing Purchaser Callout Banner */}
            {!isEnterprise && (
              <div className="mt-6 sm:mt-9 inline-flex flex-wrap items-center justify-center gap-2 sm:gap-4 py-2 px-4 sm:px-6 rounded-full bg-white/95 border border-slate-200/90 shadow-soft-sm text-xs sm:text-[15px]">
                <span className="text-slate-600 font-medium">
                  Already registered with us?
                </span>
                <button
                  onClick={() => onNavigate('/account/login')}
                  className="no-lift font-semibold text-teal-800 hover:text-teal-950 flex items-center gap-1.5 sm:gap-2 underline underline-offset-4 cursor-pointer text-xs sm:text-[15px] transition-colors"
                  style={{ transform: 'none' }}
                >
                  <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.25]" />
                  <span>Login</span>
                </button>
              </div>
            )}
          </div>

          {/* Pricing Cards Grid (3 Cards: Basic, Pro, Enterprise) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8 items-stretch mb-20">
            {plansList.map((plan) => {
              const isBasic = plan.id === 'basic';
              const isSelectedFromQuery = planParam === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-5 sm:p-8 xl:p-9 flex flex-col justify-between transition-all duration-200 ${
                    isSelectedFromQuery
                      ? 'bg-white border-2 border-emerald-600 shadow-soft-lg ring-2 ring-emerald-500/20 relative'
                      : isBasic
                      ? 'bg-white border-2 border-teal-700 shadow-soft-lg ring-1 ring-teal-500/20 relative'
                      : 'bg-white/80 border border-slate-200/90 shadow-soft-sm opacity-90 relative'
                  }`}
                >
                  {isSelectedFromQuery ? (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-700 text-white shadow-xs whitespace-nowrap z-20">
                      Your Selected Plan
                    </span>
                  ) : isBasic ? (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-800 text-white shadow-xs whitespace-nowrap z-20">
                      Standard Clinical Tier
                    </span>
                  ) : (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-300 shadow-2xs whitespace-nowrap z-20">
                      Future Scope
                    </span>
                  )}

                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="text-2xl sm:text-3xl font-bold font-sans text-slate-950">
                        {plan.name}
                      </div>
                    </div>

                    <p className="text-sm sm:text-[15px] text-slate-600 font-normal mt-2 min-h-[44px] sm:min-h-[48px] flex items-center leading-relaxed">
                      {plan.tagline}
                    </p>

                    {/* Price */}
                    <div className="mt-5 mb-6 pb-6 border-b border-slate-100 min-h-[96px] flex flex-col justify-end">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl sm:text-5xl font-bold font-mono text-slate-950 tracking-tight">
                          {plan.priceDisplay}
                        </span>
                        {!plan.isFree && !plan.isCustom && (
                          <span className="text-sm sm:text-base text-slate-500 font-normal">/ month</span>
                        )}
                      </div>
                      <span className="text-xs sm:text-sm text-slate-500 font-normal block mt-1.5">
                        {plan.priceSubtext}
                      </span>
                    </div>

                    {/* Key Entitlements Highlights */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 mb-7 space-y-2.5 text-sm sm:text-[15px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-600 font-medium whitespace-nowrap">Administrators:</span>
                        <span className="text-slate-900 font-sans text-sm sm:text-base font-normal whitespace-nowrap">
                          {plan.maxAdministrators} {plan.maxAdministrators === 1 ? 'Admin' : 'Admins'} Max
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-600 font-medium whitespace-nowrap">Staff Capacity:</span>
                        <span className="text-slate-900 font-sans text-sm sm:text-base font-normal whitespace-nowrap">
                          {plan.employeeCapacityText}
                        </span>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-3.5 mb-8">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 block">
                        Included Entitlements
                      </span>
                      {plan.features.map((feature, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 text-sm sm:text-[15px] text-slate-700 font-normal leading-relaxed"
                        >
                          <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Plan CTA Button */}
                  {isBasic ? (
                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`w-full py-4 sm:py-4.5 px-6 rounded-full text-base sm:text-lg font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md ${
                        isSelectedFromQuery
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-pill'
                          : 'bg-teal-800 hover:bg-teal-900 text-white'
                      }`}
                    >
                      <span>
                        {isEnterprise
                          ? isSelectedFromQuery
                            ? 'Proceed to Checkout'
                            : `Select ${plan.name} Tier`
                          : plan.ctaText}
                      </span>
                      <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  ) : (
                    <button
                      disabled
                      aria-disabled="true"
                      className="w-full py-4 sm:py-4.5 px-6 rounded-full text-base sm:text-lg font-bold flex items-center justify-center gap-2 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200/90 shadow-none select-none font-sans"
                    >
                      <span>Future Scope</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed Feature Comparison Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 lg:p-10 shadow-soft-sm mb-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8 pb-6 border-b border-slate-100">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold font-sans text-slate-950">
                  Comprehensive Feature &amp; Entitlement Comparison
                </h3>
                <p className="text-sm sm:text-[15px] text-slate-500 font-normal mt-1.5">
                  Detailed architectural limits and policies across Basic, Pro, and Ultra tiers.
                </p>
              </div>

              <span className="text-xs sm:text-sm font-sans text-slate-400 font-medium">
                Independent per-hospital quotas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider text-xs sm:text-[13px]">
                    <th className="py-4 px-5 font-semibold">Capability &amp; Entitlement</th>
                    <th className="py-4 px-5 font-semibold text-center w-1/4">Basic (Available)</th>
                    <th className="py-4 px-5 font-semibold text-center w-1/4">
                      Pro Tier (Future Scope)
                    </th>
                    <th className="py-4 px-5 font-semibold text-center w-1/4">Ultra Tier (Future Scope)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {PLAN_COMPARISON_MATRIX.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 sm:py-5 px-5">
                        <div className="font-semibold text-slate-950 text-sm sm:text-base font-sans">{row.feature}</div>
                        <span className="text-xs text-slate-400 font-normal font-sans block mt-0.5">
                          {row.category}
                        </span>
                      </td>

                      {/* Basic */}
                      <td className="py-4 sm:py-5 px-5 text-center">
                        {typeof row.basic === 'boolean' ? (
                          row.basic ? (
                            <Check className="w-5 h-5 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-slate-500 text-xl font-bold select-none">—</span>
                          )
                        ) : (
                          <span className="font-bold text-slate-800 font-sans text-sm sm:text-base">{row.basic}</span>
                        )}
                      </td>

                      {/* Pro */}
                      <td className="py-4 sm:py-5 px-5 text-center">
                        {typeof row.pro === 'boolean' ? (
                          row.pro ? (
                            <Check className="w-5 h-5 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-slate-500 text-xl font-bold select-none">—</span>
                          )
                        ) : (
                          <span className="font-bold text-teal-800 font-sans text-sm sm:text-base">{row.pro}</span>
                        )}
                      </td>

                      {/* Enterprise/Ultra */}
                      <td className="py-4 sm:py-5 px-5 text-center">
                        {typeof row.enterprise === 'boolean' ? (
                          row.enterprise ? (
                            <Check className="w-5 h-5 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-slate-500 text-xl font-bold select-none">—</span>
                          )
                        ) : (
                          <span className="font-bold text-teal-900 font-sans text-sm sm:text-base">{row.enterprise}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Multi-Facility Section */}
          <div className="rounded-3xl bg-teal-900 text-white p-8 sm:p-10 lg:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-sm font-mono uppercase tracking-wider text-teal-300 font-semibold block">
                Multi-Facility Management
              </span>
              <h4 className="text-2xl sm:text-3xl font-bold font-sans leading-tight">
                Managing multiple hospitals under one healthcare system?
              </h4>
              <p className="text-sm sm:text-base text-teal-100 font-normal max-w-2xl leading-relaxed mt-2">
                A single purchaser account allows purchasing distinct licenses for independent hospitals, each receiving a dedicated Hospital UID, independent administrator limits, and separate staff capacity.
              </p>
            </div>

            {!isEnterprise && (
              <div className="flex flex-col sm:flex-row items-center gap-3.5 shrink-0">
                <button
                  onClick={() => onNavigate('/account/register')}
                  className="w-full sm:w-auto px-7 sm:px-8 py-3.5 rounded-full text-sm sm:text-base font-semibold text-teal-950 bg-white hover:bg-teal-50 transition-all cursor-pointer shadow-sm"
                >
                  Register
                </button>
                <button
                  onClick={() => onNavigate('/account/login')}
                  className="w-full sm:w-auto px-7 sm:px-8 py-3.5 rounded-full text-sm sm:text-base font-semibold text-white bg-teal-800 hover:bg-teal-700 border border-teal-600/80 transition-all cursor-pointer"
                >
                  Login
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Dynamic Footer */}
      {isEnterprise ? (
        <footer className="relative z-10 w-full max-w-[1536px] mx-auto px-6 sm:px-10 lg:px-14 py-8 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-sans">
          <div>© 2026 Aarogya Health Systems Inc. • Institutional Procurement</div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Enterprise Authenticated
            </span>
            <span>•</span>
            <span>HIPAA &amp; FHIR Compliant</span>
          </div>
        </footer>
      ) : (
        <FooterSection onNavigate={onNavigate} />
      )}
    </div>
  );
};
