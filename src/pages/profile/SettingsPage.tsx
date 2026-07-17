import { useState } from 'react';
import { Bell, Download, Languages, LockKeyhole, Save, Trash2 } from 'lucide-react';
import type { ProfileUser } from './types';

type Preferences = {
  urgentAlerts: boolean;
  requestUpdates: boolean;
  language: 'English';
};

function loadPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem('drop_preferences') || '{}');
    return { urgentAlerts: Boolean(saved.urgentAlerts), requestUpdates: Boolean(saved.requestUpdates), language: 'English' };
  } catch {
    return { urgentAlerts: false, requestUpdates: false, language: 'English' };
  }
}

export default function SettingsPage({ user }: { user: ProfileUser }) {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem('drop_preferences', JSON.stringify(preferences));
    setSaved(true);
  };

  const exportAccount = () => {
    const content = JSON.stringify({ exported_at: new Date().toISOString(), account: user }, null, 2);
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
              <label className="flex items-center gap-3"><input type="checkbox" checked={preferences.urgentAlerts} onChange={event => setPreferences(current => ({ ...current, urgentAlerts: event.target.checked }))} className="w-4 h-4 accent-rose-600" /> <span className="font-medium">Urgent requests for my blood group</span></label>
              <label className="flex items-center gap-3"><input type="checkbox" checked={preferences.requestUpdates} onChange={event => setPreferences(current => ({ ...current, requestUpdates: event.target.checked }))} className="w-4 h-4 accent-rose-600" /> <span className="font-medium">Updates to my requests</span></label>
            </div>
          </section>

          <section className="pt-5 border-t border-slate-100">
            <h3 className="font-extrabold flex items-center gap-2"><Languages className="w-5 h-5 text-primary" /> Language</h3>
            <select value={preferences.language} onChange={() => undefined} className="mt-3 px-4 py-3 bg-slate-50 rounded-xl font-medium"><option>English</option></select>
            <p className="text-xs text-slate-400 mt-2">Bangla localization is not available yet.</p>
          </section>

          <section className="pt-5 border-t border-slate-100">
            <h3 className="font-extrabold flex items-center gap-2"><LockKeyhole className="w-5 h-5 text-primary" /> Privacy</h3>
            <p className="text-sm text-slate-500 mt-2">Your phone stays off public lists. Signed-in members viewing a request can access contact details for coordination. See the Privacy Policy for the full current behavior.</p>
          </section>
        </div>

        <div className="mt-7 flex items-center gap-3">
          <button type="button" onClick={save} className="px-5 py-3 bg-slate-900 text-white rounded-xl font-bold inline-flex items-center gap-2"><Save className="w-4 h-4" /> Save preferences</button>
          {saved && <span className="text-sm font-bold text-emerald-700">Saved on this device.</span>}
        </div>
      </div>

      <div className="theme-card border border-slate-100 p-6">
        <h2 className="font-extrabold">Account data</h2>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={exportAccount} className="px-4 py-3 bg-slate-100 text-slate-800 rounded-xl font-bold inline-flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Export my account</button>
          <button type="button" disabled className="px-4 py-3 bg-red-50 text-red-400 rounded-xl font-bold inline-flex items-center justify-center gap-2 cursor-not-allowed"><Trash2 className="w-4 h-4" /> Delete account</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Hard deletion is disabled until a reviewed workflow can remove account, request, session, and donor-partition records safely. Contact support for a manual request.</p>
      </div>
    </div>
  );
}
