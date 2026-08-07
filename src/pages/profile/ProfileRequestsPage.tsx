import { useEffect, useMemo, useState } from 'react';
import { Activity, Heart, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

type RequestStatus = 'DRAFT' | 'PENDING_VERIFICATION' | 'ACTIVE' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED';

export default function ProfileRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState<'ALL' | RequestStatus>('ALL');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMyRequests()
      .then(setRequests)
      .catch((reason: any) => setError(reason.message || 'Could not load requests.'))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => filter === 'ALL' ? requests : requests.filter(request => request.status === filter), [filter, requests]);

  const updateStatus = async (id: string, status: RequestStatus) => {
    setUpdating(id);
    setError('');
    try {
      const updated = await api.updateRequestStatus(id, status);
      setRequests(current => current.map(request => request.id === id ? updated : request));
    } catch (reason: any) {
      setError(reason.message || 'Could not update request.');
    } finally {
      setUpdating('');
    }
  };

  return (
    <div className="theme-card border border-slate-100 p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">My requests</h2>
          <p className="text-slate-500 mt-1">Track and close blood requests you created.</p>
        </div>
        <label className="text-sm font-bold text-slate-600">
          <span className="sr-only">Filter requests</span>
          <select value={filter} onChange={event => setFilter(event.target.value as typeof filter)} className="px-4 py-3 bg-slate-50 rounded-xl outline-none">
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PARTIALLY_FULFILLED">Partially fulfilled</option>
            <option value="DRAFT">Draft</option>
            <option value="EXPIRED">Expired</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
      </div>

      {error && <p className="mt-5 text-sm font-bold text-red-600">{error}</p>}
      {loading ? (
        <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-rose-100 border-t-primary rounded-full animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="py-14 text-center">
          <Heart className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700 mt-3">{filter === 'ALL' ? 'You have not made a request yet.' : `No ${filter.toLowerCase()} requests.`}</p>
          <Link to="/" className="inline-block mt-3 text-primary font-bold hover:underline">Request blood</Link>
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          {visible.map(request => (
            <article key={request.id} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-700 font-extrabold flex items-center justify-center">{request.blood_group}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-[10px] px-2 py-1 rounded-full font-bold', request.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : request.status === 'FULFILLED' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600')}>{request.status}</span>
                    <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="font-bold mt-2 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {request.location.area_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select aria-label={`Status for ${request.blood_group} request`} value={request.status} disabled={updating === request.id} onChange={event => updateStatus(request.id, event.target.value as RequestStatus)} className="px-3 py-2.5 bg-slate-50 rounded-xl text-sm font-bold outline-none">
                    {!['ACTIVE', 'CANCELLED', 'FULFILLED'].includes(request.status) && <option value={request.status}>{request.status.replaceAll('_', ' ')}</option>}
                    <option value="ACTIVE">Active</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <Link to={`/request/${request.id}`} className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold inline-flex items-center gap-1 hover:bg-primary-dark"><Activity className="w-4 h-4" /> View</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
