import React, { useState, useEffect } from 'react';
import { Patient } from '../../types';
import { NursingTask, clinicalApiClient } from '../../services/clinicalApiClient';
import { authService } from '../../services/authService';
import {
  Activity,
  CheckCircle2,
  Clock,
  Heart,
  Plus,
  Shield,
  Stethoscope,
  Thermometer,
  UserCheck,
  Users,
  AlertTriangle,
  Pill,
  ClipboardList,
  Send,
  FileText,
  History,
  KeyRound,
  UserCog,
  Search,
  Check,
  X,
  Eye,
  Calendar,
  Layers,
  Mail,
  AlertCircle,
  Trash2,
} from 'lucide-react';

interface NurseWorkspaceProps {
  nurseName: string;
  departmentName: string;
  patients: Patient[];
  onToast: (title: string, desc: string) => void;
  currentTab?: string;
  onSelectTab?: (tabId: string) => void;
  onOpenContactModal?: () => void;
  onOpenChangePassword?: () => void;
  onOpenChangeUsername?: () => void;
  token?: string;
  username?: string;
  userEmail?: string;
}

export const NurseWorkspace: React.FC<NurseWorkspaceProps> = ({
  nurseName,
  departmentName,
  patients,
  onToast,
  currentTab = 'patient-data',
  onSelectTab,
  onOpenContactModal,
  onOpenChangePassword,
  onOpenChangeUsername,
  token,
  username = '',
  userEmail = '',
}) => {
  // Normalize tab identifier
  const activeTab = currentTab === 'ward' ? 'patient-data' : currentTab;

  const [tasks, setTasks] = useState<NursingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Search filter inside patient lists
  const [patientSearch, setPatientSearch] = useState('');

  // Selected patient for record details
  const [selectedRecordPatient, setSelectedRecordPatient] = useState<Patient | null>(null);

  // Inline email verification password reset state (no direct password changes permitted)
  const [inlineEmail, setInlineEmail] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineResetError, setInlineResetError] = useState<string | null>(null);
  const [inlineResetSuccess, setInlineResetSuccess] = useState(false);

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
      onToast('Reset Link Dispatched', `Password reset link sent to ${clean}. Please check your inbox.`);
    } catch (err: any) {
      setInlineResetError(err.message || 'Failed to dispatch password reset link.');
    } finally {
      setInlineLoading(false);
    }
  };

  // Username state & handler for View 6
  const [activeUsername, setActiveUsername] = useState(username || '');
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
      onToast('Username Updated', `Your login username is now @${clean}.`);

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

  const handleDeleteTask = async (taskId: string) => {
    try {
      await clinicalApiClient.deleteNursingTask(taskId, token);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      onToast('Task Deleted', 'Nursing task removed from shift schedule.');
    } catch (err: any) {
      onToast('Delete Error', err.message || 'Could not delete task from schedule.');
    }
  };

  // Load live nursing tasks on mount
  useEffect(() => {
    setTasksLoading(true);
    clinicalApiClient
      .getNursingTasks()
      .then((loaded) => {
        if (loaded) setTasks(loaded);
      })
      .catch((err) => {
        console.warn('Unable to load live nursing tasks from API:', err);
      })
      .finally(() => setTasksLoading(false));
  }, []);

  // Vitals entry modal state
  const [vitalsModalPatient, setVitalsModalPatient] = useState<Patient | null>(null);
  const [bp, setBp] = useState('120/80');
  const [hr, setHr] = useState(72);
  const [temp, setTemp] = useState('98.6');
  const [spo2, setSpo2] = useState(98);
  const [bloodSugar, setBloodSugar] = useState('105');
  const [savingVitals, setSavingVitals] = useState(false);

  // New task modal state (accessible from Tasks view)
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [taskPatientName, setTaskPatientName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskTime, setTaskTime] = useState('12:00 PM');
  const [taskPriority, setTaskPriority] = useState('Routine');

  const handleCompleteTask = async (taskId: string) => {
    try {
      await clinicalApiClient.completeNursingTask(taskId);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, isCompleted: true, completedByName: nurseName, completedAt: new Date().toLocaleTimeString() }
            : t,
        ),
      );
      onToast('Nursing Task Completed', 'Task marked completed and logged to nursing shift ledger.');
    } catch (err: any) {
      onToast('Task Update Error', err.message || 'Could not update task in database.');
    }
  };

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vitalsModalPatient) return;
    setSavingVitals(true);
    try {
      await clinicalApiClient.recordVitals(vitalsModalPatient.id, {
        bp: `${bp} mmHg`,
        heartRate: Number(hr),
        temperature: `${temp} °F`,
        spo2: Number(spo2),
        bloodGlucose: `${bloodSugar} mg/dL`,
      });
      onToast('Vitals Recorded', `Vital signs successfully updated for ${vitalsModalPatient.name}.`);
      setVitalsModalPatient(null);
    } catch (err: any) {
      onToast('Error Recording Vitals', err.message || 'Failed to persist vitals in database.');
    } finally {
      setSavingVitals(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDesc) return;
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
    } catch (err: any) {
      onToast('Task Creation Error', err.message || 'Failed to save task in database.');
    }
  };

  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const pendingCount = tasks.filter((t) => !t.isCompleted).length;

  // Filter strictly for this department if department is populated on patient
  const departmentPatients = patients.filter((p) => {
    if (!departmentName || departmentName === 'Hospital-Wide' || departmentName === 'Facility-wide') return true;
    return !p.department || p.department.toLowerCase() === departmentName.toLowerCase();
  });

  const filteredPatients = departmentPatients.filter((p) => {
    if (!patientSearch) return true;
    const q = patientSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q) ||
      (p.chiefComplaint && p.chiefComplaint.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            Welcome, {nurseName}
          </h1>
        </div>

        {/* Contact Staff Action button (expanded size for prominence) */}
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

      {/* Metrics Row (3 Large Balanced Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Box 1: Admitted Patients (Department Scoped) */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all">
          <div className="text-sm font-semibold text-slate-600 flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200/70 text-teal-700">
              <UserCheck className="w-5 h-5" />
            </div>
            <span>Admitted Patients</span>
          </div>
          <div className="text-3xl md:text-4xl font-extrabold font-sans text-slate-950 mt-3">
            {departmentPatients.length}
          </div>
          <div className="text-xs text-teal-700 font-semibold mt-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{departmentName} Inpatient Census</span>
          </div>
        </div>

        {/* Box 2: Pending Nursing Tasks */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all">
          <div className="text-sm font-semibold text-slate-600 flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <span>Pending Nursing Tasks</span>
          </div>
          <div className="text-3xl md:text-4xl font-extrabold font-sans text-amber-700 mt-3">
            {pendingCount}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1.5">
            Due during active shift rounds
          </div>
        </div>

        {/* Box 3: Completed Nursing Tasks */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all">
          <div className="text-sm font-semibold text-slate-600 flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span>Completed Nursing Tasks</span>
          </div>
          <div className="text-3xl md:text-4xl font-extrabold font-sans text-emerald-700 mt-3">
            {completedCount}
          </div>
          <div className="text-xs text-emerald-700 font-semibold mt-1.5">
            Signed off by nursing staff
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: PATIENT DATA */}
      {/* ========================================================= */}
      {activeTab === 'patient-data' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/60">
            <div>
              <div className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2.5">
                <span>Department Inpatient Census &amp; Patient Roster</span>
                <span className="text-xs font-mono px-3 py-0.5 rounded-full bg-teal-100/80 text-teal-900 font-bold">
                  {filteredPatients.length} Admitted
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Live patient monitoring, triage classification, and vital signs updates for {departmentName}.
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search patient or MRN..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs md:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-700 shadow-2xs"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredPatients.length === 0 ? (
              <div className="p-16 text-center text-sm text-slate-400">
                No admitted patients match your filter in {departmentName}.
              </div>
            ) : (
              filteredPatients.map((p) => (
                <div
                  key={p.id}
                  className="p-5 sm:px-7 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200/90 text-teal-800 flex items-center justify-center font-extrabold text-lg shrink-0 shadow-2xs">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-sm md:text-base font-bold text-slate-900">{p.name}</span>
                        <span className="text-xs font-mono text-slate-500">{p.mrn}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {p.triageCategory || 'Stable'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-medium">
                        Age: {p.age} • Gender: {p.gender} • Blood: {p.bloodGroup} • Attending: {p.attendingPhysician}
                      </div>
                      {p.chiefComplaint && (
                        <div className="text-xs text-slate-600 mt-1.5 italic">
                          Complaint: &quot;{p.chiefComplaint}&quot;
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vitals summary & Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    {p.vitals ? (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono space-y-1 shadow-2xs">
                        <div>
                          BP: <strong>{p.vitals.bp}</strong> | HR: <strong>{p.vitals.heartRate} bpm</strong>
                        </div>
                        <div>
                          Temp: <strong>{p.vitals.temperature}</strong> | SpO2: <strong>{p.vitals.spo2}%</strong>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-medium">
                        Vitals Due
                      </span>
                    )}

                    <button
                      onClick={() => setVitalsModalPatient(p)}
                      className="px-4 py-2.5 text-xs font-bold text-teal-800 hover:text-white bg-teal-50 hover:bg-teal-800 border border-teal-200 rounded-xl transition-all cursor-pointer shrink-0 shadow-2xs hover:shadow-sm"
                    >
                      Record Vitals
                    </button>
                  </div>
                </div>
              ))
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
                {pendingCount} tasks remaining for current nursing shift
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
            {tasks.length === 0 ? (
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
      {/* VIEW 3: PATIENT HISTORY */}
      {/* ========================================================= */}
      {activeTab === 'patient-history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-teal-700" />
                <span>Patient Clinical &amp; Admission History</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Historical vitals rounds, previous ward admissions, and encounter timelines.
              </p>
            </div>
            <div className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              Department: {departmentName}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patients.map((p, idx) => (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-teal-200 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{p.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">MRN: {p.mrn}</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                    Admitted
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1 bg-white p-2.5 rounded-lg border border-slate-100">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Chief Complaint:</span>
                    <span className="font-medium text-slate-800">{p.chiefComplaint || 'Routine Monitoring'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Attending Physician:</span>
                    <span className="font-medium text-slate-800">{p.attendingPhysician}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Triage Priority:</span>
                    <span className="font-medium text-emerald-700">{p.triageCategory || 'Level 3 - Urgent'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Last Vitals Checked:</span>
                    <span className="font-mono text-slate-700">{p.vitals ? `${p.vitals.bp} (${p.vitals.heartRate} bpm)` : 'Pending'}</span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Admission Date: Today</span>
                  <button
                    onClick={() => {
                      setSelectedRecordPatient(p);
                    }}
                    className="text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
                  >
                    View Timeline &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 4: PATIENT RECORDS */}
      {/* ========================================================= */}
      {activeTab === 'patient-records' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-700" />
                <span>Patient Electronic Records &amp; Clinical Charts</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inpatient digital chart dossiers, intake summaries, and nursing observation documents.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {patients.map((p, idx) => (
              <div
                key={p.id}
                className="p-4 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">({p.mrn})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Age: {p.age} • Gender: {p.gender} • Attending: {p.attendingPhysician}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedRecordPatient(p)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-teal-900 bg-slate-100 hover:bg-teal-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Record</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 5: CHANGE PASSWORD */}
      {/* ========================================================= */}
      {activeTab === 'change-password' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header Bar */}
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
                  Verified email security protocol — direct in-session password alteration is disabled to protect clinical data.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-6 max-w-3xl">
            {/* Policy Banner */}
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
                    Send to Another Registered Address
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInlineResetPassword} className="space-y-6">
                {inlineResetError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs md:text-sm flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{inlineResetError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-800">
                    Re-enter Registered Official Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. your.email@hospital.org"
                      value={inlineEmail}
                      onChange={(e) => {
                        setInlineEmail(e.target.value);
                        if (inlineResetError) setInlineResetError(null);
                      }}
                      className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 transition-all bg-white"
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    A cryptographically signed link will be sent to this email address to reset your password.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={inlineLoading || !inlineEmail.trim()}
                    className="px-6 py-3.5 text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                  >
                    <Mail className="w-4.5 h-4.5 text-teal-200" />
                    <span>{inlineLoading ? 'Dispatching Reset Link...' : 'Send Reset Password Link'}</span>
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
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header Bar */}
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
                  @{activeUsername || username || 'nurse'}
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
                    placeholder="e.g. sarah.nurse or nurse_jane"
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
      {/* MODAL: RECORD VITALS */}
      {/* ========================================================= */}
      {vitalsModalPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn select-none">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Record Patient Vitals</h2>
                  <p className="text-xs text-slate-500">
                    Patient: {vitalsModalPatient.name} ({vitalsModalPatient.mrn})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVitalsModalPatient(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVitals} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Blood Pressure (mmHg)
                  </label>
                  <input
                    type="text"
                    required
                    value={bp}
                    onChange={(e) => setBp(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Heart Rate (BPM)
                  </label>
                  <input
                    type="number"
                    required
                    value={hr}
                    onChange={(e) => setHr(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Temperature (°F)
                  </label>
                  <input
                    type="text"
                    required
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Oxygen Saturation (SpO2 %)
                  </label>
                  <input
                    type="number"
                    required
                    value={spo2}
                    onChange={(e) => setSpo2(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Blood Glucose (mg/dL)
                </label>
                <input
                  type="text"
                  required
                  value={bloodSugar}
                  onChange={(e) => setBloodSugar(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVitalsModalPatient(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVitals}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors shadow-soft-sm cursor-pointer"
                >
                  {savingVitals ? 'Saving...' : 'Save Vitals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD NURSING TASK */}
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors shadow-soft-sm cursor-pointer"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DRAWER: PATIENT RECORD DETAILS */}
      {/* ========================================================= */}
      {selectedRecordPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-2xs animate-fadeIn">
          <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedRecordPatient.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      MRN: {selectedRecordPatient.mrn} • Department: {selectedRecordPatient.department || departmentName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRecordPatient(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Patient Overview */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Demographics</span>
                  <span className="font-semibold text-slate-800">
                    {selectedRecordPatient.age} yrs • {selectedRecordPatient.gender} • Blood {selectedRecordPatient.bloodGroup}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Attending Physician</span>
                  <span className="font-semibold text-slate-800">
                    {selectedRecordPatient.attendingPhysician}
                  </span>
                </div>
              </div>

              {/* Clinical notes & complaint */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Intake Chief Complaint
                </h4>
                <div className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-100 text-xs text-teal-950 font-medium">
                  {selectedRecordPatient.chiefComplaint || 'Patient admitted for routine pre-op observation and continuous nursing care.'}
                </div>
              </div>

              {/* Recorded vitals */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Latest Clinical Observations
                </h4>
                {selectedRecordPatient.vitals ? (
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <span className="text-[10px] text-slate-400 block">Blood Pressure</span>
                      <span className="font-bold text-slate-800">{selectedRecordPatient.vitals.bp}</span>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <span className="text-[10px] text-slate-400 block">Heart Rate</span>
                      <span className="font-bold text-slate-800">{selectedRecordPatient.vitals.heartRate} bpm</span>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <span className="text-[10px] text-slate-400 block">Temperature</span>
                      <span className="font-bold text-slate-800">{selectedRecordPatient.vitals.temperature}</span>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <span className="text-[10px] text-slate-400 block">Oxygen SpO2</span>
                      <span className="font-bold text-slate-800">{selectedRecordPatient.vitals.spo2}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No vitals logged yet for this shift.</p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => {
                  setVitalsModalPatient(selectedRecordPatient);
                  setSelectedRecordPatient(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-xl transition-colors cursor-pointer"
              >
                Record Shift Vitals
              </button>
              <button
                onClick={() => setSelectedRecordPatient(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
