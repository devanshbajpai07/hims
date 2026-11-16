import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  Globe,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { purchaserService } from '../../services/purchaserService';
import { SubscriptionRecord, HospitalType, HospitalRecord } from '../../types/subscription';
import { PurchaserNavbar } from '../../components/purchaser/PurchaserNavbar';
import { hospitalAdminApi } from '../../services/hospitalAdminApiClient';
import { purchaserApiClient } from '../../services/purchaserApiClient';

interface HospitalRegistrationPageProps {
  onNavigate: (path: string) => void;
}

const HOSPITAL_TYPES: HospitalType[] = [
  'General Hospital',
  'Specialty Medical Center',
  'Ambulatory Clinic',
  'Tertiary Care Facility',
  'Academic Medical Center',
];

export const HospitalRegistrationPage: React.FC<HospitalRegistrationPageProps> = ({ onNavigate }) => {
  const searchParams = new URLSearchParams(window.location.search);
  const subscriptionIdParam = searchParams.get('subscriptionId') || '';

  const currentPurchaser = useMemo(() => purchaserService.getCurrentPurchaser(), []);
  const purchaserId = currentPurchaser?.id;
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<string>(subscriptionIdParam);

  // Form Fields
  const [officialName, setOfficialName] = useState('');
  const [hospitalType, setHospitalType] = useState<HospitalType>('General Hospital');
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('United States');
  const [officialContactEmail, setOfficialContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredHospital, setRegisteredHospital] = useState<HospitalRecord | null>(null);

  useEffect(() => {
    if (!purchaserId) {
      onNavigateRef.current('/account/login');
      return;
    }
    const localSubs = purchaserService.getPurchaserSubscriptions(purchaserId);
    setSubscriptions(localSubs);

    if (subscriptionIdParam) {
      const match = localSubs.find((s) => s.id === subscriptionIdParam);
      if (match) setSelectedSubId(match.id);
    } else {
      const firstUnregistered = localSubs.find((s) => !s.hospitalId);
      if (firstUnregistered) {
        setSelectedSubId(firstUnregistered.id);
      } else if (localSubs.length > 0) {
        setSelectedSubId(localSubs[0].id);
      }
    }

    let isMounted = true;

    // Refresh subscriptions from backend PostgreSQL
    purchaserApiClient
      .listSubscriptions()
      .then((backendRes: any) => {
        if (!isMounted) return;
        if (backendRes && backendRes.subscriptions && backendRes.subscriptions.length > 0) {
          const backendSubs: SubscriptionRecord[] = backendRes.subscriptions.map((item: any) => {
            const sub = item.subscription || item;
            const ent = item.entitlements || {};
            const planCode = String(sub.plan_code || 'BASIC').toUpperCase();
            const planId = planCode === 'ULTRA' ? 'enterprise' : planCode === 'PRO' ? 'pro' : 'basic';
            const planName = ent.display_name || (planCode === 'ULTRA' ? 'Ultra' : planCode === 'PRO' ? 'Pro' : 'Basic');
            const localMatch = localSubs.find((ls) => ls.id === sub.id);

            return {
              id: sub.id,
              purchaserId: sub.purchaser_id || purchaserId,
              planId: planId as any,
              planName: planName,
              status: sub.status as any,
              purchasedAt: sub.created_at,
              maxAdministrators: ent.max_administrators || (planCode === 'ULTRA' ? 8 : planCode === 'PRO' ? 3 : 1),
              employeeCapacityText: `${ent.max_employees || 50} Staff Accounts`,
              pricePaid: sub.billing_interval === 'free' ? 'Free ($0)' : 'Annual Active License',
              billingFrequency: (sub.billing_interval || 'annual') as any,
              hospitalId: localMatch?.hospitalId,
              hospitalName: localMatch?.hospitalName,
              hospitalUid: localMatch?.hospitalUid,
              hospitalType: localMatch?.hospitalType,
              adminSetupStatus: localMatch?.adminSetupStatus || 'incomplete',
              configuredAdminsCount: localMatch?.configuredAdminsCount || 0,
              pendingInvitesCount: localMatch?.pendingInvitesCount || 0,
            };
          });

          setSubscriptions(backendSubs);

          if (subscriptionIdParam) {
            const match = backendSubs.find((s) => s.id === subscriptionIdParam);
            if (match) setSelectedSubId(match.id);
          } else {
            const firstUnregistered = backendSubs.find((s) => !s.hospitalId);
            if (firstUnregistered) {
              setSelectedSubId(firstUnregistered.id);
            } else if (backendSubs.length > 0) {
              setSelectedSubId(backendSubs[0].id);
            }
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [purchaserId, subscriptionIdParam]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentPurchaser) {
      setErrorMessage('Purchaser authentication required.');
      onNavigate('/account/login');
      return;
    }

    const subIdToUse =
      selectedSubId ||
      subscriptions.find((s) => !s.hospitalId)?.id ||
      subscriptions[0]?.id;

    if (!subIdToUse) {
      setErrorMessage('No available subscription license found to assign. Please purchase a subscription tier first.');
      return;
    }

    setLoading(true);
    hospitalAdminApi
      .registerHospital({
        subscription_id: subIdToUse,
        name: officialName,
        city,
        facility_type: hospitalType,
        address: registeredAddress,
        state,
        country,
        contact_email: officialContactEmail,
        contact_phone: contactPhone,
        website: website || undefined,
        licence_number: licenceNumber || undefined,
      })
      .then((created) => {
        purchaserService.registerHospital(subIdToUse, {
          officialName,
          hospitalType,
          registeredAddress,
          city,
          state,
          country,
          officialContactEmail,
          contactPhone,
          website: website || undefined,
          licenceNumber: licenceNumber || undefined,
        });
        setRegisteredHospital({
          id: created.id,
          hospitalUid: created.hospital_uid,
          officialName: created.name,
          hospitalType: (created.facility_type as any) || hospitalType,
          registeredAddress,
          city: created.city,
          state: created.state || state,
          country: created.country || country,
          officialContactEmail,
          contactPhone,
          website: website || undefined,
          licenceNumber: licenceNumber || undefined,
          subscriptionId: subIdToUse,
          purchaserId: currentPurchaser.id,
          registeredAt: created.created_at,
          isVerified: true,
        });
      })
      .catch((err: any) => {
        setErrorMessage(err.message || 'Hospital registration failed.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  if (!currentPurchaser) return null;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col justify-between selection:bg-emerald-500 selection:text-white font-sans relative overflow-hidden">
      {/* Background Soft Atmospheric Radiance */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-teal-500/5 via-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Enterprise Header */}
      <PurchaserNavbar currentPath="/account/hospital-registration" onNavigate={onNavigate} />

      {/* Main Flow Canvas */}
      <main className="relative z-10 flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col justify-center font-sans">
        {/* SUCCESS STATE */}
        {registeredHospital ? (
          <div className="w-full">
            {/* Centered Heading in Established Editorial Style */}
            <div className="text-center max-w-5xl mx-auto mb-10 sm:mb-12">
              <div className="flex items-center justify-center gap-4 mb-4 sm:mb-5">
                <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
                <span className="text-xs sm:text-sm font-mono font-semibold text-slate-600 uppercase tracking-[0.25em]">
                  FACILITY PROVISIONED
                </span>
                <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-serif font-normal text-slate-950 tracking-[-0.02em] leading-[1.12]">
                Hospital UID <span className="text-[#1A6865] font-serif font-medium">Generated</span>
              </h1>

              <p className="mt-5 text-base sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed w-full max-w-xl md:max-w-2xl mx-auto px-4 sm:px-0">
                Your hospital facility has been successfully registered and linked to your subscription.
              </p>
            </div>

            {/* Unified Card Container */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-lg overflow-hidden transition-all max-w-3xl mx-auto w-full">
              <div className="p-8 sm:p-12 max-w-xl mx-auto w-full text-center">
                {/* Generated Official UID Box */}
                <div className="p-7 sm:p-8 rounded-2xl bg-teal-50/70 border border-teal-200/90 text-center shadow-xs">
                  <span className="text-xs font-mono uppercase tracking-[0.2em] text-teal-800 font-bold block mb-2">
                    Official Hospital UID
                  </span>
                  <div className="font-mono text-3xl sm:text-4xl font-bold tracking-wider text-slate-950 select-all">
                    {registeredHospital.hospitalUid}
                  </div>
                </div>

                {/* Facility Summary Breakdown */}
                <div className="mt-6 p-6 rounded-2xl bg-slate-50/80 border border-slate-200/90 text-sm space-y-3 text-left">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Official Name:</span>
                    <span className="font-bold text-slate-950">{registeredHospital.officialName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Facility Type:</span>
                    <span className="font-semibold text-slate-900">{registeredHospital.hospitalType}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 font-medium">Location:</span>
                    <span className="font-semibold text-slate-900">
                      {registeredHospital.city}, {registeredHospital.country}
                    </span>
                  </div>
                </div>

                {/* Actions: Primary action */}
                <div className="mt-8 flex items-center justify-center">
                  <button
                    onClick={() =>
                      onNavigate(
                        `/account/hospital-setup?subscriptionId=${encodeURIComponent(
                          registeredHospital.subscriptionId
                        )}`
                      )
                    }
                    className="no-hover-lift w-full sm:w-[260px] py-4 px-7 rounded-full text-base font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2.5 shadow-md hover:shadow-native-glow cursor-pointer font-sans tracking-wide shrink-0 whitespace-nowrap"
                  >
                    <span>Configure Administrators</span>
                    <ArrowRight className="w-4.5 h-4.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* Connected Lower Dock: Footnote */}
              <div className="bg-slate-50/80 border-t border-slate-200/80 px-7 sm:px-12 py-7 sm:py-8 text-center">
                <p className="italic text-xs sm:text-[13.5px] text-slate-600 leading-normal">
                  &ldquo;Licensing and provisioning multi-facility hospital infrastructure used to take fiscal quarters. With AURA, our health network was fully operational in minutes.&rdquo;
                  <strong className="text-slate-900 font-semibold not-italic ml-2">&mdash; Victoria Sterling, VP of Health Informatics &amp; Procurement</strong>
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* REGISTRATION FORM STATE */
          <div className="w-full">
            {/* Header: Centered Brand Title & Context matching Pricing Page / Enterprise Sign-In */}
            <div className="text-center max-w-5xl xl:max-w-6xl mx-auto mb-10 sm:mb-12">
              {/* Overline with flanking accent hairlines, exactly like Solution Alignment on Pricing Page */}
              <div className="flex items-center justify-center gap-4 mb-4 sm:mb-5">
                <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
                <span className="text-xs sm:text-sm font-mono font-semibold text-slate-600 uppercase tracking-[0.25em]">
                  HOSPITAL ONBOARDING
                </span>
                <div className="h-[1.5px] w-12 sm:w-16 bg-slate-300" />
              </div>

              {/* Heading in editorial serif style matching Pricing & Enterprise Registration */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-serif font-normal text-slate-950 tracking-[-0.02em] leading-[1.12]">
                <span className="text-[#1A6865] font-serif font-medium">Register</span> Hospital Facility
              </h1>

              {/* Supporting description with generous, relaxed typography */}
              <p className="mt-5 text-base sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed w-full max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-0">
                Link your active subscription to an official hospital or clinic entity and generate its unique Hospital UID.
              </p>
            </div>

            {/* Unified Integrated Container: Form + Docked Footnote (Matching Enterprise Create Account Page) */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-lg overflow-hidden transition-all max-w-5xl mx-auto w-full">
              <div className="px-6 sm:px-10 lg:px-12 pt-10 sm:pt-12 pb-8 sm:pb-10 max-w-4xl mx-auto w-full">
                {/* Step indicator */}
                <div className="mb-6 flex items-center justify-end">
                  <span className="text-xs font-mono text-slate-400">Step 1 of 2: Facility Identification</span>
                </div>

                {errorMessage && (
                  <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-[13px] flex items-start gap-2.5">
                    <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Form starts directly with entering details */}
                <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                    {/* Official Hospital Name (Full Width) */}
                    <div className="sm:col-span-2">
                      <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                        Official Hospital / Institution Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={officialName}
                          onChange={(e) => setOfficialName(e.target.value)}
                          placeholder="e.g. St. Jude Metropolitan Hospital"
                          className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                        />
                        <Building2 className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Hospital Facility Type */}
                    <div>
                      <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                        Hospital Facility Type <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={hospitalType}
                          onChange={(e) => setHospitalType(e.target.value as HospitalType)}
                          className="w-full pl-11 pr-10 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900 appearance-none cursor-pointer"
                        >
                          {HOSPITAL_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <Building2 className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <ChevronDown className="w-4.5 h-4.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Licence / Accreditation Number */}
                    <div>
                      <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                        Licence / Accreditation Number <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={licenceNumber}
                          onChange={(e) => setLicenceNumber(e.target.value)}
                          placeholder="e.g. HSP-LIC-2026-9042"
                          className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900 font-mono"
                        />
                        <FileText className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Registered Physical Address (Full Width) */}
                    <div className="sm:col-span-2">
                      <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                        Registered Physical Address <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={registeredAddress}
                          onChange={(e) => setRegisteredAddress(e.target.value)}
                          placeholder="Street address, building number, medical campus wing"
                          className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                        />
                        <MapPin className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* City */}
                    <div>
                      <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                        City <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="City"
                          className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                        />
                        <MapPin className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* State / Province */}
                    <div>
                      <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                        State / Province <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          placeholder="State or Region"
                          className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                        />
                        <MapPin className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Country */}
                    <div>
                      <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                        Country <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          placeholder="Country (e.g. United States, India)"
                          className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                        />
                        <Globe className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Official Contact Phone */}
                    <div>
                      <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                        Official Contact Phone <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                        />
                        <Phone className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Official Administrative Email */}
                    <div>
                      <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                        Official Administrative Email <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={officialContactEmail}
                          onChange={(e) => setOfficialContactEmail(e.target.value)}
                          placeholder="contact@hospital.org"
                          className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                        />
                        <Mail className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Public Website URL */}
                    <div>
                      <label className="block text-sm sm:text-[14.5px] font-semibold text-slate-800 mb-2">
                        Public Website URL <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="url"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                          placeholder="https://www.hospital.org"
                          className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-[15px] rounded-xl border border-slate-300 focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 bg-white transition-all text-slate-900"
                        />
                        <Globe className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Submission Row */}
                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs sm:text-[13px] text-slate-500 font-normal">
                      Upon submission, a unique, immutable Hospital UID will be generated immediately.
                    </p>

                    <button
                      type="submit"
                      disabled={loading}
                      className="no-hover-lift w-full sm:w-auto py-4 px-8 rounded-full text-base sm:text-[17px] font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer disabled:opacity-50 font-sans tracking-wide shrink-0 whitespace-nowrap"
                    >
                      <span>{loading ? 'Registering...' : 'Register Hospital & Generate UID'}</span>
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Connected Lower Dock: Institutional Security Footnote */}
              <div className="bg-slate-50/80 border-t border-slate-200/80 px-7 sm:px-12 py-7 sm:py-8 text-center">
                <p className="italic text-xs sm:text-[13.5px] text-slate-600 leading-normal">
                  "Each registered facility is provisioned with an isolated clinical tenant and immutable Hospital UID."
                  <strong className="text-slate-900 font-semibold not-italic ml-2">— Institutional Security Standard</strong>
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Subtle Bottom Footer Strip matching Login & Dashboard */}
      <footer className="relative z-10 w-full max-w-[1536px] mx-auto px-6 sm:px-10 lg:px-14 py-6 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>© 2026 AURA Health Systems Inc.</span>
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
