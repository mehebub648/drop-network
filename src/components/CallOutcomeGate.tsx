import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, Info, Phone, PhoneCall, RefreshCw, ShieldAlert } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import {
  PENDING_CALL_CHANGED_EVENT,
  PENDING_CALL_STORAGE_KEY,
  announcePendingCall,
  type PendingCallChangedDetail,
  type RevealedCallContact
} from '../lib/callOutcome';
import ModalPortal from './ModalPortal';

type PendingReveal = {
  reveal_id: string;
  request_id: string;
  donor_ref: string;
  donor_kind: 'REGISTERED' | 'IMPORTED';
  created_at: string;
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

export default function CallOutcomeGate({ user }: { user: any }) {
  const { pathname } = useLocation();
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<PendingReveal | null>(null);
  const [reveal, setReveal] = useState<RevealedCallContact | null>(null);
  const [checkError, setCheckError] = useState('');
  const [contactError, setContactError] = useState('');
  const [outcome, setOutcome] = useState('');
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const checkedUserRef = useRef('');
  const pendingRef = useRef<PendingReveal | null>(null);
  const revealRef = useRef<RevealedCallContact | null>(null);
  const dialling = useRef(false);

  pendingRef.current = pending;
  revealRef.current = reveal;

  const clearForm = useCallback(() => {
    setOutcome('');
    setReason('');
    setDetail('');
    setNote('');
    setError('');
  }, []);

  const loadPending = useCallback(async (showLoading = false) => {
    if (!user?.id) {
      setChecking(false);
      setPending(null);
      setReveal(null);
      setCheckError('');
      return;
    }
    if (showLoading) setChecking(true);
    try {
      const response = await api.getPendingCallOutcome();
      const next: PendingReveal | null = response.pending || null;
      setCheckError('');
      if (!next) {
        setPending(null);
        setReveal(null);
        clearForm();
        return;
      }

      const changed = pendingRef.current?.reveal_id !== next.reveal_id;
      setPending(next);
      if (changed) {
        setReveal(null);
        clearForm();
      }
      if (!changed && revealRef.current) return;

      try {
        const contact = await api.revealDonorPhone(next.request_id, next.donor_ref);
        setReveal(contact);
        setContactError('');
      } catch (cause: any) {
        setContactError(cause?.message || 'The contact cannot be reopened, but you can still report the call.');
      }
    } catch (cause: any) {
      if (cause?.status === 401) {
        window.location.reload();
        return;
      }
      setCheckError(cause?.message || 'We could not check whether a call report is waiting.');
    } finally {
      setChecking(false);
    }
  }, [clearForm, user?.id]);

  useEffect(() => {
    const userId = user?.id ? String(user.id) : '';
    const firstCheck = Boolean(userId && checkedUserRef.current !== userId);
    checkedUserRef.current = userId;
    void loadPending(firstCheck);
  }, [user?.id, pathname, loadPending]);

  useEffect(() => {
    if (!user?.id) return;
    const onChanged = (event: Event) => {
      const changed = (event as CustomEvent<PendingCallChangedDetail | undefined>).detail;
      if (!changed) return void loadPending();
      const next: PendingReveal = {
        reveal_id: changed.reveal.reveal_id,
        request_id: changed.requestId,
        donor_ref: changed.reveal.donor_ref,
        donor_kind: changed.reveal.donor_kind,
        created_at: new Date().toISOString()
      };
      setPending(next);
      setReveal(changed.reveal);
      setContactError('');
      setCheckError('');
      setChecking(false);
      clearForm();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === PENDING_CALL_STORAGE_KEY) void loadPending();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        dialling.current = false;
        void loadPending();
      }
    };
    const interval = window.setInterval(() => void loadPending(), 30_000);
    window.addEventListener(PENDING_CALL_CHANGED_EVENT, onChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PENDING_CALL_CHANGED_EVENT, onChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [clearForm, loadPending, user?.id]);

  const needsInitialCheck = Boolean(user?.id && checkedUserRef.current !== String(user.id));
  const blocked = Boolean(user?.id && (needsInitialCheck || checking || checkError || pending));

  useEffect(() => {
    if (!blocked) return;
    const root = document.getElementById('root');
    const previousAriaHidden = root?.getAttribute('aria-hidden');
    const wasInert = root?.hasAttribute('inert') || false;
    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return event.preventDefault();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keepFocusInside, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', keepFocusInside, true);
      if (!wasInert) root?.removeAttribute('inert');
      if (previousAriaHidden === null) root?.removeAttribute('aria-hidden');
      else root?.setAttribute('aria-hidden', previousAriaHidden);
    };
  }, [blocked]);

  useEffect(() => {
    if (!pending) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (dialling.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [pending]);

  const copy = async () => {
    if (!reveal) return;
    try {
      await navigator.clipboard.writeText(reveal.phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError('Copying is blocked here. Select the number and copy it manually.');
    }
  };

  const canSubmit = Boolean(outcome) &&
    (outcome !== 'DECLINED' || Boolean(reason)) &&
    (reason !== 'LOCATION_FAR' || Boolean(detail)) &&
    (reason !== 'OTHER' || Boolean(note.trim()));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      await api.reportCall(pending.request_id, {
        reveal_id: pending.reveal_id,
        outcome,
        reason: outcome === 'DECLINED' ? reason : undefined,
        detail: outcome === 'DECLINED' && reason === 'LOCATION_FAR' ? detail : undefined,
        note: note.trim() || undefined
      });
      await loadPending();
      announcePendingCall();
    } catch (cause: any) {
      setError(cause?.message || 'We could not save the call outcome. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!blocked) return null;

  return (
    <ModalPortal>
      <div className="dialog-backdrop" role="presentation">
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="call-outcome-title"
          aria-describedby="call-outcome-description"
          className="action-dialog request-gate-dialog call-outcome-dialog"
        >
          {checking || needsInitialCheck ? (
            <div className="py-10 text-center" role="status" aria-live="polite">
              <PhoneCall className="mx-auto h-9 w-9 animate-pulse text-primary" aria-hidden="true" />
              <h2 id="call-outcome-title" className="!mr-0 mt-4 text-xl font-extrabold tracking-tight text-slate-950">Checking unfinished calls…</h2>
              <p id="call-outcome-description" className="mt-2 text-sm text-slate-600">This takes only a moment.</p>
            </div>
          ) : checkError ? (
            <div className="py-6 text-center" role="alert">
              <ShieldAlert className="mx-auto h-10 w-10 text-amber-700" aria-hidden="true" />
              <h2 id="call-outcome-title" className="!mr-0 mt-4 text-xl font-extrabold tracking-tight text-slate-950">We could not check your last call</h2>
              <p id="call-outcome-description" className="mt-2 text-sm leading-6 text-slate-600">
                Drop must confirm that no call report is waiting before the rest of the site can be used.
              </p>
              <p className="mt-3 text-sm font-semibold text-red-700">{checkError}</p>
              <button type="button" onClick={() => void loadPending(true)} className="primary-button mx-auto mt-5">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
              </button>
            </div>
          ) : pending ? (
            <form onSubmit={submit}>
              <span className="dialog-icon"><PhoneCall className="h-6 w-6" aria-hidden="true" /></span>
              <h2 id="call-outcome-title" className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950">How did the call go?</h2>
              <p id="call-outcome-description">
                Save this outcome before using any other part of Drop. The dialog cannot be closed or skipped.
              </p>

              {reveal && (
                <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-slate-950">{reveal.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        {reveal.blood_group} · {reveal.upazila ? `${reveal.upazila}, ` : ''}{reveal.district}
                      </p>
                    </div>
                    <p className="select-all break-all text-xl font-extrabold tracking-wide text-slate-950 tabular-nums">{reveal.phone}</p>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <a href={`tel:${reveal.phone}`} onClick={() => { dialling.current = true; }} className="primary-button">
                      <Phone className="h-4 w-4" aria-hidden="true" /> Call now
                    </a>
                    <button type="button" onClick={copy} className="theme-button">
                      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                      {copied ? 'Copied' : 'Copy number'}
                    </button>
                  </div>
                </div>
              )}

              {reveal?.donor_kind === 'IMPORTED' && reveal.source && (
                <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                  <p className="text-xs font-semibold leading-5 text-amber-900">
                    {reveal.source.organization} published this listing. This person did not sign up with Drop and is not expecting your call. Please call once, be brief, and do not pass the number on.
                  </p>
                </div>
              )}

              {contactError && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{contactError}</div>}

              <fieldset className="mt-5">
                <legend className="text-sm font-extrabold text-slate-800">What happened?</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {OUTCOMES.map(option => (
                    <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 has-[:checked]:border-primary has-[:checked]:bg-rose-50">
                      <input type="radio" name="outcome" value={option.value} checked={outcome === option.value} onChange={() => { setOutcome(option.value); setReason(''); setDetail(''); }} className="h-4 w-4" />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {outcome === 'DECLINED' && (
                <fieldset className="fade-in mt-5 border-l-2 border-slate-200 pl-4">
                  <legend className="text-sm font-extrabold text-slate-800">Why not?</legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {DECLINE_REASONS.map(option => (
                      <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 has-[:checked]:border-primary has-[:checked]:bg-rose-50">
                        <input type="radio" name="reason" value={option.value} checked={reason === option.value} onChange={() => { setReason(option.value); setDetail(''); }} className="h-4 w-4" />
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
                        <input type="radio" name="detail" value={option.value} checked={detail === option.value} onChange={() => setDetail(option.value)} className="h-4 w-4" />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-extrabold text-slate-800">Anything to add? {reason === 'OTHER' ? '(required)' : '(optional)'}</span>
                <textarea value={note} onChange={event => setNote(event.target.value)} maxLength={300} rows={3} className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium outline-none focus:border-primary" />
              </label>

              {error && <div role="alert" className="alert alert-error mt-4">{error}</div>}

              <div className="sticky bottom-0 mt-6 border-t border-slate-200 bg-white/95 pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur">
                <button type="submit" disabled={!canSubmit || busy} className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-60">
                  {busy ? 'Saving…' : 'Save outcome and continue'}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </ModalPortal>
  );
}
