import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Copy, Share2, UserRoundPlus } from 'lucide-react';
import { api } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES } from '../lib/locations';
import { getUpazilasForDistrict } from '../lib/upazilas';
import { PageHeader, StatusBadge, Surface } from '../components/ui';

export default function ContributeDonorPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [claimPath, setClaimPath] = useState('');
  const upazilas = useMemo(() => getUpazilasForDistrict(district), [district]);
  const claimUrl = claimPath ? `${window.location.origin}${claimPath}` : '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.contributeDonor({
        name,
        phone,
        blood_group: bloodGroup || undefined,
        district: district || undefined,
        upazila: upazila || undefined,
        website
      });
      setClaimPath(result.claim_path);
    } catch (cause: any) {
      setError(cause.message || 'The private suggestion could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const copy = () => void navigator.clipboard?.writeText(claimUrl);
  const share = () => {
    if (navigator.share) {
      void navigator.share({
        title: 'Confirm your Drop donor profile',
        text: 'Please verify and review this private donor profile. Nothing is public until you consent.',
        url: claimUrl
      });
    } else copy();
  };

  if (claimPath) {
    return (
      <Surface className="mx-auto max-w-2xl border-green-200 bg-green-50/60 p-7 sm:p-9">
        <CheckCircle2 className="h-12 w-12 text-green-700" aria-hidden="true" />
        <h1 className="mt-5 text-2xl font-extrabold text-slate-950">Private claim link ready</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Share this link directly with the donor. Drop has not sent them a message and the suggestion is not searchable. It expires after 30 days unless they verify and consent.</p>
        <div className="mt-5 break-all rounded-2xl border border-green-200 bg-white p-4 font-mono text-sm font-bold text-slate-800">{claimUrl}</div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={share} className="primary-button"><Share2 className="h-4 w-4" />Share link</button>
          <button type="button" onClick={copy} className="theme-button"><Copy className="h-4 w-4" />Copy link</button>
          <button type="button" onClick={() => { setClaimPath(''); setName(''); setPhone(''); }} className="theme-button">Add another</button>
        </div>
      </Surface>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7 pb-12">
      <PageHeader
        eyebrow="Community contribution"
        title="Suggest a donor privately"
        description="Anyone can help add a donor. The entry stays hidden until the phone owner opens the claim link, verifies their number, confirms every detail, and consents."
        icon={UserRoundPlus}
      />
      <form onSubmit={submit} className="surface p-6 sm:p-8">
        <StatusBadge tone="success" icon={CheckCircle2}>No unsolicited SMS · not searchable</StatusBadge>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">Donor name</span><input required maxLength={100} value={name} onChange={event => setName(event.target.value)} className="input" /></label>
          <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">Donor Bangladesh mobile</span><input required type="tel" inputMode="tel" autoComplete="off" placeholder="01XXXXXXXXX" value={phone} onChange={event => setPhone(event.target.value)} className="input" /></label>
          <label><span className="mb-2 block text-sm font-bold text-slate-700">Blood group <span className="font-medium text-slate-400">(optional)</span></span><select value={bloodGroup} onChange={event => setBloodGroup(event.target.value)} className="input"><option value="">Owner will confirm</option>{BLOOD_GROUPS.map(group => <option key={group}>{group}</option>)}</select></label>
          <label><span className="mb-2 block text-sm font-bold text-slate-700">District <span className="font-medium text-slate-400">(optional)</span></span><select value={district} onChange={event => { setDistrict(event.target.value); setUpazila(''); }} className="input"><option value="">Owner will confirm</option>{BD_LOCATION_NAMES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">Upazila <span className="font-medium text-slate-400">(optional)</span></span><select disabled={!district} value={upazila} onChange={event => setUpazila(event.target.value)} className="input"><option value="">Owner will confirm</option>{upazilas.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label>
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-600">You receive a private link to share yourself. Drop does not contact the donor merely because you entered their number.</p>
        {error && <div role="alert" className="alert alert-error mt-5">{error}</div>}
        <button disabled={busy} className="primary-button mt-6">{busy ? 'Creating private link…' : 'Create private claim link'}</button>
      </form>
    </div>
  );
}
