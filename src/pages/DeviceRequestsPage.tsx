import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { experienceApi } from '../lib/api';
import RequestVerification from '../components/RequestVerification';
import { EmptyState, PageHeader, Surface } from '../components/ui';
import { FileText } from 'lucide-react';

export default function DeviceRequestsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { experienceApi.guestRequests().then(result => setItems(result.items)).catch(cause => setError(cause.message)).finally(() => setLoading(false)); }, []);
  return <div className="space-y-6">
    <PageHeader eyebrow="Your activity" title="Requests on this device" description="Manage requests created in this browser until their deadlines. Sign in to keep unexpired requests with your account." aside={<Link className="button button-secondary" to="/login?returnTo=%2Fprofile%2Frequests">Sign in to keep requests</Link>} />
    {error && <p role="alert" className="my-5 text-red-700">{error}</p>}
    {loading ? <Surface role="status" className="p-8 text-sm text-slate-500">Loading requests…</Surface> : items.length === 0 ? <EmptyState icon={FileText} title="No requests on this device" description="Requests you create as a guest will appear here. Clearing browser data removes your access to them." action={<div className="flex flex-wrap justify-center gap-3"><Link to="/directory" className="button button-primary">Find donors</Link><Link to="/profile/requests" className="button button-secondary">Account requests</Link></div>} /> : <Surface as="ul" className="divide-y divide-slate-100">{items.map(item => <li key={item.id} className="p-6"><RequestVerification state={item.verification_state} /><h2 className="mt-3 text-lg font-semibold">{item.blood_group} · {item.hospital_name}</h2><p className="mt-2 text-sm text-slate-500">Needed {item.needed_date} · {item.closure_reason || item.status}</p><Link to={`/request/${item.id}`} className="mt-4 button button-secondary">Manage request</Link></li>)}</Surface>}
  </div>;
}
