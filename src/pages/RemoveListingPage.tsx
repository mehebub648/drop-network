import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ShieldOff } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Self-service removal for people whose number was scraped from someone else's
 * public listing.
 *
 * No account, on purpose. The only other route off the directory is claiming
 * the profile, which means signing up in order to leave. Proving control of the
 * number with a code is the entire check.
 *
 * The page never says whether a number is listed until it has been verified,
 * so it cannot be used to test which numbers are in the directory.
 */
export default function RemoveListingPage() {
  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [removed, setRemoved] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause: any) {
      setError(cause?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.requestListingRemoval(phone);
      setStep('code');
    });
  };

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const verified = await api.verifyOtp(phone, 'REMOVE_LISTING', code);
      const result = await api.confirmListingRemoval(phone, verified.verification_token);
      setRemoved(result.removed || 0);
      setStep('done');
    });
  };

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-primary">
        <ShieldOff className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
        Remove your number from the directory
      </h1>
      <p className="mt-4 leading-7 text-slate-600">
        Some donor listings here were published by other organisations, not by the people on them. If
        one of those numbers is yours and you do not want to be contacted through Drop, you can take it
        off without creating an account.
      </p>

      {step === 'phone' && (
        <form onSubmit={sendCode} className="theme-card mt-8 p-6 sm:p-8">
          <h2 className="text-xl font-extrabold text-slate-950">Confirm it is your number</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            We send a code by SMS so nobody else can remove your listing, or remove someone else's.
          </p>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Your mobile number</span>
            <input
              required
              autoFocus
              type="tel"
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              className="input"
            />
          </label>
          {error && <div role="alert" className="alert alert-error mt-4">{error}</div>}
          <button type="submit" disabled={busy} className="primary-button mt-6 disabled:opacity-60">
            {busy ? 'Sending...' : 'Send code'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={confirm} className="theme-card mt-8 p-6 sm:p-8">
          <h2 className="text-xl font-extrabold text-slate-950">Enter the code</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            If {phone} appears in the directory, a six-digit code is on its way to it.
          </p>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Verification code</span>
            <input
              required
              autoFocus
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={event => setCode(event.target.value)}
              className="input tracking-[0.4em]"
            />
          </label>
          {error && <div role="alert" className="alert alert-error mt-4">{error}</div>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={busy} className="primary-button">
              {busy ? 'Removing...' : 'Remove my listing'}
            </button>
            <button type="button" onClick={() => { setStep('phone'); setError(''); }} className="theme-button">
              Use a different number
            </button>
          </div>
        </form>
      )}

      {step === 'done' && (
        <div className="theme-card mt-8 p-6 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-extrabold text-slate-950">
            {removed === 1 ? 'Your listing has been removed.' : `${removed} listings have been removed.`}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            That number no longer appears in donor search and cannot be revealed to anyone requesting
            blood. It stays out even if we import from that source again.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The original organisation still has its own copy. To be removed there too, contact them
            directly. If you would like to donate on your own terms later, you can{' '}
            <Link to="/register" className="font-bold text-primary underline">register as a donor</Link>{' '}
            and control your own availability.
          </p>
        </div>
      )}

      <p className="mt-8 text-sm leading-6 text-slate-500">
        Something wrong, or a number you cannot receive SMS on?{' '}
        <Link to="/contact" className="font-bold underline">Contact us</Link> and a person will handle it.
      </p>
    </div>
  );
}
