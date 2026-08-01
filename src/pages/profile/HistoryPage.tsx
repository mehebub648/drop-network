import { useEffect, useState, type FormEvent } from 'react';
import { Calendar, Edit2, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { donorProfilePayload } from './profileUtils';
import type { DonationRecord, ProfilePageProps } from './types';

export default function HistoryPage({ user, onUpdate }: ProfilePageProps) {
  const [records, setRecords] = useState<DonationRecord[]>(user.donor_profile?.donation_history || []);
  const [editingId, setEditingId] = useState('');
  const [date, setDate] = useState('');
  const [organization, setOrganization] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => setRecords(user.donor_profile?.donation_history || []), [user]);

  const resetForm = () => {
    setEditingId('');
    setDate('');
    setOrganization('');
  };

  const persist = async (next: DonationRecord[], success: string) => {
    const latestRecordDate = next.map(record => record.date).sort().pop();
    const knownLifetimeCount = user.donor_profile?.donation_count;
    const donationCount = Math.max(knownLifetimeCount ?? 0, next.length);
    setSaving(true);
    setMessage(null);
    try {
      await api.updateDonorProfile(donorProfilePayload(user, {
        donation_history: next,
        // A remaining detailed record is an exact self-declared date. When the
        // final detail is deleted, preserve the separately known summary and
        // lifetime count instead of pretending the donor never donated.
        ...(latestRecordDate ? {
          last_donation: { kind: 'EXACT', date: latestRecordDate },
          last_donation_date: latestRecordDate,
          donation_count: Math.max(1, donationCount)
        } : {
          donation_count: knownLifetimeCount
        })
      }));
      setRecords(next);
      await onUpdate();
      setMessage({ type: 'success', text: success });
      resetForm();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Could not update donation history.' });
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const selected = new Date(`${date}T00:00:00`);
    if (!date || Number.isNaN(selected.getTime()) || selected.getTime() > Date.now()) {
      return setMessage({ type: 'error', text: 'Choose a valid date that is not in the future.' });
    }
    if (!organization.trim()) return setMessage({ type: 'error', text: 'Enter the hospital or organization.' });
    const record = { id: editingId || `manual-${Date.now()}`, date, organization: organization.trim() };
    const next = editingId ? records.map(item => item.id === editingId ? record : item) : [...records, record];
    await persist(next, editingId ? 'Donation record updated.' : 'Donation record added.');
  };

  const edit = (record: DonationRecord) => {
    setEditingId(record.id);
    setDate(record.date.slice(0, 10));
    setOrganization(record.organization);
    setMessage(null);
  };

  return (
    <div className="space-y-6">
      <div className="theme-card border border-slate-100 p-6 sm:p-8">
        <h2 className="text-2xl font-extrabold tracking-tight">Donation history</h2>
        <p className="text-slate-500 mt-1">Maintain dates used by your eligibility reminder.</p>
        <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
          <div>
            <label htmlFor="donation-date" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Date</label>
            <input id="donation-date" type="date" required max={new Date().toISOString().slice(0, 10)} value={date} onChange={event => setDate(event.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label htmlFor="donation-organization" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Hospital or organization</label>
            <input id="donation-organization" required maxLength={120} value={organization} onChange={event => setOrganization(event.target.value)} placeholder="e.g. Dhaka Medical College Hospital" className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex gap-2">
            <button disabled={saving} className="px-4 py-3 bg-slate-900 text-white rounded-xl font-bold inline-flex items-center gap-2 disabled:opacity-50">{editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{editingId ? 'Update' : 'Add'}</button>
            {editingId && <button type="button" onClick={resetForm} className="px-3 py-3 bg-slate-100 rounded-xl font-bold">Cancel</button>}
          </div>
        </form>
        {message && <p className={message.type === 'success' ? 'mt-4 text-green-700 font-bold text-sm' : 'mt-4 text-red-600 font-bold text-sm'}>{message.text}</p>}
      </div>

      <div className="theme-card border border-slate-100 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> Past donations</h2>
          <span className="text-sm font-bold text-slate-400">{records.length} detailed record{records.length === 1 ? '' : 's'}</span>
        </div>
        {records.length === 0 ? (
          <p className="py-10 text-center text-slate-500">No donation records yet.</p>
        ) : (
          <ol className="mt-5 space-y-3">
            {[...records].sort((a, b) => b.date.localeCompare(a.date)).map(record => (
              <li key={record.id} className="rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">{record.organization}</p>
                  <time className="text-sm text-slate-500">{new Date(`${record.date}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</time>
                </div>
                <button type="button" onClick={() => edit(record)} aria-label={`Edit donation at ${record.organization}`} className="p-2 text-slate-500 hover:text-slate-900"><Edit2 className="w-4 h-4" /></button>
                <button type="button" disabled={saving} onClick={() => persist(records.filter(item => item.id !== record.id), 'Donation record deleted.')} aria-label={`Delete donation at ${record.organization}`} className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
