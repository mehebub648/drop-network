import GuidedForm from '../components/GuidedForm';
import Select from '../components/Select';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Phone,
  PhoneOff,
  RefreshCw,
  ShieldCheck,
  UserRoundPlus
} from 'lucide-react';
import DonorAvailabilityFields, { type RegistrationAvailability } from '../components/DonorAvailabilityFields';
import OtpDeliveryStatus from '../components/OtpDeliveryStatus';
import { PageHeader, StatusBadge, Surface } from '../components/ui';
import { api, type CompleteClaimProfileInput, type OtpDelivery, type OtpPurpose } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES } from '../lib/locations';
import { getUpazilasForDistrict } from '../lib/upazilas';

type ClaimStub = {
  claim_path: string;
  phone: string;
  name_masked: string;
  address_masked: string;
  has_phone: boolean;
  claim_status: string;
  source: { organization: string };
};

type DirectoryProfile = {
  id: string;
  claim_path: string;
  name: string;
  blood_group: string;
  district: string;
  upazila: string;
  phone_masked: string;
  has_phone: boolean;
  missing_fields: string[];
  source: { organization: string; url: string; scraped_at: string };
};

type ClaimIntent = 'CLAIM' | 'SEPARATE_PROFILE' | 'CHANGE_PHONE';
type Step = 'decision' | 'phone' | 'code' | 'new-phone' | 'new-code' | 'details' | 'done';

const intentCopy: Record<ClaimIntent, { title: string; description: string }> = {
  CLAIM: {
    title: 'This is my profile',
    description: 'Verify the listed number and take control of these details.'
  },
  CHANGE_PHONE: {
    title: 'This is mine, but I use a new number',
    description: 'Verify both the listed number and your new number before anything changes.'
  },
  SEPARATE_PROFILE: {
    title: 'This is not my number',
    description: 'Create your own account. This listing stays unchanged.'
  }
};

export default function ClaimProfilePage({ user, onUpdate }: { user: any; onUpdate: () => Promise<void> | void }) {
  const { slug = '' } = useParams();
  const [claim, setClaim] = useState<ClaimStub | null>(null);
  const [intent, setIntent] = useState<ClaimIntent | null>(null);
  const [step, setStep] = useState<Step>('decision');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [newVerificationToken, setNewVerificationToken] = useState('');
  const [delivery, setDelivery] = useState<OtpDelivery | null>(null);
  const [name, setName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [availability, setAvailability] = useState<RegistrationAvailability>('');
  const [availabilityReason, setAvailabilityReason] = useState('');
  const [consent, setConsent] = useState(false);
  const [password, setPassword] = useState('');
  const [signInPhone, setSignInPhone] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);
  const [result, setResult] = useState('');
  const upazilas = useMemo(() => getUpazilasForDistrict(district), [district]);

  useEffect(() => {
    let active = true;
    void api.getClaimProfile(slug)
      .then((data: ClaimStub) => {
        if (!active) return;
        setClaim(data);
      })
      .catch((cause: any) => active && setError(cause.message || 'This claim link is unavailable.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug]);

  const run = async (action: () => Promise<void>, preserveSignIn = false) => {
    setBusy(true);
    setError('');
    if (!preserveSignIn) setSignInRequired(false);
    try {
      await action();
    } catch (cause: any) {
      if (cause?.data?.sign_in_required === true) setSignInRequired(true);
      setError(cause.message || 'The profile update could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const chooseIntent = (nextIntent: ClaimIntent) => {
    setIntent(nextIntent);
    setStep('phone');
    setPhone(nextIntent === 'SEPARATE_PROFILE' ? (user?.phone || '') : (claim?.phone || ''));
    setNewPhone('');
    setCode('');
    setVerificationToken('');
    setNewVerificationToken('');
    setDelivery(null);
    setPassword('');
    setSignInPhone(claim?.phone || user?.phone || '');
    setSignInPassword('');
    setPasswordRequired(nextIntent === 'SEPARATE_PROFILE');
    setConsent(false);
    setError('');
  };

  const returnToChoices = () => {
    setIntent(null);
    setStep('decision');
    setCode('');
    setVerificationToken('');
    setNewVerificationToken('');
    setDelivery(null);
    setPassword('');
    setSignInPassword('');
    setPasswordRequired(false);
    setConsent(false);
    setError('');
  };

  const primaryPurpose: OtpPurpose = intent === 'SEPARATE_PROFILE' ? 'REGISTER' : 'CLAIM_PROFILE';

  const advanceAfterPrimaryVerification = async (token: string) => {
    if (intent === 'SEPARATE_PROFILE') {
      setStep('details');
      return;
    }
    const response = await api.previewClaimProfile(slug, phone, token);
    const verified = response.profile as DirectoryProfile;
    setName(verified.name || '');
    setBloodGroup(verified.blood_group || '');
    setDistrict(verified.district || '');
    setUpazila(verified.upazila || '');
    setStep(intent === 'CHANGE_PHONE' ? 'new-phone' : 'details');
  };

  const requestCode = (event?: FormEvent) => {
    event?.preventDefault();
    if (!intent) return;
    void run(async () => {
      const response = await api.requestOtp(phone, primaryPurpose);
      setDelivery(response);
      setCode('');
      if (response.bypass && response.verification_token) {
        setVerificationToken(response.verification_token);
        await advanceAfterPrimaryVerification(response.verification_token);
      } else {
        setStep('code');
      }
    });
  };

  const verifyCode = (event: FormEvent) => {
    event.preventDefault();
    if (!intent) return;
    void run(async () => {
      const response = await api.verifyOtp(phone, primaryPurpose, code);
      setVerificationToken(response.verification_token);
      setDelivery(null);
      setCode('');
      await advanceAfterPrimaryVerification(response.verification_token);
    });
  };

  const requestNewCode = (event?: FormEvent) => {
    event?.preventDefault();
    void run(async () => {
      const response = await api.requestOtp(newPhone, 'CHANGE_PHONE');
      setDelivery(response);
      setCode('');
      if (response.bypass && response.verification_token) {
        setNewVerificationToken(response.verification_token);
        setStep('details');
      } else {
        setStep('new-code');
      }
    });
  };

  const verifyNewCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const response = await api.verifyOtp(newPhone, 'CHANGE_PHONE', code);
      setNewVerificationToken(response.verification_token);
      setDelivery(null);
      setCode('');
      setStep('details');
    });
  };

  const completeProfile = async () => {
    if (!intent) return;
    const details = {
      name,
      blood_group: bloodGroup,
      district,
      upazila,
      availability_status: availability as 'AVAILABLE' | 'NOT_AVAILABLE',
      availability_reason: availability === 'NOT_AVAILABLE' ? availabilityReason : undefined,
      availability_consent: true as const
    };
    let body: CompleteClaimProfileInput;
    if (intent === 'CHANGE_PHONE') {
      body = {
        ...details,
        intent,
        listed_phone: phone,
        listed_phone_verification_token: verificationToken,
        phone: newPhone,
        verification_token: newVerificationToken,
        ...(password ? { password } : {})
      };
    } else if (intent === 'SEPARATE_PROFILE') {
      body = { ...details, intent, phone, verification_token: verificationToken, password };
    } else {
      body = { ...details, intent, phone, verification_token: verificationToken, ...(password ? { password } : {}) };
    }

    try {
      const response = await api.completeClaimProfile(slug, body);
      if (response.sign_in_required === true) {
        setSignInRequired(true);
        return;
      }
      setResult(response.result || intent);
      setSignInRequired(false);
      setStep('done');
      await onUpdate();
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes('Create a password with at least 8 characters')) {
        setPasswordRequired(true);
      }
      throw cause;
    }
  };

  const complete = (event: FormEvent) => {
    event.preventDefault();
    if (!consent) return setError('Confirm that these details and availability choice are yours.');
    if (intent === 'SEPARATE_PROFILE' && password.length < 8) return setError('Create a password with at least 8 characters.');
    void run(completeProfile);
  };

  const signInAndComplete = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.login(signInPhone, signInPassword);
      await onUpdate();
      setSignInRequired(false);
      await completeProfile();
    }, true);
  };

  if (loading) return <div className="surface mx-auto h-64 max-w-2xl animate-pulse" aria-label="Loading claim profile" />;
  if (!claim) {
    return (
      <Surface className="mx-auto max-w-2xl p-8 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-950">Claim link unavailable</h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-slate-600">{error || 'This link is invalid, expired, removed, or already claimed.'}</p>
        <Link to="/directory" className="primary-button mt-6">Search for donors</Link>
      </Surface>
    );
  }

  if (step === 'done') {
    const claimed = result === 'CLAIMED' || intent === 'CLAIM';
    const changed = result === 'PHONE_CHANGED' || intent === 'CHANGE_PHONE';
    const followUpToken = sessionStorage.getItem('drop_follow_up_token') || '';
    const nextPath = followUpToken ? `/follow-up#token=${followUpToken}` : '/profile/donor';
    return (
      <Surface className="mx-auto max-w-2xl border-green-200 bg-green-50/60 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-700" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-950">{changed ? 'Your number is updated' : claimed ? 'Profile claimed' : 'Your own profile is ready'}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {changed
            ? 'Both numbers were verified before the listing moved to your new number.'
            : claimed
              ? 'The verified number matched this listing, so it now belongs to your drop. account.'
              : 'Your account was created without changing or claiming the profile from this link.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="theme-button">Done</Link>
          <Link to={nextPath} onClick={() => sessionStorage.removeItem('drop_follow_up_token')} className="primary-button">{followUpToken ? 'Continue donation update' : 'Manage my donor profile'}</Link>
        </div>
      </Surface>
    );
  }

  const phoneStepTitle = intent === 'SEPARATE_PROFILE'
    ? 'Verify your own number'
    : intent === 'CHANGE_PHONE'
      ? 'First, verify the listed number'
      : 'Verify the listed number';
  const phoneStepDescription = intent === 'SEPARATE_PROFILE'
    ? 'This creates your own account and leaves the linked listing exactly as it is.'
    : intent === 'CHANGE_PHONE'
      ? 'The number shown in the listing must be verified before it can be replaced.'
      : 'The number must match this listing before the profile can be claimed.';

  return (
    <div className="mx-auto max-w-3xl space-y-7 pb-12">
      <PageHeader
        eyebrow="Private owner verification"
        title="What would you like to do?"
        description="Choose first. No listing changes until the right phone number is verified."
        icon={UserRoundPlus}
      />

      <Surface className="claim-number-prompt p-5 text-center sm:p-7">
        <StatusBadge tone="brand" icon={ShieldCheck}>Private invitation</StatusBadge>
        <h2 className="mt-5 text-xl font-extrabold text-slate-950">Is this your number?</h2>
        <p className="claim-listed-phone">{claim.phone || 'No phone is attached'}</p>
        <p className="mt-3 text-sm font-bold text-slate-700">{claim.name_masked || 'Name hidden'} · {claim.address_masked || 'Address hidden'}</p>
        <p className="mt-2 text-xs text-slate-500">From {claim.source.organization}. Full profile details appear only after the listed number is verified.</p>
      </Surface>

      {error && <div role="alert" className="alert alert-error">{error}</div>}
      {signInRequired && step === 'details' && (
        <GuidedForm onSubmit={signInAndComplete} className="surface space-y-4 border-violet-200 p-6 sm:p-8">
          <StatusBadge tone="brand" icon={KeyRound}>Your profile already has an account</StatusBadge>
          <h2 className="text-xl font-extrabold text-slate-950">Sign in to finish safely</h2>
          <p className="text-sm leading-6 text-slate-600">Your phone proofs and edits are still here. Password sign-in confirms the existing account before we save anything.</p>
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Account phone</span><input required type="tel" inputMode="tel" autoComplete="username" value={signInPhone} onChange={event => setSignInPhone(event.target.value)} className="input" /></label>
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Password</span><input required type="password" autoComplete="current-password" value={signInPassword} onChange={event => setSignInPassword(event.target.value)} className="input" /></label>
          <div className="flex flex-wrap items-center gap-3"><button disabled={busy} className="primary-button">{busy ? 'Signing in…' : 'Sign in and finish'}</button><Link to={`/forgot-password?returnTo=${encodeURIComponent(`/c/${slug}`)}`} className="auth-text-link">Forgot password?</Link></div>
        </GuidedForm>
      )}

      {step === 'decision' && (
        <section className="claim-choice-section" aria-labelledby="claim-choice-title">
          <h2 id="claim-choice-title">Choose the sentence that fits</h2>
          <div className="claim-choice-list">
            <button type="button" onClick={() => chooseIntent('CLAIM')}>
              <span className="claim-choice-icon"><ShieldCheck aria-hidden="true" /></span>
              <span><strong>{intentCopy.CLAIM.title}</strong><small>{intentCopy.CLAIM.description}</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
            <Link to={`/directory/remove?claim=${encodeURIComponent(slug)}`}>
              <span className="claim-choice-icon"><PhoneOff aria-hidden="true" /></span>
              <span><strong>This is my number, but I do not want to be listed</strong><small>Verify it, remove the listing, and create no account.</small></span>
              <ChevronRight aria-hidden="true" />
            </Link>
            <button type="button" onClick={() => chooseIntent('CHANGE_PHONE')}>
              <span className="claim-choice-icon"><RefreshCw aria-hidden="true" /></span>
              <span><strong>{intentCopy.CHANGE_PHONE.title}</strong><small>{intentCopy.CHANGE_PHONE.description}</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
            <button type="button" onClick={() => chooseIntent('SEPARATE_PROFILE')}>
              <span className="claim-choice-icon"><UserRoundPlus aria-hidden="true" /></span>
              <span><strong>{intentCopy.SEPARATE_PROFILE.title}</strong><small>{intentCopy.SEPARATE_PROFILE.description}</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {step === 'phone' && intent && (
        <GuidedForm onSubmit={requestCode} className="surface p-6 sm:p-8">
          <StatusBadge tone="brand" icon={Phone}>Phone verification</StatusBadge>
          <h2 className="mt-4 text-xl font-extrabold text-slate-950">{phoneStepTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{phoneStepDescription}</p>
          <label className="mt-5 block"><span className="mb-2 block text-sm font-bold text-slate-700">Bangladesh mobile</span><input required autoFocus type="tel" inputMode="tel" autoComplete="tel" value={phone} readOnly={intent !== 'SEPARATE_PROFILE'} onChange={event => { setPhone(event.target.value); setSignInPhone(event.target.value); setDelivery(null); }} placeholder="01XXXXXXXXX" className="input" /></label>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button disabled={busy} className="primary-button">{busy ? 'Sending…' : 'Send verification code'}</button><button type="button" onClick={returnToChoices} className="theme-button"><ArrowLeft className="h-4 w-4" />Back to choices</button></div>
        </GuidedForm>
      )}

      {step === 'code' && intent && (
        <GuidedForm onSubmit={verifyCode} className="surface space-y-5 p-6 sm:p-8">
          <StatusBadge tone="brand" icon={KeyRound}>Check your messages</StatusBadge>
          <h2 className="text-xl font-extrabold text-slate-950">Enter the code</h2>
          <p className="text-sm leading-6 text-slate-600">We sent a purpose-bound code to {phone}.</p>
          <OtpDeliveryStatus delivery={delivery} onDeliveryChange={setDelivery} busy={busy} onResend={() => requestCode()} />
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Six-digit code</span><input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className="input min-h-14 text-center text-2xl font-extrabold tracking-[0.4em]" /></label>
          <div className="flex flex-col gap-3 sm:flex-row"><button disabled={busy || code.length !== 6} className="primary-button">{busy ? 'Checking…' : 'Verify phone'}</button><button type="button" onClick={() => { setDelivery(null); setCode(''); setStep('phone'); }} className="theme-button"><ArrowLeft className="h-4 w-4" />Change number</button></div>
        </GuidedForm>
      )}

      {step === 'new-phone' && (
        <GuidedForm onSubmit={requestNewCode} className="surface p-6 sm:p-8">
          <StatusBadge tone="success" icon={CheckCircle2}>Listed number verified</StatusBadge>
          <h2 className="mt-4 text-xl font-extrabold text-slate-950">Now verify your new number</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Nothing changes until this second number is verified too.</p>
          <label className="mt-5 block"><span className="mb-2 block text-sm font-bold text-slate-700">New Bangladesh mobile</span><input required autoFocus type="tel" inputMode="tel" autoComplete="tel" value={newPhone} onChange={event => { setNewPhone(event.target.value); setDelivery(null); }} placeholder="01XXXXXXXXX" className="input" /></label>
          <button disabled={busy || newPhone === phone} className="primary-button mt-6">{busy ? 'Sending…' : 'Send code to new number'}</button>
        </GuidedForm>
      )}

      {step === 'new-code' && (
        <GuidedForm onSubmit={verifyNewCode} className="surface space-y-5 p-6 sm:p-8">
          <StatusBadge tone="brand" icon={KeyRound}>Verify the new number</StatusBadge>
          <h2 className="text-xl font-extrabold text-slate-950">Enter the second code</h2>
          <p className="text-sm leading-6 text-slate-600">We sent this code to {newPhone}.</p>
          <OtpDeliveryStatus delivery={delivery} onDeliveryChange={setDelivery} busy={busy} onResend={() => requestNewCode()} />
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Six-digit code</span><input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className="input min-h-14 text-center text-2xl font-extrabold tracking-[0.4em]" /></label>
          <div className="flex flex-col gap-3 sm:flex-row"><button disabled={busy || code.length !== 6} className="primary-button">{busy ? 'Checking…' : 'Verify new number'}</button><button type="button" onClick={() => { setDelivery(null); setCode(''); setStep('new-phone'); }} className="theme-button"><ArrowLeft className="h-4 w-4" />Change new number</button></div>
        </GuidedForm>
      )}

      {step === 'details' && intent && !signInRequired && (
        <GuidedForm onSubmit={complete} className="surface space-y-5 p-6 sm:p-8">
          <StatusBadge tone="success" icon={CheckCircle2}>Phone verified</StatusBadge>
          <h2 className="text-xl font-extrabold text-slate-950">Confirm your details</h2>
          <p className="text-sm leading-6 text-slate-600">Check every field and choose whether you are currently available to donate.</p>
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Full name</span><input required maxLength={100} value={name} onChange={event => setName(event.target.value)} className="input" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="mb-2 block text-sm font-bold text-slate-700">Blood group</span><Select required value={bloodGroup} onChange={event => setBloodGroup(event.target.value)} className="input"><option value="">Choose blood group</option>{BLOOD_GROUPS.map(group => <option key={group}>{group}</option>)}</Select></label>
            <label><span className="mb-2 block text-sm font-bold text-slate-700">District</span><Select required value={district} onChange={event => { setDistrict(event.target.value); setUpazila(''); }} className="input"><option value="">Choose district</option>{BD_LOCATION_NAMES.map(item => <option key={item}>{item}</option>)}</Select></label>
            <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">Upazila</span><Select required value={upazila} onChange={event => setUpazila(event.target.value)} className="input"><option value="">Choose upazila</option>{upazilas.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label>
          </div>
          <DonorAvailabilityFields idPrefix="claim" value={availability} onChange={setAvailability} reason={availabilityReason} onReasonChange={setAvailabilityReason} />
          {(passwordRequired || intent === 'SEPARATE_PROFILE') && (
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Create a password</span><input required autoFocus={passwordRequired} type="password" minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="input" /><span className="mt-2 block text-xs leading-5 text-slate-500">Use at least 8 characters. Verification codes cannot be used to sign in.</span></label>
          )}
          <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700"><input required type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" /><span>I control the verified number{intent === 'CHANGE_PHONE' ? 's' : ''}, these details describe me, and I consent to this availability choice on drop.</span></label>
          <button disabled={busy || !availability || !consent || ((passwordRequired || intent === 'SEPARATE_PROFILE') && password.length < 8)} className="primary-button">{busy ? 'Saving…' : intent === 'CHANGE_PHONE' ? 'Update my number' : intent === 'SEPARATE_PROFILE' ? 'Create my account' : 'Claim my profile'}</button>
        </GuidedForm>
      )}

      <p className="text-center text-sm text-slate-500">Adding someone else? <Link to="/contribute" className="font-bold text-primary underline">Create a private suggestion instead</Link>.</p>
    </div>
  );
}

export function LegacyClaimRedirect() {
  return (
    <Surface className="mx-auto max-w-xl p-8 text-center">
      <ShieldCheck className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-extrabold text-slate-950">Use your private invitation link</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">For your privacy, a public directory address cannot be turned into an ownership link. Open the private <strong>/c/</strong> link you received, or ask the person who invited you to send it again.</p>
      <Link to="/directory" className="primary-button mt-6">Back to donor search</Link>
    </Surface>
  );
}
