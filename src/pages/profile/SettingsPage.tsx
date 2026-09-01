import { useState } from 'react';
import { Bell, Download, LockKeyhole, Save, Trash2 } from 'lucide-react';
import type { ProfileUser } from './types';
import { api } from '../../lib/api';

type Preferences = {
  urgentAlerts: boolean;
  requestUpdates: boolean;
};

function loadPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem('drop_preferences') || '{}');
    return { urgentAlerts: Boolean(saved.urgentAlerts), requestUpdates: Boolean(saved.requestUpdates) };
  } catch {
    return { urgentAlerts: false, requestUpdates: false };
  }
}

export default function SettingsPage({ user }: { user: ProfileUser }) {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [saved, setSaved] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [accountMessage, setAccountMessage] = useState('');

  const save = () => {
    localStorage.setItem('drop_preferences', JSON.stringify(preferences));
    setSaved(true);
  };

  const exportAccount = async () => {
    const content = JSON.stringify(await api.exportAccount(), null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'drop-account-export.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="theme-card border border-slate-100 p-6 sm:p-8">
        <h2 className="text-2xl font-extrabold tracking-tight">Settings</h2>
        <p className="text-slate-500 mt-1">Device preferences and account controls.</p>

        <div className="mt-7 space-y-6">
          <section>
            <h3 className="font-extrabold flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Notification preferences</h3>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mt-3">These choices are stored on this device only. Push and email delivery are not connected yet.</p>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3"><input type="checkbox" checked={preferences.urgentAlerts} onChange={event => setPreferences(current => ({ ...current, urgentAlerts: event.target.checked }))} className="w-4 h-4 accent-primary" /> <span className="font-medium">Urgent requests for my blood group</span></label>
              <label className="flex items-center gap-3"><input type="checkbox" checked={preferences.requestUpdates} onChange={event => setPreferences(current => ({ ...current, requestUpdates: event.target.checked }))} className="w-4 h-4 accent-primary" /> <span className="font-medium">Updates to my requests</span></label>
            </div>
          </section>

          <section className="pt-5 border-t border-slate-100">
            <h3 className="font-extrabold flex items-center gap-2"><LockKeyhole className="w-5 h-5 text-primary" /> Privacy</h3>
            <p className="text-sm text-slate-500 mt-2">Your donor phone is masked in search results and every reveal is recorded. A patient-side contact chosen for an active blood request is public on that request's detail page so donors can call immediately. See the Privacy Policy for the full current behavior.</p>
          </section>
        </div>

        <div className="mt-7 flex items-center gap-3">
          <button type="button" onClick={save} className="px-5 py-3 bg-primary text-white rounded-xl font-bold inline-flex items-center gap-2 hover:bg-primary-dark"><Save className="w-4 h-4" /> Save preferences</button>
          {saved && <span className="text-sm font-bold text-green-700">Saved on this device.</span>}
        </div>
      </div>

      <div className="theme-card border border-slate-100 p-6">
        <h2 className="font-extrabold">Account data</h2>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={exportAccount} className="px-4 py-3 bg-slate-100 text-slate-800 rounded-xl font-bold inline-flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Export my account</button>
          <button type="button" disabled={!deletePassword} onClick={async () => { if (!window.confirm('Anonymize your account and cancel active requests? This cannot be undone.')) return; try { await api.deleteAccount(deletePassword); window.location.href = '/'; } catch (error: any) { setAccountMessage(error.message); } }} className="px-4 py-3 bg-red-50 text-red-700 rounded-xl font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40"><Trash2 className="w-4 h-4" /> Delete account</button>
        </div>
        <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="Current password to enable deletion" className="mt-3 w-full max-w-sm px-4 py-3 rounded-xl border" />
        {accountMessage && <p className="mt-2 text-sm font-bold text-red-600">{accountMessage}</p>}
        <p className="mt-3 text-xs text-slate-500">Deletion immediately revokes sessions, removes donor availability and private patient/contact data, cancels active requests, and anonymizes retained coordination and safety records.</p>
      </div>
    </div>
  );
}
