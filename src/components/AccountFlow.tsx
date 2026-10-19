import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, experienceApi, type OtpDelivery } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES } from '../lib/locations';
import { getUpazilasForDistrict } from '../lib/upazilas';
import { dhakaDate } from '../../server/requestLifecycle';
import OtpDeliveryStatus from './OtpDeliveryStatus';
import Select from './Select';
import DateInput from './DateInput';
import StepFlow from './StepFlow';
import BloodHelpNotice from './BloodHelpNotice';

type Stage = 'phone' | 'code' | 'password' | 'identity' | 'location' | 'donor' | 'blood' | 'history' | 'availability' | 'finish';
const titles: Record<Stage, string> = { phone: 'Your private account number', code: 'Check your phone', password: 'Welcome back', identity: 'A little about you', location: 'Where are you based?', donor: 'Would you like to help others?', blood: 'Your donor details', history: 'Your donation experience', availability: 'Are you available to donate?', finish: 'Secure your account' };
const empty = { phone: '', name: '', dob: '', district: '', upazila: '', donor: true, blood: '', lastKind: '', lastDate: '', lastValue: '', lastUnit: 'MONTHS', count: '', availability: '', reason: '' };
function savedProfile() {
  try { const saved = JSON.parse(localStorage.getItem('drop_account_flow_v2') || 'null'); return saved?.until > Date.now() ? { ...empty, ...saved.fields } : empty; } catch { return empty; }
}

export default function AccountFlow({ onComplete, onBloodHelp, initialPhone, verifyOnly = false }: { onComplete: () => Promise<void>; onBloodHelp?: () => void; initialPhone?: string; verifyOnly?: boolean }) {
  const [fields, setFields] = useState<typeof empty>(() => ({ ...savedProfile(), ...(initialPhone ? { phone: initialPhone } : {}) }));
  const [stage, setStage] = useState<Stage>('phone');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [delivery, setDelivery] = useState<OtpDelivery | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [signIn, setSignIn] = useState(false);
  const set = (patch: Partial<typeof fields>) => setFields((current: typeof empty) => ({ ...current, ...patch }));
  useEffect(() => {
    try { localStorage.setItem('drop_account_flow_v2', JSON.stringify({ fields, until: Date.now() + 30 * 60_000 })); } catch { /* Storage is optional. */ }
  }, [fields]);
  const complete = async () => {
    await experienceApi.adopt();
    try { localStorage.removeItem('drop_account_flow_v2'); } catch { /* Storage is optional. */ }
    await onComplete();
  };
  const afterCode = async (result: any) => {
    if (verifyOnly) {
      await api.verifyAccountPhone(result.verification_token);
      await complete();
    } else { setVerificationToken(result.verification_token); setStage('identity'); }
  };
  const sendCode = async () => {
    const result = await api.requestOtp(fields.phone, 'REGISTER');
    setDelivery(result); setCode('');
    if (result.bypass && result.verification_token) await afterCode(result);
    else setStage('code');
  };
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await work(); } catch (cause: any) { setError(cause.message || 'Please try again. Your published request is still saved.'); } finally { setBusy(false); }
  };
  const steps: Stage[] = ['identity', 'location', 'donor', ...(fields.donor ? ['blood', ...(fields.lastKind !== 'NEVER' ? ['history'] : []), 'availability'] as Stage[] : []), 'finish'];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (stage === 'phone') {
        if (signIn && !verifyOnly) setStage('password'); else await sendCode();
      } else if (stage === 'password') { await api.login(fields.phone, password); await complete(); }
      else if (stage === 'code') { await afterCode(await api.verifyOtp(fields.phone, 'REGISTER', code)); }
      else if (stage === 'finish') {
        if (password.length < 8 || password !== confirm) throw new Error('Use at least 8 characters and enter the same password twice.');
        await experienceApi.register({ phone: fields.phone, name: fields.name, date_of_birth: fields.dob, district: fields.district, upazila: fields.upazila,
          donor_opt_in: fields.donor, password, verification_token: verificationToken,
          ...(fields.donor ? { blood_group: fields.blood, availability_status: fields.availability, availability_reason: fields.reason,
            donation_count: fields.lastKind === 'NEVER' ? 0 : Number(fields.count),
            last_donation: fields.lastKind === 'NEVER' ? { kind: 'NEVER' } : fields.lastKind === 'EXACT' ? { kind: 'EXACT', date: fields.lastDate } : { kind: 'APPROXIMATE', value: Number(fields.lastValue), unit: fields.lastUnit }
          } : {}) });
        await complete();
      } else {
        if (stage === 'identity' && (!fields.dob || fields.dob > dhakaDate())) throw new Error('Enter a valid date of birth.');
        setStage(steps[steps.indexOf(stage) + 1]);
      }
    });
  };
  const back = () => { setError(''); if (steps.includes(stage)) setStage(steps[Math.max(0, steps.indexOf(stage) - 1)]); else setStage('phone'); };
  const profile = steps.includes(stage);
  return <><BloodHelpNotice onContinue={onBloodHelp} /><StepFlow title={titles[stage]} step={profile ? steps.indexOf(stage) + 1 : stage === 'phone' ? 1 : 2} total={profile ? steps.length : 2} onNext={submit} onBack={stage !== 'phone' && stage !== 'identity' ? back : undefined} busy={busy} error={error} nextLabel={stage === 'finish' ? 'Create account and continue' : stage === 'password' ? 'Sign in and continue' : 'Continue'}>
    {stage === 'phone' && <><p>{signIn ? 'Sign in with your phone and password to keep your requests together.' : 'Verify your phone to create an account. Your account number stays private on your blood request.'}</p><label>Account phone<input className="input" type="tel" autoComplete="tel" required placeholder="01XXXXXXXXX" value={fields.phone} readOnly={verifyOnly} onChange={event => set({ phone: event.target.value })} /></label>{!verifyOnly && <button type="button" className="auth-text-link" onClick={() => { setSignIn(!signIn); setError(''); }}>{signIn ? 'New to Drop? Create an account' : 'Already have an account? Sign in with a password'}</button>}</>}
    {stage === 'password' && <><label>Password<input className="input" autoComplete="current-password" type="password" required value={password} onChange={event => setPassword(event.target.value)} /></label><Link className="auth-text-link" to="/forgot-password">Forgot your password? Reset it with SMS</Link></>}
    {stage === 'code' && <><p>Enter the code sent to {fields.phone} to verify your phone.</p><OtpDeliveryStatus delivery={delivery} onDeliveryChange={setDelivery} onResend={() => void run(sendCode)} busy={busy} /><label>Verification code<input className="input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></label></>}
    {stage === 'identity' && <><label>Your full name<input className="input" autoComplete="name" required maxLength={100} value={fields.name} onChange={event => set({ name: event.target.value })} /></label><label>Date of birth<DateInput className="input" required min="1900-01-01" max={dhakaDate()} value={fields.dob} onChange={event => set({ dob: event.target.value })} /></label><p className="text-sm text-slate-600">Your date of birth stays private.</p></>}
    {stage === 'location' && <><label>District<Select required value={fields.district} onChange={event => set({ district: event.target.value, upazila: '' })}><option value="">Choose district</option>{BD_LOCATION_NAMES.map(item => <option key={item}>{item}</option>)}</Select></label><label>Upazila / thana<Select required disabled={!fields.district} value={fields.upazila} onChange={event => set({ upazila: event.target.value })}><option value="">Choose upazila</option>{getUpazilasForDistrict(fields.district).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label></>}
    {stage === 'donor' && <><label className="!flex items-center gap-3"><input type="checkbox" checked={fields.donor} onChange={event => set({ donor: event.target.checked })} />Save me as a donor</label><p>You can switch this off and continue as a requester. If you join as a donor, requesters with verified or temporary blood-help access may receive your account phone through Drop’s protected contact flow. It is never added to your blood request.</p></>}
    {stage === 'blood' && <><label>Blood group<Select required value={fields.blood} onChange={event => set({ blood: event.target.value })}><option value="">Choose blood group</option>{BLOOD_GROUPS.map(item => <option key={item}>{item}</option>)}</Select></label><label>Last donation<Select required value={fields.lastKind} onChange={event => set({ lastKind: event.target.value })}><option value="">Choose an option</option><option value="NEVER">I have never donated</option><option value="EXACT">I know the date</option><option value="APPROXIMATE">I remember roughly when</option></Select></label></>}
    {stage === 'history' && <>{fields.lastKind === 'EXACT' ? <label>Last donation date<DateInput className="input" required max={dhakaDate()} value={fields.lastDate} onChange={event => set({ lastDate: event.target.value })} /></label> : <><label>How long ago?<input className="input" required type="number" min={1} max={36500} value={fields.lastValue} onChange={event => set({ lastValue: event.target.value })} /></label><label>Time unit<Select value={fields.lastUnit} onChange={event => set({ lastUnit: event.target.value })}><option value="DAYS">Days</option><option value="MONTHS">Months</option><option value="YEARS">Years</option></Select></label></>}<label>Total times donated<input className="input" type="number" min={1} max={1000} required value={fields.count} onChange={event => set({ count: event.target.value })} /></label></>}
    {stage === 'availability' && <><label>Current availability<Select required value={fields.availability} onChange={event => set({ availability: event.target.value })}><option value="">Choose your availability</option><option value="AVAILABLE">I am available</option><option value="NOT_AVAILABLE">Not available right now</option></Select></label>{fields.availability === 'NOT_AVAILABLE' && <label>Reason (private)<input className="input" maxLength={500} value={fields.reason} onChange={event => set({ reason: event.target.value })} /></label>}<p>Saving your profile is not medical clearance. Existing donation intervals and safety restrictions still apply.</p></>}
    {stage === 'finish' && <><label>Create password<input className="input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label><label>Confirm password<input className="input" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={event => setConfirm(event.target.value)} /></label></>}
    {profile && error && <button type="button" className="text-primary text-left underline" onClick={() => { setVerificationToken(''); setStage('phone'); setError(''); }}>Verify phone again — keep my answers</button>}
  </StepFlow></>;
}
