import React, { useState, useEffect } from 'react';
import { EmployeeAssignment } from '../../types/auth';
import {
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  Shield,
  Stethoscope,
  Users,
  X,
  Sparkles,
  Activity,
} from 'lucide-react';

interface AssignmentSelectorModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canClose?: boolean;
  assignments: EmployeeAssignment[];
  activeAssignmentId?: string;
  userName?: string;
  hospitalName?: string;
  onSelectAssignment: (assignmentId: string) => Promise<void> | void;
}

export const AssignmentSelectorModal: React.FC<AssignmentSelectorModalProps> = ({
  isOpen,
  onClose,
  canClose = true,
  assignments,
  activeAssignmentId,
  userName = 'Employee',
  hospitalName = 'Hospital Facility',
  onSelectAssignment,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    activeAssignmentId || (assignments[0]?.id ?? '')
  );

  useEffect(() => {
    if (activeAssignmentId) {
      setSelectedId(activeAssignmentId);
    } else if (assignments[0]?.id) {
      setSelectedId(assignments[0].id);
    }
  }, [isOpen, activeAssignmentId, assignments]);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selectedId) return;
    try {
      setSubmitting(true);
      await onSelectAssignment(selectedId);
      if (onClose) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleIcon = (roleCode: string) => {
    switch (roleCode) {
      case 'doctor':
        return <Stethoscope className="w-5 h-5 text-teal-700" />;
      case 'nurse':
      case 'nursing_supervisor':
        return <Activity className="w-5 h-5 text-teal-700" />;
      case 'receptionist':
        return <Users className="w-5 h-5 text-teal-700" />;
      case 'admin':
        return <Shield className="w-5 h-5 text-teal-700" />;
      default:
        return <Briefcase className="w-5 h-5 text-teal-700" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-lg w-full overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-teal-50/50 via-white to-slate-50 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100/80 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0 shadow-soft-sm">
              <Briefcase className="w-5 h-5 text-teal-800" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-0.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Multi-Assignment Workspace</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Select Active Department Assignment
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {userName} • {hospitalName}
              </p>
            </div>
          </div>
          {canClose && onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Assignment List */}
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="text-xs text-slate-600 mb-2">
            You hold <strong className="text-slate-900">{assignments.length} verified role placements</strong> at this institution.
            Choose which operational assignment context to enter:
          </div>

          {assignments.map((assign) => {
            const isSelected = assign.id === selectedId;
            const isCurrentlyActive = assign.id === activeAssignmentId;

            return (
              <div
                key={assign.id}
                onClick={() => setSelectedId(assign.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  isSelected
                    ? 'border-teal-600 bg-teal-50/40 shadow-sm ring-1 ring-teal-600/30'
                    : 'border-slate-200/80 bg-white hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-teal-600 text-white shadow-soft-sm'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {getRoleIcon(assign.roleCode)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {assign.roleName}
                      </span>
                      {isCurrentlyActive && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {assign.departmentName || 'Hospital-Wide'}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-teal-800">
                        {assign.scopeType === 'FACILITY' ? 'FACILITY SCOPE' : 'DEPT SCOPE'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Permissions and data scopes will adapt dynamically.
          </span>
          <div className="flex items-center gap-2">
            {canClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !selectedId}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-50 rounded-lg shadow-soft-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>{submitting ? 'Switching Workspace...' : 'Launch Workspace'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

