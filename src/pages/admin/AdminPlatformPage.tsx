import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  ChevronRight,
  AlertCircle,
  Info,
  UserPlus,
  Send,
  RotateCcw,
  XCircle,
  Trash2,
  Mail,
  Phone,
  Briefcase,
  AlertTriangle,
  FileBarChart,
  Activity,
  Layers,
  Settings,
  Bell,
  LogOut,
  Search,
  Filter,
  UserCheck,
  Calendar,
  Lock,
  Stethoscope,
  DoorOpen,
  BedDouble,
  Boxes,
  FileText,
  TrendingUp,
  History,
  ArrowRight,
  Menu,
  X,
  ExternalLink,
  Sparkles,
  Plus,
  ChevronDown,
  Check,
  ShieldAlert,
} from 'lucide-react';
import {
  hospitalAdminApi,
  AdminOverviewMetrics,
  EmployeeItem,
  DepartmentItem,
  RoleItem,
  AuditItem,
  NotificationItem,
  EmployeeInviteItem,
  EmployeeAssignmentSlot,
} from '../../services/hospitalAdminApiClient';
import { InstitutionalLoadingScreen } from '../../components/common/InstitutionalLoadingScreen';
import { EmployeePermissionsDrawer } from '../../components/admin/EmployeePermissionsDrawer';
import { RoleVersionsModal } from '../../components/admin/RoleVersionsModal';
import { ApprovalsSection } from '../../components/admin/ApprovalsSection';
import { RevocationRequestsAdminSection } from '../../components/admin/RevocationRequestsAdminSection';
import { ContactGeneralStaffModal } from '../../components/communication/ContactGeneralStaffModal';
import { authService } from '../../services/authService';
import { clinicalApiClient } from '../../services/clinicalApiClient';
import { AssignmentSelectorModal } from '../../components/auth/AssignmentSelectorModal';
import { getRoleDashboardPath } from '../../App';

interface AdminPlatformPageProps {
  onNavigate: (path: string) => void;
}

type AdminTab =
  | 'overview'
  | 'employees'
  | 'invite-employee'
  | 'departments'
  | 'roles'
  | 'approvals'
  | 'revocations'
  | 'audit'
  | 'notifications'
  | 'security'
  | 'reports'
  | 'settings'
  | 'rosters'
  | 'operations';

export const AdminPlatformPage: React.FC<AdminPlatformPageProps> = ({ onNavigate }) => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Core Data
  const [adminProfile, setAdminProfile] = useState<{ user: any; hospital: any } | null>(null);
  const [overview, setOverview] = useState<AdminOverviewMetrics | null>(null);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pendingRevocationsCount, setPendingRevocationsCount] = useState(0);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [expandedRoleIds, setExpandedRoleIds] = useState<Set<string>>(new Set());

  const toggleRoleExpanded = (roleId: string) => {
    setExpandedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  // Loading & Feedback
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Inputs
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Modals & Forms
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteDesignation, setInviteDesignation] = useState('');
  const [invitationSlots, setInvitationSlots] = useState<
    Array<{
      id: string;
      scopeType: 'DEPARTMENT' | 'FACILITY';
      departmentId: string;
      roleId: string;
    }>
  >([{ id: '1', scopeType: 'DEPARTMENT', departmentId: '', roleId: '' }]);
  const [employeeInvitations, setEmployeeInvitations] = useState<EmployeeInviteItem[]>([]);
  const [employeeViewMode, setEmployeeViewMode] = useState<'roster' | 'invitations'>('roster');

  // Department creation (Pro / Ultra)
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');

  // Role creation (Pro / Ultra)
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleScope, setNewRoleScope] = useState<'hospital' | 'department'>('department');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Offboard / Status Modal
  const [selectedEmployeeForStatus, setSelectedEmployeeForStatus] = useState<EmployeeItem | null>(null);
  const [statusReason, setStatusReason] = useState('');

  // Notifications slide-over
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);

  // Multi-assignment role switcher
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const session = authService.getStoredSession();
  const assignments = session?.activeMembership?.assignments || [];

  const handleSwitchRole = async (assignmentId: string) => {
    if (!session) return;
    try {
      setActionLoading(true);
      const targetAssignment = assignments.find((a) => a.id === assignmentId);
      if (!targetAssignment) return;

      const switchRes = await clinicalApiClient.switchAssignment(assignmentId, session.token);
      const newRole = targetAssignment.roleCode;
      const effectivePerms = switchRes.effective_permissions || targetAssignment.permissions || [];

      const updatedSession = {
        ...session,
        token: switchRes.access_token || session.token,
        effectivePermissions: effectivePerms,
        activeAssignment: targetAssignment,
        activeMembership: {
          ...session.activeMembership,
          role: newRole as any,
          activeAssignmentId: targetAssignment.id,
          departmentId: targetAssignment.departmentId,
          department: targetAssignment.departmentName || session.activeMembership.department,
          departmentName: targetAssignment.departmentName,
          scopeType: targetAssignment.scopeType,
          effectivePermissions: effectivePerms,
        },
      };

      authService.setStoredSession(updatedSession);
      setRoleModalOpen(false);
      setRoleSwitcherOpen(false);

      if (newRole === 'admin') {
        showSuccess('Switched to Hospital Administrator role.');
      } else {
        onNavigate(getRoleDashboardPath(newRole));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to switch active assignment.');
    } finally {
      setActionLoading(false);
    }
  };

  // RBAC Modals & Drawers
  const [selectedEmployeeForPermissions, setSelectedEmployeeForPermissions] = useState<EmployeeItem | null>(null);
  const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
  const [selectedRoleForVersions, setSelectedRoleForVersions] = useState<RoleItem | null>(null);
  const [showVersionsModal, setShowVersionsModal] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Initial Load
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Verify admin session
      const me = await hospitalAdminApi.getAdminMe();
      setAdminProfile(me);
    } catch (err: any) {
      setErrorMessage(err.message || 'Session expired or unauthorized.');
      onNavigate('/admin/login');
      return;
    }

    try {
      // 2. Load overview metrics
      const ov = await hospitalAdminApi.getOverview().catch((e) => {
        console.warn('Non-fatal: could not load overview metrics', e);
        return null;
      });
      if (ov) setOverview(ov);

      // 3. Load departments, roles, notifications & pending revocations
      const activeToken = session?.token || hospitalAdminApi.getAdminToken() || undefined;
      const [deptsData, rolesData, notifsData, revsData] = await Promise.all([
        hospitalAdminApi.listDepartments().catch((e) => {
          console.warn('Non-fatal: could not load departments', e);
          return [];
        }),
        hospitalAdminApi.listRoles().catch((e) => {
          console.warn('Non-fatal: could not load roles', e);
          return [];
        }),
        hospitalAdminApi.listNotifications().catch((e) => {
          console.warn('Non-fatal: could not load notifications', e);
          return [];
        }),
        clinicalApiClient.adminGetRevocationRequests('PENDING', activeToken).catch(() => []),
      ]);
      setDepartments(deptsData);
      setRoles(rolesData);
      setNotifications(notifsData);
      setPendingRevocationsCount(revsData.length);
    } catch (err: any) {
      console.warn('Non-fatal dashboard data load error:', err);
    } finally {
      setLoading(false);
    }
  }, [onNavigate, session?.token]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Tab-specific fetchers
  const loadEmployees = useCallback(async () => {
    try {
      const emps = await hospitalAdminApi.listEmployees(
        employeeSearch || undefined,
        selectedDeptFilter || undefined,
        selectedStatusFilter || undefined
      );
      setEmployees(emps);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load employee list.');
    }
  }, [employeeSearch, selectedDeptFilter, selectedStatusFilter]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const logs = await hospitalAdminApi.listAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load audit history.');
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    try {
      const invs = await hospitalAdminApi.listEmployeeInvitations();
      setEmployeeInvitations(invs);
    } catch (err: any) {
      console.error('Failed to load employee invitations:', err);
    }
  }, []);

  useEffect(() => {
    if (currentTab === 'employees') {
      loadEmployees();
      loadInvitations();
    }
    if (currentTab === 'audit') {
      loadAuditLogs();
    }
  }, [currentTab, loadEmployees, loadInvitations, loadAuditLogs]);

  // Handlers
  const handleLogout = async () => {
    await hospitalAdminApi.logoutAdmin();
    onNavigate('/admin/login');
  };

  const addAssignmentSlot = () => {
    if (invitationSlots.length >= 5) return;
    setInvitationSlots((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        scopeType: 'DEPARTMENT',
        departmentId: '',
        roleId: '',
      },
    ]);
  };

  const removeAssignmentSlot = (id: string) => {
    if (invitationSlots.length <= 1) return;
    setInvitationSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const updateAssignmentSlot = (
    id: string,
    field: 'scopeType' | 'departmentId' | 'roleId',
    value: string
  ) => {
    setInvitationSlots((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (field === 'scopeType') {
          return {
            ...s,
            scopeType: value as 'DEPARTMENT' | 'FACILITY',
            departmentId: value === 'FACILITY' ? '' : s.departmentId,
            roleId: '', // Reset role on scope change
          };
        }
        if (field === 'departmentId') {
          return { ...s, departmentId: value };
        }
        if (field === 'roleId') {
          return { ...s, roleId: value };
        }
        return s;
      })
    );
  };

  const handleRevokeInvitation = async (invId: string) => {
    if (!window.confirm('Are you sure you wish to revoke this employee invitation? The invitation link will immediately become invalid.')) {
      return;
    }
    try {
      setActionLoading(true);
      await hospitalAdminApi.revokeEmployeeInvitation(invId);
      showSuccess('Employee invitation successfully revoked.');
      await loadInvitations();
      const ov = await hospitalAdminApi.getOverview();
      setOverview(ov);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to revoke invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendInvitation = async (invId: string) => {
    try {
      setActionLoading(true);
      await hospitalAdminApi.resendEmployeeInvitation(invId);
      showSuccess('Employee invitation link successfully refreshed and resent.');
      await loadInvitations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendEmployeeInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteFullName) return;

    if (invitationSlots.length === 0 || invitationSlots.length > 5) {
      setErrorMessage('Each invitation must configure between 1 and 5 assignment slots.');
      return;
    }

    // Validate completeness of slots
    for (let i = 0; i < invitationSlots.length; i++) {
      const slot = invitationSlots[i];
      if (slot.scopeType === 'DEPARTMENT' && !slot.departmentId) {
        setErrorMessage(`Assignment #${i + 1}: Please select a clinical department or change scope to Hospital-wide.`);
        return;
      }
      if (!slot.roleId) {
        setErrorMessage(`Assignment #${i + 1}: Please select a valid role.`);
        return;
      }
    }

    // Prevent duplicate department-role or facility-role pairs
    const seen = new Set<string>();
    for (let i = 0; i < invitationSlots.length; i++) {
      const slot = invitationSlots[i];
      const key = `${slot.scopeType === 'FACILITY' ? 'FACILITY' : slot.departmentId}::${slot.roleId}`;
      if (seen.has(key)) {
        setErrorMessage(`Duplicate assignment detected: Assignment #${i + 1} specifies the same scope and role pair as another slot.`);
        return;
      }
      seen.add(key);
    }

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const payloadSlots: EmployeeAssignmentSlot[] = invitationSlots.map((s) => ({
        scope_type: s.scopeType,
        department_id: s.scopeType === 'DEPARTMENT' ? s.departmentId : null,
        role_id: s.roleId,
      }));

      await hospitalAdminApi.inviteEmployee({
        email: inviteEmail.trim(),
        full_name: inviteFullName.trim(),
        phone: invitePhone.trim() || undefined,
        designation: inviteDesignation.trim() || undefined,
        assignments: payloadSlots,
      });

      showSuccess(`Employee invitation successfully dispatched to ${inviteEmail}.`);
      setInviteEmail('');
      setInviteFullName('');
      setInvitePhone('');
      setInviteDesignation('');
      setInvitationSlots([{ id: '1', scopeType: 'DEPARTMENT', departmentId: '', roleId: '' }]);
      setShowInviteModal(false);

      // Refresh overview & invitations
      const ov = await hospitalAdminApi.getOverview();
      setOverview(ov);
      await loadInvitations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to issue employee invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName || !newDeptCode) return;
    setActionLoading(true);
    setErrorMessage(null);

    try {
      await hospitalAdminApi.createDepartment({
        name: newDeptName.trim(),
        code: newDeptCode.trim().toUpperCase(),
        description: newDeptDesc.trim() || undefined,
      });

      showSuccess(`Department '${newDeptName}' created successfully.`);
      setNewDeptName('');
      setNewDeptCode('');
      setNewDeptDesc('');
      setShowDeptModal(false);

      const depts = await hospitalAdminApi.listDepartments();
      setDepartments(depts);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create department.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName || !newRoleCode) return;
    setActionLoading(true);
    setErrorMessage(null);

    try {
      await hospitalAdminApi.createRole({
        name: newRoleName.trim(),
        code: newRoleCode.trim().toLowerCase(),
        scope: newRoleScope,
        description: newRoleDesc.trim() || undefined,
      });

      showSuccess(`Custom role '${newRoleName}' created successfully.`);
      setNewRoleName('');
      setNewRoleCode('');
      setNewRoleDesc('');
      setShowRoleModal(false);

      const r = await hospitalAdminApi.listRoles();
      setRoles(r);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create role.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleEmployeeStatus = async (newStatus: 'active' | 'suspended' | 'terminated') => {
    if (!selectedEmployeeForStatus) return;
    setActionLoading(true);
    setErrorMessage(null);

    try {
      await hospitalAdminApi.updateEmployeeStatus(
        selectedEmployeeForStatus.id,
        newStatus,
        statusReason.trim() || undefined
      );

      showSuccess(`Employee status updated to ${newStatus.toUpperCase()}.`);
      setSelectedEmployeeForStatus(null);
      setStatusReason('');
      await loadEmployees();

      const ov = await hospitalAdminApi.getOverview();
      setOverview(ov);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update employee status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await hospitalAdminApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (e) {
      // ignore
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'A';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center font-sans">
        <InstitutionalLoadingScreen
          badge="ADMINISTRATIVE GOVERNANCE"
          title="Authorizing Institutional Console"
          subtitle="Loading hospital administrative matrix, clinical departments, and workforce registers."
          stages={[
            'Verifying cryptographic administrator session tokens...',
            'Establishing tenant boundary isolation handshake...',
            'Synchronizing departmental permissions and RBAC matrix...',
            'Calibrating real-time quota telemetry and audit logs...',
            'Preparing executive governance canvas...',
          ]}
        />
      </div>
    );
  }

  if (!adminProfile) return null;

  const planCode = adminProfile.hospital.plan_code;
  const isBasic = planCode === 'BASIC';
  const isPro = planCode === 'PRO';
  const isUltra = planCode === 'ULTRA';

  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;

  const getEventBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('LOGIN')) {
      return {
        label: 'Sign-In Event',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
      };
    }
    if (act.includes('INVIT')) {
      return {
        label: 'Invitation Dispatched',
        className: 'bg-teal-50 text-teal-800 border-teal-200/90',
      };
    }
    if (act.includes('REGISTER') || act.includes('CREATED')) {
      return {
        label: 'Intake Registered',
        className: 'bg-blue-50 text-blue-800 border-blue-200/90',
      };
    }
    if (act.includes('STATUS') || act.includes('REVOK') || act.includes('TERMINAT')) {
      return {
        label: 'Access Revision',
        className: 'bg-amber-50 text-amber-800 border-amber-200/90',
      };
    }
    return {
      label: 'Audit Event',
      className: 'bg-slate-100 text-slate-700 border-slate-200/90',
    };
  };

  return (
    <div className="flex h-screen bg-[#FAF7F2] text-slate-900 font-sans overflow-hidden">
      {/* MOBILE SIDEBAR BACKDROP */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 select-none shadow-soft-lg md:shadow-none transition-transform duration-300 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Institution Header Brand */}
          <div className="p-5 border-b border-slate-100/90 bg-gradient-to-b from-slate-50/60 to-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <Activity className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-sans text-xl font-extrabold tracking-tight text-slate-950 leading-none">
                    Aarogya
                  </span>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-teal-900 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/80">
                    ADMIN
                  </span>
                </div>
                <span
                  className="text-xs font-bold text-slate-900 truncate block mt-1"
                  title={adminProfile.hospital.name}
                >
                  {adminProfile.hospital.name}
                </span>
                <span className="font-mono text-[10px] text-teal-800 font-semibold block truncate">
                  {adminProfile.hospital.hospital_uid}
                </span>
              </div>
            </div>

            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 md:hidden cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items (Scrollable) */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
            <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400 font-bold">
              Core Governance
            </div>

            <button
              onClick={() => {
                setCurrentTab('overview');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'overview'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <Activity className={`w-4 h-4 ${currentTab === 'overview' ? 'text-teal-800' : 'text-slate-400'}`} />
              <span className="text-[13px]">Overview &amp; Metrics</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('employees');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'employees'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <Users className={`w-4 h-4 ${currentTab === 'employees' ? 'text-teal-800' : 'text-slate-400'}`} />
              <span className="text-[13px]">Employee Directory</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('departments');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'departments'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <Building2 className={`w-4 h-4 ${currentTab === 'departments' ? 'text-teal-800' : 'text-slate-400'}`} />
              <span className="text-[13px]">Clinical Departments</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('roles');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'roles'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <ShieldCheck className={`w-4 h-4 ${currentTab === 'roles' ? 'text-teal-800' : 'text-slate-400'}`} />
              <span className="text-[13px]">Roles &amp; Permissions</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('approvals');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'approvals'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <div className="flex items-center gap-3">
                <UserCheck className={`w-4 h-4 ${currentTab === 'approvals' ? 'text-teal-800' : 'text-slate-400'}`} />
                <span className="text-[13px]">Workforce Approvals</span>
              </div>
              {overview && overview.pending_registration_requests > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white font-mono shadow-xs">
                  {overview.pending_registration_requests}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setCurrentTab('revocations');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'revocations'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className={`w-4 h-4 ${currentTab === 'revocations' ? 'text-teal-800' : 'text-slate-400'}`} />
                <span className="text-[13px]">Revocation Requests</span>
              </div>
              {pendingRevocationsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white font-mono shadow-xs">
                  {pendingRevocationsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setCurrentTab('audit');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'audit'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <Layers className={`w-4 h-4 ${currentTab === 'audit' ? 'text-teal-800' : 'text-slate-400'}`} />
              <span className="text-[13px]">Activity &amp; Audit Centre</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('reports');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'reports'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <FileBarChart className={`w-4 h-4 ${currentTab === 'reports' ? 'text-teal-800' : 'text-slate-400'}`} />
              <span className="text-[13px]">Reports &amp; Analytics</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('security');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'security'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <Lock className={`w-4 h-4 ${currentTab === 'security' ? 'text-teal-800' : 'text-slate-400'}`} />
              <span className="text-[13px]">Security &amp; Access</span>
            </button>

            {/* Section Divider */}
            <div className="pt-4 pb-1 px-3 text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400 font-bold">
              Operations (Shells)
            </div>

            <button
              onClick={() => {
                setCurrentTab('rosters');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'rosters'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-[13px]">Workforce &amp; Rosters</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('operations');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'operations'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <Boxes className="w-4 h-4 text-slate-400" />
              <span className="text-[13px]">Facilities &amp; Inventory</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('settings');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${currentTab === 'settings'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
            >
              <Settings className={`w-4 h-4 ${currentTab === 'settings' ? 'text-teal-800' : 'text-slate-400'}`} />
              <span className="text-[13px]">Hospital Settings</span>
            </button>
          </nav>

          {/* User Identity & Logout Bottom Footer */}
          <div className="p-4 border-t border-slate-100/90 bg-[#FAF7F2]/60 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-900 border border-teal-200 flex items-center justify-center font-bold text-xs font-mono shrink-0 shadow-2xs">
                  {getInitials(adminProfile.user.full_name)}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-950 truncate block">
                    {adminProfile.user.full_name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-teal-800 font-mono font-medium block truncate">
                      Hospital Administrator
                    </span>
                  </div>
                  {assignments.length > 1 && (
                    <button
                      onClick={() => setRoleModalOpen(true)}
                      className="text-[10px] text-teal-800 font-semibold hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
                    >
                      <span>Switch Role ({assignments.length})</span>
                      <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Terminate administrator session"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW CANVAS */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP BAR */}
        <header className="h-20 bg-white border-b border-slate-200/90 px-6 sm:px-10 flex items-center justify-between shrink-0 z-10 shadow-2xs">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-800 md:hidden cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-950 tracking-[-0.01em] capitalize truncate">
                  {currentTab === 'overview' ? (
                    <>
                      Institutional <span className="text-[#1A6865] font-serif font-medium">Overview</span>
                    </>
                  ) : (
                    currentTab.replace('-', ' ')
                  )}
                </h1>

                {/* Tier-Specific Badge */}
                <div
                  className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider ${isUltra
                      ? 'bg-amber-50 text-amber-950 border border-amber-300'
                      : isPro
                        ? 'bg-teal-50 text-teal-950 border border-teal-200'
                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${isUltra ? 'bg-amber-600' : isPro ? 'bg-teal-600' : 'bg-slate-500'
                      }`}
                  />
                  <span>{adminProfile.hospital.plan_name} Tier</span>
                  <span className="text-[10px] font-normal text-slate-500 opacity-90">
                    · {adminProfile.hospital.max_administrators} Admins / {adminProfile.hospital.max_employees} Staff
                  </span>
                </div>
              </div>

              {currentTab === 'overview' && (
                <p className="text-xs text-slate-500 font-normal mt-0.5 hidden sm:block">
                  Real-time governance matrix, workforce distribution &amp; compliance metrics
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Multi-Assignment Role Switcher */}
            {assignments.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                  className="px-4 py-2 sm:py-2.5 rounded-full text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200/90 shadow-2xs transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  title="Switch between your active assignments in this hospital"
                >
                  <Briefcase className="w-4 h-4 text-teal-700" />
                  <span>Switch Role ({assignments.length})</span>
                  <ChevronDown className="w-3.5 h-3.5 text-teal-700" />
                </button>

                {roleSwitcherOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-fadeIn space-y-1">
                    <div className="px-3 py-1.5 text-[10.5px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                      <span>Hospital Role Placements</span>
                      <span className="text-teal-700 font-mono text-[10px]">{assignments.length} Roles</span>
                    </div>
                    {assignments.map((a) => {
                      const isCurrent = a.roleCode === 'admin';
                      return (
                        <button
                          key={a.id}
                          onClick={() => handleSwitchRole(a.id)}
                          className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-start justify-between cursor-pointer ${isCurrent
                              ? 'bg-teal-50 text-teal-950 font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                            }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{a.roleName}</div>
                            <div className="text-[11px] text-teal-700 mt-0.5">
                              {a.departmentName || 'Hospital-Wide'} • {a.scopeType}
                            </div>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Quick Action: Contact Staff */}
            <button
              onClick={() => setIsContactModalOpen(true)}
              className="p-2 sm:px-5 md:px-6 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 shadow-sm transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
              title="Contact Staff"
            >
              <Send className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden md:inline">Contact Staff</span>
            </button>

            {/* Quick Action: Invite Employee */}
            <button
              onClick={() => setShowInviteModal(true)}
              className="p-2 sm:px-5 md:px-6 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 shadow-sm transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
              title="Invite Employee"
            >
              <UserPlus className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden md:inline">Invite Employee</span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setShowNotificationsDrawer(true)}
              className="relative h-11 w-11 rounded-full bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:border-teal-600 shadow-2xs hover:shadow-soft-sm transition-all flex items-center justify-center cursor-pointer"
              title="View Institutional Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-600 border-2 border-white ring-1 ring-rose-500" />
              )}
            </button>
          </div>
        </header>

        {/* FLASH NOTIFICATIONS & ERROR ALERTS */}
        <div className="px-6 sm:px-10 pt-4">
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-900 flex items-center justify-between shadow-xs mb-4">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                <span className="font-normal">{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-500 hover:text-rose-800 font-bold cursor-pointer text-base leading-none"
              >
                &times;
              </button>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-900 flex items-center gap-2.5 shadow-xs mb-4">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}
        </div>

        {/* SCROLLABLE MODULE VIEW CANVAS */}
        <main className="flex-1 overflow-y-auto px-6 sm:px-10 py-6 space-y-8">
          {/* TAB: OVERVIEW */}
          {currentTab === 'overview' && overview && (
            <div className="space-y-8">
              {/* Welcome Header & Contact Staff Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
                    Welcome, {adminProfile?.user?.full_name || 'Hospital Administrator'}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                    Institutional Governance &amp; Executive Administration &bull; {adminProfile?.hospital?.name || 'Hospital'}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setIsContactModalOpen(true)}
                    className="px-6 py-3 text-sm md:text-base font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    <span>Contact Staff</span>
                  </button>
                </div>
              </div>

              {/* Workforce Stats 4 Highlight Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. Active Workforce */}
                <div
                  onClick={() => setCurrentTab('employees')}
                  className="group bg-white rounded-3xl border border-slate-200/90 p-6 shadow-soft-sm hover:shadow-soft-md hover:border-teal-300 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-[0.14em] font-bold text-slate-500">
                      Active Workforce
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-[#FAF7F2] border border-slate-200/80 flex items-center justify-center text-teal-800 group-hover:scale-105 transition-transform">
                      <Users className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <div className="my-3">
                    <div className="text-4xl sm:text-[44px] font-mono font-bold text-slate-950 tracking-tight">
                      {overview.active_employees}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span>{overview.total_employees} Total Memberships</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-800 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                {/* 2. Clinical Departments */}
                <div
                  onClick={() => setCurrentTab('departments')}
                  className="group bg-white rounded-3xl border border-slate-200/90 p-6 shadow-soft-sm hover:shadow-soft-md hover:border-teal-300 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-[0.14em] font-bold text-slate-500">
                      Clinical Departments
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-[#FAF7F2] border border-slate-200/80 flex items-center justify-center text-teal-800 group-hover:scale-105 transition-transform">
                      <Building2 className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <div className="my-3">
                    <div className="text-4xl sm:text-[44px] font-mono font-bold text-teal-900 tracking-tight">
                      {overview.department_count}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span>Active wings &amp; clinics</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-800 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                {/* 3. Active Administrators */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-soft-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-[0.14em] font-bold text-slate-500">
                      Active Administrators
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-[#FAF7F2] border border-slate-200/80 flex items-center justify-center text-teal-800">
                      <ShieldCheck className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <div className="my-3">
                    <div className="text-4xl sm:text-[44px] font-mono font-bold text-slate-950 tracking-tight">
                      {overview.active_admin_count} <span className="text-slate-400 font-light text-2xl">/</span>{' '}
                      {overview.quota_usage.admins_allowed}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span>Equal executive governance seats</span>
                  </div>
                </div>

                {/* 4. Pending Employee Invites */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-soft-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-[0.14em] font-bold text-slate-500">
                      Pending Employee Invites
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-center text-amber-700">
                      <Clock className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <div className="my-3">
                    <div className="text-4xl sm:text-[44px] font-mono font-bold text-amber-700 tracking-tight">
                      {overview.pending_employee_invites}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span>Awaiting staff registration</span>
                  </div>
                </div>
              </div>

              {/* Quota Progress Banner */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-soft-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold font-sans text-slate-950">
                          Subscription Quota Utilization
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                          {overview.quota_usage.plan_name} Tier
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-normal">
                        Live staffing utilization governed under institutional tenant license
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-slate-950">
                      Staff: {overview.active_employees} <span className="text-slate-400 font-normal">/</span>{' '}
                      {overview.quota_usage.employees_allowed}
                    </div>
                    <span className="text-xs font-semibold text-teal-800 font-mono">
                      {Math.round(
                        (overview.active_employees / Math.max(1, overview.quota_usage.employees_allowed)) * 100
                      )}
                      % capacity utilized
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100/80 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200/70">
                  <div
                    className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 h-full rounded-full transition-all duration-700 shadow-2xs"
                    style={{
                      width: `${Math.min(
                        100,
                        (overview.active_employees / Math.max(1, overview.quota_usage.employees_allowed)) * 100
                      )}%`,
                    }}
                  />
                </div>

                {/* Micro Meta Grid */}
                <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="text-slate-500">Administrator Allocation:</span>
                    <span className="font-mono font-bold text-slate-950">
                      {overview.active_admin_count} of {overview.quota_usage.admins_allowed} seats
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="text-slate-500">Remaining Staff Slots:</span>
                    <span className="font-mono font-bold text-teal-800">
                      {Math.max(0, overview.quota_usage.employees_allowed - overview.active_employees)} available
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="text-slate-500">Facility Accreditation:</span>
                    <span className="font-semibold text-emerald-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active &amp; Compliant
                    </span>
                  </div>
                </div>
              </div>

              {/* Two Column Section: Recent Activity & Institutional Notifications */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Column 1: Recent Administrative Activity */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-soft-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
                          <Activity className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold font-sans text-slate-950">
                            Recent Administrative Activity
                          </h3>
                          <span className="text-[11px] text-slate-400 font-normal">
                            Real-time facility access &amp; governance logs
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setCurrentTab('audit')}
                        className="text-xs text-teal-800 hover:text-teal-950 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>View All Logs</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {overview.recent_activity.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No recent administrative events recorded.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {overview.recent_activity.slice(0, 7).map((act) => {
                          const badge = getEventBadge(act.action);
                          return (
                            <div key={act.id} className="py-3.5 first:pt-0 last:pb-0 text-xs space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                  <span className="font-mono text-[11px] font-bold text-slate-900">
                                    {act.action}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono shrink-0">
                                  {new Date(act.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-[11.5px] text-slate-600 font-normal leading-relaxed pl-1">
                                {act.details}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2: Institutional Notifications & Alerts */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-soft-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                          <Bell className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold font-sans text-slate-950">
                            Institutional Notifications &amp; Alerts
                          </h3>
                          <span className="text-[11px] text-slate-400 font-normal">
                            System telemetry, compliance signals &amp; notices
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        {unreadNotifsCount} unread
                      </span>
                    </div>

                    {overview.important_alerts.length === 0 ? (
                      <div className="py-14 text-center px-4 max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                          <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Zero Operational Alerts
                        </h4>
                        <p className="text-xs text-slate-500 font-normal mt-1 leading-relaxed">
                          All hospital sub-systems, audit pipelines, and employee credential verifications are operating normally.
                        </p>
                        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Tenant Isolation Guard Active</span>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {overview.important_alerts.map((al) => (
                          <div key={al.id} className="py-3.5 first:pt-0 last:pb-0 text-xs space-y-1">
                            <span className="font-semibold text-slate-900 block text-[13px]">{al.title}</span>
                            <p className="text-slate-600 font-normal leading-relaxed">{al.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: EMPLOYEE DIRECTORY */}
          {currentTab === 'employees' && (
            <div className="space-y-6">
              {/* Directory Sub-navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setEmployeeViewMode('roster')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${employeeViewMode === 'roster'
                      ? 'bg-teal-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Active Workforce ({employees.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeViewMode('invitations')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${employeeViewMode === 'invitations'
                      ? 'bg-teal-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>
                    Invitations ({employeeInvitations.filter((i) => i.status === 'PENDING').length} pending)
                  </span>
                </button>
              </div>

              {employeeViewMode === 'roster' ? (
                <>
                  {/* Search & Filter Bar */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-soft-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      <div className="relative min-w-[240px] flex-1 sm:flex-initial">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search employees by name, email or UID..."
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-700 transition-colors"
                        />
                      </div>

                      <select
                        value={selectedDeptFilter}
                        onChange={(e) => setSelectedDeptFilter(e.target.value)}
                        className="px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-hidden focus:border-teal-700 cursor-pointer"
                      >
                        <option value="">All Departments</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={selectedStatusFilter}
                        onChange={(e) => setSelectedStatusFilter(e.target.value)}
                        className="px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-hidden focus:border-teal-700 cursor-pointer"
                      >
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="terminated">Terminated</option>
                      </select>
                    </div>

                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="px-6 py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Invite New Employee</span>
                    </button>
                  </div>

                  {/* Employee Table */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 font-mono text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                            <th className="py-4 px-6">Employee</th>
                            <th className="py-4 px-6">UID</th>
                            <th className="py-4 px-6">Department(s)</th>
                            <th className="py-4 px-6">Assigned Roles</th>
                            <th className="py-4 px-6">Status</th>
                            <th className="py-4 px-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {employees.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-14 text-center text-slate-400">
                                No employees found matching the selected criteria.
                              </td>
                            </tr>
                          ) : (
                            employees.map((emp) => (
                              <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                                      {getInitials(emp.full_name)}
                                    </div>
                                    <div>
                                      <span className="font-bold text-slate-950 block">{emp.full_name}</span>
                                      <span className="text-xs text-slate-500 font-mono">{emp.email}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-6 font-mono text-teal-900 font-semibold">{emp.employee_uid}</td>
                                <td className="py-4 px-6">
                                  {emp.departments.length > 0 ? (
                                    emp.departments.join(', ')
                                  ) : (
                                    <span className="text-slate-400">Unassigned</span>
                                  )}
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex flex-wrap gap-1.5">
                                    {emp.roles.map((r, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80"
                                      >
                                        {r}
                                      </span>
                                    ))}
                                    {emp.is_administrator && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-950 border border-teal-200">
                                        Admin
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${emp.status === 'active'
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : emp.status === 'suspended'
                                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                                      }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active'
                                          ? 'bg-emerald-500'
                                          : emp.status === 'suspended'
                                            ? 'bg-amber-500'
                                            : 'bg-rose-500'
                                        }`}
                                    />
                                    {emp.status}
                                  </span>
                                </td>
                                <td className="py-4 px-6 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2.5">
                                    <button
                                      onClick={() => {
                                        setSelectedEmployeeForPermissions(emp);
                                        setShowPermissionsDrawer(true);
                                      }}
                                      className="px-3 py-1.5 rounded-full text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                                      <span>Permissions</span>
                                    </button>
                                    <button
                                      onClick={() => setSelectedEmployeeForStatus(emp)}
                                      className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-all cursor-pointer"
                                    >
                                      Status
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-bold text-slate-900">Dispatched Employee Invitations</h4>
                      <p className="text-xs text-slate-500">
                        Track pending tokens, authorized multi-scope roles, and manage revocation.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Invite Employee</span>
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 font-mono text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                            <th className="py-4 px-6">Invitee</th>
                            <th className="py-4 px-6">Pre-Authorized Placements</th>
                            <th className="py-4 px-6">Status</th>
                            <th className="py-4 px-6">Timeline</th>
                            <th className="py-4 px-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {employeeInvitations.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-slate-400">
                                <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                No employee invitations have been issued yet.
                              </td>
                            </tr>
                          ) : (
                            employeeInvitations.map((inv) => (
                              <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-4 px-6">
                                  <div className="font-bold text-slate-900">{inv.full_name}</div>
                                  <div className="text-xs text-slate-500">{inv.email}</div>
                                  {inv.designation && (
                                    <div className="text-[11px] text-teal-800 font-medium mt-0.5">
                                      {inv.designation}
                                    </div>
                                  )}
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex flex-wrap gap-1 max-w-sm">
                                    {(inv.assignments || []).map((asg, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200"
                                      >
                                        <span className="font-mono text-[10px] text-teal-700 font-semibold">
                                          {asg.scope_type === 'FACILITY' ? 'Facility' : asg.department_name || 'Dept'}:
                                        </span>
                                        <strong>{asg.role_name}</strong>
                                      </span>
                                    ))}
                                    {(!inv.assignments || inv.assignments.length === 0) && (
                                      <span className="text-xs text-slate-400 italic">No slots specified</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${inv.status === 'ACCEPTED'
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : inv.status === 'PENDING'
                                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                          : inv.status === 'EXPIRED'
                                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                                      }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${inv.status === 'ACCEPTED'
                                          ? 'bg-emerald-500'
                                          : inv.status === 'PENDING'
                                            ? 'bg-amber-500'
                                            : 'bg-slate-400'
                                        }`}
                                    />
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="py-4 px-6 text-xs text-slate-500">
                                  <div>Sent: {new Date(inv.created_at).toLocaleDateString()}</div>
                                  <div className="text-[11px] text-slate-400">
                                    Expires: {new Date(inv.expires_at).toLocaleDateString()}
                                  </div>
                                </td>
                                <td className="py-4 px-6 text-right whitespace-nowrap">
                                  {inv.status === 'PENDING' && (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => handleResendInvitation(inv.id)}
                                        title="Resend invitation email"
                                        className="p-1.5 rounded-lg text-slate-600 hover:text-teal-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleRevokeInvitation(inv.id)}
                                        title="Revoke invitation"
                                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                      >
                                        <XCircle className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                  {inv.status !== 'PENDING' && (
                                    <span className="text-xs text-slate-400 italic">None</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: DEPARTMENTS */}
          {currentTab === 'departments' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold font-sans text-slate-950">
                    Clinical Departments ({departments.length})
                  </h3>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">
                    {isBasic
                      ? 'Basic Tier: Standardized predefined clinical departments.'
                      : 'Pro & Ultra: Configurable departmental wings and specialized clinical divisions.'}
                  </p>
                </div>

                {isBasic ? (
                  <div className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 self-start sm:self-auto">
                    Predefined Catalogue (Basic Tier)
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeptModal(true)}
                    className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
                  >
                    <span>+ Add Department</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {departments.map((dept) => {
                  const isFutureScope = dept.code === 'DISP' || (dept as any).is_future_scope;
                  return (
                    <div
                      key={dept.id}
                      className={`bg-white rounded-3xl border p-6 shadow-soft-sm hover:shadow-soft-md transition-all space-y-3 ${isFutureScope ? 'border-amber-200/90 bg-amber-50/20' : 'border-slate-200/90'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                            {dept.code}
                          </span>
                          {isFutureScope && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              Future Scope
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          {dept.employee_count} Staff Assigned
                        </span>
                      </div>
                      <h4 className="text-lg font-bold font-sans text-slate-950">{dept.name}</h4>
                      <p className="text-xs text-slate-500 font-light leading-relaxed">
                        {dept.description || 'Specialized institutional clinical department.'}
                      </p>
                      {isFutureScope && (
                        <div className="pt-2 border-t border-amber-100 text-[11px] text-amber-800 font-medium">
                          Planned future department: Medication dispensing and central pharmacy services.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: ROLES & PERMISSIONS */}
          {currentTab === 'roles' && (() => {
            const visibleRoles = roles.filter(
              (r) => r.code !== 'admin' && !r.name.toLowerCase().includes('hospital admin')
            );

            return (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold font-sans text-slate-950">
                      Hospital Roles ({visibleRoles.length})
                    </h3>
                    <p className="text-xs text-slate-500 font-normal mt-0.5">
                      {isBasic
                        ? 'Basic Tier: Standardized clinical roles with backend-enforced operational permissions.'
                        : isPro
                          ? 'Pro Tier: Configurable roles within clinical permission boundaries.'
                          : 'Ultra Tier: Granular institutional RBAC.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 self-start sm:self-auto">
                    {visibleRoles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (expandedRoleIds.size === visibleRoles.length) {
                            setExpandedRoleIds(new Set());
                          } else {
                            setExpandedRoleIds(new Set(visibleRoles.map((r) => r.id)));
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-all cursor-pointer"
                      >
                        {expandedRoleIds.size === visibleRoles.length
                          ? 'Collapse All Permissions'
                          : 'Expand All Permissions'}
                      </button>
                    )}

                    {isBasic ? (
                      <div className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        Standard Roles (Basic Tier)
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowRoleModal(true)}
                        className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span>+ Create Role</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {visibleRoles.map((role) => {
                    const isFutureScope = role.code === 'pharmacist' || (role as any).is_future_scope;
                    const isExpanded = expandedRoleIds.has(role.id);
                    const perms = role.permission_codes || [];
                    const displayedPerms = isExpanded ? perms : perms.slice(0, 8);
                    const hasMore = perms.length > 8;

                    return (
                      <div
                        key={role.id}
                        className={`bg-white rounded-3xl border p-6 shadow-soft-sm hover:shadow-soft-md transition-all space-y-4 flex flex-col justify-between ${isFutureScope ? 'border-amber-200/90 bg-amber-50/20' : 'border-slate-200/90'
                          }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                {role.code}
                              </span>
                              {isFutureScope && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  Future Scope
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] uppercase font-mono tracking-wider text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200/70">
                              {role.scope} Scope
                            </span>
                          </div>
                          <h4 className="text-lg font-bold font-sans text-slate-950">{role.name}</h4>
                          <p className="text-xs text-slate-500 font-light leading-relaxed">
                            {role.description || 'Institutional operational responsibility.'}
                          </p>
                          {isFutureScope && (
                            <div className="pt-2 border-t border-amber-100 text-[11px] text-amber-800 font-medium">
                              Planned future role: Medication dispensing and stock operations are non-operational.
                            </div>
                          )}

                          {/* Updated Backend Permissions Badges (Styled matching screenshot) */}
                          <div className="pt-3 border-t border-slate-100 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800">
                                Standard Version 1 Permissions ({perms.length}):
                              </span>
                              {hasMore && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRoleExpanded(role.id);
                                  }}
                                  className="text-[11px] font-semibold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer"
                                >
                                  {isExpanded ? 'Collapse' : `+${perms.length - 8} more`}
                                </button>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto pr-1">
                              {displayedPerms.map((code) => (
                                <span
                                  key={code}
                                  className="px-2 py-0.5 rounded text-[10.5px] font-mono bg-white border border-slate-200 text-slate-800 shadow-2xs hover:border-teal-300 transition-colors"
                                >
                                  {code}
                                </span>
                              ))}
                              {!isExpanded && hasMore && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRoleExpanded(role.id);
                                  }}
                                  className="px-2 py-0.5 rounded text-[10.5px] font-mono bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer transition-colors"
                                >
                                  +{perms.length - 8} more...
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span>{role.employee_count} active employees</span>
                          <button
                            onClick={() => {
                              setSelectedRoleForVersions(role);
                              setShowVersionsModal(true);
                            }}
                            className="text-teal-800 hover:text-teal-950 font-bold hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>Versions &amp; Permissions</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* TAB: WORKFORCE APPROVALS */}
          {currentTab === 'approvals' && (
            <ApprovalsSection
              planCode={planCode as 'BASIC' | 'PRO' | 'ULTRA'}
              onApprovalCompleted={loadInitialData}
              token={session?.token}
            />
          )}

          {/* TAB: REVOCATION REQUESTS */}
          {currentTab === 'revocations' && (
            <RevocationRequestsAdminSection
              token={session?.token}
              onRequestDecided={() => {
                loadInitialData();
                clinicalApiClient
                  .adminGetRevocationRequests('PENDING', session?.token)
                  .then((revs) => setPendingRevocationsCount(revs.length))
                  .catch(() => { });
              }}
            />
          )}

          {/* TAB: ACTIVITY & AUDIT CENTRE */}
          {currentTab === 'audit' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold font-sans text-slate-950">Institutional Audit Centre</h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Immutable, append-only chronological log of all administrative, governance, and workforce events.
                </p>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {auditLogs.length === 0 ? (
                    <div className="py-14 text-center text-xs text-slate-400">No audit events logged.</div>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-xs font-bold text-teal-950 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                              {log.action}
                            </span>
                            <span className="font-semibold text-slate-900 text-sm">{log.resource_type}</span>
                          </div>
                          <p className="text-slate-600 font-normal leading-relaxed">{log.details}</p>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span className="text-xs text-slate-600 font-medium block">
                            Actor: {log.actor_name || 'System / Purchaser'}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: REPORTS & ANALYTICS */}
          {currentTab === 'reports' && overview && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold font-sans text-slate-950">
                  Workforce &amp; Institutional Analytics
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Backend-backed summaries of staffing distribution and institutional governance metrics.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-soft-sm space-y-4">
                  <h4 className="text-base font-bold text-slate-950 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-teal-800" />
                    <span>Staff Distribution by Department</span>
                  </h4>
                  <div className="space-y-4 pt-2">
                    {departments.map((d) => (
                      <div key={d.id} className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-800">{d.name}</span>
                          <span className="font-mono font-bold text-slate-950">{d.employee_count} staff</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-teal-700 h-2 rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                overview.active_employees > 0
                                  ? (d.employee_count / overview.active_employees) * 100
                                  : 0
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-soft-sm space-y-4">
                  <h4 className="text-base font-bold text-slate-950 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-teal-800" />
                    <span>Tier Governance Summary</span>
                  </h4>
                  <div className="space-y-2 text-xs divide-y divide-slate-100 pt-2">
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-500">Subscription Tier:</span>
                      <span className="font-bold text-slate-950">{overview.quota_usage.plan_name}</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-500">Administrator Seats:</span>
                      <span className="font-mono font-bold text-slate-950">
                        {overview.active_admin_count} of {overview.quota_usage.admins_allowed} allocated
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-500">Staff Headcount Limit:</span>
                      <span className="font-mono font-bold text-slate-950">
                        {overview.active_employees} of {overview.quota_usage.employees_allowed} used
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-500">Audit Vault Policy:</span>
                      <span className="font-semibold text-slate-950">Append-Only Immutable</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SECURITY & ACCESS */}
          {currentTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold font-sans text-slate-950">Security &amp; Tenant Access</h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Tenant-scoped session management, Argon2id password encryption, and multi-hospital isolation.
                </p>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-soft-sm space-y-5">
                <h4 className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-teal-800" />
                  <span>Hospital Security Architecture</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
                  <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-slate-200/90 text-xs space-y-1.5">
                    <strong className="block text-slate-950 font-bold text-sm">Argon2id Hashing</strong>
                    <p className="text-slate-600 font-normal leading-relaxed">
                      All employee passwords are encrypted with Argon2id salt. Plaintext is never stored.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-slate-200/90 text-xs space-y-1.5">
                    <strong className="block text-slate-950 font-bold text-sm">HttpOnly Sessions</strong>
                    <p className="text-slate-600 font-normal leading-relaxed">
                      Session cookies are protected from JavaScript access and invalidated on logout or admin removal.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-slate-200/90 text-xs space-y-1.5">
                    <strong className="block text-slate-950 font-bold text-sm">Tenant Isolation</strong>
                    <p className="text-slate-600 font-normal leading-relaxed">
                      Every query is strictly constrained by hospital ID. Cross-tenant reads are cryptographically prevented.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: WORKFORCE & ROSTERS (HONEST EMPTY SHELL) */}
          {currentTab === 'rosters' && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-soft-sm space-y-3 max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 font-sans">
                Workforce &amp; Shift Rostering Module
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
                Shift definitions, rotation assignments, and attendance logs are architecturally structured and will be enabled in the upcoming Clinical Operations release.
              </p>
              <div className="inline-block px-3.5 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 mt-2">
                Status: Future Scope (Pharmacy &amp; Supply Chain Deferred)
              </div>
            </div>
          )}

          {/* TAB: FACILITIES & INVENTORY (HONEST EMPTY SHELL) */}
          {currentTab === 'operations' && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-soft-sm space-y-3 max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 font-sans">
                Facilities, Beds &amp; Inventory Operations
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
                Bed allocation, ward occupancy tracking, pharmacy inventory, and medical supply chain modules are staged for institutional operations integration.
              </p>
              <div className="inline-block px-3.5 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 mt-2">
                Status: Future Scope (Pharmacy &amp; Supply Chain Deferred)
              </div>
            </div>
          )}

          {/* TAB: HOSPITAL SETTINGS */}
          {currentTab === 'settings' && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-soft-sm space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-bold font-sans text-slate-950">
                  Hospital Facility Configuration
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Institutional profile and facility registration settings.
                </p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm divide-y divide-slate-100">
                <div className="flex justify-between py-3">
                  <span className="text-slate-500">Official Facility Name:</span>
                  <span className="font-bold text-slate-950">{adminProfile.hospital.name}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-slate-500">Immutable Hospital UID:</span>
                  <span className="font-mono text-teal-900 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {adminProfile.hospital.hospital_uid}
                  </span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-slate-500">Municipality / City:</span>
                  <span className="text-slate-900 font-medium">{adminProfile.hospital.city}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-slate-500">Assigned Plan Tier:</span>
                  <span className="font-semibold text-teal-900">{adminProfile.hospital.plan_name}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-slate-500">Employee Self-Registration:</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Enabled
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: INVITE EMPLOYEE (UP TO 5 INDEPENDENT SCOPE-ROLE ASSIGNMENTS) */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div>
                <h3 className="text-lg font-bold font-sans text-slate-950 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-teal-800" />
                  <span>Invite Employee to Facility</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pre-authorize up to 5 multi-scope role placements. The invitee claims these via a dedicated invitation link.
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendEmployeeInvite} className="space-y-5 overflow-y-auto pr-1 flex-1">
              {/* Employee Information */}
              <div className="space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-teal-900 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-700" />
                  1. Employee Information
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Full Legal Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={inviteFullName}
                        onChange={(e) => setInviteFullName(e.target.value)}
                        placeholder="e.g. Employee Full Legal Name"
                        className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-teal-700 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Official Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="doctor@hospital.org"
                        className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-teal-700 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Contact Phone
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        value={invitePhone}
                        onChange={(e) => setInvitePhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-teal-700 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Designation
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={inviteDesignation}
                        onChange={(e) => setInviteDesignation(e.target.value)}
                        placeholder="e.g. Senior Cardiologist"
                        className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-teal-700 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Assignment Slots */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-teal-900 font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-700" />
                    2. Scope &amp; Role Assignments ({invitationSlots.length}/5)
                  </h4>
                  {invitationSlots.length < 5 && (
                    <button
                      type="button"
                      onClick={addAssignmentSlot}
                      className="text-xs font-bold text-teal-800 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Slot</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {invitationSlots.map((slot, idx) => {
                    const compatibleRoles = roles.filter((r) => {
                      if (r.code === 'admin') return false; // Never allow admin role via employee invitation
                      if (!r.is_active) return false;
                      if (slot.scopeType === 'FACILITY') {
                        return r.scope === 'hospital';
                      } else {
                        return r.scope === 'department';
                      }
                    });

                    return (
                      <div
                        key={slot.id}
                        className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-900 text-[10px] font-mono font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            Assignment Slot #{idx + 1}
                          </span>
                          {invitationSlots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAssignmentSlot(slot.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                              title="Remove this slot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Scope Selector */}
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700 mb-1">
                              Placement Scope <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={slot.scopeType === 'FACILITY' ? 'FACILITY' : slot.departmentId}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'FACILITY') {
                                  updateAssignmentSlot(slot.id, 'scopeType', 'FACILITY');
                                } else {
                                  updateAssignmentSlot(slot.id, 'scopeType', 'DEPARTMENT');
                                  updateAssignmentSlot(slot.id, 'departmentId', val);
                                }
                              }}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-teal-700 cursor-pointer"
                            >
                              <option value="" disabled>Select Scope / Department</option>
                              <option value="FACILITY">Hospital-wide (Facility Scope)</option>
                              <optgroup label="Clinical Departments">
                                {departments.map((d) => {
                                  const isFs = d.code === 'DISP' || (d as any).is_future_scope;
                                  return (
                                    <option key={d.id} value={d.id}>
                                      {d.name} ({d.code}){isFs ? ' — Future Scope' : ''}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            </select>
                          </div>

                          {/* Role Selector */}
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700 mb-1">
                              Assigned Role <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={slot.roleId}
                              onChange={(e) => updateAssignmentSlot(slot.id, 'roleId', e.target.value)}
                              disabled={slot.scopeType === 'DEPARTMENT' && !slot.departmentId}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-teal-700 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="">
                                {slot.scopeType === 'DEPARTMENT' && !slot.departmentId
                                  ? 'Select department first'
                                  : 'Select Compatible Role'}
                              </option>
                              {compatibleRoles.map((r) => {
                                const isFs = r.code === 'pharmacist' || (r as any).is_future_scope;
                                return (
                                  <option key={r.id} value={r.id}>
                                    {r.name}{isFs ? ' — Future Scope (Non-operational)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>

                        {roles.find((r) => r.id === slot.roleId)?.code === 'pharmacist' && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Future Scope Notice:</span> Pharmacist and dispensary operations (dispensing, queue, stock tracking) are deferred to future scope and currently non-operational.
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {invitationSlots.length < 5 && (
                  <button
                    type="button"
                    onClick={addAssignmentSlot}
                    className="w-full py-2 border border-dashed border-slate-300 hover:border-teal-700 hover:bg-teal-50/50 rounded-xl text-xs font-semibold text-slate-600 hover:text-teal-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Assignment Slot ({invitationSlots.length}/5)</span>
                  </button>
                )}
              </div>

              {/* Summary of Pre-Authorized Placements */}
              <div className="rounded-2xl bg-teal-50/60 border border-teal-200/80 p-3.5 space-y-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-800" />
                  Pre-Authorized Placements Summary
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {invitationSlots.map((s, i) => {
                    const dept = departments.find((d) => d.id === s.departmentId);
                    const role = roles.find((r) => r.id === s.roleId);
                    const scopeLabel = s.scopeType === 'FACILITY' ? 'Hospital-wide' : dept?.name || 'Department unset';
                    const roleLabel = role?.name || 'Role unset';
                    const isValid = (s.scopeType === 'FACILITY' || s.departmentId) && s.roleId;

                    return (
                      <span
                        key={s.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${isValid
                            ? 'bg-white text-teal-950 border-teal-200 shadow-2xs'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                      >
                        <span className="text-[10px] uppercase font-mono font-bold text-teal-700">
                          Slot {i + 1}:
                        </span>
                        <span>{scopeLabel} &rarr; <strong>{roleLabel}</strong></span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-all cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{actionLoading ? 'Dispatching...' : 'Dispatch Invitation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE DEPARTMENT (PRO / ULTRA ONLY) */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold font-sans text-slate-950 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal-800" />
              <span>Create Clinical Department</span>
            </h3>

            <form onSubmit={handleCreateDepartment} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Department Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Oncology Division"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Department Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                  placeholder="e.g. ONC"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-teal-700 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDeptDesc}
                  onChange={(e) => setNewDeptDesc(e.target.value)}
                  placeholder="Specialty inpatient and outpatient oncology therapies..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-teal-700"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-full text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 cursor-pointer disabled:opacity-50"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ROLE (PRO / ULTRA ONLY) */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold font-sans text-slate-950 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-800" />
              <span>Create Custom Role</span>
            </h3>

            <form onSubmit={handleCreateRole} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Role Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Lead Nurse Supervisor"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Role Identifier Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newRoleCode}
                  onChange={(e) => setNewRoleCode(e.target.value)}
                  placeholder="e.g. nurse_sup"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-teal-700 lowercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Scope
                </label>
                <select
                  value={newRoleScope}
                  onChange={(e) => setNewRoleScope(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-teal-700 cursor-pointer"
                >
                  <option value="department">Department-Scoped</option>
                  <option value="hospital">Hospital-Wide</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-full text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 cursor-pointer disabled:opacity-50"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE EMPLOYEE STATUS & OFFBOARD */}
      {selectedEmployeeForStatus && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-xl border border-slate-200 space-y-4 text-xs">
            <h3 className="text-base font-bold font-sans text-slate-950 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-teal-800" />
              <span>Manage Employee Access: {selectedEmployeeForStatus.full_name}</span>
            </h3>

            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-slate-200/90 space-y-1.5 text-slate-600">
              <div>
                UID:{' '}
                <span className="font-mono font-bold text-teal-900">
                  {selectedEmployeeForStatus.employee_uid}
                </span>
              </div>
              <div>Email: {selectedEmployeeForStatus.email}</div>
              <div>
                Current Status:{' '}
                <span className="font-semibold text-slate-900 uppercase">
                  {selectedEmployeeForStatus.status}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Reason / Administrative Notes
              </label>
              <input
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="e.g. Leave of absence / departmental offboarding"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-teal-700"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {selectedEmployeeForStatus.status !== 'active' && (
                <button
                  onClick={() => handleToggleEmployeeStatus('active')}
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                >
                  Reactivate Employee Access
                </button>
              )}

              {selectedEmployeeForStatus.status === 'active' && (
                <button
                  onClick={() => handleToggleEmployeeStatus('suspended')}
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all cursor-pointer"
                >
                  Suspend Access (Revoke Active Sessions)
                </button>
              )}

              {selectedEmployeeForStatus.status !== 'terminated' && (
                <button
                  onClick={() => handleToggleEmployeeStatus('terminated')}
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
                >
                  Terminate Membership (Permanent Offboarding)
                </button>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setSelectedEmployeeForStatus(null)}
                className="px-5 py-2 rounded-full text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS SLIDE-OVER DRAWER */}
      {showNotificationsDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-sm h-full shadow-2xl p-6 sm:p-7 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold font-sans text-slate-950 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-teal-800" />
                  <span>Institutional Notifications</span>
                </h3>
                <button
                  onClick={() => setShowNotificationsDrawer(false)}
                  className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-xl leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="divide-y divide-slate-100 overflow-y-auto max-h-[75vh]">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center">No notifications present.</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="py-3.5 first:pt-0 last:pb-0 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-semibold ${n.is_read ? 'text-slate-700' : 'text-teal-950 font-bold'
                            }`}
                        >
                          {n.title}
                        </span>
                        {!n.is_read && (
                          <button
                            onClick={() => handleMarkNotificationRead(n.id)}
                            className="text-[10px] text-teal-800 hover:underline font-bold cursor-pointer"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                      <p className="text-slate-500 font-normal leading-relaxed">{n.message}</p>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setShowNotificationsDrawer(false)}
              className="w-full py-3 rounded-full text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Authoritative RBAC Effective Permissions & Overrides Drawer */}
      <EmployeePermissionsDrawer
        isOpen={showPermissionsDrawer}
        onClose={() => setShowPermissionsDrawer(false)}
        employee={selectedEmployeeForPermissions}
        planCode={planCode as 'BASIC' | 'PRO' | 'ULTRA'}
        departments={departments}
        roles={roles}
        onRefreshEmployees={loadEmployees}
      />

      {/* Role Version History & New Version Authoring Modal */}
      <RoleVersionsModal
        isOpen={showVersionsModal}
        onClose={() => setShowVersionsModal(false)}
        role={selectedRoleForVersions}
        allRoles={roles}
        planCode={planCode as 'BASIC' | 'PRO' | 'ULTRA'}
        onVersionUpdated={loadInitialData}
      />

      {/* Role Assignment Modal */}
      {roleModalOpen && (
        <AssignmentSelectorModal
          isOpen={roleModalOpen}
          onClose={() => setRoleModalOpen(false)}
          canClose={true}
          assignments={assignments}
          activeAssignmentId={session?.activeMembership?.activeAssignmentId}
          userName={adminProfile.user.full_name}
          hospitalName={adminProfile.hospital.name}
          onSelectAssignment={handleSwitchRole}
        />
      )}

      {/* Contact Staff Modal */}
      <ContactGeneralStaffModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        token={session?.token}
        senderRole="admin"
      />
    </div>
  );
};
