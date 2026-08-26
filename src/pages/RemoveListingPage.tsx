import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, KeyRound, Phone, ShieldOff } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, StatusBadge, Surface } from '../components/ui';

/**
 * Self-service removal for people whose number was scraped from someone else's
 * public listing.
 *
 * No account, on purpose. Claiming the imported profile would otherwise mean
 * signing up in order to remove it. Proving control of the
 * number with a code is the normal check. Superadmin-controlled test mode can
 * bypass it and is visibly labelled across the app while active.
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
      const result = await api.requestListingRemoval(phone);
      if (result.bypass && result.verification_token) {
        const confirmed = await api.confirmListingRemoval(phone, result.verification_token);
        setRemoved(confirmed.removed || 0);
        setStep('done');
      } else {
        setStep('code');
      }
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
    <div className="mx-auto max-w-5xl space-y-7 pb-12">
      <PageHeader
        eyebrow="Your privacy choice"
        title="Remove your number from the directory"
        description="If another organisation published your number and you do not want to be contacted through Drop, take it off without creating an account."
        icon={ShieldOff}
        aside={(
          <Surface className="grid gap-2 p-3">
            {([
              [Phone, 'Enter your number', step !== 'phone'],
              [KeyRound, 'Verify the code', step === 'done'],
              [CheckCircle2, 'Listing removed', step === 'done']
            ] as const).map(([Icon, label, complete], index) => (
              <div key={String(label)} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${complete ? 'bg-green-100 text-green-700' : index === (step === 'phone' ? 0 : step === 'code' ? 1 : 2) ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-bold text-slate-700">{label}</span>
              </div>
            ))}
          </Surface>
        )}
      />

      {step === 'phone' && (
        <form onSubmit={sendCode} className="surface mx-auto w-full max-w-2xl p-6 sm:p-8">
          <StatusBadge tone="brand" icon={Phone}>Step 1 of 2</StatusBadge>
          <h2 className="mt-4 text-xl font-extrabold text-slate-950">Confirm it is your number</h2>
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
        <form onSubmit={confirm} className="surface mx-auto w-full max-w-2xl p-6 sm:p-8">
          <StatusBadge tone="brand" icon={KeyRound}>Step 2 of 2</StatusBadge>
          <h2 className="mt-4 text-xl font-extrabold text-slate-950">Enter the code</h2>
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
        <Surface className="mx-auto w-full max-w-2xl border-green-200 bg-green-50/60 p-6 sm:p-8">
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
        </Surface>
      )}

      <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-500">
        Something wrong, or a number you cannot receive SMS on?{' '}
        <Link to="/contact" className="font-bold underline">Contact us</Link> and a person will handle it.
      </p>
    </div>
  );
}
