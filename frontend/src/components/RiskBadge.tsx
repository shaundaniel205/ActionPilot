import React from 'react';

interface Props {
  risk?: 'low' | 'medium' | 'high';
}

export function RiskBadge({ risk }: Props) {
  if (!risk) return null;

  const colors = {
    low: 'bg-emerald-400 text-emerald-900 border-emerald-500/30',
    medium: 'bg-amber-400 text-amber-950 border-amber-500/30',
    high: 'bg-rose-400 text-rose-950 border-rose-500/30',
  } as const;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${colors[risk]}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${colors[risk].split(' ')[0]}`} />
      {risk === 'low' ? 'Safe' : risk === 'medium' ? 'Monitor' : 'High Risk'}
    </span>
  );
}
