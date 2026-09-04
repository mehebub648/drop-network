import DateInput from '../components/DateInput';
import GuidedForm from '../components/GuidedForm';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Clock3, HeartHandshake, KeyRound, ShieldCheck, XCircle } from 'lucide-react';
import OtpDeliveryStatus from '../components/OtpDeliveryStatus';
import { PageHeader, StatusBadge, Surface } from '../components/ui';
import { api, type DonationFollowUp, type OtpDelivery } from '../lib/api';

function fragmentToken() {
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || '';
}

export default function DonationFollowUpPage({ onAuthUpdate }: { onAuthUpdate: () => Promise<void> | void }) {
  const [token] = useState(fragmentToken);
  const [followUp, setFollowUp] = useState<DonationFollowUp | null>(null);
  const [verification, setVerification] = useState<{ required: boolean; phoneMasked?: string; donorKind?: string }>({ required: false });
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [delivery, setDelivery] = useState<OtpDelivery | null>(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [claimPath, setClaimPath] = useState('');
  const [donatedOn, setDonatedOn] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('This follow-up link is missing its private token. Open the complete link from the SMS.');
      setLoading(false);
      return;
    }
    void api.openDonationFollowUp(token)
      .then(response => {
        if (response.follow_up) setFollowUp(response.follow_up);
        else setVerification({ required: true, phoneMasked: response.phone_masked, donorKind: response.donor_kind });
      })
      .catch(cause => setError(cause.message || 'This follow-up link is unavailable.'))
      .finally(() => setLoading(false));
  }, [token]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await task(); } catch (cause: any) { setError(cause.message || 'The update could not be saved.'); }
    finally { setBusy(false); }
  };

  const requestCode = (event?: FormEvent) => {
    event?.preventDefault();
    void run(async () => {
      const result = await api.requestOtp(phone, 'DONATION_FOLLOW_UP');
      setDelivery(result);
      if (result.bypass && result.verification_token) setVerificationToken(result.verification_token);
    });
  };

  const verify = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const verified = verificationToken ? { verification_token: verificationToken } : await api.verifyOtp(phone, 'DONATION_FOLLOW_UP', code);
      const result = await api.verifyDonationFollowUp(token, phone, verified.verification_token);
      if (result.claim_required) {
        sessionStorage.setItem('drop_follow_up_token', token);
        setClaimPath(result.claim_path || '');
      } else {
        setFollowUp(result.follow_up);
        setVerification({ required: false });
        await onAuthUpdate();
      }
    });
  };

  const submit = (outcome: 'DONATED' | 'NOT_DONATED' | 'REMIND_LATER') => {
    if (!followUp) return;
    void run(async () => {
      const result = await api.submitDonationFollowUp(followUp.id, outcome, outcome === 'DONATED' && followUp.role === 'DONOR' ? donatedOn : undefined);
      setFollowUp(result.follow_up);
      await onAuthUpdate();
    });
  };

  if (loading) return <div className="surface mx-auto h-64 max-w-2xl animate-pulse" aria-label="Loading donation follow-up" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <PageHeader eyebrow="Private donation update" title="Donation follow-up" description="The donor and requester update this independently. Only matching answers confirm a donation." icon={HeartHandshake} />
      {error && <div role="alert" className="alert alert-error">{error}</div>}

      {claimPath && (
        <Surface className="p-6 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-xl font-extrabold">Claim your donor profile first</h2>
          <p className="mt-2 text-sm text-slate-600">The verified number belongs to an imported listing. Review and claim it before reporting the outcome. Claiming never makes you automatically available.</p>
          <Link to={claimPath} className="primary-button mt-5">Claim and continue</Link>
        </Surface>
      )}

      {verification.required && !claimPath && (
        <Surface className="p-6 sm:p-8">
          <StatusBadge tone="brand" icon={KeyRound}>Phone verification</StatusBadge>
          <h2 className="mt-4 text-xl font-extrabold">Verify the donor phone</h2>
          <p className="mt-2 text-sm text-slate-600">Enter the number that received this link ({verification.phoneMasked || 'masked'}). The code is valid only for this donation follow-up.</p>
          <GuidedForm onSubmit={delivery ? verify : requestCode} className="mt-5 grid gap-4">
            <label><span className="text-sm font-bold">Mobile number</span><input className="input mt-2" value={phone} onChange={event => setPhone(event.target.value)} placeholder="01XXXXXXXXX" required /></label>
            {delivery && !verificationToken && <label><span className="text-sm font-bold">Six-digit code</span><input className="input mt-2" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" required /></label>}
            {delivery && <OtpDeliveryStatus delivery={delivery} onDeliveryChange={setDelivery} onResend={() => requestCode()} busy={busy} />}
            <button disabled={busy} className="primary-button justify-center">{busy ? 'Please wait…' : delivery ? 'Verify and continue' : 'Send verification code'}</button>
          </GuidedForm>
        </Surface>
      )}

      {followUp && (
        <Surface className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge tone={followUp.state === 'CONFIRMED' ? 'success' : followUp.state === 'DISPUTED' ? 'warning' : 'brand'}>{followUp.state.replaceAll('_', ' ')}</StatusBadge>
            <span className="text-xs font-bold text-slate-500">{followUp.role === 'DONOR' ? 'Donor update' : 'Requester update'}</span>
          </div>
          <h2 className="mt-5 text-xl font-extrabold">{followUp.request?.facility || 'Donation request'}</h2>
          <p className="mt-1 text-sm text-slate-600">{followUp.request?.district}{followUp.request?.upazila ? ` · ${followUp.request.upazila}` : ''}</p>
          <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <p><strong>Donor:</strong> {followUp.donor_outcome?.replaceAll('_', ' ') || 'Waiting'}</p>
            <p><strong>Requester:</strong> {followUp.requester_outcome?.replaceAll('_', ' ') || 'Waiting'}</p>
          </div>
          {!['CONFIRMED', 'NOT_DONATED', 'DISPUTED'].includes(followUp.state) && !(followUp.role === 'DONOR' ? followUp.donor_outcome : followUp.requester_outcome) && (
            <div className="mt-6 space-y-4">
              {followUp.role === 'DONOR' && <label><span className="text-sm font-bold">Donation date</span><input type="date" max={new Date().toISOString().slice(0, 10)} value={donatedOn} onChange={event => setDonatedOn(event.target.value)} className="input mt-2" /></label>}
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => submit('DONATED')} className="response-primary"><CheckCircle2 className="h-4 w-4" /> Donated</button>
                <button disabled={busy} onClick={() => submit('NOT_DONATED')} className="response-secondary"><XCircle className="h-4 w-4" /> Not donated</button>
                {followUp.role === 'DONOR' && followUp.reminder_count < 1 && <button disabled={busy} onClick={() => submit('REMIND_LATER')} className="response-secondary"><Clock3 className="h-4 w-4" /> Remind tomorrow</button>}
              </div>
            </div>
          )}
          {followUp.state === 'DISPUTED' && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">The two answers conflict. This record is not counted as a confirmed donation and is visible to operators for review.</p>}
        </Surface>
      )}
    </div>
  );
}
