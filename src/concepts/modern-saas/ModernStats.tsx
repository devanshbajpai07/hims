import React from 'react';
import { StatMetric } from '../../types';
import { Users, CalendarCheck, CheckCircle2, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface ModernStatsProps {
  stats: StatMetric[];
}

export const ModernStats: React.FC<ModernStatsProps> = ({ stats }) => {
  const iconConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    Users: {
      bg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      text: 'text-indigo-600',
      icon: <Users className="w-4 h-4" />,
    },
    CalendarCheck: {
      bg: 'bg-sky-50 text-sky-600 border-sky-100',
      text: 'text-sky-600',
      icon: <CalendarCheck className="w-4 h-4" />,
    },
    CheckCircle2: {
      bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      text: 'text-emerald-600',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    Clock: {
      bg: 'bg-amber-50 text-amber-600 border-amber-100',
      text: 'text-amber-600',
      icon: <Clock className="w-4 h-4" />,
    },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const conf = iconConfig[stat.iconName] || iconConfig['Users'];
        return (
          <div
            key={stat.id}
            className="group bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-slate-300/80 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {stat.label}
              </span>
              <div
                className={`p-2 rounded-xl border ${conf.bg} group-hover:scale-110 transition-transform`}
              >
                {conf.icon}
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold text-slate-900 tracking-tight font-display">
                {stat.value}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {stat.subValue}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
              <div
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  stat.trend === 'up'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                }`}
              >
                {stat.trend === 'up' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{stat.change}</span>
              </div>
              <span className="text-[11px] text-slate-400">{stat.timeframe}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
