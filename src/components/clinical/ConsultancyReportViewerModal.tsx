import React, { useState } from 'react';
import {
  FileText,
  X,
  Download,
  Copy,
  Check,
  ShieldCheck,
  User,
  Calendar,
  Building,
  RefreshCw,
  AlertCircle,
  HardDrive,
} from 'lucide-react';
import { PatientConsultancyReportDetail } from '../../services/clinicalApiClient';

interface ConsultancyReportViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: PatientConsultancyReportDetail | null;
  loading?: boolean;
  patientName?: string;
  patientMrn?: string;
  onRetry?: () => void;
}

export const ConsultancyReportViewerModal: React.FC<ConsultancyReportViewerModalProps> = ({
  isOpen,
  onClose,
  report,
  loading = false,
  patientName,
  patientMrn,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const displayName = report?.patientName || patientName || 'Patient';
  const displayMrn = report?.patientMrn || patientMrn || 'N/A';
  const content = report?.fileContent || '';

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (report?.downloadUrl) {
      window.open(report.downloadUrl, '_blank');
      return;
    }
    if (content) {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report?.filename || `Consultation_Report_${displayMrn}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/60 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center shadow-soft-sm shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Patient Consultancy Report
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100/70 text-teal-900 border border-teal-200">
                  <ShieldCheck className="w-3 h-3 text-teal-800" />
                  Filebase S3 Persisted
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative clinical consultation file &bull; {displayName} ({displayMrn})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-700" />
              <p className="text-sm font-semibold text-slate-700">
                Retrieving consultation report from Filebase S3...
              </p>
              <p className="text-xs text-slate-400">
                Validating cryptographic signatures and presigned access tokens
              </p>
            </div>
          ) : !report || !report.hasReport ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                No Prior Consultation Report on File
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                There is currently no finalized consultation report recorded in Filebase S3 for {displayName} ({displayMrn}).
                When a doctor completes a consultation encounter, an official signed report is automatically generated and archived here.
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-2 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Check Again</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Metadata Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-700 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Attending Physician</span>
                    <span className="font-semibold text-slate-800">{report.doctorName || 'Attending Physician'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Date & Time</span>
                    <span className="font-medium text-slate-700">
                      {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'Recent Encounter'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-teal-700 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Repository File</span>
                    <span className="font-mono text-slate-700 truncate block max-w-[180px]">
                      {report.filename || `Consultation_Report_${displayMrn}.txt`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium text-[11px] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Active Authoritative Report (Latest encounter version)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Copy report text"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copied ? 'Copied' : 'Copy Text'}</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    title="Download Report File"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Report</span>
                  </button>
                </div>
              </div>

              {/* Report Document Box */}
              <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-4 sm:p-5 font-mono text-xs leading-relaxed overflow-x-auto shadow-inner max-h-[420px] select-text">
                <pre className="whitespace-pre-wrap break-words">{content || report.detail || 'Report content loaded.'}</pre>
              </div>

              <div className="text-[11px] text-slate-400 text-center">
                * Note: Whenever a new consultation report is generated for this patient, it replaces this file as the active report.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {report?.documentId ? (
              <span className="font-mono text-[10px]">Document ID: {report.documentId}</span>
            ) : (
              <span>Institutional EMR &bull; Filebase S3 Cloud</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

