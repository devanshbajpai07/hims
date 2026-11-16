import React, { useState, useEffect, useMemo } from 'react';
import {
  Inbox,
  Send,
  CheckCircle2,
  Clock,
  Check,
  AlertCircle,
  KeyRound,
  Shield,
  Search,
  MessageSquare,
  RefreshCw,
  Plus,
  ClipboardList,
  Trash2,
  X,
  UserCog,
} from 'lucide-react';
import { clinicalApiClient, EmployeeMessage, NursingTask } from '../../services/clinicalApiClient';
import { authService } from '../../services/authService';

interface GeneralStaffDashboardProps {
  staffName?: string;
  hospitalName?: string;
  departmentName?: string;
  scopeType?: string;
  token?: string;
  effectivePermissions?: string[];
  currentTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenChangePassword?: () => void;
  onOpenChangeUsername?: () => void;
  onOpenContactModal?: () => void;
  username?: string;
  userEmail?: string;
  onToast?: (title: string, desc: string) => void;
}

export const GeneralStaffDashboard: React.FC<GeneralStaffDashboardProps> = ({
  staffName,
  hospitalName = 'Hospital Facility',
  departmentName = 'Facility-wide',
  scopeType = 'FACILITY',
  token,
  effectivePermissions,
  currentTab = 'inbox',
  onTabChange,
  onOpenChangePassword,
  onOpenChangeUsername,
  onOpenContactModal,
  username = '',
  userEmail = '',
  onToast,
}) => {
  // Normalize tab
  const activeTab = currentTab || 'inbox';

  const notify = (title: string, desc: string) => {
    if (onToast) onToast(title, desc);
  };

  // Communication Messages (Database Driven)
  const [inboxMessages, setInboxMessages] = useState<EmployeeMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<EmployeeMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState<{ [id: string]: string }>({});
  const [activeNoteInputId, setActiveNoteInputId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('all');

  // Staff Tasks State (Database Driven)
  const [tasks, setTasks] = useState<NursingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [taskPatientName, setTaskPatientName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskTime, setTaskTime] = useState('12:00 PM');
  const [taskPriority, setTaskPriority] = useState('Routine');

  // Inline Change Password State (Email Link Dispatch Only)
  const [inlineEmail, setInlineEmail] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineResetError, setInlineResetError] = useState<string | null>(null);
  const [inlineResetSuccess, setInlineResetSuccess] = useState(false);

  // Inline Change Username State
  const [activeUsername, setActiveUsername] = useState(username || '');
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccessMsg, setUsernameSuccessMsg] = useState<string | null>(null);

  const hasPerm = (code: string) => {
    if (!effectivePermissions) return true;
    return effectivePermissions.includes(code);
  };

  // Load communications from database
  const loadCommunications = async () => {
    if (!token && typeof window !== 'undefined' && !window.localStorage.getItem('hims_employee_session')) {
      return;
    }
    setLoading(true);
    try {
      const [inbox, sent] = await Promise.all([
        clinicalApiClient.getCommunicationInbox(token),
        clinicalApiClient.getCommunicationSent(token),
      ]);
      setInboxMessages(inbox || []);
      setSentMessages(sent || []);
    } catch (err) {
      console.warn('Failed to load communication records:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load staff tasks from database
  const loadTasks = async () => {
    setTasksLoading(true);
    try {
      const fetchedTasks = await clinicalApiClient.getStaffTasks(token);
      setTasks(fetchedTasks || []);
    } catch (err) {
      console.warn('Failed to load staff tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    loadCommunications();
    loadTasks();
    const interval = setInterval(() => {
      loadCommunications();
      loadTasks();
    }, 15000);
    return () => clearInterval(interval);
  }, [token]);

  // Task creation handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDesc.trim()) return;
    try {
      const created = await clinicalApiClient.createStaffTask(
        {
          patientName: taskPatientName.trim() || undefined,
          description: taskDesc.trim(),
          scheduledTime: taskTime.trim(),
          priority: taskPriority,
        },
        token,
      );
      setTasks((prev) => [created, ...prev]);
      setNewTaskOpen(false);
      setTaskDesc('');
      setTaskPatientName('');
      notify('Task Created', 'General staff task saved to database.');
    } catch (err: any) {
      notify('Task Creation Error', err.message || 'Failed to save staff task.');
    }
  };

  // Task completion handler
  const handleCompleteTask = async (taskId: string) => {
    try {
      await clinicalApiClient.completeStaffTask(taskId, token);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                isCompleted: true,
                completedByName: staffName || 'General Staff',
                completedAt: new Date().toLocaleTimeString(),
              }
            : t,
        ),
      );
      notify('Task Completed', 'Task marked completed and logged in shift ledger.');
    } catch (err: any) {
      notify('Task Error', err.message || 'Could not update task in database.');
    }
  };

  // Task deletion handler
  const handleDeleteTask = async (taskId: string) => {
    try {
      await clinicalApiClient.deleteStaffTask(taskId, token);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      notify('Task Deleted', 'Staff task removed from schedule.');
    } catch (err: any) {
      notify('Delete Error', err.message || 'Could not delete task from database.');
    }
  };

  // Communication Action Handlers
  const handleMarkComplete = async (msgId: string) => {
    setCompletingId(msgId);
    try {
      const note = completionNotes[msgId] || undefined;
      const updated = await clinicalApiClient.completeCommunicationMessage(msgId, note, token);
      setInboxMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
      setActiveNoteInputId(null);
      notify('Request Completed', 'Request marked as resolved and sender notified.');
    } catch (err: any) {
      notify('Error', err.message || 'Failed to complete task.');
    } finally {
      setCompletingId(null);
    }
  };

  const handleMarkInProgress = async (msgId: string) => {
    try {
      const updated = await clinicalApiClient.updateCommunicationMessageStatus(msgId, 'IN_PROGRESS', token);
      setInboxMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
      notify('Status Updated', 'Request status updated to In Progress.');
    } catch (err: any) {
      notify('Error', err.message || 'Failed to update status.');
    }
  };

  // Inline Password Reset Handler (Email confirmation only)
  const handleInlineResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inlineEmail.trim().toLowerCase();
    if (!clean) {
      setInlineResetError('Please enter your official email address.');
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
      notify('Reset Link Dispatched', `Password reset link sent to ${clean}. Please check your inbox.`);
    } catch (err: any) {
      setInlineResetError(err.message || 'Failed to dispatch password reset link.');
    } finally {
      setInlineLoading(false);
    }
  };

  // Inline Username Change Handler
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
      notify('Username Updated', `Your login username is now @${clean}.`);

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

  // Counts
  const pendingRequestsCount = inboxMessages.filter((m) => m.status === 'PENDING').length;
  const pendingTasksCount = tasks.filter((t) => !t.isCompleted).length;
  const completedTasksCount = tasks.filter((t) => t.isCompleted).length;

  // Filtered views
  const filteredInbox = useMemo(() => {
    return inboxMessages.filter((m) => {
      const matchFilter = statusFilter === 'all' || m.status === statusFilter;
      const matchSearch =
        searchQuery === '' ||
        m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.messageBody.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.senderRoleName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [inboxMessages, statusFilter, searchQuery]);

  const filteredSent = useMemo(() => {
    return sentMessages.filter((m) => {
      const matchSearch =
        searchQuery === '' ||
        m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.messageBody.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.recipientName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [sentMessages, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
            In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {/* ========================================================= */}
      {/* MAIN HEADER (Welcome & Prominent Contact Staff Button) */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            Welcome, {staffName || 'Staff Member'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {onOpenContactModal && (
            <button
              onClick={onOpenContactModal}
              className="px-6 py-3 text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl transition-all shadow-soft-sm cursor-pointer flex items-center gap-2.5 shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Contact Staff</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* METRICS ROW (3 Large Balanced Cards) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Box 1: Actionable Received Requests */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all">
          <div className="text-sm font-semibold text-slate-600 flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200/70 text-teal-700">
              <Inbox className="w-5 h-5" />
            </div>
            <span>Received Requests</span>
          </div>
          <div className="text-3xl md:text-4xl font-extrabold font-sans text-slate-950 mt-3">
            {inboxMessages.length}
          </div>
          <div className="text-xs text-teal-700 font-semibold mt-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{departmentName} Department Inbox</span>
          </div>
        </div>

        {/* Box 2: Pending Staff Tasks */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all">
          <div className="text-sm font-semibold text-slate-600 flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <span>Pending Staff Tasks</span>
          </div>
          <div className="text-3xl md:text-4xl font-extrabold font-sans text-amber-700 mt-3">
            {pendingTasksCount}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1.5">
            Due during active shift rounds
          </div>
        </div>

        {/* Box 3: Completed Staff Tasks */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all">
          <div className="text-sm font-semibold text-slate-600 flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span>Completed Staff Tasks</span>
          </div>
          <div className="text-3xl md:text-4xl font-extrabold font-sans text-emerald-700 mt-3">
            {completedTasksCount}
          </div>
          <div className="text-xs text-emerald-700 font-semibold mt-1.5">
            Signed off by general staff
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: RECEIVED REQUESTS (DEFAULT VIEW) */}
      {/* ========================================================= */}
      {activeTab === 'inbox' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/60">
            <div>
              <div className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2.5">
                <span>Received Requests &amp; Department Communications</span>
                <span className="text-xs font-mono px-3 py-0.5 rounded-full bg-teal-100/80 text-teal-900 font-bold">
                  {filteredInbox.length} Total
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Real-time communications dispatched from clinical staff and hospital administration.
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs md:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-700 shadow-2xs"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 outline-none focus:border-teal-700 bg-white shadow-2xs font-medium cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="PENDING">Pending Only</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>

              <button
                onClick={loadCommunications}
                disabled={loading}
                className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 shadow-2xs cursor-pointer"
                title="Refresh communications"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredInbox.length === 0 ? (
              <div className="p-16 text-center text-sm text-slate-400">
                No received communications or requests matching your filter in {departmentName}.
              </div>
            ) : (
              filteredInbox.map((msg) => {
                const isActionable = msg.status !== 'COMPLETED';
                return (
                  <div
                    key={msg.id}
                    className={`p-5 sm:px-7 transition-colors hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                      msg.isRead ? '' : 'bg-teal-50/20'
                    }`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(msg.status)}
                        {!msg.isRead && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white animate-pulse">
                            New
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <h3 className="text-sm md:text-base font-bold text-slate-900">{msg.subject}</h3>
                      <p className="text-xs md:text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {msg.messageBody}
                      </p>

                      <div className="pt-1 flex items-center gap-4 text-xs text-slate-500">
                        <div>
                          <span className="text-slate-400">From: </span>
                          <span className="font-semibold text-slate-800">{msg.senderName}</span>
                          <span className="text-slate-400 font-mono text-[11px] ml-1">
                            ({msg.senderRoleName} • {msg.senderDepartmentName || 'Hospital-Wide'})
                          </span>
                        </div>
                      </div>

                      {msg.status === 'COMPLETED' && msg.completedByName && (
                        <div className="mt-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-900">
                          <div className="font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              Completed by {msg.completedByName} on{' '}
                              {msg.completedAt ? new Date(msg.completedAt).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                          {msg.completionNotes && (
                            <p className="mt-1 text-[11px] text-emerald-700 italic">
                              &quot;{msg.completionNotes}&quot;
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Controls for General Staff */}
                    {isActionable && hasPerm('communication:complete') && (
                      <div className="shrink-0 flex flex-col sm:items-end gap-2 pt-1 sm:pt-0">
                        <div className="flex items-center gap-2">
                          {msg.status === 'PENDING' && hasPerm('communication:respond') && (
                            <button
                              onClick={() => handleMarkInProgress(msg.id)}
                              className="px-3.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100/80 border border-teal-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                            >
                              In Progress
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (activeNoteInputId === msg.id) {
                                handleMarkComplete(msg.id);
                              } else {
                                setActiveNoteInputId(msg.id);
                              }
                            }}
                            disabled={completingId === msg.id}
                            className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{completingId === msg.id ? 'Completing...' : 'Mark Done'}</span>
                          </button>
                        </div>

                        {activeNoteInputId === msg.id && (
                          <div className="mt-2 space-y-2 w-full sm:w-64 p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                            <input
                              type="text"
                              value={completionNotes[msg.id] || ''}
                              onChange={(e) =>
                                setCompletionNotes({
                                  ...completionNotes,
                                  [msg.id]: e.target.value,
                                })
                              }
                              placeholder="Optional resolution note..."
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800 outline-none focus:border-teal-700 bg-white"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setActiveNoteInputId(null)}
                                className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleMarkComplete(msg.id)}
                                className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs cursor-pointer"
                              >
                                Confirm
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: GENERAL STAFF TASKS (CREATION, DELETION, COMPLETION) */}
      {/* ========================================================= */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <div className="text-xs font-bold text-slate-900">
                Scheduled General Staff &amp; Operational Tasks
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {pendingTasksCount} tasks remaining for current shift
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
              <div className="p-12 text-center text-xs text-slate-400">Loading staff tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="p-16 text-center text-sm text-slate-400">
                No active staff tasks on file. All orders signed off.
              </div>
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 sm:px-6 flex items-center justify-between gap-4 transition-colors ${
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
                          className={`text-xs md:text-sm font-semibold ${
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
                        {t.patientName ? `Patient / Context: ${t.patientName} • ` : ''}Scheduled: {t.scheduledTime}
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
                      title="Delete staff task"
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
      {/* VIEW 3: SENT REQUESTS */}
      {/* ========================================================= */}
      {activeTab === 'sent' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/60">
            <div>
              <div className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2.5">
                <span>Dispatched Staff Requests</span>
                <span className="text-xs font-mono px-3 py-0.5 rounded-full bg-teal-100/80 text-teal-900 font-bold">
                  {filteredSent.length} Sent
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Requests and inquiries dispatched by you to other hospital colleagues.
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search sent requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs md:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-700 shadow-2xs"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredSent.length === 0 ? (
              <div className="p-16 text-center text-sm text-slate-400">
                No sent requests recorded yet.
              </div>
            ) : (
              filteredSent.map((msg) => (
                <div
                  key={msg.id}
                  className="p-5 sm:px-7 hover:bg-slate-50/70 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(msg.status)}
                      <span className="text-[11px] text-slate-400 font-mono">
                        Sent {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      To: <span className="font-semibold text-slate-800">{msg.recipientName}</span> (
                      {msg.recipientRoleName})
                    </div>
                  </div>

                  <h3 className="text-sm md:text-base font-bold text-slate-900">{msg.subject}</h3>
                  <p className="text-xs md:text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {msg.messageBody}
                  </p>

                  {msg.status === 'COMPLETED' && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-900">
                      <span className="font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Completed by {msg.completedByName} on{' '}
                          {msg.completedAt ? new Date(msg.completedAt).toLocaleString() : 'N/A'}
                        </span>
                      </span>
                      {msg.completionNotes && (
                        <p className="text-[11px] text-emerald-700 italic mt-1">
                          &quot;{msg.completionNotes}&quot;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 4: CHANGE PASSWORD (HIGH SECURITY POLICY LINK DISPATCH) */}
      {/* ========================================================= */}
      {activeTab === 'change-password' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm overflow-hidden animate-fadeIn">
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
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    High Security Policy
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Verified email security protocol — direct in-session password alteration is disabled to protect hospital data.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-6 max-w-3xl">
            <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-950 space-y-2">
              <div className="font-bold flex items-center gap-2 text-sm text-amber-900">
                <Shield className="w-4.5 h-4.5 text-amber-700 shrink-0" />
                <span>Hospital Cybersecurity Compliance Mandate</span>
              </div>
              <p className="text-xs md:text-[13px] text-amber-900/90 leading-relaxed">
                Direct in-session password inputs are prohibited across all hospital ward workstations to eliminate session hijacking and shoulder-surfing. To rotate your credentials, confirm your registered official email address below to receive an authenticated, single-use password reset link.
              </p>
            </div>

            {inlineResetSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-950">
                      Reset Password Link Dispatched Successfully
                    </h3>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Check your registered inbox to complete password rotation.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white/80 rounded-xl border border-emerald-200/80 text-xs text-slate-700 space-y-1.5 font-sans">
                  <div>Destination: <strong className="font-mono text-teal-900">{inlineEmail}</strong></div>
                  <div>Link Validity: <strong>60 Minutes (Single-Use Token)</strong></div>
                  <div>Instructions: Open the email, click the secure reset link, and choose your new password.</div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInlineResetSuccess(false);
                      setInlineEmail('');
                    }}
                    className="px-5 py-2.5 text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-100/60 border border-emerald-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                  >
                    Send Another Link
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInlineResetPassword} className="space-y-5">
                {inlineResetError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs md:text-sm flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{inlineResetError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1.5">
                    Re-enter Registered Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={inlineEmail}
                    onChange={(e) => setInlineEmail(e.target.value)}
                    placeholder={userEmail || 'name@hospital.org'}
                    className="w-full px-4 py-2.5 text-xs md:text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-teal-700 bg-white shadow-2xs font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    We will dispatch a cryptographically verified single-use link to this inbox.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={inlineLoading}
                    className="px-6 py-3 text-xs md:text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl transition-all shadow-soft-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{inlineLoading ? 'Dispatching Link...' : 'Send Reset Password Link'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 5: CHANGE USERNAME */}
      {/* ========================================================= */}
      {activeTab === 'change-username' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm overflow-hidden animate-fadeIn">
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
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Current Active Login Handle
                </span>
                <span className="text-lg md:text-xl font-bold font-mono text-teal-950 mt-0.5 block">
                  @{activeUsername || username || 'staff'}
                </span>
              </div>
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Verified System Handle</span>
              </span>
            </div>

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

              <div>
                <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1.5">
                  New Desired Username *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={newUsernameInput}
                    onChange={(e) => setNewUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                    placeholder="new_username"
                    className="w-full pl-8 pr-4 py-2.5 text-xs md:text-sm font-mono rounded-xl border border-slate-200 focus:outline-none focus:border-teal-700 bg-white shadow-2xs"
                  />
                </div>
                <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                  <span>Requirements:</span>
                  <span className={newUsernameInput.length >= 3 ? 'text-emerald-700 font-semibold' : ''}>
                    • 3–30 characters
                  </span>
                  <span>• Lowercase letters</span>
                  <span>• Numbers</span>
                  <span>• Dots &amp; underscores</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={usernameLoading || newUsernameInput.trim().length < 3}
                  className="px-6 py-3 text-xs md:text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl transition-all shadow-soft-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <UserCog className="w-4 h-4" />
                  <span>{usernameLoading ? 'Validating Uniqueness...' : 'Save & Update Username'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD STAFF TASK */}
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
                  <h2 className="text-sm font-semibold text-slate-900">Add Staff Task</h2>
                  <p className="text-xs text-slate-500">Order department task or routine check</p>
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
                  placeholder="e.g. Sanitize ultrasound probes & restock gel"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Patient Name or Context (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Radiology Room 2 / Aarav Sharma"
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors shadow-soft-sm cursor-pointer"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
