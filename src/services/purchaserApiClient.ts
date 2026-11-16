/**
 * AURA HIMS — Typed Purchaser API Client
 * 
 * Provides persistent HTTP communication with FastAPI backend endpoints (/api/v1/purchaser/auth).
 * Uses credentials: 'include' for secure HttpOnly cookie session management and double-submit CSRF protection.
 */

export interface PurchaserProfile {
  id: string;
  fullName: string;
  email: string;
  isEmailVerified: boolean;
  accountStatus: string;
  createdAt: string;
  lastLoginAt?: string | null;
  deletionScheduledAt?: string | null;
}

export interface BackendSubscriptionDetail {
  subscription: {
    id: string;
    purchaser_id: string;
    plan_code: 'BASIC' | 'PRO' | 'ULTRA';
    status: string;
    billing_interval: string;
    auto_renew: boolean;
    starts_at: string;
    current_period_starts_at: string;
    current_period_ends_at: string;
    cancelled_at?: string | null;
    created_at: string;
    updated_at: string;
  };
  entitlements: {
    plan_code: string;
    display_name: string;
    max_administrators: number;
    max_employees: number;
    features: string[];
    description: string;
  };
  is_active: boolean;
  is_expired: boolean;
}

export interface BackendSubscriptionListResponse {
  subscriptions: BackendSubscriptionDetail[];
  total: number;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterResponse {
  purchaser_id: string;
  email: string;
  message: string;
  dev_otp?: string;
}

export interface VerifyEmailPayload {
  email: string;
  otp: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberDevice?: boolean;
}

export interface AuthSuccessResponse {
  purchaser: {
    id: string;
    full_name: string;
    email: string;
    is_email_verified: boolean;
    account_status: string;
    created_at: string;
    last_login_at: string | null;
  };
  csrf_token: string;
  message: string;
}

const API_PREFIX = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL
  ? String((import.meta as any).env.VITE_API_URL).replace(/\/$/, '')
  : '');

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

class PurchaserApiClient {
  private csrfToken: string | null = null;
  private currentPurchaserCache: PurchaserProfile | null = null;

  constructor() {
    this.csrfToken = getCookie('hims_purchaser_csrf');
  }

  setCsrfToken(token: string) {
    this.csrfToken = token;
  }

  getCsrfToken(): string | null {
    return this.csrfToken || getCookie('hims_purchaser_csrf');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const csrf = this.getCsrfToken();
    if (csrf && options.method && options.method !== 'GET' && options.method !== 'HEAD') {
      headers['X-CSRF-Token'] = csrf;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_PREFIX}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    let data: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      const errorMsg = data?.detail || data?.message || `Request failed with status ${response.status}`;
      const error: any = new Error(errorMsg);
      error.status = response.status;
      error.code = data?.code;
      error.data = data;
      throw error;
    }

    return data as T;
  }

  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    return this.request<RegisterResponse>('/api/v1/purchaser/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: payload.fullName,
        email: payload.email,
        password: payload.password,
        confirm_password: payload.confirmPassword,
      }),
    });
  }

  async verifyEmail(payload: VerifyEmailPayload): Promise<AuthSuccessResponse> {
    const res = await this.request<AuthSuccessResponse>('/api/v1/purchaser/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email,
        otp: payload.otp,
      }),
    });

    if (res.csrf_token) {
      this.setCsrfToken(res.csrf_token);
    }
    this.currentPurchaserCache = {
      id: res.purchaser.id,
      fullName: res.purchaser.full_name,
      email: res.purchaser.email,
      isEmailVerified: res.purchaser.is_email_verified,
      accountStatus: res.purchaser.account_status,
      createdAt: res.purchaser.created_at,
      lastLoginAt: res.purchaser.last_login_at,
    };

    return res;
  }

  async resendOTP(email: string): Promise<{ email: string; message: string; dev_otp?: string }> {
    return this.request('/api/v1/purchaser/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async login(payload: LoginPayload): Promise<AuthSuccessResponse> {
    const res = await this.request<AuthSuccessResponse>('/api/v1/purchaser/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        remember_device: payload.rememberDevice ?? true,
      }),
    });

    if (res.csrf_token) {
      this.setCsrfToken(res.csrf_token);
    }
    this.currentPurchaserCache = {
      id: res.purchaser.id,
      fullName: res.purchaser.full_name,
      email: res.purchaser.email,
      isEmailVerified: res.purchaser.is_email_verified,
      accountStatus: res.purchaser.account_status,
      createdAt: res.purchaser.created_at,
      lastLoginAt: res.purchaser.last_login_at,
    };

    return res;
  }

  async logout(): Promise<{ message: string }> {
    try {
      const res = await this.request<{ message: string }>('/api/v1/purchaser/auth/logout', {
        method: 'POST',
      });
      this.currentPurchaserCache = null;
      this.csrfToken = null;
      return res;
    } catch (e) {
      this.currentPurchaserCache = null;
      this.csrfToken = null;
      throw e;
    }
  }

  async getMe(): Promise<PurchaserProfile> {
    const res = await this.request<{
      id: string;
      full_name: string;
      email: string;
      is_email_verified: boolean;
      account_status: string;
      created_at: string;
      last_login_at: string | null;
    }>('/api/v1/purchaser/auth/me', {
      method: 'GET',
    });

    const profile: PurchaserProfile = {
      id: res.id,
      fullName: res.full_name,
      email: res.email,
      isEmailVerified: res.is_email_verified,
      accountStatus: res.account_status,
      createdAt: res.created_at,
      lastLoginAt: res.last_login_at,
    };
    this.currentPurchaserCache = profile;
    return profile;
  }

  async forgotPassword(email: string): Promise<{ message: string; dev_reset_token?: string; dev_reset_link?: string }> {
    return this.request('/api/v1/purchaser/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string, confirmNewPassword: string): Promise<{ message: string }> {
    return this.request('/api/v1/purchaser/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      }),
    });
  }

  async changePassword(currentPassword: string, newPassword: string, confirmNewPassword: string): Promise<{ message: string }> {
    return this.request('/api/v1/purchaser/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      }),
    });
  }

  async updateName(fullName: string): Promise<PurchaserProfile> {
    const res = await this.request<{
      id: string;
      full_name: string;
      email: string;
      is_email_verified: boolean;
      account_status: string;
      created_at: string;
      last_login_at: string | null;
      deletion_scheduled_at: string | null;
    }>('/api/v1/purchaser/auth/name', {
      method: 'PUT',
      body: JSON.stringify({ full_name: fullName }),
    });

    const profile: PurchaserProfile = {
      id: res.id,
      fullName: res.full_name,
      email: res.email,
      isEmailVerified: res.is_email_verified,
      accountStatus: res.account_status,
      createdAt: res.created_at,
      lastLoginAt: res.last_login_at,
      deletionScheduledAt: res.deletion_scheduled_at,
    };
    this.currentPurchaserCache = profile;
    return profile;
  }

  async requestEmailChangeOTP(newEmail: string): Promise<{
    current_email: string;
    proposed_email: string;
    message: string;
    dev_otp?: string;
  }> {
    return this.request('/api/v1/purchaser/auth/email/request-otp', {
      method: 'POST',
      body: JSON.stringify({ new_email: newEmail }),
    });
  }

  async confirmEmailChangeOTP(newEmail: string, otp: string): Promise<PurchaserProfile> {
    const res = await this.request<{
      id: string;
      full_name: string;
      email: string;
      is_email_verified: boolean;
      account_status: string;
      created_at: string;
      last_login_at: string | null;
      deletion_scheduled_at: string | null;
    }>('/api/v1/purchaser/auth/email/confirm-otp', {
      method: 'POST',
      body: JSON.stringify({ new_email: newEmail, otp }),
    });

    const profile: PurchaserProfile = {
      id: res.id,
      fullName: res.full_name,
      email: res.email,
      isEmailVerified: res.is_email_verified,
      accountStatus: res.account_status,
      createdAt: res.created_at,
      lastLoginAt: res.last_login_at,
      deletionScheduledAt: res.deletion_scheduled_at,
    };
    this.currentPurchaserCache = profile;
    return profile;
  }

  async scheduleAccountDeletion(password: string, reason?: string): Promise<{
    status: string;
    scheduled_deletion_at: string;
    affected_admins_notified: number;
    message: string;
  }> {
    const res = await this.request<{
      status: string;
      scheduled_deletion_at: string;
      affected_admins_notified: number;
      message: string;
    }>('/api/v1/purchaser/auth/schedule-deletion', {
      method: 'POST',
      body: JSON.stringify({ password, reason }),
    });

    if (this.currentPurchaserCache) {
      this.currentPurchaserCache.accountStatus = 'pending_deletion';
      this.currentPurchaserCache.deletionScheduledAt = res.scheduled_deletion_at;
    }
    return res;
  }

  async cancelAccountDeletion(): Promise<{ status: string; message: string }> {
    const res = await this.request<{ status: string; message: string }>('/api/v1/purchaser/auth/cancel-deletion', {
      method: 'POST',
    });

    if (this.currentPurchaserCache) {
      this.currentPurchaserCache.accountStatus = 'active';
      this.currentPurchaserCache.deletionScheduledAt = null;
    }
    return res;
  }

  async listSubscriptions(): Promise<BackendSubscriptionListResponse> {
    return this.request<BackendSubscriptionListResponse>('/api/v1/purchaser/subscriptions', {
      method: 'GET',
    });
  }

  async createSubscription(payload: { planCode: string; billingInterval: string }): Promise<BackendSubscriptionDetail> {
    return this.request<BackendSubscriptionDetail>('/api/v1/purchaser/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        plan_code: payload.planCode,
        billing_interval: payload.billingInterval,
      }),
    });
  }

  async getSubscriptionDetail(subscriptionId: string): Promise<BackendSubscriptionDetail> {
    return this.request<BackendSubscriptionDetail>(`/api/v1/purchaser/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'GET',
    });
  }

  getCachedPurchaser(): PurchaserProfile | null {
    return this.currentPurchaserCache;
  }
}

export const purchaserApiClient = new PurchaserApiClient();

