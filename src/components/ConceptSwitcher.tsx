import React from 'react';
import { ConceptId } from '../types';
import { Sparkles, Sliders, Activity, Info, LayoutTemplate, Layers } from 'lucide-react';

interface ConceptSwitcherProps {
  activeConcept: ConceptId;
  onSelectConcept: (c: ConceptId) => void;
  onOpenComparison: () => void;
}

export const ConceptSwitcher: React.FC<ConceptSwitcherProps> = ({
  activeConcept,
  onSelectConcept,
  onOpenComparison,
}) => {
  const concepts: { id: ConceptId; label: string; badge: string; icon: React.ReactNode }[] = [
    {
      id: 'minimal-clinical',
      label: 'Minimal Clinical',
      badge: 'Calm & Spacious',
      icon: <LayoutTemplate className="w-4 h-4" />,
    },
    {
      id: 'modern-saas',
      label: 'Modern SaaS',
      badge: 'Refined & Elevated',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'command-centre',
      label: 'Clinical Command Centre',
      badge: 'High-Density Ops',
      icon: <Activity className="w-4 h-4" />,
    },
  ];

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur-md px-3 py-1.5 rounded-full shadow-2xl border border-slate-700/80 flex items-center gap-2 max-w-[94vw] overflow-x-auto transition-all">
      <div className="flex items-center gap-1.5 pl-2 pr-3 border-r border-slate-700 text-xs font-semibold text-slate-300 whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
        <span className="hidden sm:inline">Concept:</span>
      </div>

      <div className="flex items-center gap-1">
        {concepts.map((c) => {
          const isActive = activeConcept === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelectConcept(c.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {c.icon}
              <span>{c.label}</span>
              <span
                className={`hidden md:inline text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {c.badge}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pl-2 border-l border-slate-700">
        <button
          onClick={onOpenComparison}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 transition-all border border-teal-500/30 whitespace-nowrap"
          title="Compare UX Architecture and Design Decisions"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Compare Concepts</span>
        </button>
      </div>
    </div>
  );
};
