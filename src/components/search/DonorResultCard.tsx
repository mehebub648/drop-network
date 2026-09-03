import { Eye, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import type { SearchDonorCard } from '../../lib/api';

function availabilityLabel(status?: string) {
  if (!status) return null;
  return status
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * A compact donor preview. Public details stay in the search-scoped profile
 * summary; contact still requires a published request and is recorded.
 */
export default function DonorResultCard({
  donor,
  onView,
  onSelect,
  busy
}: {
  donor: SearchDonorCard;
  onView: (donor: SearchDonorCard) => void;
  onSelect: (donor: SearchDonorCard) => void | Promise<void>;
  busy?: boolean;
}) {
  const availability = availabilityLabel(donor.availability_status);

  return (
    <article className="donor-result-row group flex min-w-0 flex-col gap-4 py-5 sm:flex-row sm:items-center sm:py-6">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-red-200 bg-rose-50 text-lg font-extrabold text-red-700">
          {donor.blood_group}
          <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-white bg-red-500" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-extrabold text-slate-950">{donor.name}</h3>
            {donor.is_current_user && (
              <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-extrabold uppercase tracking-wide text-rose-800">
                <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                Your profile
              </span>
            )}
            {donor.is_verified && (
              <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 text-[11px] font-extrabold uppercase tracking-wide text-green-800">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Phone verified
              </span>
            )}
            {!donor.is_exact_group && (
              <span className="inline-flex min-h-7 items-center rounded-full bg-amber-50 px-2.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-800">
                Compatible
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-sm font-semibold text-slate-600">
            <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
            {donor.phone_masked || 'No phone published'}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
            <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
            {donor.upazila ? `${donor.upazila}, ${donor.district}` : donor.district}
          </p>
          {availability && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
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

      <div className="grid grid-cols-2 gap-2 sm:w-64 sm:shrink-0">
        <button type="button" onClick={() => onView(donor)} className="button button-secondary w-full gap-2">
          <Eye className="h-4 w-4" aria-hidden="true" />
          View profile
        </button>
        {donor.is_current_user ? (
          <Link to="/profile/donor" className="button button-primary w-full gap-2">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Manage profile
          </Link>
        ) : (
          <button
            type="button"
            disabled={!donor.has_phone || busy}
            onClick={() => onSelect(donor)}
            className="button button-primary w-full gap-2"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Opening...' : 'Call donor'}
          </button>
        )}
      </div>
    </article>
  );
}
