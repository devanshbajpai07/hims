import React from 'react';
import { StatMetric } from '../../types';
import { Users, CalendarCheck, CheckCircle2, Clock, ShieldCheck, AlertCircle } from 'lucide-react';

interface CommandStatsProps {
  stats: StatMetric[];
}

export const CommandStats: React.FC<CommandStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, idx) => {
        const borderGlow =
          idx === 0
            ? 'border-sky-500/30'
            : idx === 1
            ? 'border-indigo-500/30'
            : idx === 2
            ? 'border-emerald-500/30'
            : 'border-amber-500/30';

        const textColor =
          idx === 0
            ? 'text-sky-400'
            : idx === 1
            ? 'text-indigo-400'
            : idx === 2
            ? 'text-emerald-400'
            : 'text-amber-400';

        return (
          <div
            key={stat.id}
            className={`bg-[#111827] p-3.5 rounded-lg border ${borderGlow} hover:border-slate-500 transition-all font-mono shadow-command-card`}
          >
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span className="uppercase tracking-wider font-bold">{stat.label}</span>
              <span className="text-[10px] px-1 rounded bg-[#1F2E47] text-slate-300">
                0{idx + 1}
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-1">
              <span className={`text-2xl font-black ${textColor} tracking-tight`}>
                {stat.value}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {stat.subValue}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] pt-2 border-t border-[#1F2E47] text-slate-400">
              <span className={`font-bold ${stat.trend === 'up' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {stat.change}
              </span>
              <span>{stat.timeframe}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
