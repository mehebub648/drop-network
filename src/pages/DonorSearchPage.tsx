import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UserRoundSearch
} from 'lucide-react';
import { api, type SearchDonorCard } from '../lib/api';
import SearchCriteriaForm, { type Criteria } from '../components/search/SearchCriteriaForm';
import DonorResultCard from '../components/search/DonorResultCard';
import RequestGate from '../components/search/RequestGate';
import { EmptyState } from '../components/ui';
import {
  readSearchDraft,
  searchRequestPayload,
  writeSearchDraft,
  type RequesterRole,
  type SearchDraft
} from '../lib/searchDraft';

type SearchResponse = {
  registered: SearchDonorCard[];
  directory: SearchDonorCard[];
  totals: { registered: number; directory: number };
  pagination: { page: number; page_size: number; total: number; total_pages: number };
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
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SearchDraft>(() => {
    const stored = readSearchDraft();
    return {
      ...stored,
      blood_group: searchParams.get('blood_group') || stored.blood_group,
      district: searchParams.get('district') || stored.district,
      upazila: searchParams.get('upazila') || stored.upazila
    };
  });
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SearchDonorCard | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [busyRef, setBusyRef] = useState('');
  const [pendingCall, setPendingCall] = useState<{ reveal_id: string; donor_ref: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [refineOpen, setRefineOpen] = useState(() => !(
    searchParams.get('blood_group') && searchParams.get('district') && searchParams.get('upazila')
  ));

  const bloodGroup = searchParams.get('blood_group') || '';
  const district = searchParams.get('district') || '';
  const upazila = searchParams.get('upazila') || '';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const hasQuery = Boolean(bloodGroup && district && upazila);
  const contextComplete = Boolean(draft.collection_facility.trim() && draft.requester_role);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const updateDraft = useCallback((next: SearchDraft) => {
    setDraft(next);
    writeSearchDraft(next);
  }, []);

  useEffect(() => {
    if (!hasQuery) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api.searchDonorsByUpazila({ blood_group: bloodGroup, district, upazila, page })
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
  }, [bloodGroup, district, upazila, page, hasQuery, reloadKey]);

  useEffect(() => {
    if (!hasQuery || !contextComplete) setRefineOpen(true);
  }, [hasQuery, contextComplete]);

  // A call that was opened but never answered for blocks the next reveal, so
  // surface it here rather than letting the next click fail with a 409.
  useEffect(() => {
    const requestId = draft.request_id;
    if (!user || !requestId) return setPendingCall(null);
    let cancelled = false;
    api.getPendingReveal(requestId)
      .then(response => {
        if (!cancelled) setPendingCall(response.pending || null);
      })
      .catch(() => {
        if (!cancelled) setPendingCall(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, draft.request_id, reloadKey]);

  const runSearch = () => {
    writeSearchDraft(draft);
    setSearchParams({
      blood_group: draft.blood_group,
      district: draft.district,
      upazila: draft.upazila
    });
    setRefineOpen(false);
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
    document.getElementById('search-results-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Publishes the request if needed, unmasks the number, opens the call page. */
  const openCall = useCallback(async (donor: SearchDonorCard) => {
    const current = draftRef.current;
    let requestId = current.request_id;
    if (!requestId) {
      const created = await api.createSearchRequest(searchRequestPayload(current));
      requestId = created.request.id;
      updateDraft({ ...current, request_id: requestId });
    }
    await api.revealDonorPhone(requestId!, donor.donor_ref);
    navigate(`/directory/call/${requestId}/${encodeURIComponent(donor.donor_ref)}`);
  }, [navigate, updateDraft]);

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
        setPendingCall({ reveal_id: cause.data.pending_reveal_id, donor_ref: cause.data.pending_donor_ref });
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
    requester_role: draft.requester_role as RequesterRole | ''
  };

  const donors = results ? [...results.registered, ...results.directory] : [];
  const requesterLabel = draft.requester_role === 'PATIENT'
    ? 'Patient'
    : draft.requester_role === 'RELATIVE'
      ? "Patient's relative"
      : draft.requester_role === 'THIRD_PARTY'
        ? 'Third-party volunteer'
        : '';

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
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                        <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        {upazila}, {district}
                      </span>
                      {draft.collection_facility && (
                        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                          <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          {draft.collection_facility}
                        </span>
                      )}
                      {requesterLabel && (
                        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                          <UserRound className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          {requesterLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRefineOpen(open => !open)}
                  aria-expanded={refineOpen}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-stretch rounded-xl border border-rose-200 bg-white px-4 text-sm font-extrabold text-rose-800 shadow-sm transition-colors hover:bg-rose-50 lg:self-auto"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  {refineOpen ? 'Close search details' : 'Refine search'}
                </button>
              </div>

              <p className="mt-5 max-w-3xl text-sm font-medium leading-6 text-slate-600">
                Your home-page search is still here. Choose a match below, or refine these details without
                losing the request information you already added.
              </p>

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

              {refineOpen && (
                <div className="fade-in mt-6 border-t border-rose-100 pt-6">
                  <SearchCriteriaForm
                    value={criteria}
                    onChange={next => updateDraft({ ...draft, ...next, request_id: undefined })}
                    onSubmit={runSearch}
                    submitting={loading}
                    submitLabel="Update donor matches"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {hasQuery && (
        <section aria-labelledby="search-results-heading">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Step 2 · Donor matches</p>
              <h2 id="search-results-heading" className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                Choose who to contact
              </h2>
              {!loading && !error && results && (
                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
                  {results.totals.registered} registered member{results.totals.registered === 1 ? '' : 's'} and{' '}
                  {results.totals.directory} attributed public listing{results.totals.directory === 1 ? '' : 's'} match{' '}
                  {bloodGroup} in {upazila}, {district}. Registered donors appear first.
                </p>
              )}
            </div>
            {!loading && results && (
              <span className="inline-flex min-h-9 items-center self-start rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-extrabold text-rose-800 sm:self-auto">
                {results.pagination.total} match{results.pagination.total === 1 ? '' : 'es'}
              </span>
            )}
          </div>

          {pendingCall && draft.request_id && (
            <div role="alert" className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold leading-6 text-amber-900">
                You opened a number but never said how the call went. Tell us, and the next number opens.
              </p>
              <Link
                to={`/directory/call/${draft.request_id}/${encodeURIComponent(pendingCall.donor_ref)}`}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 text-sm font-extrabold text-white"
              >
                <PhoneCall className="h-4 w-4" aria-hidden="true" />
                Finish that call
              </Link>
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

      <aside className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-extrabold text-slate-950">Search-only donor access</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Drop has no browsable donor directory. Search is limited daily by account and IP to three districts,
              three blood groups, and nine unique searches. Moving between pages of the same search does not use another search.
            </p>
          </div>
        </div>
      </aside>

      {gateOpen && selected && (
        <RequestGate
          draft={draft}
          onDraftChange={updateDraft}
          user={user}
          donorName={selected.name}
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
