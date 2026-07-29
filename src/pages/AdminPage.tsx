import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Shield, UserCheck, Users } from 'lucide-react';
import { api } from '../lib/api';

type Overview = {
  counts: Record<string, number>;
  reports: any[];
  tickets: any[];
};

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [directoryClaims, setDirectoryClaims] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    try {
      const [nextOverview, nextRequests, nextOrganizations, nextClaims] = await Promise.all([
        api.getAdminOverview(), api.getAdminRequests(), api.getAdminOrganizations(), api.getDirectoryClaims()
      ]);
      setOverview(nextOverview);
      setRequests(nextRequests);
      setOrganizations(nextOrganizations);
      setDirectoryClaims(nextClaims.claims);
      setError('');
    } catch (caught: any) {
      setError(caught.message || 'Could not load operations data.');
    }
  };

  useEffect(() => { load(); }, []);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError('');
    try { await action(); await load(); }
    catch (caught: any) { setError(caught.message || 'The update failed.'); }
    finally { setBusy(''); }
  };

  if (!overview && !error) return <div className="py-20 text-center text-slate-500">Loading operations console…</div>;

  const labels: Record<string, string> = {
    users: 'Members', verified_users: 'Verified members', suspended_users: 'Suspended', active_requests: 'Active requests',
    open_reports: 'Open reports', open_tickets: 'Open tickets', confirmed_donations: 'Confirmed donations'
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Operations</p>
        <h1 className="text-3xl font-bold text-slate-900 mt-2">Safety and moderation console</h1>
        <p className="text-slate-600 mt-2">Review reports, support requests, and public blood requests. Every decision is written to the audit log.</p>
      </div>
      {error && <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {overview && <>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Operational metrics">
          {Object.entries(overview.counts).map(([key, value]) => (
            <div key={key} className="theme-card border border-slate-100 p-5"><div className="text-2xl font-bold">{value}</div><div className="text-sm text-slate-500 mt-1">{labels[key] || key}</div></div>
          ))}
        </section>

        <section className="theme-card border border-slate-100 p-6">
          <h2 className="font-bold text-xl flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Organization applications</h2>
          <div className="mt-4 space-y-3">{organizations.length === 0 && <p className="text-sm text-slate-500">No applications.</p>}{organizations.map(org => <div key={org.id} className="rounded-xl border p-4 flex flex-col sm:flex-row gap-3 justify-between"><div><p className="font-bold">{org.name}</p><p className="text-xs text-slate-500">{org.status} · {org.type} · {org.district} · Ref {org.registration_reference}</p></div><div className="flex gap-2"><button onClick={() => run(org.id, () => api.reviewOrganization(org.id, 'VERIFIED', 'Organization reference reviewed.'))} className="px-3 py-2 border rounded-lg text-xs font-bold">Verify</button><button onClick={() => run(org.id, () => api.reviewOrganization(org.id, 'REJECTED', 'Verification requirements not met.'))} className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold">Reject</button></div></div>)}</div>
        </section>

        <section className="theme-card border border-slate-100 p-6">
          <h2 className="font-bold text-xl flex items-center gap-2"><UserCheck className="w-5 h-5 text-primary" /> Imported profile claims</h2>
          <p className="text-sm text-slate-500 mt-1">Claims that could not be verified automatically, because the source published no phone number or the claimant is calling from a different one.</p>
          <div className="mt-4 space-y-3">
            {directoryClaims.length === 0 && <p className="text-sm text-slate-500">No claims waiting for review.</p>}
            {directoryClaims.map(claim => <div key={claim.id} className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <div className="font-bold text-sm">{claim.name} · {claim.blood_group} · {claim.district}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Listed by {claim.source.organization} as {claim.phone_masked || 'no published number'} · claimed by {claim.claimant?.name || 'unknown'} ({claim.claimant?.phone || '—'}) · {claim.claim_note}
                </div>
              </div>
              <div className="flex gap-2">
                <button disabled={busy === claim.id} onClick={() => run(claim.id, () => api.reviewDirectoryClaim(claim.id, true))} className="px-3 py-2 rounded-lg border text-xs font-bold">Approve</button>
                <button disabled={busy === claim.id} onClick={() => run(claim.id, () => api.reviewDirectoryClaim(claim.id, false))} className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">Decline</button>
              </div>
            </div>)}
          </div>
        </section>

        <section className="theme-card border border-slate-100 p-6">
          <h2 className="font-bold text-xl flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Reports</h2>
          <div className="mt-4 space-y-3">
            {overview.reports.length === 0 && <p className="text-sm text-slate-500">No reports.</p>}
            {overview.reports.map(report => <div key={report.id} className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div><div className="font-bold text-sm">{report.target_type}: {report.reason}</div><div className="text-xs text-slate-500 mt-1">{report.status} · {report.details || 'No additional detail'}</div></div>
              <div className="flex gap-2"><button disabled={busy === report.id} onClick={() => run(report.id, () => api.updateReport(report.id, 'REVIEWING'))} className="px-3 py-2 rounded-lg border text-xs font-bold">Review</button><button disabled={busy === report.id} onClick={() => run(report.id, () => api.updateReport(report.id, 'RESOLVED'))} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Resolve</button></div>
            </div>)}
          </div>
        </section>

        <section className="theme-card border border-slate-100 p-6">
          <h2 className="font-bold text-xl flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" /> Support queue</h2>
          <div className="mt-4 space-y-3">
            {overview.tickets.length === 0 && <p className="text-sm text-slate-500">No support tickets.</p>}
            {overview.tickets.map(ticket => <div key={ticket.id} className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div><div className="font-bold text-sm">{ticket.category}: {ticket.name}</div><div className="text-xs text-slate-500 mt-1">{ticket.status} · {ticket.message}</div></div>
              <div className="flex gap-2"><button disabled={busy === ticket.id} onClick={() => run(ticket.id, () => api.updateTicket(ticket.id, 'IN_PROGRESS'))} className="px-3 py-2 rounded-lg border text-xs font-bold">Assign to me</button><button disabled={busy === ticket.id} onClick={() => run(ticket.id, () => api.updateTicket(ticket.id, 'CLOSED'))} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Close</button></div>
            </div>)}
          </div>
        </section>

        <section className="theme-card border border-slate-100 p-6">
          <h2 className="font-bold text-xl flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Recent requests</h2>
          <div className="mt-4 space-y-3">
            {requests.slice(0, 30).map(request => <div key={request.id} className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div><div className="font-bold text-sm">{request.blood_group} {request.component} · {request.hospital_name}</div><div className="text-xs text-slate-500 mt-1">{request.status} · {request.location?.area_name}</div></div>
              <div className="flex gap-2"><button disabled={busy === request.id} onClick={() => run(request.id, () => api.moderateRequest(request.id, 'ACTIVE', 'Reviewed by an operator.'))} className="px-3 py-2 rounded-lg border text-xs font-bold"><CheckCircle2 className="inline w-3 h-3 mr-1" />Approve</button><button disabled={busy === request.id} onClick={() => run(request.id, () => api.moderateRequest(request.id, 'REJECTED', 'Removed after moderation review.'))} className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">Reject</button></div>
            </div>)}
          </div>
        </section>
      </>}
      <p className="text-xs text-slate-500 flex gap-2 items-center"><Users className="w-4 h-4" /> Role and suspension management is available through the protected admin API; a dedicated user-management view will follow.</p>
    </div>
  );
}
