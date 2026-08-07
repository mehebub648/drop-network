import {
  APPROXIMATE_DONATION_LIMITS,
  APPROXIMATE_DONATION_UNITS,
  MAX_DONATION_COUNT,
  type DonationExperienceDraft
} from '../lib/donation';

const unitLabels = {
  DAYS: 'Days',
  MONTHS: 'Months',
  YEARS: 'Years'
} as const;

export default function DonationExperienceFields({
  idPrefix,
  value,
  onChange,
  optional = false,
  minimumCount = 0,
  className = ''
}: {
  idPrefix: string;
  value: DonationExperienceDraft;
  onChange: (next: DonationExperienceDraft) => void;
  optional?: boolean;
  minimumCount?: number;
  className?: string;
}) {
  const setKind = (kind: DonationExperienceDraft['kind']) => {
    onChange({
      ...value,
      kind,
      donationCount: kind === 'NEVER' ? '0' : value.kind === 'NEVER' ? '' : value.donationCount
    });
  };
  const countRequired = value.kind === 'EXACT' || value.kind === 'APPROXIMATE';
  const helpId = `${idPrefix}-donation-help`;

  return (
    <fieldset className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}>
      <legend className="px-1 text-sm font-extrabold text-slate-900">
        Donation experience{optional ? ' (optional)' : ''}
      </legend>
      <p id={helpId} className="mt-1 text-xs leading-5 text-slate-500">
        Share an exact date, a rough time ago, or that you have never donated.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Last donation</span>
          <select
            value={value.kind}
            onChange={event => setKind(event.target.value as DonationExperienceDraft['kind'])}
            className="input"
            aria-describedby={helpId}
          >
            <option value="">Not provided</option>
            <option value="EXACT">I know the exact date</option>
            <option value="APPROXIMATE">I remember roughly how long ago</option>
            <option value="NEVER">I have never donated</option>
          </select>
        </label>

        {value.kind === 'EXACT' && (
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Exact date</span>
            <input
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={value.exactDate}
              onChange={event => onChange({ ...value, exactDate: event.target.value })}
              className="input"
            />
          </label>
        )}

        {value.kind === 'APPROXIMATE' && (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.8fr)] gap-3">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">How many</span>
              <input
                type="number"
                inputMode="numeric"
                required
                min={1}
                max={APPROXIMATE_DONATION_LIMITS[value.approximateUnit]}
                step={1}
                value={value.approximateValue}
                onChange={event => onChange({ ...value, approximateValue: event.target.value })}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Unit</span>
              <select
                value={value.approximateUnit}
                onChange={event => onChange({
                  ...value,
                  approximateUnit: event.target.value as DonationExperienceDraft['approximateUnit']
                })}
                className="input"
              >
                {APPROXIMATE_DONATION_UNITS.map(unit => (
                  <option key={unit} value={unit}>{unitLabels[unit]}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {countRequired && (
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Lifetime donations</span>
            <input
              type="number"
              inputMode="numeric"
              required
              min={Math.max(1, minimumCount)}
              max={MAX_DONATION_COUNT}
              step={1}
              value={value.donationCount}
              onChange={event => onChange({ ...value, donationCount: event.target.value })}
              className="input"
            />
          </label>
        )}

        {value.kind === 'NEVER' && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 sm:col-span-2">
            Lifetime donations are fixed at 0.
          </div>
        )}
      </div>
    </fieldset>
  );
}
