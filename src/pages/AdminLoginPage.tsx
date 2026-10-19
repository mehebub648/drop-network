import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import AuthShell from '../components/AuthShell';
import { api } from '../lib/api';
import { getSafeReturnTo } from '../lib/navigation';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.adminLogin(username, password);
      navigate(getSafeReturnTo(params.get('returnTo'), '/admin'), { replace: true });
    } catch (cause: any) {
      setError(cause.message || 'Could not sign in. Check your administration username and password.');
    } finally {
      setBusy(false);
    }
  };

  return <AuthShell eyebrow="Protected workspace" title="Administration sign in" description="Use your separate Drop administration username and password.">
    <form onSubmit={submit} className="auth-login-form" aria-busy={busy}>
      <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-slate-700"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />Your donor account remains separate and stays signed in.</div>
      <label>Username<input className="input" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} /></label>
      <label>Password<span className="password-field"><input className="input" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span></label>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : <>Open administration <ArrowRight aria-hidden="true" className="h-4 w-4" /></>}</button>
    </form>
  </AuthShell>;
}
