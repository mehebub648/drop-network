import GuidedForm from '../components/GuidedForm';
import Select from '../components/Select';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, CheckCircle2, ExternalLink, KeyRound, Phone, ShieldCheck, UserRoundPlus } from 'lucide-react';
import DonorAvailabilityFields, { type RegistrationAvailability } from '../components/DonorAvailabilityFields';
import OtpDeliveryStatus from '../components/OtpDeliveryStatus';
import { PageHeader, StatusBadge, Surface } from '../components/ui';
import { api, type OtpDelivery } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES } from '../lib/locations';
import { getUpazilasForDistrict } from '../lib/upazilas';

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

type Step = 'phone' | 'code' | 'details' | 'done';

export default function ClaimProfilePage({ user, onUpdate }: { user: any; onUpdate: () => void }) {
  const { slug = '' } = useParams();
  const [profile, setProfile] = useState<DirectoryProfile | null>(null);
  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [delivery, setDelivery] = useState<OtpDelivery | null>(null);
  const [name, setName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [availability, setAvailability] = useState<RegistrationAvailability>('');
  const [availabilityReason, setAvailabilityReason] = useState('');
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<'CLAIMED' | 'SEPARATE_PROFILE_CREATED' | ''>('');
  const upazilas = useMemo(() => getUpazilasForDistrict(district), [district]);

  useEffect(() => {
    let active = true;
    void api.getClaimProfile(slug)
      .then((data: DirectoryProfile) => {
        if (!active) return;
        setProfile(data);
        setName(data.name || '');
        setBloodGroup(data.blood_group || '');
        setDistrict(data.district || '');
        setUpazila(data.upazila || '');
      })
      .catch((cause: any) => active && setError(cause.message || 'This claim link is unavailable.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause: any) {
      setError(cause.message || 'The claim could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const requestCode = (event?: FormEvent) => {
    event?.preventDefault();
    void run(async () => {
      const response = await api.requestOtp(phone, 'CLAIM_PROFILE');
      setDelivery(response);
      setCode('');
      if (response.bypass && response.verification_token) {
        setVerificationToken(response.verification_token);
        setStep('details');
      } else {
        setStep('code');
      }
    });
  };

  const verifyCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const response = await api.verifyOtp(phone, 'CLAIM_PROFILE', code);
      setVerificationToken(response.verification_token);
      setStep('details');
    });
  };

  const complete = (event: FormEvent) => {
    event.preventDefault();
    if (!consent) return setError('Confirm that these details and availability choice are yours.');
    void run(async () => {
      const response = await api.completeClaimProfile(slug, {
        phone,
        verification_token: verificationToken,
        name,
        blood_group: bloodGroup,
        district,
        upazila,
        availability_status: availability as 'AVAILABLE' | 'NOT_AVAILABLE',
        availability_reason: availability === 'NOT_AVAILABLE' ? availabilityReason : undefined,
        availability_consent: true
      });
      setResult(response.result);
      setStep('done');
      onUpdate();
    });
  };

  if (loading) return <div className="surface mx-auto h-64 max-w-2xl animate-pulse" aria-label="Loading claim profile" />;
  if (!profile) {
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
    const claimed = result === 'CLAIMED';
    const followUpToken = sessionStorage.getItem('drop_follow_up_token') || '';
    return (
      <Surface className="mx-auto max-w-2xl border-green-200 bg-green-50/60 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-700" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-950">{claimed ? 'Profile claimed' : 'Your verified profile is ready'}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {claimed
            ? 'The verified number matched this listing, so it now belongs to your Drop account.'
            : 'This number belongs to a different person, so we created or updated your own profile and left the original listing unclaimed.'}
        </p>
        <Link to={followUpToken ? `/follow-up#token=${followUpToken}` : '/profile/donor'} onClick={() => sessionStorage.removeItem('drop_follow_up_token')} className="primary-button mt-6">{followUpToken ? 'Continue donation update' : 'Open my donor profile'}</Link>
      </Surface>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7 pb-12">
      <PageHeader
        eyebrow="Private owner verification"
        title="Claim or create your donor profile"
        description="First verify the phone you control. You can change it before requesting the code; knowing this link alone never proves ownership."
        icon={UserRoundPlus}
      />

      <Surface className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge tone="brand" icon={ShieldCheck}>Masked listing</StatusBadge>
          <span className="font-mono text-sm font-bold text-slate-700">{profile.phone_masked || 'No phone shown'}</span>
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="font-bold text-slate-500">Listed name</dt><dd className="mt-1 font-extrabold text-slate-950">{profile.name || 'Not provided'}</dd></div>
          <div><dt className="font-bold text-slate-500">Blood group</dt><dd className="mt-1 font-extrabold text-slate-950">{profile.blood_group || 'Not provided'}</dd></div>
          <div><dt className="font-bold text-slate-500">District</dt><dd className="mt-1 font-extrabold text-slate-950">{profile.district || 'Not provided'}</dd></div>
          <div><dt className="font-bold text-slate-500">Upazila</dt><dd className="mt-1 font-extrabold text-slate-950">{profile.upazila || 'Not provided'}</dd></div>
        </dl>
        {profile.source.url && (
          <a href={profile.source.url} target="_blank" rel="noreferrer noopener" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary underline">
            Source: {profile.source.organization} <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </Surface>

      {error && <div role="alert" className="alert alert-error">{error}</div>}

      {step === 'phone' && (
        <GuidedForm onSubmit={requestCode} className="surface p-6 sm:p-8">
          <StatusBadge tone="brand" icon={Phone}>Step 1 of 3</StatusBadge>
          <h2 className="mt-4 text-xl font-extrabold text-slate-950">Which number do you control?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Change the number freely here. A different unique number creates your own profile and leaves this listing unclaimed.</p>
          <label className="mt-5 block"><span className="mb-2 block text-sm font-bold text-slate-700">Your Bangladesh mobile</span><input required autoFocus type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={event => { setPhone(event.target.value); setDelivery(null); }} placeholder="01XXXXXXXXX" className="input" /></label>
          <button disabled={busy} className="primary-button mt-6">{busy ? 'Sending…' : 'Send verification code'}</button>
        </GuidedForm>
      )}

      {step === 'code' && (
        <GuidedForm onSubmit={verifyCode} className="surface space-y-5 p-6 sm:p-8">
          <StatusBadge tone="brand" icon={KeyRound}>Step 2 of 3</StatusBadge>
          <h2 className="text-xl font-extrabold text-slate-950">Enter the code</h2>
          <p className="text-sm leading-6 text-slate-600">We sent a purpose-bound code to {phone}.</p>
          <OtpDeliveryStatus delivery={delivery} onDeliveryChange={setDelivery} busy={busy} onResend={() => requestCode()} />
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Six-digit code</span><input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className="input min-h-14 text-center text-2xl font-extrabold tracking-[0.4em]" /></label>
          <div className="flex flex-col gap-3 sm:flex-row"><button disabled={busy || code.length !== 6} className="primary-button">{busy ? 'Checking…' : 'Verify phone'}</button><button type="button" onClick={() => { setDelivery(null); setCode(''); setStep('phone'); }} className="theme-button"><ArrowLeft className="h-4 w-4" />Change number</button></div>
        </GuidedForm>
      )}

      {step === 'details' && (
        <GuidedForm onSubmit={complete} className="surface space-y-5 p-6 sm:p-8">
          <StatusBadge tone="success" icon={CheckCircle2}>Phone verified · Step 3 of 3</StatusBadge>
          <h2 className="text-xl font-extrabold text-slate-950">Confirm your details and consent</h2>
          <p className="text-sm leading-6 text-slate-600">Nothing is guessed. Check every field and explicitly choose whether you are available.</p>
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Full name</span><input required maxLength={100} value={name} onChange={event => setName(event.target.value)} className="input" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="mb-2 block text-sm font-bold text-slate-700">Blood group</span><Select required value={bloodGroup} onChange={event => setBloodGroup(event.target.value)} className="input"><option value="">Choose blood group</option>{BLOOD_GROUPS.map(group => <option key={group}>{group}</option>)}</Select></label>
            <label><span className="mb-2 block text-sm font-bold text-slate-700">District</span><Select required value={district} onChange={event => { setDistrict(event.target.value); setUpazila(''); }} className="input"><option value="">Choose district</option>{BD_LOCATION_NAMES.map(item => <option key={item}>{item}</option>)}</Select></label>
            <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">Upazila</span><Select required value={upazila} onChange={event => setUpazila(event.target.value)} className="input"><option value="">Choose upazila</option>{upazilas.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label>
          </div>
          <DonorAvailabilityFields idPrefix="claim" value={availability} onChange={setAvailability} reason={availabilityReason} onReasonChange={setAvailabilityReason} />
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700"><input required type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" /><span>I control the verified number, these details describe me, and I consent to this availability choice on Drop.</span></label>
          <button disabled={busy || !availability || !consent} className="primary-button">{busy ? 'Saving…' : 'Save my verified profile'}</button>
        </GuidedForm>
      )}

      <p className="text-center text-sm text-slate-500">Adding someone else? <Link to="/contribute" className="font-bold text-primary underline">Create a private suggestion instead</Link>.</p>
    </div>
  );
}

export function LegacyClaimRedirect() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  useEffect(() => {
    void api.getDirectoryProfile(id)
      .then((profile: DirectoryProfile) => navigate(profile.claim_path, { replace: true }))
      .catch((cause: any) => setError(cause.message || 'Profile not found'));
  }, [id, navigate]);
  if (error) return <Surface className="mx-auto max-w-xl p-8 text-center"><p role="alert">{error}</p><Link to="/directory" className="primary-button mt-5">Back to search</Link></Surface>;
  return <div className="surface mx-auto h-48 max-w-xl animate-pulse" aria-label="Opening short claim link" />;
}
