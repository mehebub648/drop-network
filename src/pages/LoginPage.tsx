import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Phone } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { api } from '../lib/api';
import { getSafeReturnTo } from '../lib/navigation';

export default function LoginPage({ onLogin }: { onLogin: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'), '/profile');

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(phone, password);
      await onLogin();
      navigate(returnTo, { replace: true });
    } catch (caught: any) {
      setError(caught.message || 'We could not sign you in. Check the phone and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Member sign in"
      title="Welcome back"
      description="Sign in to reveal opted-in donor contacts, manage requests, and keep your own availability accurate."
    >
      <form onSubmit={handleLogin} className="space-y-5">
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-800">Bangladesh mobile</span>
          <span className="relative block">
            <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              className="input min-h-12 pl-12"
              placeholder="+880 1712 345678"
              value={phone}
              onChange={event => setPhone(event.target.value)}
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-800">
            Password
            <Link to="/forgot-password" className="text-xs text-emerald-700 hover:text-emerald-900 hover:underline">Forgot password?</Link>
          </span>
          <span className="relative block">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              className="input min-h-12 px-12"
              placeholder="Your password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </span>
        </label>

        <button disabled={loading} className="primary-button min-h-12">
          {loading ? 'Signing in…' : <>Sign in <ArrowRight className="h-5 w-5" /></>}
        </button>
      </form>

      <div className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">
        New to Drop? <Link to={returnTo === '/profile' ? '/register' : `/register?returnTo=${encodeURIComponent(returnTo)}`} className="font-bold text-emerald-700 hover:text-emerald-900 hover:underline">Create a verified account</Link>
      </div>
      <p className="mt-4 text-center text-xs leading-5 text-slate-500">Donor numbers are masked while you search. They open one at a time, through a published blood request, and every reveal is recorded.</p>
    </AuthShell>
  );
}
