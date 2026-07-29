import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Filter, MapPin, ShieldQuestion, UserCheck } from 'lucide-react';
import { api } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES } from '../lib/locations';
import { cn } from '../lib/utils';

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

export default function DirectoryPage() {
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [sources, setSources] = useState<Array<{ id: string; organization: string; url: string; notes: string; total: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [searchParams, setSearchParams] = useSearchParams();

  const groupFilter = searchParams.get('blood_group') || '';
  const districtFilter = searchParams.get('district') || '';
  const sourceFilter = searchParams.get('source') || '';
  const search = searchParams.get('q') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  useEffect(() => {
    api.getDirectorySources().then(data => setSources(data.sources)).catch(() => setSources([]));
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const data = await api.getDirectory({ blood_group: groupFilter, district: districtFilter, source: sourceFilter, q: search, page });
        setProfiles(data.donors);
        setTotal(data.total);
        setPageSize(data.page_size);
      } catch (e: any) {
        setError(e.message || 'Failed to load the directory');
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [groupFilter, districtFilter, sourceFilter, search, page]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(groupFilter || districtFilter || sourceFilter || search);

  return (
    <div className="max-w-4xl mx-auto space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Imported Donor Directory</h1>
        <p className="text-slate-500 font-medium">
          Donor entries published by other organisations. Nobody here has registered with Drop, so contact
          numbers stay hidden until the donor claims their own profile.
        </p>
      </div>

      {sources.length > 0 && (
        <div className="theme-card p-5 border border-slate-100 shadow-sm space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Where this data comes from</h2>
          <ul className="space-y-2">
            {sources.map(source => (
              <li key={source.id} className="text-sm">
                <a href={source.url} target="_blank" rel="noreferrer noopener" className="font-bold text-primary hover:underline">
                  {source.organization}
                </a>
                <span className="text-slate-400 font-medium"> — {source.total.toLocaleString()} entries. {source.notes}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="theme-card p-4 border border-slate-100 shadow-sm flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mr-1">
          <Filter className="w-3.5 h-3.5" /> Filter
        </span>
        <select
          value={groupFilter}
          onChange={e => updateFilter('blood_group', e.target.value)}
          className="px-4 py-2.5 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold text-sm text-slate-700 outline-none appearance-none cursor-pointer"
        >
          <option value="">All groups</option>
          {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
        </select>
        <select
          value={districtFilter}
          onChange={e => updateFilter('district', e.target.value)}
          className="px-4 py-2.5 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold text-sm text-slate-700 outline-none appearance-none cursor-pointer"
        >
          <option value="">All districts</option>
          {BD_LOCATION_NAMES.map(loc => <option key={loc} value={loc}>{loc}</option>)}
        </select>
        <input
          type="search"
          defaultValue={search}
          placeholder="Search by name"
          onKeyDown={e => { if (e.key === 'Enter') updateFilter('q', (e.target as HTMLInputElement).value.trim()); }}
          className="px-4 py-2.5 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary font-semibold text-sm text-slate-700 outline-none"
        />
        {hasFilters && (
          <button onClick={() => setSearchParams({})} className="px-3 py-2.5 text-sm font-bold text-primary hover:underline">
            Clear
          </button>
        )}
        {!loading && (
          <span className="ml-auto text-sm font-semibold text-slate-400">
            {total.toLocaleString()} unclaimed profile{total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {error ? (
        <div className="theme-card p-12 text-center border border-slate-100 shadow-sm">
          <p className="text-slate-600 font-bold">{error}</p>
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="theme-card p-6 border border-slate-100 shadow-sm animate-pulse space-y-3">
              <div className="h-3 bg-slate-100 rounded w-1/3"></div>
              <div className="h-4 bg-slate-100 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="theme-card p-12 text-center border border-slate-100 shadow-sm">
          <ShieldQuestion className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-bold">
            {hasFilters ? 'No imported profiles match these filters.' : 'No imported profiles yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {profiles.map(profile => (
            <div key={profile.id} className="theme-card p-5 border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary font-extrabold flex-shrink-0">
                  {profile.blood_group || '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{profile.name}</p>
                  <p className="text-sm text-slate-400 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {[profile.upazila, profile.district].filter(Boolean).join(', ') || 'Location not published'}
                  </p>
                </div>
              </div>

              <p className="text-sm font-semibold text-slate-500">
                {profile.has_phone
                  ? <>Contact hidden: <span className="font-mono text-slate-700">{profile.phone_masked}</span></>
                  : 'This listing publishes no contact number.'}
              </p>

              <p className="text-xs text-slate-400 font-medium">
                Listed by{' '}
                <a href={profile.source.url} target="_blank" rel="noreferrer noopener" className="underline hover:text-primary">
                  {profile.source.organization}
                </a>
              </p>

              <Link
                to={`/directory/${encodeURIComponent(profile.id)}`}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
              >
                <UserCheck className="w-4 h-4" /> This is me — claim it
              </Link>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            disabled={page <= 1}
            onClick={() => updateFilter('page', String(page - 1))}
            className={cn('p-2 rounded-xl', page <= 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-100')}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-slate-500">Page {page} of {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => updateFilter('page', String(page + 1))}
            className={cn('p-2 rounded-xl', page >= pages ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-100')}
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
