import GuidedForm from '../components/GuidedForm';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound } from 'lucide-react';
import BloodHelpNotice from '../components/BloodHelpNotice';
import AuthShell from '../components/AuthShell';
import OtpDeliveryStatus from '../components/OtpDeliveryStatus';
import { api, type OtpDelivery } from '../lib/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const claimReturnTo = /^\/c\/[^/?#]+$/.test(searchParams.get('returnTo') || '') ? searchParams.get('returnTo')! : '';
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [delivery, setDelivery] = useState<OtpDelivery | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (step === 1) {
        const result = await api.requestOtp(phone, 'RESET_PASSWORD');
        setDelivery(result);
        if (result.bypass && result.verification_token) {
          setToken(result.verification_token);
          setStep(3);
        } else {
          setStep(2);
        }
      } else if (step === 2) {
        const result = await api.verifyOtp(phone, 'RESET_PASSWORD', code);
        setToken(result.verification_token);
        setStep(3);
      } else {
        if (password !== confirmPassword) throw new Error('Enter the same new password twice.');
        await api.resetPassword(phone, password, token);
        const next = new URLSearchParams({ reset: '1' });
        if (claimReturnTo) next.set('returnTo', claimReturnTo);
        navigate(`/login?${next.toString()}`, { replace: true });
      }
    } catch (error: any) {
      setMessage(error.message || 'Password recovery could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="One code. A fresh start. Resetting signs out all devices."
    >
      <div className="mb-7 flex items-center gap-3" aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map(value => <span key={value} className={`h-2 flex-1 rounded-full ${value <= step ? 'bg-primary' : 'bg-slate-100'}`} />)}
      </div>
      <BloodHelpNotice />
      <GuidedForm onSubmit={submit} className="space-y-5">
        {step === 1 && (
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-800">Registered Bangladesh mobile</span>
            <input required autoComplete="tel" type="tel" value={phone} onChange={event => { setPhone(event.target.value); setDelivery(null); }} placeholder="+880 1712 345678" className="input min-h-12" />
          </label>
        )}
        {step === 2 && (
          <>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-900">Enter the code sent for <strong>{phone}</strong>.</div>
            <OtpDeliveryStatus
              delivery={delivery}
              onDeliveryChange={setDelivery}
              busy={busy}
              onResend={() => void (async () => {
                setBusy(true);
                setMessage('');
                try {
                  setDelivery(await api.requestOtp(phone, 'RESET_PASSWORD'));
                  setCode('');
                } catch (error: any) {
                  setMessage(error.message || 'A new verification code could not be sent.');
                } finally {
                  setBusy(false);
                }
              })()}
            />
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-800">Six-digit verification code</span>
              <input required autoFocus autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className="input min-h-14 text-center text-2xl font-extrabold tracking-[0.45em]" />
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-bold text-green-800"><CheckCircle2 className="h-5 w-5" />Phone verified</div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-800">New password</span>
              <input required autoFocus autoComplete="new-password" type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" className="input min-h-12" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-800">Confirm new password</span>
              <input required autoComplete="new-password" type="password" minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="input min-h-12" />
            </label>
            <p className="text-xs leading-5 text-slate-500">Saving the new password signs out every device currently connected to this account.</p>
          </>
        )}
        {message && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div>}
        <button disabled={busy || (step === 2 && code.length !== 6)} className="primary-button min-h-12">
          {busy ? 'Please wait…' : step === 1 ? <>Send recovery code <ArrowRight className="h-5 w-5" /></> : step === 2 ? <>Verify code <KeyRound className="h-5 w-5" /></> : <>Save new password <CheckCircle2 className="h-5 w-5" /></>}
        </button>
      </GuidedForm>
      {step === 2 && <button type="button" disabled={busy} className="auth-text-link mt-4" onClick={() => { setStep(1); setDelivery(null); setCode(''); setToken(''); setMessage(''); }}>Use a different phone number</button>}
      <Link to={claimReturnTo ? `${claimReturnTo}` : '/login'} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-600 hover:text-primary"><ArrowLeft className="h-4 w-4" />{claimReturnTo ? 'Back to invitation' : 'Back to sign in'}</Link>
    </AuthShell>
  );
}
