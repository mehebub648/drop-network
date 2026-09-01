import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Activity, AlertCircle, ChevronLeft, ChevronRight, Plus, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import { EmptyState, Surface } from '../components/ui';
import { UrgencyBadge } from '../components/UrgencyBadge';
import { api } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES } from '../lib/locations';

type RequestItem = {
  id: string;
  blood_group: string;
  needed_by?: string | null;
  units_required?: number | null;
  upazila?: string | null;
  hospital_name?: string | null;
  hospital_address?: string | null;
  location?: { area_name?: string | null; upazila?: string | null; district?: string | null };
};

type FilterDraft = { bloodGroup: string; district: string; urgent: boolean };

function formatNeededDate(value?: string | null) {
  if (!value) return 'Needed as soon as possible';
  return `Needed ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(value))}`;
}

function requestLocation(request: RequestItem) {
  const parts = [request.upazila, request.location?.area_name].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return request.location?.area_name || request.hospital_address || 'Location shared in request';
}

function MobileFilterSheet({ initial, onApply, onClose }: { initial: FilterDraft; onApply: (draft: FilterDraft) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(initial);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled])');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keepFocusInside);
    return () => document.removeEventListener('keydown', keepFocusInside);
  }, []);

  return (
    <ModalPortal onClose={onClose}>
      <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/45 sm:hidden" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="request-filter-title" className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
          <div className="mx-auto h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <h2 ref={headingRef} tabIndex={-1} id="request-filter-title" className="text-xl font-extrabold text-slate-950 outline-none">Filter requests</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Choose what you want to see.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close filters" className="flex h-12 w-12 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"><X className="h-5 w-5" aria-hidden="true" /></button>
          </div>

          <div className="mt-6 space-y-5">
            <label className="block text-sm font-extrabold text-slate-800">
              Blood group
              <select value={draft.bloodGroup} onChange={event => setDraft(current => ({ ...current, bloodGroup: event.target.value }))} className="input mt-2 min-h-12 w-full text-base">
                <option value="">All blood groups</option>
                {BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
            <label className="block text-sm font-extrabold text-slate-800">
              District
              <select value={draft.district} onChange={event => setDraft(current => ({ ...current, district: event.target.value }))} className="input mt-2 min-h-12 w-full text-base">
                <option value="">All districts</option>
                {BD_LOCATION_NAMES.map(location => <option key={location} value={location}>{location}</option>)}
              </select>
            </label>
            <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
              <span><span className="block text-sm font-extrabold text-slate-900">Urgent only</span><span className="block text-xs font-semibold text-slate-500">Requests needed within 72 hours</span></span>
              <input type="checkbox" checked={draft.urgent} onChange={event => setDraft(current => ({ ...current, urgent: event.target.checked }))} className="h-5 w-5 accent-red-700" />
            </label>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setDraft({ bloodGroup: '', district: '', urgent: false })} className="min-h-12 rounded-2xl border border-slate-200 px-5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">Reset</button>
            <button type="button" onClick={() => onApply(draft)} className="min-h-12 rounded-2xl bg-primary px-5 text-sm font-extrabold text-white hover:bg-primary-dark">Apply filters</button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
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

  const applyMobileFilters = (draft: FilterDraft) => {
    const next = new URLSearchParams(searchParams);
    if (draft.bloodGroup) next.set('blood_group', draft.bloodGroup); else next.delete('blood_group');
    if (draft.district) next.set('district', draft.district); else next.delete('district');
    if (draft.urgent) next.set('urgent', 'true'); else next.delete('urgent');
    next.delete('page');
    setSearchParams(next);
    setFiltersOpen(false);
    requestAnimationFrame(() => filterButtonRef.current?.focus());
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
      } finally { setLoading(false); }
    }
    void loadRequests();
  }, [groupFilter, districtFilter, urgentOnly, page, refreshKey]);

  const hasFilters = Boolean(groupFilter || districtFilter || urgentOnly);
  const filterCount = [groupFilter, districtFilter, urgentOnly].filter(Boolean).length;
  const summary = `${groupFilter || 'All blood groups'} · ${districtFilter || 'All districts'}${urgentOnly ? ' · Urgent only' : ''}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-primary">Live requests</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Blood requests</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600 sm:text-base">Find an active need and open it for protected coordination details.</p>
        </div>
        <Link to="/directory" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-primary-dark"><Plus className="h-4 w-4" aria-hidden="true" /> New <span className="hidden sm:inline">request</span></Link>
      </header>

      <Surface className="overflow-hidden">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:hidden">
          <div className="min-w-0"><p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Showing</p><p className="truncate text-sm font-extrabold text-slate-900">{summary}</p></div>
          <button ref={filterButtonRef} type="button" onClick={() => setFiltersOpen(true)} className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-extrabold text-primary hover:bg-rose-50" aria-haspopup="dialog"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ''}</button>
        </div>
        <div className="hidden grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto_auto] items-center gap-3 p-4 sm:grid">
          <select aria-label="Filter by blood group" value={groupFilter} onChange={event => updateFilter('blood_group', event.target.value)} className="input min-h-11 py-2.5 text-sm font-bold"><option value="">All blood groups</option>{BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}</select>
          <select aria-label="Filter by district" value={districtFilter} onChange={event => updateFilter('district', event.target.value)} className="input min-h-11 py-2.5 text-sm font-bold"><option value="">All districts</option>{BD_LOCATION_NAMES.map(location => <option key={location} value={location}>{location}</option>)}</select>
          <button type="button" aria-pressed={urgentOnly} onClick={() => updateFilter('urgent', urgentOnly ? '' : 'true')} className={`min-h-11 rounded-xl px-4 text-sm font-extrabold transition-colors ${urgentOnly ? 'bg-red-700 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>Urgent only</button>
          <button type="button" disabled={!hasFilters} onClick={() => setSearchParams({})} className="min-h-11 rounded-xl px-3 text-sm font-extrabold text-primary hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35">Reset</button>
        </div>
      </Surface>

      <div className="flex min-h-10 items-center justify-between gap-3 px-1">
        <p className="text-sm font-extrabold text-slate-700" aria-live="polite">{loading ? 'Loading requests…' : `${pagination.total} active request${pagination.total === 1 ? '' : 's'}`}</p>
        <button type="button" onClick={() => setRefreshKey(value => value + 1)} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-extrabold text-slate-600 hover:bg-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh</button>
      </div>

      {loading ? (
        <Surface className="divide-y divide-slate-100" aria-label="Loading requests" role="status">{[0, 1, 2].map(item => <div key={item} className="flex animate-pulse gap-4 p-4 sm:p-5" aria-hidden="true"><div className="h-16 w-16 shrink-0 rounded-2xl bg-slate-100" /><div className="flex-1 space-y-3 py-1"><div className="h-3 w-1/4 rounded bg-slate-100" /><div className="h-4 w-3/5 rounded bg-slate-100" /><div className="h-3 w-2/5 rounded bg-slate-100" /></div></div>)}<span className="sr-only">Loading blood requests…</span></Surface>
      ) : error ? (
        <Surface className="border-red-200 bg-red-50 p-8 text-center" role="alert"><AlertCircle className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" /><h2 className="mt-3 font-extrabold text-red-950">Requests could not be loaded</h2><p className="mt-1 text-sm text-red-800">{error}</p><button type="button" onClick={() => setRefreshKey(value => value + 1)} className="mt-5 min-h-12 rounded-2xl bg-red-700 px-5 text-sm font-extrabold text-white">Try again</button></Surface>
      ) : requests.length === 0 ? (
        <EmptyState icon={Activity} title={hasFilters ? 'No requests match these filters' : 'No active requests right now'} description={hasFilters ? 'Reset or change your filters to see more requests.' : 'Check again when a new need is published.'} action={hasFilters ? <button type="button" onClick={() => setSearchParams({})} className="theme-button">Reset filters</button> : undefined} />
      ) : (
        <Surface className="divide-y divide-slate-100 overflow-hidden">
          {requests.map(request => <article key={request.id}><Link to={`/request/${request.id}`} className="group flex min-h-28 items-center gap-4 p-4 transition-colors hover:bg-rose-50/45 sm:gap-5 sm:p-5"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-black text-white shadow-sm">{request.blood_group}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><UrgencyBadge neededBy={request.needed_by} /><span className="text-xs font-bold text-slate-500">{formatNeededDate(request.needed_by)}</span></div><h2 className="mt-2 truncate text-base font-extrabold text-slate-950 sm:text-lg">{request.hospital_name || 'Collection facility'}</h2><p className="mt-1 truncate text-sm font-semibold text-slate-500">{requestLocation(request)}</p><p className="mt-2 text-xs font-extrabold text-slate-700">{request.units_required || 1} unit{(request.units_required || 1) === 1 ? '' : 's'} requested</p></div><ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" /></Link></article>)}
        </Surface>
      )}

      {pagination.pages > 1 && <nav aria-label="Request pages" className="flex items-center justify-center gap-3 pt-1"><button type="button" aria-label="Previous request page" disabled={page <= 1} onClick={() => updateFilter('page', String(page - 1))} className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button><span className="text-sm font-bold text-slate-600">Page {page} of {pagination.pages}</span><button type="button" aria-label="Next request page" disabled={page >= pagination.pages} onClick={() => updateFilter('page', String(page + 1))} className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button></nav>}

      {filtersOpen && <MobileFilterSheet initial={{ bloodGroup: groupFilter, district: districtFilter, urgent: urgentOnly }} onApply={applyMobileFilters} onClose={() => { setFiltersOpen(false); requestAnimationFrame(() => filterButtonRef.current?.focus()); }} />}
    </div>
  );
}
