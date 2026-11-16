import React from 'react';
import { Pill, AlertCircle, Clock, ShieldCheck, ArrowRight, Package, FileText, CheckCircle2 } from 'lucide-react';
import { EmployeeAssignment } from '../../types/auth';

interface PharmacistFutureScopeViewProps {
  hospitalName?: string;
  departmentName?: string;
  employeeName?: string;
  onSwitchAssignment?: (assignmentId: string) => void;
  assignments?: EmployeeAssignment[];
}

export const PharmacistFutureScopeView: React.FC<PharmacistFutureScopeViewProps> = ({
  hospitalName = 'Hospital Facility',
  departmentName = 'Dispensary',
  employeeName = 'Pharmacist',
  onSwitchAssignment,
  assignments = [],
}) => {
  const alternateAssignments = assignments.filter((a) => a.roleCode !== 'pharmacist');

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-soft-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dispensary &amp; Pharmacy Management</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 font-mono">
                  Future Scope
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {hospitalName} • {departmentName} • Operational workspace currently inactive
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              Module Deferred
            </span>
          </div>
        </div>

        {/* Scope Context Explanation */}
        <div className="pt-5 space-y-4">
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs text-amber-950 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-900 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <span>Pharmacy &amp; Dispensary Operations Notice</span>
            </div>
            <p className="leading-relaxed text-amber-900/90">
              The central dispensary management capability — including prescription fulfillment queues, batch-level stock tracking, pharmaceutical inventory deductions, and medication administration records (e-MAR) — has been moved to <strong>Future Scope</strong>. This workspace is intentionally non-operational.
            </p>
          </div>

          {/* Clinical Prescriptions Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/70 text-xs text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Clinical Prescribing Is Active</span>
              </div>
              <p className="text-emerald-800/90 leading-relaxed text-[11px]">
                Attending physicians and doctors retain full, database-backed capability to write and review clinical prescriptions directly inside consultation encounters and patient EMR records.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-slate-600" />
                <span>Zero Simulated Fulfillment</span>
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                In accordance with architectural data integrity guidelines, no placeholder medicine catalogs, mock inventory deductions, or simulated dispensing actions are permitted.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Planned Capabilities Roadmap Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-soft-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Planned Dispensary Capabilities (Roadmap)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 mb-2">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-800">Prescription Fulfillment Queue</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Real-time queue connecting doctor consultation prescriptions directly to the dispensary counter.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 mb-2">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-800">Formulary &amp; Stock Tracking</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Standardized hospital medicine formulary with batch numbers, expiry monitoring, and stock transfers.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 mb-2">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-800">Inpatient e-MAR Integration</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Direct handover between pharmacy verification and registered nurse bedside medication administration.
            </p>
          </div>
        </div>
      </div>

      {/* Switch to Operational Assignment if applicable */}
      {alternateAssignments.length > 0 && onSwitchAssignment && (
        <div className="bg-white rounded-2xl border border-teal-200/80 p-5 shadow-soft-sm flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-teal-950">Active Operational Roles Available</h3>
            <p className="text-[11px] text-teal-800 mt-0.5">
              You hold other operational employee assignments in {hospitalName}. Switch to an active workspace to perform operational duties.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {alternateAssignments.map((assign) => (
              <button
                key={assign.id}
                onClick={() => onSwitchAssignment(assign.id)}
                className="px-3 py-1.5 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Switch to {assign.roleName || assign.roleCode}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
