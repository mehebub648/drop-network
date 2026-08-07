import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertCircle, ArrowRight, ChevronLeft, ChevronRight, Clock, Filter, Hospital, MapPin, MessageCircle, Radio } from 'lucide-react';
import { api } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES } from '../lib/locations';
import { cn } from '../lib/utils';
import { UrgencyBadge } from '../components/UrgencyBadge';
import { EmptyState, PageHeader, StatusBadge, Surface } from '../components/ui';

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const groupFilter = searchParams.get('blood_group') || '';
  const districtFilter = searchParams.get('district') || '';
  const urgentOnly = searchParams.get('urgent') === 'true';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  useEffect(() => {
    async function loadRequests() {
      try {
        setLoading(true);
        setError('');
        const data = await api.getRequests({ blood_group: groupFilter, district: districtFilter, urgent: urgentOnly, page, limit: 20 });
        setRequests(data.items);
        setPagination(data.pagination);
      } catch (cause) {
        console.error(cause);
        setError(cause instanceof Error ? cause.message : 'Could not load live blood requests.');
      } finally {
        setLoading(false);
      }
    }
    void loadRequests();
  }, [groupFilter, districtFilter, urgentOnly, page]);

  const hasFilters = Boolean(groupFilter || districtFilter || urgentOnly);

  return (
    <div className="space-y-7 sm:space-y-9">
      <PageHeader
        eyebrow="Live coordination"
        title="Blood requests that need a response"
        description="Follow active needs across Bangladesh, narrow the feed to your area, and open a request for verified coordination details."
        icon={Radio}
        aside={(
          <div className="grid grid-cols-2 gap-3">
            <Surface className="p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-slate-950">{loading ? '—' : pagination.total}</p>
              <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Active needs</p>
            </Surface>
            <Surface className="p-4 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-rose-700">{hasFilters ? 'On' : 'All'}</p>
              <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Filter view</p>
            </Surface>
          </div>
        )}
      />

      <Surface className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">
            <Filter className="h-4 w-4 text-primary" aria-hidden="true" /> Refine the feed
          </p>
          {!loading && (
            <span className="text-xs font-bold text-slate-500" aria-live="polite">
              Showing {requests.length} of {pagination.total}
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_auto_auto]">
          <select aria-label="Filter by blood group" value={groupFilter} onChange={event => updateFilter('blood_group', event.target.value)} className="input min-h-11 py-2.5 text-sm font-bold">
            <option value="">All blood groups</option>
            {BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
          </select>
          <select aria-label="Filter by district" value={districtFilter} onChange={event => updateFilter('district', event.target.value)} className="input min-h-11 py-2.5 text-sm font-bold">
            <option value="">All districts</option>
            {BD_LOCATION_NAMES.map(location => <option key={location} value={location}>{location}</option>)}
          </select>
          <button type="button" aria-pressed={urgentOnly} onClick={() => updateFilter('urgent', urgentOnly ? '' : 'true')} className={cn('min-h-11 rounded-2xl px-4 text-sm font-extrabold transition-colors', urgentOnly ? 'bg-red-700 text-white' : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100')}>
            Urgent only
          </button>
          <button type="button" disabled={!hasFilters} onClick={() => setSearchParams({})} className="min-h-11 rounded-2xl px-4 text-sm font-extrabold text-primary transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35">
            Clear filters
          </button>
        </div>
      </Surface>

      {loading ? (
        <div className="grid gap-4" aria-label="Loading requests" role="status">
          {[0, 1, 2].map(item => (
            <Surface key={item} className="flex animate-pulse items-center gap-5 p-5 sm:p-6" aria-hidden="true">
              <div className="h-16 w-16 shrink-0 rounded-2xl bg-slate-100" />
              <div className="flex-1 space-y-3"><div className="h-3 w-1/3 rounded bg-slate-100" /><div className="h-5 w-3/5 rounded bg-slate-100" /><div className="h-3 w-2/5 rounded bg-slate-100" /></div>
            </Surface>
          ))}
          <span className="sr-only">Loading blood requests…</span>
        </div>
      ) : error ? (
        <Surface className="border-red-200 bg-red-50 p-8 text-center" role="alert">
          <AlertCircle className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
          <h2 className="mt-3 font-extrabold text-red-950">Requests could not be loaded</h2>
          <p className="mt-1 text-sm text-red-800">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-2xl bg-red-700 px-5 text-sm font-extrabold text-white">Try again</button>
        </Surface>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={hasFilters ? 'No requests match these filters' : 'No active requests right now'}
          description={hasFilters ? 'Widen the area or blood-group filters to see more requests.' : 'The public request feed is currently clear. Check again when a new need is published.'}
          action={hasFilters ? <button type="button" onClick={() => setSearchParams({})} className="theme-button">Show every request</button> : undefined}
        />
      ) : (
        <div className="grid gap-4">
          {requests.map(request => (
            <Surface as="article" key={request.id} className="group overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-rose-200 sm:p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] border border-red-100 bg-red-50 text-2xl font-extrabold text-red-700">
                    {request.blood_group}
                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-500" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <UrgencyBadge neededBy={request.needed_by} />
                      <StatusBadge tone="brand">Needed {request.needed_by ? new Date(request.needed_by).toLocaleDateString() : 'ASAP'}</StatusBadge>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
                    </div>
                    <h2 className="mt-3 flex items-start gap-2 text-lg font-extrabold text-slate-950">
                      <Hospital className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0 break-words">{request.hospital_name || `Collection facility in ${request.location.area_name}`}</span>
                    </h2>
                    <p className="mt-2 flex items-start gap-2 text-sm font-semibold leading-6 text-slate-600">
                      <MapPin className="mt-1 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                      <span className="min-w-0 break-words">{request.hospital_address ? `${request.hospital_address}, ` : ''}{request.location.area_name}</span>
                    </p>
                    {request.ward && <p className="mt-1 pl-6 text-xs font-semibold text-slate-500">{request.ward}</p>}
                    {request.comment_count > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{request.comment_count} update{request.comment_count === 1 ? '' : 's'}</p>}
                  </div>
                </div>
                <Link to={`/request/${request.id}`} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-extrabold text-white transition-colors hover:bg-primary-dark">
                  View request <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </Surface>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <nav aria-label="Request pages" className="flex items-center justify-center gap-3">
          <button type="button" aria-label="Previous request page" disabled={page <= 1} onClick={() => updateFilter('page', String(page - 1))} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-bold text-slate-600">Page {page} of {pagination.pages}</span>
          <button type="button" aria-label="Next request page" disabled={page >= pagination.pages} onClick={() => updateFilter('page', String(page + 1))} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </nav>
      )}
    </div>
  );
}
