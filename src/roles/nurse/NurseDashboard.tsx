import React, { useState, useEffect } from 'react';
import { Patient, Appointment } from '../../types';
import { NursingTask, clinicalApiClient } from '../../services/clinicalApiClient';
import {
  Activity,
  Bed,
  CheckCircle2,
  Clock,
  Heart,
  Plus,
  Shield,
  Stethoscope,
  Thermometer,
  UserCheck,
  AlertTriangle,
  Pill,
  ClipboardList,
} from 'lucide-react';

interface NurseDashboardProps {
  nurseName: string;
  departmentName: string;
  patients: Patient[];
  onToast: (title: string, desc: string) => void;
}

export const NurseDashboard: React.FC<NurseDashboardProps> = ({
  nurseName,
  departmentName,
  patients,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'ward' | 'vitals' | 'tasks' | 'mar'>('ward');
  const [tasks, setTasks] = useState<NursingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Fetch live nursing tasks from database on mount
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
      .finally(() => {
        setTasksLoading(false);
      });
  }, []);

  // Vitals entry modal state
  const [vitalsModalPatient, setVitalsModalPatient] = useState<Patient | null>(null);
  const [bp, setBp] = useState('120/80');
  const [hr, setHr] = useState(72);
  const [temp, setTemp] = useState('98.6');
  const [spo2, setSpo2] = useState(98);
  const [bloodSugar, setBloodSugar] = useState('105');
  const [savingVitals, setSavingVitals] = useState(false);

  // New task modal
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [taskPatientName, setTaskPatientName] = useState('');
  const [taskBed, setTaskBed] = useState('Bed 102');
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
            : t
        )
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
        patientName: taskPatientName || undefined,
        bedNumber: taskBed,
        taskType: 'nursing_care',
        description: taskDesc,
        scheduledTime: taskTime,
        priority: taskPriority,
      });
      setTasks((prev) => [created, ...prev]);
      setNewTaskOpen(false);
      setTaskDesc('');
      onToast('Task Created', 'Nursing task saved to clinical database.');
    } catch (err: any) {
      onToast('Task Creation Error', err.message || 'Failed to save task in database.');
    }
  };

  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const pendingCount = tasks.filter((t) => !t.isCompleted).length;

  return (
    <div className="space-y-6">
      {/* Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 mb-1">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
            <span>Inpatient Care Ward • {departmentName}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
            Nursing Station & Ward Care — {nurseName}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active ward census, scheduled vitals rounds, medication administration records, and shift tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setNewTaskOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-soft-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Nursing Task</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-soft-sm">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Bed className="w-4 h-4 text-teal-700" />
            <span>Admitted Ward Patients</span>
          </div>
          <div className="text-2xl font-bold font-sans text-slate-950 mt-1.5">
            {patients.length || 6}
          </div>
          <div className="text-[11px] text-teal-700 font-medium mt-0.5">85% Ward Bed Occupancy</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-soft-sm">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Pending Nursing Tasks</span>
          </div>
          <div className="text-2xl font-bold font-sans text-amber-700 mt-1.5">
            {pendingCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Due during current shift</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-soft-sm">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Tasks Completed</span>
          </div>
          <div className="text-2xl font-bold font-sans text-emerald-700 mt-1.5">
            {completedCount}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Signed off by nurse</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-soft-sm">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-teal-800" />
            <span>Shift Status</span>
          </div>
          <div className="text-base font-bold font-sans text-teal-900 mt-2">
            Day Shift Active
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Ratio: 1:3 Patient Coverage</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-medium gap-2">
        <button
          onClick={() => setActiveTab('ward')}
          className={`pb-2.5 px-3 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ward'
              ? 'border-teal-800 text-teal-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bed className="w-4 h-4" />
          <span>Ward Bed Census ({patients.length || 6})</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-2.5 px-3 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'tasks'
              ? 'border-teal-800 text-teal-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Shift Tasks ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('mar')}
          className={`pb-2.5 px-3 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'mar'
              ? 'border-teal-800 text-teal-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>Medication Administration (MAR)</span>
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-200/80 font-mono font-medium">Future Scope</span>
        </button>
      </div>

      {/* Tab: Ward Bed Census */}
      {activeTab === 'ward' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-800">
              Department Inpatient Bed Roster • {departmentName}
            </div>
            <span className="text-[11px] text-slate-500">Live bedside monitoring</span>
          </div>

          <div className="divide-y divide-slate-100">
            {patients.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No patients currently admitted to {departmentName} ward.
              </div>
            ) : (
              patients.map((p, idx) => (
                <div key={p.id} className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                      {p.bedOrRoom || `Bed ${101 + idx}`}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{p.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{p.mrn}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {p.triageCategory}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Age: {p.age} • Gender: {p.gender} • Blood: {p.bloodGroup} • Attending: {p.attendingPhysician}
                      </div>
                      {p.chiefComplaint && (
                        <div className="text-[11px] text-slate-600 mt-1 italic">
                          Complaint: &quot;{p.chiefComplaint}&quot;
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vitals summary */}
                  <div className="flex items-center gap-3">
                    {p.vitals ? (
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono space-y-0.5">
                        <div>BP: <strong>{p.vitals.bp}</strong> | HR: <strong>{p.vitals.heartRate} bpm</strong></div>
                        <div>Temp: <strong>{p.vitals.temperature}</strong> | SpO2: <strong>{p.vitals.spo2}%</strong></div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                        Vitals Due
                      </span>
                    )}

                    <button
                      onClick={() => setVitalsModalPatient(p)}
                      className="px-3 py-1.5 text-xs font-semibold text-teal-800 hover:text-white bg-teal-50 hover:bg-teal-800 border border-teal-200 rounded-lg transition-colors cursor-pointer shrink-0"
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

      {/* Tab: Shift Tasks */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-800">Scheduled Nursing Care &amp; Ward Orders</div>
            <span className="text-[11px] text-slate-500">{pendingCount} remaining</span>
          </div>

          <div className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <div key={t.id} className={`p-4 sm:px-6 flex items-center justify-between gap-4 ${t.isCompleted ? 'bg-slate-50/50' : 'hover:bg-teal-50/20'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t.isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${t.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {t.description}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-100 text-slate-600">
                        {t.bedNumber || 'Bed 101'}
                      </span>
                      {t.priority === 'High' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          STAT
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Patient: {t.patientName} • Scheduled: {t.scheduledTime}
                      {t.completedByName && ` • Done by ${t.completedByName}`}
                    </div>
                  </div>
                </div>

                {!t.isCompleted ? (
                  <button
                    onClick={() => handleCompleteTask(t.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Mark Done
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Completed</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Medication Administration Record (Future Scope) */}
      {activeTab === 'mar' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Ward Medication Administration Record (e-MAR)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                  Future Scope
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized dispensary verification, e-MAR scheduling, and bedside dose sign-off workflows are deferred to future scope.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              Module Staged
            </span>
          </div>

          <div className="rounded-xl bg-amber-50/50 border border-amber-200/80 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                <Pill className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-950">Medication Administration Workflows are Non-Operational</h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  The hospital e-MAR and pharmacy dispensing module are currently non-operational and scheduled for a future clinical release.
                  No medications or doses can be recorded, dispensed, or signed off in this view.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-amber-200/60 text-[11px] text-amber-900/80 leading-relaxed">
              <strong>Clinical Prescribing Notice:</strong> Attending physicians and doctors can continue authoring and viewing clinical prescriptions directly within patient consultation records and EMR encounters.
            </div>
          </div>
        </div>
      )}

      {/* Record Vitals Modal */}
      {vitalsModalPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Bedside Vitals</h3>
                <p className="text-xs text-slate-500">{vitalsModalPatient.name} ({vitalsModalPatient.mrn})</p>
              </div>
              <button
                onClick={() => setVitalsModalPatient(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveVitals} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Pressure (mmHg)</label>
                  <input
                    type="text"
                    required
                    value={bp}
                    onChange={(e) => setBp(e.target.value)}
                    placeholder="120/80"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    required
                    value={hr}
                    onChange={(e) => setHr(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Temperature (°F)</label>
                  <input
                    type="text"
                    required
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Oxygen Saturation (%)</label>
                  <input
                    type="number"
                    required
                    value={spo2}
                    onChange={(e) => setSpo2(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Glucose (mg/dL)</label>
                <input
                  type="text"
                  value={bloodSugar}
                  onChange={(e) => setBloodSugar(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVitalsModalPatient(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVitals}
                  className="px-5 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-soft-sm"
                >
                  {savingVitals ? 'Saving...' : 'Save Vitals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Nursing Task Modal */}
      {newTaskOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Schedule Nursing Care Task</h3>
              <button onClick={() => setNewTaskOpen(false)} className="text-slate-400 font-bold text-lg">&times;</button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Task Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Change IV dressing, check surgical drain output"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Patient Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Patient Full Name"
                    value={taskPatientName}
                    onChange={(e) => setTaskPatientName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bed Number</label>
                  <input
                    type="text"
                    value={taskBed}
                    onChange={(e) => setTaskBed(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Time</label>
                  <input
                    type="text"
                    value={taskTime}
                    onChange={(e) => setTaskTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Routine">Routine</option>
                    <option value="Priority">Priority</option>
                    <option value="High">STAT / Critical</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewTaskOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-soft-sm"
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

