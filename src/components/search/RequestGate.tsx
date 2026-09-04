import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import { api, experienceApi } from '../../lib/api';
import { searchRequestPayload, type SearchDraft } from '../../lib/searchDraft';
import { requestReasonLabel } from '../../lib/requestReasons';
import { DAY_MS, dhakaDate, requestDeadline } from '../../../server/requestLifecycle';
import ModalPortal from '../ModalPortal';
import Select from '../Select';
import DateInput from '../DateInput';
import StepFlow from '../StepFlow';
import AccountFlow from '../AccountFlow';
import RequestReasonCombobox from './RequestReasonCombobox';
import RequesterRolePicker from './RequesterRolePicker';

const stages = ['role', 'identity', 'reason', 'need', 'contact', 'date', 'review'] as const;
type Stage = typeof stages[number] | 'account';
const titles = { role: 'Who are you helping?', identity: 'Patient details', reason: 'Why is blood needed?', need: 'What does the hospital need?', contact: 'Where should donors call?', date: 'When is blood needed?', review: 'Review and publish' };
const components = ['NOT_SURE', 'RED_CELLS', 'WHOLE_BLOOD', 'PLATELETS', 'PLASMA', 'APHERESIS_PLATELETS', 'CRYOPRECIPITATE', 'WASHED_RED_CELLS', 'IRRADIATED_RED_CELLS', 'GRANULOCYTES', 'OTHER_COMPONENT'];

export default function RequestGate({ draft, onDraftChange, user, onClose, onEditSearch, onReady }: {
  draft: SearchDraft; onDraftChange: (draft: SearchDraft) => void; user: any; onClose: () => void; onEditSearch: () => void; onReady: (id: string) => Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>(draft.request_id ? 'account' : draft.requester_role ? 'identity' : 'role');
  const [requestId, setRequestId] = useState(draft.request_id || '');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!draft.request_id) return;
    let active = true;
    api.getRequestDetails(draft.request_id).catch(cause => {
      if (!active) return;
      if (cause.status === 404) { setRequestId(''); onDraftChange({ ...draft, request_id: undefined }); setStage('date'); setError('This request is no longer available. Choose a new date and review before publishing.'); }
      else setError('Could not reconnect. Your published request and saved answers are unchanged. Please retry when connected.');
    });
    return () => { active = false; };
  }, []);
  const set = (patch: Partial<SearchDraft>) => onDraftChange({ ...draft, ...patch });
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (stage === 'role' && !draft.requester_role) return setError('Choose how you are helping.');
    if (stage === 'reason' && !draft.request_reason) return setError('Choose a reason.');
    if (stage === 'date' && !requestDeadline(draft.needed_date)) return setError('Choose today or a date up to 15 days ahead.');
    if (stage !== 'review') { setStage(stages[stages.indexOf(stage as typeof stages[number]) + 1]); return; }
    if (!consent) return setError('Confirm permission to publish these details.');
    setBusy(true);
    void (async () => {
      if (!user) await experienceApi.initializeGuest();
      const created = await api.createSearchRequest(searchRequestPayload(draft));
      const id = created.request.id;
      setRequestId(id); set({ request_id: id }); setStage('account');
      if (user?.is_verified) await onReady(id);
    })().catch(cause => setError(cause.message || 'Could not publish. Your answers are saved.')).finally(() => setBusy(false));
  };
  return <ModalPortal onClose={onClose}><div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Blood request">
    <section className="action-dialog request-gate-dialog !max-w-2xl !bg-white">
      <button type="button" className="icon-button dialog-close" aria-label="Close request flow" onClick={onClose}><X /></button>
      <div className="mb-6 flex justify-between gap-4 border-b border-slate-200 pb-4 pr-16"><p><strong>{draft.blood_group}</strong> · {draft.upazila}, {draft.district}<br /><span className="text-sm text-slate-600">{draft.collection_facility}</span></p>{!requestId && <button type="button" onClick={onEditSearch} className="text-primary underline">Edit search</button>}</div>
      {stage === 'account' ? <>
        <div className="mb-6 border-l-4 border-amber-400 bg-amber-50 p-4"><strong>{user ? 'Your request is published' : 'Unverified Request Post'}</strong><p className="mt-2">Your patient contact is live. Donor numbers stay locked until your private account is verified.</p><Link className="mt-2 inline-block text-primary underline" to={`/request/${requestId}`}>Manage this request</Link><p className="mt-2 text-sm">Until you sign in, keep this browser’s data to manage the post. Device access ends at its deadline.</p></div>
        {error && <p role="alert" className="dialog-error">{error}</p>}
        {user?.is_verified ? <button type="button" className="button button-primary" onClick={() => void onReady(requestId).catch(cause => setError(cause.message))}>Continue to donor contact</button> : <AccountFlow initialPhone={user?.phone} verifyOnly={Boolean(user)} onComplete={() => onReady(requestId)} />}
      </> : <StepFlow title={titles[stage]} step={stages.indexOf(stage) + 1} total={stages.length} busy={busy} error={error} onNext={submit} onBack={() => { setError(''); const index = stages.indexOf(stage); if (index) setStage(stages[index - 1]); else onClose(); }} nextLabel={stage === 'review' ? 'Publish request' : 'Continue'}>
        {stage === 'role' && <RequesterRolePicker value={draft.requester_role} onChange={requester_role => set({ requester_role })} />}
        {stage === 'identity' && <><label>Patient full name<input className="input" required maxLength={120} value={draft.patient_name} onChange={event => set({ patient_name: event.target.value })} /></label><label>Patient age<input className="input" type="number" required min={1} max={120} value={draft.patient_age} onChange={event => set({ patient_age: event.target.value })} /></label><label>Patient gender<Select required value={draft.patient_sex} onChange={event => set({ patient_sex: event.target.value as SearchDraft['patient_sex'] })}><option value="">Choose</option><option value="MALE">Male</option><option value="FEMALE">Female</option></Select></label></>}
        {stage === 'reason' && <><label>Reason<RequestReasonCombobox value={draft.request_reason} onChange={request_reason => set({ request_reason })} /></label>{draft.request_reason === 'OTHER' && <label>Brief reason (optional)<input className="input" maxLength={160} value={draft.request_reason_details} onChange={event => set({ request_reason_details: event.target.value })} /></label>}<p>Share a broad reason, not private medical records.</p></>}
        {stage === 'need' && <><label>Blood component<Select required value={draft.blood_component} onChange={event => set({ blood_component: event.target.value as SearchDraft['blood_component'] })}>{components.map(item => <option key={item} value={item}>{item === 'NOT_SURE' ? 'Not sure — confirm with hospital' : item.replaceAll('_', ' ').toLowerCase()}</option>)}</Select></label><label>How many bags?<Select required value={draft.units_required} onChange={event => set({ units_required: event.target.value })}><option value="">Choose quantity</option>{Array.from({ length: 10 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</Select></label><p>Use the component requested by the hospital. Drop does not prescribe transfusions.</p></>}
        {stage === 'contact' && <><p>This number will be published so donors can reach the patient’s side. It is separate from your private account number.</p>{draft.requester_role !== 'PATIENT' && <label>Whose number is this?<Select required value={draft.contact_owner} onChange={event => set({ contact_owner: event.target.value as SearchDraft['contact_owner'] })}><option value="">Choose</option><option value="PATIENT">Patient</option><option value="RELATIVE">Relative</option></Select></label>}{draft.requester_role !== 'PATIENT' && draft.contact_owner === 'RELATIVE' && <label>Relative’s name<input className="input" required maxLength={80} value={draft.contact_name} onChange={event => set({ contact_name: event.target.value })} /></label>}<label>Patient-side contact number<input className="input" required type="tel" autoComplete="off" value={draft.contact_phone} onChange={event => set({ contact_phone: event.target.value })} /></label><p className="text-sm text-slate-600">This contact is supplied by you, not phone-verified by Drop.</p></>}
        {stage === 'date' && <><label>Needed date<DateInput className="input" required min={dhakaDate()} max={dhakaDate(Date.now() + 15 * DAY_MS)} value={draft.needed_date || ''} onChange={event => set({ needed_date: event.target.value })} /></label><p>Choose today through 15 days ahead. The deadline is the end of that day in Bangladesh time.</p></>}
        {stage === 'review' && <><dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3"><dt>Patient</dt><dd>{draft.patient_name}, {draft.patient_age}</dd><dt>Blood</dt><dd>{draft.units_required} bag(s), {draft.blood_group}</dd><dt>Reason</dt><dd>{requestReasonLabel(draft.request_reason)}</dd><dt>Needed</dt><dd>{draft.needed_date}</dd><dt>Public contact</dt><dd>{draft.contact_phone}</dd></dl><label className="!flex items-start gap-3"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} />I have permission to publish the patient details and this contact number.</label><p>{user ? 'The post will belong to your account.' : 'This publishes an unverified request immediately. You can manage it on this device until the deadline, or sign in to keep it in your account.'}</p></>}
      </StepFlow>}
    </section></div></ModalPortal>;
}
