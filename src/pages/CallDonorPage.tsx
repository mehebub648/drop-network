import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, Info, Phone } from 'lucide-react';
import { api } from '../lib/api';
import { readSearchDraft } from '../lib/searchDraft';

type Reveal = {
  reveal_id: string;
  donor_ref: string;
  donor_kind: 'REGISTERED' | 'IMPORTED';
  name: string;
  blood_group: string;
  district: string;
  upazila: string;
  phone: string;
  source?: { organization: string; url: string };
};

const OUTCOMES = [
  { value: 'WILL_DONATE', label: 'The donor agreed to donate' },
  { value: 'NOT_CALLED', label: "I didn't call" },
  { value: 'NO_ANSWER', label: "The donor didn't pick up" },
  { value: 'WRONG_NUMBER', label: 'Wrong or invalid number' },
  { value: 'DECLINED', label: "The donor doesn't want to donate" }
];

const DECLINE_REASONS = [
  { value: 'RECENTLY_DONATED', label: 'Recently donated' },
  { value: 'LOCATION_FAR', label: 'Location is far away' },
  { value: 'DONOR_ILL', label: 'The donor is ill' },
  { value: 'OTHER', label: 'Another reason' },
  { value: 'UNSPECIFIED', label: "The donor didn't say" }
];

const FAR_DETAILS = [
  { value: 'OUTSIDE_DISTRICT', label: "Doesn't live in the district" },
  { value: 'TRAVELLING', label: 'Is travelling right now' },
  { value: 'FAR_WITHIN_DISTRICT', label: 'Lives in the district, but too far' }
];

/**
 * One number, one call, one answer.
 *
 * The page has no way back on purpose, but the real mechanism is on the server:
 * the next reveal is refused until this call is reported, so leaving without
 * answering defers the question rather than escaping it. A hard client-side
 * lock is not possible - the tab can always be closed - so nothing here
 * pretends otherwise.
 */
export default function CallDonorPage() {
  const { requestId = '', donorRef = '' } = useParams();
  const navigate = useNavigate();
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [loadError, setLoadError] = useState('');
  const [outcome, setOutcome] = useState('');
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reported = useRef(false);
  // Going back to a bare /directory would drop the search and make the
  // requester redo it after every call, so carry the criteria back.
  const [backTo] = useState(() => {
    const draft = readSearchDraft();
    if (!draft.blood_group || !draft.district || !draft.upazila) return '/directory';
    return `/directory?${new URLSearchParams({
      blood_group: draft.blood_group,
      district: draft.district,
      upazila: draft.upazila
    })}`;
  });
  // Tapping a tel: link is a navigation, and would otherwise trip the unload
  // prompt on every single call attempt on a phone.
  const dialling = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api.revealDonorPhone(requestId, decodeURIComponent(donorRef))
      .then(response => {
        if (!cancelled) setReveal(response);
      })
      .catch(cause => {
        if (!cancelled) setLoadError(cause?.message || 'We could not open that number.');
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, donorRef]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (reported.current || dialling.current || !reveal) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') dialling.current = false;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reveal]);

  const copy = async () => {
    if (!reveal) return;
    try {
      await navigator.clipboard.writeText(reveal.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access needs a secure context. The number is selectable, so
      // say that rather than failing silently.
      setError('Copying is blocked here. Select the number and copy it manually.');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reveal) return;
    setBusy(true);
    setError('');
    try {
      await api.reportCall(requestId, {
        reveal_id: reveal.reveal_id,
        outcome,
        reason: outcome === 'DECLINED' ? reason : undefined,
        detail: outcome === 'DECLINED' && reason === 'LOCATION_FAR' ? detail : undefined,
        note: note.trim() || undefined
      });
      reported.current = true;
      navigate(backTo, { replace: true });
    } catch (cause: any) {
      setError(cause?.message || 'We could not record that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = Boolean(outcome) &&
    (outcome !== 'DECLINED' || Boolean(reason)) &&
    (reason !== 'LOCATION_FAR' || Boolean(detail)) &&
    (reason !== 'OTHER' || Boolean(note.trim()));

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <div role="alert" className="alert alert-error">{loadError}</div>
        <button type="button" onClick={() => navigate(backTo, { replace: true })} className="theme-button mt-5">
          Back to search
        </button>
      </div>
    );
  }

  if (!reveal) {
    return (
      <div aria-busy="true" className="mx-auto max-w-2xl py-16 text-center text-sm font-semibold text-slate-600">
        Opening the contact number...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-40">
      <p className="eyebrow">Call this donor</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">{reveal.name}</h1>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        {reveal.blood_group} &middot; {reveal.upazila ? `${reveal.upazila}, ` : ''}{reveal.district}
      </p>

      {reveal.donor_kind === 'IMPORTED' && reveal.source && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="text-sm font-semibold leading-6 text-amber-900">
            {reveal.source.organization} published this listing. This person did not sign up here and is
            not expecting your call. Please call once, be brief, and do not pass the number on.
          </p>
        </div>
      )}

      <div className="theme-card mt-6 p-6 text-center sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Contact number</p>
        <p className="mt-3 select-all break-all text-3xl font-extrabold tracking-wider text-slate-950 tabular-nums sm:text-4xl">
          {reveal.phone}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={`tel:${reveal.phone}`}
            onClick={() => { dialling.current = true; }}
            className="primary-button"
          >
            <Phone className="h-5 w-5" aria-hidden="true" />
            Call now
          </a>
          <button type="button" onClick={copy} className="theme-button">
            {copied ? <Check className="h-5 w-5" aria-hidden="true" /> : <Copy className="h-5 w-5" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy number'}
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="theme-card mt-6 p-6 sm:p-8">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-950">How did the call go?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Answer before opening another number. It is how stale listings get found, and how the next
          person avoids a number that no longer works.
        </p>

        <fieldset className="mt-5">
          <legend className="text-sm font-extrabold text-slate-800">What happened?</legend>
          <div className="mt-3 space-y-2">
            {OUTCOMES.map(option => (
              <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 has-[:checked]:border-primary has-[:checked]:bg-rose-50">
                <input
                  type="radio"
                  name="outcome"
                  value={option.value}
                  checked={outcome === option.value}
                  onChange={() => { setOutcome(option.value); setReason(''); setDetail(''); }}
                  className="h-4 w-4"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {outcome === 'DECLINED' && (
          <fieldset className="fade-in mt-5 border-l-2 border-slate-200 pl-4">
            <legend className="text-sm font-extrabold text-slate-800">Why not?</legend>
            <div className="mt-3 space-y-2">
              {DECLINE_REASONS.map(option => (
                <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 has-[:checked]:border-primary has-[:checked]:bg-rose-50">
                  <input
                    type="radio"
                    name="reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => { setReason(option.value); setDetail(''); }}
                    className="h-4 w-4"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {outcome === 'DECLINED' && reason === 'LOCATION_FAR' && (
          <fieldset className="fade-in mt-5 border-l-2 border-slate-200 pl-4">
            <legend className="text-sm font-extrabold text-slate-800">How far?</legend>
            <div className="mt-3 space-y-2">
              {FAR_DETAILS.map(option => (
                <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 has-[:checked]:border-primary has-[:checked]:bg-rose-50">
                  <input
                    type="radio"
                    name="detail"
                    value={option.value}
                    checked={detail === option.value}
                    onChange={() => setDetail(option.value)}
                    className="h-4 w-4"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-extrabold text-slate-800">
            Anything to add? {reason === 'OTHER' ? '(required)' : '(optional)'}
          </span>
          <textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            maxLength={300}
            rows={3}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium outline-none focus:border-primary"
          />
        </label>

        {error && <div role="alert" className="alert alert-error mt-4">{error}</div>}

        <div className="sticky bottom-0 -mx-6 mt-6 border-t border-slate-200 bg-white/95 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-8 sm:px-8">
          <button type="submit" disabled={!canSubmit || busy} className="primary-button disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? 'Saving...' : 'Save and go back to donors'}
          </button>
        </div>
      </form>
    </div>
  );
}
