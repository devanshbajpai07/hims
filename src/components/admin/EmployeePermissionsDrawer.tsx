import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Plus,
  Trash2,
  Search,
  Filter,
  Calendar,
  Building2,
  Briefcase,
  Layers,
  Info,
  Clock,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import {
  hospitalAdminApi,
  EmployeeItem,
  DepartmentItem,
  RoleItem,
  EmployeeEffectivePermissionsResponse,
  EffectivePermissionItem,
  PermissionOverrideItem,
  RoleAssignmentItem,
  PermissionItem,
} from '../../services/hospitalAdminApiClient';

interface EmployeePermissionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeItem | null;
  planCode: 'BASIC' | 'PRO' | 'ULTRA';
  departments: DepartmentItem[];
  roles: RoleItem[];
  onRefreshEmployees: () => void;
}

export const EmployeePermissionsDrawer: React.FC<EmployeePermissionsDrawerProps> = ({
  isOpen,
  onClose,
  employee,
  planCode,
  departments,
  roles,
  onRefreshEmployees,
}) => {
  const [activeTab, setActiveTab] = useState<'effective' | 'overrides' | 'assignments'>('effective');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data
  const [effectiveData, setEffectiveData] = useState<EmployeeEffectivePermissionsResponse | null>(null);
  const [overrides, setOverrides] = useState<PermissionOverrideItem[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignmentItem[]>([]);
  const [catalogue, setCatalogue] = useState<PermissionItem[]>([]);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Override Form
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overridePermCode, setOverridePermCode] = useState('');
  const [overrideType, setOverrideType] = useState<'GRANT' | 'DENY'>('GRANT');
  const [overrideDeptId, setOverrideDeptId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideExpiresAt, setOverrideExpiresAt] = useState('');

  // Assignment Form
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignDeptId, setAssignDeptId] = useState('');
  const [assignScopeType, setAssignScopeType] = useState<'DEPARTMENT' | 'FACILITY'>('DEPARTMENT');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const loadData = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [eff, ovs, asgns, cat] = await Promise.all([
        hospitalAdminApi.getEmployeeEffectivePermissions(employee.id),
        hospitalAdminApi.listEmployeeOverrides(employee.id),
        hospitalAdminApi.listEmployeeAssignments(employee.id),
        hospitalAdminApi.listPermissions(),
      ]);
      setEffectiveData(eff);
      setOverrides(ovs);
      setAssignments(asgns);
      setCatalogue(cat.permissions);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load permission data.');
    } finally {
      setLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    if (isOpen && employee) {
      loadData();
    }
  }, [isOpen, employee, loadData]);

  if (!isOpen || !employee) return null;

  // Filtered permissions list
  const filteredPermissions = (effectiveData?.permissions || []).filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.explanation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || p.category.toUpperCase() === categoryFilter.toUpperCase();
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'GRANTED' && p.is_granted) ||
      (statusFilter === 'DENIED' && !p.is_granted && p.status === 'DENIED_BY_OVERRIDE') ||
      (statusFilter === 'TIER_LOCKED' && p.status === 'DENIED_BY_TIER');
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Handle Add Override
  const handleCreateOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overridePermCode || !overrideReason.trim()) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await hospitalAdminApi.createEmployeeOverride(employee.id, {
        permission_code: overridePermCode,
        override_type: overrideType,
        department_id: overrideDeptId || undefined,
        reason: overrideReason.trim(),
        expires_at: overrideExpiresAt ? new Date(overrideExpiresAt).toISOString() : undefined,
      });
      showSuccess(`Override (${overrideType}) applied successfully.`);
      setShowOverrideForm(false);
      setOverridePermCode('');
      setOverrideReason('');
      setOverrideExpiresAt('');
      setOverrideDeptId('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply override.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Revoke Override
  const handleRevokeOverride = async (overrideId: string) => {
    if (!window.confirm('Are you sure you want to revoke this permission override?')) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await hospitalAdminApi.revokeEmployeeOverride(employee.id, overrideId);
      showSuccess('Override revoked.');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to revoke override.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Role Assignment
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignRoleId) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await hospitalAdminApi.assignEmployeeRole(employee.id, {
        role_id: assignRoleId,
        department_id: assignDeptId || undefined,
        scope_type: assignScopeType,
      });
      showSuccess('Department role assigned successfully.');
      setShowAssignForm(false);
      setAssignRoleId('');
      setAssignDeptId('');
      setAssignScopeType('DEPARTMENT');
      await loadData();
      onRefreshEmployees();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign role.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Revoke Role Assignment
  const handleRevokeAssignment = async (assignmentId: string) => {
    if (!window.confirm('Are you sure you want to revoke this role assignment?')) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await hospitalAdminApi.revokeEmployeeRoleAssignment(employee.id, assignmentId);
      showSuccess('Role assignment revoked.');
      await loadData();
      onRefreshEmployees();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to revoke role assignment.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-out border-l border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-5 bg-[#FAF7F2] border-b border-slate-200/80 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-teal-100/70 text-teal-900 border border-teal-200/50">
                {employee.employee_uid}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold px-2 py-0.5 rounded bg-slate-100">
                {planCode} Tier Governance
              </span>
            </div>
            <h2 className="text-xl font-bold font-serif text-slate-950 tracking-tight">
              {employee.full_name}
            </h2>
            <p className="text-xs text-slate-600 font-normal">
              {employee.email} • {assignments.filter((a) => a.is_active).length} Active Role Placement(s) • {overrides.length} Active Override(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab('effective')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'effective'
                ? 'border-teal-800 text-teal-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Authoritative Permissions</span>
            {effectiveData && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-50 text-teal-800 font-mono">
                {effectiveData.permissions.filter((p) => p.is_granted).length}/{effectiveData.permissions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('overrides')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'overrides'
                ? 'border-teal-800 text-teal-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Explicit Overrides</span>
            {overrides.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-mono font-bold">
                {overrides.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('assignments')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'assignments'
                ? 'border-teal-800 text-teal-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Role Placements</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
              {assignments.filter((a) => a.is_active).length}
            </span>
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-teal-800 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-mono">Computing deterministic 11-step effective permissions...</p>
            </div>
          ) : activeTab === 'effective' ? (
            /* TAB 1: EFFECTIVE PERMISSIONS INSPECTOR */
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 43 atomic permissions, codes or justifications..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="CLINICAL">Clinical</option>
                    <option value="OPERATIONAL">Operational</option>
                    <option value="WORKFORCE">Workforce</option>
                    <option value="ADMINISTRATIVE">Administrative</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="GRANTED">Granted Only</option>
                    <option value="DENIED">Override Denials</option>
                    <option value="TIER_LOCKED">Tier Restricted</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-soft-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="py-3 px-4">Permission</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Source & Scope</th>
                      <th className="py-3 px-4">Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPermissions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400">
                          No matching permissions found.
                        </td>
                      </tr>
                    ) : (
                      filteredPermissions.map((perm) => (
                        <tr key={perm.code} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <span className="font-bold text-slate-950 block">{perm.name}</span>
                            <span className="font-mono text-[10px] text-slate-400">{perm.code}</span>
                            <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-slate-100 text-slate-600">
                              {perm.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 align-top whitespace-nowrap">
                            {perm.is_granted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                GRANTED
                              </span>
                            ) : perm.status === 'DENIED_BY_OVERRIDE' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                DENIED (OVERRIDE)
                              </span>
                            ) : perm.status === 'DENIED_BY_TIER' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                <Lock className="w-3 h-3 text-amber-700" />
                                TIER LOCKED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                NOT GRANTED
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 align-top">
                            {perm.source_role_name && (
                              <span className="font-medium text-slate-800 block text-[11px]">
                                {perm.source_role_name}
                                {perm.source_role_version && (
                                  <span className="font-mono text-[10px] text-slate-500 ml-1">
                                    (v{perm.source_role_version})
                                  </span>
                                )}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-teal-800 block">
                              {perm.department_scope || 'Facility-Wide'}
                            </span>
                          </td>
                          <td className="py-3 px-4 align-top text-slate-600 text-[11px] leading-relaxed">
                            {perm.explanation}
                            {perm.expires_at && (
                              <span className="block text-[10px] font-mono text-amber-800 mt-0.5">
                                Expires: {new Date(perm.expires_at).toLocaleDateString()}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'overrides' ? (
            /* TAB 2: EXPLICIT PERMISSION OVERRIDES */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold font-sans text-slate-950">Employee-Specific Overrides</h3>
                  <p className="text-xs text-slate-500">
                    Strict precedence: DENY strictly overrides inherited role grants. GRANT adds capability bounded by {planCode} tier.
                  </p>
                </div>
                {!showOverrideForm && (
                  <button
                    onClick={() => setShowOverrideForm(true)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Override</span>
                  </button>
                )}
              </div>

              {/* Add Override Form */}
              {showOverrideForm && (
                <form
                  onSubmit={handleCreateOverride}
                  className="bg-[#FAF7F2] p-5 rounded-2xl border border-slate-200/90 space-y-4 shadow-soft-sm animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold font-sans text-slate-900 uppercase tracking-wider">
                      Configure New Permission Override
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowOverrideForm(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Target Permission *</label>
                      <select
                        value={overridePermCode}
                        onChange={(e) => setOverridePermCode(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                      >
                        <option value="">Select Permission</option>
                        {catalogue.map((c) => (
                          <option
                            key={c.code}
                            value={c.code}
                            disabled={!c.is_tier_permitted && overrideType === 'GRANT'}
                          >
                            {c.name} ({c.code}) {!c.is_tier_permitted ? `[Requires ${c.min_tier}]` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Override Action *</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setOverrideType('GRANT')}
                          className={`py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                            overrideType === 'GRANT'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          GRANT Capability
                        </button>
                        <button
                          type="button"
                          onClick={() => setOverrideType('DENY')}
                          className={`py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                            overrideType === 'DENY'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          DENY Access
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Department Scope (Optional)</label>
                      <select
                        value={overrideDeptId}
                        onChange={(e) => setOverrideDeptId(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                      >
                        <option value="">Hospital-Wide (All Departments)</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Expiration Date (Optional)</label>
                      <input
                        type="datetime-local"
                        value={overrideExpiresAt}
                        onChange={(e) => setOverrideExpiresAt(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Audit Justification / Reason *</label>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      required
                      placeholder="e.g. Temporary cross-department coverage during clinical rotation"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-800 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowOverrideForm(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {actionLoading ? 'Saving...' : 'Apply Override'}
                    </button>
                  </div>
                </form>
              )}

              {/* Overrides List */}
              <div className="space-y-3">
                {overrides.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-200/80">
                    No active individual overrides. Effective access is strictly derived from role assignments.
                  </div>
                ) : (
                  overrides.map((ov) => (
                    <div
                      key={ov.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white shadow-soft-sm flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              ov.override_type === 'GRANT'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                : 'bg-rose-100 text-rose-900 border border-rose-200'
                            }`}
                          >
                            {ov.override_type}
                          </span>
                          <span className="font-bold text-slate-950 text-xs">{ov.permission_name}</span>
                          <span className="font-mono text-[10px] text-slate-400">({ov.permission_code})</span>
                        </div>
                        <p className="text-xs text-slate-600 font-normal">
                          Reason: <span className="font-medium text-slate-800">{ov.reason}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-500 pt-1">
                          <span>Scope: {ov.department_name || 'Hospital-Wide'}</span>
                          {ov.granted_by_name && <span>Granted by: {ov.granted_by_name}</span>}
                          {ov.expires_at && (
                            <span className="text-amber-800">
                              Expires: {new Date(ov.expires_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRevokeOverride(ov.id)}
                        disabled={actionLoading}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title="Revoke Override"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* TAB 3: ROLE PLACEMENTS */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold font-sans text-slate-950">Department Role Placements</h3>
                  <p className="text-xs text-slate-500">
                    An employee can hold multiple roles across distinct departments within this facility.
                  </p>
                </div>
                {!showAssignForm && (
                  <button
                    onClick={() => setShowAssignForm(true)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign Role</span>
                  </button>
                )}
              </div>

              {/* Add Role Assignment Form */}
              {showAssignForm && (
                <form
                  onSubmit={handleAssignRole}
                  className="bg-[#FAF7F2] p-5 rounded-2xl border border-slate-200/90 space-y-4 shadow-soft-sm animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold font-sans text-slate-900 uppercase tracking-wider">
                      Assign Department Role
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAssignForm(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Select Role *</label>
                      <select
                        value={assignRoleId}
                        onChange={(e) => setAssignRoleId(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                      >
                        <option value="">Select Role</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.code}) - {r.scope} scope
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Clinical Department</label>
                      <select
                        value={assignDeptId}
                        onChange={(e) => setAssignDeptId(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                      >
                        <option value="">Unassigned / Hospital-Wide</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {planCode === 'ULTRA' && (
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Scope Mode (Ultra Tier)</label>
                        <select
                          value={assignScopeType}
                          onChange={(e: any) => setAssignScopeType(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                        >
                          <option value="DEPARTMENT">Department Scoped</option>
                          <option value="FACILITY">Facility-Wide (Enterprise Ultra)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowAssignForm(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {actionLoading ? 'Assigning...' : 'Confirm Assignment'}
                    </button>
                  </div>
                </form>
              )}

              {/* Assignments List */}
              <div className="space-y-3">
                {assignments.map((asgn) => (
                  <div
                    key={asgn.id}
                    className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                      asgn.is_active
                        ? 'bg-white border-slate-200 shadow-soft-sm'
                        : 'bg-slate-50 border-slate-200/60 opacity-60'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-950 text-xs">{asgn.role_name}</span>
                        <span className="font-mono text-[10px] text-slate-400">({asgn.role_code})</span>
                        {asgn.role_version_number && (
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                            v{asgn.role_version_number}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            asgn.is_active
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {asgn.assignment_status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-normal">
                        Department: <span className="font-medium text-slate-800">{asgn.department_name || 'Hospital-Wide'}</span> • Scope: <span className="font-mono">{asgn.scope_type}</span>
                      </p>
                      <div className="text-[10px] font-mono text-slate-400">
                        Assigned: {asgn.assigned_at ? new Date(asgn.assigned_at).toLocaleDateString() : 'N/A'}
                        {asgn.revoked_at && ` • Revoked: ${new Date(asgn.revoked_at).toLocaleDateString()}`}
                      </div>
                    </div>

                    {asgn.is_active && (
                      <button
                        onClick={() => handleRevokeAssignment(asgn.id)}
                        disabled={actionLoading}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title="Revoke Role Placement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

