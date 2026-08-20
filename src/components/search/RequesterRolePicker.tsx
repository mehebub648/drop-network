import { UserRound } from 'lucide-react';
import type { RequesterRole } from '../../lib/searchDraft';

const ROLE_OPTIONS: Array<{ value: RequesterRole; label: string; description: string }> = [
  { value: 'PATIENT', label: "I'm the patient", description: 'I need blood for myself.' },
  { value: 'RELATIVE', label: "I'm the patient's relative", description: 'I am helping a family member.' },
  { value: 'THIRD_PARTY', label: "I'm a third-party volunteer", description: 'I am coordinating this request for someone else.' }
];

export default function RequesterRolePicker({
  value,
  onChange,
  legend = 'Who are you?',
  hideLegend = false,
  className = ''
}: {
  value: RequesterRole | '';
  onChange: (role: RequesterRole) => void;
  legend?: string;
  hideLegend?: boolean;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className={hideLegend ? 'sr-only' : 'text-sm font-extrabold text-slate-900'}>{legend}</legend>
      <div className={`${hideLegend ? '' : 'mt-3'} grid gap-2`}>
        {ROLE_OPTIONS.map(option => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                selected
                  ? 'border-primary bg-rose-50 text-rose-950 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-rose-200 hover:bg-rose-50'
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-white text-primary' : 'bg-slate-50 text-slate-400'}`}>
                <UserRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold leading-5">{option.label}</span>
                <span className="mt-0.5 block text-xs font-medium leading-5 text-slate-500">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
