import { useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) return setMessage({ type: 'error', text: 'The new password must be at least 8 characters.' });
    if (newPassword !== confirmPassword) return setMessage({ type: 'error', text: 'The new passwords do not match.' });
    setSaving(true);
    setMessage(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Password changed successfully.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Could not change password.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="theme-card border border-slate-100 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><ShieldCheck className="w-6 h-6" /></div>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Security</h2>
          <p className="text-slate-500 mt-1">Change the password used to sign in.</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-7 space-y-5 max-w-xl">
        <div>
          <label htmlFor="current-password" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Current password</label>
          <input id="current-password" type="password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="w-full px-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label htmlFor="new-password" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">New password</label>
          <input id="new-password" type="password" minLength={8} required value={newPassword} onChange={event => setNewPassword(event.target.value)} className="w-full px-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Confirm new password</label>
          <input id="confirm-password" type="password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="w-full px-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary" />
        </div>
        {message && <p className={message.type === 'success' ? 'text-emerald-700 font-bold text-sm' : 'text-red-600 font-bold text-sm'}>{message.text}</p>}
        <button disabled={saving} className="px-5 py-3 bg-slate-900 text-white rounded-xl font-bold inline-flex items-center gap-2 disabled:opacity-50"><KeyRound className="w-4 h-4" /> {saving ? 'Changing...' : 'Change password'}</button>
      </form>
    </div>
  );
}
