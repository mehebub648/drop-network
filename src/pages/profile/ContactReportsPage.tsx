import GuidedForm from '../../components/GuidedForm';
import Select from '../../components/Select';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, KeyRound, Phone, ShieldAlert } from 'lucide-react';
import OtpDeliveryStatus from '../../components/OtpDeliveryStatus';
import { EmptyState, StatusBadge, Surface } from '../../components/ui';
import { api, type OtpDelivery } from '../../lib/api';
import type { ProfilePageProps } from './types';

const LABELS: Record<string, string> = {
  WRONG_NUMBER: 'Wrong number',
  UNREACHABLE: 'Could not connect',
  DECLINED: 'Declined to donate',
  RECENTLY_DONATED: 'Recently donated',
  TOO_FAR: 'Too far away',
  HEALTH: 'Health-related inability'
};

type Inbox = {
  issues: Record<string, number>;
  suspended: boolean;
  suspended_at?: string;
  suspension_count?: number;
  disputes: Array<{ id: string; categories: string[]; created_at: string }>;
};

export default function ContactReportsPage({ user, onUpdate }: ProfilePageProps) {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phoneStep, setPhoneStep] = useState<'idle' | 'code'>('idle');
  const [delivery, setDelivery] = useState<OtpDelivery | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState('');
  const [disputeNote, setDisputeNote] = useState('');

  const load = async () => {
    const data = await api.getMyContactReports();
    setInbox(data);
  };

  useEffect(() => {
    let active = true;
    void load().catch(cause => active && setError(cause.message || 'Could not load contact reports.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const requestPhoneCode = async () => {
    setBusy(true); setError('');
    try {
      const result = await api.requestOtp(user.phone, 'CHANGE_PHONE');
      setDelivery(result); setCode(''); setPhoneStep('code');
      if (result.bypass && result.verification_token) {
        await api.reverifyContactPhone(result.verification_token);
        await Promise.all([load(), onUpdate()]);
        setPhoneStep('idle');
      }
    } catch (cause: any) { setError(cause.message || 'Could not send a verification code.'); }
    finally { setBusy(false); }
  };

  const verifyPhone = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const verified = await api.verifyOtp(user.phone, 'CHANGE_PHONE', code);
      await api.reverifyContactPhone(verified.verification_token);
      await Promise.all([load(), onUpdate()]);
      setPhoneStep('idle'); setDelivery(null); setCode('');
    } catch (cause: any) { setError(cause.message || 'The code is invalid or expired.'); }
    finally { setBusy(false); }
  };

  const dispute = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api.disputeContactReport(disputeCategory, disputeNote);
      await load(); setDisputeCategory(''); setDisputeNote('');
    } catch (cause: any) { setError(cause.message || 'Could not submit the dispute.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="surface h-64 animate-pulse" aria-label="Loading contact reports" />;
  const entries = Object.entries(inbox?.issues || {}).filter(([, count]) => count > 0);

  return (
    <div className="space-y-6">
      <header><p className="text-sm font-extrabold uppercase tracking-widest text-primary">Contact reliability</p><h2 className="mt-2 text-2xl font-extrabold text-slate-950">Contact reports</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">These are non-accusatory counts from verified requesters who opened your number through a real blood request. Their names and notes remain private.</p></header>
      {error && <div role="alert" className="alert alert-error">{error}</div>}
      {inbox?.suspended && <div className="alert alert-error"><ShieldAlert className="h-5 w-5" /><div><strong>Temporarily hidden from donor search</strong><p>{inbox.suspension_count || 3} distinct recent requesters could not use the contact number. Reverify it below to restore an otherwise available profile.</p></div></div>}

      {entries.length === 0 ? <EmptyState icon={CheckCircle2} title="No active contact warnings" description="Resolved reports remain in the private audit trail but no longer count on your profile." /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map(([category, count]) => <Surface key={category} className="p-5"><StatusBadge tone="warning" icon={ShieldAlert}>{count} verified requester{count === 1 ? '' : 's'}</StatusBadge><h3 className="mt-3 text-lg font-extrabold text-slate-950">{LABELS[category] || category}</h3><p className="mt-2 text-sm leading-6 text-slate-600">Correct the relevant profile detail to mark earlier evidence stale, or dispute it for staff review.</p></Surface>)}
        </div>
      )}

      {(inbox?.issues.WRONG_NUMBER || inbox?.issues.UNREACHABLE || inbox?.suspended) && <Surface className="p-6"><h3 className="text-lg font-extrabold text-slate-950">Reverify {user.phone}</h3><p className="mt-2 text-sm text-slate-600">A fresh Messavo code clears earlier wrong-number and connection warnings and restores an automatically suspended profile.</p>{phoneStep === 'idle' ? <button type="button" disabled={busy} onClick={() => void requestPhoneCode()} className="primary-button mt-5"><Phone className="h-4 w-4" />Send verification code</button> : <GuidedForm onSubmit={verifyPhone} className="mt-5 space-y-4"><OtpDeliveryStatus delivery={delivery} onDeliveryChange={setDelivery} busy={busy} onResend={() => void requestPhoneCode()} /><label className="block"><span className="mb-2 block text-sm font-bold">Six-digit code</span><input required autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className="input" /></label><button disabled={busy || code.length !== 6} className="primary-button"><KeyRound className="h-4 w-4" />Verify and clear</button></GuidedForm>}</Surface>}

      {entries.length > 0 && <Surface className="p-6"><h3 className="text-lg font-extrabold text-slate-950">Smart ways to resolve other warnings</h3><p className="mt-2 text-sm leading-6 text-slate-600">Reconfirm availability to clear decline warnings, update donation history for recently-donated reports, update area preferences for distance reports, or return to available after a health pause.</p><div className="mt-4 flex flex-wrap gap-3"><Link to="/profile/donor" className="theme-button">Update donor profile</Link><Link to="/profile/history" className="theme-button">Update donation history</Link></div></Surface>}

      {entries.length > 0 && <Surface className="p-6"><h3 className="text-lg font-extrabold text-slate-950">Dispute an unresolved report</h3><p className="mt-2 text-sm text-slate-600">Staff sees the aggregate pattern and your private explanation, not a public argument.</p><GuidedForm onSubmit={dispute} className="mt-5 space-y-4"><label className="block"><span className="mb-2 block text-sm font-bold">Category</span><Select required value={disputeCategory} onChange={event => setDisputeCategory(event.target.value)} className="input"><option value="">Choose category</option>{entries.map(([category]) => <option key={category} value={category}>{LABELS[category] || category}</option>)}</Select></label><label className="block"><span className="mb-2 block text-sm font-bold">Private explanation</span><textarea required minLength={10} maxLength={300} value={disputeNote} onChange={event => setDisputeNote(event.target.value)} className="input min-h-28" /></label><button disabled={busy} className="primary-button">Send for staff review</button></GuidedForm></Surface>}
    </div>
  );
}
