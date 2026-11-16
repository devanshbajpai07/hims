export type SubscriptionPlanId = 'basic' | 'pro' | 'enterprise';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  priceDisplay: string;
  priceSubtext: string;
  isFree: boolean;
  isCustom: boolean;
  maxAdministrators: number;
  employeeCapacityText: string;
  employeeCapacityNumber: number;
  departmentsText: string;
  rolesText: string;
  customizationText: string;
  supportLevelText: string;
  features: string[];
  ctaText: string;
  popular?: boolean;
}

export interface PurchaserAccount {
  id: string;
  fullName: string;
  email: string;
  isEmailVerified: boolean;
  createdAt: string;
  accountStatus?: string;
  lastLoginAt?: string | null;
  deletionScheduledAt?: string | null;
}

export type SubscriptionStatus = 'active' | 'pending' | 'expired';

export type AdminSetupStatus =
  | 'pending_hospital'
  | 'incomplete'
  | 'invitations_sent'
  | 'completed';

export interface SubscriptionRecord {
  id: string;
  purchaserId: string;
  planId: SubscriptionPlanId;
  planName: string;
  status: SubscriptionStatus;
  purchasedAt: string;
  maxAdministrators: number;
  employeeCapacityText: string;
  pricePaid: string;
  billingFrequency: 'free' | 'monthly' | 'annual';
  // Hospital linkage
  hospitalId?: string;
  hospitalName?: string;
  hospitalUid?: string;
  hospitalType?: string;
  // Administrator setup status
  adminSetupStatus: AdminSetupStatus;
  configuredAdminsCount: number;
  pendingInvitesCount: number;
}

export type HospitalType =
  | 'General Hospital'
  | 'Specialty Medical Center'
  | 'Ambulatory Clinic'
  | 'Tertiary Care Facility'
  | 'Academic Medical Center';

export interface HospitalRegistrationData {
  officialName: string;
  hospitalType: HospitalType;
  registeredAddress: string;
  city: string;
  state: string;
  country: string;
  officialContactEmail: string;
  contactPhone: string;
  website?: string;
  licenceNumber?: string;
}

export interface HospitalRecord {
  id: string;
  subscriptionId: string;
  purchaserId: string;
  hospitalUid: string; // e.g. "HSP-IND-8F42K9"
  officialName: string;
  hospitalType: HospitalType;
  registeredAddress: string;
  city: string;
  state: string;
  country: string;
  officialContactEmail: string;
  contactPhone: string;
  website?: string;
  licenceNumber?: string;
  registeredAt: string;
  isVerified: boolean; // Mock registration distinct from accreditation check
}

export interface SimulatedPaymentResult {
  success: boolean;
  transactionId?: string;
  errorMessage?: string;
  timestamp: string;
}

