import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Calendar, Edit2, ImagePlus, LoaderCircle, Plus, Save, Share2, Trash2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../lib/api';
import { donorProfilePayload } from './profileUtils';
import type { DonationRecord, ProfilePageProps } from './types';

type ConfirmedRequest = { id: string; label: string };

export default function HistoryPage({ user, onUpdate }: ProfilePageProps) {
  const navigate = useNavigate();
  const [records, setRecords] = useState<DonationRecord[]>(user.donor_profile?.donation_history || []);
  const [confirmedRequests, setConfirmedRequests] = useState<ConfirmedRequest[]>([]);
  const [editingId, setEditingId] = useState('');
  const [date, setDate] = useState('');
  const [organization, setOrganization] = useState('');
  const [note, setNote] = useState('');
  const [requestId, setRequestId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sharingId, setSharingId] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [shareText, setShareText] = useState('');
  const [includeDate, setIncludeDate] = useState(true);
  const [includeOrganization, setIncludeOrganization] = useState(true);
  const [includeTotal, setIncludeTotal] = useState(true);
  const [includeText, setIncludeText] = useState(true);
  const [shareImage, setShareImage] = useState<File | null>(null);
  const [shareImageAlt, setShareImageAlt] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => setRecords(user.donor_profile?.donation_history || []), [user]);
  useEffect(() => {
    let active = true;
    api.getInvitations().then((responses: any[]) => {
      if (!active) return;
      setConfirmedRequests(responses
        .filter(response => response.donor_id === user.id && response.status === 'DONATED' && response.donor_confirmed_at && response.requester_confirmed_at)
        .map(response => ({
          id: response.request_id,
          label: `${response.request?.hospital_name || 'Drop request'} · ${response.request?.blood_group || 'blood'}${response.request?.needed_by ? ` · ${new Date(response.request.needed_by).toLocaleDateString()}` : ''}`
        })));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user.id]);

  const baseline = user.donor_profile?.donations_before_history
    ?? Math.max(0, (user.donor_profile?.donation_count || 0) - (user.donor_profile?.donation_history?.length || 0));
  const total = baseline + records.length;
  const shareRecord = useMemo(() => records.find(record => record.id === sharingId), [records, sharingId]);

  const resetForm = () => {
    setEditingId('');
    setDate('');
    setOrganization('');
    setNote('');
    setRequestId('');
  };

  const closeShare = () => {
    setSharingId('');
    setShareTitle('');
    setShareText('');
    setIncludeDate(true);
    setIncludeOrganization(true);
    setIncludeTotal(true);
    setIncludeText(true);
    setShareImage(null);
    setShareImageAlt('');
  };

  const persist = async (next: DonationRecord[], success: string) => {
    const latestRecordDate = next.map(record => record.date).sort().pop();
    setSaving(true);
    setMessage(null);
    try {
      await api.updateDonorProfile(donorProfilePayload(user, {
        donation_history: next,
        donations_before_history: baseline,
        ...(latestRecordDate ? {
          last_donation: { kind: 'EXACT', date: latestRecordDate },
          last_donation_date: latestRecordDate
        } : {})
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
    const record: DonationRecord = {
      id: editingId || `manual-${Date.now()}`,
      date,
      organization: organization.trim(),
      source: 'SELF_REPORTED',
      confirmation_status: 'SELF_REPORTED',
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(requestId ? { request_id: requestId } : {})
    };
    const next = editingId ? records.map(item => item.id === editingId ? record : item) : [...records, record];
    await persist(next, editingId ? 'Donation record updated.' : 'Donation record added.');
  };

  const edit = (record: DonationRecord) => {
    setEditingId(record.id);
    setDate(record.date.slice(0, 10));
    setOrganization(record.organization);
    setNote(record.note || '');
    setRequestId(record.request_id || '');
    setMessage(null);
  };

  const openShare = (record: DonationRecord) => {
    setSharingId(record.id);
    setShareTitle(`My donation at ${record.organization}`.slice(0, 120));
    setShareText('');
    setMessage(null);
  };

  const createShareDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!shareRecord) return;
    if (includeText && shareText.trim().length < 80) {
      return setMessage({ type: 'error', text: 'Write at least 80 characters for the public story, or leave story text unchecked.' });
    }
    if (shareImage && !shareImageAlt.trim()) {
      return setMessage({ type: 'error', text: 'Describe the selected image for people using screen readers.' });
    }
    setSharing(true);
    setMessage(null);
    try {
      let draft = await api.createDonationShareDraft(shareRecord.id, {
        title: shareTitle.trim(),
        text: shareText.trim(),
        include_text: includeText,
        include_date: includeDate,
        include_organization: includeOrganization,
        include_total: includeTotal
      });
      if (shareImage) draft = await api.uploadCommunityPostImage(draft.id, shareImage, shareImageAlt.trim());
      navigate(`/community/new?draft=${encodeURIComponent(draft.id)}`);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Could not prepare the donation story.' });
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="theme-card border border-slate-100 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-2xl font-extrabold tracking-tight">Donation history</h2><p className="mt-1 text-slate-500">Exact records and notes stay private. Only your total is shown on donor cards.</p></div>
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-rose-900"><strong className="block text-2xl">{total}</strong><span className="text-xs font-bold">total donation{total === 1 ? '' : 's'}</span></div>
        </div>
        <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="donation-date" className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Date</label><input id="donation-date" type="date" required max={new Date().toISOString().slice(0, 10)} value={date} onChange={event => setDate(event.target.value)} className="input" /></div>
          <div><label htmlFor="donation-organization" className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Hospital or organization</label><input id="donation-organization" required maxLength={120} value={organization} onChange={event => setOrganization(event.target.value)} placeholder="e.g. Dhaka Medical College Hospital" className="input" /></div>
          <div><label htmlFor="donation-request" className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Linked Drop request (optional)</label><select id="donation-request" value={requestId} onChange={event => setRequestId(event.target.value)} className="input"><option value="">Not linked</option>{confirmedRequests.filter(request => request.id === requestId || !records.some(record => record.id !== editingId && record.request_id === request.id)).map(request => <option key={request.id} value={request.id}>{request.label}</option>)}</select></div>
          <div><label htmlFor="donation-note" className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Private note (optional)</label><input id="donation-note" maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="Visible only to you" className="input" /></div>
          <div className="flex gap-2 sm:col-span-2"><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-bold text-white hover:bg-primary-dark disabled:opacity-50">{editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingId ? 'Update record' : 'Add record'}</button>{editingId && <button type="button" onClick={resetForm} className="min-h-11 rounded-xl bg-slate-100 px-4 font-bold">Cancel</button>}</div>
        </form>
        {message && <p className={message.type === 'success' ? 'mt-4 text-green-700 font-bold text-sm' : 'mt-4 text-red-700 font-bold text-sm'} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      </div>

      <div className="theme-card border border-slate-100 p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-extrabold"><Calendar className="h-5 w-5 text-primary" /> Past donations</h2><span className="text-sm font-bold text-slate-500">{records.length} detailed record{records.length === 1 ? '' : 's'}</span></div>
        {records.length === 0 ? <p className="py-10 text-center text-slate-500">No donation records yet.</p> : (
          <ol className="mt-5 space-y-3">
            {[...records].sort((a, b) => b.date.localeCompare(a.date)).map(record => (
              <li key={record.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start gap-4">
                  <div className="mt-2 h-3 w-3 flex-shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{record.organization}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-600">{(record.confirmation_status || 'SELF_REPORTED').replaceAll('_', ' ')}</span></div><time className="text-sm text-slate-500" dateTime={record.date}>{new Date(`${record.date}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</time>{record.note && <p className="mt-2 text-sm text-slate-600"><span className="font-bold">Private note:</span> {record.note}</p>}{record.request_id && <Link to={`/request/${record.request_id}`} className="mt-2 inline-flex text-xs font-bold text-primary hover:underline">View linked Drop request</Link>}</div>
                  <div className="flex flex-wrap justify-end gap-1"><button type="button" onClick={() => openShare(record)} aria-label={`Share donation at ${record.organization}`} className="p-2 text-primary hover:text-primary-dark"><Share2 className="h-4 w-4" /></button>{record.source !== 'DROP_REQUEST' && <><button type="button" onClick={() => edit(record)} aria-label={`Edit donation at ${record.organization}`} className="p-2 text-slate-500 hover:text-slate-900"><Edit2 className="h-4 w-4" /></button><button type="button" disabled={saving} onClick={() => persist(records.filter(item => item.id !== record.id), 'Donation record deleted.')} aria-label={`Delete donation at ${record.organization}`} className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></>}</div>
                </div>
                {sharingId === record.id && (
                  <form onSubmit={createShareDraft} className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3"><div><h3 className="font-extrabold text-slate-950">Prepare a public donation story</h3><p className="mt-1 text-xs leading-5 text-slate-600">Nothing publishes yet. Review the private draft on the next screen.</p></div><button type="button" onClick={closeShare} aria-label="Close share form" className="p-2 text-slate-500"><X className="h-4 w-4" /></button></div>
                    <div className="mt-4 grid gap-4">
                      <div><label htmlFor={`share-title-${record.id}`} className="text-xs font-bold uppercase tracking-widest text-slate-500">Public title</label><input id={`share-title-${record.id}`} required minLength={8} maxLength={120} value={shareTitle} onChange={event => setShareTitle(event.target.value)} className="input mt-2" /></div>
                      <div><label htmlFor={`share-text-${record.id}`} className="text-xs font-bold uppercase tracking-widest text-slate-500">Your public story</label><textarea id={`share-text-${record.id}`} disabled={!includeText} required={includeText} minLength={80} maxLength={5000} rows={5} value={shareText} onChange={event => setShareText(event.target.value)} className="input mt-2 resize-y" placeholder="Describe the experience without patient names, contacts, records, or medical details." /></div>
                      <fieldset><legend className="text-xs font-bold uppercase tracking-widest text-slate-500">Choose exactly what the draft may include</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 text-sm font-semibold"><input type="checkbox" checked={includeText} onChange={event => setIncludeText(event.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary" />My story text</label>
                        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 text-sm font-semibold"><input type="checkbox" checked={includeDate} onChange={event => setIncludeDate(event.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary" />Donation date</label>
                        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 text-sm font-semibold"><input type="checkbox" checked={includeOrganization} onChange={event => setIncludeOrganization(event.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary" />Organization or facility</label>
                        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 text-sm font-semibold"><input type="checkbox" checked={includeTotal} onChange={event => setIncludeTotal(event.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary" />My total ({total})</label>
                      </div></fieldset>
                      <div><label htmlFor={`share-image-${record.id}`} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold"><ImagePlus className="h-4 w-4" />{shareImage ? shareImage.name : 'Choose optional image'}<input id={`share-image-${record.id}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setShareImage(event.target.files?.[0] || null)} className="sr-only" /></label>{shareImage && <input required maxLength={180} value={shareImageAlt} onChange={event => setShareImageAlt(event.target.value)} placeholder="Describe the image for screen readers" className="input mt-2" />}</div>
                      <p className="rounded-xl bg-white px-4 py-3 text-xs leading-5 text-slate-600">Private notes, linked request details, patient information, contact numbers, and medical information are never copied into the draft.</p>
                      <button disabled={sharing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-white disabled:opacity-60 sm:justify-self-start">{sharing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}{sharing ? 'Preparing draft…' : 'Review share draft'}</button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
