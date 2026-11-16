import React, { useState } from 'react';
import { ArrowUpRight, Activity, ShieldCheck, Mail, CheckCircle2 } from 'lucide-react';

interface FooterSectionProps {
  onNavigate: (path: string) => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer id="cta-demo" className="bg-obsidian-950 text-white select-none border-t border-white/10">
      {/* Final Impact CTA Banner */}
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 border-b border-white/10 text-center">
        <span className="text-xs font-mono font-medium text-emerald-400 uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          Transform Your Clinical Operations
        </span>

        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold font-sans text-white tracking-tight mt-6 max-w-3xl mx-auto leading-tight">
          Ready to experience the calm of modern hospital intelligence?
        </h2>

        <p className="mt-6 text-base sm:text-lg text-slate-400 font-normal max-w-xl mx-auto">
          Schedule a personalized architectural walkthrough with our clinical systems engineers.
        </p>

        {/* Form or CTA Action */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          {subscribed ? (
            <div className="p-3.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Request received. A clinical specialist will contact you shortly.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full flex items-center gap-2">
              <input
                type="email"
                required
                placeholder="Enter hospital or clinic email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-3 rounded-full text-xs font-sans bg-white/[0.06] border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-pill hover:shadow-native-glow transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
              >
                <span>Request Demo</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Main Footer Links & Copyright */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12 text-xs">
          {/* Brand Info */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-white text-slate-950 flex items-center justify-center font-bold text-xs">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="text-base font-bold text-white tracking-tight font-sans">
                aura
              </span>
            </div>
            <p className="text-slate-400 font-light max-w-xs leading-relaxed">
              The architectural operating system for modern hospital management and single-specialty clinical excellence.
            </p>
            <div className="text-[11px] font-mono text-slate-500">
              ST. JUDE AMBULATORY NETWORK • SPEC V4.2
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <div className="font-semibold text-white uppercase tracking-wider text-[11px]">
              Platform
            </div>
            <ul className="space-y-2 text-slate-400">
              <li>
                <button onClick={() => onNavigate('/')} className="hover:text-white transition-colors">
                  Overview
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/pricing')} className="hover:text-white transition-colors">
                  Pricing Plans
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/app')} className="hover:text-emerald-400 transition-colors">
                  Interactive App
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/login')} className="hover:text-white transition-colors">
                  Sign In
                </button>
              </li>
            </ul>
          </div>

          {/* Architecture */}
          <div className="space-y-3">
            <div className="font-semibold text-white uppercase tracking-wider text-[11px]">
              Workflows
            </div>
            <ul className="space-y-2 text-slate-400">
              <li>Front Desk Intake</li>
              <li>Consultation Queue</li>
              <li>Electronic Medical Records</li>
              <li>Executive Governance</li>
            </ul>
          </div>

          {/* Compliance */}
          <div className="space-y-3">
            <div className="font-semibold text-white uppercase tracking-wider text-[11px]">
              Security
            </div>
            <ul className="space-y-2 text-slate-400">
              <li>HIPAA Compliance</li>
              <li>HL7 FHIR Standards</li>
              <li>Role-Based Access</li>
              <li>Audit Logging</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-slate-500 text-[11px]">
          <div>
            © 2026 AURA Health Technologies Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-300 transition-colors cursor-pointer">
              Privacy Policy
            </span>
            <span className="hover:text-slate-300 transition-colors cursor-pointer">
              Terms of Service
            </span>
            <span className="hover:text-slate-300 transition-colors cursor-pointer">
              HIPAA Safeguards
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
