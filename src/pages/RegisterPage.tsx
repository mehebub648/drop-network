import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Droplet, Phone } from 'lucide-react';
import { api } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES, getLocationByName } from '../lib/locations';

export default function RegisterPage({ onLogin }: { onLogin: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [selectedLocation, setSelectedLocation] = useState('Dhaka');
  const [step, setStep] = useState<'PHONE' | 'CODE' | 'ACCOUNT'>('PHONE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const act = async (action: () => Promise<void>) => {
    setLoading(true); setError('');
    try { await action(); } catch (reason: any) { setError(reason.message || 'Registration failed'); }
    finally { setLoading(false); }
  };

  const requestCode = (event: FormEvent) => {
    event.preventDefault();
    void act(async () => { await api.requestOtp(phone, 'REGISTER'); setStep('CODE'); });
  };

  const verifyCode = (event: FormEvent) => {
    event.preventDefault();
    void act(async () => {
      const result = await api.verifyOtp(phone, 'REGISTER', code);
      setVerificationToken(result.verification_token);
      setStep('ACCOUNT');
    });
  };

  const register = (event: FormEvent) => {
    event.preventDefault();
    void act(async () => {
      const location = getLocationByName(selectedLocation);
      if (!location) throw new Error('Choose a supported district');
      await api.register(phone, name, password, verificationToken, bloodGroup, location);
      await onLogin();
      navigate('/profile/donor');
    });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md theme-card p-8 border border-slate-100">
        <div className="flex justify-center mb-6"><div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center"><Droplet className="w-8 h-8 text-primary" /></div></div>
        <h1 className="text-2xl font-bold text-center">Join Drop</h1>
        <p className="text-slate-500 text-center mt-2 mb-7">Verify your Bangladesh mobile before joining.</p>
        {error && <p role="alert" className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold text-center">{error}</p>}

        {step === 'PHONE' && <form onSubmit={requestCode} className="space-y-4"><Field label="Bangladesh mobile"><input autoComplete="tel" type="tel" required className="input" placeholder="+880 1712 345678" value={phone} onChange={e => setPhone(e.target.value)} /></Field><button disabled={loading} className="primary-button"><Phone className="w-5 h-5" /> {loading ? 'Sending…' : 'Send verification code'}</button></form>}
        {step === 'CODE' && <form onSubmit={verifyCode} className="space-y-4"><Field label="Six-digit verification code"><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="input text-center tracking-[0.5em] text-xl" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></Field><button disabled={loading} className="primary-button"><CheckCircle2 className="w-5 h-5" /> {loading ? 'Checking…' : 'Verify phone'}</button><button type="button" onClick={() => setStep('PHONE')} className="w-full text-sm font-bold text-slate-500">Use another number</button></form>}
        {step === 'ACCOUNT' && <form onSubmit={register} className="space-y-4"><div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm font-bold">Phone verified</div><Field label="Full name"><input autoComplete="name" required maxLength={100} className="input" value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Password"><input autoComplete="new-password" type="password" required minLength={8} className="input" value={password} onChange={e => setPassword(e.target.value)} /></Field><div className="grid grid-cols-2 gap-4"><Field label="Blood group"><select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} className="input">{BLOOD_GROUPS.map(group => <option key={group}>{group}</option>)}</select></Field><Field label="District"><select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="input">{BD_LOCATION_NAMES.map(location => <option key={location}>{location}</option>)}</select></Field></div><p className="text-xs text-slate-500">Your donor status starts unavailable. Confirm availability only when you are genuinely ready and clinically eligible to donate.</p><button disabled={loading} className="primary-button">{loading ? 'Creating…' : 'Create verified account'}</button></form>}
        <p className="text-center mt-6 text-sm text-slate-500">Already registered? <Link to="/login" className="text-primary font-bold">Log in</Link></p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</span>{children}</label>;
}
