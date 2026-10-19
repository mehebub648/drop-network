import { Link, useNavigate, useSearchParams } from 'react-router';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { api, experienceApi } from '../lib/api';
import { getSafeReturnTo } from '../lib/navigation';

export default function LoginPage({ onLogin }: { onLogin: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await api.login(phone, password);
      await experienceApi.adopt();
      await onLogin();
      navigate(getSafeReturnTo(params.get('returnTo'), '/profile'), { replace: true });
    } catch (cause: any) {
      setError(cause.message || 'Could not sign in. Check your phone number and password.');
    } finally { setBusy(false); }
  };
  return <AuthShell eyebrow="Welcome back" title="Good to see you!" description="Your phone. Your password. You're home.">
    {params.get('reset') === '1' && <p role="status" className="notice mb-5 border border-green-200 bg-green-50 text-green-800">Password reset. Sign in with your new password.</p>}
    <form onSubmit={submit} className="auth-login-form" aria-busy={busy}>
      <label>Phone number<input className="input" type="tel" autoComplete="username" required placeholder="01XXXXXXXXX" value={phone} onChange={event => setPhone(event.target.value)} /></label>
      <label>Password<span className="password-field"><input className="input" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span></label>
      <Link className="auth-text-link" to="/forgot-password">Forgot your password?</Link>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : <>Sign in <ArrowRight aria-hidden="true" className="h-4 w-4" /></>}</button>
      <p className="auth-small-print">SMS codes verify your phone or reset a forgotten password.</p>
    </form>
    <p className="auth-switch">New here? <Link to={`/register${params.toString() ? `?${params.toString()}` : ''}`}>Create an account</Link></p>
  </AuthShell>;
}
