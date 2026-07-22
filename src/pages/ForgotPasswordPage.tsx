import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { api } from '../lib/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (step === 1) { await api.requestOtp(phone, 'RESET_PASSWORD'); setStep(2); }
      else if (step === 2) { const result = await api.verifyOtp(phone, 'RESET_PASSWORD', code); setToken(result.verification_token); setStep(3); }
      else { await api.resetPassword(phone, password, token); navigate('/login', { replace: true }); }
    } catch (error: any) { setMessage(error.message || 'Could not complete password recovery.'); }
    finally { setBusy(false); }
  };

  return <div className="min-h-[70vh] flex items-center justify-center"><div className="theme-card border border-slate-100 p-8 w-full max-w-md">
    <KeyRound className="w-10 h-10 text-primary mx-auto" /><h1 className="text-2xl font-bold text-center mt-4">Reset password</h1>
    <p className="text-sm text-slate-500 text-center mt-2">Verify your registered Bangladesh phone. All existing sessions will be signed out.</p>
    <form onSubmit={submit} className="space-y-4 mt-6">
      {step === 1 && <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01712345678" className="w-full px-4 py-4 bg-slate-50 rounded-xl" />}
      {step === 2 && <input required inputMode="numeric" pattern="[0-9]{6}" value={code} onChange={e => setCode(e.target.value)} placeholder="6-digit verification code" className="w-full px-4 py-4 bg-slate-50 rounded-xl" />}
      {step === 3 && <input required type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="New password (8+ characters)" className="w-full px-4 py-4 bg-slate-50 rounded-xl" />}
      {message && <p role="alert" className="text-sm text-red-600 font-bold">{message}</p>}
      <button disabled={busy} className="w-full py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50">{busy ? 'Please wait…' : step === 1 ? 'Send code' : step === 2 ? 'Verify code' : 'Reset password'}</button>
    </form>
    <Link to="/login" className="block text-center text-sm font-bold text-slate-500 mt-5">Back to login</Link>
  </div></div>;
}
