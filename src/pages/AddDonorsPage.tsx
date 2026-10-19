import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, FileText, Send, UploadCloud, UserRoundPlus } from 'lucide-react';
import GuidedForm from '../components/GuidedForm';
import Select from '../components/Select';
import { PageHeader, StatusBadge, Surface } from '../components/ui';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES } from '../lib/locations';
import { getUpazilasForDistrict } from '../lib/upazilas';
import { api } from '../lib/api';
import type { ContributionBatch } from '../lib/invitationTypes';

const MAX_BATCH_BYTES = 50 * 1024 * 1024;
type Mode = 'single' | 'bulk';

function humanFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function contributionContentType(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ({
    txt: 'text/plain', csv: 'text/csv', pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  } as Record<string, string>)[extension || ''] || 'application/octet-stream';
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function BatchStatus({ status }: { status: ContributionBatch['status'] }) {
  const label = ({
    DRAFT: 'Draft', SUBMITTED: 'Waiting for review', IN_REVIEW: 'In review',
    APPROVED: 'Approved', NEEDS_CHANGES: 'Needs changes', REJECTED: 'Rejected'
  } as const)[status];
  return <span className="admin-badge">{label}</span>;
}

export default function AddDonorsPage() {
  const [mode, setMode] = useState<Mode>('single');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [batches, setBatches] = useState<ContributionBatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const upazilas = useMemo(() => getUpazilasForDistrict(district), [district]);
  const pastedTextBytes = new TextEncoder().encode(pastedText.trim()).byteLength;
  const totalBytes = pastedTextBytes + files.reduce((sum, file) => sum + file.size, 0);

  useEffect(() => {
    api.getMyContributionBatches()
      .then(result => setBatches(result.batches || []))
      .catch(() => undefined);
  }, []);

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = [...(event.target.files || [])];
    setFiles(current => {
      const next = [...current, ...selected];
      const unique = new Map(next.map(file => [`${file.name}:${file.size}:${file.lastModified}`, file]));
      return [...unique.values()];
    });
    event.target.value = '';
  };

  const sendSingle = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api.createMyDonorContribution({
        name, phone, blood_group: bloodGroup || undefined,
        district: district || undefined, upazila: upazila || undefined
      });
      if (!result.invitation) setMessage(result.message || 'This number cannot be invited.');
      else {
        const delivery = String(result.invitation.delivery?.status || result.invitation.delivery_status || result.invitation.status || 'QUEUED').toLowerCase();
        setMessage(result.message || `Private invitation ${delivery}. The profile stays hidden until the phone owner verifies and consents.`);
      }
      setName(''); setPhone(''); setBloodGroup(''); setDistrict(''); setUpazila('');
    } catch (caught: any) {
      setError(caught.message || 'The invitation could not be sent.');
    } finally { setBusy(false); }
  };

  const submitBatch = async (event: FormEvent) => {
    event.preventDefault();
    if (!pastedText.trim() && files.length === 0) {
      setError('Paste donor details or add at least one file.');
      return;
    }
    if (totalBytes > MAX_BATCH_BYTES) {
      setError('Pasted text and files must be 50 MB or less in total.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const created = await api.createMyContributionBatch({
        pasted_text: pastedText.trim() || undefined,
        note: note.trim() || undefined,
        files: files.map(file => ({ name: file.name, content_type: contributionContentType(file), size_bytes: file.size }))
      });
      const batch: ContributionBatch = created.batch;
      for (const [index, file] of files.entries()) {
        const allocation = batch.files[index];
        if (!allocation) throw new Error('The server did not prepare every file upload.');
        await api.uploadMyContributionBatchFile(batch.id, allocation.id, file, await sha256(file), contributionContentType(file));
      }
      const submitted = await api.submitMyContributionBatch(batch.id);
      setBatches(current => [submitted.batch, ...current.filter(item => item.id !== batch.id)]);
      setPastedText(''); setNote(''); setFiles([]);
      setMessage('Your list is waiting for admin review. No invitations will be sent before it is approved.');
    } catch (caught: any) {
      setError(caught.message || 'The donor list could not be submitted.');
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-12">
      <PageHeader
        eyebrow="Grow the donor circle"
        title="Add donors"
        description="Invite one person now, or send a larger list for careful staff review."
        icon={UserRoundPlus}
      />

      <div className="grid gap-4 sm:grid-cols-2" role="tablist" aria-label="Choose how to add donors">
        <button type="button" role="tab" aria-selected={mode === 'single'} onClick={() => setMode('single')} className={`surface text-left p-5 transition ${mode === 'single' ? 'ring-2 ring-primary' : 'hover:border-primary/40'}`}>
          <span className="mb-3 inline-flex rounded-2xl bg-rose-50 p-3 text-primary"><Send className="h-6 w-6" /></span>
          <strong className="block text-lg text-slate-950">Invite one person</strong>
          <span className="mt-1 block text-sm leading-6 text-slate-600">Send one private invitation immediately.</span>
        </button>
        <button type="button" role="tab" aria-selected={mode === 'bulk'} onClick={() => setMode('bulk')} className={`surface text-left p-5 transition ${mode === 'bulk' ? 'ring-2 ring-primary' : 'hover:border-primary/40'}`}>
          <span className="mb-3 inline-flex rounded-2xl bg-sky-50 p-3 text-sky-700"><FileText className="h-6 w-6" /></span>
          <strong className="block text-lg text-slate-950">Send a list for review</strong>
          <span className="mt-1 block text-sm leading-6 text-slate-600">Paste details or add files. Staff checks them before anything is sent.</span>
        </button>
      </div>

      {message && <div className="alert alert-success" role="status"><CheckCircle2 className="h-5 w-5" />{message}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {mode === 'single' ? (
        <GuidedForm onSubmit={sendSingle} className="surface p-6 sm:p-8">
          <StatusBadge tone="brand" icon={Send}>One private message</StatusBadge>
          <h2 className="mt-5 text-2xl font-extrabold text-slate-950">Who would you like to invite?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Drop will send one private invitation now. The profile stays hidden until the phone owner verifies and consents.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">Name</span><input className="input" value={name} onChange={event => setName(event.target.value)} required maxLength={100} /></label>
            <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">Bangladesh mobile</span><input className="input" value={phone} onChange={event => setPhone(event.target.value)} required type="tel" inputMode="tel" placeholder="01XXXXXXXXX" /></label>
            <label><span className="mb-2 block text-sm font-bold text-slate-700">Blood group <span className="font-medium text-slate-400">(optional)</span></span><Select className="input" value={bloodGroup} onChange={event => setBloodGroup(event.target.value)}><option value="">Owner will confirm</option>{BLOOD_GROUPS.map(group => <option key={group}>{group}</option>)}</Select></label>
            <label><span className="mb-2 block text-sm font-bold text-slate-700">District <span className="font-medium text-slate-400">(optional)</span></span><Select className="input" value={district} onChange={event => { setDistrict(event.target.value); setUpazila(''); }}><option value="">Owner will confirm</option>{BD_LOCATION_NAMES.map(item => <option key={item}>{item}</option>)}</Select></label>
            <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">Upazila <span className="font-medium text-slate-400">(optional)</span></span><Select className="input" disabled={!district} value={upazila} onChange={event => setUpazila(event.target.value)}><option value="">Owner will confirm</option>{upazilas.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label>
          </div>
          <button className="primary-button mt-6" disabled={busy}>{busy ? 'Sending invitation…' : 'Send private invitation'}</button>
        </GuidedForm>
      ) : (
        <GuidedForm onSubmit={submitBatch} className="surface p-6 sm:p-8">
          <StatusBadge tone="success" icon={UploadCloud}>Admin review first</StatusBadge>
          <h2 className="mt-5 text-2xl font-extrabold text-slate-950">Share the donor information you have</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Names, numbers and locations in any readable order are fine. Nothing is added or invited automatically.</p>
          <label className="mt-6 block"><span className="mb-2 block text-sm font-bold text-slate-700">Paste donor details</span><textarea className="input min-h-44" value={pastedText} onChange={event => setPastedText(event.target.value)} placeholder={'Example:\nRahim, 017…, B+, Savar\nKarima, 018…, O-, Meherpur'} /></label>
          <label className="mt-5 block"><span className="mb-2 block text-sm font-bold text-slate-700">Note for the reviewer <span className="font-medium text-slate-400">(optional)</span></span><textarea className="input min-h-24" value={note} onChange={event => setNote(event.target.value)} maxLength={1000} /></label>
          <div className="mt-5 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-5">
            <label className="button button-secondary cursor-pointer"><UploadCloud className="h-4 w-4" />Add files<input className="sr-only" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.docx,.xlsx" onChange={chooseFiles} /></label>
            <p className="mt-3 text-sm text-slate-600">Images, PDFs, text, documents or spreadsheets · 50 MB total including pasted text</p>
            {files.length > 0 && <ul className="mt-4 space-y-2">{files.map(file => <li key={`${file.name}:${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"><span className="truncate font-semibold text-slate-800">{file.name}</span><span className="flex shrink-0 items-center gap-3 text-slate-500">{humanFileSize(file.size)}<button type="button" className="font-bold text-primary" onClick={() => setFiles(current => current.filter(item => item !== file))}>Remove</button></span></li>)}</ul>}
            <div className={`mt-4 text-sm font-bold ${totalBytes > MAX_BATCH_BYTES ? 'text-red-700' : 'text-slate-700'}`}>{humanFileSize(totalBytes)} of 50 MB</div>
          </div>
          <button className="primary-button mt-6" disabled={busy || totalBytes > MAX_BATCH_BYTES}>{busy ? 'Uploading for review…' : 'Send to admin review'}</button>
        </GuidedForm>
      )}

      {batches.length > 0 && <Surface className="p-6 sm:p-7"><h2 className="text-xl font-extrabold text-slate-950">Your recent lists</h2><div className="mt-4 space-y-3">{batches.slice(0, 5).map(batch => <div key={batch.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-slate-900">{batch.files.length} file{batch.files.length === 1 ? '' : 's'}{batch.pasted_text ? ' + pasted details' : ''}</strong><p className="mt-1 text-sm text-slate-500">Sent {new Date(batch.submitted_at || batch.created_at).toLocaleString()}</p></div><BatchStatus status={batch.status} /></div>)}</div></Surface>}
    </div>
  );
}
