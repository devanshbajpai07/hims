import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AuthSession } from '../../types/auth';
import {
  NursingTask,
  clinicalApiClient,
} from '../../services/clinicalApiClient';
import { authService } from '../../services/authService';
import {
  Users,
  ClipboardList,
  FileText,
  Shield,
  KeyRound,
  UserCog,
  Send,
  CheckCircle2,
  Clock,
  Plus,
  Check,
  X,
  AlertCircle,
  Search,
  RefreshCw,
  Trash2,
  Mail,
  Building2,
  AlertTriangle,
  UserCheck,
  Activity,
  Layers,
} from 'lucide-react';

interface NursingSupervisorDashboardProps {
  currentTab?: string;
  onSelectTab?: (tabId: string) => void;
  session?: AuthSession | null;
  effectivePermissions?: string[];
  supervisorName?: string;
  facilityName?: string;
  facilityUid?: string;
  onToast?: (title: string, desc: string) => void;
  token?: string;
  username?: string;
  userEmail?: string;
  onOpenContactModal?: () => void;
  onOpenChangePassword?: () => void;
  onOpenChangeUsername?: () => void;
}

export const NursingSupervisorDashboard: React.FC<NursingSupervisorDashboardProps> = ({
  currentTab = 'active-nurses',
  onSelectTab,
  session,
  supervisorName = 'Nursing Services Supervisor',
  facilityName = 'ABC Hospital',
  facilityUid = 'AAROGYA-ABCH-KANP-2718',
  onToast = () => {},
  token,
  username = '',
  userEmail = '',
  onOpenContactModal,
}) => {
  // Normalize current tab
  const activeTab = useMemo(() => {
    if (!currentTab || currentTab === 'overview' || currentTab === 'command') return 'active-nurses';
    return currentTab;
  }, [currentTab]);

  // =========================================================================
  // 1. ACTIVE NURSES DIRECTORY STATE
  // =========================================================================
  const [nurses, setNurses] = useState<any[]>([]);
  const [nursesLoading, setNursesLoading] = useState<boolean>(true);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [nurseSearch, setNurseSearch] = useState<string>('');
  const [departments, setDepartments] = useState<any[]>([]);

  // Fetch departments
  const loadDepartments = useCallback(async () => {
    try {
      const depts = await clinicalApiClient.getDepartments(token);
      if (Array.isArray(depts)) {
        setDepartments(depts);
      }
    } catch (err) {
      console.warn('Failed to load departments:', err);
    }
  }, [token]);

  // Fetch active nurses
  const loadNurses = useCallback(async () => {
    setNursesLoading(true);
    try {
      const data = await clinicalApiClient.getNurses(selectedDeptId, nurseSearch, token);
      if (Array.isArray(data)) {
        setNurses(data);
      }
    } catch (err) {
      console.warn('Failed to load nurses directory:', err);
    } finally {
      setNursesLoading(false);
    }
  }, [selectedDeptId, nurseSearch, token]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadNurses();
  }, [loadNurses]);

  // =========================================================================
  // 2. NURSING TASKS STATE
  // =========================================================================
  const [tasks, setTasks] = useState<NursingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState<boolean>(true);
  const [newTaskOpen, setNewTaskOpen] = useState<boolean>(false);
  const [taskPatientName, setTaskPatientName] = useState<string>('');
  const [taskDesc, setTaskDesc] = useState<string>('');
  const [taskTime, setTaskTime] = useState<string>('12:00 PM');
  const [taskPriority, setTaskPriority] = useState<string>('Routine');
  const [taskCreating, setTaskCreating] = useState<boolean>(false);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const loaded = await clinicalApiClient.getNursingTasks();
      if (Array.isArray(loaded)) {
        setTasks(loaded);
      }
    } catch (err) {
      console.warn('Failed to load nursing tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDesc.trim()) return;
    setTaskCreating(true);
    try {
      const created = await clinicalApiClient.createNursingTask({
        patientName: taskPatientName.trim() || undefined,
        taskType: 'nursing_care',
        description: taskDesc.trim(),
        scheduledTime: taskTime.trim(),
        priority: taskPriority,
      });
      setTasks((prev) => [created, ...prev]);
      setNewTaskOpen(false);
      setTaskDesc('');
      setTaskPatientName('');
      onToast('Task Created', 'Nursing task saved to clinical database.');
      // Refresh audit logs in background
      loadAuditLogs();
    } catch (err: any) {
      onToast('Task Creation Error', err.message || 'Failed to create nursing task.');
    } finally {
      setTaskCreating(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await clinicalApiClient.completeNursingTask(taskId);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                isCompleted: true,
                completedByName: supervisorName,
                completedAt: new Date().toLocaleTimeString(),
              }
            : t
        )
      );
      onToast('Nursing Task Completed', 'Task marked completed and logged to nursing activity trail.');
      loadAuditLogs();
    } catch (err: any) {
      onToast('Task Update Error', err.message || 'Could not update task in database.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await clinicalApiClient.deleteNursingTask(taskId, token);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      onToast('Task Deleted', 'Nursing task removed from shift schedule.');
      loadAuditLogs();
    } catch (err: any) {
      onToast('Delete Error', err.message || 'Could not delete task from schedule.');
    }
  };

  const completedCount = useMemo(() => tasks.filter((t) => t.isCompleted).length, [tasks]);
  const pendingCount = useMemo(() => tasks.filter((t) => !t.isCompleted).length, [tasks]);

  // =========================================================================
  // 3. NURSE ACTIVITY AUDIT LOGS STATE
  // =========================================================================
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(true);
  const [logActionFilter, setLogActionFilter] = useState<string>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  const loadAuditLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const logs = await clinicalApiClient.getSupervisorNursingAuditLogs(token, logSearchQuery, logActionFilter);
      if (Array.isArray(logs)) {
        setAuditLogs(logs);
      }
    } catch (err) {
      console.warn('Failed to load nurse audit logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [token, logSearchQuery, logActionFilter]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // =========================================================================
  // 4. CONTACT ADMINISTRATOR STATE
  // =========================================================================
  const [adminSubject, setAdminSubject] = useState<string>('');
  const [adminPriority, setAdminPriority] = useState<string>('Normal');
  const [adminMessage, setAdminMessage] = useState<string>('');
  const [adminSending, setAdminSending] = useState<boolean>(false);
  const [adminSuccess, setAdminSuccess] = useState<boolean>(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const handleDispatchAdminNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSubject.trim() || !adminMessage.trim()) {
      setAdminError('Please fill in both the subject and the message body.');
      return;
    }
    setAdminSending(true);
    setAdminError(null);
    try {
      await clinicalApiClient.contactHospitalAdmin(
        {
          subject: adminSubject.trim(),
          priority: adminPriority,
          message: adminMessage.trim(),
        },
        token
      );
      setAdminSuccess(true);
      setAdminSubject('');
      setAdminMessage('');
      onToast('Notice Dispatched', 'Urgent administrative escalation sent to Hospital Administrators.');
      loadAuditLogs();
    } catch (err: any) {
      setAdminError(err.message || 'Failed to dispatch escalation notice.');
    } finally {
      setAdminSending(false);
    }
  };

  // =========================================================================
  // 5. CHANGE PASSWORD STATE (Strictly via verified email link dispatch)
  // =========================================================================
  const [inlineEmail, setInlineEmail] = useState<string>('');
  const [inlineLoading, setInlineLoading] = useState<boolean>(false);
  const [inlineResetError, setInlineResetError] = useState<string | null>(null);
  const [inlineResetSuccess, setInlineResetSuccess] = useState<boolean>(false);

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
      onToast('Reset Link Dispatched', `Password reset link sent to ${clean}. Please check your inbox.`);
    } catch (err: any) {
      setInlineResetError(err.message || 'Failed to dispatch password reset link.');
    } finally {
      setInlineLoading(false);
    }
  };

  // =========================================================================
  // 6. CHANGE USERNAME STATE
  // =========================================================================
  const [activeUsername, setActiveUsername] = useState<string>(username || '');
  const [newUsernameInput, setNewUsernameInput] = useState<string>('');
  const [usernameLoading, setUsernameLoading] = useState<boolean>(false);
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
      onToast('Username Updated', `Your login username is now @${clean}.`);

      const stored = authService.getStoredSession();
      if (stored?.user) {
        stored.user.username = clean;
        authService.setStoredSession(stored);
      }
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to update username.');
    } finally {
      setUsernameLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* TOP HEADER: Welcome Title & Actions */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            Welcome, {supervisorName}
          </h1>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Contact Admin Quick Action */}
          <button
            onClick={() => onSelectTab && onSelectTab('contact-admin')}
            className={`px-5 py-3 text-sm md:text-base font-bold rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0 border ${
              activeTab === 'contact-admin'
                ? 'bg-teal-900 text-white border-teal-900'
                : 'bg-white text-teal-900 border-teal-300 hover:bg-teal-50/70'
            }`}
          >
            <Shield className="w-5 h-5 text-teal-700" />
            <span>Contact Admin</span>
          </button>

          {/* Contact Staff Action button (expanded size matching nurse portal) */}
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
      {/* 3 METRIC CARDS ROW (Matching Nurse Portal Size & Styling) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Active Nurses */}
        <div
          onClick={() => onSelectTab && onSelectTab('active-nurses')}
          className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="text-sm font-semibold text-slate-600 flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200/70 text-teal-700">
              <Users className="w-5 h-5" />
            </div>
            <span>Active Nurses</span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
              {nurses.length}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>On Active Duty across Hospital Departments</span>
          </div>
        </div>

        {/* Card 2: Pending Nursing Tasks */}
        <div
          onClick={() => onSelectTab && onSelectTab('tasks')}
          className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="text-sm font-semibold text-slate-600 flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
            <span>Pending Nursing Tasks</span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
              {pendingCount}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            <span>Awaiting nursing staff execution / sign-off</span>
          </div>
        </div>

        {/* Card 3: Nurse Activity Logs */}
        <div
          onClick={() => onSelectTab && onSelectTab('nurse-logs')}
          className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="text-sm font-semibold text-slate-600 flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700">
              <FileText className="w-5 h-5" />
            </div>
            <span>Nurse Activity Events</span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
              {auditLogs.length}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            <span>Logged clinical actions in nurse audit ledger</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1 (DEFAULT): ACTIVE NURSES DIRECTORY */}
      {/* ========================================================= */}
      {activeTab === 'active-nurses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header Bar & Filters */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-teal-800" />
                <h2 className="text-base font-bold text-slate-900">Active Nurses Directory</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {nurses.length} On Duty
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Live roster of registered nursing staff with departmental filtering and contact capabilities.
              </p>
            </div>

            {/* Department Filter & Search Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Department Selector */}
              <div className="relative">
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="w-full sm:w-48 pl-3 pr-8 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700 appearance-none cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <Layers className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>

              {/* Nurse Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, UID or email..."
                  value={nurseSearch}
                  onChange={(e) => setNurseSearch(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-700"
                />
              </div>

              {/* Refresh button */}
              <button
                onClick={loadNurses}
                className="p-2 text-slate-600 hover:text-teal-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Refresh Directory"
              >
                <RefreshCw className={`w-4 h-4 ${nursesLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Nurses Grid */}
          <div className="p-6">
            {nursesLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-700 mb-2" />
                <span>Loading active nursing workforce directory...</span>
              </div>
            ) : nurses.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No active nurses match the current department or search criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {nurses.map((nurse) => (
                  <div
                    key={nurse.id}
                    className="p-5 rounded-xl border border-slate-200/90 bg-white hover:border-teal-300 hover:shadow-soft-sm transition-all flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-teal-800 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                            {nurse.name
                              ? nurse.name
                                  .split(' ')
                                  .map((n: string) => n[0])
                                  .join('')
                                  .substring(0, 2)
                                  .toUpperCase()
                              : 'RN'}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 leading-tight">
                              {nurse.name}
                            </h3>
                            <span className="text-xs text-slate-500 font-medium">
                              {nurse.role || 'Registered Nurse'}
                            </span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active Duty</span>
                        </span>
                      </div>

                      {/* Details block */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Department:</span>
                          <span className="font-semibold text-slate-800">
                            {nurse.department || 'Inpatient Care'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Employee UID:</span>
                          <span className="font-mono text-slate-700">
                            {nurse.employee_uid || nurse.employeeUid || 'EMP-NUR-01'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Official Email:</span>
                          <span className="text-slate-700 truncate max-w-[160px]" title={nurse.email}>
                            {nurse.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick message nurse button */}
                    <button
                      onClick={onOpenContactModal}
                      className="w-full mt-1 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200/90 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5 text-teal-700" />
                      <span>Message Nurse</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: NURSING STAFF TASKS */}
      {/* ========================================================= */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <div className="text-xs font-bold text-slate-900">
                Scheduled Nursing Care &amp; Shift Tasks
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {pendingCount} tasks remaining across hospital departments
              </div>
            </div>
            <button
              onClick={() => setNewTaskOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {tasksLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-700 mb-2" />
                <span>Loading scheduled nursing tasks...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No active nursing tasks on file. All orders signed off.
              </div>
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 sm:px-6 flex items-center justify-between gap-4 ${
                    t.isCompleted ? 'bg-slate-50/50' : 'hover:bg-teal-50/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        t.isCompleted
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {t.isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-semibold ${
                            t.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {t.description}
                        </span>
                        {t.priority === 'High' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            STAT
                          </span>
                        )}
                        {t.priority === 'Urgent' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            URGENT
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {t.patientName ? `Patient: ${t.patientName} • ` : ''}Scheduled: {t.scheduledTime}
                        {t.completedByName && ` • Done by ${t.completedByName}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!t.isCompleted ? (
                      <button
                        onClick={() => handleCompleteTask(t.id)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Done</span>
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-700 font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Completed</span>
                      </span>
                    )}

                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                      title="Delete nursing task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 3: NURSE ACTIVITY AUDIT LOGS */}
      {/* ========================================================= */}
      {activeTab === 'nurse-logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header Bar */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-teal-800" />
                <h2 className="text-base font-bold text-slate-900">
                  Nurse Activity Logs &amp; Clinical Audit Trail
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {auditLogs.length} Events
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative hospital audit logging strictly tracking nurses&apos; clinical actions, vitals entries, and task updates.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Action Filter */}
              <select
                value={logActionFilter}
                onChange={(e) => setLogActionFilter(e.target.value)}
                className="pl-3 pr-8 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700 appearance-none cursor-pointer"
              >
                <option value="ALL">All Nursing Actions</option>
                <option value="RECORD_VITALS">Vitals Recorded</option>
                <option value="COMPLETE_NURSING_TASK">Tasks Completed</option>
                <option value="CREATE_NURSING_TASK">Tasks Created</option>
                <option value="DELETE_NURSING_TASK">Tasks Deleted</option>
                <option value="CONTACT_ADMIN_DISPATCHED">Admin Notices</option>
              </select>

              {/* Log Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search log details or nurse..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full sm:w-56 pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-700"
                />
              </div>

              {/* Refresh */}
              <button
                onClick={loadAuditLogs}
                className="p-2 text-slate-600 hover:text-teal-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Refresh Logs"
              >
                <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto">
            {logsLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-700 mb-2" />
                <span>Loading nurse audit trail...</span>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No nurse activity events recorded yet matching this filter.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-6">Timestamp</th>
                    <th className="py-3.5 px-6">Nurse Staff</th>
                    <th className="py-3.5 px-6">Action Event</th>
                    <th className="py-3.5 px-6">Activity Details</th>
                    <th className="py-3.5 px-6">Resource</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {auditLogs.map((log) => {
                    const actionType = log.action || '';
                    let badgeClass = 'bg-slate-50 text-slate-700 border-slate-200';
                    if (actionType.includes('VITALS')) {
                      badgeClass = 'bg-teal-50 text-teal-800 border-teal-200';
                    } else if (actionType.includes('COMPLETE')) {
                      badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    } else if (actionType.includes('CREATE')) {
                      badgeClass = 'bg-sky-50 text-sky-800 border-sky-200';
                    } else if (actionType.includes('DELETE')) {
                      badgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
                    } else if (actionType.includes('ADMIN')) {
                      badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                    }

                    const formattedTime = log.timestamp
                      ? new Date(log.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-6 font-mono text-slate-500 whitespace-nowrap">
                          {formattedTime}
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{log.nurseName}</div>
                          <div className="text-[11px] text-slate-400">{log.nurseEmail}</div>
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-semibold text-[10.5px] border ${badgeClass}`}
                          >
                            {actionType}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-slate-800 max-w-md">
                          {log.details}
                        </td>
                        <td className="py-3.5 px-6 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {log.resourceType || 'clinical_record'}
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
      {/* VIEW 4: CONTACT ADMINISTRATOR */}
      {/* ========================================================= */}
      {activeTab === 'contact-admin' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-slate-100 bg-linear-to-r from-teal-50/50 via-slate-50/30 to-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-md shrink-0">
                <Shield className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 font-sans">
                    Contact Hospital Administration
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-mono">
                    Administrative Priority
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Dispatch priority escalations, staffing alerts, or operational notices directly to institutional Hospital Administrators.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-6 max-w-3xl">
            {adminError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs md:text-sm flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{adminError}</span>
              </div>
            )}

            {adminSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs md:text-sm flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-semibold">Notice Dispatched Successfully</div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    Your message has been transmitted to Hospital Administrators and recorded in the audit trail.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleDispatchAdminNotice} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Notice Subject *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical nursing staffing shortage in Emergency Ward"
                  value={adminSubject}
                  onChange={(e) => {
                    setAdminSubject(e.target.value);
                    if (adminError) setAdminError(null);
                  }}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 transition-all bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Escalation Priority
                </label>
                <select
                  value={adminPriority}
                  onChange={(e) => setAdminPriority(e.target.value)}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-700 bg-white cursor-pointer"
                >
                  <option value="Normal">Normal — General Administrative Notice</option>
                  <option value="High">High — Operational Support Needed</option>
                  <option value="Urgent">Urgent — Immediate Workforce / Clinical Escalation</option>
                  <option value="Critical">Critical — Facility Command Level Incident</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Message Details *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Describe the operational escalation, staffing requirements, or hospital-wide nursing issues in detail..."
                  value={adminMessage}
                  onChange={(e) => {
                    setAdminMessage(e.target.value);
                    if (adminError) setAdminError(null);
                  }}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 transition-all bg-white"
                />
              </div>

              <div className="pt-2 flex items-center gap-4">
                <button
                  type="submit"
                  disabled={adminSending || !adminSubject.trim() || !adminMessage.trim()}
                  className="px-6 py-3.5 text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4.5 h-4.5" />
                  <span>{adminSending ? 'Dispatching Escalation...' : 'Dispatch Notice to Administration'}</span>
                </button>
              </div>
            </form>
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

                <div className="pt-2 flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={inlineLoading || !inlineEmail.trim()}
                    className="px-6 py-3.5 text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                  >
                    <Mail className="w-4.5 h-4.5 text-teal-200" />
                    <span>{inlineLoading ? 'Verifying & Dispatching...' : 'Send Reset Password Link'}</span>
                  </button>
                </div>
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
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 font-sans">
                    Change Account Username
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-mono">
                    Unique Identity
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Manage your personal workstation login handle across all hospital systems.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-6 max-w-3xl">
            {/* Current Identifier Card */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Current Active Login Handle
                </span>
                <span className="text-lg md:text-xl font-bold font-mono text-teal-950 mt-0.5 block">
                  @{activeUsername || username || 'supervisor'}
                </span>
              </div>
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Verified System Handle</span>
              </span>
            </div>

            {/* Direct Inline Change Username Form */}
            <form onSubmit={handleInlineChangeUsername} className="space-y-6">
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

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-800">
                  New Desired Username *
                </label>
                <div className="relative">
                  <span className="text-slate-400 font-bold font-mono text-sm absolute left-4 top-3.5 select-none">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. sarah.supervisor or nurse_sup_claire"
                    value={newUsernameInput}
                    onChange={(e) => {
                      setNewUsernameInput(e.target.value);
                      if (usernameError) setUsernameError(null);
                      if (usernameSuccessMsg) setUsernameSuccessMsg(null);
                    }}
                    className="w-full pl-9 pr-4 py-3 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 transition-all bg-white font-mono"
                  />
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 space-y-1">
                  <div className="font-semibold text-slate-700">Username Requirements:</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11.5px]">
                    <li>Must be between 3 and 64 characters in length.</li>
                    <li>May contain letters, numbers, periods (.), and underscores (_).</li>
                    <li>Case-insensitive and globally unique across the entire hospital network.</li>
                    <li>Immediate activation: used for all future workstation logins.</li>
                  </ul>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-4">
                <button
                  type="submit"
                  disabled={usernameLoading || !newUsernameInput.trim()}
                  className="px-6 py-3.5 text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4.5 h-4.5" />
                  <span>{usernameLoading ? 'Validating & Saving...' : 'Save & Update Username'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD NURSING TASK (No Bed Number!) */}
      {/* ========================================================= */}
      {newTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn select-none">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Add Nursing Shift Task</h2>
                  <p className="text-xs text-slate-500">Order patient care or routine check</p>
                </div>
              </div>
              <button
                onClick={() => setNewTaskOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Task Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Change IV dressing & check urine output"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Patient Name or MRN (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aarav Sharma or MRN-EMG-201"
                  value={taskPatientName}
                  onChange={(e) => setTaskPatientName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Scheduled Time</label>
                  <input
                    type="text"
                    required
                    value={taskTime}
                    onChange={(e) => setTaskTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700 bg-white"
                  >
                    <option value="Routine">Routine</option>
                    <option value="High">High (STAT)</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewTaskOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskCreating || !taskDesc.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors shadow-soft-sm cursor-pointer disabled:opacity-50"
                >
                  {taskCreating ? 'Adding Task...' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
