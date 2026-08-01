import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { HeartPulse, ShieldCheck, X } from 'lucide-react';
import DonationExperienceFields from '../DonationExperienceFields';
import { api } from '../../lib/api';
import { BLOOD_GROUPS } from '../../lib/blood';
import {
  donationExperienceDraft,
  donationExperiencePayload,
  validateDonationExperience,
  type DonationExperienceDraft
} from '../../lib/donation';
import { getLocationByName } from '../../lib/locations';
import { getUpazilasForDistrict } from '../../lib/upazilas';
import type { NeededWindow, SearchDraft } from '../../lib/searchDraft';

type Step = 'details' | 'phone' | 'code' | 'password' | 'signup';

const NEEDED_WINDOWS: Array<{ value: NeededWindow; label: string }> = [
  { value: 'WITHIN_HOURS', label: 'Within hours' },
  { value: 'TODAY', label: 'Today' },
  { value: 'WITHIN_2_3_DAYS', label: 'In 2 to 3 days' },
  { value: 'PLANNED', label: 'Planned, later this week' }
];

/**
 * Everything between "show me this number" and actually having it: the patient
 * details, which double as the published request, and the sign-in that ties the
 * request to a phone number somebody has proven they control.
 *
 * It is one dialog rather than a separate login page so the requester never
 * loses the form they were filling in. Built on the shared dialog classes,
 * which already become a full-width bottom sheet under 640px.
 */
export default function RequestGate({
  draft,
  onDraftChange,
  user,
  onClose,
  onReady,
  donorName
}: {
  draft: SearchDraft;
  onDraftChange: (next: SearchDraft) => void;
  user: any;
  onClose: () => void;
  /** Called once a session exists and the details are complete. */
  onReady: () => Promise<void>;
  donorName: string;
}) {
  const [step, setStep] = useState<Step>('details');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [accountName, setAccountName] = useState('');
  const [donorGroup, setDonorGroup] = useState('');
  const [donorUpazila, setDonorUpazila] = useState('');
  const [donationExperience, setDonationExperience] = useState<DonationExperienceDraft>(() => donationExperienceDraft());
  const [donorAge, setDonorAge] = useState('');
  const [donorWeight, setDonorWeight] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  const upazilas = useMemo(() => getUpazilasForDistrict(draft.district), [draft.district]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (patch: Partial<SearchDraft>) => onDraftChange({ ...draft, ...patch });

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause: any) {
      setError(cause?.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitDetails = (event: FormEvent) => {
    event.preventDefault();
    if (!consent) return setError('Confirm you may share these details before continuing.');
    setError('');
    // Already signed in: nothing left to verify, publish and reveal.
    if (user) return void run(onReady);
    setStep('phone');
  };

  const sendCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.requestOtp(phone, 'SIGN_IN');
      setStep('code');
    });
  };

  const verifyCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await api.verifyOtp(phone, 'SIGN_IN', code);
      setToken(result.verification_token);
      setAccountName(result.name || '');
      if (result.account_exists) {
        // Signing in with the code they just entered is enough. The password
        // is offered as an alternative, not required.
        await api.otpLogin(phone, result.verification_token);
        await onReady();
        return;
      }
      setStep('signup');
    });
  };

  const signInWithPassword = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.login(phone, password);
      await onReady();
    });
  };

  const completeSignup = (event: FormEvent) => {
    event.preventDefault();
    const donationError = donorGroup ? validateDonationExperience(donationExperience) : null;
    if (donationError) return setError(donationError);
    void run(async () => {
      const location = donorGroup ? getLocationByName(draft.district) : null;
      const donationDetails = donorGroup ? donationExperiencePayload(donationExperience) : {};
      await api.register(
        phone,
        name,
        password,
        token,
        donorGroup || undefined,
        location || undefined,
        {
          upazila: donorGroup && donorUpazila ? donorUpazila : undefined,
          age: donorGroup && donorAge ? Number(donorAge) : undefined,
          weight_kg: donorGroup && donorWeight ? Number(donorWeight) : undefined,
          ...donationDetails
        }
      );
      await onReady();
    });
  };

  const role = draft.requester_role;

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="request-gate-title">
      <div className="action-dialog">
        <button ref={closeRef} type="button" onClick={onClose} className="icon-button dialog-close" aria-label="Close">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="dialog-icon">
          {step === 'details' ? <HeartPulse className="h-6 w-6" aria-hidden="true" /> : <ShieldCheck className="h-6 w-6" aria-hidden="true" />}
        </span>

        {step === 'details' && (
          <form onSubmit={submitDetails}>
            <h2 id="request-gate-title">Who needs the blood?</h2>
            <p>
              {donorName} and the other donors see this as your request. Contact numbers open once
              these details are saved.
            </p>

            <div className="mt-2 grid gap-x-4 sm:grid-cols-2">
              <label className="dialog-field">
                <span>Title</span>
                <select required value={draft.patient_title} onChange={event => set({ patient_title: event.target.value as 'MR' | 'MST' })} className="input">
                  <option value="">Select</option>
                  <option value="MR">Mr.</option>
                  <option value="MST">Mst.</option>
                </select>
              </label>
              <label className="dialog-field">
                <span>Patient age</span>
                <input required type="number" inputMode="numeric" min={1} max={120} value={draft.patient_age} onChange={event => set({ patient_age: event.target.value })} className="input" />
              </label>
              <label className="dialog-field sm:col-span-2">
                <span>Patient name</span>
                <input required value={draft.patient_name} onChange={event => set({ patient_name: event.target.value })} className="input" />
              </label>

              {role !== 'PATIENT' && (
                <label className="dialog-field sm:col-span-2">
                  <span>Your name</span>
                  <input required value={draft.requester_name} onChange={event => set({ requester_name: event.target.value })} className="input" />
                </label>
              )}

              {role === 'RELATIVE' && (
                <label className="dialog-field sm:col-span-2">
                  <span>Your relationship to the patient</span>
                  <input required placeholder="Brother, daughter, uncle..." value={draft.requester_relation} onChange={event => set({ requester_relation: event.target.value })} className="input" />
                </label>
              )}

              {role === 'THIRD_PARTY' && (
                <>
                  <label className="dialog-field sm:col-span-2">
                    <span>Whose number should donors also get?</span>
                    <select required value={draft.contact_owner} onChange={event => set({ contact_owner: event.target.value as 'PATIENT' | 'RELATIVE' })} className="input">
                      <option value="">Select</option>
                      <option value="PATIENT">The patient's number</option>
                      <option value="RELATIVE">A relative's number</option>
                    </select>
                  </label>
                  <label className="dialog-field">
                    <span>That number</span>
                    <input required type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={draft.contact_phone} onChange={event => set({ contact_phone: event.target.value })} className="input" />
                  </label>
                  {draft.contact_owner === 'RELATIVE' && (
                    <>
                      <label className="dialog-field">
                        <span>Relative's name</span>
                        <input required value={draft.contact_name} onChange={event => set({ contact_name: event.target.value })} className="input" />
                      </label>
                      <label className="dialog-field sm:col-span-2">
                        <span>Their relationship to the patient</span>
                        <input required placeholder="Brother, daughter, uncle..." value={draft.requester_relation} onChange={event => set({ requester_relation: event.target.value })} className="input" />
                      </label>
                    </>
                  )}
                </>
              )}

              <label className="dialog-field sm:col-span-2">
                <span>When is it needed? (optional)</span>
                <select value={draft.needed_window} onChange={event => set({ needed_window: event.target.value as NeededWindow })} className="input">
                  <option value="">As soon as possible</option>
                  {NEEDED_WINDOWS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            <label className="mt-4 flex items-start gap-3 text-sm font-semibold leading-6 text-slate-700">
              <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
              <span>
                I may share these details, and I understand donor numbers are for this request only and
                must not be reshared.
              </span>
            </label>

            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={onClose} className="button button-secondary">Cancel</button>
              <button type="submit" disabled={busy} className="button button-primary">
                {busy ? 'Saving...' : user ? 'Publish and get the number' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {step === 'phone' && (
          <form onSubmit={sendCode}>
            <h2 id="request-gate-title">Your phone number</h2>
            <p>
              Donors call this number back. We send a code to confirm it is yours, and sign you in if
              you already have an account.
            </p>
            <label className="dialog-field">
              <span>Bangladesh mobile number</span>
              <input required autoFocus type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={event => setPhone(event.target.value)} className="input" />
            </label>
            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setStep('details')} className="button button-secondary">Back</button>
              <button type="submit" disabled={busy} className="button button-primary">{busy ? 'Sending...' : 'Send code'}</button>
            </div>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verifyCode}>
            <h2 id="request-gate-title">Enter the code</h2>
            <p>We sent a six-digit code to {phone}.</p>
            <label className="dialog-field">
              <span>Verification code</span>
              <input required autoFocus inputMode="numeric" pattern="\d{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} className="input tracking-[0.4em]" />
            </label>
            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setStep('phone')} className="button button-secondary">Change number</button>
              <button type="submit" disabled={busy} className="button button-primary">{busy ? 'Checking...' : 'Verify'}</button>
            </div>
            <button type="button" onClick={() => setStep('password')} className="mt-3 text-sm font-bold text-primary underline">
              I have a password instead
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={signInWithPassword}>
            <h2 id="request-gate-title">Sign in{accountName ? `, ${accountName}` : ''}</h2>
            <p>Use the password on your Drop account for {phone}.</p>
            <label className="dialog-field">
              <span>Password</span>
              <input required autoFocus type="password" value={password} onChange={event => setPassword(event.target.value)} className="input" />
            </label>
            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setStep('code')} className="button button-secondary">Use a code</button>
              <button type="submit" disabled={busy} className="button button-primary">{busy ? 'Signing in...' : 'Sign in'}</button>
            </div>
          </form>
        )}

        {step === 'signup' && (
          <form onSubmit={completeSignup}>
            <h2 id="request-gate-title">Finish your account</h2>
            <p>
              This number is new here. A short account keeps your request together and lets donors
              reach you back.
            </p>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <label className="dialog-field sm:col-span-2">
                <span>Your name</span>
                <input required autoFocus value={name} onChange={event => setName(event.target.value)} className="input" />
              </label>
              <label className="dialog-field sm:col-span-2">
                <span>Password (at least 8 characters)</span>
                <input required type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} className="input" />
              </label>
              <label className="dialog-field">
                <span>Your blood group (optional)</span>
                <select value={donorGroup} onChange={event => setDonorGroup(event.target.value)} className="input">
                  <option value="">Prefer not to say</option>
                  {BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
                </select>
              </label>
              {donorGroup && (
                <>
                  <label className="dialog-field">
                    <span>Your upazila (optional)</span>
                    <select value={donorUpazila} onChange={event => setDonorUpazila(event.target.value)} className="input">
                      <option value="">Not set</option>
                      {upazilas.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="dialog-field">
                    <span>Your age (optional)</span>
                    <input type="number" inputMode="numeric" min={16} max={70} value={donorAge} onChange={event => setDonorAge(event.target.value)} className="input" />
                  </label>
                  <label className="dialog-field sm:col-span-2">
                    <span>Your weight in kg (optional)</span>
                    <input type="number" inputMode="numeric" min={30} max={200} value={donorWeight} onChange={event => setDonorWeight(event.target.value)} className="input" />
                  </label>
                  <DonationExperienceFields
                    idPrefix="request-signup"
                    value={donationExperience}
                    onChange={setDonationExperience}
                    optional
                    className="mt-4 sm:col-span-2"
                  />
                </>
              )}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Giving your blood group does not put you on the donor list. You stay unlisted until you
              turn availability on from your profile.
            </p>
            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setStep('phone')} className="button button-secondary">Back</button>
              <button type="submit" disabled={busy} className="button button-primary">{busy ? 'Creating...' : 'Create and continue'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
