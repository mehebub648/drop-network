import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, FileSearch, Gauge, MailCheck, Play, RefreshCw, RotateCcw, UsersRound, XCircle } from 'lucide-react';
import GuidedForm from './GuidedForm';
import Select from './Select';
import { api } from '../lib/api';
import type {
  ContributionBatch,
  DonorInvitation,
  InvitationCampaign,
  InvitationDeliveryStatus,
  InvitationOutcome,
  InvitationPacing,
  ReviewedDonorInput
} from '../lib/invitationTypes';

type View = 'campaigns' | 'delivery' | 'review';
type CampaignMode = 'INSTANT' | 'RAMPED';

const gentlePacing: InvitationPacing = { start_per_minute: 2, peak_per_minute: 8, end_per_minute: 2, ramp_up_minutes: 10, steady_minutes: 30, ramp_down_minutes: 10 };
const balancedPacing: InvitationPacing = { start_per_minute: 4, peak_per_minute: 15, end_per_minute: 4, ramp_up_minutes: 10, steady_minutes: 20, ramp_down_minutes: 10 };
const fastPacing: InvitationPacing = { start_per_minute: 8, peak_per_minute: 30, end_per_minute: 8, ramp_up_minutes: 5, steady_minutes: 15, ramp_down_minutes: 5 };

const deliveryOptions: Array<{ value: '' | InvitationDeliveryStatus; label: string }> = [
  { value: '', label: 'Every delivery state' }, { value: 'QUEUED', label: 'Queued' },
  { value: 'SENT', label: 'Sent' }, { value: 'DELIVERED', label: 'Delivered' },
  { value: 'FAILED', label: 'Failed' }, { value: 'UNKNOWN', label: 'Status unknown' },
  { value: 'CANCELED', label: 'Canceled' }
];
const outcomeOptions: Array<{ value: '' | InvitationOutcome; label: string }> = [
  { value: '', label: 'Every response' }, { value: 'NO_RESPONSE', label: 'Not responded' },
  { value: 'CLAIMED', label: 'Invitation accepted' }, { value: 'REJECTED_REMOVED', label: 'Number removed' },
  { value: 'PHONE_CHANGED', label: 'Phone changed' }, { value: 'SEPARATE_ACCOUNT', label: 'Separate account created' },
  { value: 'PENDING', label: 'Pending' }
];

function humanize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/(^|\s)\S/g, character => character.toUpperCase());
}
function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : 'Not yet';
}
function parseReviewedDonors(value: string): ReviewedDonorInput[] {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    const [name = '', phone = '', blood_group = '', district = '', upazila = ''] = line.split(/\t|\||,/).map(item => item.trim());
    if (!name || !phone) throw new Error(`Row ${index + 1} needs at least a name and phone number.`);
    return { name, phone, ...(blood_group ? { blood_group } : {}), ...(district ? { district } : {}), ...(upazila ? { upazila } : {}) };
  });
}

export default function AdminInvitationsPanel() {
  const [view, setView] = useState<View>('campaigns');
  const [campaigns, setCampaigns] = useState<InvitationCampaign[]>([]);
  const [invitations, setInvitations] = useState<DonorInvitation[]>([]);
  const [batches, setBatches] = useState<ContributionBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ContributionBatch | null>(null);
  const [selectedInvitationIds, setSelectedInvitationIds] = useState<string[]>([]);
  const [deliveryStatus, setDeliveryStatus] = useState<'' | InvitationDeliveryStatus>('');
  const [outcome, setOutcome] = useState<'' | InvitationOutcome>('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [label, setLabel] = useState('');
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<CampaignMode>('RAMPED');
  const [pacing, setPacing] = useState<InvitationPacing>(balancedPacing);
  const [reviewRows, setReviewRows] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCampaigns = async () => {
    const result = await api.getAdminInvitationCampaigns();
    setCampaigns(result.campaigns);
  };
  const loadInvitations = async () => {
    const result = await api.getAdminInvitations({ delivery_status: deliveryStatus || undefined, outcome: outcome || undefined, campaign_id: campaignFilter || undefined });
    setInvitations(result.invitations || result || []);
    setSelectedInvitationIds([]);
  };
  const loadBatches = async () => {
    const result = await api.getAdminContributionBatches();
    setBatches(result.batches);
  };
  const loadCurrent = async () => {
    setLoading(true); setError('');
    try {
      if (view === 'campaigns') await loadCampaigns();
      if (view === 'delivery') await Promise.all([loadCampaigns(), loadInvitations()]);
      if (view === 'review') await loadBatches();
    } catch (caught: any) { setError(caught.message || 'Could not load invitation operations.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadCurrent(); }, [view]);

  const campaignTotals = useMemo(() => campaigns.reduce((totals, campaign) => ({
    selected: totals.selected + Number(campaign.counts?.selected || 0),
    delivered: totals.delivered + Number(campaign.counts?.delivered || 0),
    claimed: totals.claimed + Number(campaign.counts?.claimed || 0)
  }), { selected: 0, delivered: 0, claimed: 0 }), [campaigns]);

  const createCampaign = async (event: FormEvent) => {
    event.preventDefault(); setBusy('create'); setError(''); setNotice('');
    try {
      const created = await api.createAdminInvitationCampaign({
        label, count, mode, ...(mode === 'RAMPED' ? { pacing } : {})
      });
      setCampaigns(current => [created.campaign || created, ...current]);
      setLabel(''); setNotice('Campaign prepared. Review it, then start sending when ready.');
    } catch (caught: any) { setError(caught.message || 'Could not prepare the campaign.'); }
    finally { setBusy(''); }
  };

  const campaignAction = async (campaign: InvitationCampaign, action: 'start' | 'pause' | 'cancel') => {
    setBusy(`${campaign.id}:${action}`); setError(''); setNotice('');
    try {
      await api.actionAdminInvitationCampaign(campaign.id, action);
      await loadCampaigns();
      setNotice(action === 'start' ? 'Campaign sending started.' : action === 'pause' ? 'Campaign paused.' : 'Campaign canceled.');
    } catch (caught: any) { setError(caught.message || 'The campaign could not be changed.'); }
    finally { setBusy(''); }
  };

  const resend = async (allNonresponders = false) => {
    setBusy('resend'); setError(''); setNotice('');
    try {
      await api.resendAdminInvitations(allNonresponders
        ? { filter: 'NO_RESPONSE', ...(campaignFilter ? { campaign_id: campaignFilter } : {}) }
        : { invitation_ids: selectedInvitationIds });
      await loadInvitations();
      setNotice('Eligible invitations were queued again.');
    } catch (caught: any) { setError(caught.message || 'The invitations could not be resent.'); }
    finally { setBusy(''); }
  };

  const inspectBatch = async (id: string) => {
    setBusy(`batch:${id}`); setError('');
    try { const result = await api.getAdminContributionBatch(id); setSelectedBatch(result.batch); }
    catch (caught: any) { setError(caught.message || 'Could not open that review submission.'); }
    finally { setBusy(''); }
  };

  const reviewBatch = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedBatch) return;
    setBusy(`review:${action}`); setError(''); setNotice('');
    try {
      const donors = action === 'APPROVE' ? parseReviewedDonors(reviewRows) : undefined;
      if (action === 'APPROVE' && !donors?.length) throw new Error('Enter at least one reviewed donor row before approval.');
      await api.reviewAdminContributionBatch(selectedBatch.id, { action, note: reviewNote, donors });
      setSelectedBatch(null); setReviewRows(''); setReviewNote(''); await loadBatches();
      setNotice(action === 'APPROVE' ? 'Submission approved and reviewed donors added.' : 'Submission rejected.');
    } catch (caught: any) { setError(caught.message || 'The review could not be saved.'); }
    finally { setBusy(''); }
  };

  return (
    <section>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="eyebrow"><MailCheck className="h-4 w-4" />Invitation operations</div><h2 className="mt-2 text-3xl font-extrabold text-slate-950">Invite with a clear trail</h2><p className="mt-2 max-w-3xl text-slate-600">Prepare controlled campaigns, watch delivery and responses, and review donor lists before they enter the directory.</p></div>
        <button className="button button-secondary" onClick={() => void loadCurrent()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3" role="tablist" aria-label="Invitation workspace">
        {([
          ['campaigns', 'Campaigns', Gauge], ['delivery', 'Delivery & responses', MailCheck], ['review', 'Review queue', FileSearch]
        ] as const).map(([id, text, Icon]) => <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`admin-panel flex items-center gap-3 p-4 text-left ${view === id ? 'border-primary bg-rose-50' : ''}`}><span className="rounded-xl bg-white p-2 text-primary"><Icon className="h-5 w-5" /></span><strong>{text}</strong></button>)}
      </div>

      {error && <div className="alert alert-error mt-5" role="alert"><XCircle className="h-5 w-5" />{error}</div>}
      {notice && <div className="alert alert-success mt-5" role="status"><CheckCircle2 className="h-5 w-5" />{notice}</div>}

      {view === 'campaigns' && <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <GuidedForm onSubmit={createCampaign} className="admin-panel p-5 sm:p-6">
          <h3 className="text-xl font-extrabold text-slate-950">Prepare a campaign</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Drop selects random unclaimed donors who have never received an invitation. The selection stays fixed for this campaign.</p>
          <label className="mt-5 block"><span className="mb-2 block text-sm font-bold">Campaign name</span><input className="input" value={label} onChange={event => setLabel(event.target.value)} required maxLength={120} placeholder="Meherpur outreach · October" /></label>
          <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Number of invitations</span><input className="input" type="number" min={1} max={mode === 'INSTANT' ? 20 : 5000} value={count} onChange={event => setCount(Number(event.target.value))} required /></label>
          <fieldset className="mt-5"><legend className="text-sm font-bold">Sending style</legend><div className="mt-2 grid grid-cols-2 gap-3"><button type="button" aria-pressed={mode === 'RAMPED'} onClick={() => setMode('RAMPED')} className={`button ${mode === 'RAMPED' ? 'button-primary' : 'button-secondary'}`}>Gradual</button><button type="button" aria-pressed={mode === 'INSTANT'} onClick={() => { setMode('INSTANT'); setCount(value => Math.min(value, 20)); }} className={`button ${mode === 'INSTANT' ? 'button-primary' : 'button-secondary'}`}>Instant · max 20</button></div></fieldset>
          {mode === 'RAMPED' && <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4"><span className="text-sm font-bold">Pacing</span><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="button button-secondary" onClick={() => setPacing(gentlePacing)}>Gentle</button><button type="button" className="button button-secondary" onClick={() => setPacing(balancedPacing)}>Balanced</button><button type="button" className="button button-secondary" onClick={() => setPacing(fastPacing)}>Fast</button></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{([
            ['start_per_minute', 'Start / min'], ['peak_per_minute', 'Peak / min'], ['end_per_minute', 'End / min'],
            ['ramp_up_minutes', 'Speed up (min)'], ['steady_minutes', 'Steady (min)'], ['ramp_down_minutes', 'Slow down (min)']
          ] as const).map(([key, title]) => <label key={key}><span className="mb-1 block text-xs font-bold text-slate-600">{title}</span><input className="input" type="number" min={1} max={120} value={pacing[key]} onChange={event => setPacing(current => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}</div></div>}
          <button className="button button-primary mt-5" disabled={busy === 'create'}><UsersRound className="h-4 w-4" />{busy === 'create' ? 'Preparing…' : 'Prepare campaign'}</button>
        </GuidedForm>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3"><div className="metric-card"><span>Selected</span><strong>{campaignTotals.selected}</strong></div><div className="metric-card"><span>Delivered</span><strong>{campaignTotals.delivered}</strong></div><div className="metric-card"><span>Accepted</span><strong>{campaignTotals.claimed}</strong></div></div>
          {loading ? <div className="admin-empty">Loading campaigns…</div> : campaigns.length === 0 ? <div className="admin-empty"><Gauge className="h-8 w-8" /><strong>No campaigns yet</strong><p>Prepare the first invitation run when you are ready.</p></div> : <div className="admin-record-list">{campaigns.map(campaign => <article key={campaign.id} className="admin-record admin-record-stacked"><div className="flex w-full flex-col gap-4"><div className="record-title-row"><h3>{campaign.label}</h3><span className="admin-badge">{humanize(campaign.status)}</span><span className="admin-badge">{campaign.mode === 'INSTANT' ? 'Instant' : 'Gradual'}</span></div><p>{campaign.counts?.selected || 0} selected · {campaign.counts?.delivered || 0} delivered · {campaign.counts?.claimed || 0} accepted · {campaign.counts?.rejected_removed || 0} removed · {campaign.counts?.phone_changed || 0} changed number · {campaign.counts?.separate_account || 0} separate account · {campaign.counts?.no_response || 0} not responded</p><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((campaign.counts?.delivered || 0) / Math.max(1, campaign.counts?.selected || campaign.target_count)) * 100)}%` }} /></div><div className="record-actions">{['DRAFT', 'PAUSED'].includes(campaign.status) && <button className="button button-primary" onClick={() => void campaignAction(campaign, 'start')} disabled={Boolean(busy)}><Play className="h-4 w-4" />{campaign.status === 'DRAFT' ? 'Start' : 'Resume'}</button>}{campaign.status === 'RUNNING' && <button className="button button-secondary" onClick={() => void campaignAction(campaign, 'pause')} disabled={Boolean(busy)}>Pause</button>}{!['COMPLETED', 'CANCELED'].includes(campaign.status) && <button className="button button-danger" onClick={() => void campaignAction(campaign, 'cancel')} disabled={Boolean(busy)}>Cancel</button>}</div></div></article>)}</div>}
        </div>
      </div>}

      {view === 'delivery' && <div className="mt-6">
        <div className="admin-filter-bar"><Select value={campaignFilter} onChange={event => setCampaignFilter(event.target.value)}><option value="">Every campaign</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.label}</option>)}</Select><Select value={deliveryStatus} onChange={event => setDeliveryStatus(event.target.value as typeof deliveryStatus)}>{deliveryOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select><Select value={outcome} onChange={event => setOutcome(event.target.value as typeof outcome)}>{outcomeOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select><button className="button button-primary" onClick={() => void loadInvitations()}>Apply filters</button></div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button className="button button-secondary" disabled={!selectedInvitationIds.length || busy === 'resend'} onClick={() => void resend(false)}><RotateCcw className="h-4 w-4" />Resend selected</button><button className="button button-secondary" disabled={busy === 'resend'} onClick={() => void resend(true)}>Resend eligible nonresponders</button><span className="text-sm text-slate-500">Only eligible records are queued. Successful replies are never resent.</span></div>
        {loading ? <div className="admin-empty mt-5">Loading invitations…</div> : invitations.length === 0 ? <div className="admin-empty mt-5"><MailCheck className="h-8 w-8" /><strong>No matching invitations</strong><p>Try a broader delivery or response filter.</p></div> : <div className="admin-record-list mt-5">{invitations.map(invitation => <article key={invitation.id} className="admin-record"><label className="flex items-start pt-1" aria-label={`Select invitation for ${invitation.donor.name}`}><input type="checkbox" checked={selectedInvitationIds.includes(invitation.id)} disabled={!invitation.resend_eligible} onChange={event => setSelectedInvitationIds(current => event.target.checked ? [...current, invitation.id] : current.filter(id => id !== invitation.id))} /></label><div className="record-primary record-primary-grow"><div><div className="record-title-row"><h3>{invitation.donor.name}</h3><span className="admin-badge">{humanize(invitation.delivery.status)}</span><span className="admin-badge">{humanize(invitation.outcome)}</span></div><p>{invitation.masked_phone} · {[invitation.donor.blood_group, invitation.donor.upazila, invitation.donor.district].filter(Boolean).join(' · ') || 'Details not supplied'}</p><p className="record-note">{invitation.campaign?.label || 'Individual invitation'} · {invitation.delivery.attempts} attempt{invitation.delivery.attempts === 1 ? '' : 's'} · Updated {formatDate(invitation.delivery.updated_at)}</p>{invitation.delivery.last_error && <p className="mt-2 text-sm font-semibold text-red-700">{invitation.delivery.last_error}</p>}</div></div></article>)}</div>}
      </div>}

      {view === 'review' && <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>{loading ? <div className="admin-empty">Loading submissions…</div> : batches.length === 0 ? <div className="admin-empty"><FileSearch className="h-8 w-8" /><strong>No lists waiting</strong><p>User donor lists will appear here for manual review.</p></div> : <div className="admin-record-list">{batches.map(batch => <button key={batch.id} className={`admin-record w-full text-left ${selectedBatch?.id === batch.id ? 'border-primary bg-rose-50' : ''}`} onClick={() => void inspectBatch(batch.id)}><div className="record-primary"><div><div className="record-title-row"><h3>{batch.submitter?.name || 'Member submission'}</h3><span className="admin-badge">{humanize(batch.status)}</span></div><p>{batch.submitter?.masked_phone || 'Private member'} · {batch.files.length} file{batch.files.length === 1 ? '' : 's'} · {formatDate(batch.submitted_at || batch.created_at)}</p><p className="record-note">{batch.pasted_text_preview || batch.note || 'Attachments supplied for review'}</p></div></div></button>)}</div>}</div>
        {selectedBatch ? <div className="admin-panel p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-extrabold text-slate-950">Review submission</h3><p className="mt-1 text-sm text-slate-600">Submitted by {selectedBatch.submitter?.name || 'member'} · {selectedBatch.submitter?.masked_phone || 'private phone'}</p></div><button className="icon-button" onClick={() => setSelectedBatch(null)} aria-label="Close review"><XCircle className="h-5 w-5" /></button></div>{selectedBatch.pasted_text && <div className="mt-5"><strong className="text-sm">Pasted details</strong><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">{selectedBatch.pasted_text}</pre></div>}{selectedBatch.files.length > 0 && <div className="mt-5"><strong className="text-sm">Attachments</strong><div className="mt-2 space-y-2">{selectedBatch.files.map(file => <a key={file.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-primary" href={file.download_path} target="_blank" rel="noreferrer"><span>{file.name}</span><span className="text-slate-500">Open</span></a>)}</div></div>}<label className="mt-5 block"><span className="mb-2 block text-sm font-bold">Reviewed donor rows</span><textarea className="input min-h-40" value={reviewRows} onChange={event => setReviewRows(event.target.value)} placeholder={'One donor per line:\nName | Phone | Blood group | District | Upazila'} /></label><p className="mt-2 text-xs leading-5 text-slate-500">Check every number against the submitted material. Separate fields with a comma, tab or |.</p><label className="mt-5 block"><span className="mb-2 block text-sm font-bold">Reviewer note</span><textarea className="input min-h-24" value={reviewNote} onChange={event => setReviewNote(event.target.value)} required maxLength={1000} /></label><div className="mt-5 flex flex-wrap gap-3"><button className="button button-primary" disabled={Boolean(busy) || !reviewNote.trim()} onClick={() => void reviewBatch('APPROVE')}><CheckCircle2 className="h-4 w-4" />Approve reviewed donors</button><button className="button button-danger" disabled={Boolean(busy) || !reviewNote.trim()} onClick={() => void reviewBatch('REJECT')}>Reject submission</button></div></div> : <div className="admin-empty"><FileSearch className="h-8 w-8" /><strong>Choose a submission</strong><p>Its pasted details and private attachments will open here.</p></div>}
      </div>}
    </section>
  );
}
