import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { api, type AdminAccountSummary, type AdminSessionUser } from '../lib/api';
import Select from './Select';

const roles: AdminSessionUser['staff_role'][] = ['MODERATOR', 'ADMIN', 'SUPERADMIN'];

export default function AdminStaffPanel({ viewerId }: { viewerId: string }) {
  const [accounts, setAccounts] = useState<AdminAccountSummary[]>([]);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AdminSessionUser['staff_role']>('MODERATOR');
  const [initialPassword, setInitialPassword] = useState('');
  const [resetFor, setResetFor] = useState('');
  const [resetValue, setResetValue] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    const result = await api.getAdminAccounts();
    setAccounts(result.accounts || []);
  };
  useEffect(() => { void load().catch(cause => setError(cause.message || 'Could not load administration accounts.')); }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('create'); setError(''); setNotice('');
    try {
      await api.createAdminAccount({ username, name, staff_role: role, initial_password: initialPassword });
      setUsername(''); setName(''); setInitialPassword(''); setRole('MODERATOR');
      setNotice('Administration account created. Share the username and temporary password privately.');
      await load();
    } catch (cause: any) { setError(cause.message || 'Could not create the account.'); }
    finally { setBusy(''); }
  };

  const update = async (account: AdminAccountSummary, patch: Partial<Pick<AdminAccountSummary, 'staff_role' | 'account_status'>>) => {
    setBusy(account.id); setError(''); setNotice('');
    try {
      await api.updateAdminAccount(account.id, patch);
      setNotice('Administration access updated. Active sessions for that account were signed out when required.');
      await load();
    } catch (cause: any) { setError(cause.message || 'Could not update the account.'); }
    finally { setBusy(''); }
  };

  const resetPassword = async (account: AdminAccountSummary) => {
    if (resetValue.length < 12 || resetValue.length > 128) { setError('The new password must be 12–128 characters.'); return; }
    setBusy(account.id); setError(''); setNotice('');
    try {
      await api.resetAdminAccountPassword(account.id, resetValue);
      setResetFor(''); setResetValue('');
      setNotice(`Password reset for ${account.username}. Their administration sessions were signed out.`);
    } catch (cause: any) { setError(cause.message || 'Could not reset the password.'); }
    finally { setBusy(''); }
  };

  return <section className="space-y-6" aria-labelledby="admin-staff-heading">
    <div className="admin-section-heading"><div><p className="eyebrow">Separate protected access</p><h2 id="admin-staff-heading">Administration team</h2><p>Create dedicated credentials and give each person only the role they need. These accounts are separate from donor accounts.</p></div></div>
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <form className="surface grid gap-4 p-6 sm:grid-cols-2" onSubmit={create}>
      <div className="sm:col-span-2 flex items-center gap-3"><span className="rounded-2xl bg-rose-50 p-3 text-primary"><UserPlus aria-hidden="true" /></span><div><h3 className="text-lg font-bold">Add an administrator</h3><p className="text-sm text-slate-600">Give the credentials directly to the person you trust.</p></div></div>
      <label>Display name<input className="input" required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
      <label>Username<input className="input" required minLength={3} maxLength={64} autoComplete="off" value={username} onChange={event => setUsername(event.target.value)} /></label>
      <label>Role<Select className="input" value={role} onChange={event => setRole(event.target.value as AdminSessionUser['staff_role'])}>{roles.map(item => <option key={item} value={item}>{item === 'MODERATOR' ? 'Moderator' : item === 'ADMIN' ? 'Administrator' : 'Superadmin'}</option>)}</Select></label>
      <label>Temporary password<input className="input" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={initialPassword} onChange={event => setInitialPassword(event.target.value)} /></label>
      <button className="button button-primary sm:col-span-2 justify-self-start" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Create administration account'}</button>
    </form>
    <div className="admin-record-list">
      {accounts.map(account => <article key={account.id} className="admin-record">
        <div className="record-primary"><span className="admin-avatar admin-avatar-small" aria-hidden="true"><ShieldCheck /></span><div><div className="record-title-row"><h3>{account.name}</h3><span className="admin-badge">{account.staff_role}</span><span className="admin-badge">{account.account_status}</span></div><p>@{account.username}</p></div></div>
        <div className="record-actions">
          <label className="compact-select"><span className="sr-only">Role for {account.name}</span><Select disabled={busy === account.id || account.id === viewerId} value={account.staff_role} onChange={event => void update(account, { staff_role: event.target.value as AdminSessionUser['staff_role'] })}>{roles.map(item => <option key={item} value={item}>{item}</option>)}</Select></label>
          <button type="button" className="button button-secondary" disabled={busy === account.id} onClick={() => { setResetFor(current => current === account.id ? '' : account.id); setResetValue(''); setError(''); }}><KeyRound className="h-4 w-4" /> Reset password</button>
          <button type="button" className={account.account_status === 'ACTIVE' ? 'button button-danger' : 'button button-secondary'} disabled={busy === account.id || account.id === viewerId} onClick={() => void update(account, { account_status: account.account_status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}>{account.account_status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button>
        </div>
        {resetFor === account.id && <form className="mt-4 flex w-full flex-wrap items-end gap-3 border-t border-slate-200 pt-4" onSubmit={event => { event.preventDefault(); void resetPassword(account); }}><label className="min-w-60 flex-1">New password<input className="input" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={resetValue} onChange={event => setResetValue(event.target.value)} /></label><button className="button button-primary" disabled={busy === account.id}>Set password and sign out sessions</button><button type="button" className="button button-secondary" onClick={() => { setResetFor(''); setResetValue(''); }}>Cancel</button></form>}
      </article>)}
    </div>
  </section>;
}
