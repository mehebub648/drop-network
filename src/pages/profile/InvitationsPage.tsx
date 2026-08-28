import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bell, CheckCircle2, Clock3, Hospital, MapPin, Phone, XCircle } from 'lucide-react';
import { api, type DonationFollowUp, type DonationOutcome } from '../../lib/api';

export default function InvitationsPage({ user }: { user: { id: string } }) {
  const [responses, setResponses] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<DonationFollowUp[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const [responseData, notificationData, followUpData] = await Promise.all([api.getInvitations(), api.getNotifications(), api.getDonationFollowUps()]);
    setResponses(responseData);
    setNotifications(notificationData);
    setFollowUps(followUpData);
  };
  useEffect(() => { load().catch(error => setMessage(error.message || 'Could not load invitations.')); }, []);

  const update = async (id: string, status: string) => {
    setBusy(id); setMessage('');
    try { await api.updateDonorResponse(id, status); await load(); }
    catch (error: any) { setMessage(error.message || 'Could not update response.'); }
    finally { setBusy(''); }
  };
  const confirm = async (id: string) => {
    setBusy(id); setMessage('');
    try { await api.confirmDonation(id); await load(); }
    catch (error: any) { setMessage(error.message || 'Could not confirm donation.'); }
    finally { setBusy(''); }
  };
  const updateFollowUp = async (id: string, outcome: DonationOutcome) => {
    setBusy(id); setMessage('');
    try { await api.submitDonationFollowUp(id, outcome); await load(); }
    catch (error: any) { setMessage(error.message || 'Could not update the follow-up.'); }
    finally { setBusy(''); }
  };

  return (
    <div className="space-y-6">
      <section className="theme-card border border-slate-100 p-6 sm:p-8">
        <h2 className="text-2xl font-extrabold">Responses &amp; follow-ups</h2>
        <p className="text-slate-500 mt-1">Track invitations and the donor/requester confirmation timeline in one place.</p>
        {message && <p role="alert" className="mt-4 text-red-600 font-bold text-sm">{message}</p>}
        <div className="mt-6 space-y-4">
          {followUps.map(followUp => {
            const myOutcome = followUp.role === 'DONOR' ? followUp.donor_outcome : followUp.requester_outcome;
            return <article key={followUp.id} className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wide text-primary">Donation follow-up</p><h3 className="mt-1 font-extrabold">{followUp.request?.facility || 'Blood request'}</h3><p className="mt-1 text-sm text-slate-600">{followUp.request?.blood_group} · {followUp.request?.district}{followUp.request?.upazila ? ` · ${followUp.request.upazila}` : ''}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold">{followUp.state.replaceAll('_', ' ')}</span></div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><p><strong>Donor:</strong> {followUp.donor_outcome?.replaceAll('_', ' ') || 'Waiting'}</p><p><strong>Requester:</strong> {followUp.requester_outcome?.replaceAll('_', ' ') || 'Waiting'}</p></div>
              {!myOutcome && !['CONFIRMED', 'NOT_DONATED', 'DISPUTED'].includes(followUp.state) && <div className="mt-4 flex flex-wrap gap-2 border-t border-rose-100 pt-4"><button disabled={busy === followUp.id} onClick={() => updateFollowUp(followUp.id, 'DONATED')} className="response-primary"><CheckCircle2 className="h-4 w-4" /> Donated</button><button disabled={busy === followUp.id} onClick={() => updateFollowUp(followUp.id, 'NOT_DONATED')} className="response-secondary"><XCircle className="h-4 w-4" /> Not donated</button>{followUp.role === 'DONOR' && followUp.reminder_count < 1 && <button disabled={busy === followUp.id} onClick={() => updateFollowUp(followUp.id, 'REMIND_LATER')} className="response-secondary"><Clock3 className="h-4 w-4" /> Remind tomorrow</button>}</div>}
              {followUp.state === 'DISPUTED' && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">The answers conflict. This is not counted as a confirmed donation.</p>}
            </article>;
          })}
        </div>
        <div className="mt-6 space-y-4">
          {responses.length === 0 && followUps.length === 0 && <p className="text-sm text-slate-500 py-8 text-center">No responses or donation follow-ups yet.</p>}
          {responses.map(response => {
            const isDonor = response.donor_id === user.id;
            return <article key={response.id} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-700 font-extrabold flex items-center justify-center">{response.request?.blood_group}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap"><strong>{isDonor ? response.requester?.name : response.donor?.name}</strong><span className="text-[10px] font-bold rounded-full bg-slate-100 px-2 py-1">{response.status}</span></div>
                  <p className="mt-2 text-sm text-slate-600 flex items-center gap-1"><Hospital className="w-4 h-4" /> {response.request?.hospital_name}</p>
                  <p className="mt-1 text-sm text-slate-500 flex items-center gap-1"><MapPin className="w-4 h-4" /> {response.request?.location?.area_name} · {new Date(response.request?.needed_by).toLocaleString()}</p>
                  {(response.donor_phone || response.requester_contacts?.length) && <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-900"><p className="font-bold">Accepted coordination contact</p>{response.donor_phone && <a className="mt-1 flex items-center gap-1" href={`tel:${response.donor_phone}`}><Phone className="w-4 h-4" /> {response.donor_phone}</a>}{response.requester_contacts?.map((contact: any) => <a key={contact.phone} className="mt-1 flex items-center gap-1" href={`tel:${contact.phone}`}><Phone className="w-4 h-4" /> {contact.name}: {contact.phone}</a>)}</div>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {isDonor && response.status === 'INVITED' && <><button disabled={busy === response.id} onClick={() => update(response.id, 'ACCEPTED')} className="response-primary"><CheckCircle2 className="w-4 h-4" /> Accept</button><button disabled={busy === response.id} onClick={() => update(response.id, 'DECLINED')} className="response-secondary"><XCircle className="w-4 h-4" /> Decline</button></>}
                {isDonor && response.status === 'ACCEPTED' && <button disabled={busy === response.id} onClick={() => update(response.id, 'ARRIVED')} className="response-primary">I arrived</button>}
                {isDonor && ['ACCEPTED', 'ARRIVED'].includes(response.status) && <button disabled={busy === response.id} onClick={() => update(response.id, 'DONATED')} className="response-primary">I donated</button>}
                {!isDonor && response.donor_confirmed_at && !response.requester_confirmed_at && <button disabled={busy === response.id} onClick={() => confirm(response.id)} className="response-primary">Confirm received donation</button>}
                <Link to={`/request/${response.request_id}`} className="response-secondary">View request</Link>
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="theme-card border border-slate-100 p-6 sm:p-8">
        <h2 className="font-extrabold flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Notifications</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {notifications.length === 0 && <p className="text-sm text-slate-500 py-6">No notifications.</p>}
          {notifications.slice(0, 20).map(notification => <Link key={notification.id} to={notification.href} onClick={() => api.markNotificationRead(notification.id).catch(() => undefined)} className="block py-4"><div className="flex gap-3"><Clock3 className="w-4 h-4 text-slate-400 mt-1" /><div><p className={notification.read_at ? 'font-medium text-slate-600' : 'font-extrabold text-slate-900'}>{notification.title}</p><p className="text-sm text-slate-500 mt-1">{notification.body}</p></div></div></Link>)}
        </div>
      </section>
    </div>
  );
}
