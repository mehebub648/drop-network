import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Droplet, Hospital, MapPin, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES, getLocationByName } from '../lib/locations';

const COMPONENTS = [
  ['WHOLE_BLOOD', 'Whole blood'],
  ['RED_CELLS', 'Red cells'],
  ['PLATELETS', 'Platelets'],
  ['PLASMA', 'Plasma']
] as const;

const RELATIONSHIPS = [
  ['SELF', 'Self'], ['FAMILY', 'Family'], ['FRIEND', 'Friend'],
  ['HOSPITAL_STAFF', 'Hospital staff'], ['VOLUNTEER', 'Volunteer'], ['OTHER', 'Other']
] as const;

type FormState = {
  blood_group: string;
  blood_component: string;
  units_required: number;
  district: string;
  needed_by: string;
  hospital_name: string;
  hospital_address: string;
  ward: string;
  patient_name: string;
  patient_reference: string;
  requester_name: string;
  requester_relationship: string;
  contact_name: string;
  contact_phone: string;
};

const STORAGE_KEY = 'drop_request_draft_v1';

function defaultState(group = 'O+', district = 'Dhaka'): FormState {
  return {
    blood_group: group,
    blood_component: 'WHOLE_BLOOD',
    units_required: 1,
    district,
    needed_by: '',
    hospital_name: '',
    hospital_address: '',
    ward: '',
    patient_name: '',
    patient_reference: '',
    requester_name: '',
    requester_relationship: 'FAMILY',
    contact_name: '',
    contact_phone: ''
  };
}

export default function NewRequestPage({ user }: { user: { name: string; phone: string; is_verified: boolean } }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = useMemo(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { return { ...defaultState(), ...JSON.parse(saved) } as FormState; } catch { /* ignore corrupt local draft */ }
    }
    return defaultState(searchParams.get('blood_group') || 'O+', searchParams.get('district') || 'Dhaka');
  }, [searchParams]);
  const [form, setForm] = useState<FormState>({ ...initial, requester_name: initial.requester_name || user.name, contact_name: initial.contact_name || user.name, contact_phone: initial.contact_phone || user.phone });
  const [reviewing, setReviewing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); }, [form]);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => ({ ...current, [key]: value }));

  const review = (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (!user.is_verified) return setMessage('Verify your phone before publishing a request.');
    if (!form.needed_by || new Date(form.needed_by).getTime() <= Date.now()) return setMessage('Choose a future required date and time.');
    setReviewing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const publish = async () => {
    if (!consent) return setMessage('Confirm the publication and privacy statement.');
    const location = getLocationByName(form.district);
    if (!location) return setMessage('Choose a supported district.');
    setSaving(true);
    setMessage('');
    try {
      const draft = await api.requestBlood({
        ...form,
        location,
        needed_by: new Date(form.needed_by).toISOString(),
        contacts: [{ name: form.contact_name, phone: form.contact_phone, type: 'RELATIVE' }]
      });
      const result = await api.publishRequest(draft.id);
      localStorage.removeItem(STORAGE_KEY);
      navigate(`/request/${result.request.id}`);
    } catch (error: any) {
      setMessage(error.message || 'Could not publish request.');
    } finally {
      setSaving(false);
    }
  };

  if (reviewing) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 fade-in">
        <button onClick={() => setReviewing(false)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500"><ArrowLeft className="w-4 h-4" /> Edit request</button>
        <div className="theme-card border border-slate-100 p-6 sm:p-8">
          <div className="flex items-center gap-3"><ShieldCheck className="w-8 h-8 text-emerald-600" /><div><h1 className="text-3xl font-extrabold">Review before publishing</h1><p className="text-slate-500">Confirm every detail. This will create a real public blood request.</p></div></div>
          <dl className="mt-8 grid sm:grid-cols-2 gap-5 text-sm">
            {[
              ['Need', `${form.units_required} unit(s) of ${form.blood_group} ${COMPONENTS.find(item => item[0] === form.blood_component)?.[1]}`],
              ['When', new Date(form.needed_by).toLocaleString()],
              ['Hospital', `${form.hospital_name}, ${form.hospital_address}`],
              ['Location', form.district],
              ['Patient reference', form.patient_reference],
              ['Requester', `${form.requester_name} (${RELATIONSHIPS.find(item => item[0] === form.requester_relationship)?.[1]})`],
              ['Contact', `${form.contact_name} · ${form.contact_phone}`],
              ['Ward', form.ward || 'Not provided']
            ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs uppercase tracking-widest text-slate-400 font-bold">{label}</dt><dd className="mt-1 font-bold text-slate-800">{value}</dd></div>)}
          </dl>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3"><AlertTriangle className="w-5 h-5 flex-shrink-0" /><p>Drop coordinates volunteers only. The receiving hospital must confirm compatibility, eligibility, testing, and collection.</p></div>
          <label className="mt-6 flex items-start gap-3 text-sm font-medium"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 w-4 h-4 accent-rose-600" /><span>I confirm the request is genuine, the details are accurate, I may publish the hospital and request information shown above, and I will close the request when the need ends.</span></label>
          {message && <p role="alert" className="mt-4 text-red-600 font-bold text-sm">{message}</p>}
          <button onClick={publish} disabled={saving || !consent} className="mt-6 w-full py-4 rounded-2xl bg-primary text-white font-extrabold disabled:opacity-50">{saving ? 'Publishing…' : 'Publish verified request'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto fade-in">
      <div className="mb-8"><h1 className="text-3xl font-extrabold">Create a verified blood request</h1><p className="mt-2 text-slate-500">Complete the clinical coordination details, then review everything before publication.</p></div>
      <form onSubmit={review} className="theme-card border border-slate-100 p-6 sm:p-8 space-y-7">
        <section><h2 className="font-extrabold flex items-center gap-2"><Droplet className="w-5 h-5 text-primary" /> Blood requirement</h2><div className="mt-4 grid sm:grid-cols-3 gap-4">
          <Field label="Blood group"><select required value={form.blood_group} onChange={e => set('blood_group', e.target.value)} className="input">{BLOOD_GROUPS.map(group => <option key={group}>{group}</option>)}</select></Field>
          <Field label="Component"><select required value={form.blood_component} onChange={e => set('blood_component', e.target.value)} className="input">{COMPONENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Units / bags"><input required type="number" min="1" max="20" value={form.units_required} onChange={e => set('units_required', Number(e.target.value))} className="input" /></Field>
        </div><div className="mt-4"><Field label="Required date and time"><input required type="datetime-local" value={form.needed_by} onChange={e => set('needed_by', e.target.value)} className="input" /></Field></div></section>
        <section><h2 className="font-extrabold flex items-center gap-2"><Hospital className="w-5 h-5 text-primary" /> Hospital and patient reference</h2><div className="mt-4 grid sm:grid-cols-2 gap-4">
          <Field label="Hospital / blood bank"><input required maxLength={160} value={form.hospital_name} onChange={e => set('hospital_name', e.target.value)} className="input" /></Field>
          <Field label="District"><select required value={form.district} onChange={e => set('district', e.target.value)} className="input">{BD_LOCATION_NAMES.map(district => <option key={district}>{district}</option>)}</select></Field>
          <Field label="Hospital address"><input required maxLength={240} value={form.hospital_address} onChange={e => set('hospital_address', e.target.value)} className="input" /></Field>
          <Field label="Ward / department"><input maxLength={100} value={form.ward} onChange={e => set('ward', e.target.value)} className="input" /></Field>
          <Field label="Patient name (private)"><input required maxLength={120} value={form.patient_name} onChange={e => set('patient_name', e.target.value)} className="input" /></Field>
          <Field label="Hospital patient reference (private)"><input required maxLength={100} value={form.patient_reference} onChange={e => set('patient_reference', e.target.value)} className="input" /></Field>
        </div></section>
        <section><h2 className="font-extrabold flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Verified requester contact</h2><div className="mt-4 grid sm:grid-cols-2 gap-4">
          <Field label="Requester name"><input required maxLength={120} value={form.requester_name} onChange={e => set('requester_name', e.target.value)} className="input" /></Field>
          <Field label="Relationship"><select required value={form.requester_relationship} onChange={e => set('requester_relationship', e.target.value)} className="input">{RELATIONSHIPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Contact name"><input required maxLength={80} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="input" /></Field>
          <Field label="Bangladesh mobile"><input required type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="input" placeholder="+880 1712 345678" /></Field>
        </div></section>
        {message && <p role="alert" className="text-red-600 font-bold text-sm">{message}</p>}
        <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-extrabold inline-flex justify-center items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Review request</button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</span>{children}</label>;
}
