import { UserRole } from '../types';

export type MembershipStatus = 'active' | 'pending' | 'suspended' | 'terminated';

export interface Hospital {
  id: string;
  hospitalUid: string; // e.g. "STJUDE-METRO-01"
  name: string;
  code: string;
  city: string;
  active: boolean;
}

export interface EmployeeDirectoryRecord {
  id: string;
  hospitalId: string;
  hospitalUid: string;
  employeeUid: string; // Official hospital employee ID e.g. "EMP-DOC-101"
  legalName: string;
  officialEmail: string;
  department: string;
  eligibleRole: UserRole;
  registered: boolean;
}

export interface EmployeeAssignment {
  id: string;
  roleId: string;
  roleCode: UserRole;
  roleName: string;
  departmentId?: string;
  departmentName?: string;
  scopeType: 'DEPARTMENT' | 'FACILITY' | 'MULTI_DEPARTMENT';
  permissions: string[];
  isActive: boolean;
}

export interface TenantMembership {
  id: string;
  userId: string;
  hospitalId: string;
  hospitalUid: string;
  hospitalName: string;
  employeeUid: string;
  role: UserRole;
  department: string;
  departmentId?: string;
  departmentName?: string;
  scopeType?: string;
  status: MembershipStatus;
  departmentHeadApproved: boolean;
  adminApproved: boolean;
  joinedAt: string;
  rejectionReason?: string;
  assignments?: EmployeeAssignment[];
  activeAssignmentId?: string;
  effectivePermissions?: string[];
}

export interface User {
  id: string;
  username: string; // Case-insensitive globally unique identifier (e.g. "sarah.almansoor", "rahul")
  email: string;
  legalName: string;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  activeMembership: TenantMembership;
  availableMemberships: TenantMembership[];
  assignments?: EmployeeAssignment[];
  activeAssignment?: EmployeeAssignment;
  effectivePermissions?: string[];
  rememberMe: boolean;
  token: string;
  expiresAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegistrationPayload {
  hospitalUid: string;
  employeeUid: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  requestedDepartment: string;
  requestedRole: UserRole;
}

export interface PasswordResetRequest {
  identifier: string; // Username or registered email address
}

// Revised 2-Stage Progressive Verification Types
export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  description?: string;
}

export interface RoleOption {
  id: string;
  name: string;
  code: string;
  scope: string;
  description?: string;
}

export interface DepartmentRoleSlot {
  departmentId?: string;
  roleId: string;
}

export interface StartRegistrationResponse {
  challengeId: string;
  email: string;
  hospitalName: string;
  hospitalUid: string;
  resendAvailableInSeconds: number;
  message: string;
}

export interface VerifyOTPResponse {
  verified: boolean;
  verificationToken: string;
  hospitalId: string;
  hospitalUid: string;
  hospitalName: string;
  email: string;
  message: string;
}

export interface Stage2RegistrationPayload {
  verificationToken: string;
  fullName: string;
  employeeUid: string; // Unverified claim
  username: string;
  password: string;
  confirmPassword: string;
  requestedAssignments: DepartmentRoleSlot[];
}

export interface AdditionalAssignmentPayload {
  hospitalUid: string;
  email: string;
  employeeUid: string;
  requestedResponsibilities: string;
  justification: string;
}

export interface RegistrationStatusAssignment {
  id: string;
  slotNumber: number;
  departmentName: string;
  roleName: string;
  status: string;
  deptHeadReviewed: boolean;
  adminReviewed: boolean;
}

export interface RegistrationStatusInfo {
  registrationId: string;
  status: string;
  employeeUidClaim: string;
  employeeUidVerified: boolean;
  assignments: RegistrationStatusAssignment[];
}
