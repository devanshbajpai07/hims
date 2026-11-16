import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Patient, Appointment } from '../../types';
import { AuthSession } from '../../types/auth';
import {
  clinicalApiClient,
  DepartmentHeadSummary,
  DepartmentEmployee,
  RevocationRequest,
  EmployeeMessage,
  PatientConsultancyReportDetail,
} from '../../services/clinicalApiClient';
import { authService } from '../../services/authService';
import { ConsultancyReportViewerModal } from '../../components/clinical/ConsultancyReportViewerModal';
import {
  Users,
  Calendar,
  Clock,
  FileText,
  AlertCircle,
  Shield,
  ShieldCheck,
  Activity,
  Heart,
  RefreshCw,
  Search,
  Filter,
  KeyRound,
  Check,
  X,
  UserCheck,
  Stethoscope,
  AlertTriangle,
  Eye,
  ShieldAlert,
  Send,
  MessageSquare,
  ClipboardList,
  BarChart3,
  CheckCircle2,
  Lock,
  ChevronRight,
  UserX,
  Mail,
  Building2,
  Trash2,
  CheckSquare,
  Square,
  UserCog,
  Printer,
  FolderOpen,
} from 'lucide-react';

interface DepartmentHeadDashboardProps {
  currentTab?: string;
  onSelectTab?: (tabId: string) => void;
  session?: AuthSession | null;
  effectivePermissions?: string[];
  departmentName?: string;
  scopeType?: string;
  onToast?: (title: string, desc: string) => void;
  onRefreshData?: () => void;
  onOpenAssignmentSelector?: () => void;
  onOpenContactModal?: () => void;
}

export const DepartmentHeadDashboard: React.FC<DepartmentHeadDashboardProps> = ({
  currentTab = 'overview',
  onSelectTab,
  session,
  effectivePermissions = [],
  departmentName = 'Cardiology',
  scopeType = 'DEPARTMENT',
  onToast,
  onRefreshData,
  onOpenAssignmentSelector,
  onOpenContactModal,
}) => {
  const employeeName = session?.user?.legalName || session?.user?.username || 'Department Head';
  const token = session?.token;
  const username = session?.user?.username;
  const userEmail = session?.user?.email;

  const [internalTab, setInternalTab] = useState<string>(currentTab);
  const activeTab = onSelectTab ? currentTab : internalTab;
  const switchTab = (tab: string) => {
    if (onSelectTab) onSelectTab(tab);
    else setInternalTab(tab);
  };

  // ---------------------------------------------------------------------------
  // 1. DASHBOARD SUMMARY
  // ---------------------------------------------------------------------------
  const [summary, setSummary] = useState<DepartmentHeadSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const data = await clinicalApiClient.getDepartmentHeadSummary(token);
      setSummary(data);
    } catch (err: any) {
      console.warn('Could not fetch department head summary:', err);
      setSummaryError(err.message || 'Unable to retrieve department overview.');
    } finally {
      setSummaryLoading(false);
    }
  }, [token]);

  // ---------------------------------------------------------------------------
  // 2. PATIENTS & CLINICAL RECORDS (SCOPED TO DEPARTMENT)
  // ---------------------------------------------------------------------------
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      setPatientsLoading(true);
      setPatientsError(null);
      const data = await clinicalApiClient.getPatients(token);
      setPatients(data);
    } catch (err: any) {
      console.warn('Could not fetch department patients:', err);
      setPatientsError(err.message || 'Unable to retrieve department patient roster.');
    } finally {
      setPatientsLoading(false);
    }
  }, [token]);

  // Date filter for Patient Details (default yesterday)
  const getYesterdayIso = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };
  const getTodayIso = () => new Date().toISOString().split('T')[0];

  const [patientRecordDate, setPatientRecordDate] = useState<string>(getYesterdayIso());
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatientForEMR, setSelectedPatientForEMR] = useState<Patient | null>(null);

  // Filebase S3 Consultation Report Viewer for Department Head
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReportDetail, setSelectedReportDetail] = useState<PatientConsultancyReportDetail | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportPatientName, setReportPatientName] = useState('');
  const [reportPatientMrn, setReportPatientMrn] = useState('');

  const handleOpenConsultancyReport = async (patientMrnOrId: string, name?: string) => {
    try {
      setReportLoading(true);
      setReportPatientName(name || '');
      setReportPatientMrn(patientMrnOrId);
      setReportModalOpen(true);
      const res = await clinicalApiClient.getPatientConsultancyReport(patientMrnOrId, token);
      setSelectedReportDetail(res);
    } catch (err: any) {
      console.warn('Could not fetch consultation report for dept head:', err);
      setSelectedReportDetail({
        hasReport: false,
        patientName: name || 'Patient',
        patientMrn: patientMrnOrId,
        detail: err.message || 'Unable to load report from Filebase S3.',
      });
    } finally {
      setReportLoading(false);
    }
  };

  const filteredHistoryPatients = useMemo(() => {
    return patients.filter((p) => {
      const regIso = p.registeredAt ? p.registeredAt.split('T')[0] : '';
      const matchesDate = !patientRecordDate || regIso === patientRecordDate;
      if (!matchesDate) return false;
      if (patientSearchQuery) {
        const q = patientSearchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.mrn.toLowerCase().includes(q) ||
          (p.contact && p.contact.includes(q)) ||
          (p.attendingPhysician && p.attendingPhysician.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [patients, patientRecordDate, patientSearchQuery]);

  // ---------------------------------------------------------------------------
  // 3. APPOINTMENTS & LIVE CONSULTATION QUEUE (FOR ALL DOCTORS IN DEPT)
  // ---------------------------------------------------------------------------
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueDoctorFilter, setQueueDoctorFilter] = useState('ALL');
  const [queueSearch, setQueueSearch] = useState('');

  const fetchAppointments = useCallback(async () => {
    try {
      setQueueLoading(true);
      setQueueError(null);
      const data = await clinicalApiClient.getAppointments(token);
      setAppointments(data);
    } catch (err: any) {
      console.warn('Could not fetch department appointments:', err);
      setQueueError(err.message || 'Unable to retrieve live consultation queue.');
    } finally {
      setQueueLoading(false);
    }
  }, [token]);

  // Unique doctor names in department queue
  const departmentDoctors = useMemo(() => {
    const docSet = new Set<string>();
    appointments.forEach((a) => {
      if (a.doctorName) docSet.add(a.doctorName);
    });
    return Array.from(docSet).sort();
  }, [appointments]);

  const filteredQueue = useMemo(() => {
    return appointments.filter((a) => {
      if (queueDoctorFilter !== 'ALL' && a.doctorName !== queueDoctorFilter) {
        return false;
      }
      if (queueSearch) {
        const q = queueSearch.toLowerCase();
        const matchesName = a.patientName?.toLowerCase().includes(q);
        const matchesMrn = a.patientMrn?.toLowerCase().includes(q);
        const matchesDoc = a.doctorName?.toLowerCase().includes(q);
        if (!matchesName && !matchesMrn && !matchesDoc) return false;
      }
      return true;
    });
  }, [appointments, queueDoctorFilter, queueSearch]);

  // ---------------------------------------------------------------------------
  // 4. DEPARTMENT EMPLOYEES & ACCESS REVOCATION
  // ---------------------------------------------------------------------------
  const [employees, setEmployees] = useState<DepartmentEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');

  const fetchEmployees = useCallback(async () => {
    try {
      setEmployeesLoading(true);
      setEmployeesError(null);
      const data = await clinicalApiClient.getDepartmentEmployees(token);
      setEmployees(data);
    } catch (err: any) {
      console.warn('Could not fetch department employees:', err);
      setEmployeesError(err.message || 'Unable to retrieve department workforce.');
    } finally {
      setEmployeesLoading(false);
    }
  }, [token]);

  // Revocation Requests
  const [revocationRequests, setRevocationRequests] = useState<RevocationRequest[]>([]);
  const [revocationsLoading, setRevocationsLoading] = useState(false);

  const fetchRevocationRequests = useCallback(async () => {
    try {
      setRevocationsLoading(true);
      const data = await clinicalApiClient.getDepartmentRevocationRequests(token);
      setRevocationRequests(data);
    } catch (err: any) {
      console.warn('Could not fetch revocation requests:', err);
    } finally {
      setRevocationsLoading(false);
    }
  }, [token]);

  // Revocation Modal State
  const [revokeTargetEmployee, setRevokeTargetEmployee] = useState<DepartmentEmployee | null>(null);
  const [revokeScope, setRevokeScope] = useState<'DEPARTMENT_ASSIGNMENT' | 'FULL_MEMBERSHIP'>('DEPARTMENT_ASSIGNMENT');
  const [revokeReason, setRevokeReason] = useState('Clinical Protocol Non-Compliance');
  const [revokeDetails, setRevokeDetails] = useState('');
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const handleOpenRevokeModal = (emp: DepartmentEmployee) => {
    setRevokeTargetEmployee(emp);
    setRevokeScope('DEPARTMENT_ASSIGNMENT');
    setRevokeReason('Clinical Protocol Non-Compliance');
    setRevokeDetails('');
    setRevokeError(null);
  };

  const handleCloseRevokeModal = () => {
    setRevokeTargetEmployee(null);
    setRevokeError(null);
  };

  const handleSubmitRevocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTargetEmployee) return;

    if (!revokeReason.trim()) {
      setRevokeError('Please specify the justification reason for access revocation.');
      return;
    }

    try {
      setRevokeSubmitting(true);
      setRevokeError(null);

      await clinicalApiClient.submitRevocationRequest(
        {
          targetMembershipId: revokeTargetEmployee.id,
          targetAssignmentId: revokeTargetEmployee.assignmentId,
          revocationScope: revokeScope,
          reason: revokeReason,
          supportingDetails: revokeDetails.trim() || undefined,
        },
        token
      );

      if (onToast) {
        onToast(
          'Revocation Escalation Transmitted',
          `Access revocation request for ${revokeTargetEmployee.name} (${revokeTargetEmployee.roleName}) submitted to Administration.`
        );
      }

      handleCloseRevokeModal();
      fetchRevocationRequests();
      fetchSummary();
    } catch (err: any) {
      console.error('Revocation submission failed:', err);
      setRevokeError(err.message || 'Failed to submit revocation escalation to Administration.');
    } finally {
      setRevokeSubmitting(false);
    }
  };

  const handleCancelRevocation = async (reqId: string) => {
    try {
      await clinicalApiClient.cancelRevocationRequest(reqId, token);
      if (onToast) {
        onToast('Request Cancelled', 'The pending access revocation request has been cancelled.');
      }
      fetchRevocationRequests();
      fetchSummary();
    } catch (err: any) {
      if (onToast) {
        onToast('Action Failed', err.message || 'Failed to cancel revocation request.');
      }
    }
  };

  const departmentStaff = useMemo(() => {
    return employees.filter(
      (e) =>
        e.userId !== session?.user?.id &&
        e.roleCode !== 'dept_head' &&
        !e.roleName.toLowerCase().includes('department head')
    );
  }, [employees, session?.user?.id]);

  const filteredEmployees = useMemo(() => {
    return departmentStaff.filter((e) => {
      if (!employeeSearch.trim()) return true;
      const q = employeeSearch.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.employeeUid.toLowerCase().includes(q) ||
        e.roleName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
      );
    });
  }, [departmentStaff, employeeSearch]);

  // ---------------------------------------------------------------------------
  // 5. STAFF COMMUNICATION (MESSAGE DEPT EMPLOYEES ONLY)
  // ---------------------------------------------------------------------------
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [commSubject, setCommSubject] = useState('');
  const [commBody, setCommBody] = useState('');
  const [commSending, setCommSending] = useState(false);
  const [commSuccess, setCommSuccess] = useState<string | null>(null);
  const [commError, setCommError] = useState<string | null>(null);

  // Sent messages history
  const [sentMessages, setSentMessages] = useState<EmployeeMessage[]>([]);
  const [sentLoading, setSentLoading] = useState(false);

  const fetchSentMessages = useCallback(async () => {
    try {
      setSentLoading(true);
      const data = await clinicalApiClient.getCommunicationSent(token);
      setSentMessages(data);
    } catch (err: any) {
      console.warn('Could not fetch sent messages:', err);
    } finally {
      setSentLoading(false);
    }
  }, [token]);

  const handleToggleSelectAllStaff = () => {
    if (selectedStaffIds.length === departmentStaff.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(departmentStaff.map((e) => e.id));
    }
  };

  const handleToggleStaffSelect = (memId: string) => {
    if (selectedStaffIds.includes(memId)) {
      setSelectedStaffIds(selectedStaffIds.filter((id) => id !== memId));
    } else {
      setSelectedStaffIds([...selectedStaffIds, memId]);
    }
  };

  const handleSendMessageToStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStaffIds.length === 0) {
      setCommError('Please select at least one department employee to receive this message.');
      return;
    }
    if (!commSubject.trim() || !commBody.trim()) {
      setCommError('Subject and message body are required.');
      return;
    }

    try {
      setCommSending(true);
      setCommError(null);
      setCommSuccess(null);

      // Dispatch to all selected recipients
      await Promise.all(
        selectedStaffIds.map((memId) =>
          clinicalApiClient.sendCommunicationMessage(
            {
              recipientMembershipId: memId,
              subject: commSubject.trim(),
              messageBody: commBody.trim(),
            },
            token
          )
        )
      );

      setCommSuccess(
        `Communication successfully dispatched to ${selectedStaffIds.length} department employee${
          selectedStaffIds.length > 1 ? 's' : ''
        }.`
      );
      if (onToast) {
        onToast(
          'Message Dispatched',
          `Message sent to ${selectedStaffIds.length} employee${selectedStaffIds.length > 1 ? 's' : ''}.`
        );
      }

      setCommSubject('');
      setCommBody('');
      setSelectedStaffIds([]);
      fetchSentMessages();
    } catch (err: any) {
      console.error('Failed to dispatch staff communication:', err);
      setCommError(err.message || 'Failed to dispatch message to selected staff.');
    } finally {
      setCommSending(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 6. CHANGE PASSWORD & USERNAME HANDLERS
  // ---------------------------------------------------------------------------
  const [inlineEmail, setInlineEmail] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineResetError, setInlineResetError] = useState<string | null>(null);
  const [inlineResetSuccess, setInlineResetSuccess] = useState(false);

  const handleInlineResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inlineEmail.trim().toLowerCase();
    if (!clean) {
      setInlineResetError('Please enter your official hospital email address.');
      return;
    }
    if (userEmail && clean !== userEmail.trim().toLowerCase()) {
      setInlineResetError('The email entered does not match your registered hospital employee email address.');
      return;
    }
    setInlineLoading(true);
    setInlineResetError(null);
    try {
      await authService.requestPasswordReset(clean);
      setInlineResetSuccess(true);
      if (onToast) {
        onToast('Reset Link Dispatched', `Password reset link sent to ${clean}. Please check your inbox.`);
      }
    } catch (err: any) {
      setInlineResetError(err.message || 'Failed to dispatch password reset link.');
    } finally {
      setInlineLoading(false);
    }
  };

  const [activeUsername, setActiveUsername] = useState<string>(username || '');
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccessMsg, setUsernameSuccessMsg] = useState<string | null>(null);

  const handleInlineChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newUsernameInput.trim().toLowerCase();
    if (!clean || clean.length < 3) {
      setUsernameError('Username must be at least 3 characters long.');
      return;
    }
    if (clean === (activeUsername || username || '').toLowerCase()) {
      setUsernameError('New username must be different from your current username.');
      return;
    }
    setUsernameLoading(true);
    setUsernameError(null);
    setUsernameSuccessMsg(null);
    try {
      const res = await clinicalApiClient.changeUsername(clean, token);
      setActiveUsername(clean);
      setUsernameSuccessMsg(res.message || `Username successfully updated to @${clean}.`);
      setNewUsernameInput('');
      if (onToast) {
        onToast('Username Updated', `Your login username is now @${clean}.`);
      }

      const stored = localStorage.getItem('hims_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.user) {
            parsed.user.username = clean;
            localStorage.setItem('hims_session', JSON.stringify(parsed));
          }
        } catch (_) {}
      }
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to update username.');
    } finally {
      setUsernameLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // INITIAL DATA LOADING
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchSummary();
    fetchAppointments();
    fetchPatients();
    fetchEmployees();
    fetchRevocationRequests();
    fetchSentMessages();
  }, [fetchSummary, fetchAppointments, fetchPatients, fetchEmployees, fetchRevocationRequests, fetchSentMessages]);

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* HEADER: Title & Contact Staff Action */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            Welcome, {employeeName}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Clinical Leadership &amp; Operational Oversight &bull; {departmentName}
          </p>
        </div>

        {/* Contact Staff Action button (expanded size matching nurse/receptionist portal) */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenContactModal && (
            <button
              onClick={onOpenContactModal}
              className="px-6 py-3 text-sm md:text-base font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 cursor-pointer shrink-0"
            >
              <Send className="w-5 h-5 text-teal-200" />
              <span>Contact Staff</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3 TOP KPI METRIC CARDS (Active Admissions removed!) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Box 1: Registered Patients */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
              Registered Patients
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 tracking-tight font-sans">
              {summary ? summary.registeredPatientsCount : patients.length}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-600" />
              <span>In {departmentName}</span>
            </div>
          </div>
        </div>

        {/* Box 2: Today's Scheduled / Waiting in Queue */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
              Today&apos;s Scheduled
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <Calendar className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 tracking-tight font-sans">
              {summary ? summary.todayScheduledCount : appointments.length}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>
                {summary ? `${summary.waitingCount} currently waiting` : `${appointments.filter(a => a.status.toLowerCase().includes('wait') || a.status.toLowerCase().includes('check')).length} currently waiting`}
              </span>
            </div>
          </div>
        </div>

        {/* Box 3: Assigned Staff */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
              Assigned Staff
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700">
              <Stethoscope className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 tracking-tight font-sans">
              {summary ? summary.departmentStaffCount : departmentStaff.length}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-600" />
              <span>Active doctors &amp; staff in {departmentName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: DEPARTMENT OVERVIEW (DEFAULT) */}
      {/* Strictly Live Consultation Queue for doctors in this dept */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header Bar */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-teal-800" />
                <h2 className="text-base font-bold text-slate-900">
                  Live Consultation Queue &bull; {departmentName}
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {filteredQueue.length} Active Slots
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time appointment queue strictly for all attending physicians assigned to {departmentName}.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Doctor Filter */}
              <select
                value={queueDoctorFilter}
                onChange={(e) => setQueueDoctorFilter(e.target.value)}
                className="pl-3 pr-8 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700 appearance-none cursor-pointer"
              >
                <option value="ALL">All Doctors in {departmentName}</option>
                {departmentDoctors.map((doc) => (
                  <option key={doc} value={doc}>
                    {doc}
                  </option>
                ))}
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search patient, MRN..."
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  className="w-full sm:w-56 pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-700"
                />
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchAppointments}
                className="p-2 text-slate-600 hover:text-teal-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Refresh Queue"
              >
                <RefreshCw className={`w-4 h-4 ${queueLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {queueLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-700 mb-2" />
                <span>Loading live consultation queue from database...</span>
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No active consultation slots matching your filter criteria.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-6">Slot Time</th>
                    <th className="py-3.5 px-6">Patient Name</th>
                    <th className="py-3.5 px-6">Attending Doctor</th>
                    <th className="py-3.5 px-6">Visit Type / Priority</th>
                    <th className="py-3.5 px-6">Queue Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredQueue.map((appt) => {
                    const statusStr = (appt.status || '').toLowerCase();
                    let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                    if (statusStr.includes('wait') || statusStr.includes('check')) {
                      badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                    } else if (statusStr.includes('consult')) {
                      badgeClass = 'bg-teal-50 text-teal-800 border-teal-200';
                    } else if (statusStr.includes('complete') || statusStr.includes('conclud')) {
                      badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    }

                    // Look up matching patient record for EMR
                    const matchedPatient = patients.find((p) => p.mrn === appt.patientMrn);

                    return (
                      <tr key={appt.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-6 font-mono text-slate-600 whitespace-nowrap">
                          {appt.time}
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{appt.patientName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{appt.patientMrn}</div>
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{appt.doctorName}</div>
                          <div className="text-[11px] text-teal-700 font-medium">{departmentName}</div>
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <div>{appt.type || 'Consultation'}</div>
                          <span
                            className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-bold uppercase mt-0.5 ${
                              ((appt.priority as string) === 'High' || (appt.priority as string) === 'Priority')
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-50 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {appt.priority || 'Normal'}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full font-mono font-semibold text-[10.5px] border ${badgeClass}`}
                          >
                            {appt.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right whitespace-nowrap space-x-2">
                          {matchedPatient ? (
                            <button
                              onClick={() => setSelectedPatientForEMR(matchedPatient)}
                              className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                            >
                              <FileText className="w-3.5 h-3.5 text-teal-700" />
                              <span>View EMR</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Queued</span>
                          )}
                          <button
                            onClick={() => handleOpenConsultancyReport(appt.patientMrn, appt.patientName)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                            <span>View Report</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: PATIENT DETAILS & CLINICAL RECORDS (EMR) */}
      {/* Scoped strictly to this department, default yesterday */}
      {/* ========================================================= */}
      {activeTab === 'patient-details' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header Bar & Date Filters */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-teal-800" />
                <h2 className="text-base font-bold text-slate-900">
                  Department Patient Records &bull; {departmentName}
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {filteredHistoryPatients.length} Patients
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative patient census and electronic medical records strictly for {departmentName}.
              </p>
            </div>

            {/* Date Filtering and Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-wrap">
              {/* Quick Preset Buttons */}
              <button
                type="button"
                onClick={() => setPatientRecordDate(getYesterdayIso())}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  patientRecordDate === getYesterdayIso()
                    ? 'bg-teal-800 text-white border-teal-800 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setPatientRecordDate(getTodayIso())}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  patientRecordDate === getTodayIso()
                    ? 'bg-teal-800 text-white border-teal-800 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Today
              </button>

              {/* Date Input */}
              <input
                type="date"
                value={patientRecordDate}
                onChange={(e) => setPatientRecordDate(e.target.value)}
                className="px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700"
              />

              {/* Patient Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search name, MRN, phone..."
                  value={patientSearchQuery}
                  onChange={(e) => setPatientSearchQuery(e.target.value)}
                  className="w-full sm:w-56 pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-700"
                />
              </div>

              {/* Refresh */}
              <button
                onClick={fetchPatients}
                className="p-2 text-slate-600 hover:text-teal-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Refresh Records"
              >
                <RefreshCw className={`w-4 h-4 ${patientsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {patientsLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-700 mb-2" />
                <span>Loading department patient records...</span>
              </div>
            ) : filteredHistoryPatients.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No patient registrations recorded in {departmentName} for {patientRecordDate || 'the selected date'}.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-6">Patient Details</th>
                    <th className="py-3.5 px-6">MRN / Demographics</th>
                    <th className="py-3.5 px-6">Contact Phone</th>
                    <th className="py-3.5 px-6">Attending Physician</th>
                    <th className="py-3.5 px-6">Triage / Priority</th>
                    <th className="py-3.5 px-6">Latest Vitals</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredHistoryPatients.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {p.registeredAt ? new Date(p.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Intake'}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <div className="font-mono text-teal-800 font-semibold">{p.mrn}</div>
                        <div className="text-[11px] text-slate-500">
                          {p.age} yrs &bull; {p.gender} &bull; Blood: {p.bloodGroup || 'O+'}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-600 whitespace-nowrap">
                        {p.contact || 'None Listed'}
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{p.attendingPhysician || 'On-Duty Attending'}</div>
                        <div className="text-[11px] text-slate-500">{departmentName}</div>
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-bold text-[10.5px] border ${
                            p.triageCategory === 'Critical'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : p.triageCategory === 'Urgent'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {p.triageCategory || 'Routine'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        {p.vitals ? (
                          <div className="text-[11px] space-y-0.5">
                            <span className="font-mono font-semibold text-slate-800">BP: {p.vitals.bp}</span>
                            <span className="text-slate-400 mx-1">&bull;</span>
                            <span className="font-mono text-slate-600">HR: {p.vitals.heartRate} bpm</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Pending vitals check</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap space-x-2">
                        <button
                          onClick={() => setSelectedPatientForEMR(p)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-teal-700" />
                          <span>View EMR</span>
                        </button>
                        <button
                          onClick={() => handleOpenConsultancyReport(p.mrn || p.id, p.name)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                          <span>View Consultancy Report</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 3: DEPARTMENT EMPLOYEES & ACCESS REVOCATION */}
      {/* ========================================================= */}
      {activeTab === 'dept-employees' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Employees Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2.5">
                  <Stethoscope className="w-5 h-5 text-teal-800" />
                  <h2 className="text-base font-bold text-slate-900">
                    {departmentName} Workforce &bull; Department Employees
                  </h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    {filteredEmployees.length} Staff
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Active physicians, clinicians, nurses, and operational personnel assigned to {departmentName}.
                </p>
              </div>

              {/* Search & Actions */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search employee name, role, UID..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="w-full sm:w-64 pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-700"
                  />
                </div>

                <button
                  onClick={fetchEmployees}
                  className="p-2 text-slate-600 hover:text-teal-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer shrink-0"
                  title="Refresh Employees"
                >
                  <RefreshCw className={`w-4 h-4 ${employeesLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Employees List */}
            <div className="overflow-x-auto">
              {employeesLoading ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-700 mb-2" />
                  <span>Loading department employees...</span>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  No department employees found matching your search.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3.5 px-6">Employee Details</th>
                      <th className="py-3.5 px-6">Official Role(s)</th>
                      <th className="py-3.5 px-6">Assigned Departments</th>
                      <th className="py-3.5 px-6">Official Email</th>
                      <th className="py-3.5 px-6 text-right">Access Governance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredEmployees.map((emp) => {
                      const isSelf = emp.userId === session?.user?.id;
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-6 whitespace-nowrap">
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <span>{emp.name}</span>
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 font-bold border border-teal-200">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {emp.employeeUid}
                            </div>
                          </td>
                          <td className="py-3.5 px-6">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {emp.roleName.split(', ').map((r) => (
                                <span
                                  key={r}
                                  className="inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-800 border border-slate-200/80"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-6">
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {(emp.departments && emp.departments.length > 0
                                ? emp.departments
                                : (emp.departmentName ? emp.departmentName.split(', ') : [departmentName])
                              ).map((dept) => {
                                const isCurrentDept = dept.toLowerCase().includes(departmentName.toLowerCase()) || departmentName.toLowerCase().includes(dept.toLowerCase());
                                return (
                                  <span
                                    key={dept}
                                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-medium border ${
                                      isCurrentDept
                                        ? 'bg-teal-50 text-teal-900 border-teal-200 font-bold shadow-2xs'
                                        : 'bg-slate-50 text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {dept}
                                    {isCurrentDept && ' â€¢ Active'}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3.5 px-6 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                            {emp.email}
                          </td>
                          <td className="py-3.5 px-6 text-right whitespace-nowrap">
                            {isSelf ? (
                              <span className="text-slate-400 text-xs italic">Active Session</span>
                            ) : (
                              <button
                                onClick={() => handleOpenRevokeModal(emp)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                                title={`Submit access revocation request for ${emp.name}`}
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                <span>Revoke Access</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Pending & Past Revocation Escalations Sub-Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Access Revocation Requests &amp; Administrator Decisions
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  {revocationRequests.length} Escalations
                </span>
              </div>

              <button
                onClick={fetchRevocationRequests}
                className="p-1.5 text-slate-600 hover:text-teal-800 rounded-lg hover:bg-slate-100"
                title="Refresh Requests"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${revocationsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              {revocationRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No employee access revocation requests submitted for this department.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-6">Target Staff</th>
                      <th className="py-3 px-6">Scope</th>
                      <th className="py-3 px-6">Justification Reason</th>
                      <th className="py-3 px-6">Request Status</th>
                      <th className="py-3 px-6">Admin Decision Notes</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {revocationRequests.map((req) => {
                      let badge = 'bg-amber-50 text-amber-800 border-amber-200';
                      if (req.status === 'APPROVED') badge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                      if (req.status === 'REJECTED') badge = 'bg-rose-50 text-rose-800 border-rose-200';
                      if (req.status === 'CANCELLED') badge = 'bg-slate-100 text-slate-600 border-slate-200';

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-6 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">{req.targetName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{req.targetEmployeeUid}</div>
                          </td>
                          <td className="py-3 px-6 whitespace-nowrap">
                            <span className="font-mono text-[11px] text-slate-600">
                              {req.revocationScope === 'FULL_MEMBERSHIP' ? 'Full Membership' : 'Dept Assignment'}
                            </span>
                          </td>
                          <td className="py-3 px-6 max-w-xs text-slate-800 truncate" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="py-3 px-6 whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-semibold text-[10.5px] border ${badge}`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 px-6 text-slate-500 max-w-xs truncate">
                            {req.decisionNotes || (req.status === 'PENDING' ? 'Awaiting Admin Review' : 'â€”')}
                          </td>
                          <td className="py-3 px-6 text-right whitespace-nowrap">
                            {req.status === 'PENDING' && (
                              <button
                                onClick={() => handleCancelRevocation(req.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-700 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                              >
                                Cancel Request
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 4: STAFF COMMUNICATION (MESSAGE DEPT EMPLOYEES ONLY) */}
      {/* ========================================================= */}
      {activeTab === 'dept-communication' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Compose Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-slate-100 bg-linear-to-r from-teal-50/50 via-slate-50/30 to-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-md shrink-0">
                  <Mail className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 font-sans">
                      Department Staff Communication
                    </h2>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-mono">
                      {departmentName} Only
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Transmit direct operational requests, clinical announcements, or directives strictly to {departmentName} workforce.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {commError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs md:text-sm flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{commError}</span>
                </div>
              )}

              {commSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs md:text-sm flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold">Message Dispatched Successfully</div>
                    <div className="text-xs text-emerald-700 mt-0.5">{commSuccess}</div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSendMessageToStaff} className="space-y-6">
                {/* Employee Multi-Selection Box */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-slate-900">
                      Select Department Recipients *
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                        Selected: {selectedStaffIds.length} of {departmentStaff.length} Staff
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleSelectAllStaff}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                      >
                        {selectedStaffIds.length === departmentStaff.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 max-h-56 overflow-y-auto">
                    {departmentStaff.map((emp) => {
                      const isSelected = selectedStaffIds.includes(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => handleToggleStaffSelect(emp.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                            isSelected
                              ? 'bg-teal-50/80 border-teal-300 shadow-2xs'
                              : 'bg-white border-slate-200/90 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className={`w-4.5 h-4.5 rounded flex items-center justify-center border shrink-0 ${
                              isSelected
                                ? 'bg-teal-800 border-teal-800 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {emp.name}
                            </div>
                            <div className="text-[11px] text-slate-600 truncate font-medium">
                              {emp.roleName}
                            </div>
                            <div className="text-[10px] text-teal-800 truncate">
                              {emp.departments && emp.departments.length > 0 ? emp.departments.join(', ') : (emp.departmentName || departmentName)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Directive / Message Subject *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mandatory Cardiology Ward Consultation Protocol Update"
                    value={commSubject}
                    onChange={(e) => {
                      setCommSubject(e.target.value);
                      if (commError) setCommError(null);
                    }}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 transition-all bg-white"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Message Details &bull; Actionable Instructions *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe clinical requirements, task assignments, shift coordination directives, or patient handover notes..."
                    value={commBody}
                    onChange={(e) => {
                      setCommBody(e.target.value);
                      if (commError) setCommError(null);
                    }}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 transition-all bg-white"
                  />
                </div>

                <div className="pt-2 flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={commSending || selectedStaffIds.length === 0 || !commSubject.trim() || !commBody.trim()}
                    className="px-6 py-3.5 text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4.5 h-4.5" />
                    <span>{commSending ? 'Dispatching Messages...' : `Send to ${selectedStaffIds.length} Selected Staff`}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Sent Communications History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-teal-800" />
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Dispatched Directives &bull; Outbox
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {sentMessages.length} Messages
                </span>
              </div>

              <button
                onClick={fetchSentMessages}
                className="p-1.5 text-slate-600 hover:text-teal-800 rounded-lg hover:bg-slate-100"
                title="Refresh Outbox"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sentLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              {sentMessages.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No staff directives dispatched yet. Compose and send a message above.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-6">Sent Time</th>
                      <th className="py-3 px-6">Recipient Staff</th>
                      <th className="py-3 px-6">Role</th>
                      <th className="py-3 px-6">Directive Subject</th>
                      <th className="py-3 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {sentMessages.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-6 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-6 font-semibold text-slate-900 whitespace-nowrap">
                          {m.recipientName}
                        </td>
                        <td className="py-3 px-6 text-slate-600 whitespace-nowrap">
                          {m.recipientRoleName}
                        </td>
                        <td className="py-3 px-6 text-slate-800 max-w-sm truncate" title={m.subject}>
                          <div className="font-medium text-slate-900">{m.subject}</div>
                          <div className="text-[11px] text-slate-500 truncate">{m.messageBody}</div>
                        </td>
                        <td className="py-3 px-6 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-semibold text-[10.5px] border ${
                              m.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 5: CHANGE PASSWORD (Strictly Email Reset Protocol) */}
      {/* ========================================================= */}
      {activeTab === 'change-password' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-slate-100 bg-linear-to-r from-teal-50/50 via-slate-50/30 to-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-md shrink-0">
                <KeyRound className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 font-sans">
                    Change Account Password
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-mono">
                    Mandatory Email Protocol
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Verified email security link protocol (direct password changes disabled).
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-6 max-w-3xl">
            {/* Mandatory Security Notice Callout */}
            <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs md:text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-amber-950 mb-0.5">
                  Mandatory Email Verification Policy
                </span>
                <span>
                  In accordance with hospital cybersecurity governance, passwords cannot be directly typed or updated inside an active workstation session. Re-enter your registered official email address below to receive an authenticated password reset link.
                </span>
              </div>
            </div>

            {/* Error Message */}
            {inlineResetError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs md:text-sm flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{inlineResetError}</span>
              </div>
            )}

            {/* Success Confirmation */}
            {inlineResetSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <h3 className="font-bold text-sm md:text-base">Reset Password Link Dispatched</h3>
                </div>
                <p className="text-xs md:text-sm text-emerald-800">
                  We have dispatched a single-use cryptographically verified password reset link to your email address:
                  <span className="font-bold font-mono ml-1 text-emerald-950">{inlineEmail}</span>.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setInlineResetSuccess(false);
                      setInlineEmail('');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 cursor-pointer transition-colors"
                  >
                    Send Another Request
                  </button>
                </div>
              </div>
            ) : (
              /* Inline Request Form */
              <form onSubmit={handleInlineResetPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-800">
                    Re-enter Registered Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      type="email"
                      required
                      placeholder="name@hospital.org"
                      value={inlineEmail}
                      onChange={(e) => {
                        setInlineEmail(e.target.value);
                        if (inlineResetError) setInlineResetError(null);
                      }}
                      className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 transition-all bg-white"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    We will dispatch a cryptographically verified single-use link to this inbox.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={inlineLoading || !inlineEmail.trim()}
                  className="px-6 py-3.5 text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4.5 h-4.5" />
                  <span>{inlineLoading ? 'Transmitting Request...' : 'Send Password Reset Link'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 6: CHANGE USERNAME */}
      {/* ========================================================= */}
      {activeTab === 'change-username' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-slate-100 bg-linear-to-r from-teal-50/50 via-slate-50/30 to-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-md shrink-0">
                <UserCog className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 font-sans">
                  Change Account Username
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Update your system login handle for your hospital workstation credentials.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-6 max-w-2xl">
            {usernameError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs md:text-sm flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{usernameError}</span>
              </div>
            )}

            {usernameSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs md:text-sm flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{usernameSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleInlineChangeUsername} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Current Username
                </label>
                <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-mono text-sm">
                  @{activeUsername || username || 'unknown'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  New Username *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. jitamanyu.head"
                  value={newUsernameInput}
                  onChange={(e) => {
                    setNewUsernameInput(e.target.value);
                    if (usernameError) setUsernameError(null);
                  }}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 transition-all bg-white"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Must be alphanumeric, lowercase, at least 3 characters.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={usernameLoading || !newUsernameInput.trim()}
                  className="px-6 py-3.5 text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <UserCheck className="w-4.5 h-4.5" />
                  <span>{usernameLoading ? 'Updating Handle...' : 'Update Login Username'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* EMR MODAL / DRAWER */}
      {/* ========================================================= */}
      {selectedPatientForEMR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-teal-50/60 to-white sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-md">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">
                      {selectedPatientForEMR.name}
                    </h3>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold">
                      {selectedPatientForEMR.mrn}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedPatientForEMR.age} yrs &bull; {selectedPatientForEMR.gender} &bull; Blood: {selectedPatientForEMR.bloodGroup || 'Unknown'} &bull; Dept: {selectedPatientForEMR.department || departmentName}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPatientForEMR(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Demographics & Contact Grid */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Patient Intake &bull; Demographics &amp; Contact
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Contact Phone</span>
                    <span className="text-xs font-semibold text-slate-800 font-mono">
                      {selectedPatientForEMR.contact || 'None Listed'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Emergency Contact</span>
                    <span className="text-xs font-semibold text-slate-800 font-mono">
                      {selectedPatientForEMR.emergencyContact || 'None Listed'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Attending Doctor</span>
                    <span className="text-xs font-semibold text-slate-800">
                      {selectedPatientForEMR.attendingPhysician || 'On-Duty Attending'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Triage Priority</span>
                    <span className="text-xs font-bold text-teal-800">
                      {selectedPatientForEMR.triageCategory || 'Routine'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vitals Log */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Physiological Vitals &bull; Current Measurements
                </h4>
                {selectedPatientForEMR.vitals ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-teal-50/40 border border-teal-100">
                    <div className="p-3 rounded-xl bg-white border border-teal-100/70">
                      <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Blood Pressure
                      </span>
                      <span className="text-lg font-black text-slate-900 font-mono">
                        {selectedPatientForEMR.vitals.bp}
                      </span>
                      <span className="text-[10px] text-slate-400 block">mmHg</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-teal-100/70">
                      <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Heart Rate
                      </span>
                      <span className="text-lg font-black text-slate-900 font-mono">
                        {selectedPatientForEMR.vitals.heartRate}
                      </span>
                      <span className="text-[10px] text-slate-400 block">bpm</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-teal-100/70">
                      <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Temperature
                      </span>
                      <span className="text-lg font-black text-slate-900 font-mono">
                        {selectedPatientForEMR.vitals.temperature}
                      </span>
                      <span className="text-[10px] text-slate-400 block">&deg;F</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-teal-100/70">
                      <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Oxygen Saturation
                      </span>
                      <span className="text-lg font-black text-slate-900 font-mono">
                        {selectedPatientForEMR.vitals.spo2}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">SpO2</span>
                    </div>

                    {selectedPatientForEMR.vitals.respiratoryRate && (
                      <div className="p-3 rounded-xl bg-white border border-teal-100/70">
                        <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                          Respiration
                        </span>
                        <span className="text-lg font-black text-slate-900 font-mono">
                          {selectedPatientForEMR.vitals.respiratoryRate}
                        </span>
                        <span className="text-[10px] text-slate-400 block">breaths/min</span>
                      </div>
                    )}

                    {selectedPatientForEMR.vitals.bloodGlucose && (
                      <div className="p-3 rounded-xl bg-white border border-teal-100/70">
                        <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                          Blood Glucose
                        </span>
                        <span className="text-lg font-black text-slate-900 font-mono">
                          {selectedPatientForEMR.vitals.bloodGlucose}
                        </span>
                        <span className="text-[10px] text-slate-400 block">mg/dL</span>
                      </div>
                    )}

                    <div className="col-span-2 sm:col-span-4 text-[11px] text-slate-500 pt-1 flex items-center justify-between">
                      <span>Recorded by: <strong>{selectedPatientForEMR.vitals.recordedByName}</strong></span>
                      <span>Recorded at: {new Date(selectedPatientForEMR.vitals.recordedAt).toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 italic">
                    No physiological vital measurements logged for this intake visit yet.
                  </div>
                )}
              </div>

              {/* Allergies & Medical History */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Past Allergies &bull; Drug Reactions</span>
                  </h4>
                  <p className="text-xs text-slate-800 font-medium">
                    {selectedPatientForEMR.allergies || 'No known drug or environmental allergies logged.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1.5 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-amber-600" />
                    <span>Chronic Conditions &bull; Medical History</span>
                  </h4>
                  <p className="text-xs text-slate-800 font-medium">
                    {selectedPatientForEMR.chronicConditions || 'No existing chronic conditions documented.'}
                  </p>
                </div>
              </div>

              {/* Chief Complaint & Clinical Notes */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Chief Complaint &bull; Reason for Admission / Visit
                  </h4>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-800 font-medium leading-relaxed">
                    {selectedPatientForEMR.chiefComplaint || 'Routine medical evaluation.'}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Doctor&apos;s Consultation Notes &bull; Clinical Findings
                  </h4>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-800 font-medium leading-relaxed">
                    {selectedPatientForEMR.clinicalNotes || 'Consultation records logged in attending physician workspace.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSelectedPatientForEMR(null)}
                className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Close EMR Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ACCESS REVOCATION REQUEST MODAL */}
      {/* ========================================================= */}
      {revokeTargetEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-linear-to-r from-rose-50/80 to-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-700 text-white flex items-center justify-center shadow-md">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Request Employee Access Revocation
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Submit formal escalation to Hospital Administrator
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseRevokeModal}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitRevocation} className="p-6 space-y-4">
              {revokeError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{revokeError}</span>
                </div>
              )}

              {/* Target Details Display */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">
                  Target Employee
                </span>
                <div className="text-sm font-bold text-slate-900">
                  {revokeTargetEmployee.name}
                </div>
                <div className="text-xs text-slate-500">
                  {revokeTargetEmployee.roleName} &bull; UID: {revokeTargetEmployee.employeeUid} &bull; {departmentName}
                </div>
              </div>

              {/* Scope Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Revocation Scope *
                </label>
                <select
                  value={revokeScope}
                  onChange={(e) => setRevokeScope(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-rose-700"
                >
                  <option value="DEPARTMENT_ASSIGNMENT">
                    Department Assignment Only (Remove from {departmentName})
                  </option>
                  <option value="FULL_MEMBERSHIP">
                    Full Hospital Membership (Revoke All Facility Access)
                  </option>
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Justification Category *
                </label>
                <select
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-rose-700"
                >
                  <option value="Clinical Protocol Non-Compliance">Clinical Protocol Non-Compliance</option>
                  <option value="Unauthorized Record Modification">Unauthorized Record Modification</option>
                  <option value="Scope Boundary Violation">Scope Boundary Violation</option>
                  <option value="Extended Unapproved Absence">Extended Unapproved Absence</option>
                  <option value="Gross Professional Misconduct">Gross Professional Misconduct</option>
                  <option value="Other Institutional Escalation">Other Institutional Escalation</option>
                </select>
              </div>

              {/* Supporting Details */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Supporting Context &bull; Incident Details
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide clinical dates, specific patient cases, or supervisory context for the administrator..."
                  value={revokeDetails}
                  onChange={(e) => setRevokeDetails(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-rose-700"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseRevokeModal}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revokeSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{revokeSubmitting ? 'Transmitting Request...' : 'Submit Revocation Escalation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================= */}
      {/* MODAL: VIEW CONSULTANCY REPORT (Filebase S3 Encrypted Storage) */}
      {/* ========================================================= */}
      <ConsultancyReportViewerModal
        isOpen={reportModalOpen}
        onClose={() => {
          setReportModalOpen(false);
          setSelectedReportDetail(null);
        }}
        report={selectedReportDetail}
        loading={reportLoading}
        patientName={reportPatientName}
        patientMrn={reportPatientMrn}
        onRetry={() => {
          if (reportPatientMrn) {
            handleOpenConsultancyReport(reportPatientMrn, reportPatientName);
          }
        }}
      />
    </div>
  );
};
