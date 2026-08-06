import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { api } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES } from '../lib/locations';

type DirectoryProfile = {
  id: string;
  name: string;
  blood_group: string;
  district: string;
  upazila: string;
  phone_masked: string;
  has_phone: boolean;
  missing_fields: string[];
  source: { organization: string; url: string; scraped_at: string };
};

type DirectorySource = {
  id: string;
  organization: string;
  url: string;
  notes: string;
  total: number;
};

export default function DirectoryPage() {
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [sources, setSources] = useState<DirectorySource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  const groupFilter = searchParams.get('blood_group') || '';
  const districtFilter = searchParams.get('district') || '';
  const sourceFilter = searchParams.get('source') || '';
  const search = searchParams.get('q') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  useEffect(() => {
    api.getDirectorySources()
      .then(data => setSources(data.sources || []))
      .catch(() => setSources([]));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError('');
        const data = await api.getDirectory({
          blood_group: groupFilter,
          district: districtFilter,
          source: sourceFilter,
          q: search,
          page
        });
        if (cancelled) return;
        setProfiles(data.donors || []);
        setTotal(data.total || 0);
        setPageSize(data.page_size || 24);
      } catch (cause: any) {
        if (cancelled) return;
        setError(cause?.message || 'Failed to load imported listings.');
        setProfiles([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [groupFilter, districtFilter, sourceFilter, search, page, reloadKey]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    updateFilter('q', searchInput.trim());
  };

  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const hasFilters = Boolean(groupFilter || districtFilter || sourceFilter || search);

  return (
    <div className="space-y-8 pb-8 sm:space-y-10">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-5 py-7 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)] sm:px-8 sm:py-10">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-700">
              <Archive className="h-4 w-4" aria-hidden="true" />
              External listing archive
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Imported donor listings
            </h1>
            <p className="mt-4 text-base font-medium leading-7 text-slate-600">
              These records were published by other organizations. The people shown here have not registered
              with Drop or opted in to live donor search.
            </p>
          </div>
          <Link
            to="/directory"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-white transition-colors hover:bg-primary-dark"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search opted-in donors
          </Link>
        </div>

        <div className="mt-7 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 sm:px-5">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="text-sm font-semibold leading-6">
            <p>
              Phone numbers stay masked while you browse this archive, for everyone. They open only through a
              published blood request in the same upazila, one call at a time. Claiming a
              listing verifies ownership; it does not make the person available or reveal their contact details
              publicly.
            </p>
            <p className="mt-3">
              Is one of these numbers yours and you would rather not be here?{' '}
              <Link to="/directory/remove" className="font-extrabold underline">
                Remove it, without creating an account
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {sources.length > 0 && (
        <details className="theme-card group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-extrabold text-slate-900 transition-colors hover:text-emerald-800 sm:px-6">
            <span>Where these records come from</span>
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="grid gap-3 border-t border-slate-100 px-5 py-5 sm:px-6 lg:grid-cols-2">
            {sources.map(source => (
              <li key={source.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-11 items-center gap-2 font-extrabold text-emerald-800 hover:underline"
                >
                  {source.organization}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <p className="text-sm font-semibold text-slate-600">
                  {source.total.toLocaleString()} listing{source.total === 1 ? '' : 's'}
                </p>
                {source.notes && <p className="mt-2 text-sm leading-6 text-slate-500">{source.notes}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <section aria-labelledby="archive-filter-heading" className="theme-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="archive-filter-heading" className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <Filter className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            Filter archive
          </h2>
          {!loading && (
            <p className="text-sm font-semibold text-slate-500">
              {total.toLocaleString()} imported profile{total === 1 ? '' : 's'}
            </p>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[0.75fr_1fr_1fr_1.35fr_auto]">
          <label className="block">
            <span className="sr-only">Blood group</span>
            <select
              value={groupFilter}
              onChange={event => updateFilter('blood_group', event.target.value)}
              className="input appearance-none"
            >
              <option value="">All blood groups</option>
              {BLOOD_GROUPS.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="sr-only">District</span>
            <select
              value={districtFilter}
              onChange={event => updateFilter('district', event.target.value)}
              className="input appearance-none"
            >
              <option value="">All districts</option>
              {BD_LOCATION_NAMES.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="sr-only">Source organization</span>
            <select
              value={sourceFilter}
              onChange={event => updateFilter('source', event.target.value)}
              className="input appearance-none"
            >
              <option value="">All sources</option>
              {sources.map(source => (
                <option key={source.id} value={source.id}>{source.organization}</option>
              ))}
            </select>
          </label>

          <form onSubmit={submitSearch} className="flex gap-2 md:col-span-2 xl:col-span-1">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search by name</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                placeholder="Search by name"
                className="input pl-11"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-primary px-4 text-white transition-colors hover:bg-primary-dark"
              aria-label="Apply name search"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          {hasFilters && (
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-extrabold text-emerald-800 hover:bg-emerald-50"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      <section aria-live="polite">
        {error ? (
          <div role="alert" className="theme-card px-5 py-10 text-center sm:px-8">
            <p className="font-extrabold text-slate-900">The imported archive could not be loaded.</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey(value => value + 1)}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-white hover:bg-primary-dark"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : loading ? (
          <div aria-busy="true" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <span className="sr-only">Loading imported listings</span>
            {[0, 1, 2, 3, 4, 5].map(item => (
              <div key={item} className="theme-card animate-pulse p-5">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-100" />
                  <div className="flex-1 space-y-3 pt-1">
                    <div className="h-4 w-2/3 rounded bg-slate-100" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="mt-5 h-12 rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="theme-card px-5 py-12 text-center sm:px-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <Archive className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-extrabold text-slate-950">
              {hasFilters ? 'No imported listings match these filters.' : 'No imported listings are available.'}
            </h2>
            {hasFilters && (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map(profile => (
              <article key={profile.id} className="theme-card flex h-full flex-col p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-100 bg-red-50 font-extrabold text-red-700">
                    {profile.blood_group || '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-extrabold text-slate-950">{profile.name}</h2>
                    <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold leading-5 text-slate-600">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                      {[profile.upazila, profile.district].filter(Boolean).join(', ') || 'Location not published'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-600">
                  <LockKeyhole className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                  {profile.has_phone
                    ? <span>Contact masked: <span className="font-mono text-slate-800">{profile.phone_masked}</span></span>
                    : <span>No contact number was published.</span>}
                </div>

                {profile.missing_fields?.length > 0 && (
                  <p className="mt-3 text-xs font-semibold leading-5 text-amber-800">
                    Incomplete source record: {profile.missing_fields.join(', ')}
                  </p>
                )}

                <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
                  Listed by{' '}
                  <a
                    href={profile.source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-bold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-emerald-800"
                  >
                    {profile.source.organization}
                  </a>
                </p>

                <Link
                  to={`/directory/imported/${encodeURIComponent(profile.id)}`}
                  className="mt-auto inline-flex min-h-11 items-center gap-2 pt-4 text-sm font-extrabold text-emerald-800 hover:underline"
                >
                  <UserCheck className="h-4 w-4" aria-hidden="true" />
                  This is me - claim listing
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {pages > 1 && !loading && !error && (
        <nav aria-label="Imported listing pages" className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => updateFilter('page', String(page - 1))}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </button>
          <span className="px-2 text-sm font-bold text-slate-600">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => updateFilter('page', String(page + 1))}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
