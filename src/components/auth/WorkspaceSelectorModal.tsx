import React from 'react';
import { TenantMembership, User } from '../../types/auth';
import { Building2, Shield, ArrowRight, X } from 'lucide-react';

interface WorkspaceSelectorModalProps {
  isOpen: boolean;
  user: User | null;
  memberships: TenantMembership[];
  onSelect: (membership: TenantMembership) => void;
  onCancel: () => void;
}

export const WorkspaceSelectorModal: React.FC<WorkspaceSelectorModalProps> = ({
  isOpen,
  user,
  memberships,
  onSelect,
  onCancel,
}) => {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn select-none">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Select Hospital Workspace
              </h3>
              <p className="text-xs text-slate-500">
                Multiple active memberships found for @{user.username}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Memberships List */}
        <div className="p-6 space-y-3">
          <p className="text-xs text-slate-600 font-light">
            You hold verified credentials at multiple medical institutions. Please select the hospital environment you wish to access for this session:
          </p>

          <div className="space-y-2.5 pt-2">
            {memberships.map((mem) => (
              <button
                key={mem.id}
                onClick={() => onSelect(mem)}
                className="w-full p-4 rounded-xl border border-slate-200 hover:border-teal-600 hover:bg-teal-50/20 text-left transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-teal-900 transition-colors flex items-center gap-2">
                    <span>{mem.hospitalName}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {mem.hospitalUid}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                    <span className="capitalize font-medium text-teal-800">{mem.role}</span>
                    <span>•</span>
                    <span>{mem.department}</span>
                    <span>•</span>
                    <span className="font-mono">{mem.employeeUid}</span>
                  </div>
                </div>

                <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-teal-800 group-hover:text-white flex items-center justify-center transition-colors text-slate-400 shrink-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>

          <div className="pt-3 text-[11px] text-slate-400 font-mono flex items-center justify-center gap-2 text-center">
            <Shield className="w-3 h-3 text-emerald-600" />
            <span>SESSION PRIVILEGES ARE COMPARTMENTALIZED PER HOSPITAL</span>
          </div>
        </div>
      </div>
    </div>
  );
};

