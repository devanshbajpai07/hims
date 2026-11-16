import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Appointment, Patient, AppointmentStatus } from '../../types';
import { AuthSession, EmployeeAssignment } from '../../types/auth';
import {
  clinicalApiClient,
  DoctorDashboardSummary,
  DoctorPatientHistoryItem,
  PatientDocumentItem,
  PatientConsultancyReportDetail,
} from '../../services/clinicalApiClient';
import { authService } from '../../services/authService';
import { ChangePasswordModal } from '../../components/ChangePasswordModal';
import { ChangeUsernameModal } from '../../components/ChangeUsernameModal';
import { ConsultationCompletionModal } from '../../components/clinical/ConsultationCompletionModal';
import { ConsultancyReportViewerModal } from '../../components/clinical/ConsultancyReportViewerModal';
import {
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  PlayCircle,
  ChevronRight,
  Shield,
  Activity,
  Heart,
  DoorOpen,
  ArrowRight,
  FolderOpen,
  Upload,
  Download,
  RefreshCw,
  Search,
  Filter,
  Briefcase,
  KeyRound,
  Check,
  X,
  Sparkles,
  UserCheck,
  UserCog,
  Mail,
  CloudUpload,
  Stethoscope,
  AlertTriangle,
  Eye,
  FileUp,
} from 'lucide-react';

interface DoctorDashboardProps {
  doctorName: string;
  appointments: Appointment[];
  patients: Patient[];
  onStartConsultation: (appointmentId: string) => void;
  onCompleteConsultation: (appointmentId: string) => void;
  onOpenPatientEMR: (patient: Patient) => void;
  searchQuery: string;
  currentTab?: string;
  onSelectTab?: (tabId: string) => void;
  session?: AuthSession | null;
  effectivePermissions?: string[];
  departmentName?: string;
  scopeType?: string;
  onToast?: (title: string, desc: string) => void;
  onRefreshData?: () => void;
  onOpenAssignmentSelector?: () => void;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({
  doctorName,
  appointments,
  patients,
  onStartConsultation,
  onCompleteConsultation,
  onOpenPatientEMR,
  searchQuery,
  currentTab = 'overview',
  onSelectTab,
  session,
  effectivePermissions = [],
  departmentName = 'General Medicine',
  scopeType = 'DEPARTMENT',
  onToast,
  onRefreshData,
  onOpenAssignmentSelector,
}) => {
  // Permission helper
  const hasPerm = useCallback(
    (code: string) => {
      if (!effectivePermissions || effectivePermissions.length === 0) return true;
      return effectivePermissions.includes(code);
    },
    [effectivePermissions]
  );

  // Tab management (fallback if onSelectTab not provided)
  const [internalTab, setInternalTab] = useState<string>(currentTab);
  const activeTab = onSelectTab ? currentTab : internalTab;
  const switchTab = (tab: string) => {
    if (onSelectTab) onSelectTab(tab);
    else setInternalTab(tab);
  };

  // ---------------------------------------------------------------------------
  // 1. DOCTOR DASHBOARD SUMMARY (Backend API: GET /api/v1/clinical/doctor/dashboard-summary)
  // ---------------------------------------------------------------------------
  const [summary, setSummary] = useState<DoctorDashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!hasPerm('queue:read')) return;
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const data = await clinicalApiClient.getDoctorDashboardSummary(session?.token);
      setSummary(data);
    } catch (err: any) {
      console.warn('Could not fetch doctor dashboard summary:', err);
      setSummaryError(err.message || 'Unable to retrieve live clinical summary.');
    } finally {
      setSummaryLoading(false);
    }
  }, [hasPerm, session?.token]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, session?.activeMembership?.activeAssignmentId]);

  // ---------------------------------------------------------------------------
  // 2. QUEUE & APPOINTMENTS (Filtered by Doctor & Department Scope)
  // ---------------------------------------------------------------------------
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'in-progress' | 'waiting' | 'upcoming' | 'completed'>('all');
  const [queueScope, setQueueScope] = useState<'my' | 'department'>('my');

  // Appointments for this doctor
  const myAppointments = useMemo(() => {
    const userId = session?.user?.id;
    const cleanDocName = (name?: string) =>
      name ? name.replace(/^Dr\.?\s+/i, '').trim().toLowerCase() : '';
    const targetNames = [
      doctorName,
      session?.user?.legalName,
      (session?.user as any)?.fullName,
      session?.user?.username,
    ]
      .filter(Boolean)
      .map((n) => cleanDocName(n as string));

    return appointments.filter((apt) => {
      if (userId && apt.doctorId && apt.doctorId === userId) return true;
      if (!apt.doctorName) return false;
      const aptDocClean = cleanDocName(apt.doctorName);
      return targetNames.some(
        (t) => t && (aptDocClean === t || aptDocClean.includes(t) || t.includes(aptDocClean))
      );
    });
  }, [
    appointments,
    doctorName,
    session?.user?.id,
    session?.user?.legalName,
    (session?.user as any)?.fullName,
    session?.user?.username,
  ]);

  const examRoom = summary?.examRoom || myAppointments[0]?.room || 'Consultation Suite';

  // Waiting patients (checked-in) for this doctor
  const waitingPatients = useMemo(() => {
    return myAppointments.filter((apt) => apt.status === 'checked-in');
  }, [myAppointments]);

  // Department-wide waiting patients (checked-in)
  const departmentWaitingPatients = useMemo(() => {
    return appointments.filter(
      (apt) =>
        apt.status === 'checked-in' &&
        departmentName &&
        (apt.department?.toLowerCase() === departmentName.toLowerCase() ||
          apt.department?.toLowerCase().includes(departmentName.toLowerCase()) ||
          departmentName.toLowerCase().includes(apt.department?.toLowerCase()))
    );
  }, [appointments, departmentName]);

  // Active consultation (in-progress)
  const activeConsultation = useMemo(() => {
    return myAppointments.find((apt) => apt.status === 'in-progress');
  }, [myAppointments]);

  // Completed today
  const completedToday = useMemo(() => {
    return myAppointments.filter((apt) => apt.status === 'completed');
  }, [myAppointments]);

  // Upcoming appointments
  const upcomingAppointments = useMemo(() => {
    return myAppointments.filter((apt) => apt.status === 'pending');
  }, [myAppointments]);

  // Assigned patients
  const myAssignedPatients = useMemo(() => {
    const userId = session?.user?.id;
    const cleanDocName = (name?: string) =>
      name ? name.replace(/^Dr\.?\s+/i, '').trim().toLowerCase() : '';
    const targetNames = [
      doctorName,
      session?.user?.legalName,
      (session?.user as any)?.fullName,
      session?.user?.username,
    ]
      .filter(Boolean)
      .map((n) => cleanDocName(n as string));

    return patients.filter((p) => {
      if (userId && p.attendingPhysicianId && p.attendingPhysicianId === userId) return true;
      if (!p.attendingPhysician) return false;
      const patDocClean = cleanDocName(p.attendingPhysician);
      return targetNames.some(
        (t) => t && (patDocClean === t || patDocClean.includes(t) || t.includes(patDocClean))
      );
    });
  }, [
    patients,
    doctorName,
    session?.user?.id,
    session?.user?.legalName,
    (session?.user as any)?.fullName,
    session?.user?.username,
  ]);

  // Displayed schedule filtered by search
  const displayedSchedule = useMemo(() => {
    return myAppointments.filter((apt) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        q === '' ||
        apt.patientName.toLowerCase().includes(q) ||
        apt.patientMrn.toLowerCase().includes(q) ||
        apt.type.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (scheduleFilter === 'all') return true;
      if (scheduleFilter === 'in-progress') return apt.status === 'in-progress';
      if (scheduleFilter === 'waiting') return apt.status === 'checked-in';
      if (scheduleFilter === 'upcoming') return apt.status === 'pending';
      if (scheduleFilter === 'completed') return apt.status === 'completed';
      return true;
    });
  }, [myAppointments, searchQuery, scheduleFilter]);

  // ---------------------------------------------------------------------------
  // 3. CALL NEXT PATIENT & CALL INDIVIDUAL PATIENT ACTIONS
  // ---------------------------------------------------------------------------
  const [isCallingNext, setIsCallingNext] = useState(false);

  const handleCallNextPatient = async () => {
    if (!hasPerm('queue:manage')) {
      onToast?.('Permission Denied', 'You do not hold queue:manage permission.');
      return;
    }
    try {
      setIsCallingNext(true);
      const called = await clinicalApiClient.callNextPatient(session?.token);
      onToast?.(
        'Patient Called',
        `${called.patientName} (${called.patientMrn}) called into ${called.room || examRoom}.`
      );
      if (onRefreshData) onRefreshData();
      fetchSummary();
    } catch (err: any) {
      onToast?.('Call Failed', err.message || 'Could not call next patient.');
    } finally {
      setIsCallingNext(false);
    }
  };

  const handleCallIndividual = async (appointmentId: string) => {
    if (!hasPerm('queue:manage')) {
      onToast?.('Permission Denied', 'You do not hold queue:manage permission.');
      return;
    }
    try {
      const called = await clinicalApiClient.callPatient(appointmentId, session?.token);
      onToast?.(
        'Patient Called',
        `${called.patientName} (${called.patientMrn}) called into examination room.`
      );
      if (onRefreshData) onRefreshData();
      fetchSummary();
    } catch (err: any) {
      onToast?.('Call Failed', err.message || 'Could not call patient.');
    }
  };

  // ---------------------------------------------------------------------------
  // 4. CONCLUDE CONSULTATION & SAVE REPORT TO FILEBASE S3
  // ---------------------------------------------------------------------------
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completingApt, setCompletingApt] = useState<Appointment | null>(null);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);

  const openCompleteModal = (apt: Appointment) => {
    setCompletingApt(apt);
    setCompleteModalOpen(true);
  };

  const handleSaveConsultationReport = async (payload: {
    clinicalNotes: string;
    diagnosis?: string;
    prescriptions?: string;
    followUp?: string;
  }) => {
    if (!completingApt) return;
    try {
      setCompleteSubmitting(true);
      const res = await clinicalApiClient.saveConsultationReport(
        completingApt.id,
        payload,
        session?.token
      );

      onCompleteConsultation(completingApt.id);
      onToast?.(
        'Consultation Concluded & Report Saved',
        `Official clinical report (${res.filename}) compiled and saved to Filebase S3 for ${completingApt.patientName}.`
      );
      setCompleteModalOpen(false);
      setCompletingApt(null);
      if (onRefreshData) onRefreshData();
      fetchSummary();
    } catch (err: any) {
      throw err;
    } finally {
      setCompleteSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 4B. CONSULTANCY REPORT VIEWER MODAL (Filebase S3 report viewer)
  // ---------------------------------------------------------------------------
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
      const res = await clinicalApiClient.getPatientConsultancyReport(patientMrnOrId, session?.token);
      setSelectedReportDetail(res);
    } catch (err: any) {
      console.warn('Could not fetch consultation report:', err);
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

  // ---------------------------------------------------------------------------
  // 5. DOCTOR PATIENT HISTORY (Backend API: GET /api/v1/clinical/doctor/patient-history)
  // ---------------------------------------------------------------------------
  const [historyItems, setHistoryItems] = useState<DoctorPatientHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit] = useState(10);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDate, setHistoryDate] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadPatientHistory = useCallback(async () => {
    if (!hasPerm('patient:read')) return;
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await clinicalApiClient.getDoctorPatientHistory(
        {
          search: historySearch.trim() || undefined,
          date: historyDate || undefined,
          startDate: historyStartDate || undefined,
          endDate: historyEndDate || undefined,
          offset: (historyPage - 1) * historyLimit,
          limit: historyLimit,
        },
        session?.token
      );
      setHistoryItems(res.items);
      setHistoryTotal(res.total);
    } catch (err: any) {
      console.warn('Could not fetch doctor patient history:', err);
      setHistoryError(err.message || 'Unable to retrieve doctor patient history.');
    } finally {
      setHistoryLoading(false);
    }
  }, [hasPerm, historySearch, historyDate, historyStartDate, historyEndDate, historyPage, historyLimit, session?.token]);

  useEffect(() => {
    if (activeTab === 'patient-history') {
      loadPatientHistory();
    }
  }, [activeTab, loadPatientHistory]);

  const handleHistorySearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHistoryPage(1);
    loadPatientHistory();
  };

  const handleResetHistoryFilters = () => {
    setHistorySearch('');
    setHistoryDate('');
    setHistoryStartDate('');
    setHistoryEndDate('');
    setHistoryPage(1);
  };

  // ---------------------------------------------------------------------------
  // 6. PATIENT DOCUMENTS & FILEBASE S3 STORAGE (document:read, upload, download)
  // ---------------------------------------------------------------------------
  const [storageStatus, setStorageStatus] = useState<{
    configured: boolean;
    status: string;
    bucket?: string;
    message?: string;
  } | null>(null);
  const [selectedPatForDocs, setSelectedPatForDocs] = useState<string>('');
  const [patientDocuments, setPatientDocuments] = useState<PatientDocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Clinical File');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Check Filebase S3 status
  const checkStorageHealth = useCallback(async () => {
    try {
      const st = await clinicalApiClient.getStorageStatus();
      setStorageStatus(st);
    } catch {
      setStorageStatus({
        configured: false,
        status: 'UNAVAILABLE',
        message: 'Storage service check failed.',
      });
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'documents') {
      checkStorageHealth();
      if (!selectedPatForDocs && patients.length > 0) {
        setSelectedPatForDocs(patients[0].id);
      }
    }
  }, [activeTab, checkStorageHealth, patients, selectedPatForDocs]);

  const loadDocumentsForPatient = useCallback(
    async (patId: string) => {
      if (!patId || !hasPerm('document:read')) return;
      try {
        setDocsLoading(true);
        setDocsError(null);
        const docs = await clinicalApiClient.getPatientDocuments(patId, session?.token);
        setPatientDocuments(docs);
      } catch (err: any) {
        console.warn('Could not fetch patient documents:', err);
        setDocsError(err.message || 'Unable to retrieve documents for selected patient.');
      } finally {
        setDocsLoading(false);
      }
    },
    [hasPerm, session?.token]
  );

  useEffect(() => {
    if (activeTab === 'documents' && selectedPatForDocs) {
      loadDocumentsForPatient(selectedPatForDocs);
    }
  }, [activeTab, selectedPatForDocs, loadDocumentsForPatient]);

  const handleDownloadDocument = async (docId: string, title: string) => {
    if (!hasPerm('document:download')) {
      onToast?.('Permission Denied', 'You do not hold document:download permission.');
      return;
    }
    try {
      const presignedUrl = await clinicalApiClient.getDocumentDownloadUrl(docId, session?.token);
      window.open(presignedUrl, '_blank', 'noopener,noreferrer');
      onToast?.('Download Ready', `Secure access link generated for ${title}.`);
    } catch (err: any) {
      onToast?.('Download Error', err.message || 'Failed to generate secure download URL.');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }
    if (!selectedPatForDocs) {
      setUploadError('Please select a target patient record.');
      return;
    }

    try {
      setUploadSubmitting(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('patient_id', selectedPatForDocs);
      formData.append('title', uploadTitle.trim() || uploadFile.name);
      formData.append('category', uploadCategory);
      if (uploadNotes) formData.append('notes', uploadNotes.trim());

      await clinicalApiClient.uploadPatientDocument(formData, session?.token);
      onToast?.('Document Uploaded', `${uploadFile.name} securely archived to Filebase S3.`);
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadNotes('');
      loadDocumentsForPatient(selectedPatForDocs);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setUploadSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. PASSWORD CHANGE & USERNAME CHANGE (account:password:change, account:profile:update)
  // ---------------------------------------------------------------------------
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);

  // Change Password State (Mandatory Email Reset Protocol)
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
    const userEmail = session?.user?.email;
    if (userEmail && clean !== userEmail.trim().toLowerCase()) {
      setInlineResetError('The email entered does not match your registered hospital employee email address.');
      return;
    }
    setInlineLoading(true);
    setInlineResetError(null);
    try {
      await authService.requestPasswordReset(clean);
      setInlineResetSuccess(true);
      onToast?.('Reset Link Dispatched', `Password reset link sent to ${clean}. Please check your inbox.`);
    } catch (err: any) {
      setInlineResetError(err.message || 'Failed to dispatch password reset link.');
    } finally {
      setInlineLoading(false);
    }
  };

  // Change Username State
  const [activeUsername, setActiveUsername] = useState<string>(session?.user?.username || '');
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
    if (clean === (activeUsername || session?.user?.username || '').toLowerCase()) {
      setUsernameError('New username must be different from your current username.');
      return;
    }
    setUsernameLoading(true);
    setUsernameError(null);
    setUsernameSuccessMsg(null);
    try {
      await clinicalApiClient.changeUsername(clean, session?.token);
      setActiveUsername(clean);
      setNewUsernameInput('');
      setUsernameSuccessMsg(`Account username successfully updated to @${clean}.`);
      onToast?.('Username Updated', `Your login handle is now @${clean}`);
      if (session) {
        const updated = {
          ...session,
          user: { ...session.user, username: clean },
        };
        authService.setStoredSession(updated);
      }
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to update username.');
    } finally {
      setUsernameLoading(false);
    }
  };

  // Format file size helper
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Header & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 mb-1">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
            <span>
              {departmentName} • {examRoom} ({scopeType === 'FACILITY' ? 'Hospital-Wide' : 'Department Scope'})
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            {(activeTab === 'overview' || activeTab === 'patient-consultations') && `Patient Consultations — ${doctorName}`}
            {activeTab === 'queue' && `Patient Waiting Queue — ${departmentName}`}
            {activeTab === 'appointments' && `Doctor Consultation Schedule — ${doctorName}`}
            {activeTab === 'patient-history' && `Patient History & Clinical Reports — ${departmentName}`}
            {activeTab === 'change-username' && `Account Settings — Change Username`}
            {activeTab === 'change-password' && `Security & Access — Change Account Password`}
            {activeTab === 'emr' && `Electronic Medical Records Directory`}
            {activeTab === 'documents' && `Patient Documents & Private S3 Storage`}
            {activeTab === 'vitals' && `Vitals & Clinical Observations`}
            {activeTab === 'profile' && `Doctor Profile & Institutional Assignments`}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Database-backed clinical operations, authenticated queue calling, and Filebase S3 patient document storage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {session?.activeMembership?.assignments && session.activeMembership.assignments.length > 1 && onOpenAssignmentSelector && (
            <button
              onClick={onOpenAssignmentSelector}
              className="px-3 py-1.5 text-xs font-semibold text-teal-900 bg-white hover:bg-teal-50 border border-teal-200 rounded-lg shadow-soft-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Briefcase className="w-3.5 h-3.5 text-teal-700" />
              <span>Switch Assignment ({session.activeMembership.assignments.length})</span>
            </button>
          )}

          <span className="text-xs px-3 py-1.5 rounded-lg bg-teal-50 text-teal-900 border border-teal-200/80 font-medium flex items-center gap-1.5 shadow-soft-sm">
            <DoorOpen className="w-3.5 h-3.5 text-teal-700" />
            <span>Assigned: {examRoom}</span>
          </span>
        </div>
      </div>

      {/* =======================================================================
          TAB 1: CLINICAL OVERVIEW (DASHBOARD)
         ======================================================================= */}
      {(activeTab === 'overview' || activeTab === 'patient-consultations') && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary KPIs: 4 Options side-by-side in a 4-column row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Waiting Patients */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                (summary?.waitingPatientsCount || waitingPatients.length) > 0
                  ? 'bg-teal-50/50 border-teal-300 shadow-soft-sm'
                  : 'bg-white border-slate-200/80 shadow-soft-sm'
              }`}
            >
              <div className="flex items-center justify-between text-teal-900 text-xs mb-2 font-medium">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500">Patients Waiting</span>
                <div className="w-8 h-8 rounded-xl bg-teal-100/70 border border-teal-200 text-teal-800 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-teal-950 font-mono">
                {summaryLoading ? '...' : summary?.waitingPatientsCount ?? waitingPatients.length}
              </div>
              <div className="text-xs text-teal-700 mt-1 font-medium">
                {(summary?.waitingPatientsCount || waitingPatients.length) > 0
                  ? 'Checked in & ready for consultation'
                  : 'Queue currently empty'}
              </div>
            </div>

            {/* 2. Currently in Consultation */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-soft-sm hover:shadow-soft-md transition-all">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
                <span className="font-semibold uppercase tracking-wider text-[11px]">In Consultation</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <PlayCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-mono">
                {summaryLoading ? '...' : summary?.inConsultationCount ?? (activeConsultation ? 1 : 0)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Active exam room session</div>
            </div>

            {/* 3. Consultations Completed */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-soft-sm hover:shadow-soft-md transition-all">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
                <span className="font-semibold uppercase tracking-wider text-[11px]">Completed Today</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-mono">
                {summaryLoading ? '...' : summary?.completedTodayCount ?? completedToday.length}
              </div>
              <div className="text-xs text-slate-500 mt-1">Encounters filed & concluded</div>
            </div>

            {/* 4. Today's Booked Consultations */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-soft-sm hover:shadow-soft-md transition-all">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
                <span className="font-semibold uppercase tracking-wider text-[11px]">Booked Consultations</span>
                <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-mono">
                {summaryLoading ? '...' : summary?.todayTotalAppointmentsCount ?? myAppointments.length}
              </div>
              <div className="text-xs text-slate-500 mt-1">Total department schedule</div>
            </div>
          </div>

          {/* ACTIVE CONSULTATION HERO (Patient inside the room) */}
          {activeConsultation && (
            <div className="p-6 rounded-2xl border border-teal-300 bg-gradient-to-r from-teal-50/70 via-white to-teal-50/40 shadow-soft-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-800 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-soft-sm">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-800 text-white">
                        Patient Inside Room &bull; In Consultation
                      </span>
                      <span className="text-xs text-teal-900 font-semibold bg-teal-100/70 px-2 py-0.5 rounded-md border border-teal-200">
                        {examRoom}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        Slot: {activeConsultation.time} ({activeConsultation.duration})
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mt-1.5 flex items-center gap-2">
                      <span>{activeConsultation.patientName}</span>
                      <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {activeConsultation.patientMrn}
                      </span>
                    </h3>

                    {(() => {
                      const patObj = patients.find((p) => p.mrn === activeConsultation.patientMrn);
                      return (
                        <div className="text-xs text-slate-600 mt-1 flex items-center gap-3 flex-wrap">
                          <span className="font-medium">Chief Complaint: {activeConsultation.type}</span>
                          {patObj && (
                            <>
                              <span className="text-slate-300">&bull;</span>
                              <span>{patObj.age ? `${patObj.age} yrs` : 'Adult'} / {patObj.gender}</span>
                              <span className="text-slate-300">&bull;</span>
                              <span className="font-semibold">Blood: {patObj.bloodGroup || 'O+'}</span>
                              {patObj.vitals && (
                                <>
                                  <span className="text-slate-300">&bull;</span>
                                  <span className="font-mono text-teal-900 bg-white px-2 py-0.5 rounded border border-teal-200">
                                    BP: {patObj.vitals.bp} | HR: {patObj.vitals.heartRate} bpm
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end md:self-center flex-wrap">
                  {(() => {
                    const patObj = patients.find((p) => p.mrn === activeConsultation.patientMrn);
                    return (
                      patObj && (
                        <button
                          onClick={() => onOpenPatientEMR(patObj)}
                          className="px-3.5 py-2 text-xs font-semibold text-teal-900 bg-white hover:bg-teal-50 border border-teal-200 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-teal-700" />
                          <span>View Patient EMR</span>
                        </button>
                      )
                    );
                  })()}

                  <button
                    onClick={() => handleOpenConsultancyReport(activeConsultation.patientMrn, activeConsultation.patientName)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Consultancy Report</span>
                  </button>

                  {hasPerm('emr:write') && (
                    <button
                      onClick={() => openCompleteModal(activeConsultation)}
                      className="px-3.5 py-2 text-xs font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer"
                    >
                      <CloudUpload className="w-3.5 h-3.5 text-teal-700" />
                      <span>Upload Patient Report</span>
                    </button>
                  )}

                  {hasPerm('appointment:manage') && hasPerm('emr:write') && (
                    <button
                      onClick={() => openCompleteModal(activeConsultation)}
                      className="px-4 py-2 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Consultation</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Call-Next Action Bar (queue:manage) */}
          {hasPerm('queue:manage') && waitingPatients.length > 0 && !activeConsultation && (
            <div className="p-4 sm:p-5 rounded-2xl bg-teal-800 text-white shadow-soft-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-teal-700/90 text-teal-100 flex items-center justify-center shrink-0 border border-teal-600/50">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-teal-200">
                    Next Patient Ready in Queue
                  </div>
                  <div className="text-sm font-bold mt-0.5">
                    {waitingPatients[0].patientName} <span className="font-mono text-teal-200">({waitingPatients[0].patientMrn})</span> — {waitingPatients[0].type}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCallNextPatient}
                disabled={isCallingNext}
                className="px-5 py-2.5 text-xs font-bold text-teal-950 bg-white hover:bg-teal-50 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <PlayCircle className="w-4 h-4 text-teal-800" />
                <span>{isCallingNext ? 'Calling Patient...' : 'Call Next Patient Into Room'}</span>
              </button>
            </div>
          )}

          {/* CORE CLINICAL 2-COLUMN GRID (Patients Waiting Outside & Today's Consultation Schedule) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Column 1: Patients Waiting Outside */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft-sm overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Patients Waiting Outside</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Checked in at front desk intake and awaiting consultation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    {waitingPatients.length} waiting
                  </span>
                  <button
                    onClick={() => switchTab('queue')}
                    className="text-xs text-teal-800 hover:text-teal-900 font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Full Queue</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {waitingPatients.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No patients currently waiting in the queue for {doctorName}.
                  </div>
                ) : (
                  waitingPatients.map((apt) => {
                    const patObj = patients.find((p) => p.mrn === apt.patientMrn);
                    return (
                      <div
                        key={apt.id}
                        className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">
                              {apt.patientName}
                            </span>
                            <span className="text-[10px] font-mono font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                              {apt.patientMrn}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                              {apt.checkedInAt ? `Arrived at ${apt.checkedInAt}` : 'Checked In'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                            Complaint: {apt.type}
                          </p>
                          {patObj?.vitals && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                              <span className="font-mono">BP: {patObj.vitals.bp}</span>
                              <span>&bull;</span>
                              <span className="font-mono">HR: {patObj.vitals.heartRate} bpm</span>
                              <span>&bull;</span>
                              <span className="font-mono">SpO2: {patObj.vitals.spo2}%</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {patObj && (
                            <button
                              onClick={() => onOpenPatientEMR(patObj)}
                              className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                            >
                              View EMR
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenConsultancyReport(apt.patientMrn, apt.patientName)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                            title="View prior Filebase consultation report"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                            <span>View Report</span>
                          </button>
                          {hasPerm('queue:manage') && (
                            <button
                              onClick={() => handleCallIndividual(apt.id)}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Call In</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Column 2: Today's Full Schedule */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft-sm overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    My Appointment Schedule Today
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chronological schedule for {doctorName} in {examRoom}.
                  </p>
                </div>

                <button
                  onClick={() => switchTab('appointments')}
                  className="text-xs text-teal-800 hover:text-teal-900 font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  <span>View All ({myAppointments.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {displayedSchedule.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No appointments scheduled under this filter.
                  </div>
                ) : (
                  displayedSchedule.slice(0, 6).map((apt) => {
                    const patObj = patients.find((p) => p.mrn === apt.patientMrn);
                    return (
                      <div
                        key={apt.id}
                        className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-16 shrink-0">
                            <span className="text-xs font-bold font-mono text-slate-900 block">
                              {apt.time}
                            </span>
                            <span className="text-[10px] text-slate-400">{apt.duration}</span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {apt.patientName}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {apt.patientMrn}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                              {apt.type}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end shrink-0 flex-wrap">
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                              apt.status === 'in-progress'
                                ? 'bg-teal-50 text-teal-800 border-teal-200'
                                : apt.status === 'checked-in'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : apt.status === 'completed'
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {apt.status === 'checked-in'
                              ? 'Waiting'
                              : apt.status === 'in-progress'
                              ? 'In Consultation'
                              : apt.status === 'completed'
                              ? 'Completed'
                              : apt.status}
                          </span>

                          {patObj && (
                            <button
                              onClick={() => onOpenPatientEMR(patObj)}
                              className="px-2.5 py-1 text-xs font-semibold text-teal-800 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors cursor-pointer"
                            >
                              EMR
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenConsultancyReport(apt.patientMrn, apt.patientName)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                            title="View prior Filebase consultation report"
                          >
                            <FolderOpen className="w-3 h-3 text-slate-500" />
                            <span>Report</span>
                          </button>

                          {apt.status === 'in-progress' && hasPerm('appointment:manage') && (
                            <button
                              onClick={() => openCompleteModal(apt)}
                              className="px-3 py-1 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-2xs hover:shadow-xs transition-colors cursor-pointer"
                            >
                              Conclude
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: PATIENT WAITING QUEUE (queue:read, queue:manage)
         ======================================================================= */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-soft-sm overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <span>Patient Waiting Queue — {departmentName}</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live department queue of patients checked in and ready for examination in {examRoom}.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Queue Scope Pills */}
                <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-medium">
                  <button
                    onClick={() => setQueueScope('my')}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      queueScope === 'my'
                        ? 'bg-white text-teal-900 shadow-soft-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    My Queue ({waitingPatients.length})
                  </button>
                  <button
                    onClick={() => setQueueScope('department')}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      queueScope === 'department'
                        ? 'bg-white text-teal-900 shadow-soft-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All {departmentName} ({departmentWaitingPatients.length})
                  </button>
                </div>

                {hasPerm('queue:manage') &&
                  (queueScope === 'my' ? waitingPatients.length > 0 : departmentWaitingPatients.length > 0) && (
                    <button
                      onClick={handleCallNextPatient}
                      disabled={isCallingNext}
                      className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-soft-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>{isCallingNext ? 'Calling...' : 'Call Next Patient'}</span>
                    </button>
                  )}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {(queueScope === 'my' ? waitingPatients : departmentWaitingPatients).length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700">Waiting Queue is Clear</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    There are currently no checked-in patients waiting for consultation in{' '}
                    {queueScope === 'my' ? `your schedule for ${departmentName}` : departmentName}.
                  </p>
                </div>
              ) : (
                (queueScope === 'my' ? waitingPatients : departmentWaitingPatients).map((apt, idx) => {
                  const patObj = patients.find((p) => p.mrn === apt.patientMrn);
                  return (
                    <div
                      key={apt.id}
                      className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {apt.patientName}
                            </span>
                            <span className="text-xs font-mono text-slate-500">{apt.patientMrn}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                              {apt.checkedInAt ? `Arrived at ${apt.checkedInAt}` : 'Checked In'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 font-medium">
                            Complaint: {apt.type}
                          </p>
                          {patObj?.vitals && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                              <span>BP: {patObj.vitals.bp}</span>
                              <span>•</span>
                              <span>Pulse: {patObj.vitals.heartRate} bpm</span>
                              <span>•</span>
                              <span>Temp: {patObj.vitals.temperature}</span>
                              <span>•</span>
                              <span>SpO2: {patObj.vitals.spo2}%</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {patObj && (
                          <button
                            onClick={() => onOpenPatientEMR(patObj)}
                            className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                          >
                            View EMR
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenConsultancyReport(apt.patientMrn, apt.patientName)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                          <span>View Report</span>
                        </button>
                        {hasPerm('queue:manage') && (
                          <button
                            onClick={() => handleCallIndividual(apt.id)}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Call In Patient</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: APPOINTMENTS SCHEDULE (appointment:read)
         ======================================================================= */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-soft-sm overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Today's Consultation Schedule
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete appointment list for {doctorName} in {departmentName}.
                </p>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-200/70 rounded-lg text-xs">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'in-progress', label: 'Active' },
                    { id: 'waiting', label: 'Waiting' },
                    { id: 'upcoming', label: 'Upcoming' },
                    { id: 'completed', label: 'Completed' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setScheduleFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      scheduleFilter === tab.id
                        ? 'bg-white text-slate-800 shadow-sm font-semibold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {displayedSchedule.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  No appointments scheduled under this filter.
                </div>
              ) : (
                displayedSchedule.map((apt) => {
                  const patObj = patients.find((p) => p.mrn === apt.patientMrn);
                  return (
                    <div
                      key={apt.id}
                      className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-20 shrink-0">
                          <span className="text-xs font-bold font-mono text-slate-800 block">
                            {apt.time}
                          </span>
                          <span className="text-[10px] text-slate-400">{apt.duration}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {apt.patientName}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              {apt.patientMrn}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{apt.type}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            apt.status === 'in-progress'
                              ? 'bg-teal-50 text-teal-800 border border-teal-200'
                              : apt.status === 'checked-in'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : apt.status === 'completed'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {apt.status === 'checked-in'
                            ? 'Waiting'
                            : apt.status === 'in-progress'
                            ? 'Active Consultation'
                            : apt.status === 'completed'
                            ? 'Completed'
                            : 'Upcoming'}
                        </span>

                        {patObj && (
                          <button
                            onClick={() => onOpenPatientEMR(patObj)}
                            className="px-2.5 py-1 text-xs font-semibold text-teal-800 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors cursor-pointer"
                          >
                            EMR
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenConsultancyReport(apt.patientMrn, apt.patientName)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                          title="View prior Filebase consultation report"
                        >
                          <FolderOpen className="w-3 h-3 text-slate-500" />
                          <span>Report</span>
                        </button>

                        {apt.status === 'in-progress' && hasPerm('appointment:manage') && (
                          <button
                            onClick={() => openCompleteModal(apt)}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-2xs hover:shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Conclude</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 4: MY PATIENT HISTORY & ENCOUNTER SEARCH (patient:read)
         ======================================================================= */}
      {activeTab === 'patient-history' && (
        <div className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-soft-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Doctor Patient History & Encounter Directory
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authoritative history scoped to {departmentName}. Search across patient name, MRN, and encounter dates.
                </p>
              </div>
              <button
                onClick={loadPatientHistory}
                disabled={historyLoading}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                <span>Refresh History</span>
              </button>
            </div>

            <form onSubmit={handleHistorySearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search input */}
              <div className="md:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search patient name or MRN (e.g. Thomas or MRN-10001)..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600"
                />
              </div>

              {/* Single date */}
              <div>
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => {
                    setHistoryDate(e.target.value);
                    setHistoryStartDate('');
                    setHistoryEndDate('');
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-600"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={historyLoading}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-soft-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetHistoryFilters}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-soft-sm overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Found {historyTotal} patient encounter records
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Page {historyPage} of {Math.max(1, Math.ceil(historyTotal / historyLimit))}
              </span>
            </div>

            {historyError && (
              <div className="p-4 m-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>{historyError}</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4 sm:px-6">Patient</th>
                    <th className="py-3 px-4">Demographics</th>
                    <th className="py-3 px-4">Encounter Date & Time</th>
                    <th className="py-3 px-4">Complaint / Service</th>
                    <th className="py-3 px-4">Clinical Diagnosis</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Documents</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-700 mb-2" />
                        <span>Querying clinical database...</span>
                      </td>
                    </tr>
                  ) : historyItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No patient encounters found matching these search criteria in {departmentName}.
                      </td>
                    </tr>
                  ) : (
                    historyItems.map((item) => (
                      <tr key={item.appointmentId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-semibold text-slate-900">{item.patientName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{item.patientMrn}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-700">{item.age}y • {item.gender}</div>
                          <div className="text-[10px] font-mono text-slate-400">Blood: {item.bloodGroup}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-slate-800 font-semibold">{item.appointmentDate}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.appointmentTime}</div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate text-slate-700">
                          {item.appointmentType}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {item.diagnosis || item.clinicalNotes || 'Pending consultation'}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.isReturning ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Returning
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                              New Intake
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => {
                              setSelectedPatForDocs(item.patientId);
                              switchTab('documents');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 transition-colors cursor-pointer"
                          >
                            <FolderOpen className="w-3 h-3 text-teal-700" />
                            <span>{item.documentCount} docs</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap space-x-2">
                          {(() => {
                            const patObj: Patient =
                              patients.find((p) => p.mrn === item.patientMrn) || {
                                id: item.patientId || item.patientMrn,
                                mrn: item.patientMrn,
                                name: item.patientName,
                                age: item.age || 35,
                                gender: (item.gender as any) || 'Other',
                                bloodGroup: item.bloodGroup || 'O+',
                                contact: 'Registered Patient Record',
                                registeredAt: item.appointmentDate || 'Encounter Record',
                                chiefComplaint: item.appointmentType || 'Consultation Encounter',
                                department: departmentName,
                                triageCategory: 'Routine',
                                attendingPhysician: doctorName,
                                bedOrRoom: examRoom || 'Consultation Suite',
                                clinicalNotes: item.clinicalNotes || item.diagnosis || '',
                                allergies: [],
                                chronicConditions: [],
                                lastVisitDate: item.appointmentDate,
                              };
                            return (
                              <button
                                onClick={() => onOpenPatientEMR(patObj)}
                                className="px-2.5 py-1 text-xs font-semibold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                              >
                                View EMR
                              </button>
                            );
                          })()}
                          <button
                            onClick={() => handleOpenConsultancyReport(item.patientMrn, item.patientName)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                          >
                            View Report
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {historyTotal > historyLimit && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage <= 1 || historyLoading}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500">
                  Showing {(historyPage - 1) * historyLimit + 1} to{' '}
                  {Math.min(historyPage * historyLimit, historyTotal)} of {historyTotal}
                </span>
                <button
                  onClick={() => setHistoryPage((p) => p + 1)}
                  disabled={historyPage * historyLimit >= historyTotal || historyLoading}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 5: ELECTRONIC MEDICAL RECORDS (emr:read, emr:write)
         ======================================================================= */}
      {activeTab === 'emr' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-soft-sm overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Clinical EMR Directory — {departmentName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Longitudinal electronic medical records and clinical encounter histories.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {patients.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  No patient records available in {departmentName}.
                </div>
              ) : (
                patients.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{p.name}</span>
                        <span className="text-xs font-mono text-slate-400">{p.mrn}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                          {p.age}y • {p.gender} • Blood: {p.bloodGroup}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 font-medium">
                        Chief Complaint: {p.chiefComplaint}
                      </p>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>Allergies: {p.allergies || 'None'}</span>
                        <span>•</span>
                        <span>Chronic: {p.chronicConditions || 'None reported'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedPatForDocs(p.id);
                          switchTab('documents');
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-teal-700" />
                        <span>Documents</span>
                      </button>
                      <button
                        onClick={() => onOpenPatientEMR(p)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-soft-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Open Clinical File</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 6: PATIENT DOCUMENTS & S3 STORAGE (document:read, upload, download)
         ======================================================================= */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Filebase S3 Private Cloud Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50 via-white to-slate-50 border border-teal-200/80 shadow-soft-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 shadow-soft-sm">
                <FolderOpen className="w-5 h-5 text-teal-800" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Filebase S3 Private Document Storage
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      storageStatus?.status === 'ONLINE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {storageStatus?.status || 'CHECKING...'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bucket: <code className="font-mono text-teal-900">{storageStatus?.bucket || 'aarogya-documents'}</code> • Endpoint: <code className="font-mono text-slate-600">s3.filebase.com</code>
                </p>
              </div>
            </div>

            {hasPerm('document:upload') && (
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-soft-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Document</span>
              </button>
            )}
          </div>

          {/* Patient Selector for Document Directory */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-soft-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">Select Patient File:</span>
              <select
                value={selectedPatForDocs}
                onChange={(e) => setSelectedPatForDocs(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-teal-600"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.mrn})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => loadDocumentsForPatient(selectedPatForDocs)}
              disabled={docsLoading}
              className="text-xs text-teal-800 hover:text-teal-900 font-medium flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${docsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Patient Documents</span>
            </button>
          </div>

          {/* Document Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-soft-sm overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                Archived Patient Records & Uploads ({patientDocuments.length})
              </h3>
            </div>

            {docsError && (
              <div className="p-4 m-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>{docsError}</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4 sm:px-6">Document Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Original Filename</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Uploaded Date</th>
                    <th className="py-3 px-4">Uploader</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {docsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-700 mb-2" />
                        <span>Querying Filebase S3 documents...</span>
                      </td>
                    </tr>
                  ) : patientDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No documents archived for this patient record yet.
                      </td>
                    </tr>
                  ) : (
                    patientDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900">
                          {doc.title}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-800 border border-teal-200">
                            {doc.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                          {doc.originalFilename}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {formatFileSize(doc.fileSize)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'Recent'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {doc.uploaderName || 'Clinical Staff'}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          {hasPerm('document:download') && (
                            <button
                              onClick={() => handleDownloadDocument(doc.id, doc.title)}
                              className="px-2.5 py-1 text-xs font-semibold text-teal-800 hover:text-teal-900 bg-teal-50 hover:bg-teal-100/80 border border-teal-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3 text-teal-700" />
                              <span>Presigned S3</span>
                            </button>
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

      {/* =======================================================================
          TAB 7: VITALS & OBSERVATIONS (vitals:read, vitals:write)
         ======================================================================= */}
      {activeTab === 'vitals' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-soft-sm overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Vitals & Clinical Observations — {departmentName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time bedside observations, blood pressure, oxygenation, and pulse rates.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {patients.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  No patient vitals recorded in {departmentName}.
                </div>
              ) : (
                patients.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{p.name}</span>
                        <span className="text-xs font-mono text-slate-400">{p.mrn}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Blood Pressure</span>
                          <span className="font-bold text-slate-800">{p.vitals?.bp || '120/80 mmHg'}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Heart Rate</span>
                          <span className="font-bold text-slate-800">{p.vitals?.heartRate || 72} bpm</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Temperature</span>
                          <span className="font-bold text-slate-800">{p.vitals?.temperature || '98.6 °F'}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Oxygen Sat (SpO2)</span>
                          <span className="font-bold text-slate-800">{p.vitals?.spo2 || 99}%</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenPatientEMR(p)}
                      className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0 self-start sm:self-center"
                    >
                      Update Vitals Chart
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 8: DOCTOR PROFILE & ASSIGNMENTS (account:profile:read)
         ======================================================================= */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-soft-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-teal-100/80 text-teal-800 flex items-center justify-center font-bold text-xl shadow-soft-sm">
                  <Stethoscope className="w-7 h-7 text-teal-800" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {session?.user?.legalName || doctorName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Username: <span className="font-mono text-slate-800 font-semibold">{session?.user?.username}</span> • Email: <span className="font-mono text-slate-800">{session?.user?.email || 'clinician@hospital.org'}</span>
                  </p>
                  <p className="text-xs text-teal-800 font-medium mt-1">
                    Institution: {session?.activeMembership?.hospitalName || 'Metro General Hospital'} ({session?.activeMembership?.hospitalUid})
                  </p>
                </div>
              </div>

              {hasPerm('account:password:change') && (
                <button
                  onClick={() => setPasswordModalOpen(true)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-soft-sm transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span>Change Password</span>
                </button>
              )}
            </div>

            {/* Verified Assignments Held by Employee */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Verified Institutional Assignments ({session?.activeMembership?.assignments?.length || 1})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Roles and departmental scopes verified by Hospital Administration:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(session?.activeMembership?.assignments || []).map((assign) => {
                  const isCurrent = assign.id === session?.activeMembership?.activeAssignmentId;
                  return (
                    <div
                      key={assign.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isCurrent
                          ? 'border-teal-600 bg-teal-50/40 shadow-sm ring-1 ring-teal-600/30'
                          : 'border-slate-200/80 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {assign.roleName}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                Active Workspace
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            Department: <strong className="text-slate-800">{assign.departmentName || 'Hospital-Wide'}</strong>
                          </div>
                          <div className="text-[11px] text-teal-800 font-mono mt-0.5">
                            Scope: {assign.scopeType === 'FACILITY' ? 'FACILITY SCOPE' : 'DEPARTMENT SCOPE'}
                          </div>
                        </div>

                        {!isCurrent && onOpenAssignmentSelector && (
                          <button
                            onClick={onOpenAssignmentSelector}
                            className="px-2.5 py-1 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Switch To
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resolved Effective Permissions */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Resolved Effective Permissions for Active Assignment ({effectivePermissions.length})
              </h3>
              <p className="text-xs text-slate-500">
                Computed dynamically from database role catalogue and administrative overrides:
              </p>
              <div className="flex flex-wrap gap-2">
                {effectivePermissions.map((perm) => (
                  <span
                    key={perm}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-50 text-slate-700 border border-slate-200/80"
                  >
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>{perm}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 9: CHANGE USERNAME
         ======================================================================= */}
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
                    Doctor Identity
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Manage your personal clinician workstation login handle across hospital clinical portals.
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
                  @{activeUsername || session?.user?.username || 'doctor'}
                </span>
              </div>
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Verified Clinician Handle</span>
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
                  <span className="absolute left-4 top-3 text-sm font-mono text-slate-400">@</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. dr.bajpai or devansh.md"
                    value={newUsernameInput}
                    onChange={(e) => {
                      setNewUsernameInput(e.target.value);
                      if (usernameError) setUsernameError(null);
                    }}
                    className="w-full pl-9 pr-4 py-3 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 transition-all bg-white font-mono"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Must be at least 3 characters long. Letters, numbers, underscores and periods allowed.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-4">
                <button
                  type="submit"
                  disabled={usernameLoading || !newUsernameInput.trim()}
                  className="px-6 py-3.5 text-sm font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <UserCheck className="w-4.5 h-4.5 text-teal-200" />
                  <span>{usernameLoading ? 'Updating Handle...' : 'Save New Username'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 10: CHANGE PASSWORD (Strictly Verified Email Reset Link)
         ======================================================================= */}
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
                  In accordance with hospital cybersecurity governance, passwords cannot be directly typed or updated inside an active clinical workstation session. Re-enter your registered official email address below to receive an authenticated password reset link.
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
                      placeholder={session?.user?.email || "doctor@hospital.org"}
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
      {completeModalOpen && completingApt && (
        <ConsultationCompletionModal
          isOpen={completeModalOpen}
          onClose={() => {
            setCompleteModalOpen(false);
            setCompletingApt(null);
          }}
          appointment={completingApt}
          patient={patients.find((p) => p.mrn === completingApt.patientMrn) || null}
          doctorName={doctorName}
          examRoom={examRoom}
          departmentName={departmentName}
          onSave={handleSaveConsultationReport}
          isSubmitting={completeSubmitting}
        />
      )}

      {/* =======================================================================
          MODAL: VIEW CONSULTANCY REPORT (Filebase S3 Encrypted Storage)
         ======================================================================= */}
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

      {/* =======================================================================
          MODAL: UPLOAD PATIENT DOCUMENT (document:upload)
         ======================================================================= */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Upload Patient Document</h3>
                <p className="text-xs text-slate-500 mt-0.5">Filebase S3 Encrypted Storage</p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-800 hover:file:bg-teal-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Echocardiogram Report / Discharge Summary"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-teal-600"
                >
                  <option value="Clinical File">Clinical File</option>
                  <option value="Lab Report">Lab Report</option>
                  <option value="Radiology">Radiology / Imaging</option>
                  <option value="Discharge Summary">Discharge Summary</option>
                  <option value="Prescription">Prescription</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clinical Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Add any relevant notes or clinical context..."
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={uploadSubmitting}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-soft-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <FileUp className="w-4 h-4" />
                  <span>{uploadSubmitting ? 'Uploading to S3...' : 'Upload to Filebase'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL: CHANGE PASSWORD (Email Verification Reset Link)
         ======================================================================= */}
      {passwordModalOpen && (
        <ChangePasswordModal
          isOpen={passwordModalOpen}
          onClose={() => setPasswordModalOpen(false)}
          registeredEmail={session?.user?.email}
          token={session?.token}
          onSuccessToast={(msg) => onToast?.('Reset Link Dispatched', msg)}
        />
      )}

      {/* =======================================================================
          MODAL: CHANGE USERNAME
         ======================================================================= */}
      {usernameModalOpen && (
        <ChangeUsernameModal
          isOpen={usernameModalOpen}
          onClose={() => setUsernameModalOpen(false)}
          currentUsername={activeUsername || session?.user?.username}
          token={session?.token}
          onSuccessToast={(msg, newHandle) => {
            if (newHandle) {
              setActiveUsername(newHandle);
              onToast?.('Username Updated', `Your handle has been updated to @${newHandle}`);
              if (session) {
                const updated = {
                  ...session,
                  user: { ...session.user, username: newHandle },
                };
                authService.setStoredSession(updated);
              }
            } else {
              onToast?.('Username Updated', msg);
            }
          }}
        />
      )}
    </div>
  );
};
