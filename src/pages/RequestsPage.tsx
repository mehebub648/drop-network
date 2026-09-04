import Select from '../components/Select';
import RequestVerification from '../components/RequestVerification';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Activity, AlertCircle, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, X } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import { EmptyState, Surface } from '../components/ui';
import { UrgencyBadge } from '../components/UrgencyBadge';
import { api } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES } from '../lib/locations';

type RequestItem = {
  id: string;
  verification_state?: string;
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
  const district = request.location?.area_name || request.location?.district;
  const parts = [request.upazila || request.location?.upazila, district].filter(Boolean);
  return parts.length ? parts.join(', ') : request.hospital_address || 'Location shared in request';
}

function FilterSheet({ initial, onApply, onClose }: { initial: FilterDraft; onApply: (draft: FilterDraft) => void; onClose: () => void }) {
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
      <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/45 sm:items-center sm:justify-center sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="request-filter-title" className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:max-w-lg sm:rounded-[1.75rem] sm:p-6">
          <div className="mx-auto h-1 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden="true" />
          <div className="mt-4 flex items-center justify-between gap-4 sm:mt-0">
            <div><h2 ref={headingRef} tabIndex={-1} id="request-filter-title" className="text-xl font-extrabold text-slate-950 outline-none">Filter requests</h2><p className="mt-1 text-sm font-medium text-slate-500">Choose what you want to see.</p></div>
            <button type="button" onClick={onClose} aria-label="Close filters" className="flex h-12 w-12 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"><X className="h-5 w-5" aria-hidden="true" /></button>
          </div>
          <div className="mt-6 space-y-5">
            <label className="block text-sm font-extrabold text-slate-800">Blood group<Select value={draft.bloodGroup} onChange={event => setDraft(current => ({ ...current, bloodGroup: event.target.value }))} className="input mt-2 min-h-12 w-full text-base"><option value="">All blood groups</option>{BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}</Select></label>
            <label className="block text-sm font-extrabold text-slate-800">District<Select value={draft.district} onChange={event => setDraft(current => ({ ...current, district: event.target.value }))} className="input mt-2 min-h-12 w-full text-base"><option value="">All districts</option>{BD_LOCATION_NAMES.map(location => <option key={location} value={location}>{location}</option>)}</Select></label>
            <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3"><span><span className="block text-sm font-extrabold text-slate-900">Urgent only</span><span className="block text-xs font-semibold text-slate-500">Requests needed within 72 hours</span></span><input type="checkbox" checked={draft.urgent} onChange={event => setDraft(current => ({ ...current, urgent: event.target.checked }))} className="h-5 w-5 accent-red-700" /></label>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3"><button type="button" onClick={() => setDraft({ bloodGroup: '', district: '', urgent: false })} className="min-h-12 rounded-2xl border border-slate-200 px-5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">Reset</button><button type="button" onClick={() => onApply(draft)} className="min-h-12 rounded-2xl bg-primary px-5 text-sm font-extrabold text-white hover:bg-primary-dark">Apply filters</button></div>
        </section>
      </div>
    </ModalPortal>
  );
}

function RequestRows({ requests, secondary = false }: { requests: RequestItem[]; secondary?: boolean }) {
  return (
    <Surface className={`divide-y divide-slate-100 overflow-hidden ${secondary ? 'border-slate-200 bg-slate-50/70 shadow-none' : ''}`}>
      {requests.map(request => <article key={request.id}><Link to={`/request/${request.id}`} className="group flex min-h-28 items-center gap-4 p-4 transition-colors hover:bg-rose-50/45 sm:gap-5 sm:p-5"><div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black shadow-sm ${secondary ? 'border border-rose-200 bg-white text-primary' : 'bg-primary text-white'}`}>{request.blood_group}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><UrgencyBadge neededBy={request.needed_by} /><RequestVerification state={request.verification_state} /><span className="text-xs font-bold text-slate-500">{formatNeededDate(request.needed_by)}</span></div><h2 className={`mt-2 truncate text-base font-extrabold sm:text-lg ${secondary ? 'text-slate-800' : 'text-slate-950'}`}>{request.hospital_name || 'Collection facility'}</h2><p className="mt-1 truncate text-sm font-semibold text-slate-500">{requestLocation(request)}</p><p className={`mt-2 text-xs font-extrabold ${secondary ? 'text-slate-600' : 'text-slate-700'}`}>{request.units_required || 1} unit{(request.units_required || 1) === 1 ? '' : 's'} requested</p></div><ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" /></Link></article>)}
    </Surface>
  );
}

export default function RequestsPage({ user, authLoading = false }: { user?: any; authLoading?: boolean }) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [otherRequests, setOtherRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const defaultsAppliedRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const groupFilter = searchParams.get('blood_group') || '';
  const districtFilter = searchParams.get('district') || '';
  const urgentOnly = searchParams.get('urgent') === 'true';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, exact_total: 0, pages: 1 });

  useEffect(() => {
    if (authLoading || defaultsAppliedRef.current) return;
    defaultsAppliedRef.current = true;
    if (searchParams.toString()) return;
    const donor = user?.donor_profile;
    const defaultGroup = BLOOD_GROUPS.includes(donor?.blood_group) ? donor.blood_group : '';
    const defaultDistrict = donor?.location?.area_name || user?.recipient_profile?.default_location?.area_name || '';
    const next = new URLSearchParams();
    if (defaultGroup) next.set('blood_group', defaultGroup);
    if (BD_LOCATION_NAMES.includes(defaultDistrict)) next.set('district', defaultDistrict);
    if (next.toString()) setSearchParams(next, { replace: true });
  }, [authLoading, searchParams, setSearchParams, user]);

  const updatePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage > 1) next.set('page', String(nextPage)); else next.delete('page');
    setSearchParams(next);
  };

  const applyFilters = (draft: FilterDraft) => {
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
        setRequests(data.items || []);
        setOtherRequests(data.other_items || []);
        setPagination(data.pagination);
      } catch (cause) {
        console.error(cause);
        setError(cause instanceof Error ? cause.message : 'Could not load live blood requests.');
      } finally { setLoading(false); }
    }
    void loadRequests();
  }, [groupFilter, districtFilter, urgentOnly, page, reloadKey]);

  const hasFilters = Boolean(groupFilter || districtFilter || urgentOnly);
  const filterCount = [groupFilter, districtFilter, urgentOnly].filter(Boolean).length;
  const visibleCount = hasFilters ? pagination.exact_total : pagination.total;
  const hasAnyRequests = requests.length > 0 || otherRequests.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
      <header className="flex items-center justify-between gap-4"><h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Blood requests</h1><Link to="/directory" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-primary-dark"><Plus className="h-4 w-4" aria-hidden="true" /> New <span className="hidden sm:inline">request</span></Link></header>

      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 px-1 pb-3"><p className="text-sm font-extrabold text-slate-700" aria-live="polite">{loading ? 'Loading requests…' : `${visibleCount} ${hasFilters ? 'matching' : 'active'} request${visibleCount === 1 ? '' : 's'}`}</p><button ref={filterButtonRef} type="button" onClick={() => setFiltersOpen(true)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-extrabold text-primary hover:bg-rose-50" aria-haspopup="dialog"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ''}</button></div>

      {loading ? (
        <Surface className="divide-y divide-slate-100" aria-label="Loading requests" role="status">{[0, 1, 2].map(item => <div key={item} className="flex animate-pulse gap-4 p-4 sm:p-5" aria-hidden="true"><div className="h-16 w-16 shrink-0 rounded-2xl bg-slate-100" /><div className="flex-1 space-y-3 py-1"><div className="h-3 w-1/4 rounded bg-slate-100" /><div className="h-4 w-3/5 rounded bg-slate-100" /><div className="h-3 w-2/5 rounded bg-slate-100" /></div></div>)}<span className="sr-only">Loading blood requests…</span></Surface>
      ) : error ? (
        <Surface className="border-red-200 bg-red-50 p-8 text-center" role="alert"><AlertCircle className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" /><h2 className="mt-3 font-extrabold text-red-950">Requests could not be loaded</h2><p className="mt-1 text-sm text-red-800">{error}</p><button type="button" onClick={() => setReloadKey(value => value + 1)} className="mt-5 min-h-12 rounded-2xl bg-red-700 px-5 text-sm font-extrabold text-white">Try again</button></Surface>
      ) : !hasAnyRequests ? (
        <EmptyState icon={Activity} title={hasFilters ? 'No requests match these filters' : 'No active requests right now'} description={hasFilters ? 'Reset or change your filters to see more requests.' : 'Pull down to refresh when a new need is published.'} action={hasFilters ? <button type="button" onClick={() => setSearchParams({})} className="theme-button">Reset filters</button> : undefined} />
      ) : (
        <>{requests.length > 0 && <RequestRows requests={requests} />}{otherRequests.length > 0 && <section aria-labelledby="other-emergency-heading" className="space-y-3 pt-1"><div><h2 id="other-emergency-heading" className="text-lg font-black text-slate-900">Other emergency blood</h2><p className="mt-1 text-xs font-semibold text-slate-500">Nearby or similar active requests outside your exact filters.</p></div><RequestRows requests={otherRequests} secondary /></section>}</>
      )}

      {pagination.pages > 1 && <nav aria-label="Request pages" className="flex items-center justify-center gap-3 pt-1"><button type="button" aria-label="Previous request page" disabled={page <= 1} onClick={() => updatePage(page - 1)} className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button><span className="text-sm font-bold text-slate-600">Page {page} of {pagination.pages}</span><button type="button" aria-label="Next request page" disabled={page >= pagination.pages} onClick={() => updatePage(page + 1)} className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button></nav>}

      {filtersOpen && <FilterSheet initial={{ bloodGroup: groupFilter, district: districtFilter, urgent: urgentOnly }} onApply={applyFilters} onClose={() => { setFiltersOpen(false); requestAnimationFrame(() => filterButtonRef.current?.focus()); }} />}
    </div>
  );
}
