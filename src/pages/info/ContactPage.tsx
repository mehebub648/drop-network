import { FormEvent, useState } from 'react';
import { Send, ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api';
import { InfoPage } from './InfoPage';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', category: 'SUPPORT', message: '' });
  const [state, setState] = useState({ busy: false, message: '', error: false });

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setState({ busy: true, message: '', error: false });
    try {
      const result = await api.createSupportTicket(form);
      setState({ busy: false, message: `Your request was received. Reference: ${result.id}`, error: false });
      setForm({ name: '', email: '', phone: '', category: 'SUPPORT', message: '' });
    } catch (caught: any) { setState({ busy: false, message: caught.message || 'Could not send your request.', error: true }); }
  };

  return (
    <InfoPage eyebrow="Contact" title="How can we help?" intro="Send an account, privacy, safety, or partnership request to the Drop operations queue.">
      <p className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">This form creates a ticket in the Drop operations queue. Response times vary, so include a safe way to contact you and keep the reference shown after submission.</p>
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-primary" /><h2 className="m-0">Contact operations</h2></div>
        <div className="grid sm:grid-cols-2 gap-3"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="px-4 py-3 rounded-xl border" /><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="px-4 py-3 rounded-xl border"><option value="SUPPORT">Account support</option><option value="SAFETY">Safety or abuse</option><option value="PRIVACY">Privacy</option><option value="PARTNERSHIP">Hospital / NGO partnership</option></select></div>
        <div className="grid sm:grid-cols-2 gap-3"><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="px-4 py-3 rounded-xl border" /><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Bangladesh phone" className="px-4 py-3 rounded-xl border" /></div>
        <textarea required minLength={10} maxLength={2000} rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="How can we help? Do not include passwords, OTPs, or unnecessary patient details." className="w-full px-4 py-3 rounded-xl border" />
        <p className="text-xs text-slate-500">Provide at least an email or Bangladesh phone number so the team can respond.</p>
        {state.message && <p role="status" className={`text-sm font-semibold ${state.error ? 'text-red-600' : 'text-green-700'}`}>{state.message}</p>}
        <button disabled={state.busy} className="px-5 py-3 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-50"><Send className="inline w-4 h-4 mr-2" />{state.busy ? 'Sending…' : 'Send request'}</button>
      </form>
      <section>
        <h2>Medical emergencies</h2>
        <p>Do not wait for an email response. Contact the treating hospital, blood bank, and appropriate local emergency services directly. Drop cannot dispatch medical help or guarantee a donor response.</p>
      </section>
    </InfoPage>
  );
}
