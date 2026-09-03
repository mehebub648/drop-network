import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundSearch
} from 'lucide-react';
import { api, type SearchDonorCard } from '../lib/api';
import SearchCriteriaForm, { type Criteria } from '../components/search/SearchCriteriaForm';
import DonorResultCard from '../components/search/DonorResultCard';
import DonorProfileSummary from '../components/search/DonorProfileSummary';
import RequestGate from '../components/search/RequestGate';
import { EmptyState } from '../components/ui';
import {
  readSearchDraft,
  searchRequestPayload,
  startsAfterBloodGroup,
  writeSearchDraft,
  type RequesterRole,
  type SearchDraft
} from '../lib/searchDraft';
import { announcePendingCall } from '../lib/callOutcome';
import { BLOOD_GROUPS } from '../lib/blood';

type SearchResponse = {
  order_seed: string;
  registered: SearchDonorCard[];
  directory: SearchDonorCard[];
  totals: { registered: number; directory: number };
  pagination: { page: number; page_size: number; total: number; total_pages: number };
};

const SEARCH_SORTS = ['recommended', 'recently_confirmed', 'best_location', 'most_donations', 'fewest_contact_issues', 'name'] as const;
type SearchSort = (typeof SEARCH_SORTS)[number];
const SORT_LABELS: Record<SearchSort, string> = {
  recommended: 'Recommended',
  recently_confirmed: 'Recently confirmed',
  best_location: 'Best location match',
  most_donations: 'Most donations',
  fewest_contact_issues: 'Fewest contact issues',
  name: 'Name'
};

/**
 * Searching for donors and posting a blood request are the same act here.
 *
 * The requester says who they need blood for and where; the results are the
 * donors nearby, with every number masked. Asking for one number is what
 * publishes the request, so nobody has to fill in a long form before finding
 * out whether anyone is even available.
 */
export default function DonorSearchPage({
  user,
  onLogin
}: {
  user: any;
  onLogin: () => Promise<void> | void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<SearchDraft>(() => {
    const stored = readSearchDraft();
    return {
      ...stored,
      blood_group: searchParams.get('blood_group') || stored.blood_group,
      district: searchParams.get('district') || stored.district,
      upazila: searchParams.get('upazila') || stored.upazila,
      collection_facility: searchParams.get('collection_facility') || stored.collection_facility,
      collection_facility_code: searchParams.get('collection_facility_code') || stored.collection_facility_code,
      request_id: searchParams.get('request_id') || stored.request_id
    };
  });
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SearchDonorCard | null>(null);
  const [profileDonor, setProfileDonor] = useState<SearchDonorCard | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [busyRef, setBusyRef] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const startWithLocation = startsAfterBloodGroup(searchParams);
  const [refineOpen, setRefineOpen] = useState(() => !(
    searchParams.get('blood_group') && searchParams.get('district') && searchParams.get('upazila')
  ));

  const bloodGroup = searchParams.get('blood_group') || '';
  const district = searchParams.get('district') || '';
  const upazila = searchParams.get('upazila') || '';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const sortParam = searchParams.get('sort');
  const sort: SearchSort = SEARCH_SORTS.includes(sortParam as SearchSort) ? sortParam as SearchSort : 'recommended';
  const exactGroupOnly = searchParams.get('exact_group') === 'true';
  const phoneVerifiedOnly = searchParams.get('phone_verified_only') === 'true';
  const collectionFacility = searchParams.get('collection_facility') || '';
  const collectionFacilityCode = searchParams.get('collection_facility_code') || '';
  const orderSeed = searchParams.get('order_seed') || '';
  const userId = user?.id || '';
  const hasQuery = Boolean(bloodGroup && district && upazila);
  const contextComplete = Boolean(draft.request_id || (draft.collection_facility.trim() && draft.requester_role));
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!hasQuery || orderSeed) return;
    const next = new URLSearchParams(searchParams);
    next.set('order_seed', crypto.randomUUID().replaceAll('-', ''));
    setSearchParams(next, { replace: true });
  }, [hasQuery, orderSeed, searchParams, setSearchParams]);

  const updateDraft = useCallback((next: SearchDraft) => {
    setDraft(next);
    writeSearchDraft(next);
  }, []);

  useEffect(() => {
    if (!hasQuery || !orderSeed) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api.searchDonorsByUpazila({
      blood_group: bloodGroup,
      district,
      upazila,
      page,
      sort,
      exact_group: exactGroupOnly,
      phone_verified_only: phoneVerifiedOnly,
      collection_facility: collectionFacility,
      collection_facility_code: collectionFacilityCode,
      order_seed: orderSeed
    })
      .then(response => {
        if (!cancelled) setResults(response);
      })
      .catch(cause => {
        if (!cancelled) {
          setError(cause?.message || 'We could not search donors right now.');
          setResults(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bloodGroup, district, upazila, page, sort, exactGroupOnly, phoneVerifiedOnly, collectionFacility, collectionFacilityCode, orderSeed, hasQuery, reloadKey, userId]);

  useEffect(() => {
    if (!hasQuery || !contextComplete) setRefineOpen(true);
  }, [hasQuery, contextComplete]);

  const runSearch = () => {
    writeSearchDraft(draft);
    const next: Record<string, string> = {
      blood_group: draft.blood_group,
      district: draft.district,
      upazila: draft.upazila
    };
    if (draft.collection_facility) next.collection_facility = draft.collection_facility;
    if (draft.collection_facility_code) next.collection_facility_code = draft.collection_facility_code;
    if (sort !== 'recommended') next.sort = sort;
    if (exactGroupOnly) next.exact_group = 'true';
    if (phoneVerifiedOnly) next.phone_verified_only = 'true';
    next.order_seed = crypto.randomUUID().replaceAll('-', '');
    setSearchParams(next);
    setRefineOpen(false);
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
    document.getElementById('search-results-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Publishes the request if needed, unmasks one number, and opens the global outcome dialog. */
  const openCall = useCallback(async (donor: SearchDonorCard) => {
    const current = draftRef.current;
    let requestId = current.request_id;
    if (!requestId) {
      const created = await api.createSearchRequest(searchRequestPayload(current));
      requestId = created.request.id;
      updateDraft({ ...current, request_id: requestId });
    }
    const reveal = await api.revealDonorPhone(requestId!, donor.donor_ref);
    announcePendingCall({ requestId: requestId!, reveal });
  }, [updateDraft]);

  const selectDonor = async (donor: SearchDonorCard) => {
    setError('');
    if (!contextComplete) {
      setRefineOpen(true);
      setError('Add the collection place and your role before asking to contact a donor.');
      return;
    }
    setSelected(donor);
    if (!user || !draft.request_id) {
      setGateOpen(true);
      return;
    }
    setBusyRef(donor.donor_ref);
    try {
      await openCall(donor);
    } catch (cause: any) {
      setError(cause?.message || 'We could not open that contact.');
      if (cause?.status === 409 && cause?.data?.pending_reveal_id) {
        announcePendingCall();
      }
    } finally {
      setBusyRef('');
    }
  };

  const criteria: Criteria = {
    blood_group: draft.blood_group,
    district: draft.district,
    upazila: draft.upazila,
    collection_facility: draft.collection_facility,
    collection_facility_code: draft.collection_facility_code,
    requester_role: draft.requester_role as RequesterRole | ''
  };

  const updateSearchOption = (key: 'sort' | 'exact_group' | 'phone_verified_only', value: string | boolean) => {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    if ((key === 'sort' && value === 'recommended') || value === false) next.delete(key);
    else next.set(key, String(value));
    setSearchParams(next);
  };

  const updateBloodGroup = (value: string) => {
    updateDraft({ ...draft, blood_group: value, request_id: undefined });
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    next.set('blood_group', value);
    next.set('order_seed', crypto.randomUUID().replaceAll('-', ''));
    setSearchParams(next);
  };

  const donors = results ? [...results.registered, ...results.directory] : [];

  return (
    <div className="space-y-6 pb-8 sm:space-y-8">
      <section className="page-hero block px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <div className="page-hero-grid" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-rose-200/40 blur-3xl" />
        <div className="relative">
          {!hasQuery ? (
            <div className="mx-auto max-w-5xl">
              <SearchCriteriaForm
                value={criteria}
                onChange={next => updateDraft({ ...draft, ...next, request_id: undefined })}
                onSubmit={runSearch}
                submitting={loading}
                initialStep={startWithLocation ? 1 : 0}
              />
            </div>
          ) : (
            <div>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-4 sm:items-center sm:gap-5">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-red-100 bg-white text-2xl font-extrabold text-red-700 shadow-sm sm:h-20 sm:w-20 sm:text-3xl">
                    {bloodGroup}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">Your current search</p>
                    <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                      Donors near {upazila}
                    </h1>
                  </div>
                </div>
              </div>

              {!contextComplete && (
                <div role="status" className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold leading-6 text-amber-950">
                    Add the collection place and your role before asking to contact a donor.
                  </p>
                  <button type="button" onClick={() => setRefineOpen(true)} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-amber-900 px-4 text-xs font-extrabold text-white">
                    Complete search details
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {hasQuery && (
        <section aria-label="Donor matches">
          <div className="mb-5 flex items-center gap-2 sm:justify-end">
            <div className="flex w-full items-center gap-2 sm:w-auto sm:self-auto">
              {!loading && results && (
                <span className="inline-flex min-h-11 items-center rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-extrabold text-rose-800">
                  {results.pagination.total} match{results.pagination.total === 1 ? '' : 'es'}
                </span>
              )}
              <button
                type="button"
                onClick={() => setRefineOpen(open => !open)}
                aria-expanded={refineOpen}
                aria-controls="sort-and-refine-panel"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-800 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800 sm:flex-none"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                {refineOpen ? 'Close sort & refine' : 'Sort & refine'}
              </button>
            </div>
          </div>

          {refineOpen && (
            <div id="sort-and-refine-panel" className="fade-in mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              {!loading && !error && results && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.7fr)_auto_auto] lg:items-end">
                  <label className="text-sm font-extrabold text-slate-800">Sort donor matches
                    <select value={sort} onChange={event => updateSearchOption('sort', event.target.value)} className="input mt-1.5">
                      {SEARCH_SORTS.map(option => <option key={option} value={option}>{SORT_LABELS[option]}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-extrabold text-slate-800">Blood group needed
                    <select value={criteria.blood_group} onChange={event => updateBloodGroup(event.target.value)} className="input mt-1.5">
                      {BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
                    </select>
                  </label>
                  <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <input type="checkbox" checked={exactGroupOnly} onChange={event => updateSearchOption('exact_group', event.target.checked)} className="h-4 w-4 accent-red-600" />
                    Exact blood group only
                  </label>
                  <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <input type="checkbox" checked={phoneVerifiedOnly} onChange={event => updateSearchOption('phone_verified_only', event.target.checked)} className="h-4 w-4 accent-red-600" />
                    Phone verified only
                  </label>
                </div>
              )}
              <div className={`${!loading && !error && results ? 'mt-5 border-t border-slate-100 pt-5' : ''}`}>
                <SearchCriteriaForm
                  value={criteria}
                  onChange={next => updateDraft({ ...draft, ...next, request_id: undefined })}
                  onSubmit={runSearch}
                  submitting={loading}
                  submitLabel="Update donor matches"
                  compact
                  skipBloodGroup
                />
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="alert alert-error mb-5">{error}</div>
          )}

          {loading ? (
            <div aria-live="polite" aria-busy="true" className="grid gap-4 md:grid-cols-2">
              <span className="sr-only">Searching donors</span>
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
          ) : donors.length === 0 && !error ? (
            <EmptyState
              icon={UserRoundSearch}
              title="No donors listed in this upazila yet"
              description="Try a neighbouring upazila, and ask the collection facility which compatible groups they can accept for this patient."
              action={<button type="button" onClick={() => setReloadKey(value => value + 1)} className="theme-button"><RefreshCw className="h-4 w-4" aria-hidden="true" />Search again</button>}
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {donors.map(donor => (
                  <DonorResultCard
                    key={donor.donor_ref}
                    donor={donor}
                    onView={setProfileDonor}
                    onSelect={selectDonor}
                    busy={busyRef === donor.donor_ref}
                  />
                ))}
              </div>
              {results && results.pagination.total_pages > 1 && (
                <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Donor result pages">
                  <button
                    type="button"
                    disabled={results.pagination.page <= 1 || loading}
                    onClick={() => goToPage(results.pagination.page - 1)}
                    className="button button-secondary"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Previous
                  </button>
                  <span className="text-sm font-bold text-slate-700">
                    Page {results.pagination.page} of {results.pagination.total_pages}
                  </span>
                  <button
                    type="button"
                    disabled={results.pagination.page >= results.pagination.total_pages || loading}
                    onClick={() => goToPage(results.pagination.page + 1)}
                    className="button button-secondary"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      )}

      <aside className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-extrabold text-slate-950">Private donor search</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Donor numbers stay protected. You choose a donor first, then use the request flow when you need to contact them.
            </p>
          </div>
        </div>
      </aside>

      {profileDonor && (
        <DonorProfileSummary
          donor={profileDonor}
          onClose={() => setProfileDonor(null)}
          onRequest={() => {
            const donor = profileDonor;
            setProfileDonor(null);
            void selectDonor(donor);
          }}
          busy={busyRef === profileDonor.donor_ref}
          showClaimOption={!user}
        />
      )}

      {gateOpen && selected && (
        <RequestGate
          draft={draft}
          onDraftChange={updateDraft}
          user={user}
          onClose={() => setGateOpen(false)}
          onEditSearch={() => {
            setGateOpen(false);
            setRefineOpen(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onReady={async () => {
            await onLogin();
            await openCall(selected);
            setGateOpen(false);
          }}
        />
      )}
    </div>
  );
}
