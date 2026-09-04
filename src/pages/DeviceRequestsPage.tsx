import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { experienceApi } from '../lib/api';
import RequestVerification from '../components/RequestVerification';

export default function DeviceRequestsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { experienceApi.guestRequests().then(result => setItems(result.items)).catch(cause => setError(cause.message)).finally(() => setLoading(false)); }, []);
  return <main className="mx-auto max-w-3xl px-5 py-12">
    <h1 className="text-3xl font-extrabold">Requests on this device</h1>
    <p className="my-5 text-slate-600">You can manage these posts until their deadlines. Clearing this browser’s data loses access. Signing in moves all unexpired posts to your account.</p>
    <Link className="text-primary underline" to="/login?returnTo=%2Fprofile%2Frequests">Sign in to keep your requests</Link>
    {error && <p role="alert" className="my-5 text-red-700">{error}</p>}
    {loading ? <p role="status" className="py-8">Loading requests…</p> : items.length === 0 ? <p className="py-8">No unexpired guest requests on this device. Account-owned posts are in <Link to="/profile/requests" className="underline">My requests</Link>.</p> : <ul className="mt-8 divide-y divide-slate-200">{items.map(item => <li key={item.id} className="py-6"><RequestVerification state={item.verification_state} /><h2 className="mt-2 text-xl font-bold">{item.blood_group} · {item.hospital_name}</h2><p className="mt-2">Needed {item.needed_date} · {item.closure_reason || item.status}</p><Link to={`/request/${item.id}`} className="mt-3 inline-block text-primary underline">Manage request</Link></li>)}</ul>}
  </main>;
}
