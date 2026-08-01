import { CalendarDays, CheckCircle2, LockKeyhole, MapPin, Phone, ShieldCheck } from 'lucide-react';
import type { SearchDonorCard } from '../../lib/api';
import type { PublicDonationSummary } from '../../lib/donation';

function availabilityLabel(status?: string) {
  if (!status) return null;
  return status
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function donationSummaryLabel(summary: PublicDonationSummary) {
  if (summary.kind === 'NEVER') return 'Never donated blood';
  if (summary.kind === 'APPROXIMATE') {
    const pluralUnit = summary.unit.toLowerCase();
    const unit = summary.value === 1 ? pluralUnit.slice(0, -1) : pluralUnit;
    return `Last donated about ${summary.value.toLocaleString()} ${unit} ago`;
  }
  const date = new Date(`${summary.date}T00:00:00`);
  const label = Number.isNaN(date.getTime())
    ? summary.date
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return `Last donated ${label}`;
}

/**
 * One donor. The number is always masked here; the button asks the server to
 * unmask it, which requires a published request and is recorded.
 */
export default function DonorResultCard({
  donor,
  onSelect,
  busy
}: {
  donor: SearchDonorCard;
  onSelect: (donor: SearchDonorCard) => void | Promise<void>;
  busy?: boolean;
}) {
  const availability = availabilityLabel(donor.availability_status);
  const donationSummary = donor.donor_kind === 'REGISTERED' ? donor.donation_summary : undefined;

  return (
    <article className="theme-card flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-lg font-extrabold text-red-700">
          {donor.blood_group}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-extrabold text-slate-950">{donor.name}</h3>
            {donor.donor_kind === 'REGISTERED' && (
              <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-emerald-50 px-2.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Registered donor
              </span>
            )}
            {!donor.is_exact_group && (
              <span className="inline-flex min-h-7 items-center rounded-full bg-amber-50 px-2.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-800">
                Compatible
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
            <MapPin className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            {donor.upazila ? `${donor.upazila}, ${donor.district}` : donor.district}
          </p>
          {availability && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {availability}
            </p>
          )}
          {donor.source && (
            // Attribution matters: this person published a listing elsewhere and
            // has no account here. Saying so is the difference between a member
            // who opted in and a stranger who did not.
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Listed publicly by {donor.source.organization}. Not registered with Drop.
            </p>
          )}
        </div>
      </div>

      {donationSummary && (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">Self-reported donation history</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              {donationSummaryLabel(donationSummary)}
            </span>
            {donationSummary.donation_count !== undefined && (
              <span>
                {donationSummary.donation_count.toLocaleString()} total donation{donationSummary.donation_count === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 flex min-h-20 flex-1 flex-col justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 font-semibold tabular-nums text-slate-700">
          <LockKeyhole className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          {donor.has_phone ? donor.phone_masked : 'No number published'}
        </p>
        <button
          type="button"
          disabled={!donor.has_phone || busy}
          onClick={() => onSelect(donor)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Opening...' : 'Get this number'}
        </button>
      </div>
    </article>
  );
}
