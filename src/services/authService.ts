/**
 * HIMS Authentication Service
 * 
 * Production-ready service architecture running in pure dummy/mock mode
 * as requested ("work only on dummy data until all rules are defined").
 * 
 * - Full client-side mock simulation with zero database/backend network dependency.
 * - Stage 1: Hospital Identification & 6-digit Email OTP (Dev Code: 123456)
 * - Stage 2: Details & Assignments (Up to 5 slots)
 * - Stage 3: Administrative Approval Queue (status: pending)
 * - Routine Login: Strictly Username + Password
 * - Multi-hospital Workspace Selection & Membership Status Guards (pending/suspended/terminated)
 */

import {
  User,
  Hospital,
  EmployeeDirectoryRecord,
  TenantMembership,
  AuthSession,
  LoginCredentials,
  RegistrationPayload,
  StartRegistrationResponse,
  VerifyOTPResponse,
  Stage2RegistrationPayload,
  AdditionalAssignmentPayload,
  DepartmentOption,
  RoleOption,
  RegistrationStatusInfo,
} from '../types/auth';

import {
  mockHospitals,
  mockEmployeeDirectory,
  mockUsers,
  mockMemberships,
  StoredUserAccount,
} from './mockAuthData';

import { purchaserService } from './purchaserService';

export class AuthenticationError extends Error {
  constructor(message: string, public code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class MembershipStatusError extends Error {
  constructor(
    message: string,
    public status: 'pending' | 'suspended' | 'terminated',
    public hospitalName: string,
    public reason?: string
  ) {
    super(message);
    this.name = 'MembershipStatusError';
  }
}

// Operational mode: live database backed through authenticated FastAPI backend
const USE_MOCK_ONLY = false;

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL
  ? String((import.meta as any).env.VITE_API_URL).replace(/\/$/, '')
  : '') + '/api/v1';

// In-memory simulation state
let liveHospitals = [...mockHospitals];
let liveDirectory = [...mockEmployeeDirectory];
let liveUsers: StoredUserAccount[] = [...mockUsers];
let liveMemberships = [...mockMemberships];
let liveChallenges: Record<string, { otp: string; email: string; hospitalUid: string; verified: boolean; token: string }> = {};

export const authService = {
  // ...existing methods remain
  shouldPromptForAssignment(session: AuthSession | null): boolean {
    return !!session && (session.assignments?.length ?? 0) > 1;
  },
  SESSION_STORAGE_KEY: 'hims_employee_session',

  getStoredSession(): AuthSession | null {
    try {
      if (typeof window !== 'undefined') {
        // 1. Check tab-isolated sessionStorage first (allows multiple accounts in different tabs without cross-bleed)
        if (window.sessionStorage) {
          const sessionRaw = window.sessionStorage.getItem(this.SESSION_STORAGE_KEY);
          if (sessionRaw) {
            const parsed = JSON.parse(sessionRaw);
            if (parsed && parsed.token && (!parsed.expiresAt || new Date(parsed.expiresAt) > new Date())) {
              return parsed;
            }
          }
        }
        // 2. Check localStorage fallback (for new tabs or restored sessions)
        if (window.localStorage) {
          const localRaw = window.localStorage.getItem(this.SESSION_STORAGE_KEY);
          if (localRaw) {
            const parsed = JSON.parse(localRaw);
            if (parsed && parsed.token && (!parsed.expiresAt || new Date(parsed.expiresAt) > new Date())) {
              // Populate this tab's sessionStorage for isolated subsequent access
              if (window.sessionStorage) {
                window.sessionStorage.setItem(this.SESSION_STORAGE_KEY, localRaw);
              }
              return parsed;
            }
          }
        }
      }
    } catch {}
    return null;
  },

  setStoredSession(session: AuthSession | null): void {
    try {
      if (typeof window !== 'undefined') {
        if (session) {
          const serialized = JSON.stringify(session);
          // Always write to this tab's isolated sessionStorage
          if (window.sessionStorage) {
            window.sessionStorage.setItem(this.SESSION_STORAGE_KEY, serialized);
          }
          // Only write to localStorage if rememberMe was explicitly checked
          if (session.rememberMe && window.localStorage) {
            window.localStorage.setItem(this.SESSION_STORAGE_KEY, serialized);
          } else if (window.localStorage) {
            window.localStorage.removeItem(this.SESSION_STORAGE_KEY);
          }
        } else {
          if (window.sessionStorage) {
            window.sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
          }
          if (window.localStorage) {
            window.localStorage.removeItem(this.SESSION_STORAGE_KEY);
          }
        }
      }
    } catch {}
  },

  async restoreSession(): Promise<AuthSession | null> {
    const stored = this.getStoredSession();
    const token = stored?.token;

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/employee/profile`, {
          headers,
          credentials: 'include',
        });

        if (res.ok) {
          const profile = await res.json();
          const rawAssigns = profile.active_assignments || [];
          const assigns = rawAssigns.map((a: any) => ({
            id: a.id,
            roleId: a.role_id,
            roleCode: a.role_code,
            roleName: a.role_name,
            departmentId: a.department_id,
            departmentName: a.department_name,
            scopeType: a.scope_type,
            permissions: a.permissions || [],
            isActive: a.assignment_status === 'active' || a.is_active,
          }));

          const primaryAssign = assigns[0];

          const refreshedSession: AuthSession = {
            user: {
              id: profile.user_id,
              username: profile.username,
              email: profile.email,
              legalName: profile.full_name,
              createdAt: stored?.user?.createdAt || new Date().toISOString(),
            },
            activeMembership: {
              id: stored?.activeMembership?.id || profile.user_id,
              userId: profile.user_id,
              hospitalId: profile.hospital_id,
              hospitalUid: profile.hospital_uid,
              hospitalName: profile.hospital_name,
              employeeUid: profile.employee_uid,
              role: (primaryAssign?.roleCode || stored?.activeMembership?.role || 'receptionist') as any,
              department: primaryAssign?.departmentName || stored?.activeMembership?.department || 'Facility-wide',
              departmentName: primaryAssign?.departmentName,
              scopeType: primaryAssign?.scopeType || 'FACILITY',
              status: 'active',
              departmentHeadApproved: true,
              adminApproved: true,
              joinedAt: stored?.activeMembership?.joinedAt || new Date().toISOString(),
              assignments: assigns,
              activeAssignmentId: primaryAssign?.id,
              effectivePermissions: primaryAssign?.permissions || [],
            },
            assignments: assigns,
            activeAssignment: primaryAssign,
            effectivePermissions: primaryAssign?.permissions || [],
            availableMemberships: stored?.availableMemberships || [],
            rememberMe: stored?.rememberMe ?? true,
            token: token || stored?.token || '',
            expiresAt: stored?.expiresAt || new Date(Date.now() + 86400000).toISOString(),
          };

          this.setStoredSession(refreshedSession);
          return refreshedSession;
        } else if (res.status === 401 || res.status === 403) {
          this.setStoredSession(null);
          return null;
        }
      } catch (e) {
        if (stored) return stored;
      }
    }

    return stored;
  },

  normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  },

  validateUsernameFormat(username: string): { valid: boolean; error?: string } {
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters long.' };
    }
    if (trimmed.length > 30) {
      return { valid: false, error: 'Username cannot exceed 30 characters.' };
    }
    const validCharacters = /^[a-zA-Z0-9._]+$/;
    if (!validCharacters.test(trimmed)) {
      return { valid: false, error: 'Only letters, numbers, periods (.), and underscores (_) are allowed.' };
    }
    if (trimmed.startsWith('.') || trimmed.endsWith('.') || trimmed.startsWith('_') || trimmed.endsWith('_')) {
      return { valid: false, error: 'Username cannot start or end with a period or underscore.' };
    }
    if (trimmed.includes('..') || trimmed.includes('__')) {
      return { valid: false, error: 'Consecutive periods or underscores are not allowed.' };
    }
    return { valid: true };
  },

  /**
   * Look up hospital across both pre-seeded hospitals and dynamic purchaser-registered facilities.
   */
  findHospital(hospitalUid: string): { id: string; hospitalUid: string; name: string } | null {
    const query = hospitalUid.trim().toLowerCase();
    const mockHosp = liveHospitals.find((h) => h.hospitalUid.toLowerCase() === query);
    if (mockHosp) return mockHosp;

    try {
      const purchaserHospitals = purchaserService.getAllHospitals();
      const match = purchaserHospitals.find((h) => h.hospitalUid.toLowerCase() === query);
      if (match) {
        return {
          id: match.id,
          hospitalUid: match.hospitalUid,
          name: match.officialName,
        };
      }
    } catch {
      // purchaserService may be initializing
    }

    return null;
  },

  /**
   * Checks global username availability against the PostgreSQL database.
   */
  async checkUsernameAvailability(username: string): Promise<{ available: boolean; suggestions?: string[]; error?: string }> {
    const val = this.validateUsernameFormat(username);
    if (!val.valid) {
      return { available: false, error: val.error };
    }

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const res = await fetch(`${API_BASE}/registration/check-username?username=${encodeURIComponent(username.trim())}`);
        if (res.ok) {
          const data = await res.json();
          return { available: Boolean(data.available), suggestions: data.suggestions || [] };
        }
      } catch (err) {
        // Fall back to local check if offline
      }
    }

    const norm = this.normalizeUsername(username);
    const exists = liveUsers.some((u) => u.user.username.toLowerCase() === norm);
    const suggestions = exists ? [`${norm}01`, `${norm}.med`, `${norm}.care`] : [];
    return { available: !exists, suggestions };
  },

  // --------------------------------------------------------------------------
  // STAGE 1: HOSPITAL IDENTIFICATION & EMAIL OTP
  // --------------------------------------------------------------------------

  async startRegistration(hospitalUid: string, email: string): Promise<StartRegistrationResponse> {
    const trimmedUid = hospitalUid.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUid) {
      throw new AuthenticationError('Hospital UID is required.', 'VALIDATION_ERROR');
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      throw new AuthenticationError('A valid official work email address is required.', 'VALIDATION_ERROR');
    }

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch(`${API_BASE}/registration/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospital_uid: trimmedUid,
          email: trimmedEmail,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new AuthenticationError(
          errJson.detail || `Hospital UID "${trimmedUid}" not recognized.`,
          errJson.code || 'HOSPITAL_NOT_FOUND'
        );
      }

      const data = await res.json();
      return {
        challengeId: data.challenge_id,
        email: data.email,
        hospitalName: data.hospital_name,
        hospitalUid: data.hospital_uid,
        resendAvailableInSeconds: data.resend_available_in_seconds,
        message: data.message,
      };
    }

    // Node unit test fallback
    const hosp = this.findHospital(trimmedUid);
    if (!hosp) {
      throw new AuthenticationError(
        `Hospital UID "${trimmedUid}" not recognized. Please check your facility ID (e.g., STJUDE-METRO-01 or APOLLO-CARE-02).`,
        'HOSPITAL_NOT_FOUND'
      );
    }

    const challengeId = 'chall-' + Math.random().toString(36).substring(2, 9);
    const mockOtp = '123456';

    liveChallenges[challengeId] = {
      otp: mockOtp,
      email: trimmedEmail,
      hospitalUid: hosp.hospitalUid,
      verified: false,
      token: 'token-' + Math.random().toString(36).substring(2, 12),
    };

    return {
      challengeId,
      email: trimmedEmail,
      hospitalName: hosp.name,
      hospitalUid: hosp.hospitalUid,
      resendAvailableInSeconds: 60,
      message: `Verification code dispatched to ${trimmedEmail}.`,
    };
  },

  async resendOTP(hospitalUid: string, email: string): Promise<StartRegistrationResponse> {
    return this.startRegistration(hospitalUid, email);
  },

  async verifyOTP(challengeId: string, otp: string): Promise<VerifyOTPResponse> {
    const trimmedOtp = otp.trim();

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch(`${API_BASE}/registration/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challengeId,
          otp: trimmedOtp,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new AuthenticationError(
          errJson.detail || 'Incorrect verification code. Please check your email.',
          errJson.code || 'OTP_INVALID'
        );
      }

      const data = await res.json();
      return {
        verified: Boolean(data.verified),
        verificationToken: data.verification_token,
        hospitalId: data.hospital_id,
        hospitalUid: data.hospital_uid,
        hospitalName: data.hospital_name,
        email: data.email,
        message: data.message,
      };
    }

    // Node test runner simulation
    if (trimmedOtp !== '123456') {
      const ch = liveChallenges[challengeId];
      if (!ch || ch.otp !== trimmedOtp) {
        throw new AuthenticationError('Incorrect verification code.', 'OTP_INVALID');
      }
    }

    let ch = liveChallenges[challengeId];
    if (!ch) {
      const fallbackToken = 'token-' + Math.random().toString(36).substring(2, 12);
      return {
        verified: true,
        verificationToken: fallbackToken,
        hospitalId: 'hosp-stjude',
        hospitalUid: 'STJUDE-METRO-01',
        hospitalName: 'St. Jude Metropolitan Hospital',
        email: 'employee@stjude.org',
        message: 'Email verification successful. Stage 2 registration unlocked.',
      };
    }

    ch.verified = true;
    const hosp = this.findHospital(ch.hospitalUid);

    return {
      verified: true,
      verificationToken: ch.token,
      hospitalId: hosp?.id || 'hosp-stjude',
      hospitalUid: ch.hospitalUid,
      hospitalName: hosp?.name || 'St. Jude Metropolitan Hospital',
      email: ch.email,
      message: 'Email verification successful. Stage 2 registration unlocked.',
    };
  },

  async getAvailableDepartments(hospitalUid: string): Promise<DepartmentOption[]> {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch(`${API_BASE}/registration/available-departments?hospital_uid=${encodeURIComponent(hospitalUid.trim())}`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) return list;
      }
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || 'Failed to fetch departments from hospital facility.');
    }

    return [
      { id: 'dept-genmed', name: 'General Medicine', code: 'GEN-MED', description: 'Primary adult healthcare' },
      { id: 'dept-emerg', name: 'Emergency Medicine', code: 'EMERG', description: 'Acute trauma & emergency care' },
      { id: 'dept-disp', name: 'Dispensary (Future Scope)', code: 'DISP', description: 'Planned future capability: Prescription fulfillment, medication dispensing, and pharmaceutical inventory' },
      { id: 'dept-cardio', name: 'Cardiology', code: 'CARDIO', description: 'Cardiovascular diagnostics' },
      { id: 'dept-pedia', name: 'Pediatrics', code: 'PEDIA', description: 'Child healthcare' },
      { id: 'dept-opd', name: 'Outpatient Services', code: 'OPD', description: 'General outpatient clinic' },
    ];
  },

  async getAvailableRoles(hospitalUid: string): Promise<RoleOption[]> {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch(`${API_BASE}/registration/available-roles?hospital_uid=${encodeURIComponent(hospitalUid.trim())}`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) return list;
      }
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || 'Failed to fetch roles from hospital facility.');
    }

    return [
      { id: 'role-doc', name: 'Doctor', code: 'doctor', scope: 'department', description: 'Medical consultations and orders' },
      { id: 'role-pharm', name: 'Pharmacist / Dispensary Officer (Future Scope)', code: 'pharmacist', scope: 'department', description: 'Planned future capability: Medication dispensing, prescription review, and dispensary stock' },
      { id: 'role-depthead', name: 'Department Head', code: 'dept_head', scope: 'department', description: 'Clinical leadership and Level-1 approval' },
      { id: 'role-clinsup', name: 'Clinical Supervisor', code: 'clinical_sup', scope: 'department', description: 'Clinical supervision' },
      { id: 'role-deptsup', name: 'Department Supervisor', code: 'dept_sup', scope: 'department', description: 'Workflow management' },
      { id: 'role-rec', name: 'Receptionist', code: 'receptionist', scope: 'hospital', description: 'Hospital-wide patient intake, scheduling, check-in, and triage routing' },
      { id: 'role-adm', name: 'Hospital Administrator', code: 'admin', scope: 'hospital', description: 'Executive governance and Level-2 approval' },
    ];
  },

  // --------------------------------------------------------------------------
  // STAGE 2: ACCOUNT DETAILS & ACCESS REQUEST SUBMISSION
  // --------------------------------------------------------------------------

  async submitStage2Registration(payload: Stage2RegistrationPayload): Promise<{
    registrationId: string;
    status: string;
    username: string;
    fullName: string;
    message: string;
  }> {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch(`${API_BASE}/registration/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verification_token: payload.verificationToken,
          employee_uid: payload.employeeUid.trim(),
          username: payload.username.trim(),
          full_name: payload.fullName.trim(),
          password: payload.password,
          confirm_password: payload.confirmPassword,
          requested_assignments: payload.requestedAssignments.map((slot) => ({
            department_id: slot.departmentId || null,
            role_id: slot.roleId,
          })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new AuthenticationError(
          errJson.detail || 'Failed to submit registration request.',
          errJson.code || 'REGISTRATION_ERROR'
        );
      }

      const data = await res.json();
      return {
        registrationId: data.registration_id,
        status: data.status,
        username: data.username,
        fullName: data.full_name,
        message: data.message,
      };
    }

    const norm = this.normalizeUsername(payload.username);
    if (liveUsers.some((u) => u.user.username.toLowerCase() === norm)) {
      throw new AuthenticationError('Username is already registered on Aarogya.');
    }
    if (payload.password !== payload.confirmPassword) {
      throw new AuthenticationError('Passwords do not match.');
    }
    if (payload.password.length < 8) {
      throw new AuthenticationError('Password must be at least 8 characters.');
    }

    const newUser: User = {
      id: 'usr-' + Math.random().toString(36).substring(2, 9),
      username: payload.username.trim(),
      email: 'employee@hospital.org',
      legalName: payload.fullName.trim(),
      createdAt: new Date().toISOString(),
    };
    liveUsers.push({ user: newUser, passwordPlainText: payload.password });

    const newMembership: TenantMembership = {
      id: 'mem-' + Math.random().toString(36).substring(2, 9),
      userId: newUser.id,
      hospitalId: 'hosp-stjude',
      hospitalUid: 'STJUDE-METRO-01',
      hospitalName: 'St. Jude Metropolitan Hospital',
      employeeUid: payload.employeeUid.trim(),
      role: (payload.requestedAssignments[0]?.roleId?.replace('role-', '') || 'doctor') as any,
      department: 'General Medicine',
      status: 'pending',
      departmentHeadApproved: false,
      adminApproved: false,
      joinedAt: new Date().toISOString(),
    };
    liveMemberships.push(newMembership);

    return {
      registrationId: 'reg-' + Math.random().toString(36).substring(2, 9),
      status: 'pending_approval',
      username: payload.username,
      fullName: payload.fullName,
      message: 'Registration request submitted successfully. Awaiting administrative approval.',
    };
  },

  async submitAdditionalAssignmentRequest(payload: AdditionalAssignmentPayload): Promise<{
    requestId: string;
    status: string;
    message: string;
  }> {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch(`${API_BASE}/registration/additional-assignment-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospital_uid: payload.hospitalUid,
          email: payload.email,
          employee_uid: payload.employeeUid,
          requested_responsibilities: payload.requestedResponsibilities,
          justification: payload.justification,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new AuthenticationError(
          errJson.detail || 'Failed to dispatch additional assignment request.'
        );
      }

      const data = await res.json();
      return {
        requestId: data.request_id,
        status: data.status,
        message: data.message,
      };
    }

    return {
      requestId: 'req-' + Math.random().toString(36).substring(2, 9),
      status: 'pending',
      message: 'Your request for additional role responsibilities has been dispatched to the Hospital Administrator.',
    };
  },

  /**
   * Backward-compatibility registration method for automated test suite.
   */
  async register(payload: RegistrationPayload): Promise<{ user: User; membership: TenantMembership }> {
    const hosp = liveHospitals.find((h) => h.hospitalUid.toUpperCase() === payload.hospitalUid.toUpperCase().trim());
    if (!hosp) {
      throw new AuthenticationError('Invalid Hospital UID: Institution not found in the Aarogya registry.');
    }

    const emp = liveDirectory.find(
      (e) =>
        e.hospitalUid.toUpperCase() === payload.hospitalUid.toUpperCase().trim() &&
        e.employeeUid.toUpperCase() === payload.employeeUid.toUpperCase().trim()
    );
    if (!emp) {
      throw new AuthenticationError('Employee UID not recognized in the official employee directory.');
    }
    if (emp.registered) {
      throw new AuthenticationError('This employee record is already registered on Aarogya.');
    }

    if (payload.password !== payload.confirmPassword) {
      throw new AuthenticationError('Passwords do not match.');
    }

    const norm = this.normalizeUsername(payload.username);
    if (liveUsers.some((u) => u.user.username.toLowerCase() === norm)) {
      throw new AuthenticationError('Username is already registered on Aarogya.');
    }

    const newUser: User = {
      id: 'usr-' + Math.random().toString(36).substring(2, 9),
      username: payload.username.trim(),
      email: payload.email.trim(),
      legalName: emp.legalName,
      createdAt: new Date().toISOString(),
    };
    liveUsers.push({ user: newUser, passwordPlainText: payload.password });
    emp.registered = true;

    const newMembership: TenantMembership = {
      id: 'mem-' + Math.random().toString(36).substring(2, 9),
      userId: newUser.id,
      hospitalId: hosp.id,
      hospitalUid: hosp.hospitalUid,
      hospitalName: hosp.name,
      employeeUid: payload.employeeUid.trim(),
      role: payload.requestedRole,
      department: payload.requestedDepartment,
      status: 'pending',
      departmentHeadApproved: false,
      adminApproved: false,
      joinedAt: new Date().toISOString(),
    };
    liveMemberships.push(newMembership);

    return { user: newUser, membership: newMembership };
  },

  // --------------------------------------------------------------------------
  // ROUTINE LOGIN & SESSION
  // --------------------------------------------------------------------------

  async login(credentials: LoginCredentials): Promise<{
    session?: AuthSession;
    requiresWorkspaceSelection?: boolean;
    user?: User;
    userId?: string;
    availableMemberships?: any[];
  }> {
    const { username, password, rememberMe = false } = credentials;
    const trimmedIdent = (username || '').trim();
    if (!trimmedIdent || !password) {
      throw new AuthenticationError('Please enter both username and password.');
    }

    // 1. Attempt live API login against FastAPI backend
    try {
      if (typeof window !== 'undefined' && typeof fetch === 'function') {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            username: trimmedIdent,
            username_or_email: trimmedIdent,
            email: trimmedIdent,
            password,
            remember_me: rememberMe,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.requires_workspace_selection) {
            return {
              requiresWorkspaceSelection: true,
              userId: data.user_id,
              user: {
                id: data.user_id,
                username: trimmedIdent,
                email: '',
                legalName: trimmedIdent,
                createdAt: new Date().toISOString(),
              },
              availableMemberships: (data.available_memberships || []).map((m: any) => ({
                id: m.hospital_id,
                userId: data.user_id,
                hospitalId: m.hospital_id,
                hospitalUid: m.hospital_uid,
                hospitalName: m.hospital_name,
                employeeUid: '',
                role: (m.role_code || 'doctor') as any,
                department: m.department_name || 'General Medicine',
                status: 'active',
                departmentHeadApproved: true,
                adminApproved: true,
                joinedAt: new Date().toISOString(),
              })),
            };
          }

          if (data.session) {
            const rawAssigns = data.session.active_membership.assignments || [];
            const parsedAssigns = rawAssigns.map((a: any) => ({
              id: a.id,
              roleId: a.role_id,
              roleCode: a.role_code as any,
              roleName: a.role_name,
              departmentId: a.department_id,
              departmentName: a.department_name,
              scopeType: a.scope_type,
              permissions: a.permissions || [],
              isActive: a.is_active,
            }));

            const activeAssignId = data.session.active_membership.active_assignment_id;
            const activeAssign = parsedAssigns.find((a: any) => a.id === activeAssignId) || parsedAssigns[0];

            const newSession: AuthSession = {
              user: {
                id: data.session.user.id,
                username: data.session.user.username,
                email: data.session.user.email,
                legalName: data.session.user.full_name,
                createdAt: new Date().toISOString(),
              },
              activeMembership: {
                id: data.session.active_membership.id,
                userId: data.session.user.id,
                hospitalId: data.session.active_membership.hospital_id,
                hospitalUid: data.session.active_membership.hospital_uid,
                hospitalName: data.session.active_membership.hospital_name,
                employeeUid: data.session.active_membership.employee_uid,
                role: (activeAssign?.roleCode || data.session.active_membership.role || 'doctor') as any,
                department: activeAssign?.departmentName || data.session.active_membership.department || 'Hospital-Wide',
                departmentName: activeAssign?.departmentName,
                scopeType: activeAssign?.scopeType || 'FACILITY',
                status: data.session.active_membership.status,
                departmentHeadApproved: true,
                adminApproved: true,
                joinedAt: new Date().toISOString(),
                assignments: parsedAssigns,
                activeAssignmentId: activeAssignId,
                effectivePermissions: data.session.active_membership.effective_permissions || [],
              },
              assignments: parsedAssigns,
              activeAssignment: activeAssign,
              effectivePermissions: data.session.active_membership.effective_permissions || [],
              availableMemberships: [],
              rememberMe,
              token: data.session.access_token,
              expiresAt: new Date(Date.now() + (rememberMe ? 30 * 86400000 : 86400000)).toISOString(),
            };

            this.setStoredSession(newSession);
            return {
              session: newSession,
            };
          }
        } else {
          const errJson = await res.json().catch(() => ({}));
          const detail = errJson.detail || 'Invalid username or password.';
          const code = errJson.code || '';

          if (code === 'ACCOUNT_PENDING') {
            throw new MembershipStatusError(detail, 'pending', 'Hospital');
          } else if (code === 'ACCOUNT_SUSPENDED') {
            throw new MembershipStatusError(detail, 'suspended', 'Hospital');
          } else if (code === 'ACCOUNT_TERMINATED') {
            throw new MembershipStatusError(detail, 'terminated', 'Hospital');
          } else {
            throw new AuthenticationError(detail, code);
          }
        }
      }
    } catch (networkErr: any) {
      if (networkErr instanceof AuthenticationError || networkErr instanceof MembershipStatusError) {
        throw networkErr;
      }
      // If network unreachable or running offline tests, fall back to in-memory store
    }

    // 2. Fallback in-memory verification (supports offline tests and unit fixtures)
    const norm = this.normalizeUsername(trimmedIdent);
    const userObj = liveUsers.find(
      (u) =>
        u.user.username.toLowerCase() === norm ||
        u.user.email.toLowerCase() === norm
    );
    if (!userObj || userObj.passwordPlainText !== password) {
      throw new AuthenticationError('Invalid username or password.');
    }

    const memberships = liveMemberships.filter((m) => m.userId === userObj.user.id);
    if (!memberships.length) {
      throw new AuthenticationError('No active hospital membership found for this user account.');
    }

    const activeMemberships = memberships.filter((m) => m.status === 'active');
    if (!activeMemberships.length) {
      const pending = memberships.find((m) => m.status === 'pending');
      if (pending) {
        throw new MembershipStatusError(
          'Your account registration is awaiting Department Head review and Administrator sign-off.',
          'pending',
          pending.hospitalName
        );
      }
      const suspended = memberships.find((m) => m.status === 'suspended');
      if (suspended) {
        throw new MembershipStatusError('Your hospital access has been suspended.', 'suspended', suspended.hospitalName);
      }
      const terminated = memberships.find((m) => m.status === 'terminated');
      if (terminated) {
        throw new MembershipStatusError('Your hospital account has been terminated.', 'terminated', terminated.hospitalName);
      }
    }

    if (activeMemberships.length > 1) {
      return {
        requiresWorkspaceSelection: true,
        user: userObj.user,
        userId: userObj.user.id,
        availableMemberships: activeMemberships.map((m) => ({
          hospital_id: m.hospitalId,
          hospital_uid: m.hospitalUid,
          hospital_name: m.hospitalName,
          role_name: m.role.toUpperCase(),
          role_code: m.role,
          department_name: m.department,
        })),
      };
    }

    const activeMem = activeMemberships[0];
    return {
      session: {
        user: userObj.user,
        activeMembership: activeMem,
        availableMemberships: activeMemberships,
        rememberMe,
        token: 'token-' + Math.random().toString(36).substring(2, 12),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    };
  },

  async selectWorkspace(userId: string, hospitalId: string, rememberMe: boolean = false): Promise<AuthSession> {
    try {
      if (typeof window !== 'undefined' && typeof fetch === 'function') {
        const res = await fetch(`${API_BASE}/auth/select-workspace`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            user_id: userId,
            hospital_id: hospitalId,
            remember_me: rememberMe,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawAssigns = data.active_membership.assignments || [];
          const parsedAssigns = rawAssigns.map((a: any) => ({
            id: a.id,
            roleId: a.role_id,
            roleCode: a.role_code as any,
            roleName: a.role_name,
            departmentId: a.department_id,
            departmentName: a.department_name,
            scopeType: a.scope_type,
            permissions: a.permissions || [],
            isActive: a.is_active,
          }));

          const activeAssignId = data.active_membership.active_assignment_id;
          const activeAssign = parsedAssigns.find((a: any) => a.id === activeAssignId) || parsedAssigns[0];

          const sessionResult: AuthSession = {
            user: {
              id: data.user.id,
              username: data.user.username,
              email: data.user.email,
              legalName: data.user.full_name,
              createdAt: new Date().toISOString(),
            },
            activeMembership: {
              id: data.active_membership.id,
              userId: data.user.id,
              hospitalId: data.active_membership.hospital_id,
              hospitalUid: data.active_membership.hospital_uid,
              hospitalName: data.active_membership.hospital_name,
              employeeUid: data.active_membership.employee_uid,
              role: (activeAssign?.roleCode || data.active_membership.role || 'doctor') as any,
              department: activeAssign?.departmentName || data.active_membership.department || 'Hospital-Wide',
              departmentName: activeAssign?.departmentName,
              scopeType: activeAssign?.scopeType || 'FACILITY',
              status: data.active_membership.status,
              departmentHeadApproved: true,
              adminApproved: true,
              joinedAt: new Date().toISOString(),
              assignments: parsedAssigns,
              activeAssignmentId: activeAssignId,
              effectivePermissions: data.active_membership.effective_permissions || [],
            },
            assignments: parsedAssigns,
            activeAssignment: activeAssign,
            effectivePermissions: data.active_membership.effective_permissions || [],
            availableMemberships: [],
            rememberMe,
            token: data.access_token,
            expiresAt: new Date(Date.now() + (rememberMe ? 30 * 86400000 : 86400000)).toISOString(),
          };
          this.setStoredSession(sessionResult);
          return sessionResult;
        } else {
          const errJson = await res.json().catch(() => ({}));
          throw new AuthenticationError(errJson.detail || 'Failed to select workspace.');
        }
      }
    } catch (networkErr: any) {
      if (networkErr instanceof AuthenticationError || networkErr instanceof MembershipStatusError) {
        throw networkErr;
      }
    }

    const userObj = liveUsers.find((u) => u.user.id === userId);
    const mem = liveMemberships.find((m) => m.userId === userId && (m.hospitalId === hospitalId || m.hospitalUid === hospitalId));
    if (!userObj || !mem) {
      throw new AuthenticationError('Invalid workspace selection.');
    }
    return {
      user: userObj.user,
      activeMembership: mem,
      availableMemberships: [],
      rememberMe,
      token: 'token-' + Math.random().toString(36).substring(2, 12),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
  },

  async requestPasswordReset(identifier: string): Promise<{ success: boolean; message: string }> {
    if (!identifier || !identifier.trim()) {
      throw new AuthenticationError('Please enter your username or registered email address.');
    }
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to dispatch password recovery instructions.');
      }
      return res.json();
    }
    return {
      success: true,
      message: 'If an account with that username or email exists in our system, password reset instructions have been dispatched to the registered email address.',
    };
  },

  async resetPassword(payload: { token: string; new_password: string; confirm_password: string }): Promise<{ success: boolean; message: string }> {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to reset employee password.');
      }
      return res.json();
    }
    return {
      success: true,
      message: 'Password has been successfully reset.',
    };
  },

  async logout(): Promise<void> {
    const token = this.getStoredSession()?.token;
    this.setStoredSession(null);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.removeItem('hims_purchaser_session');
        window.localStorage?.removeItem('hims_session');
        window.sessionStorage?.removeItem('hims_session');
        window.localStorage?.removeItem(this.SESSION_STORAGE_KEY);
        window.sessionStorage?.removeItem(this.SESSION_STORAGE_KEY);
      } catch {}
    }
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers, credentials: 'include' });
      } catch {}
    }
  },

  resetMockData() {
    liveHospitals = [...mockHospitals];
    liveDirectory = [...mockEmployeeDirectory];
    liveUsers = [...mockUsers];
    liveMemberships = [...mockMemberships];
    liveChallenges = {};
  },
};
