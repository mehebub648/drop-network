import { useState, type FormEvent } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { api, type AdminSessionUser } from '../lib/api';

export default function AdminAccountPanel({ admin, onSignedOut }: { admin: AdminSessionUser; onSignedOut: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 12) { setError('Use at least 12 characters for the new password.'); return; }
    if (newPassword !== confirmPassword) { setError('Enter the same new password twice.'); return; }
    setBusy(true);
    try {
      await api.changeAdminPassword(currentPassword, newPassword);
      onSignedOut();
    } catch (cause: any) {
      setError(cause.message || 'Could not change the password.');
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    setBusy(true);
    setError('');
    try {
      await api.adminLogout();
      onSignedOut();
    } catch (cause: any) {
      setError(cause.message || 'Could not sign out. Please try again.');
      setBusy(false);
    }
  };

  return <section className="space-y-6" aria-labelledby="admin-account-heading">
    <div className="admin-section-heading"><div><p className="eyebrow">Separate credentials</p><h2 id="admin-account-heading">Administration account</h2><p>Signed in as <strong>{admin.username}</strong>. Changes here do not affect your donor account.</p></div></div>
    <form className="surface grid max-w-xl gap-4 p-6" onSubmit={changePassword}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-primary"><KeyRound aria-hidden="true" /></span>
      <h3 className="text-xl font-bold">Change administration password</h3>
      <p className="text-sm text-slate-600">Changing it safely signs out every administration session.</p>
      <label>Current password<input className="input" type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
      <label>New password<input className="input" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
      <label>Confirm new password<input className="input" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <button className="button button-primary justify-self-start" disabled={busy}>{busy ? 'Changing password…' : 'Change password and sign out'}</button>
    </form>
    <button type="button" className="button button-secondary" disabled={busy} onClick={() => void signOut()}><LogOut className="h-4 w-4" aria-hidden="true" /> Sign out of administration</button>
  </section>;
}
