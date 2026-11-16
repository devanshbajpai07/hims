import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Patient, Appointment, Doctor, StaffMember, AppointmentStatus } from './types';
import { AuthSession } from './types/auth';

// Marketing Pages
import { LandingPage } from './pages/LandingPage';
import { PricingPage } from './pages/PricingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { CursorLighting } from './components/marketing/CursorLighting';

// Purchaser Portal Pages
import { PurchaserLoginPage } from './pages/purchaser/PurchaserLoginPage';
import { PurchaserRegisterPage } from './pages/purchaser/PurchaserRegisterPage';
import { PurchaserVerifyEmailPage } from './pages/purchaser/PurchaserVerifyEmailPage';
import { PurchaserDashboardPage } from './pages/purchaser/PurchaserDashboardPage';
import { CheckoutPage } from './pages/purchaser/CheckoutPage';
import { PurchaseConfirmationPage } from './pages/purchaser/PurchaseConfirmationPage';
import { HospitalRegistrationPage } from './pages/purchaser/HospitalRegistrationPage';
import { HospitalSetupPage } from './pages/purchaser/HospitalSetupPage';

// Hospital Administrator Platform Pages
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminAcceptInvitationPage } from './pages/admin/AdminAcceptInvitationPage';
import { AdminPlatformPage } from './pages/admin/AdminPlatformPage';

// Employee Onboarding Pages
import { EmployeeAcceptInvitationPage } from './pages/employee/EmployeeAcceptInvitationPage';

// HIMS Role Dashboard components
import { RoleSidebar } from './components/minimal-common/RoleSidebar';
import { RoleHeader } from './components/minimal-common/RoleHeader';
import { RegisterPatientModal } from './components/RegisterPatientModal';
import { ScheduleAppointmentModal } from './components/ScheduleAppointmentModal';
import { EditPatientModal } from './components/EditPatientModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ChangeUsernameModal } from './components/ChangeUsernameModal';
import { PatientRecordDrawer } from './components/PatientRecordDrawer';
import { ToastContainer, ToastMessage } from './components/Toast';

import { ReceptionistDashboard } from './roles/receptionist/ReceptionistDashboard';
import { DoctorDashboard } from './roles/doctor/DoctorDashboard';
import { NurseWorkspace } from './roles/nurse/NurseWorkspace';
import { NursingSupervisorDashboard } from './roles/nursing_supervisor/NursingSupervisorDashboard';
import { DepartmentHeadDashboard } from './roles/dept_head/DepartmentHeadDashboard';
import { AdminDashboard } from './roles/admin/AdminDashboard';
import { GeneralStaffDashboard } from './roles/general_staff/GeneralStaffDashboard';
import { PharmacistFutureScopeView } from './roles/pharmacist/PharmacistFutureScopeView';
import { ContactGeneralStaffModal } from './components/communication/ContactGeneralStaffModal';
import { clinicalApiClient } from './services/clinicalApiClient';
import { authService } from './services/authService';
import { purchaserService } from './services/purchaserService';
import { AssignmentSelectorModal } from './components/auth/AssignmentSelectorModal';
import { UnauthorizedWorkspaceView } from './components/common/UnauthorizedWorkspaceView';
import { ArrowLeft, LogOut, Shield, AlertTriangle } from 'lucide-react';

export const getRoleDashboardPath = (role: UserRole | string): string => {
  switch (role) {
    case 'doctor':
      return '/doctor/dashboard';
    case 'nurse':
      return '/nurse/dashboard';
    case 'receptionist':
      return '/receptionist/dashboard';
    case 'nursing_supervisor':
      return '/nursing-supervisor/dashboard';
    case 'dept_head':
      return '/dept-head/dashboard';
    case 'staff':
      return '/staff/dashboard';
    case 'pharmacist':
      return '/pharmacist/dashboard';
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/receptionist/dashboard';
  }
};

export const getRoleFromDashboardPath = (path: string): UserRole | null => {
  switch (path) {
    case '/doctor/dashboard':
      return 'doctor';
    case '/nurse/dashboard':
      return 'nurse';
    case '/receptionist/dashboard':
      return 'receptionist';
    case '/nursing-supervisor/dashboard':
      return 'nursing_supervisor';
    case '/dept-head/dashboard':
      return 'dept_head';
    case '/staff/dashboard':
      return 'staff';
    case '/pharmacist/dashboard':
      return 'pharmacist';
    default:
      return null;
  }
};

export const isEmployeeDashboardPath = (path: string): boolean => {
  return [
    '/doctor/dashboard',
    '/nurse/dashboard',
    '/receptionist/dashboard',
    '/nursing-supervisor/dashboard',
    '/dept-head/dashboard',
    '/staff/dashboard',
    '/pharmacist/dashboard',
  ].includes(path);
};

export const getAuthorizedRoles = (session: AuthSession | null): UserRole[] => {
  if (!session) return [];
  const roles = new Set<UserRole>();
  if (session.assignments && session.assignments.length > 0) {
    session.assignments.forEach((a) => {
      if (a.roleCode) roles.add(a.roleCode);
    });
  }
  if (session.activeMembership?.assignments && session.activeMembership.assignments.length > 0) {
    session.activeMembership.assignments.forEach((a) => {
      if (a.roleCode) roles.add(a.roleCode);
    });
  }
  if (session.availableMemberships && session.availableMemberships.length > 0) {
    session.availableMemberships.forEach((m) => {
      if (m.role) roles.add(m.role);
    });
  }
  if (session.activeAssignment?.roleCode) {
    roles.add(session.activeAssignment.roleCode);
  }
  if (session.activeMembership?.role) {
    roles.add(session.activeMembership.role);
  }
  return Array.from(roles);
};

export function App() {
  // Current route
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const path = window.location.pathname;
    if (
      path.startsWith('/account/') ||
      path.startsWith('/admin/') ||
      path.startsWith('/employee/') ||
      path === '/pricing' ||
      path === '/login' ||
      path === '/register' ||
      path === '/forgot-password' ||
      path === '/reset-password' ||
      isEmployeeDashboardPath(path)
    ) {
      return path;
    }
    if (path === '/app') {
      const stored = authService.getStoredSession();
      if (stored?.activeMembership?.role) {
        return getRoleDashboardPath(stored.activeMembership.role);
      }
      return '/login';
    }
    return '/';
  });

  // Authenticated Employee Session
  const [session, setSession] = useState<AuthSession | null>(() => {
    return authService.getStoredSession();
  });

  // Role Dashboard States
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    const stored = authService.getStoredSession();
    const authorized = getAuthorizedRoles(stored);
    const pathRole = getRoleFromDashboardPath(window.location.pathname);
    if (pathRole && authorized.includes(pathRole)) {
      return pathRole;
    }
    if (stored?.activeAssignment?.roleCode && authorized.includes(stored.activeAssignment.roleCode)) {
      return stored.activeAssignment.roleCode;
    }
    if (stored?.activeMembership?.assignments && stored.activeMembership.assignments.length > 0) {
      const nonAdmin = stored.activeMembership.assignments.find((a) => a.roleCode !== 'admin' && authorized.includes(a.roleCode));
      if (nonAdmin?.roleCode) return nonAdmin.roleCode as UserRole;
    }
    if (stored?.activeMembership?.role && authorized.includes(stored.activeMembership.role)) {
      return stored.activeMembership.role;
    }
    if (authorized.length > 0) {
      return authorized[0];
    }
    return 'receptionist';
  });
  const [activeDoctorName, setActiveDoctorName] = useState<string>(() => {
    const stored = authService.getStoredSession();
    return stored?.user?.legalName || 'Attending Physician';
  });
  const [currentTab, setCurrentTab] = useState<string>(() => {
    const stored = authService.getStoredSession();
    if (stored?.activeMembership?.role === 'doctor' || stored?.activeMembership?.role === 'dept_head') return 'overview';
    if (stored?.activeMembership?.role === 'staff') return 'inbox';
    if (stored?.activeMembership?.role === 'nurse') return 'patient-data';
    if (stored?.activeMembership?.role === 'nursing_supervisor') return 'active-nurses';
    return 'queue';
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-Assignment Selector Modal State
  const [isAssignmentSelectorOpen, setIsAssignmentSelectorOpen] = useState(false);

  // Internal Communication Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [unreadCommCount, setUnreadCommCount] = useState<number>(0);

  // Core domain states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Modals & Drawers
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<Patient | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isChangeUsernameOpen, setIsChangeUsernameOpen] = useState(false);
  const [selectedPatientForEMR, setSelectedPatientForEMR] = useState<Patient | null>(null);
  const [isEMROpen, setIsEMROpen] = useState(false);

  // Toast feedback state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const navigateTo = useCallback((path: string) => {
    const pathOnly = path.split('?')[0];
    setCurrentPath(pathOnly);
    window.history.pushState({}, '', path);
  }, []);

  const addToast = useCallback((title: string, description: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, type: 'success' }]);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Browser navigation sync
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (
        path.startsWith('/account/') ||
        path.startsWith('/admin/') ||
        path.startsWith('/employee/') ||
        path === '/pricing' ||
        path === '/login' ||
        path === '/register' ||
        path === '/forgot-password' ||
        path === '/reset-password' ||
        isEmployeeDashboardPath(path)
      ) {
        setCurrentPath(path);
      } else if (path === '/app') {
        const stored = authService.getStoredSession();
        if (stored?.activeMembership?.role) {
          navigateTo(getRoleDashboardPath(stored.activeMembership.role));
        } else {
          navigateTo('/login');
        }
      } else {
        setCurrentPath('/');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigateTo]);

  // Authoritative session verification against PostgreSQL backend on mount + reactive 401 handling
  useEffect(() => {
    let isMounted = true;
    const stored = authService.getStoredSession();
    if (stored?.token) {
      authService
        .restoreSession()
        .then((refreshed) => {
          if (!isMounted) return;
          if (refreshed) {
            setSession(refreshed);
          } else {
            setSession(null);
            const p = window.location.pathname;
            if (isEmployeeDashboardPath(p) || p.startsWith('/admin/dashboard') || p.startsWith('/admin/platform')) {
              navigateTo(p.startsWith('/admin') ? '/admin/login' : '/login');
            }
          }
        })
        .catch(() => {});
    }

    const handleUnauthorized = () => {
      setSession(null);
      const p = window.location.pathname;
      if (isEmployeeDashboardPath(p) || p.startsWith('/admin/dashboard') || p.startsWith('/admin/platform')) {
        navigateTo(p.startsWith('/admin') ? '/admin/login' : '/login');
      }
    };
    window.addEventListener('hims:unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('hims:unauthorized', handleUnauthorized);
    };
  }, [navigateTo]);

  // Guard and sync activeRole state from URL with authorized roles in session
  useEffect(() => {
    if (!session) return;
    const authorizedRoles = getAuthorizedRoles(session);
    if (authorizedRoles.length === 0) return;

    // Check if current path is an employee dashboard
    if (isEmployeeDashboardPath(currentPath)) {
      const requestedRole = getRoleFromDashboardPath(currentPath);
      if (requestedRole) {
        if (!authorizedRoles.includes(requestedRole)) {
          // Do NOT automatically switch to another dashboard!
          // UnauthorizedWorkspaceView will be rendered on screen with a clear 403 error message.
          return;
        }

        // User IS authorized for requestedRole
        if (activeRole !== requestedRole) {
          setActiveRole(requestedRole);
          if (requestedRole === 'doctor') {
            setCurrentTab('overview');
            setActiveDoctorName(session.user.legalName || 'Attending Physician');
          } else if (requestedRole === 'nurse') {
            setCurrentTab('patient-data');
          } else if (requestedRole === 'nursing_supervisor') {
            setCurrentTab('active-nurses');
          } else if (requestedRole === 'receptionist') {
            setCurrentTab('queue');
          } else if (requestedRole === 'staff') {
            setCurrentTab('inbox');
          } else {
            setCurrentTab('overview');
          }
        }
      }
    } else if (currentPath.startsWith('/admin/dashboard') || currentPath.startsWith('/admin/platform')) {
      if (!authorizedRoles.includes('admin')) {
        // Do NOT automatically switch to another dashboard!
        // UnauthorizedWorkspaceView will be rendered on screen with a clear 403 error message.
        return;
      }
    }
  }, [currentPath, session, activeRole, navigateTo]);

  const [isBackendOffline, setIsBackendOffline] = useState(false);

  // Fetch real clinical data from backend (bypassed for General Staff and Pharmacist who have no operational clinical permissions)
  const loadClinicalData = useCallback(async () => {
    if (activeRole === 'staff' || activeRole === 'pharmacist') return;
    try {
      const [fetchedPatients, fetchedAppointments, fetchedDoctors, fetchedStaff, fetchedDepts] = await Promise.all([
        clinicalApiClient.getPatients(session?.token),
        clinicalApiClient.getAppointments(session?.token),
        clinicalApiClient.getDoctors(session?.token),
        clinicalApiClient.getStaff(session?.token),
        clinicalApiClient.getDepartments(session?.token).catch(() => []),
      ]);
      setIsBackendOffline(false);
      if (fetchedPatients) {
        setPatients(fetchedPatients);
      }
      if (fetchedAppointments) {
        setAppointments(fetchedAppointments);
      }
      if (fetchedDoctors) {
        setDoctors(fetchedDoctors);
      }
      if (fetchedStaff) {
        setStaff(fetchedStaff);
      }
      if (fetchedDepts && Array.isArray(fetchedDepts)) {
        setDepartments(fetchedDepts);
      }
    } catch (err: any) {
      console.warn('Unable to load live clinical data from API:', err);
      setIsBackendOffline(true);
    }
  }, [session?.token, activeRole]);

  // Sync unread internal communication counts for logged in employees
  useEffect(() => {
    if (!session?.token || !isEmployeeDashboardPath(currentPath)) return;
    const fetchUnread = () => {
      clinicalApiClient
        .getUnreadCommunicationCount(session.token)
        .then((count) => setUnreadCommCount(count || 0))
        .catch(() => {});
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, 15000);
    return () => clearInterval(timer);
  }, [session?.token, currentPath]);

  useEffect(() => {
    if (isEmployeeDashboardPath(currentPath)) {
      loadClinicalData();
    }
  }, [currentPath, loadClinicalData, session?.activeMembership?.activeAssignmentId]);

  // Login success handler
  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    authService.setStoredSession(newSession);

    const role = (newSession.activeMembership.role || 'receptionist') as UserRole;
    setActiveRole(role);

    if (role === 'receptionist') setCurrentTab('queue');
    if (role === 'doctor') {
      setCurrentTab('overview');
      setActiveDoctorName(newSession.user.legalName || 'Attending Physician');
    }
    if (role === 'nurse') setCurrentTab('patient-data');
    if (role === 'nursing_supervisor') setCurrentTab('overview');
    if (role === 'dept_head') setCurrentTab('overview');
    if (role === 'admin') {
      setCurrentTab('overview');
      navigateTo('/admin/dashboard');
      return;
    }
    if (role === 'staff') setCurrentTab('inbox');

    addToast(
      'Authenticated Successfully',
      `Welcome back, ${newSession.user.legalName} (${newSession.activeMembership.hospitalName})`
    );

    const targetPath = getRoleDashboardPath(role);
    navigateTo(targetPath);
  };

  // Cross-account synchronization guard: Purge conflicting purchaser cache if employee email differs
  useEffect(() => {
    const storedEmp = authService.getStoredSession();
    const storedPurchaser = purchaserService.getCurrentPurchaser();
    if (storedEmp?.user?.email && storedPurchaser?.email) {
      if (storedEmp.user.email.toLowerCase() !== storedPurchaser.email.toLowerCase()) {
        purchaserService.setCurrentPurchaser(null);
      }
    }
  }, [session]);

  // Logout handler
  const handleLogout = () => {
    setSession(null);
    authService.setStoredSession(null);
    purchaserService.setCurrentPurchaser(null);
    setPatients([]);
    setAppointments([]);
    setDoctors([]);
    setStaff([]);
    addToast('Logged Out', 'Your employee session has been terminated safely.');
    navigateTo('/login');
  };

  // Switch assignment handler for multi-role or department-scoped employees
  const handleSwitchAssignment = async (assignmentId: string) => {
    if (!session) return;
    try {
      // Clear stale department-specific data immediately to avoid cross-department data bleed
      setPatients([]);
      setAppointments([]);
      setDoctors([]);
      setStaff([]);

      const switchRes = await clinicalApiClient.switchAssignment(assignmentId, session.token);

      const targetAssignment = (
        session.assignments ||
        session.activeMembership.assignments
      )?.find((a) => a.id === assignmentId);

      if (targetAssignment) {
        const newRole = targetAssignment.roleCode as UserRole;
        setActiveRole(newRole);

        const effectivePerms = switchRes.effective_permissions || targetAssignment.permissions || [];

        const updatedSession: AuthSession = {
          ...session,
          token: switchRes.access_token || session.token,
          effectivePermissions: effectivePerms,
          activeAssignment: targetAssignment,
          activeMembership: {
            ...session.activeMembership,
            role: newRole,
            activeAssignmentId: targetAssignment.id,
            departmentId: targetAssignment.departmentId,
            department: targetAssignment.departmentName || session.activeMembership.department,
            departmentName: targetAssignment.departmentName,
            scopeType: targetAssignment.scopeType,
            effectivePermissions: effectivePerms,
          },
        };

        setSession(updatedSession);
        authService.setStoredSession(updatedSession);

        setIsAssignmentSelectorOpen(false);

        if (newRole === 'admin') {
          addToast(
            'Navigating to Administration Platform',
            'Switching to institutional hospital administrator governance console.'
          );
          navigateTo('/admin/dashboard');
          return;
        }

        if (newRole === 'receptionist') setCurrentTab('queue');
        if (newRole === 'doctor') {
          setCurrentTab('overview');
          setActiveDoctorName(session.user.legalName || 'Attending Physician');
        }
        if (newRole === 'nurse') setCurrentTab('patient-data');
        if (newRole === 'nursing_supervisor') setCurrentTab('active-nurses');
        if (newRole === 'dept_head') setCurrentTab('overview');
        if (newRole === 'staff') setCurrentTab('inbox');

        addToast(
          'Workspace Context Switched',
          `Active role set to ${targetAssignment.roleName} (${targetAssignment.departmentName || 'Facility-wide'})`
        );

        navigateTo(getRoleDashboardPath(newRole));

        // Refetch clinical data scoped to this new assignment (unless General Staff)
        if (newRole !== 'staff') {
          try {
            const [fetchedPatients, fetchedAppointments, fetchedDoctors, fetchedStaff] = await Promise.all([
              clinicalApiClient.getPatients(updatedSession.token),
              clinicalApiClient.getAppointments(updatedSession.token),
              clinicalApiClient.getDoctors(updatedSession.token),
              clinicalApiClient.getStaff(updatedSession.token),
            ]);
            if (fetchedPatients) setPatients(fetchedPatients);
            if (fetchedAppointments) setAppointments(fetchedAppointments);
            if (fetchedDoctors) setDoctors(fetchedDoctors);
            if (fetchedStaff) setStaff(fetchedStaff);
          } catch (err) {
            console.warn('Unable to load clinical data after assignment switch:', err);
          }
        }
      }
    } catch (err: any) {
      addToast('Assignment Switch Failed', err.message || 'Could not switch active assignment.');
    }
  };

  // Role switch handler
  const handleSelectRole = (newRole: UserRole) => {
    setActiveRole(newRole);
    if (newRole === 'receptionist') setCurrentTab('queue');
    if (newRole === 'doctor') setCurrentTab('my-appointments');
    if (newRole === 'nurse') setCurrentTab('patient-data');
    if (newRole === 'nursing_supervisor') setCurrentTab('overview');
    if (newRole === 'dept_head') setCurrentTab('overview');
    if (newRole === 'admin') setCurrentTab('overview');
    if (newRole === 'staff') setCurrentTab('inbox');
  };

  // Check in patient (Receptionist action)
  const handleCheckInPatient = async (appointmentId: string) => {
    try {
      await clinicalApiClient.checkInAppointment(appointmentId, session?.token);
    } catch (err) {
      console.warn('API check-in encountered error, falling back locally', err);
    }

    const nowTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let checkedPatientName = '';
    let doctorTarget = '';

    setAppointments((prev) =>
      prev.map((apt) => {
        if (apt.id === appointmentId) {
          checkedPatientName = apt.patientName;
          doctorTarget = apt.doctorName;
          return {
            ...apt,
            status: 'checked-in',
            checkedInAt: nowTime,
          };
        }
        return apt;
      })
    );

    addToast(
      'Patient Checked In',
      `${checkedPatientName || 'Patient'} has arrived and is now queued for ${doctorTarget || 'Doctor'}.`
    );
  };

  // Status update (Receptionist / Clinical action)
  const handleUpdateStatus = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      const updated = await clinicalApiClient.updateAppointmentStatus(
        appointmentId,
        { status: newStatus },
        session?.token
      );
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === appointmentId ? updated : apt))
      );
      addToast('Status Updated', `${updated.patientName}'s appointment marked as ${newStatus}.`);
      loadClinicalData();
    } catch (err: any) {
      addToast('Status Update Failed', err.message || 'Could not update status.');
    }
  };

  // Demographic update (Receptionist action gated by patient:update)
  const handleUpdatePatient = async (
    patientId: string,
    updates: {
      contactPhone?: string;
      emergencyContact?: string;
      bloodGroup?: string;
      triageCategory?: string;
      bedOrRoom?: string;
      attendingPhysicianName?: string;
    }
  ) => {
    try {
      const updated = await clinicalApiClient.updatePatient(patientId, updates, session?.token);
      setPatients((prev) =>
        prev.map((p) => (p.id === patientId ? updated : p))
      );
      addToast('Demographics Updated', `Patient record for ${updated.name} (${updated.mrn}) saved.`);
      loadClinicalData();
    } catch (err: any) {
      addToast('Update Failed', err.message || 'Could not update patient demographics.');
      throw err;
    }
  };

  // Doctor begins consultation
  const handleStartConsultation = async (appointmentId: string) => {
    try {
      await clinicalApiClient.startConsultation(appointmentId, session?.token);
    } catch (err) {
      console.warn('API start consultation error', err);
    }

    let patMrn = '';
    let patName = '';

    setAppointments((prev) =>
      prev.map((apt) => {
        if (apt.id === appointmentId) {
          patMrn = apt.patientMrn;
          patName = apt.patientName;
          return { ...apt, status: 'in-progress' };
        }
        return apt;
      })
    );

    const matchingPat = patients.find((p) => p.mrn === patMrn);
    if (matchingPat) {
      setSelectedPatientForEMR(matchingPat);
      setIsEMROpen(true);
    }

    addToast('Consultation Started', `${patName || 'Patient'} called into examination room.`);
  };

  // Doctor concludes consultation
  const handleCompleteConsultation = async (appointmentId: string) => {
    try {
      await clinicalApiClient.completeConsultation(
        appointmentId,
        {
          clinicalNotes: 'Encounter concluded. Examination complete. Vitals reviewed.',
          diagnosis: 'Z00.00',
        },
        session?.token
      );
    } catch (err) {
      console.warn('API complete consultation error', err);
    }

    const nowTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let patName = '';
    setAppointments((prev) =>
      prev.map((apt) => {
        if (apt.id === appointmentId) {
          patName = apt.patientName;
          return {
            ...apt,
            status: 'completed',
            completedAt: nowTime,
          };
        }
        return apt;
      })
    );

    addToast(
      'Consultation Concluded',
      `Encounter orders filed for ${patName || 'Patient'}. Exam room ready for next patient.`
    );
  };

  // Register new patient (Gated by patient:create)
  const handleRegisterPatient = async (
    newPatData: Omit<Patient, 'id' | 'mrn' | 'registeredAt'>
  ) => {
    try {
      const created = await clinicalApiClient.registerPatient(
        {
          fullName: newPatData.name,
          age: newPatData.age,
          gender: newPatData.gender,
          bloodGroup: newPatData.bloodGroup,
          contactPhone: newPatData.contact,
          chiefComplaint: newPatData.chiefComplaint,
          departmentId: newPatData.departmentId,
          departmentName: newPatData.department,
          triageCategory: newPatData.triageCategory,
          bedOrRoom: newPatData.bedOrRoom,
          attendingPhysicianName: newPatData.attendingPhysician,
          attendingPhysicianId: newPatData.attendingPhysicianId,
          allergies: Array.isArray(newPatData.allergies) ? newPatData.allergies.join(', ') : newPatData.allergies,
          chronicConditions: Array.isArray(newPatData.chronicConditions) ? newPatData.chronicConditions.join(', ') : newPatData.chronicConditions,
        },
        session?.token
      );

      setPatients((prev) => [created, ...prev]);
      addToast(
        'Patient Admitted to Registry',
        `${created.name} (${created.mrn}) registered and transferred to ${created.department || 'Clinical Department'} for consultation.`
      );
      loadClinicalData();
    } catch (err: any) {
      addToast('Registration Failed', err.message || 'Could not register patient.');
    }
  };

  // Schedule new appointment (Gated by appointment:create)
  const handleScheduleAppointment = async (
    aptData: Omit<Appointment, 'id'> & { patientId?: string }
  ) => {
    try {
      const booked = await clinicalApiClient.bookAppointment(
        {
          patientId: aptData.patientId || (patients.find((p) => p.name === aptData.patientName)?.id) || '',
          doctorName: aptData.doctorName,
          doctorId: aptData.doctorId,
          departmentId: aptData.departmentId,
          departmentName: aptData.department,
          appointmentTime: aptData.time,
          duration: aptData.duration,
          appointmentType: aptData.type,
          status: aptData.status,
          room: aptData.room,
          priority: aptData.priority,
          notes: aptData.notes,
        },
        session?.token
      );

      setAppointments((prev) => [booked, ...prev]);
      addToast(
        'Appointment Confirmed',
        `${booked.patientName} scheduled with ${booked.doctorName} in ${booked.department || 'Clinical Department'} at ${booked.time} (${booked.room}).`
      );
      loadClinicalData();
    } catch (err: any) {
      addToast('Scheduling Failed', err.message || 'Could not book appointment.');
    }
  };

  const handleOpenPatientEMR = (pat: Patient) => {
    setSelectedPatientForEMR(pat);
    setIsEMROpen(true);
  };

  // Sidebar badge calculations
  const waitingPatientsCount = appointments.filter((a) => a.status === 'checked-in').length;
  const todayAppointmentsCount = appointments.filter(
    (a) => a.doctorName === activeDoctorName
  ).length;

  return (
    <div className="relative min-h-screen">
      {/* Subtle cursor-following illumination torch */}
      <CursorLighting />

      {/* ROUTE 1: Landing Page */}
      {currentPath === '/' && <LandingPage onNavigate={navigateTo} />}

      {/* ROUTE 2: Pricing Page (Public Marketing) */}
      {currentPath === '/pricing' && <PricingPage onNavigate={navigateTo} context="public" />}

      {/* ROUTE 3: Login Page (Part A) */}
      {currentPath === '/login' && (
        <LoginPage onNavigate={navigateTo} onLoginSuccess={handleLoginSuccess} />
      )}

      {/* ROUTE 4: Registration Page (Part C) */}
      {currentPath === '/register' && <RegisterPage onNavigate={navigateTo} />}

      {/* ROUTE 5: Password Recovery Page (Part D) */}
      {currentPath === '/forgot-password' && <ForgotPasswordPage onNavigate={navigateTo} role="employee" />}
      {currentPath === '/reset-password' && <ResetPasswordPage onNavigate={navigateTo} context="employee" />}

      {/* PURCHASER PORTAL ROUTES */}
      {currentPath === '/account/login' && <PurchaserLoginPage onNavigate={navigateTo} />}
      {currentPath === '/account/register' && <PurchaserRegisterPage onNavigate={navigateTo} />}
      {currentPath === '/account/verify-email' && <PurchaserVerifyEmailPage onNavigate={navigateTo} />}
      {currentPath === '/account/reset-password' && <ResetPasswordPage onNavigate={navigateTo} context="purchaser" />}
      {currentPath === '/account/checkout' && <CheckoutPage onNavigate={navigateTo} />}
      {currentPath === '/account/purchase-confirmation' && (
        <PurchaseConfirmationPage onNavigate={navigateTo} />
      )}
      {currentPath === '/account/dashboard' && <PurchaserDashboardPage onNavigate={navigateTo} />}
      {currentPath === '/account/pricing' && <PricingPage onNavigate={navigateTo} context="enterprise" />}
      {currentPath === '/account/hospital-registration' && (
        <HospitalRegistrationPage onNavigate={navigateTo} />
      )}
      {currentPath === '/account/hospital-setup' && <HospitalSetupPage onNavigate={navigateTo} />}

      {/* HOSPITAL ADMINISTRATOR PLATFORM ROUTES */}
      {currentPath === '/admin/login' && <AdminLoginPage onNavigate={navigateTo} />}
      {currentPath === '/admin/forgot-password' && <ForgotPasswordPage onNavigate={navigateTo} role="admin" />}
      {currentPath === '/admin/reset-password' && <ResetPasswordPage onNavigate={navigateTo} context="admin" />}
      {currentPath.startsWith('/admin/accept-invitation') && (
        <AdminAcceptInvitationPage onNavigate={navigateTo} />
      )}
      {currentPath === '/admin/dashboard' && (
        (() => {
          if (!session) {
            setTimeout(() => navigateTo('/admin/login'), 0);
            return null;
          }
          const authorizedRoles = getAuthorizedRoles(session);
          if (!authorizedRoles.includes('admin')) {
            return (
              <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
                <UnauthorizedWorkspaceView
                  requestedRole="admin"
                  requestedPath={currentPath}
                  session={session}
                  authorizedRoles={authorizedRoles}
                  onNavigateToRole={(role) => {
                    setActiveRole(role);
                    navigateTo(getRoleDashboardPath(role));
                  }}
                  onLogout={handleLogout}
                />
              </div>
            );
          }
          return <AdminPlatformPage onNavigate={navigateTo} />;
        })()
      )}

      {/* EMPLOYEE INVITATION ACCEPTANCE ROUTE */}
      {(currentPath.startsWith('/employee/invitation/accept') || currentPath.startsWith('/employee/accept-invitation')) && (
        <EmployeeAcceptInvitationPage onNavigate={navigateTo} />
      )}

      {/* Block /app route: redirect immediately to role dashboard or login */}
      {currentPath === '/app' && (
        (() => {
          const target = session ? getRoleDashboardPath(activeRole) : '/login';
          setTimeout(() => navigateTo(target), 0);
          return null;
        })()
      )}

      {/* ROUTE 6: Interactive Role-Oriented Dynamic Employee Dashboard */}
      {isEmployeeDashboardPath(currentPath) && (
        (() => {
          if (!session) {
            setTimeout(() => navigateTo('/login'), 0);
            return null;
          }
          const requestedRole = getRoleFromDashboardPath(currentPath);
          const authorizedRoles = getAuthorizedRoles(session);

          // If user is authenticated but not assigned this requested workspace:
          if (requestedRole && !authorizedRoles.includes(requestedRole)) {
            return (
              <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
                <UnauthorizedWorkspaceView
                  requestedRole={requestedRole}
                  requestedPath={currentPath}
                  session={session}
                  authorizedRoles={authorizedRoles}
                  onNavigateToRole={(role) => {
                    setActiveRole(role);
                    navigateTo(getRoleDashboardPath(role));
                  }}
                  onLogout={handleLogout}
                />
              </div>
            );
          }

          return (
            <div className="flex h-screen bg-[#FAF7F2] text-slate-800 font-sans overflow-hidden">
              {/* Role-Aware Minimal Clinical Sidebar */}
              <RoleSidebar
                role={activeRole}
                currentTab={currentTab}
                onSelectTab={setCurrentTab}
                waitingPatientsCount={waitingPatientsCount}
                todayAppointmentsCount={todayAppointmentsCount}
                openRegisterModal={() => setIsRegisterOpen(true)}
                openScheduleModal={() => setIsScheduleOpen(true)}
                openContactModal={() => setIsContactModalOpen(true)}
                openChangePasswordModal={() => setIsChangePasswordOpen(true)}
                openChangeUsernameModal={() => setIsChangeUsernameOpen(true)}
                activeDoctorName={session?.user?.legalName || activeDoctorName}
                hospitalName={session?.activeMembership?.hospitalName || 'Metro General Hospital'}
                departmentName={session?.activeMembership?.departmentName || session?.activeMembership?.department || 'Facility-wide'}
                scopeType={session?.activeMembership?.scopeType || 'FACILITY'}
                effectivePermissions={session?.activeMembership?.effectivePermissions || session?.effectivePermissions || []}
                pendingRequestsCount={unreadCommCount}
              />

              {/* Main Role-Oriented Canvas */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Backend Offline Warning Banner */}
                {isBackendOffline && (
                  <div className="bg-rose-600 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-md shrink-0 z-40 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-200" />
                      <span>
                        <strong>Hospital Backend Server Offline:</strong> Unable to connect to hospital API at <code className="bg-rose-700 px-1 py-0.5 rounded text-[11px]">http://127.0.0.1:8000</code>. Real-time patient data and queue synchronization are paused.
                      </span>
                    </div>
                    <button
                      onClick={() => loadClinicalData()}
                      className="px-3 py-1 bg-white text-rose-700 hover:bg-rose-50 font-bold rounded-lg text-xs transition-colors shrink-0 shadow-2xs cursor-pointer ml-3"
                    >
                      Retry Connection
                    </button>
                  </div>
                )}
            {/* Dynamic Role Header with Multi-Assignment Switcher */}
            <RoleHeader
              role={activeRole}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeDoctorName={session?.user?.legalName || activeDoctorName}
              openRegisterModal={() => setIsRegisterOpen(true)}
              openContactModal={() => setIsContactModalOpen(true)}
              onLogout={handleLogout}
              userName={session?.user?.legalName || session?.user?.username}
              userEmail={session?.user?.email}
              hospitalName={session?.activeMembership?.hospitalName || 'Metro General Hospital'}
              hospitalUid={session?.activeMembership?.hospitalUid || 'HOSP-METRO-001'}
              departmentName={session?.activeMembership?.departmentName || session?.activeMembership?.department || 'Facility-wide'}
              scopeType={session?.activeMembership?.scopeType || 'FACILITY'}
              assignments={session?.assignments || session?.activeMembership?.assignments}
              activeAssignmentId={session?.activeMembership?.activeAssignmentId}
              onSwitchAssignment={handleSwitchAssignment}
              token={session?.token}
            />

            {/* Scrollable Role Dashboard View */}
            <main className="flex-1 overflow-y-auto p-6 md:p-8">
              {activeRole === 'receptionist' && (
                <ReceptionistDashboard
                  appointments={appointments}
                  patients={patients}
                  doctors={doctors}
                  staff={staff}
                  receptionistName={session?.user?.legalName}
                  hospitalName={session?.activeMembership?.hospitalName || 'Metro General Hospital'}
                  departmentName={session?.activeMembership?.departmentName || session?.activeMembership?.department || 'General Medicine'}
                  scopeType={session?.activeMembership?.scopeType || 'FACILITY'}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  openRegisterModal={() => setIsRegisterOpen(true)}
                  openScheduleModal={() => setIsScheduleOpen(true)}
                  onCheckInPatient={handleCheckInPatient}
                  onUpdateStatus={handleUpdateStatus}
                  onOpenEditPatient={(patient) => {
                    setSelectedPatientForEdit(patient);
                    setIsEditPatientOpen(true);
                  }}
                  onOpenChangePassword={() => setIsChangePasswordOpen(true)}
                  effectivePermissions={session?.activeMembership?.effectivePermissions || session?.effectivePermissions || []}
                  currentTab={currentTab}
                  onTabChange={setCurrentTab}
                  token={session?.token}
                  username={session?.user?.username}
                  userEmail={session?.user?.email}
                  onOpenContactModal={() => setIsContactModalOpen(true)}
                  onToast={addToast}
                />
              )}

              {activeRole === 'doctor' && (
                <DoctorDashboard
                  doctorName={session?.user?.legalName || activeDoctorName}
                  appointments={appointments}
                  patients={patients}
                  onStartConsultation={handleStartConsultation}
                  onCompleteConsultation={handleCompleteConsultation}
                  onOpenPatientEMR={handleOpenPatientEMR}
                  searchQuery={searchQuery}
                  currentTab={currentTab}
                  onSelectTab={setCurrentTab}
                  session={session}
                  effectivePermissions={session?.activeMembership?.effectivePermissions || session?.effectivePermissions || []}
                  departmentName={session?.activeMembership?.departmentName || session?.activeMembership?.department || 'General Medicine'}
                  scopeType={session?.activeMembership?.scopeType || 'DEPARTMENT'}
                  onToast={addToast}
                  onRefreshData={loadClinicalData}
                  onOpenAssignmentSelector={() => setIsAssignmentSelectorOpen(true)}
                />
              )}

              {activeRole === 'nurse' && session?.activeMembership?.effectivePermissions?.includes('vitals:read') && (
                <NurseWorkspace
                  nurseName={session?.user?.legalName || 'Registered Nurse'}
                  departmentName={session?.activeMembership?.departmentName || 'General Inpatient Ward'}
                  patients={patients}
                  onToast={addToast}
                  currentTab={currentTab}
                  onSelectTab={setCurrentTab}
                  onOpenContactModal={() => setIsContactModalOpen(true)}
                  onOpenChangePassword={() => setIsChangePasswordOpen(true)}
                  onOpenChangeUsername={() => setIsChangeUsernameOpen(true)}
                  token={session?.token}
                  username={session?.user?.username}
                  userEmail={session?.user?.email}
                />
              )}

              {activeRole === 'nursing_supervisor' && (
                <NursingSupervisorDashboard
                  currentTab={currentTab}
                  onSelectTab={setCurrentTab}
                  session={session}
                  supervisorName={session?.user?.legalName || 'Nursing Services Supervisor'}
                  facilityName={session?.activeMembership?.hospitalName || 'Metro General Hospital'}
                  facilityUid={session?.activeMembership?.hospitalUid || 'HOSP-METRO-001'}
                  onToast={addToast}
                  token={session?.token}
                  username={session?.user?.username}
                  userEmail={session?.user?.email}
                  onOpenContactModal={() => setIsContactModalOpen(true)}
                  onOpenChangePassword={() => setIsChangePasswordOpen(true)}
                  onOpenChangeUsername={() => setIsChangeUsernameOpen(true)}
                />
              )}

              {activeRole === 'dept_head' && (
                <DepartmentHeadDashboard
                  currentTab={currentTab}
                  onSelectTab={setCurrentTab}
                  session={session}
                  effectivePermissions={session?.activeMembership?.effectivePermissions || session?.effectivePermissions || []}
                  departmentName={session?.activeAssignment?.departmentName || session?.activeMembership?.departmentName || 'Department'}
                  scopeType={session?.activeAssignment?.scopeType || 'DEPARTMENT'}
                  onToast={addToast}
                  onRefreshData={loadClinicalData}
                  onOpenAssignmentSelector={() => setIsAssignmentSelectorOpen(true)}
                  onOpenContactModal={() => setIsContactModalOpen(true)}
                />
              )}

              {activeRole === 'admin' && (
                <div className="flex-1 flex items-center justify-center p-8 text-center">
                  <div className="max-w-md bg-white rounded-2xl p-6 border border-slate-200 shadow-soft-sm">
                    <h2 className="text-base font-bold text-slate-900 mb-1">Hospital Administrator Assignment</h2>
                    <p className="text-xs text-slate-600 mb-4">
                      Your active assignment is Hospital Administrator. Click below to enter the Executive Administration Platform or switch to another assigned role.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      {session?.activeMembership?.assignments && session.activeMembership.assignments.length > 1 && (
                        <button
                          onClick={() => setIsAssignmentSelectorOpen(true)}
                          className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                        >
                          Switch Role
                        </button>
                      )}
                      <button
                        onClick={() => navigateTo('/admin/dashboard')}
                        className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-xl cursor-pointer"
                      >
                        Open Admin Platform
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeRole === 'staff' && (
                <GeneralStaffDashboard
                  staffName={session?.user?.legalName}
                  hospitalName={session?.activeMembership?.hospitalName || 'Metro General Hospital'}
                  departmentName={session?.activeMembership?.departmentName || session?.activeMembership?.department || 'Facility-wide'}
                  scopeType={session?.activeMembership?.scopeType || 'FACILITY'}
                  token={session?.token}
                  username={session?.user?.username}
                  userEmail={session?.user?.email}
                  effectivePermissions={session?.activeMembership?.effectivePermissions || session?.effectivePermissions || []}
                  currentTab={currentTab}
                  onTabChange={setCurrentTab}
                  onOpenChangePassword={() => setIsChangePasswordOpen(true)}
                  onOpenChangeUsername={() => setIsChangeUsernameOpen(true)}
                  onOpenContactModal={() => setIsContactModalOpen(true)}
                  onToast={addToast}
                />
              )}

              {activeRole === 'pharmacist' && (
                <PharmacistFutureScopeView
                  hospitalName={session?.activeMembership?.hospitalName || 'Hospital Facility'}
                  departmentName={session?.activeMembership?.departmentName || 'Dispensary'}
                  employeeName={session?.user?.legalName || 'Pharmacist'}
                  onSwitchAssignment={handleSwitchAssignment}
                  assignments={session?.assignments || []}
                />
              )}
            </main>
          </div>

          {/* Patient Intake Modal */}
          <RegisterPatientModal
            isOpen={isRegisterOpen}
            onClose={() => setIsRegisterOpen(false)}
            onRegister={handleRegisterPatient}
            doctors={doctors}
            departments={departments}
            token={session?.token}
            hospitalName={session?.activeMembership?.hospitalName || 'Hospital Facility'}
            departmentName={session?.activeMembership?.departmentName || 'General Medicine'}
          />

          {/* Appointment Scheduling Modal */}
          <ScheduleAppointmentModal
            isOpen={isScheduleOpen}
            onClose={() => setIsScheduleOpen(false)}
            onSchedule={handleScheduleAppointment}
            doctors={doctors}
            patients={patients}
            departments={departments}
            hospitalName={session?.activeMembership?.hospitalName || 'Hospital Facility'}
            departmentName={session?.activeMembership?.departmentName || 'General Medicine'}
            token={session?.token}
          />

          {/* Edit Patient Demographic Modal (patient:update) */}
          <EditPatientModal
            isOpen={isEditPatientOpen}
            onClose={() => {
              setIsEditPatientOpen(false);
              setSelectedPatientForEdit(null);
            }}
            patient={selectedPatientForEdit}
            doctors={doctors}
            onUpdate={handleUpdatePatient}
          />

          {/* Change Password Modal (Email Verification Reset Link) */}
          <ChangePasswordModal
            isOpen={isChangePasswordOpen}
            onClose={() => setIsChangePasswordOpen(false)}
            registeredEmail={session?.user?.email}
            token={session?.token}
            onSuccessToast={(msg) => addToast('Reset Link Dispatched', msg)}
          />

          {/* Change Username Modal (account:username:change) */}
          <ChangeUsernameModal
            isOpen={isChangeUsernameOpen}
            onClose={() => setIsChangeUsernameOpen(false)}
            currentUsername={session?.user?.username}
            token={session?.token}
            onSuccessToast={(msg, newUsername) => {
              addToast('Username Updated', msg);
              if (newUsername && session) {
                const updatedSession = {
                  ...session,
                  user: {
                    ...session.user,
                    username: newUsername,
                  },
                };
                setSession(updatedSession);
                authService.setStoredSession(updatedSession);
              }
            }}
          />

          {/* Doctor's Slide-Over EMR File Drawer */}
          <PatientRecordDrawer
            patient={selectedPatientForEMR}
            isOpen={isEMROpen}
            onClose={() => setIsEMROpen(false)}
            onStartConsultation={(patId) => {
              const apt = appointments.find(
                (a) =>
                  a.patientName === selectedPatientForEMR?.name ||
                  a.patientMrn === selectedPatientForEMR?.mrn
              );
              if (apt) handleStartConsultation(apt.id);
            }}
            onCompleteConsultation={(aptId) => {
              handleCompleteConsultation(aptId);
            }}
            appointments={appointments}
            token={session?.token}
            doctorName={session?.user?.legalName || activeDoctorName}
            departmentName={
              session?.activeMembership?.departmentName ||
              session?.activeMembership?.department ||
              'General Medicine'
            }
            onToast={addToast}
          />

          {/* Multi-Assignment Selector Modal */}
          <AssignmentSelectorModal
            isOpen={isAssignmentSelectorOpen}
            onClose={() => setIsAssignmentSelectorOpen(false)}
            canClose={Boolean(session?.activeMembership?.activeAssignmentId)}
            assignments={session?.activeMembership?.assignments || []}
            activeAssignmentId={session?.activeMembership?.activeAssignmentId}
            userName={session?.user?.legalName}
            hospitalName={session?.activeMembership?.hospitalName}
            onSelectAssignment={handleSwitchAssignment}
          />

          {/* Contact General Staff Modal (Internal Communication Dispatcher) */}
          <ContactGeneralStaffModal
            isOpen={isContactModalOpen}
            onClose={() => setIsContactModalOpen(false)}
            token={session?.token}
            senderRole={session?.activeAssignment?.roleName || session?.activeMembership?.role || activeRole}
            onMessageSent={() => {
              addToast('Request Dispatched', 'Your request has been dispatched to the selected General Staff member.');
            }}
          />

          {/* Micro-interaction Toasts */}
          <ToastContainer toasts={toasts} onDismiss={removeToast} />
        </div>
      );
    })()
  )}
    </div>
  );
}

export default App;
