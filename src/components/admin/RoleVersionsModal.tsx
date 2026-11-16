import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  History,
  CheckCircle2,
  Clock,
  User,
  Plus,
  Lock,
  GitBranch,
  Shield,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  hospitalAdminApi,
  RoleItem,
  RoleVersionItem,
  PermissionItem,
} from '../../services/hospitalAdminApiClient';

interface RoleVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: RoleItem | null;
  allRoles: RoleItem[];
  planCode: 'BASIC' | 'PRO' | 'ULTRA';
  onVersionUpdated?: () => void;
}

export const RoleVersionsModal: React.FC<RoleVersionsModalProps> = ({
  isOpen,
  onClose,
  role,
  allRoles,
  planCode,
  onVersionUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [versions, setVersions] = useState<RoleVersionItem[]>([]);
  const [catalogue, setCatalogue] = useState<PermissionItem[]>([]);

  // Create Version Form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPermCodes, setSelectedPermCodes] = useState<string[]>([]);
  const [parentRoleId, setParentRoleId] = useState<string>('');
  const [changeReason, setChangeReason] = useState('');

  const isBasic = planCode === 'BASIC';
  const isUltra = planCode === 'ULTRA';

  const loadVersions = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [vers, cat] = await Promise.all([
        hospitalAdminApi.listRoleVersions(role.id),
        hospitalAdminApi.listPermissions(),
      ]);
      setVersions(vers);
      setCatalogue(cat.permissions);

      // Pre-fill permissions from active version
      const activeV = vers.find((v) => v.is_active);
      if (activeV) {
        setSelectedPermCodes(activeV.permission_codes);
        setParentRoleId(activeV.parent_role_id || '');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load role versions.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (isOpen && role) {
      loadVersions();
    }
  }, [isOpen, role, loadVersions]);

  if (!isOpen || !role) return null;

  const togglePermission = (code: string) => {
    setSelectedPermCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeReason.trim() || selectedPermCodes.length === 0) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await hospitalAdminApi.createRoleVersion(role.id, {
        permission_codes: selectedPermCodes,
        parent_role_id: isUltra && parentRoleId ? parentRoleId : undefined,
        change_reason: changeReason.trim(),
      });
      setSuccessMsg('New role version created and activated successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
      setShowCreateForm(false);
      setChangeReason('');
      await loadVersions();
      if (onVersionUpdated) onVersionUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create role version.');
    } finally {
      setActionLoading(false);
    }
  };

  // Other available roles for parent inheritance (Ultra only)
  const candidateParentRoles = allRoles.filter((r) => r.id !== role.id);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-5 bg-[#FAF7F2] border-b border-slate-200/80 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                {role.code}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-teal-800 font-semibold px-2 py-0.5 rounded bg-teal-50 border border-teal-200">
                {role.scope} Scope
              </span>
            </div>
            <h2 className="text-xl font-bold font-serif text-slate-950 tracking-tight">
              {role.name} — Role Version History
            </h2>
            <p className="text-xs text-slate-600 font-normal">
              {role.description || 'Institutional operational responsibility.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-teal-800 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-mono">Loading role version registry...</p>
            </div>
          ) : isBasic ? (
            <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-slate-200/90 text-xs text-slate-700 space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Basic Tier Standardized Role (v1 Active)</span>
              </div>
              <p className="leading-relaxed">
                Under the Basic Tier, hospital roles use immutable standardized system permissions to maintain clinical safety.
                Custom role versioning, permission customization, and hierarchical role inheritance are unlocked in <strong>Pro</strong> and <strong>Ultra</strong> tiers.
              </p>
              {versions[0] && (
                <div className="pt-3 border-t border-slate-200/80">
                  <span className="font-bold text-slate-800 block mb-2">Standard Version 1 Permissions ({versions[0].permission_codes.length}):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {versions[0].permission_codes.map((code) => (
                      <span key={code} className="px-2 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-800">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold font-sans text-slate-950">Immutable Version Registry</h3>
                  <p className="text-xs text-slate-500">
                    Activating a new version dynamically updates permissions for all employees assigned to this role without data duplication.
                  </p>
                </div>
                {!showCreateForm && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create & Activate New Version</span>
                  </button>
                )}
              </div>

              {/* Create Version Form */}
              {showCreateForm && (
                <form
                  onSubmit={handleCreateVersion}
                  className="bg-[#FAF7F2] p-5 rounded-2xl border border-slate-200/90 space-y-4 shadow-soft-sm animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold font-sans text-slate-900 uppercase tracking-wider">
                      Author New Role Version (v{(versions[0]?.version_number || 1) + 1})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Inherit from parent role (Ultra feature) */}
                  {isUltra && (
                    <div>
                      <label className="block text-slate-700 font-semibold text-xs mb-1">
                        Parent Role Inheritance (Ultra Feature)
                      </label>
                      <select
                        value={parentRoleId}
                        onChange={(e) => setParentRoleId(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-800 text-xs"
                      >
                        <option value="">No Parent Role (Standalone)</option>
                        {candidateParentRoles.map((r) => (
                          <option key={r.id} value={r.id}>
                            Inherit from {r.name} ({r.code})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Ultra tier supports dynamic role hierarchies. Permissions from the parent role will be inherited dynamically.
                      </p>
                    </div>
                  )}

                  {/* Change Reason */}
                  <div>
                    <label className="block text-slate-700 font-semibold text-xs mb-1">
                      Change Reason / Justification *
                    </label>
                    <input
                      type="text"
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      required
                      placeholder="e.g. Added prescription approval authorization per updated clinical guidelines"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-800 text-xs"
                    />
                  </div>

                  {/* Permissions Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-slate-700 font-semibold text-xs">
                        Configure Permissions ({selectedPermCodes.length} selected)
                      </label>
                      <span className="text-[10px] font-mono text-slate-400">
                        Bounded by {planCode} Tier
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl bg-white p-3 divide-y divide-slate-100">
                      {catalogue.map((p) => {
                        const isDeferred = Boolean(p.is_deferred || p.code === 'prescription:dispense' || p.code === 'inventory:pharmacy:read');
                        const isAllowed = p.is_tier_permitted && !isDeferred;
                        const isSelected = selectedPermCodes.includes(p.code);
                        return (
                          <label
                            key={p.code}
                            className={`flex items-start gap-2.5 py-2 cursor-pointer transition-colors ${
                              isDeferred
                                ? 'opacity-50 cursor-not-allowed bg-amber-50/30'
                                : !isAllowed
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isAllowed}
                              onChange={() => !isDeferred && togglePermission(p.code)}
                              className="mt-0.5 rounded text-teal-800 focus:ring-teal-800"
                            />
                            <div className="flex-1 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{p.name}</span>
                                <span className="font-mono text-[10px] text-slate-400">{p.code}</span>
                                {isDeferred ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-amber-100 text-amber-900 border border-amber-200 font-semibold">
                                    Future Scope (Inactive)
                                  </span>
                                ) : !isAllowed ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-amber-100 text-amber-900">
                                    Requires {p.min_tier}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                                {isDeferred
                                  ? 'Planned future capability. Currently non-operational and cannot be assigned to roles.'
                                  : p.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading || selectedPermCodes.length === 0}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {actionLoading ? 'Publishing...' : 'Publish & Activate Version'}
                    </button>
                  </div>
                </form>
              )}

              {/* Version List */}
              <div className="space-y-4">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className={`p-5 rounded-2xl border transition-all space-y-3 ${
                      ver.is_active
                        ? 'bg-white border-teal-800/40 shadow-soft-sm ring-1 ring-teal-800/20'
                        : 'bg-slate-50/70 border-slate-200 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-950 text-sm">
                            Version {ver.version_number}
                          </span>
                          {ver.is_active ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-200">
                              CURRENT ACTIVE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                              Historical
                            </span>
                          )}
                          {ver.parent_role_name && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1">
                              <GitBranch className="w-3 h-3" />
                              Inherits {ver.parent_role_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 font-normal">
                          Reason: <span className="font-medium text-slate-800">{ver.change_reason || 'Initial creation'}</span>
                        </p>
                      </div>

                      <div className="text-right text-[10px] font-mono text-slate-400">
                        {ver.activated_at && (
                          <div>Activated: {new Date(ver.activated_at).toLocaleDateString()}</div>
                        )}
                        {ver.created_by_name && <div>Author: {ver.created_by_name}</div>}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                        Permission Configuration ({ver.permission_codes.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ver.permission_codes.map((code) => (
                          <span
                            key={code}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
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

