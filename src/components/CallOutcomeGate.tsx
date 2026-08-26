import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, Info, Phone, PhoneCall, RefreshCw, ShieldAlert } from 'lucide-react';
import { useLocation } from 'react-router';
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
  { value: 'CALL_BACK_LATER', label: 'The donor asked me to call back later' },
  { value: 'NOT_CALLED', label: "I didn't call" },
  { value: 'NO_ANSWER', label: "The donor didn't pick up" },
  { value: 'UNREACHABLE', label: 'The phone was switched off or unreachable' },
  { value: 'WRONG_NUMBER', label: 'Wrong or invalid number' },
  { value: 'DECLINED', label: "The donor doesn't want to donate" }
];

const DECLINE_REASONS = [
  { value: 'RECENTLY_DONATED', label: 'Recently donated' },
  { value: 'LOCATION_FAR', label: 'Location is far away' },
  { value: 'DONOR_ILL', label: 'The donor is ill' },
  { value: 'UNAVAILABLE', label: 'Not available right now' },
  { value: 'OTHER', label: 'Another reason' },
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
            <form onSubmit={submit} className="call-outcome-form">
              <div className="call-outcome-scroll">
                <header className="call-outcome-header">
                  <span className="dialog-icon"><PhoneCall className="h-5 w-5" aria-hidden="true" /></span>
                  <div>
                    <span className="call-outcome-kicker">One quick update</span>
                    <h2 id="call-outcome-title">How did the call go?</h2>
                    <p id="call-outcome-description">Choose what happened so you can continue using Drop.</p>
                  </div>
                </header>

                {reveal && (
                  <section className="call-contact-card" aria-label="Donor contact">
                    <div className="call-contact-identity">
                      <div>
                        <p>{reveal.name}</p>
                        <span>{reveal.blood_group} · {reveal.upazila ? `${reveal.upazila}, ` : ''}{reveal.district}</span>
                      </div>
                      <a href={`tel:${reveal.phone}`} onClick={() => { dialling.current = true; }} className="call-contact-number">
                        {reveal.phone}
                      </a>
                    </div>
                    <div className="call-contact-actions">
                      <a href={`tel:${reveal.phone}`} onClick={() => { dialling.current = true; }} className="call-contact-action is-primary">
                        <Phone className="h-4 w-4" aria-hidden="true" /> Call now
                      </a>
                      <button type="button" onClick={copy} className="call-contact-action">
                        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </section>
                )}

                {reveal?.donor_kind === 'IMPORTED' && reveal.source && (
                  <aside className="call-source-note">
                    <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>
                      Listed by {reveal.source.organization}, not directly by this donor. Call once, keep it brief, and do not share the number.
                    </p>
                  </aside>
                )}

                {contactError && <div role="status" className="call-contact-error">{contactError}</div>}

                <fieldset className="call-outcome-section">
                  <legend>What happened?</legend>
                  <div className="call-outcome-options">
                    {OUTCOMES.map(option => (
                      <label key={option.value} className="call-outcome-option">
                        <input type="radio" name="outcome" value={option.value} checked={outcome === option.value} onChange={() => { setOutcome(option.value); setReason(''); setDetail(''); }} />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {outcome === 'DECLINED' && (
                  <fieldset className="call-outcome-followup fade-in">
                    <legend>Why not?</legend>
                    <div className="call-outcome-options">
                      {DECLINE_REASONS.map(option => (
                        <label key={option.value} className="call-outcome-option">
                          <input type="radio" name="reason" value={option.value} checked={reason === option.value} onChange={() => { setReason(option.value); setDetail(''); }} />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                {outcome === 'DECLINED' && reason === 'LOCATION_FAR' && (
                  <fieldset className="call-outcome-followup fade-in">
                    <legend>What made the location difficult?</legend>
                    <div className="call-outcome-options is-single-column">
                      {FAR_DETAILS.map(option => (
                        <label key={option.value} className="call-outcome-option">
                          <input type="radio" name="detail" value={option.value} checked={detail === option.value} onChange={() => setDetail(option.value)} />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                {outcome && (
                  <label className="call-outcome-note fade-in">
                    <span>Anything to add? <small>{reason === 'OTHER' ? 'Required' : 'Optional'}</small></span>
                    <textarea value={note} onChange={event => setNote(event.target.value)} maxLength={300} rows={2} placeholder="Add a short note" />
                  </label>
                )}

                {error && <div role="alert" className="alert alert-error mt-4">{error}</div>}
              </div>

              <footer className="call-outcome-footer">
                <p>{outcome ? 'Your answer helps keep donor information reliable.' : 'Select one answer to continue.'}</p>
                <button type="submit" disabled={!canSubmit || busy} className="primary-button disabled:cursor-not-allowed disabled:opacity-60">
                  {busy ? 'Saving…' : 'Save and continue'}
                </button>
              </footer>
            </form>
          ) : null}
        </div>
      </div>
    </ModalPortal>
  );
}
