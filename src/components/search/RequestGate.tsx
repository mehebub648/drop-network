import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { HeartPulse, ShieldCheck, X } from 'lucide-react';
import DonorAvailabilityFields, { type RegistrationAvailability } from '../DonorAvailabilityFields';
import OtpDeliveryStatus from '../OtpDeliveryStatus';
import { api, type OtpDelivery } from '../../lib/api';
import { BLOOD_GROUPS } from '../../lib/blood';
import { BD_LOCATION_NAMES, getLocationByName } from '../../lib/locations';
import { getUpazilasForDistrict } from '../../lib/upazilas';
import {
  hasPatientDetails,
  hasRequesterDetails,
  type BloodComponent,
  type NeededWindow,
  type RequestReason,
  type SearchDraft
} from '../../lib/searchDraft';
import ModalPortal from '../ModalPortal';
import RequesterRolePicker from './RequesterRolePicker';

type RequestStep = 'patient' | 'requester' | 'review';
type Step = 'role' | RequestStep | 'phone' | 'code' | 'password' | 'signup' | 'signup-donor';

const NEEDED_WINDOWS: Array<{ value: NeededWindow; label: string }> = [
  { value: 'WITHIN_HOURS', label: 'Within hours' },
  { value: 'TODAY', label: 'Today' },
  { value: 'WITHIN_2_3_DAYS', label: 'In 2 to 3 days' },
  { value: 'PLANNED', label: 'Planned, later this week' }
];

const BLOOD_COMPONENTS: Array<{ value: BloodComponent; label: string }> = [
  { value: 'WHOLE_BLOOD', label: 'Whole blood' },
  { value: 'RED_CELLS', label: 'Red cells' },
  { value: 'PLATELETS', label: 'Platelets' },
  { value: 'PLASMA', label: 'Plasma' }
];

const REQUEST_REASONS: Array<{ value: RequestReason; label: string }> = [
  { value: 'SURGERY', label: 'Surgery' },
  { value: 'ACCIDENT_BLEEDING', label: 'Accident or bleeding' },
  { value: 'CHILDBIRTH', label: 'Childbirth' },
  { value: 'ANAEMIA', label: 'Anaemia' },
  { value: 'THALASSEMIA', label: 'Thalassemia' },
  { value: 'CANCER_TREATMENT', label: 'Cancer treatment' },
  { value: 'OTHER', label: 'Other medical need' }
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
  onEditSearch,
  onReady
}: {
  draft: SearchDraft;
  onDraftChange: (next: SearchDraft) => void;
  user: any;
  onClose: () => void;
  onEditSearch: () => void;
  /** Called once a session exists and the details are complete. */
  onReady: () => Promise<void>;
}) {
  const [step, setStep] = useState<Step>(() => {
    if (!draft.requester_role) return 'role';
    if (!hasPatientDetails(draft)) return 'patient';
    if (!hasRequesterDetails(draft, user?.phone)) return 'requester';
    return 'review';
  });
  const [roleReturnStep, setRoleReturnStep] = useState<RequestStep>('patient');
  const [phone, setPhone] = useState(() => draft.requester_phone || user?.phone || '');
  const [code, setCode] = useState('');
  const [delivery, setDelivery] = useState<OtpDelivery | null>(null);
  const [password, setPassword] = useState('');
  const [name, setName] = useState(() => draft.requester_role === 'PATIENT' ? draft.patient_name : draft.requester_name);
  const [token, setToken] = useState('');
  const [accountName, setAccountName] = useState('');
  const [donorGroup, setDonorGroup] = useState('');
  const [donorDistrict, setDonorDistrict] = useState(() => draft.district);
  const [donorUpazila, setDonorUpazila] = useState(() => draft.upazila);
  const [donorAvailability, setDonorAvailability] = useState<RegistrationAvailability>('');
  const [availabilityReason, setAvailabilityReason] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const donorUpazilas = useMemo(() => getUpazilasForDistrict(donorDistrict), [donorDistrict]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
  }, [user?.phone]);

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

  const submitPatient = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setStep('requester');
  };

  const submitRequester = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setStep('review');
  };

  const submitReview = (event: FormEvent) => {
    event.preventDefault();
    if (!hasPatientDetails(draft)) return setStep('patient');
    if (!hasRequesterDetails(draft, user?.phone)) return setStep('requester');
    if (!consent) return setError('Confirm you may share these details before continuing.');
    setError('');
    if (!name.trim()) setName(role === 'PATIENT' ? draft.patient_name : draft.requester_name);
    // Already signed in: nothing left to verify, publish and reveal.
    if (user) return void run(onReady);
    setPhone(draft.requester_phone);
    setStep('phone');
  };

  const submitRole = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.requester_role) return setError('Choose how you are helping with this request.');
    setError('');
    setStep(roleReturnStep === 'review' && !hasRequesterDetails(draft, user?.phone) ? 'requester' : roleReturnStep);
  };

  const continueAfterVerification = async (result: any) => {
    setToken(result.verification_token);
    setAccountName(result.name || '');
    if (result.account_exists) {
      // Signing in with the verified or explicitly bypassed challenge is
      // enough. Password login remains available when OTP mode is active.
      await api.otpLogin(phone, result.verification_token);
      await onReady();
      return;
    }
    setStep('signup');
  };

  const sendCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await api.requestOtp(phone, 'SIGN_IN');
      setDelivery(result);
      setCode('');
      if (result.bypass && result.verification_token) {
        await continueAfterVerification(result);
      } else {
        setStep('code');
      }
    });
  };

  const verifyCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await api.verifyOtp(phone, 'SIGN_IN', code);
      await continueAfterVerification(result);
    });
  };

  const signInWithPassword = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.login(phone, password);
      await onReady();
    });
  };

  const registerAccount = () => {
    if (!donorGroup) return setError('Choose your blood group to create your donor profile.');
    if (!donorDistrict) return setError('Choose the district where you live.');
    if (!donorUpazila || !donorUpazilas.some(item => item.value === donorUpazila)) return setError('Choose your home upazila.');
    if (!donorAvailability) return setError('Choose whether you are available to donate.');
    void run(async () => {
      const location = getLocationByName(donorDistrict);
      if (!location) throw new Error('Choose a supported district.');
      await api.register(
        phone,
        name,
        password,
        token,
        donorGroup,
        location,
        {
          upazila: donorUpazila,
          availability_status: donorAvailability,
          availability_reason: donorAvailability === 'NOT_AVAILABLE' ? availabilityReason : undefined
        }
      );
      await onReady();
    });
  };

  const submitSignup = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!donorGroup) return setError('Choose your blood group to create your donor profile.');
    setStep('signup-donor');
  };

  const completeSignup = (event: FormEvent) => {
    event.preventDefault();
    registerAccount();
  };

  const role = draft.requester_role;
  const roleLabel = role === 'PATIENT'
    ? "I'm the patient"
    : role === 'RELATIVE'
      ? "I'm the patient's relative"
      : "I'm a third-party volunteer";
  const patientLabel = `${draft.patient_title === 'MR' ? 'Mr.' : 'Mst.'} ${draft.patient_name}`.trim();
  const neededWindowLabel = NEEDED_WINDOWS.find(option => option.value === draft.needed_window)?.label || 'As soon as possible';
  const componentLabel = BLOOD_COMPONENTS.find(option => option.value === draft.blood_component)?.label || '';
  const reasonLabel = REQUEST_REASONS.find(option => option.value === draft.request_reason)?.label || '';
  const accountPhone = user?.phone || draft.requester_phone;
  const requestOwnerName = role === 'PATIENT' ? patientLabel : draft.requester_name;
  const contactLabel = role === 'PATIENT'
    ? patientLabel
    : role === 'RELATIVE'
      ? `${draft.requester_name} · ${draft.requester_relation}`
      : draft.contact_owner === 'RELATIVE'
        ? `${draft.contact_name} · ${draft.requester_relation}`
        : `${draft.patient_name} · Patient`;
  const donorContactPhone = role === 'THIRD_PARTY' ? draft.contact_phone : accountPhone;
  const editRole = (returnStep: RequestStep) => {
    setRoleReturnStep(returnStep);
    setError('');
    setStep('role');
  };

  const changeRequesterRole = (requesterRole: SearchDraft['requester_role']) => {
    const next: Partial<SearchDraft> = { requester_role: requesterRole };
    if (requesterRole === 'PATIENT' && draft.requester_role !== 'PATIENT') {
      next.requester_phone = '';
      setPhone(user?.phone || '');
    } else if (requesterRole !== 'PATIENT' && user?.phone) {
      setPhone(user.phone);
    }
    set(next);
  };

  const updateVerificationPhone = (value: string) => {
    setPhone(value);
    setDelivery(null);
    setCode('');
    if (!user) set({ requester_phone: value });
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="request-gate-title">
        <div className="action-dialog request-gate-dialog">
          <button ref={closeRef} type="button" onClick={onClose} className="icon-button dialog-close" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="dialog-icon">
            {step === 'role' || step === 'patient' || step === 'requester' || step === 'review' ? <HeartPulse className="h-6 w-6" aria-hidden="true" /> : <ShieldCheck className="h-6 w-6" aria-hidden="true" />}
          </span>

        {step === 'role' && (
          <form onSubmit={submitRole} className="fade-in">
            <h2 id="request-gate-title">How are you helping?</h2>
            <p>Choose the role that best describes you for this request. You can change it again before publishing.</p>
            <RequesterRolePicker
              value={draft.requester_role}
              onChange={changeRequesterRole}
              hideLegend
              className="mt-5"
            />
            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setStep(roleReturnStep)} className="button button-secondary">Back</button>
              <button type="submit" className="button button-primary">Save role</button>
            </div>
          </form>
        )}

        {step === 'patient' && (
          <form onSubmit={submitPatient} className="fade-in">
            <h2 id="request-gate-title">{role === 'PATIENT' ? 'Your patient details' : 'Patient details'}</h2>
            {role !== 'PATIENT' && <p>Enter the patient’s information, not your own.</p>}

            <div className="request-context-summary">
              <span>
                <small>Already provided</small>
                <strong>{draft.blood_group} · {draft.upazila}, {draft.district}</strong>
                <span>{draft.collection_facility}</span>
              </span>
              <button type="button" onClick={onEditSearch}>Change search</button>
            </div>

            <div className="requester-role-summary">
              <span>
                <small>Who you are</small>
                <strong>{roleLabel}</strong>
              </span>
              <button type="button" onClick={() => editRole('patient')}>Change</button>
            </div>

            <div className="mt-2 grid gap-x-4 sm:grid-cols-2">
              <label className="dialog-field">
                <span>Patient title</span>
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
                <span>Patient full name</span>
                <input required value={draft.patient_name} onChange={event => set({ patient_name: event.target.value })} className="input" />
              </label>
              <label className="dialog-field">
                <span>Blood component</span>
                <select required value={draft.blood_component} onChange={event => set({ blood_component: event.target.value as BloodComponent })} className="input">
                  <option value="">Select</option>
                  {BLOOD_COMPONENTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="dialog-field">
                <span>Units needed</span>
                <input required type="number" inputMode="numeric" min={1} max={20} value={draft.units_required} onChange={event => set({ units_required: event.target.value })} className="input" />
              </label>
              <label className="dialog-field sm:col-span-2">
                <span>Reason blood is needed</span>
                <select required value={draft.request_reason} onChange={event => set({ request_reason: event.target.value as RequestReason })} className="input">
                  <option value="">Select</option>
                  {REQUEST_REASONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={onClose} className="button button-secondary">Cancel</button>
              <button type="submit" className="button button-primary">Continue</button>
            </div>
          </form>
        )}

        {step === 'requester' && (
          <form onSubmit={submitRequester} className="fade-in">
            <h2 id="request-gate-title">People and contacts</h2>
            <p>Keep the person managing the request separate from the patient or relative whom donors should call.</p>

            <div className="requester-role-summary">
              <span>
                <small>Who you are</small>
                <strong>{roleLabel}</strong>
              </span>
              <button type="button" onClick={() => editRole('requester')}>Change</button>
            </div>

            <div className="grid gap-x-4 sm:grid-cols-2">
              <div className="request-data-section sm:col-span-2">
                <strong>Your account details</strong>
                <span>{role === 'PATIENT' ? 'Your patient name is already saved. Confirm the mobile number you use to own and manage this request.' : 'Enter your own information. Drop uses it to verify you and let you manage this request.'}</span>
              </div>

              {role !== 'PATIENT' && (
                <label className="dialog-field sm:col-span-2">
                  <span>Your full name (request owner)</span>
                  <input required value={draft.requester_name} onChange={event => set({ requester_name: event.target.value })} className="input" />
                </label>
              )}

              {role !== 'PATIENT' && !user && (
                <label className="dialog-field sm:col-span-2">
                  <span>Your mobile number (request owner)</span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    placeholder="01XXXXXXXXX"
                    value={draft.requester_phone}
                    onChange={event => updateVerificationPhone(event.target.value)}
                    className="input"
                  />
                </label>
              )}

              {role === 'PATIENT' && !user && (
                <label className="dialog-field sm:col-span-2">
                  <span>Your mobile number (patient and request owner)</span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    placeholder="01XXXXXXXXX"
                    value={draft.requester_phone}
                    onChange={event => updateVerificationPhone(event.target.value)}
                    className="input"
                  />
                </label>
              )}

              {user?.phone && (
                <div className="request-context-summary sm:col-span-2">
                  <span>
                    <small>Your verified account contact</small>
                    <strong>{user.phone}</strong>
                    <span>You are already signed in, so we will not ask for this again.</span>
                  </span>
                </div>
              )}

              {role === 'RELATIVE' && (
                <>
                  <label className="dialog-field sm:col-span-2">
                    <span>Your relationship to the patient</span>
                    <input required placeholder="Brother, daughter, uncle..." value={draft.requester_relation} onChange={event => set({ requester_relation: event.target.value })} className="input" />
                  </label>
                  <div className="request-data-section is-contact sm:col-span-2" role="note">
                    <strong>Donor contact</strong>
                    <span>Your verified mobile number will appear on the active request so donors can call immediately.</span>
                  </div>
                </>
              )}

              {role === 'PATIENT' && (
                <div className="request-data-section is-contact sm:col-span-2" role="note">
                  <strong>Donor contact</strong>
                  <span>You selected “I’m the patient,” so this verified number will appear on the active request for donor calls.</span>
                </div>
              )}

              {role === 'THIRD_PARTY' && (
                <>
                  <div className="request-data-section is-contact sm:col-span-2">
                    <strong>Donor contact</strong>
                    <span>Enter the patient or relative whom donors should call. This number will appear publicly while the request is active.</span>
                  </div>
                  <label className="dialog-field sm:col-span-2">
                    <span>Whose patient-side number should donors get?</span>
                    <select required value={draft.contact_owner} onChange={event => set({ contact_owner: event.target.value as 'PATIENT' | 'RELATIVE' })} className="input">
                      <option value="">Select</option>
                      <option value="PATIENT">The patient's number</option>
                      <option value="RELATIVE">A relative's number</option>
                    </select>
                  </label>
                  <label className="dialog-field">
                    <span>{draft.contact_owner === 'RELATIVE' ? "Relative's contact number" : "Patient's contact number"}</span>
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
            </div>

            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setStep('patient')} className="button button-secondary">Back</button>
              <button type="submit" className="button button-primary">Continue</button>
            </div>
          </form>
        )}

        {step === 'review' && (
          <form onSubmit={submitReview} className="fade-in">
            <h2 id="request-gate-title">Review the request</h2>
            <p>We kept everything you already provided. Check it, change anything that is wrong, then publish.</p>

            <div className="request-context-summary">
              <span>
                <small>Search details</small>
                <strong>{draft.blood_group} · {draft.upazila}, {draft.district}</strong>
                <span>{draft.collection_facility}</span>
              </span>
              <button type="button" onClick={onEditSearch}>Change</button>
            </div>

            <div className="request-review-grid">
              <div className="request-review-card">
                <span><small>Patient</small><strong>{patientLabel}</strong><span>Age {draft.patient_age}</span></span>
                <button type="button" onClick={() => setStep('patient')}>Change</button>
              </div>
              <div className="request-review-card">
                <span><small>Blood needed</small><strong>{draft.units_required} unit{draft.units_required === '1' ? '' : 's'} · {componentLabel}</strong><span>{reasonLabel}</span></span>
                <button type="button" onClick={() => setStep('patient')}>Change</button>
              </div>
              <div className="request-review-card">
                <span>
                  <small>Request owner</small>
                  <strong>{requestOwnerName}</strong>
                  <span>{role === 'PATIENT' ? 'Same as patient' : roleLabel} · {accountPhone || 'Mobile number added during verification'}</span>
                </span>
                <button type="button" onClick={() => editRole('review')}>Change role</button>
              </div>
              <div className="request-review-card">
                <span>
                  <small>Donor contact</small>
                  <strong>{contactLabel}</strong>
                  <span>{donorContactPhone || 'Mobile number added during verification'} · Public while this request is active</span>
                </span>
                <button type="button" onClick={() => setStep('requester')}>Change</button>
              </div>
            </div>

            <label className="dialog-field">
              <span>When is it needed? (optional)</span>
              <select value={draft.needed_window} onChange={event => set({ needed_window: event.target.value as NeededWindow })} className="input">
                <option value="">As soon as possible</option>
                {NEEDED_WINDOWS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <p className="request-needed-summary">Current timing: <strong>{neededWindowLabel}</strong></p>

            <label className="mt-4 flex items-start gap-3 text-sm font-semibold leading-6 text-slate-700">
              <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
              <span>
                I may publish these details, including the donor contact number while this request is active.
                I understand donor numbers opened through search are for this request only and must not be reshared.
              </span>
            </label>

            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setStep('requester')} className="button button-secondary">Back</button>
              <button type="submit" disabled={busy} className="button button-primary">
                {busy ? 'Saving...' : user ? 'Publish and get the number' : 'Continue to verification'}
              </button>
            </div>
          </form>
        )}

        {step === 'phone' && (
          <form onSubmit={sendCode}>
            <h2 id="request-gate-title">Verify your contact number</h2>
            <p>
              We use this number for your Drop account and request ownership. It stays separate from
              the patient-side contact you added for donors.
            </p>
            <label className="dialog-field">
              <span>Your Bangladesh mobile number</span>
              <input required autoFocus type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={event => updateVerificationPhone(event.target.value)} className="input" />
            </label>
            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setStep('review')} className="button button-secondary">Back</button>
              <button type="submit" disabled={busy} className="button button-primary">{busy ? 'Sending...' : 'Send code'}</button>
            </div>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verifyCode}>
            <h2 id="request-gate-title">Enter the code</h2>
            <p>We sent a six-digit code to {phone}.</p>
            <OtpDeliveryStatus
              delivery={delivery}
              onDeliveryChange={setDelivery}
              busy={busy}
              onResend={() => void run(async () => {
                const result = await api.requestOtp(phone, 'SIGN_IN');
                setDelivery(result);
                setCode('');
                if (result.bypass && result.verification_token) await continueAfterVerification(result);
              })}
            />
            <label className="dialog-field">
              <span>Verification code</span>
              <input required autoFocus inputMode="numeric" pattern="\d{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} className="input tracking-[0.4em]" />
            </label>
            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={() => { setDelivery(null); setCode(''); setStep('phone'); }} className="button button-secondary">Change number</button>
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
          <form onSubmit={submitSignup}>
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
              <label className="dialog-field sm:col-span-2">
                <span>Your blood group</span>
                <select required value={donorGroup} onChange={event => setDonorGroup(event.target.value)} className="input">
                  <option value="">Choose blood group</option>
                  {BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Every account includes a donor profile. You decide whether it appears in live donor searches next.
            </p>
            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setStep('phone')} className="button button-secondary">Back</button>
              <button type="submit" disabled={busy} className="button button-primary">
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 'signup-donor' && (
          <form onSubmit={completeSignup}>
            <h2 id="request-gate-title">Set your donor availability</h2>
            <p>
              We filled these from your search. Change them if the patient's treatment area is not where you live.
            </p>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <label className="dialog-field">
                <span>Your home district</span>
                <select
                  required
                  value={donorDistrict}
                  onChange={event => {
                    const nextDistrict = event.target.value;
                    setDonorDistrict(nextDistrict);
                    setDonorUpazila(getUpazilasForDistrict(nextDistrict)[0]?.value || '');
                  }}
                  className="input"
                >
                  <option value="">Choose district</option>
                  {BD_LOCATION_NAMES.map(district => <option key={district} value={district}>{district}</option>)}
                </select>
              </label>
              <label className="dialog-field">
                <span>Your home upazila</span>
                <select required value={donorUpazila} onChange={event => setDonorUpazila(event.target.value)} className="input">
                  <option value="">Choose upazila</option>
                  {donorUpazilas.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>
            <DonorAvailabilityFields
              idPrefix="request-signup"
              value={donorAvailability}
              onChange={setDonorAvailability}
              reason={availabilityReason}
              onReasonChange={setAvailabilityReason}
            />
            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setStep('signup')} className="button button-secondary">Back</button>
              <button type="submit" disabled={busy} className="button button-primary">{busy ? 'Creating...' : 'Create profile and continue'}</button>
            </div>
          </form>
        )}
        </div>
      </div>
    </ModalPortal>
  );
}
