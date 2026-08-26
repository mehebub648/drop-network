export type RegistrationAvailability = 'AVAILABLE' | 'NOT_AVAILABLE' | '';

export default function DonorAvailabilityFields({
  idPrefix,
  value,
  onChange,
  reason,
  onReasonChange
}: {
  idPrefix: string;
  value: RegistrationAvailability;
  onChange: (value: RegistrationAvailability) => void;
  reason: string;
  onReasonChange: (value: string) => void;
}) {
  const name = `${idPrefix}-availability`;

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-bold text-slate-800">Are you available to donate?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
          value === 'AVAILABLE' ? 'border-primary bg-rose-50 ring-1 ring-primary' : 'border-slate-200 bg-white hover:border-rose-200'
        }`}>
          <input
            required
            type="radio"
            name={name}
            value="AVAILABLE"
            checked={value === 'AVAILABLE'}
            onChange={() => onChange('AVAILABLE')}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>
            <strong className="block text-sm text-slate-900">I’m available to donate</strong>
            <small className="mt-1 block leading-5 text-slate-500">Your profile can appear in matching donor searches.</small>
          </span>
        </label>
        <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
          value === 'NOT_AVAILABLE' ? 'border-primary bg-rose-50 ring-1 ring-primary' : 'border-slate-200 bg-white hover:border-rose-200'
        }`}>
          <input
            required
            type="radio"
            name={name}
            value="NOT_AVAILABLE"
            checked={value === 'NOT_AVAILABLE'}
            onChange={() => onChange('NOT_AVAILABLE')}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>
            <strong className="block text-sm text-slate-900">I’m not available to donate</strong>
            <small className="mt-1 block leading-5 text-slate-500">Your donor profile is created, but it stays off the live list.</small>
          </span>
        </label>
      </div>
      {value === 'NOT_AVAILABLE' && (
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-bold text-slate-800">Reason (optional)</span>
          <textarea
            maxLength={240}
            rows={3}
            value={reason}
            onChange={event => onReasonChange(event.target.value)}
            className="input resize-y"
            placeholder="For example: recovering, traveling, or taking a break"
          />
          <span className="mt-1 block text-xs leading-5 text-slate-500">This stays private and can be changed later.</span>
        </label>
      )}
    </fieldset>
  );
}
