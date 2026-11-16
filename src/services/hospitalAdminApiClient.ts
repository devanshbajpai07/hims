/**
 * AURA HIMS — Hospital Administrator & Enterprise Management API Client
 * 
 * Provides end-to-end typed communication with FastAPI backend endpoints:
 * - Purchaser Hospital & Administrator Invitation Management (/api/v1/purchaser/hospitals/...)
 * - Administrator Invitation Acceptance & Dedicated Authentication (/api/v1/admin/...)
 * - Hospital Administrator Platform Modules (/api/v1/admin/...)
 */

export interface HospitalSummary {
  id: string;
  hospital_uid: string;
  name: string;
  city: string;
  facility_type?: string | null;
  subscription_id?: string | null;
  plan_code: 'BASIC' | 'PRO' | 'ULTRA';
  plan_name: string;
  active_admins_count: number;
  pending_invites_count: number;
  max_administrators: number;
  max_employees: number;
  is_active: boolean;
  created_at: string;
}

export interface HospitalDetail extends HospitalSummary {
  address?: string | null;
  state?: string | null;
  country?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  licence_number?: string | null;
  subscription_status: string;
  current_period_ends_at?: string | null;
  features: string[];
}

export interface AdminInviteItem {
  id: string;
  hospital_id: string;
  invitee_name: string;
  invitee_email: string;
  invitee_phone?: string | null;
  invitee_designation?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  created_at: string;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
}

export interface ActiveAdminItem {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  username: string;
  employee_uid: string;
  designation?: string | null;
  status: string;
  created_at: string;
  last_login_at?: string | null;
}

export interface HospitalAdministratorsManagementResponse {
  hospital: HospitalDetail;
  active_administrators: ActiveAdminItem[];
  invitations: AdminInviteItem[];
  max_administrators: number;
  remaining_seats: number;
}

export interface RegisterHospitalPayload {
  subscription_id: string;
  name: string;
  city: string;
  facility_type?: string;
  address?: string;
  state?: string;
  country?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  licence_number?: string;
}

export interface InviteAdminPayload {
  invitee_name: string;
  invitee_email: string;
  invitee_phone?: string;
  invitee_designation?: string;
}

export interface EmployeeAssignmentSlot {
  scope_type: 'DEPARTMENT' | 'FACILITY';
  department_id?: string | null;
  role_id: string;
}

export interface PreAuthorizedAssignment {
  scope_type: 'DEPARTMENT' | 'FACILITY';
  department_id?: string | null;
  department_name?: string | null;
  department_code?: string | null;
  role_id: string;
  role_name: string;
  role_code: string;
}

export interface EmployeeInvitePayload {
  email: string;
  full_name: string;
  phone?: string | null;
  designation?: string | null;
  assignments: EmployeeAssignmentSlot[];
}

export interface EmployeeInvitationVerifyResponse {
  valid: boolean;
  hospital_id: string;
  hospital_uid: string;
  hospital_name: string;
  plan_code: 'BASIC' | 'PRO' | 'ULTRA';
  invitee_email: string;
  invitee_name: string;
  invitee_phone?: string | null;
  designation?: string | null;
  assignments: PreAuthorizedAssignment[];
  has_existing_account: boolean;
  existing_username?: string | null;
  suggested_username?: string | null;
  expires_at: string;
}

export interface AcceptEmployeeInvitationPayload {
  token: string;
  username?: string | null;
  password: string;
}

export interface EmployeeInviteItem {
  id: string;
  hospital_id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  designation?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  created_at: string;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  assignments?: PreAuthorizedAssignment[] | null;
}

export interface InvitationVerifyResponse {
  valid: boolean;
  hospital_id: string;
  hospital_uid: string;
  hospital_name: string;
  invitee_name: string;
  invitee_email: string;
  invitee_designation?: string | null;
  expires_at: string;
  plan_code: 'BASIC' | 'PRO' | 'ULTRA';
}

export interface AcceptInvitationPayload {
  token: string;
  password: string;
  username?: string;
  phone?: string;
}

export interface AdminLoginPayload {
  username_or_email: string;
  password: string;
  hospital_id?: string;
  remember_me?: boolean;
}

export interface AdminLoginResponse {
  success: boolean;
  requires_hospital_selection?: boolean;
  available_hospitals?: Array<{
    hospital_id: string;
    hospital_uid: string;
    hospital_name: string;
    plan_code: string;
    plan_name: string;
  }>;
  user?: {
    id: string;
    username: string;
    email: string;
    full_name: string;
  };
  hospital?: {
    id: string;
    hospital_uid: string;
    name: string;
    city: string;
    plan_code: 'BASIC' | 'PRO' | 'ULTRA';
    plan_name: string;
    max_administrators: number;
    max_employees: number;
    features: string[];
  };
  token?: string;
  message: string;
}

export interface AdminOverviewMetrics {
  hospital: {
    id: string;
    hospital_uid: string;
    name: string;
    city: string;
    plan_code: 'BASIC' | 'PRO' | 'ULTRA';
    plan_name: string;
    max_administrators: number;
    max_employees: number;
    features: string[];
  };
  total_employees: number;
  active_employees: number;
  department_count: number;
  active_admin_count: number;
  pending_employee_invites: number;
  pending_registration_requests: number;
  pending_role_requests: number;
  quota_usage: {
    admins_used: number;
    admins_allowed: number;
    employees_used: number;
    employees_allowed: number;
    plan_code: string;
    plan_name: string;
  };
  recent_activity: Array<{
    id: string;
    action: string;
    resource_type: string;
    details?: string | null;
    created_at: string;
  }>;
  important_alerts: Array<{
    id: string;
    title: string;
    message: string;
    category: string;
    created_at: string;
  }>;
}

export interface EmployeeItem {
  id: string; // TenantMembership ID
  user_id: string;
  full_name: string;
  username: string;
  email: string;
  employee_uid: string;
  status: string;
  departments: string[];
  roles: string[];
  is_administrator: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  employee_count: number;
  is_active: boolean;
}

export interface RoleItem {
  id: string;
  name: string;
  code: string;
  scope: string;
  description?: string | null;
  employee_count: number;
  is_active: boolean;
  permission_codes?: string[];
  is_future_scope?: boolean;
  future_scope_notes?: string | null;
}

export interface AuditItem {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  is_read: boolean;
  created_at: string;
}

export interface PermissionItem {
  code: string;
  name: string;
  category: string;
  module: string;
  description?: string | null;
  risk_level: string;
  min_tier: 'BASIC' | 'PRO' | 'ULTRA';
  is_system: boolean;
  is_active: boolean;
  is_tier_permitted: boolean;
  is_deferred?: boolean;
}

export interface PermissionCatalogueResponse {
  hospital_tier: string;
  total_permissions: number;
  permitted_permissions: number;
  permissions: PermissionItem[];
}

export interface RoleVersionItem {
  id: string;
  role_id: string;
  role_name: string;
  role_code: string;
  version_number: number;
  parent_role_id?: string | null;
  parent_role_name?: string | null;
  change_reason?: string | null;
  is_active: boolean;
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  activated_at?: string | null;
  created_at: string;
  permission_codes: string[];
}

export interface CreateRoleVersionPayload {
  permission_codes: string[];
  parent_role_id?: string | null;
  change_reason: string;
}

export interface RoleAssignmentItem {
  id: string;
  membership_id: string;
  department_id?: string | null;
  department_name?: string | null;
  role_id: string;
  role_name: string;
  role_code: string;
  role_version_id?: string | null;
  role_version_number?: number | null;
  assignment_status: string;
  assignment_source: string;
  scope_type: 'DEPARTMENT' | 'MULTI_DEPARTMENT' | 'FACILITY';
  scope_department_ids?: string | null;
  is_active: boolean;
  assigned_at?: string | null;
  activated_at?: string | null;
  revoked_at?: string | null;
}

export interface AssignRolePayload {
  department_id?: string | null;
  role_id: string;
  role_version_id?: string | null;
  scope_type?: 'DEPARTMENT' | 'MULTI_DEPARTMENT' | 'FACILITY';
  scope_department_ids?: string[] | null;
}

export interface PermissionOverrideItem {
  id: string;
  membership_id: string;
  permission_code: string;
  permission_name: string;
  override_type: 'GRANT' | 'DENY';
  department_id?: string | null;
  department_name?: string | null;
  reason: string;
  expires_at?: string | null;
  granted_by_user_id?: string | null;
  granted_by_name?: string | null;
  created_at: string;
}

export interface CreateOverridePayload {
  permission_code: string;
  override_type: 'GRANT' | 'DENY';
  department_id?: string | null;
  reason: string;
  expires_at?: string | null;
}

export interface EffectivePermissionItem {
  code: string;
  name: string;
  category: string;
  module: string;
  is_granted: boolean;
  status: 'GRANTED' | 'DENIED_BY_OVERRIDE' | 'DENIED_BY_TIER' | 'NOT_GRANTED';
  source: string;
  source_role_name?: string | null;
  source_role_version?: number | null;
  department_scope?: string | null;
  reason?: string | null;
  expires_at?: string | null;
  explanation: string;
}

export interface EmployeeEffectivePermissionsResponse {
  membership_id: string;
  employee_name: string;
  employee_uid: string;
  plan_code: string;
  active_assignments_count: number;
  active_overrides_count: number;
  permissions: EffectivePermissionItem[];
}

export interface PendingAssignmentSlot {
  id: string;
  slot_number: number;
  department_id?: string | null;
  department_name?: string | null;
  role_id: string;
  role_name: string;
  role_code: string;
  status: string;
  dept_head_notes?: string | null;
  admin_notes?: string | null;
}

export interface PendingApprovalItem {
  id: string;
  hospital_id: string;
  email: string;
  full_name: string;
  employee_uid_claim: string;
  employee_uid_verified: boolean;
  status: string;
  created_at: string;
  assignment_requests: PendingAssignmentSlot[];
}

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL
  ? String((import.meta as any).env.VITE_API_URL).replace(/\/$/, '')
  : '') + '/api/v1';

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)hims_purchaser_csrf=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const adminToken = window.sessionStorage?.getItem('hims_admin_token') || window.localStorage?.getItem('hims_admin_token');
    if (adminToken) return adminToken;

    const empRaw = window.sessionStorage?.getItem('hims_employee_session') || window.localStorage?.getItem('hims_employee_session');
    if (empRaw) {
      const parsed = JSON.parse(empRaw);
      if (parsed?.token) return parsed.token;
    }

    const purchToken = window.sessionStorage?.getItem('hims_purchaser_token') || window.localStorage?.getItem('hims_purchaser_token');
    if (purchToken) return purchToken;
  } catch {}
  return null;
}

class HospitalAdminApiClient {
  private adminToken: string | null = null;

  getAdminToken(): string | null {
    return this.adminToken || getStoredToken();
  }

  setAdminToken(token: string | null, remember: boolean = true) {
    this.adminToken = token;
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          window.sessionStorage?.setItem('hims_admin_token', token);
          if (remember) {
            window.localStorage?.setItem('hims_admin_token', token);
          }
        } else {
          window.sessionStorage?.removeItem('hims_admin_token');
          window.localStorage?.removeItem('hims_admin_token');
        }
      } catch {}
    }
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;

    const token = this.getAdminToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // ==========================================
  // Purchaser Hospital Management
  // ==========================================

  async registerHospital(payload: RegisterHospitalPayload): Promise<HospitalDetail> {
    const res = await fetch(`${API_BASE}/purchaser/hospitals/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to register hospital facility.');
    }
    return res.json();
  }

  async listPurchaserHospitals(): Promise<HospitalSummary[]> {
    const res = await fetch(`${API_BASE}/purchaser/hospitals`, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to retrieve hospital facilities.');
    }
    return res.json();
  }

  async getHospitalManagement(hospitalId: string): Promise<HospitalAdministratorsManagementResponse> {
    const res = await fetch(`${API_BASE}/purchaser/hospitals/${hospitalId}`, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to retrieve hospital details.');
    }
    return res.json();
  }

  async inviteAdministrator(hospitalId: string, payload: InviteAdminPayload): Promise<AdminInviteItem> {
    const res = await fetch(`${API_BASE}/purchaser/hospitals/${hospitalId}/administrators/invite`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to invite hospital administrator.');
    }
    return res.json();
  }

  async revokeAdministratorInvitation(hospitalId: string, invitationId: string): Promise<AdminInviteItem> {
    const res = await fetch(`${API_BASE}/purchaser/hospitals/${hospitalId}/administrators/invitations/${invitationId}/revoke`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to revoke invitation.');
    }
    return res.json();
  }

  async resendAdministratorInvitation(hospitalId: string, invitationId: string): Promise<AdminInviteItem> {
    const res = await fetch(`${API_BASE}/purchaser/hospitals/${hospitalId}/administrators/invitations/${invitationId}/resend`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to resend invitation.');
    }
    return res.json();
  }

  async removeAdministrator(hospitalId: string, adminId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/purchaser/hospitals/${hospitalId}/administrators/${adminId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to remove administrator.');
    }
    return res.json();
  }

  // ==========================================
  // Administrator Onboarding & Authentication
  // ==========================================

  async verifyInvitationToken(token: string): Promise<InvitationVerifyResponse> {
    const res = await fetch(`${API_BASE}/admin/invitations/verify-token?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Invalid or expired invitation token.');
    }
    return res.json();
  }

  async acceptInvitation(payload: AcceptInvitationPayload): Promise<{ success: boolean; message: string; username: string }> {
    const res = await fetch(`${API_BASE}/admin/invitations/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to accept administrator invitation.');
    }
    return res.json();
  }

  async loginAdmin(payload: AdminLoginPayload): Promise<AdminLoginResponse> {
    const res = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Authentication failed. Please check your credentials.');
    }
    const data: AdminLoginResponse = await res.json();
    if (data.token) {
      this.setAdminToken(data.token, payload.remember_me ?? true);
    }
    return data;
  }

  async logoutAdmin(): Promise<void> {
    try {
      await fetch(`${API_BASE}/admin/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include',
      });
    } catch {}
    this.setAdminToken(null);
  }

  async getAdminMe(): Promise<{ user: any; hospital: any }> {
    const res = await fetch(`${API_BASE}/admin/auth/me`, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Unauthenticated');
    }
    return res.json();
  }

  // ==========================================
  // Administrator Platform Modules
  // ==========================================

  async getOverview(): Promise<AdminOverviewMetrics> {
    const res = await fetch(`${API_BASE}/admin/dashboard/overview`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load dashboard overview.');
    }
    return res.json();
  }

  async listEmployees(search?: string, departmentId?: string, status?: string): Promise<EmployeeItem[]> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (departmentId) params.set('department_id', departmentId);
    if (status) params.set('status', status);

    const res = await fetch(`${API_BASE}/admin/employees?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load employee list.');
    }
    return res.json();
  }

  async inviteEmployee(payload: EmployeeInvitePayload): Promise<{ success: boolean; message: string; invitation_id?: string }> {
    const res = await fetch(`${API_BASE}/admin/employees/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to invite employee.');
    }
    return res.json();
  }

  async verifyEmployeeInvitation(token: string): Promise<EmployeeInvitationVerifyResponse> {
    const res = await fetch(`${API_BASE}/invitations/employee/verify?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to verify employee invitation.');
    }
    return res.json();
  }

  async acceptEmployeeInvitation(payload: AcceptEmployeeInvitationPayload): Promise<{
    success: boolean;
    message: string;
    user_id: string;
    membership_id: string;
    employee_uid: string;
    hospital_name: string;
  }> {
    const res = await fetch(`${API_BASE}/invitations/employee/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to accept invitation.');
    }
    return res.json();
  }

  async listEmployeeInvitations(status?: string): Promise<EmployeeInviteItem[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${API_BASE}/admin/employees/invitations${q}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to list employee invitations.');
    }
    return res.json();
  }

  async revokeEmployeeInvitation(invitationId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/employees/invitations/${invitationId}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to revoke employee invitation.');
    }
    return res.json();
  }

  async resendEmployeeInvitation(invitationId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/employees/invitations/${invitationId}/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to resend employee invitation.');
    }
    return res.json();
  }

  async updateEmployeeStatus(membershipId: string, status: string, reason?: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/admin/employees/${membershipId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update employee status.');
    }
    return res.json();
  }

  async assignEmployeeRoles(membershipId: string, departmentId: string | undefined, roleIds: string[]): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/admin/employees/${membershipId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ department_id: departmentId, role_ids: roleIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update employee roles.');
    }
    return res.json();
  }

  async listDepartments(): Promise<DepartmentItem[]> {
    const res = await fetch(`${API_BASE}/admin/departments`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load departments.');
    }
    return res.json();
  }

  async createDepartment(payload: { name: string; code: string; description?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create department.');
    }
    return res.json();
  }

  async listRoles(): Promise<RoleItem[]> {
    const res = await fetch(`${API_BASE}/admin/roles`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load roles.');
    }
    return res.json();
  }

  async createRole(payload: { name: string; code: string; scope: string; description?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create role.');
    }
    return res.json();
  }

  async listAuditLogs(action?: string, limit = 50, offset = 0): Promise<AuditItem[]> {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());

    const res = await fetch(`${API_BASE}/admin/audit?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load audit history.');
    }
    return res.json();
  }

  async listNotifications(): Promise<NotificationItem[]> {
    const res = await fetch(`${API_BASE}/admin/notifications`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load notifications.');
    }
    return res.json();
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await fetch(`${API_BASE}/admin/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }).catch(() => {});
  }

  async forgotPassword(identifier: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to dispatch password recovery.');
    }
    return res.json();
  }

  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to reset administrator password.');
    }
    return res.json();
  }

  // =========================================================================
  // RBAC, PERMISSIONS & ROLE VERSIONING
  // =========================================================================

  async listPermissions(): Promise<PermissionCatalogueResponse> {
    const res = await fetch(`${API_BASE}/admin/permissions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load permissions catalogue.');
    }
    return res.json();
  }

  async listRoleVersions(roleId: string): Promise<RoleVersionItem[]> {
    const res = await fetch(`${API_BASE}/admin/roles/${roleId}/versions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load role versions.');
    }
    return res.json();
  }

  async createRoleVersion(roleId: string, payload: CreateRoleVersionPayload): Promise<RoleVersionItem> {
    const res = await fetch(`${API_BASE}/admin/roles/${roleId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create role version.');
    }
    return res.json();
  }

  // =========================================================================
  // EMPLOYEE MULTI-DEPARTMENT ASSIGNMENTS & OVERRIDES
  // =========================================================================

  async listEmployeeAssignments(membershipId: string): Promise<RoleAssignmentItem[]> {
    const res = await fetch(`${API_BASE}/admin/employees/${membershipId}/assignments`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load employee role assignments.');
    }
    return res.json();
  }

  async assignEmployeeRole(membershipId: string, payload: AssignRolePayload): Promise<RoleAssignmentItem> {
    const res = await fetch(`${API_BASE}/admin/employees/${membershipId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to assign employee role.');
    }
    return res.json();
  }

  async revokeEmployeeRoleAssignment(membershipId: string, assignmentId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/employees/${membershipId}/assignments/${assignmentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to revoke role assignment.');
    }
    return res.json();
  }

  async listEmployeeOverrides(membershipId: string): Promise<PermissionOverrideItem[]> {
    const res = await fetch(`${API_BASE}/admin/employees/${membershipId}/overrides`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load permission overrides.');
    }
    return res.json();
  }

  async createEmployeeOverride(membershipId: string, payload: CreateOverridePayload): Promise<PermissionOverrideItem> {
    const res = await fetch(`${API_BASE}/admin/employees/${membershipId}/overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create permission override.');
    }
    return res.json();
  }

  async revokeEmployeeOverride(membershipId: string, overrideId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/employees/${membershipId}/overrides/${overrideId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to revoke permission override.');
    }
    return res.json();
  }

  async getEmployeeEffectivePermissions(membershipId: string, departmentId?: string): Promise<EmployeeEffectivePermissionsResponse> {
    const url = departmentId
      ? `${API_BASE}/admin/employees/${membershipId}/effective-permissions?department_id=${encodeURIComponent(departmentId)}`
      : `${API_BASE}/admin/employees/${membershipId}/effective-permissions`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load effective permissions.');
    }
    return res.json();
  }

  // =========================================================================
  // APPROVALS
  // =========================================================================

  async listPendingApprovals(): Promise<PendingApprovalItem[]> {
    const res = await fetch(`${API_BASE}/admin/approvals`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load pending approvals.');
    }
    return res.json();
  }

  async decideRegistrationApproval(
    requestId: string,
    payload: {
      verify_employee_uid: boolean;
      assignment_decisions: Array<{ assignment_id: string; decision: 'approved' | 'rejected' }>;
      notes?: string;
    }
  ): Promise<{ success: boolean; registration_id: string; status: string; employee_uid_verified: boolean }> {
    const res = await fetch(`${API_BASE}/admin/approvals/${requestId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to record approval decision.');
    }
    return res.json();
  }
}

export const hospitalAdminApi = new HospitalAdminApiClient();
export const hospitalAdminApiClient = hospitalAdminApi;


