import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Appointment, Patient, AppointmentStatus, Doctor } from '../../types';
import {
  Users,
  CalendarCheck,
  CheckCircle2,
  Clock,
  UserPlus,
  CalendarPlus,
  Search,
  Check,
  AlertCircle,
  XCircle,
  MoreHorizontal,
  ChevronRight,
  Phone,
  DoorOpen,
  Building2,
  ClipboardList,
  UserCheck,
  ShieldAlert,
  KeyRound,
  Edit3,
  Calendar,
  Layers,
  MapPin,
  RefreshCw,
  Send,
  Mail,
  UserCog,
  FileText,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { clinicalApiClient } from '../../services/clinicalApiClient';
import { authService } from '../../services/authService';

interface ReceptionistDashboardProps {
  appointments: Appointment[];
  patients: Patient[];
  doctors?: Doctor[];
  staff?: any[];
  receptionistName?: string;
  hospitalName?: string;
  departmentName?: string;
  scopeType?: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  openRegisterModal: () => void;
  openScheduleModal: () => void;
  onCheckInPatient: (appointmentId: string) => void;
  onUpdateStatus: (appointmentId: string, status: AppointmentStatus) => void;
  onOpenEditPatient?: (patient: Patient) => void;
  onOpenChangePassword?: () => void;
  effectivePermissions?: string[];
  currentTab?: string;
  onTabChange?: (tab: string) => void;
  token?: string;
  username?: string;
  userEmail?: string;
  onOpenContactModal?: () => void;
  onToast?: (title: string, desc: string) => void;
}

export const ReceptionistDashboard: React.FC<ReceptionistDashboardProps> = ({
  appointments,
  patients,
  doctors = [],
  staff = [],
  receptionistName,
  hospitalName = 'Hospital Facility',
  departmentName = 'General Medicine',
  scopeType = 'FACILITY',
  searchQuery,
  setSearchQuery,
  openRegisterModal,
  openScheduleModal,
  onCheckInPatient,
  onUpdateStatus,
  onOpenEditPatient,
  effectivePermissions,
  currentTab = 'queue',
  onTabChange,
  token,
  username = '',
  userEmail = '',
  onOpenContactModal,
  onToast = () => {},
}) => {
  // Normalize current active view
  const activeTab = useMemo(() => {
    if (!currentTab || currentTab === 'overview' || currentTab === 'today-queue') return 'queue';
    return currentTab;
  }, [currentTab]);

  // Doctor Filter for Today's Queue
  const [filterDoctor, setFilterDoctor] = useState<string>('all');

  // Permission checker helper
  const hasPerm = (code: string) => {
    if (!effectivePermissions) return true;
    return effectivePermissions.includes(code);
  };

  // Derive distinct active doctors
  const availableDoctors = useMemo(() => {
    if (doctors && doctors.length > 0) return doctors;
    const fromApts = Array.from(new Set(appointments.map((a) => a.doctorName))).filter(Boolean);
    return fromApts.map((name) => ({
      id: name,
      name,
      specialty: 'Attending Physician',
      department: departmentName,
      status: 'Available' as const,
      patientsToday: appointments.filter((a) => a.doctorName === name).length,
      nextSlot: '15 mins',
      room: appointments.find((a) => a.doctorName === name)?.room || 'Room 101',
    }));
  }, [doctors, appointments, departmentName]);

  // Filtered appointments for Queue
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const matchDoctor = filterDoctor === 'all' || apt.doctorName === filterDoctor;
      const matchSearch =
        searchQuery === '' ||
        apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.patientMrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.doctorName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDoctor && matchSearch;
    });
  }, [appointments, filterDoctor, searchQuery]);

  // Overview counts for the 4 Reception KPI Cards
  const totalToday = appointments.length;
  const checkedInCount = appointments.filter((a) => a.status === 'checked-in').length;
  const inProgressCount = appointments.filter((a) => a.status === 'in-progress').length;
  const pendingCount = appointments.filter((a) => a.status === 'pending').length;
  const completedCount = appointments.filter((a) => a.status === 'completed').length;

  // =========================================================================
  // VIEW 2: PATIENT RECORDS BY DATE STATE
  // =========================================================================
  const getYesterdayIso = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  const getTodayIso = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [recordDate, setRecordDate] = useState<string>(getYesterdayIso());
  const [recordSearch, setRecordSearch] = useState<string>('');

  const filteredDatePatients = useMemo(() => {
    return patients.filter((p) => {
      // Check if registration date matches selected date
      const regIso = p.registeredAt ? p.registeredAt.split('T')[0] : '';
      const matchesDate = !recordDate || regIso === recordDate;

      if (!matchesDate) return false;

      if (!recordSearch.trim()) return true;
      const q = recordSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        (p.contact && p.contact.toLowerCase().includes(q)) ||
        (p.department && p.department.toLowerCase().includes(q)) ||
        (p.attendingPhysician && p.attendingPhysician.toLowerCase().includes(q)) ||
        (p.chiefComplaint && p.chiefComplaint.toLowerCase().includes(q))
      );
    });
  }, [patients, recordDate, recordSearch]);

  // =========================================================================
  // VIEW 3: ON-DUTY STAFF STATE (Deduplicated, Excludes Admin)
  // =========================================================================
  const [staffList, setStaffList] = useState<any[]>(staff || []);
  const [staffLoading, setStaffLoading] = useState<boolean>(false);
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [selectedStaffDept, setSelectedStaffDept] = useState<string>('all');
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);

  // Sync staffList with staff prop if available
  useEffect(() => {
    if (staff && staff.length > 0) {
      setStaffList(staff);
    }
  }, [staff]);

  const loadStaffAndDepartments = useCallback(async () => {
    setStaffLoading(true);
    try {
      const activeToken = token || authService.getStoredSession()?.token;
      const [fetchedStaff, depts] = await Promise.all([
        clinicalApiClient.getStaff(activeToken),
        clinicalApiClient.getDepartments(activeToken).catch(() => []),
      ]);
      if (Array.isArray(fetchedStaff) && fetchedStaff.length > 0) {
        setStaffList(fetchedStaff);
      }
      if (Array.isArray(depts)) {
        setDepartmentsList(depts);
      }
    } catch (err) {
      console.warn('Failed to fetch on-duty staff:', err);
    } finally {
      setStaffLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadStaffAndDepartments();
  }, [loadStaffAndDepartments]);

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const deptId = s.departmentId || s.department_id;
      const deptName = s.department || s.departmentName || '';
      // Department filter
      if (selectedStaffDept !== 'all' && deptId && deptId !== selectedStaffDept) {
        if (!deptName.toLowerCase().includes(selectedStaffDept.toLowerCase())) {
          return false;
        }
      }
      // Search filter
      if (!staffSearch.trim()) return true;
      const q = staffSearch.toLowerCase();
      const empUid = s.employeeUid || s.employee_uid || '';
      return (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.role && s.role.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        deptName.toLowerCase().includes(q) ||
        empUid.toLowerCase().includes(q)
      );
    });
  }, [staffList, selectedStaffDept, staffSearch]);

  // =========================================================================
  // VIEW 4: CHANGE PASSWORD STATE (Strictly Verified Email Link)
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
  // VIEW 5: CHANGE USERNAME STATE
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

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'checked-in':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Checked In • Waiting
          </span>
        );
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
            In Consultation
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Awaiting Arrival
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <CheckCircle2 className="w-3 h-3 text-slate-400" />
            Concluded
          </span>
        );
      case 'no-show':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            No-Show
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* HEADER: Title & Contact Staff Action */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            Welcome, {receptionistName || 'Medical Receptionist'}
          </h1>
        </div>

        {/* Contact Staff Action button (expanded size matching nurse portal) */}
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
      {/* 4 RECEPTION KPI CARDS (Redesigned with Modern Styling) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Box 1: Total Today */}
        <div
          onClick={() => onTabChange && onTabChange('queue')}
          className="p-5 md:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="text-xs font-semibold text-slate-600 flex items-center justify-between">
            <span>Total Today</span>
            <div className="p-2 rounded-xl bg-teal-50 border border-teal-200/70 text-teal-700">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
              {totalToday}
            </span>
          </div>
          <div className="text-[11.5px] text-slate-500 font-medium mt-1">
            Live database appointments
          </div>
        </div>

        {/* Box 2: Checked In & Waiting */}
        <div
          onClick={() => onTabChange && onTabChange('queue')}
          className="p-5 md:p-6 rounded-2xl bg-white border border-teal-200/90 shadow-soft-sm hover:shadow-md transition-all cursor-pointer bg-linear-to-b from-teal-50/30 to-white"
        >
          <div className="text-xs font-semibold text-teal-900 flex items-center justify-between">
            <span>Checked In &amp; Waiting</span>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-teal-950 tracking-tight font-sans">
              {checkedInCount}
            </span>
          </div>
          <div className="text-[11.5px] text-teal-700 font-medium mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Seated in waiting area</span>
          </div>
        </div>

        {/* Box 3: Awaiting Arrival */}
        <div
          onClick={() => onTabChange && onTabChange('queue')}
          className="p-5 md:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="text-xs font-semibold text-slate-600 flex items-center justify-between">
            <span>Awaiting Arrival</span>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
              {pendingCount}
            </span>
          </div>
          <div className="text-[11.5px] text-slate-500 font-medium mt-1">
            Scheduled for current shift
          </div>
        </div>

        {/* Box 4: Consultations Concluded */}
        <div
          onClick={() => onTabChange && onTabChange('queue')}
          className="p-5 md:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-soft-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="text-xs font-semibold text-slate-600 flex items-center justify-between">
            <span>Consultations Concluded</span>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
              {completedCount}
            </span>
          </div>
          <div className="text-[11.5px] text-slate-500 font-medium mt-1">
            Completed by attending doctor
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1 (DEFAULT): TODAY'S ARRIVAL QUEUE */}
      {/* ========================================================= */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header Bar & Filters */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-teal-800" />
                <h2 className="text-base font-bold text-slate-900">
                  Front Desk Intake &amp; Patient Check-In
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {appointments.length} Slots
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Mark patients as checked-in as soon as they reach the reception desk.
              </p>
            </div>

            {/* Doctor Filter Selector */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Doctor Filter:
              </span>
              <div className="relative">
                <select
                  value={filterDoctor}
                  onChange={(e) => setFilterDoctor(e.target.value)}
                  className="pl-3 pr-8 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700 appearance-none cursor-pointer"
                >
                  <option value="all">
                    All Doctors ({availableDoctors.length > 0 ? `${availableDoctors.length} On Duty` : 'All Rooms'})
                  </option>
                  {availableDoctors.map((doc) => (
                    <option key={doc.name} value={doc.name}>
                      {doc.name} ({doc.room})
                    </option>
                  ))}
                </select>
                <Layers className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Queue List */}
          <div className="divide-y divide-slate-100">
            {filteredAppointments.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No appointment slots matching your filter criteria.
              </div>
            ) : (
              filteredAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className={`p-4 sm:px-6 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    apt.status === 'checked-in' ? 'bg-teal-50/20' : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Time & Patient Info */}
                  <div className="flex items-center gap-4 min-w-[220px]">
                    <div className="w-16 shrink-0">
                      <div className="text-xs font-bold font-mono text-slate-800">
                        {apt.time}
                      </div>
                      <div className="text-[11px] text-slate-400">{apt.duration}</div>
                    </div>

                    <div className="h-8 w-px bg-slate-200 hidden md:block" />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {apt.patientName}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {apt.patientMrn}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {apt.type} • {apt.department || 'General Medicine'}
                      </div>
                    </div>
                  </div>

                  {/* Attending Doctor & Room */}
                  <div className="flex items-center gap-4 md:px-4 min-w-[180px]">
                    <div>
                      <div className="text-xs font-medium text-slate-800">
                        {apt.doctorName}
                      </div>
                      <div className="text-[11px] text-teal-700 flex items-center gap-1 mt-0.5">
                        <DoorOpen className="w-3 h-3 text-slate-400" />
                        <span>{apt.room}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">{getStatusBadge(apt.status)}</div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 justify-end shrink-0">
                    {apt.status === 'pending' && (
                      <button
                        onClick={() => onCheckInPatient(apt.id)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-soft-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Check In Patient</span>
                      </button>
                    )}

                    {apt.status === 'checked-in' && (
                      <span className="text-xs text-teal-800 font-semibold px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Waiting for Doctor</span>
                      </span>
                    )}

                    {/* Status Dropdown */}
                    <select
                      value={apt.status}
                      onChange={(e) =>
                        onUpdateStatus(apt.id, e.target.value as AppointmentStatus)
                      }
                      className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:border-teal-700 cursor-pointer"
                    >
                      <option value="pending">Pending</option>
                      <option value="checked-in">Checked In</option>
                      <option value="in-progress">In Consultation</option>
                      <option value="completed">Concluded</option>
                      <option value="no-show">No-Show</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: PATIENT RECORDS (BY DATE, DEFAULT YESTERDAY) */}
      {/* ========================================================= */}
      {activeTab === 'patient-records' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header Bar & Date Filters */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-teal-800" />
                <h2 className="text-base font-bold text-slate-900">
                  Patient Registration Records &amp; History
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {filteredDatePatients.length} Patients
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily patient registry logs fetched from the clinical database. Default view shows yesterday&apos;s intake.
              </p>
            </div>

            {/* Date Picker & Search Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Quick Date Buttons */}
              <div className="inline-flex rounded-xl p-0.5 bg-slate-200/80">
                <button
                  type="button"
                  onClick={() => setRecordDate(getYesterdayIso())}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    recordDate === getYesterdayIso()
                      ? 'bg-white text-teal-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => setRecordDate(getTodayIso())}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    recordDate === getTodayIso()
                      ? 'bg-white text-teal-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Today
                </button>
              </div>

              {/* Date Input */}
              <div className="relative">
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  className="px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700 cursor-pointer"
                />
              </div>

              {/* Search within Date Records */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search name, MRN, phone, doctor..."
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  className="w-full sm:w-60 pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>
          </div>

          {/* Patient Records Table */}
          <div className="overflow-x-auto">
            {filteredDatePatients.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No patient registration records found for {recordDate || 'this date'}. Select another date above or register a new patient.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-6">Reg Time</th>
                    <th className="py-3.5 px-6">Patient Name &amp; MRN</th>
                    <th className="py-3.5 px-6">Age / Gender</th>
                    <th className="py-3.5 px-6">Contact Phone</th>
                    <th className="py-3.5 px-6">Department &amp; Doctor</th>
                    <th className="py-3.5 px-6">Triage Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredDatePatients.map((patient) => {
                    const regTime = patient.registeredAt
                      ? new Date(patient.registeredAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '09:00 AM';

                    return (
                      <tr key={patient.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-6 font-mono text-slate-500 whitespace-nowrap">
                          {regTime}
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{patient.name}</div>
                          <div className="font-mono text-[11px] text-teal-800 font-semibold">
                            {patient.mrn}
                          </div>
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <span>
                            {patient.age} yrs • {patient.gender}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap font-mono text-slate-600">
                          {patient.contact || 'None Listed'}
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <div className="font-medium text-slate-800">
                            {patient.department || 'General Medicine'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {patient.attendingPhysician || 'Staff Physician'}
                          </div>
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-semibold text-[10.5px] border ${
                              patient.triageCategory === 'Critical'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : patient.triageCategory === 'Urgent'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-teal-50 text-teal-800 border-teal-200'
                            }`}
                          >
                            {patient.triageCategory || 'Routine'}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap text-right">
                          {onOpenEditPatient && (
                            <button
                              onClick={() => onOpenEditPatient(patient)}
                              className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-200/80 cursor-pointer"
                            >
                              Edit Details
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
      )}

      {/* ========================================================= */}
      {/* VIEW 3: ON-DUTY STAFF (Deduplicated, Excludes Admin) */}
      {/* ========================================================= */}
      {activeTab === 'on-duty-staff' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-sm overflow-hidden animate-fadeIn">
          {/* Header Bar & Filters */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-teal-800" />
                <h2 className="text-base font-bold text-slate-900">
                  On-Duty Clinical &amp; Operational Staff
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {filteredStaff.length} On Duty
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hospital employees currently active on roster. Multi-role assignments are consolidated without duplication.
              </p>
            </div>

            {/* Department Filter & Search Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Department Selector */}
              <div className="relative">
                <select
                  value={selectedStaffDept}
                  onChange={(e) => setSelectedStaffDept(e.target.value)}
                  className="w-full sm:w-48 pl-3 pr-8 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700 appearance-none cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {departmentsList.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <Layers className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>

              {/* Staff Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search staff by name, role, email..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full sm:w-60 pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-700"
                />
              </div>

              {/* Refresh */}
              <button
                onClick={loadStaffAndDepartments}
                className="p-2 text-slate-600 hover:text-teal-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Refresh Staff Roster"
              >
                <RefreshCw className={`w-4 h-4 ${staffLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Staff Directory Table / List View */}
          <div className="overflow-x-auto">
            {staffLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-700 mb-2" />
                <span>Loading verified staff roster...</span>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No active staff members match the current filter criteria.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-6">Staff Member</th>
                    <th className="py-3.5 px-6">Clinical &amp; Operational Roles</th>
                    <th className="py-3.5 px-6">Assigned Department(s)</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredStaff.map((staff) => {
                    const roles = (staff.role || 'Hospital Staff')
                      .split(',')
                      .map((r: string) => r.trim())
                      .filter(Boolean);
                    const depts = (staff.department || 'Hospital-Wide')
                      .split(',')
                      .map((d: string) => d.trim())
                      .filter(Boolean);

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Staff Member Info */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-teal-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                              {staff.name
                                ? staff.name
                                    .split(' ')
                                    .map((n: string) => n[0])
                                    .join('')
                                    .substring(0, 2)
                                    .toUpperCase()
                                : 'ST'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm">{staff.name}</div>
                              <div className="text-slate-400 text-xs flex items-center gap-2 mt-0.5">
                                <span>{staff.email}</span>
                                {(staff.employeeUid || staff.employee_uid) && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className="font-mono text-teal-800 font-semibold">
                                      {staff.employeeUid || staff.employee_uid}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Roles */}
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1.5 max-w-sm">
                            {roles.map((r: string, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 text-teal-900 border border-teal-200/80"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Departments */}
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1.5 max-w-sm">
                            {depts.map((d: string, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active Duty</span>
                          </span>
                        </td>

                        {/* Quick Message Action */}
                        <td className="py-4 px-6 whitespace-nowrap text-right">
                          {onOpenContactModal && (
                            <button
                              onClick={onOpenContactModal}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200/90 rounded-xl transition-colors cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5 text-teal-700" />
                              <span>Message Staff</span>
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
      )}

      {/* ========================================================= */}
      {/* VIEW 4: CHANGE PASSWORD (Strictly Verified Email Link) */}
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
      {/* VIEW 5: CHANGE USERNAME */}
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
                  @{activeUsername || username || 'receptionist'}
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
                    placeholder="e.g. sarah.reception or frontdesk_jane"
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
    </div>
  );
};
