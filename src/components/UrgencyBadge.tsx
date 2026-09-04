import { getUrgency } from '../lib/blood';
import { URGENCY_STYLES } from '../lib/urgency';
import { cn } from '../lib/utils';

export function UrgencyBadge({ neededBy }: { neededBy?: string | null }) {
  if (neededBy && Date.parse(neededBy) <= Date.now()) return <span className="text-xs font-bold text-slate-600">Past deadline</span>;
  const urgency = getUrgency(neededBy);
  const { label, className } = URGENCY_STYLES[urgency];
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider', className)}>
      {label}{!neededBy && ' · ASAP'}
    </span>
  );
}
