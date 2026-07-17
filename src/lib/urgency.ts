import type { Urgency } from './blood';

export const URGENCY_STYLES: Record<Urgency, { label: string; className: string }> = {
  CRITICAL: { label: 'Critical', className: 'bg-red-100 text-red-700' },
  URGENT: { label: 'Urgent', className: 'bg-amber-100 text-amber-700' },
  SCHEDULED: { label: 'Scheduled', className: 'bg-sky-100 text-sky-700' }
};

