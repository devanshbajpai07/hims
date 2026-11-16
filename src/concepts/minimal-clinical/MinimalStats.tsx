import React from 'react';
import { StatMetric } from '../../types';
import { Users, CalendarCheck, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MinimalStatsProps {
  stats: StatMetric[];
}

export const MinimalStats: React.FC<MinimalStatsProps> = ({ stats }) => {
  const iconMap: Record<string, React.ReactNode> = {
    Users: <Users className="w-4 h-4 text-slate-500" />,
    CalendarCheck: <CalendarCheck className="w-4 h-4 text-slate-500" />,
    CheckCircle2: <CheckCircle2 className="w-4 h-4 text-slate-500" />,
    Clock: <Clock className="w-4 h-4 text-slate-500" />,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.id}
          className="bg-white p-5 rounded-xl border border-slate-200/70 hover:border-slate-300 transition-all shadow-soft-sm"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium text-slate-500 tracking-normal">
              {stat.label}
            </span>
            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
              {iconMap[stat.iconName] || <Users className="w-4 h-4" />}
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-semibold text-slate-800 tracking-tight">
              {stat.value}
            </span>
            <span className="text-xs font-normal text-slate-400">
              {stat.subValue}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-2 border-t border-slate-100/80">
            <span
              className={`inline-flex items-center font-medium ${
                stat.trend === 'up'
                  ? 'text-teal-700'
                  : stat.trend === 'down'
                  ? 'text-amber-700'
                  : 'text-slate-600'
              }`}
            >
              {stat.trend === 'up' ? (
                <ArrowUpRight className="w-3 h-3 mr-0.5" />
              ) : (
                <ArrowDownRight className="w-3 h-3 mr-0.5" />
              )}
              {stat.change}
            </span>
            <span className="text-slate-400">{stat.timeframe}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
