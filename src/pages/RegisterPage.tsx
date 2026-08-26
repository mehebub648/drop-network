import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, EyeOff, Phone, TerminalSquare } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import DonorAvailabilityFields, { type RegistrationAvailability } from '../components/DonorAvailabilityFields';
import { api } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES, getLocationByName } from '../lib/locations';
import { getSafeReturnTo } from '../lib/navigation';

type Step = 'PHONE' | 'CODE' | 'ACCOUNT';

const steps: Array<{ id: Step; label: string }> = [
  { id: 'PHONE', label: 'Phone' },
  { id: 'CODE', label: 'OTP' },
  { id: 'ACCOUNT', label: 'Profile' }
];

export default function RegisterPage({ onLogin }: { onLogin: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [selectedLocation, setSelectedLocation] = useState('Dhaka');
  const [availabilityStatus, setAvailabilityStatus] = useState<RegistrationAvailability>('');
  const [availabilityReason, setAvailabilityReason] = useState('');
  const [step, setStep] = useState<Step>('PHONE');
  const [deliveryMode, setDeliveryMode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'), '/profile/donor');

  const act = async (action: () => Promise<void>) => {
    setLoading(true);
    setError('');
    try {
      await action();
    } catch (reason: any) {
      setError(reason.message || 'Registration could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const requestCode = (event: FormEvent) => {
    event.preventDefault();
    void act(async () => {
      const result = await api.requestOtp(phone, 'REGISTER');
      setDeliveryMode(result.provider || '');
      setCode('');
      if (result.bypass && result.verification_token) {
        setVerificationToken(result.verification_token);
        setStep('ACCOUNT');
      } else {
        setStep('CODE');
      }
    });
  };

  const verifyCode = (event: FormEvent) => {
    event.preventDefault();
    void act(async () => {
      const result = await api.verifyOtp(phone, 'REGISTER', code);
      setVerificationToken(result.verification_token);
      setStep('ACCOUNT');
    });
  };

  const register = (event: FormEvent) => {
    event.preventDefault();
    void act(async () => {
      const location = getLocationByName(selectedLocation);
      if (!location) throw new Error('Choose a supported district.');
      if (!availabilityStatus) throw new Error('Choose whether you are available to donate.');
      await api.register(phone, name, password, verificationToken, bloodGroup, location, {
        availability_status: availabilityStatus,
        availability_reason: availabilityStatus === 'NOT_AVAILABLE' ? availabilityReason : undefined
      });
      await onLogin();
      navigate(returnTo, { replace: true });
    });
  };

  const stepIndex = steps.findIndex(item => item.id === step);

  return (
    <AuthShell
      eyebrow="Join the network"
      title="Create a verified donor account"
      description="Verify your Bangladesh mobile, add the basics, then decide when you are genuinely available to donate."
    >
      <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Registration progress">
        {steps.map((item, index) => {
          const complete = index < stepIndex;
          const active = item.id === step;
          return (
            <li key={item.id} className="text-center">
              <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-sm font-extrabold ${
                complete ? 'border-primary bg-primary text-white'
                  : active ? 'border-primary bg-rose-50 text-primary'
                    : 'border-slate-200 bg-white text-slate-400'
              }`}>
                {complete ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className={`mt-2 block text-xs font-bold ${active || complete ? 'text-primary' : 'text-slate-400'}`}>{item.label}</span>
            </li>
          );
        })}
      </ol>

      {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      {step === 'PHONE' && (
        <form onSubmit={requestCode} className="space-y-5">
          <Field label="Bangladesh mobile">
            <span className="relative block">
              <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                autoComplete="tel"
                inputMode="tel"
                type="tel"
                required
                className="input min-h-12 pl-12"
                placeholder="+880 1712 345678"
                value={phone}
                onChange={event => setPhone(event.target.value)}
              />
            </span>
          </Field>
          <p className="text-xs leading-5 text-slate-500">We send a six-digit, purpose-bound code. It expires after ten minutes and cannot be used as your password.</p>
          <button disabled={loading} className="primary-button min-h-12">
            {loading ? 'Sending code…' : <>Send verification code <ArrowRight className="h-5 w-5" /></>}
          </button>
        </form>
      )}

      {step === 'CODE' && (
        <form onSubmit={verifyCode} className="space-y-5">
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Code sent for <strong>{phone}</strong>
          </div>
          {deliveryMode === 'console' && (
            <div role="status" className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <TerminalSquare className="mt-0.5 h-5 w-5 shrink-0" />
              <span><strong>Development mode:</strong> the OTP was printed in the server logs.</span>
            </div>
          )}
          <Field label="Six-digit verification code">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              className="input min-h-14 text-center text-2xl font-extrabold tracking-[0.45em]"
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <button disabled={loading || code.length !== 6} className="primary-button min-h-12">
            {loading ? 'Checking code…' : <>Verify phone <CheckCircle2 className="h-5 w-5" /></>}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <button type="button" onClick={() => setStep('PHONE')} className="inline-flex min-h-11 items-center gap-2 font-bold text-slate-600 hover:text-primary">
              <ArrowLeft className="h-4 w-4" /> Change number
            </button>
            <button type="button" disabled={loading} onClick={() => void act(async () => {
              const result = await api.requestOtp(phone, 'REGISTER');
              setDeliveryMode(result.provider || '');
            })} className="min-h-11 font-bold text-primary hover:text-primary-dark disabled:opacity-50">
              Send another code
            </button>
          </div>
        </form>
      )}

      {step === 'ACCOUNT' && (
        <form onSubmit={register} className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
            <CheckCircle2 className="h-5 w-5" /> Phone verified
          </div>
          <Field label="Full name">
            <input autoComplete="name" required maxLength={100} className="input min-h-12" placeholder="Your name" value={name} onChange={event => setName(event.target.value)} />
          </Field>
          <Field label="Create password">
            <span className="relative block">
              <input
                autoComplete="new-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                className="input min-h-12 pr-12"
                placeholder="At least 8 characters"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-slate-800"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </span>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Blood group">
              <select value={bloodGroup} onChange={event => setBloodGroup(event.target.value)} className="input min-h-12">
                {BLOOD_GROUPS.map(group => <option key={group}>{group}</option>)}
              </select>
            </Field>
            <Field label="District">
              <select value={selectedLocation} onChange={event => setSelectedLocation(event.target.value)} className="input min-h-12">
                {BD_LOCATION_NAMES.map(location => <option key={location}>{location}</option>)}
              </select>
            </Field>
          </div>
          <DonorAvailabilityFields
            idPrefix="registration"
            value={availabilityStatus}
            onChange={setAvailabilityStatus}
            reason={availabilityReason}
            onReasonChange={setAvailabilityReason}
          />
          <p className="text-xs leading-5 text-slate-500">Your phone is only shown to signed-in request owners while you are available. Clinical screening still happens at the receiving facility.</p>
          <button disabled={loading} className="primary-button min-h-12">
            {loading ? 'Creating account…' : <>Create verified account <ArrowRight className="h-5 w-5" /></>}
          </button>
          <p className="text-center text-xs leading-5 text-slate-500">By joining, you agree to the <Link to="/terms" className="font-semibold text-primary hover:underline">Terms</Link> and acknowledge the <Link to="/privacy" className="font-semibold text-primary hover:underline">Privacy Policy</Link>.</p>
        </form>
      )}

      <p className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">
        Already registered? <Link to={returnTo === '/profile/donor' ? '/login' : `/login?returnTo=${encodeURIComponent(returnTo)}`} className="font-bold text-primary hover:text-primary-dark hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-800">{label}</span>{children}</label>;
}
