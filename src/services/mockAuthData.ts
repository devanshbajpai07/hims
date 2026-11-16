import { Hospital, EmployeeDirectoryRecord, TenantMembership, User } from '../types/auth';

export const mockHospitals: Hospital[] = [
  {
    id: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    name: 'St. Jude Metropolitan Hospital',
    code: 'SJM',
    city: 'Metropolitan',
    active: true,
  },
  {
    id: 'hosp-apollo',
    hospitalUid: 'APOLLO-CARE-02',
    name: 'Apollo Specialty Healthcare Center',
    code: 'ASH',
    city: 'Central City',
    active: true,
  },
];

export const mockEmployeeDirectory: EmployeeDirectoryRecord[] = [
  // St. Jude Employees
  {
    id: 'emp-1',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    employeeUid: 'EMP-DOC-101',
    legalName: 'Attending Physician',
    officialEmail: 'sarah.almansoor@stjude.org',
    department: 'General Medicine',
    eligibleRole: 'doctor',
    registered: true,
  },
  {
    id: 'emp-2',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    employeeUid: 'EMP-REC-202',
    legalName: 'Medical Receptionist',
    officialEmail: 'clara.bennett@stjude.org',
    department: 'General Medicine',
    eligibleRole: 'receptionist',
    registered: true,
  },
  {
    id: 'emp-3',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    employeeUid: 'EMP-ADM-001',
    legalName: 'Elena Howard, MHA',
    officialEmail: 'elena.howard@stjude.org',
    department: 'Hospital Administration',
    eligibleRole: 'admin',
    registered: true,
  },
  {
    id: 'emp-4',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    employeeUid: 'EMP-DOC-105',
    legalName: 'Dr. Rahul Verma',
    officialEmail: 'rahul.verma@stjude.org',
    department: 'General Medicine',
    eligibleRole: 'doctor',
    registered: true,
  },
  {
    id: 'emp-5',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    employeeUid: 'EMP-DOC-303',
    legalName: 'Dr. Rajiv Sharma',
    officialEmail: 'rajiv.sharma@stjude.org',
    department: 'General Medicine',
    eligibleRole: 'doctor',
    registered: false, // Ready for new employee registration testing!
  },
  {
    id: 'emp-6',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    employeeUid: 'EMP-NUR-404',
    legalName: 'Maya Patel, RN',
    officialEmail: 'maya.patel@stjude.org',
    department: 'General Medicine',
    eligibleRole: 'receptionist',
    registered: false, // Ready for new employee registration testing!
  },
  {
    id: 'emp-7',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    employeeUid: 'EMP-DOC-808',
    legalName: 'Dr. Priya Sen',
    officialEmail: 'priya.sen@stjude.org',
    department: 'General Medicine',
    eligibleRole: 'doctor',
    registered: true,
  },
  {
    id: 'emp-8',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    employeeUid: 'EMP-DOC-909',
    legalName: 'Dr. Vikram Mehta',
    officialEmail: 'vikram.mehta@stjude.org',
    department: 'General Medicine',
    eligibleRole: 'doctor',
    registered: true,
  },
  {
    id: 'emp-9',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    employeeUid: 'EMP-REC-707',
    legalName: 'Anita Roy',
    officialEmail: 'anita.roy@stjude.org',
    department: 'General Medicine',
    eligibleRole: 'receptionist',
    registered: true,
  },

  // Apollo Specialty Employees
  {
    id: 'emp-10',
    hospitalId: 'hosp-apollo',
    hospitalUid: 'APOLLO-CARE-02',
    employeeUid: 'EMP-DOC-555',
    legalName: 'Dr. Rahul Verma',
    officialEmail: 'rahul.verma@apollo.org',
    department: 'Internal Medicine',
    eligibleRole: 'doctor',
    registered: true,
  },
  {
    id: 'emp-11',
    hospitalId: 'hosp-apollo',
    hospitalUid: 'APOLLO-CARE-02',
    employeeUid: 'EMP-REC-606',
    legalName: 'David Miller',
    officialEmail: 'david.miller@apollo.org',
    department: 'Outpatient Services',
    eligibleRole: 'receptionist',
    registered: false, // Ready for new employee registration testing!
  },
];

export interface StoredUserAccount {
  user: User;
  passwordPlainText: string; // Used by mock auth adapter to verify hash; never exposed to frontend
}

export const mockUsers: StoredUserAccount[] = [
  {
    user: {
      id: 'usr-1',
      username: 'sarah.almansoor',
      email: 'sarah.almansoor@stjude.org',
      legalName: 'Attending Physician',
      createdAt: '2026-01-15T08:00:00Z',
    },
    passwordPlainText: 'Doctor@123',
  },
  {
    user: {
      id: 'usr-2',
      username: 'clara.bennett',
      email: 'clara.bennett@stjude.org',
      legalName: 'Medical Receptionist',
      createdAt: '2026-02-01T08:00:00Z',
    },
    passwordPlainText: 'Reception@123',
  },
  {
    user: {
      id: 'usr-3',
      username: 'elena.howard',
      email: 'elena.howard@stjude.org',
      legalName: 'Elena Howard, MHA',
      createdAt: '2025-11-10T08:00:00Z',
    },
    passwordPlainText: 'Admin@123',
  },
  {
    user: {
      id: 'usr-4',
      username: 'rahul',
      email: 'rahul.verma@stjude.org',
      legalName: 'Dr. Rahul Verma',
      createdAt: '2026-03-01T08:00:00Z',
    },
    passwordPlainText: 'Rahul@123',
  },
  {
    user: {
      id: 'usr-5',
      username: 'priya.pending',
      email: 'priya.sen@stjude.org',
      legalName: 'Dr. Priya Sen',
      createdAt: '2026-11-01T08:00:00Z',
    },
    passwordPlainText: 'Priya@123',
  },
  {
    user: {
      id: 'usr-6',
      username: 'vikram.suspended',
      email: 'vikram.mehta@stjude.org',
      legalName: 'Dr. Vikram Mehta',
      createdAt: '2026-04-12T08:00:00Z',
    },
    passwordPlainText: 'Vikram@123',
  },
  {
    user: {
      id: 'usr-7',
      username: 'anita.terminated',
      email: 'anita.roy@stjude.org',
      legalName: 'Anita Roy',
      createdAt: '2026-05-20T08:00:00Z',
    },
    passwordPlainText: 'Anita@123',
  },
];

export const mockMemberships: TenantMembership[] = [
  // Dr. Sarah: Active Doctor at St. Jude
  {
    id: 'mem-1',
    userId: 'usr-1',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    hospitalName: 'St. Jude Metropolitan Hospital',
    employeeUid: 'EMP-DOC-101',
    role: 'doctor',
    department: 'General Medicine',
    status: 'active',
    departmentHeadApproved: true,
    adminApproved: true,
    joinedAt: '2026-01-16T10:00:00Z',
  },

  // Clara: Active Receptionist at St. Jude
  {
    id: 'mem-2',
    userId: 'usr-2',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    hospitalName: 'St. Jude Metropolitan Hospital',
    employeeUid: 'EMP-REC-202',
    role: 'receptionist',
    department: 'General Medicine',
    status: 'active',
    departmentHeadApproved: true,
    adminApproved: true,
    joinedAt: '2026-02-02T09:00:00Z',
  },

  // Elena: Active Admin at St. Jude
  {
    id: 'mem-3',
    userId: 'usr-3',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    hospitalName: 'St. Jude Metropolitan Hospital',
    employeeUid: 'EMP-ADM-001',
    role: 'admin',
    department: 'Hospital Administration',
    status: 'active',
    departmentHeadApproved: true,
    adminApproved: true,
    joinedAt: '2025-11-11T09:00:00Z',
  },

  // Dr. Rahul: Active at St. Jude AND Active at Apollo (Multi-hospital membership test case!)
  {
    id: 'mem-4a',
    userId: 'usr-4',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    hospitalName: 'St. Jude Metropolitan Hospital',
    employeeUid: 'EMP-DOC-105',
    role: 'doctor',
    department: 'General Medicine',
    status: 'active',
    departmentHeadApproved: true,
    adminApproved: true,
    joinedAt: '2026-03-02T08:30:00Z',
  },
  {
    id: 'mem-4b',
    userId: 'usr-4',
    hospitalId: 'hosp-apollo',
    hospitalUid: 'APOLLO-CARE-02',
    hospitalName: 'Apollo Specialty Healthcare Center',
    employeeUid: 'EMP-DOC-555',
    role: 'doctor',
    department: 'Internal Medicine',
    status: 'active',
    departmentHeadApproved: true,
    adminApproved: true,
    joinedAt: '2026-03-15T09:00:00Z',
  },

  // Priya: PENDING approval membership (Tests test case 9: denied access)
  {
    id: 'mem-5',
    userId: 'usr-5',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    hospitalName: 'St. Jude Metropolitan Hospital',
    employeeUid: 'EMP-DOC-808',
    role: 'doctor',
    department: 'General Medicine',
    status: 'pending',
    departmentHeadApproved: false,
    adminApproved: false,
    joinedAt: '2026-11-01T10:15:00Z',
  },

  // Vikram: SUSPENDED membership (Tests test case 10: denied access)
  {
    id: 'mem-6',
    userId: 'usr-6',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    hospitalName: 'St. Jude Metropolitan Hospital',
    employeeUid: 'EMP-DOC-909',
    role: 'doctor',
    department: 'General Medicine',
    status: 'suspended',
    departmentHeadApproved: true,
    adminApproved: true,
    joinedAt: '2026-04-13T11:00:00Z',
    rejectionReason: 'Temporary administrative audit suspension.',
  },

  // Anita: TERMINATED membership (Tests test case 11: denied access)
  {
    id: 'mem-7',
    userId: 'usr-7',
    hospitalId: 'hosp-stjude',
    hospitalUid: 'STJUDE-METRO-01',
    hospitalName: 'St. Jude Metropolitan Hospital',
    employeeUid: 'EMP-REC-707',
    role: 'receptionist',
    department: 'General Medicine',
    status: 'terminated',
    departmentHeadApproved: true,
    adminApproved: true,
    joinedAt: '2026-05-21T09:00:00Z',
    rejectionReason: 'Employment contract concluded on 2026-10-31.',
  },
];

