import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, LogOut, Monitor, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  const loadSessions = async () => { try { setSessions(await api.getSessions()); } catch { setSessions([]); } };
  useEffect(() => { loadSessions(); }, []);

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
    <div className="space-y-6"><div className="theme-card border border-slate-100 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-rose-50 text-primary flex items-center justify-center"><ShieldCheck className="w-6 h-6" /></div>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Security</h2>
          <p className="text-slate-500 mt-1">Change the password used to sign in.</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-7 space-y-5 max-w-xl">
        <div>
          <label htmlFor="current-password" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="security-password-input" />
        </div>
        <div>
          <label htmlFor="new-password" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={event => setNewPassword(event.target.value)} className="security-password-input" />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="security-password-input" />
        </div>
        {message && <p className={message.type === 'success' ? 'text-green-700 font-bold text-sm' : 'text-red-600 font-bold text-sm'}>{message.text}</p>}
        <button disabled={saving} className="px-5 py-3 bg-primary text-white rounded-xl font-bold inline-flex items-center gap-2 hover:bg-primary-dark disabled:opacity-50"><KeyRound className="w-4 h-4" /> {saving ? 'Changing...' : 'Change password'}</button>
      </form>
    </div><div className="theme-card border border-slate-100 p-6 sm:p-8"><h2 className="text-xl font-extrabold flex items-center gap-2"><Monitor className="w-5 h-5 text-primary" /> Signed-in devices</h2><div className="mt-4 space-y-3">{sessions.map(session => <div key={session.id} className="border rounded-xl p-4 flex items-center justify-between gap-3"><div><p className="text-sm font-bold">{session.current ? 'This device' : session.user_agent}</p><p className="text-xs text-slate-500 mt-1">Signed in {new Date(session.created_at).toLocaleString()} · expires {new Date(session.expires_at).toLocaleDateString()}</p></div><button onClick={async () => { const result = await api.revokeSession(session.id); if (result.current) window.location.href = '/login'; else loadSessions(); }} className="px-3 py-2 text-xs font-bold border rounded-lg">Revoke</button></div>)}</div><button onClick={async () => { await api.logoutAll(); window.location.href = '/login'; }} className="mt-5 px-4 py-3 bg-red-50 text-red-700 rounded-xl font-bold inline-flex gap-2"><LogOut className="w-4 h-4" /> Log out all devices</button></div></div>
  );
}
