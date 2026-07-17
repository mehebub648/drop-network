import { BadgeCheck, CircleAlert } from 'lucide-react';
import { cn } from '../lib/utils';

export default function VerifiedBadge({ verified, compact = false }: { verified: boolean; compact?: boolean }) {
  return (
    <span
      title={verified ? 'This account is verified by Drop.' : 'This account has not been verified yet.'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-bold',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        verified ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'
      )}
    >
      {verified ? <BadgeCheck className="w-3.5 h-3.5" /> : <CircleAlert className="w-3.5 h-3.5" />}
      {verified ? 'Verified' : 'Unverified'}
    </span>
  );
}
