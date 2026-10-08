import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BLOOD_HELP_CHANGED, currentBloodHelpAccess, refreshBloodHelpAccess } from '../lib/api';

export function useBloodHelpAccess() {
  const [access, setAccess] = useState(currentBloodHelpAccess);
  useEffect(() => {
    const update = () => setAccess(currentBloodHelpAccess());
    window.addEventListener(BLOOD_HELP_CHANGED, update);
    window.addEventListener('focus', update);
    void refreshBloodHelpAccess().catch(() => {});
    return () => { window.removeEventListener(BLOOD_HELP_CHANGED, update); window.removeEventListener('focus', update); };
  }, []);
  useEffect(() => {
    if (!access.active || !access.expires_at) return;
    const timer = window.setTimeout(() => setAccess(currentBloodHelpAccess()), Math.max(0, Date.parse(access.expires_at) - Date.now()) + 10);
    return () => window.clearTimeout(timer);
  }, [access.active, access.expires_at]);
  return access;
}

export default function BloodHelpNotice({ onContinue }: { onContinue?: () => void }) {
  const access = useBloodHelpAccess();
  if (!access.active) return null;
  return <div role="status" className="my-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
    <p>Our SMS service is temporarily unavailable. You can still contact donors and post blood requests on this device for 24 hours.</p>
    <p className="mt-2">Access ends {new Date(access.expires_at!).toLocaleString()}. Your account phone is still unverified.</p>
    {onContinue ? <button type="button" className="button button-primary mt-3" onClick={onContinue}>Continue finding blood</button>
      : <Link className="mt-3 inline-block font-bold underline" to="/directory">Continue finding blood</Link>}
  </div>;
}
