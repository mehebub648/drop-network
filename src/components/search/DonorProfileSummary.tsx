import { CalendarDays, CheckCircle2, ExternalLink, LockKeyhole, MapPin, Phone, ShieldAlert, ShieldCheck, UserRound, X } from 'lucide-react';
import { Link } from 'react-router';
import type { SearchDonorCard } from '../../lib/api';
import type { PublicDonationSummary } from '../../lib/donation';
import ModalPortal from '../ModalPortal';

function availabilityLabel(status?: string) {
  if (!status) return 'Not confirmed on Drop';
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

const ISSUE_LABELS: Record<string, string> = {
  WRONG_NUMBER: 'reported wrong number',
  UNREACHABLE: 'could not connect',
  DECLINED: 'reported unavailable',
  RECENTLY_DONATED: 'reported recent donation',
  TOO_FAR: 'reported too far',
  HEALTH: 'reported health limitation'
};

export default function DonorProfileSummary({
  donor,
  onClose,
  onRequest,
  busy,
  showClaimOption
}: {
  donor: SearchDonorCard;
  onClose: () => void;
  onRequest: () => void;
  busy?: boolean;
  showClaimOption: boolean;
}) {
  const donationSummary = donor.donor_kind === 'REGISTERED' ? donor.donation_summary : undefined;
  const issues = Object.entries(donor.contact_issues || {}).filter(([, count]) => Boolean(count));

  return (
    <ModalPortal onClose={onClose}>
      <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
        <section className="action-dialog donor-summary-dialog" role="dialog" aria-modal="true" aria-labelledby="donor-summary-title">
          <button type="button" onClick={onClose} className="icon-button dialog-close" aria-label="Close donor profile" autoFocus>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="flex items-start gap-4 pr-9">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-red-100 bg-rose-50 text-xl font-extrabold text-red-700">
              {donor.blood_group}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">Donor profile summary</p>
              <h2 id="donor-summary-title" className="mt-1 text-xl font-extrabold text-slate-950">{donor.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {donor.upazila ? `${donor.upazila}, ${donor.district}` : donor.district}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Listing</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{donor.donor_kind === 'REGISTERED' ? 'Drop member' : 'Public directory'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Phone status</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                {donor.is_verified && <ShieldCheck className="h-4 w-4 text-green-700" aria-hidden="true" />}
                {donor.is_verified ? 'Verified' : 'Not verified by Drop'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Availability</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{availabilityLabel(donor.availability_status)}</p>
            </div>
          </div>

          {(donor.preference_match_reasons || []).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Why this donor matched">
              {donor.preference_match_reasons!.map(reason => (
                <span key={reason} className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {reason}
                </span>
              ))}
            </div>
          )}

          {(donationSummary || donor.donation_total !== undefined) && (
            <div className="mt-4 rounded-2xl border border-green-100 bg-green-50/70 px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-green-800">Self-reported donation history</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-slate-700">
                {donationSummary && (
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-green-700" aria-hidden="true" />
                    {donationSummaryLabel(donationSummary)}
                  </span>
                )}
                {donor.donation_total !== undefined && (
                  <span>{donor.donation_total.toLocaleString()} total donation{donor.donation_total === 1 ? '' : 's'}</span>
                )}
              </div>
            </div>
          )}

          {donor.source && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              This listing was published by{' '}
              <a href={donor.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-slate-900 hover:text-primary">
                {donor.source.organization}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>. This person is not registered with Drop, so availability and phone ownership are not confirmed here.
            </div>
          )}

          {issues.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3" aria-label="Recent contact feedback">
              <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-amber-900"><ShieldAlert className="h-4 w-4" aria-hidden="true" />Contact feedback</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {issues.map(([category, count]) => <span key={category} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-900">{count} {ISSUE_LABELS[category] || 'contact report'}</span>)}
              </div>
              <p className="mt-2 text-xs leading-5 text-amber-900/80">Counts come from distinct verified requesters after a recorded phone reveal; owner corrections can make earlier reports stale.</p>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
            <p className="flex items-center gap-2 font-semibold tabular-nums text-slate-800">
              <LockKeyhole className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {donor.has_phone ? donor.phone_masked : 'No number published'}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">The full number stays protected until an eligible blood request is published, and every reveal is recorded.</p>
          </div>

          {showClaimOption && donor.donor_kind === 'IMPORTED' && donor.claim_path && (
            <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3">
              <p className="text-sm font-bold text-violet-950">Is this your listing?</p>
              <p className="mt-1 text-xs leading-5 text-violet-900/80">Verify the listed phone, confirm your details, and manage availability yourself.</p>
              <Link to={donor.claim_path} onClick={onClose} className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-violet-700 px-3 text-xs font-extrabold text-white hover:bg-violet-800">Claim with short link</Link>
            </div>
          )}

          <div className="dialog-actions">
            <button type="button" onClick={onClose} className="button button-secondary">Close</button>
            {donor.is_current_user ? (
              <Link to="/profile/donor" onClick={onClose} className="button button-primary gap-2"><UserRound className="h-4 w-4" aria-hidden="true" />Manage profile</Link>
            ) : (
              <button type="button" onClick={onRequest} disabled={!donor.has_phone || busy} className="button button-primary gap-2"><Phone className="h-4 w-4" aria-hidden="true" />{busy ? 'Opening...' : 'Call donor'}</button>
            )}
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}
