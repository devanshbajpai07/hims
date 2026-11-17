/**
 * HIMS Multi-Hospital Subscription & Purchaser Service
 * 
 * Clean service abstraction using client-side mock persistence.
 * Ready for future FastAPI & PostgreSQL backend integration.
 */

import {
  PurchaserAccount,
  SubscriptionRecord,
  HospitalRecord,
  HospitalRegistrationData,
  SubscriptionPlanId,
  SimulatedPaymentResult,
} from '../types/subscription';
import { SUBSCRIPTION_PLANS } from '../data/subscriptionPlans';

const STORAGE_KEYS = {
  CURRENT_PURCHASER: 'hims_purchaser_session',
  PURCHASERS: 'hims_purchasers_db',
  SUBSCRIPTIONS: 'hims_subscriptions_db',
  HOSPITALS: 'hims_hospitals_db',
  OTP_STORE: 'hims_purchaser_otps',
};

interface StoredPurchaser extends PurchaserAccount {
  passwordHash: string; // Stored for mock verification in dev
}

interface StoredOTP {
  email: string;
  code: string;
  expiresAt: number;
  resendAvailableAt: number;
}

class MemoryStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
}

const memoryStorage = new MemoryStorage();

function getStorage() {
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    return window.sessionStorage;
  }
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  return memoryStorage;
}

class PurchaserService {
  constructor() {
    this.initSeedData();
  }

  private initSeedData() {
    const storage = getStorage();
    if (!storage.getItem(STORAGE_KEYS.PURCHASERS)) {
      storage.setItem(STORAGE_KEYS.PURCHASERS, JSON.stringify([]));
    }
    if (!storage.getItem(STORAGE_KEYS.SUBSCRIPTIONS)) {
      storage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify([]));
    }
    if (!storage.getItem(STORAGE_KEYS.HOSPITALS)) {
      storage.setItem(STORAGE_KEYS.HOSPITALS, JSON.stringify([]));
    }
  }

  private getPurchasers(): StoredPurchaser[] {
    const storage = getStorage();
    const raw = storage.getItem(STORAGE_KEYS.PURCHASERS);
    return raw ? JSON.parse(raw) : [];
  }

  private savePurchasers(purchasers: StoredPurchaser[]) {
    getStorage().setItem(STORAGE_KEYS.PURCHASERS, JSON.stringify(purchasers));
  }

  private getSubscriptions(): SubscriptionRecord[] {
    const storage = getStorage();
    const raw = storage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
    return raw ? JSON.parse(raw) : [];
  }

  private saveSubscriptions(subs: SubscriptionRecord[]) {
    getStorage().setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subs));
  }

  private getHospitals(): HospitalRecord[] {
    const storage = getStorage();
    const raw = storage.getItem(STORAGE_KEYS.HOSPITALS);
    return raw ? JSON.parse(raw) : [];
  }

  private saveHospitals(hospitals: HospitalRecord[]) {
    getStorage().setItem(STORAGE_KEYS.HOSPITALS, JSON.stringify(hospitals));
  }

  private getOtpStore(): Record<string, StoredOTP> {
    const storage = getStorage();
    const raw = storage.getItem(STORAGE_KEYS.OTP_STORE);
    return raw ? JSON.parse(raw) : {};
  }

  private saveOtpStore(store: Record<string, StoredOTP>) {
    getStorage().setItem(STORAGE_KEYS.OTP_STORE, JSON.stringify(store));
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATION METHODS
  // --------------------------------------------------------------------------

  getCurrentPurchaser(): PurchaserAccount | null {
    let raw: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        raw = window.sessionStorage?.getItem(STORAGE_KEYS.CURRENT_PURCHASER) ||
              window.localStorage?.getItem(STORAGE_KEYS.CURRENT_PURCHASER) ||
              null;
      } catch {}
    }
    if (!raw) {
      raw = getStorage().getItem(STORAGE_KEYS.CURRENT_PURCHASER);
    }
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  setCurrentPurchaser(purchaser: PurchaserAccount | null) {
    if (purchaser) {
      const serialized = JSON.stringify(purchaser);
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage?.setItem(STORAGE_KEYS.CURRENT_PURCHASER, serialized);
          window.localStorage?.setItem(STORAGE_KEYS.CURRENT_PURCHASER, serialized);
        } catch {}
      }
      memoryStorage.setItem(STORAGE_KEYS.CURRENT_PURCHASER, serialized);
    } else {
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage?.removeItem(STORAGE_KEYS.CURRENT_PURCHASER);
          window.localStorage?.removeItem(STORAGE_KEYS.CURRENT_PURCHASER);
        } catch {}
      }
      memoryStorage.removeItem(STORAGE_KEYS.CURRENT_PURCHASER);
    }
  }

  registerPurchaser(payload: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): { purchaserId: string; email: string; devOtp: string; message: string } {
    const { fullName, email, password, confirmPassword } = payload;

    if (!fullName.trim() || !email.trim() || !password) {
      throw new Error('All registration fields are required.');
    }
    if (!email.includes('@') || !email.includes('.')) {
      throw new Error('Please provide a valid work email address.');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    const normEmail = email.trim().toLowerCase();
    const purchasers = this.getPurchasers();
    if (purchasers.some((p) => p.email.toLowerCase() === normEmail)) {
      throw new Error('A purchaser account with this email address already exists. Please log in.');
    }

    const newPurchaser: StoredPurchaser = {
      id: 'purch-' + Math.random().toString(36).substring(2, 10),
      fullName: fullName.trim(),
      email: normEmail,
      isEmailVerified: false,
      createdAt: new Date().toISOString(),
      passwordHash: password,
    };

    purchasers.push(newPurchaser);
    this.savePurchasers(purchasers);

    // Generate 6-digit dev OTP
    const devOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const otpStore = this.getOtpStore();
    otpStore[normEmail] = {
      email: normEmail,
      code: devOtp,
      expiresAt: now + 10 * 60 * 1000,
      resendAvailableAt: now + 60 * 1000,
    };
    this.saveOtpStore(otpStore);

    return {
      purchaserId: newPurchaser.id,
      email: normEmail,
      devOtp,
      message: `Simulated verification code dispatched to ${normEmail}. (Dev OTP: ${devOtp})`,
    };
  }

  resendPurchaserOTP(email: string): { devOtp: string; resendAvailableInSeconds: number; message: string } {
    const normEmail = email.trim().toLowerCase();
    const otpStore = this.getOtpStore();
    const now = Date.now();

    const existing = otpStore[normEmail];
    if (existing && now < existing.resendAvailableAt) {
      const waitSec = Math.ceil((existing.resendAvailableAt - now) / 1000);
      throw new Error(`Please wait ${waitSec}s before requesting another verification code.`);
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[normEmail] = {
      email: normEmail,
      code: newOtp,
      expiresAt: now + 10 * 60 * 1000,
      resendAvailableAt: now + 60 * 1000,
    };
    this.saveOtpStore(otpStore);

    return {
      devOtp: newOtp,
      resendAvailableInSeconds: 60,
      message: `A fresh verification code has been dispatched. (Dev OTP: ${newOtp})`,
    };
  }

  verifyPurchaserEmail(email: string, otp: string): { purchaser: PurchaserAccount; message: string } {
    const normEmail = email.trim().toLowerCase();
    const otpStore = this.getOtpStore();
    const record = otpStore[normEmail];

    if (!record) {
      throw new Error('Verification session not found or expired. Please request a new code.');
    }
    if (Date.now() > record.expiresAt) {
      throw new Error('Verification code has expired. Please request a fresh code.');
    }
    if (record.code !== otp.trim()) {
      throw new Error('Invalid verification code. Please enter the 6-digit code shown.');
    }

    // Mark verified
    const purchasers = this.getPurchasers();
    const p = purchasers.find((x) => x.email.toLowerCase() === normEmail);
    if (!p) {
      throw new Error('Purchaser account record not found.');
    }

    p.isEmailVerified = true;
    this.savePurchasers(purchasers);

    const safePurchaser: PurchaserAccount = {
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      isEmailVerified: true,
      createdAt: p.createdAt,
    };

    // Auto-login
    this.setCurrentPurchaser(safePurchaser);
    delete otpStore[normEmail];
    this.saveOtpStore(otpStore);

    return {
      purchaser: safePurchaser,
      message: 'Email address verified successfully. Welcome to your Purchaser Portal.',
    };
  }

  loginPurchaser(email: string, password: string): { purchaser: PurchaserAccount; message: string } {
    if (!email.trim() || !password) {
      throw new Error('Please enter both email address and password.');
    }

    const normEmail = email.trim().toLowerCase();
    const purchasers = this.getPurchasers();
    const p = purchasers.find((x) => x.email.toLowerCase() === normEmail);

    if (!p || p.passwordHash !== password) {
      throw new Error('Invalid email address or password.');
    }

    if (!p.isEmailVerified) {
      // Re-trigger OTP
      this.resendPurchaserOTP(normEmail);
      const err: any = new Error('Please verify your email address before logging in.');
      err.requiresVerification = true;
      err.email = normEmail;
      throw err;
    }

    const safePurchaser: PurchaserAccount = {
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      isEmailVerified: true,
      createdAt: p.createdAt,
    };

    this.setCurrentPurchaser(safePurchaser);

    return {
      purchaser: safePurchaser,
      message: `Welcome back, ${p.fullName}.`,
    };
  }

  logoutPurchaser() {
    this.setCurrentPurchaser(null);
  }

  // --------------------------------------------------------------------------
  // SUBSCRIPTION & CHECKOUT METHODS
  // --------------------------------------------------------------------------

  getPurchaserSubscriptions(purchaserId?: string): SubscriptionRecord[] {
    const pid = purchaserId || this.getCurrentPurchaser()?.id;
    if (!pid) return [];
    return this.getSubscriptions().filter((s) => s.purchaserId === pid);
  }

  getSubscriptionById(subscriptionId: string): SubscriptionRecord | null {
    return this.getSubscriptions().find((s) => s.id === subscriptionId) || null;
  }

  simulatePayment(planId: SubscriptionPlanId, shouldSucceed: boolean = true): SimulatedPaymentResult {
    const timestamp = new Date().toISOString();
    if (!shouldSucceed) {
      return {
        success: false,
        errorMessage: 'Simulated payment was declined by the test processing gateway. (Code: SIM_CARD_DECLINED)',
        timestamp,
      };
    }

    return {
      success: true,
      transactionId: 'TX-SIM-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      timestamp,
    };
  }

  createSubscription(payload: {
    planId: SubscriptionPlanId;
    billingFrequency: 'free' | 'monthly' | 'annual';
    purchaserId?: string;
  }): SubscriptionRecord {
    const purchaser = this.getCurrentPurchaser();
    const pid = payload.purchaserId || purchaser?.id;

    if (!pid) {
      throw new Error('Authentication required to create a subscription.');
    }

    const plan = SUBSCRIPTION_PLANS[payload.planId];
    if (!plan) {
      throw new Error(`Unrecognized plan ID: ${payload.planId}`);
    }

    const newSub: SubscriptionRecord = {
      id: 'sub-' + Math.random().toString(36).substring(2, 10),
      purchaserId: pid,
      planId: plan.id,
      planName: plan.name,
      status: 'active',
      purchasedAt: new Date().toISOString(),
      maxAdministrators: plan.maxAdministrators,
      employeeCapacityText: plan.employeeCapacityText,
      pricePaid: plan.isFree
        ? 'Free ($0)'
        : payload.billingFrequency === 'annual'
        ? (plan.id === 'enterprise' ? '$1499 (annual)' : '$999 (annual)')
        : (plan.id === 'enterprise' ? '$149 (monthly)' : '$99 (monthly)'),
      billingFrequency: payload.billingFrequency,
      adminSetupStatus: 'pending_hospital',
      configuredAdminsCount: 0,
      pendingInvitesCount: 0,
    };

    const subs = this.getSubscriptions();
    subs.unshift(newSub);
    this.saveSubscriptions(subs);

    return newSub;
  }

  // --------------------------------------------------------------------------
  // HOSPITAL REGISTRATION METHODS
  // --------------------------------------------------------------------------

  generateMockHospitalUid(country: string = 'USA'): string {
    const cleanCountry = country.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'HSP';
    const randHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `HSP-${cleanCountry}-${randHex}`;
  }

  registerHospital(
    subscriptionId: string,
    data: HospitalRegistrationData
  ): { hospital: HospitalRecord; subscription: SubscriptionRecord } {
    const purchaser = this.getCurrentPurchaser();
    if (!purchaser) {
      throw new Error('Purchaser authentication required to register a hospital.');
    }

    const subs = this.getSubscriptions();
    const sub = subs.find((s) => s.id === subscriptionId);
    if (!sub) {
      throw new Error('Subscription not found.');
    }
    if (sub.purchaserId !== purchaser.id) {
      throw new Error('You do not own this subscription.');
    }
    if (sub.hospitalId) {
      throw new Error(`This subscription is already linked to hospital: ${sub.hospitalName} (${sub.hospitalUid})`);
    }

    // Required validation
    if (
      !data.officialName.trim() ||
      !data.registeredAddress.trim() ||
      !data.city.trim() ||
      !data.state.trim() ||
      !data.country.trim() ||
      !data.officialContactEmail.trim() ||
      !data.contactPhone.trim()
    ) {
      throw new Error('Please fill in all required hospital contact and location fields.');
    }

    // Generate unique immutable Hospital UID
    const generatedUid = this.generateMockHospitalUid(data.country);

    const newHospital: HospitalRecord = {
      id: 'hosp-' + Math.random().toString(36).substring(2, 10),
      subscriptionId,
      purchaserId: purchaser.id,
      hospitalUid: generatedUid,
      officialName: data.officialName.trim(),
      hospitalType: data.hospitalType,
      registeredAddress: data.registeredAddress.trim(),
      city: data.city.trim(),
      state: data.state.trim(),
      country: data.country.trim(),
      officialContactEmail: data.officialContactEmail.trim().toLowerCase(),
      contactPhone: data.contactPhone.trim(),
      website: data.website?.trim() || undefined,
      licenceNumber: data.licenceNumber?.trim() || undefined,
      registeredAt: new Date().toISOString(),
      isVerified: false,
    };

    // Save hospital
    const hospitals = this.getHospitals();
    hospitals.push(newHospital);
    this.saveHospitals(hospitals);

    // Update subscription
    sub.hospitalId = newHospital.id;
    sub.hospitalName = newHospital.officialName;
    sub.hospitalUid = newHospital.hospitalUid;
    sub.hospitalType = newHospital.hospitalType;
    sub.adminSetupStatus = 'incomplete'; // Hospital registered -> Admin setup unlocked!

    this.saveSubscriptions(subs);

    return { hospital: newHospital, subscription: sub };
  }

  getHospitalById(hospitalId: string): HospitalRecord | null {
    return this.getHospitals().find((h) => h.id === hospitalId) || null;
  }

  getAllHospitals(): HospitalRecord[] {
    return this.getHospitals();
  }

  updatePurchaserName(purchaserId: string, newName: string): PurchaserAccount {
    const purchasers = this.getPurchasers();
    const p = purchasers.find((x) => x.id === purchaserId);
    if (p) {
      p.fullName = newName.trim();
      this.savePurchasers(purchasers);
    }
    const current = this.getCurrentPurchaser();
    if (current && current.id === purchaserId) {
      current.fullName = newName.trim();
      this.setCurrentPurchaser(current);
      return current;
    }
    return p || current!;
  }

  updatePurchaserEmail(purchaserId: string, newEmail: string): PurchaserAccount {
    const purchasers = this.getPurchasers();
    const p = purchasers.find((x) => x.id === purchaserId);
    if (p) {
      p.email = newEmail.trim().toLowerCase();
      this.savePurchasers(purchasers);
    }
    const current = this.getCurrentPurchaser();
    if (current && current.id === purchaserId) {
      current.email = newEmail.trim().toLowerCase();
      this.setCurrentPurchaser(current);
      return current;
    }
    return p || current!;
  }

  setPendingDeletion(purchaserId: string, scheduledAt: string): PurchaserAccount {
    const purchasers = this.getPurchasers();
    const p = purchasers.find((x) => x.id === purchaserId);
    if (p) {
      p.accountStatus = 'pending_deletion';
      p.deletionScheduledAt = scheduledAt;
      this.savePurchasers(purchasers);
    }
    const current = this.getCurrentPurchaser();
    if (current && current.id === purchaserId) {
      current.accountStatus = 'pending_deletion';
      current.deletionScheduledAt = scheduledAt;
      this.setCurrentPurchaser(current);
      return current;
    }
    return p || current!;
  }

  cancelPendingDeletion(purchaserId: string): PurchaserAccount {
    const purchasers = this.getPurchasers();
    const p = purchasers.find((x) => x.id === purchaserId);
    if (p) {
      p.accountStatus = 'active';
      p.deletionScheduledAt = null;
      this.savePurchasers(purchasers);
    }
    const current = this.getCurrentPurchaser();
    if (current && current.id === purchaserId) {
      current.accountStatus = 'active';
      current.deletionScheduledAt = null;
      this.setCurrentPurchaser(current);
      return current;
    }
    return p || current!;
  }
}

export const purchaserService = new PurchaserService();

