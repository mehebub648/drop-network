import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Phone } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import OtpDeliveryStatus from '../components/OtpDeliveryStatus';
import { api, type OtpDelivery } from '../lib/api';
import { getSafeReturnTo } from '../lib/navigation';

export default function LoginPage({ onLogin }: { onLogin: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'password' | 'phone' | 'code'>('password');
  const [code, setCode] = useState('');
  const [delivery, setDelivery] = useState<OtpDelivery | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'), '/profile');

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(phone, password);
      await onLogin();
      navigate(returnTo, { replace: true });
    } catch (caught: any) {
      setError(caught.message || 'We could not sign you in. Check the phone and password.');
    } finally {
      setLoading(false);
    }
  };

  const finishOtpLogin = async (verificationToken: string) => {
    await api.otpLogin(phone, verificationToken);
    await onLogin();
    navigate(returnTo, { replace: true });
  };

  const requestCode = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.requestOtp(phone, 'SIGN_IN');
      setDelivery(response);
      setCode('');
      if (response.bypass && response.verification_token) await finishOtpLogin(response.verification_token);
      else setMode('code');
    } catch (caught: any) {
      setError(caught.message || 'We could not send a sign-in code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.verifyOtp(phone, 'SIGN_IN', code);
      if (!response.account_exists) throw new Error('No account exists for this number.');
      await finishOtpLogin(response.verification_token);
    } catch (caught: any) {
      setError(caught.message || 'The code is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Member sign in"
      title="Welcome back"
      description="Sign in to reveal opted-in donor contacts, manage requests, and keep your own availability accurate."
    >
      <form onSubmit={mode === 'password' ? handleLogin : mode === 'phone' ? requestCode : verifyCode} className="space-y-5">
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-800">Bangladesh mobile</span>
          <span className="relative block">
            <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              className="input min-h-12 pl-12"
              placeholder="+880 1712 345678"
              value={phone}
              onChange={event => {
                setPhone(event.target.value);
                setDelivery(null);
                setCode('');
                setError('');
                if (mode === 'code') setMode('phone');
              }}
            />
          </span>
        </label>

        {mode === 'password' && <label className="block">
          <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-800">
            Password
            <Link to="/forgot-password" className="text-xs text-primary hover:text-primary-dark hover:underline">Forgot password?</Link>
          </span>
          <span className="relative block">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              className="input min-h-12 px-12"
              placeholder="Your password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </span>
        </label>}

        {mode === 'code' && (
          <>
            <OtpDeliveryStatus delivery={delivery} onDeliveryChange={setDelivery} busy={loading} onResend={() => void requestCode()} />
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-800">Six-digit sign-in code</span>
              <input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className="input min-h-14 text-center text-2xl font-extrabold tracking-[0.4em]" />
            </label>
          </>
        )}

        <button disabled={loading} className="primary-button min-h-12">
          {loading ? 'Please wait…' : mode === 'password' ? <>Sign in <ArrowRight className="h-5 w-5" /></> : mode === 'phone' ? <>Send sign-in code <KeyRound className="h-5 w-5" /></> : <>Verify and sign in <ArrowRight className="h-5 w-5" /></>}
        </button>
        {mode === 'password' ? (
          <button type="button" onClick={() => { setMode('phone'); setError(''); }} className="theme-button min-h-12 w-full"><KeyRound className="h-4 w-4" />Use a verification code instead</button>
        ) : (
          <button type="button" onClick={() => { setMode('password'); setDelivery(null); setCode(''); setError(''); }} className="theme-button min-h-12 w-full"><ArrowLeft className="h-4 w-4" />Use my password instead</button>
        )}
      </form>

      <div className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">
        New to Drop? <Link to={returnTo === '/profile' ? '/register' : `/register?returnTo=${encodeURIComponent(returnTo)}`} className="font-bold text-primary hover:text-primary-dark hover:underline">Create a verified account</Link>
      </div>
      <p className="mt-4 text-center text-xs leading-5 text-slate-500">Donor numbers are masked while you search. They open one at a time, through a published blood request, and every reveal is recorded.</p>
    </AuthShell>
  );
}
