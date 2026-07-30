import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Droplet,
  LockKeyhole,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundSearch
} from 'lucide-react';
import { api } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES, getLocationByName } from '../lib/locations';

type DonorSearchResult = {
  user_id: string;
  name: string;
  phone?: string;
  blood_group: string;
  distance_km?: number;
  availability_status?: string;
  is_verified?: boolean;
};

type SearchResponse = {
  donors?: DonorSearchResult[];
  total?: number;
  contact_access?: 'authenticated' | 'login_required';
};

function validBloodGroup(value: string | null) {
  return BLOOD_GROUPS.includes(value as (typeof BLOOD_GROUPS)[number]) ? value! : 'O+';
}

function validDistrict(value: string | null) {
  const location = value ? getLocationByName(value) : null;
  return location?.area_name || 'Dhaka';
}

function availabilityLabel(status?: string) {
  if (!status) return 'Available to contact';
  return status
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function DonorSearchPage({
  user,
  authLoading = false
}: {
  user: any;
  authLoading?: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const bloodGroup = validBloodGroup(searchParams.get('blood_group'));
  const district = validDistrict(searchParams.get('district'));
  const [draftBloodGroup, setDraftBloodGroup] = useState(bloodGroup);
  const [draftDistrict, setDraftDistrict] = useState(district);
  const [donors, setDonors] = useState<DonorSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [contactAccess, setContactAccess] = useState<SearchResponse['contact_access']>(
    user ? 'authenticated' : 'login_required'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setDraftBloodGroup(bloodGroup);
    setDraftDistrict(district);
  }, [bloodGroup, district]);

  useEffect(() => {
    let cancelled = false;
    const selectedLocation = getLocationByName(district);

    async function loadDonors() {
      if (!selectedLocation) {
        setError('Choose a valid Bangladesh district to search.');
        setDonors([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const response = await api.searchDonors({
          blood_group: bloodGroup,
          location: selectedLocation
        }) as SearchResponse | DonorSearchResult[];
        if (cancelled) return;

        const items = Array.isArray(response) ? response : response.donors || [];
        setDonors(items);
        setTotal(Array.isArray(response) ? items.length : response.total ?? items.length);
        setContactAccess(Array.isArray(response)
          ? (user ? 'authenticated' : 'login_required')
          : response.contact_access || (user ? 'authenticated' : 'login_required'));
      } catch (cause: any) {
        if (cancelled) return;
        setError(cause?.message || 'We could not search donors right now.');
        setDonors([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDonors();
    return () => {
      cancelled = true;
    };
  }, [bloodGroup, district, reloadKey, user]);

  const loginHref = useMemo(
    () => `/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`,
    [location.pathname, location.search]
  );

  const submitFilters = (event: FormEvent) => {
    event.preventDefault();
    setSearchParams({
      blood_group: draftBloodGroup,
      district: draftDistrict
    });
  };

  return (
    <div className="space-y-8 pb-8 sm:space-y-10">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white px-5 py-7 shadow-[0_24px_70px_-48px_rgba(4,120,87,0.5)] sm:px-8 sm:py-10 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-end">
          <div>
            <div className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-800">
              <UserRoundSearch className="h-4 w-4" aria-hidden="true" />
              Public donor search
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Find opted-in donors near you.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600">
              Search is open to everyone. Results only include registered members who have chosen to be
              available, while their phone numbers remain private until login.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-600">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                No account to search
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Phone protected
              </span>
            </div>
          </div>

          <form onSubmit={submitFilters} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Blood group</span>
                <span className="relative block">
                  <Droplet className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-red-600" aria-hidden="true" />
                  <select
                    value={draftBloodGroup}
                    onChange={event => setDraftBloodGroup(event.target.value)}
                    className="input appearance-none pl-11 pr-10"
                  >
                    {BLOOD_GROUPS.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">District</span>
                <span className="relative block">
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" aria-hidden="true" />
                  <select
                    value={draftDistrict}
                    onChange={event => setDraftDistrict(event.target.value)}
                    className="input appearance-none pl-11 pr-10"
                  >
                    {BD_LOCATION_NAMES.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                </span>
              </label>
            </div>
            <button type="submit" className="primary-button mt-4">
              <Search className="h-5 w-5" aria-hidden="true" />
              Search donors
            </button>
          </form>
        </div>
      </section>

      <section aria-labelledby="search-results-heading">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">Live availability</p>
            <h2 id="search-results-heading" className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              {bloodGroup} donors near {district}
            </h2>
            {!loading && !error && (
              <p className="mt-2 text-sm font-medium text-slate-600">
                {total.toLocaleString()} possible match{total === 1 ? '' : 'es'} found
                {donors.length < total ? `; showing the closest ${donors.length.toLocaleString()}` : ''}.
              </p>
            )}
          </div>
          <Link
            to="/request/new"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-800 transition-colors hover:border-emerald-200 hover:bg-emerald-50"
          >
            Post a blood request
          </Link>
        </div>

        {error ? (
          <div role="alert" className="theme-card px-5 py-10 text-center sm:px-8">
            <p className="font-extrabold text-slate-900">Donor search is temporarily unavailable.</p>
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
          <div aria-live="polite" aria-busy="true" className="grid gap-4 md:grid-cols-2">
            <span className="sr-only">Searching available donors</span>
            {[0, 1, 2, 3].map(item => (
              <div key={item} className="theme-card animate-pulse p-6">
                <div className="flex gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-slate-100" />
                  <div className="flex-1 space-y-3 pt-1">
                    <div className="h-4 w-1/2 rounded bg-slate-100" />
                    <div className="h-3 w-2/3 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="mt-5 h-16 rounded-2xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : donors.length === 0 ? (
          <div className="theme-card px-5 py-12 text-center sm:px-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <UserRoundSearch className="h-7 w-7" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-xl font-extrabold text-slate-950">No available donors found for this search.</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Availability changes. Try a nearby district, check compatible blood groups with the treating
              facility, or post a complete request so eligible members can respond.
            </p>
            <Link
              to="/request/new"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-white hover:bg-primary-dark"
            >
              Post a request
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {donors.map(donor => {
              const canShowPhone = Boolean(user) && contactAccess === 'authenticated';

              return (
                <article key={donor.user_id} className="theme-card flex h-full flex-col p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-lg font-extrabold text-red-700">
                      {donor.blood_group}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-extrabold text-slate-950">{donor.name}</h3>
                        {donor.is_verified && (
                          <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-emerald-50 px-2.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                        <MapPin className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                        {typeof donor.distance_km === 'number'
                          ? `${donor.distance_km.toFixed(1)} km from ${district}`
                          : district}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {availabilityLabel(donor.availability_status)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex min-h-20 flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    {authLoading ? (
                      <p className="text-sm font-semibold text-slate-500">Checking your contact access...</p>
                    ) : canShowPhone && donor.phone ? (
                      <a
                        href={`tel:${donor.phone}`}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-white transition-colors hover:bg-primary-dark"
                      >
                        <Phone className="h-4 w-4" aria-hidden="true" />
                        {donor.phone}
                      </a>
                    ) : canShowPhone ? (
                      <p className="text-sm font-semibold leading-6 text-slate-600">
                        This donor has not made a phone number available.
                      </p>
                    ) : (
                      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                          <LockKeyhole className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                          Phone number hidden
                        </p>
                        <Link
                          to={loginHref}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 text-sm font-extrabold text-emerald-800 hover:bg-emerald-50"
                        >
                          Log in to view
                        </Link>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Archive className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-extrabold text-slate-950">Looking for the imported listing archive?</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Those profiles came from external public sources and are not opted in. Their phone numbers stay
                masked for everyone, including logged-in members.
              </p>
            </div>
          </div>
          <Link
            to="/directory/imported"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
          >
            Browse imported listings
          </Link>
        </div>
      </aside>
    </div>
  );
}
