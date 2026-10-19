import { FormEvent, useState } from 'react';
import { KeyRound, Send, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import GuidedForm from '../../components/GuidedForm';
import { isMobileBrowser } from '../../components/MobileAppCover';
import { api } from '../../lib/api';
import { InfoPage } from './InfoPage';

type RequestState = { busy: boolean; message: string; error: boolean };

export default function DeleteAccountPage({ user }: { user: any }) {
  const mobile = isMobileBrowser();
  const [form, setForm] = useState({ name: '', phone: '', details: '' });
  const [state, setState] = useState<RequestState>({ busy: false, message: '', error: false });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ busy: true, message: '', error: false });
    try {
      const details = form.details.trim();
      const result = await api.createSupportTicket({
        name: form.name,
        phone: form.phone,
        category: 'PRIVACY',
        message: `Account deletion request for the Drop account registered to ${form.phone.trim()}.${details ? ` Additional details: ${details}` : ''}`
      });
      setState({
        busy: false,
        message: `Your account deletion request was received. Reference: ${result.id}`,
        error: false
      });
      setForm({ name: '', phone: '', details: '' });
    } catch (caught: unknown) {
      setState({
        busy: false,
        message: caught instanceof Error ? caught.message : 'Could not send your account deletion request.',
        error: true
      });
    }
  };

  return (
    <InfoPage
      eyebrow="Account privacy"
      title="Delete your drop. account"
      intro="Delete your account in profile settings, or ask Drop operations for help when you cannot regain access."
    >
      <section>
        <h2>Delete it yourself</h2>
        <p>Account deletion is permanent. It signs you out everywhere, removes your donor profile and private account details, cancels active blood requests, and removes community posts you authored. Coordination and safety records that need to remain are anonymized.</p>
        {mobile ? <p className="mt-3">In the Android app, open Profile → Settings → Delete my account. You can also send the request below from this browser without reinstalling the app.</p> : user ? (
          <Link to="/profile/settings" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-50 px-5 py-3 font-bold text-red-700 hover:bg-red-100">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Open profile settings
          </Link>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/login?returnTo=%2Fprofile%2Fsettings" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-white hover:bg-primary-dark">
              Sign in to delete
            </Link>
            <Link to="/forgot-password" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-800 hover:bg-slate-200">
              <KeyRound className="h-4 w-4" aria-hidden="true" /> Reset password
            </Link>
          </div>
        )}
      </section>

        <section>
          <h2>Request deletion without signing in</h2>
          <p>If password recovery does not restore access, send an account deletion request below. Drop operations must verify that you control the registered phone before deleting the account. A submitted ticket starts the review; it does not delete the account immediately.</p>
          <GuidedForm aria-label="Request account deletion" onSubmit={submit} className="mt-5 space-y-4">
            <label className="grid gap-2">
              Name on the account
              <input required maxLength={100} autoComplete="name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className="rounded-xl border px-4 py-3" />
            </label>
            <label className="grid gap-2">
              Registered Bangladesh phone
              <input required type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} className="rounded-xl border px-4 py-3" />
            </label>
            <label className="grid gap-2">
              Account deletion details (optional)
              <textarea maxLength={1200} rows={4} value={form.details} onChange={event => setForm(current => ({ ...current, details: event.target.value }))} placeholder="Explain why you cannot use password recovery. Do not include a password, verification code, or patient details." className="w-full rounded-xl border px-4 py-3" />
            </label>
            <p className="text-xs text-slate-500">Operations may contact the registered phone and direct you through an official ownership check. Drop will never ask you to send a password or verification code in this form.</p>
            {state.message && <p role={state.error ? 'alert' : 'status'} aria-live="polite" className={`text-sm font-semibold ${state.error ? 'text-red-600' : 'text-green-700'}`}>{state.message}</p>}
            <button type="submit" disabled={state.busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-white hover:bg-primary-dark disabled:opacity-50">
              <Send className="h-4 w-4" aria-hidden="true" /> {state.busy ? 'Sending…' : 'Send deletion request'}
            </button>
          </GuidedForm>
        </section>

      <section>
        <h2>Imported donor listing</h2>
        <p>An imported donor listing is separate from a Drop account. To remove a phone number that came from a public donor source, use the <Link to="/directory/remove">listing removal page</Link>. No account is required.</p>
      </section>
    </InfoPage>
  );
}
