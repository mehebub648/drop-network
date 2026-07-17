import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Phone, Save, UserRound } from 'lucide-react';
import VerifiedBadge from '../../components/VerifiedBadge';
import { api } from '../../lib/api';
import type { ProfilePageProps } from './types';

export default function AccountPage({ user, onUpdate }: ProfilePageProps) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setName(user.name);
    setPhone(user.phone);
  }, [user.name, user.phone]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.updateMe({ name, phone });
      await onUpdate();
      setMessage({ type: 'success', text: 'Account details updated.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Could not update account.' });
    } finally {
      setSaving(false);
    }
  };

  const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Creation date unavailable for this older account';

  return (
    <div className="theme-card border border-slate-100 p-6 sm:p-8">
      <h2 className="text-2xl font-extrabold tracking-tight">Account details</h2>
      <p className="mt-2 text-slate-500">Keep the identity and phone number used for request coordination current.</p>

      <div className="mt-7 flex items-center gap-4 rounded-2xl bg-slate-50 p-5">
        <div className="w-14 h-14 rounded-2xl bg-white text-primary border border-rose-100 flex items-center justify-center font-extrabold">{initials}</div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <strong>{user.name}</strong>
            <VerifiedBadge verified={user.is_verified} compact />
          </div>
          <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1"><CalendarDays className="w-4 h-4" /> Joined {joined}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-5">
        <div>
          <label htmlFor="account-name" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Full name</label>
          <div className="relative">
            <UserRound className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input id="account-name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-medium" />
          </div>
        </div>
        <div>
          <label htmlFor="account-phone" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Phone number</label>
          <div className="relative">
            <Phone className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input id="account-phone" type="tel" required maxLength={30} value={phone} onChange={event => setPhone(event.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-medium" />
          </div>
        </div>
        {message && <p className={message.type === 'success' ? 'text-emerald-700 font-bold text-sm' : 'text-red-600 font-bold text-sm'}>{message.text}</p>}
        <button disabled={saving} className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save account'}
        </button>
      </form>
    </div>
  );
}
