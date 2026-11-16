import React from 'react';
import { X, Check, Layers, Sliders, Sparkles, Activity, ShieldCheck, Compass } from 'lucide-react';
import { ConceptId } from '../types';

interface DesignComparisonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeConcept: ConceptId;
  onSelectConcept: (concept: ConceptId) => void;
}

export const DesignComparisonDrawer: React.FC<DesignComparisonDrawerProps> = ({
  isOpen,
  onClose,
  activeConcept,
  onSelectConcept,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-3xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">HIMS Design Concept Matrix</h2>
                <p className="text-xs text-slate-500">
                  UX Architecture, Visual Psychology & Ergonomic Trade-offs
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Quick Switch Cards */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Switch Active Concept
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    id: 'minimal-clinical' as ConceptId,
                    title: '1. Minimal Clinical',
                    tag: 'Nordic Healthcare',
                    badge: 'Restrained Calm',
                    accent: 'border-teal-500 bg-teal-50/40 text-teal-900',
                    dot: 'bg-teal-500',
                  },
                  {
                    id: 'modern-saas' as ConceptId,
                    title: '2. Modern SaaS',
                    tag: 'Linear / Stripe Inspired',
                    badge: 'High Polish',
                    accent: 'border-indigo-500 bg-indigo-50/40 text-indigo-900',
                    dot: 'bg-indigo-500',
                  },
                  {
                    id: 'command-centre' as ConceptId,
                    title: '3. Clinical Command',
                    tag: 'Critical Care Cockpit',
                    badge: 'High Density',
                    accent: 'border-sky-500 bg-slate-900 text-white',
                    dot: 'bg-sky-400',
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectConcept(item.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      activeConcept === item.id
                        ? `${item.accent} ring-2 ring-offset-2 ring-slate-900`
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold">{item.title}</span>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${item.dot} ${
                          activeConcept === item.id ? 'ring-2 ring-offset-1 ring-teal-500' : ''
                        }`}
                      />
                    </div>
                    <div className="text-[11px] opacity-75">{item.tag}</div>
                    <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-black/5 dark:bg-white/10">
                      {item.badge}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Deep Comparison Table */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Detailed Evaluation Matrix
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 text-left">
                      <th className="p-3 font-semibold border-b border-slate-200">Dimension</th>
                      <th className="p-3 font-semibold border-b border-slate-200 text-teal-800">
                        Minimal Clinical
                      </th>
                      <th className="p-3 font-semibold border-b border-slate-200 text-indigo-800">
                        Modern SaaS
                      </th>
                      <th className="p-3 font-semibold border-b border-slate-200 text-sky-700">
                        Command Centre
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-600">
                    <tr>
                      <td className="p-3 font-medium bg-slate-50/50 text-slate-800">Design Metaphor</td>
                      <td className="p-3">Clean medical editorial, Scandinavian tranquility</td>
                      <td className="p-3">Linear / Stripe next-generation web software</td>
                      <td className="p-3">Hospital Flight Deck & Ward Telemetry Cockpit</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium bg-slate-50/50 text-slate-800">Information Density</td>
                      <td className="p-3">Low to Medium (Airy, spacious 40px gutters)</td>
                      <td className="p-3">Medium (Balanced card padding, segmented tabs)</td>
                      <td className="p-3">High (Compact tabular rows, live pulse telemetry)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium bg-slate-50/50 text-slate-800">Primary Palette</td>
                      <td className="p-3">Sage, Muted Teal (#0F766E), Crisp Chalk White</td>
                      <td className="p-3">Slate 900, Electric Indigo (#4F46E5), Zinc subtle gradients</td>
                      <td className="p-3">Dark Cockpit (#0A0F1D), Cyan, Amber, Rose alert telemetry</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium bg-slate-50/50 text-slate-800">Cognitive Load</td>
                      <td className="p-3">Lowest — zero visual fatigue for 12hr clinical shifts</td>
                      <td className="p-3">Moderate — intuitive for digital-native clinicians</td>
                      <td className="p-3">Specialized — optimal for triage nurses & triage officers</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium bg-slate-50/50 text-slate-800">Best Setting</td>
                      <td className="p-3">Outpatient clinics, private practices, consultations</td>
                      <td className="p-3">Modern multi-specialty health systems, telehealth networks</td>
                      <td className="p-3">Emergency departments, ICU ward monitors, central operations</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium bg-slate-50/50 text-slate-800">Key Strengths</td>
                      <td className="p-3">Immaculate typography, calm patient interaction, no clutter</td>
                      <td className="p-3">Familiar SaaS mental model, rich micro-interactions, sleek</td>
                      <td className="p-3">Immediate situational awareness, rapid scanning, keyboard shortcuts</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Design Tokens & Psychology Breakdown */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Design Psychology & Architecture Notes
              </h3>

              <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/30">
                <h4 className="text-sm font-semibold text-teal-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                  Concept 1: Minimal Clinical (Psychological Calming Effect)
                </h4>
                <p className="text-xs text-teal-800 mt-1.5 leading-relaxed">
                  Clinicians make life-or-death decisions while experiencing alarm fatigue. Concept 1 strictly avoids gratuitous UI chrome, heavy gradients, or unnecessary animations. It uses soft teal (#0F766E) which reduces blood pressure response compared to clinical blues, paired with generous white space and hairline slate borders for maximum focus.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30">
                <h4 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  Concept 2: Modern SaaS (Digital Native Efficiency)
                </h4>
                <p className="text-xs text-indigo-800 mt-1.5 leading-relaxed">
                  Brings consumer-grade polish into healthcare software. Features subtle layered card elevation, smooth hover feedback, badge pill indicators with live status dots, and a dark obsidian sidebar contrast with light content canvas. Perfect for health systems aiming to recruit modern medical staff accustomed to Linear or Apple ecosystems.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-sky-300 bg-slate-900 text-slate-200">
                <h4 className="text-sm font-semibold text-sky-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
                  Concept 3: Clinical Command Centre (Mission-Critical Telemetry)
                </h4>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Designed explicitly for hospital ward leads, ICU supervisors, and Emergency Operations. High contrast OLED-friendly dark surfaces minimize eye strain in dimly lit nursing stations. Telemetry metrics feature color-coded triage acuity (Critical/P1, Urgent/P2, Priority/P3), patient wait timers, bed occupancy gauges, and instant page-doctor actions.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Interactive prototype created for architectural evaluation
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Close Comparison
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
