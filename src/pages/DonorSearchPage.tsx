import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, PhoneCall, RefreshCw, ShieldCheck, UserRoundSearch } from 'lucide-react';
import { api, type SearchDonorCard } from '../lib/api';
import SearchCriteriaForm, { type Criteria } from '../components/search/SearchCriteriaForm';
import DonorResultCard from '../components/search/DonorResultCard';
import RequestGate from '../components/search/RequestGate';
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

  const bloodGroup = searchParams.get('blood_group') || '';
  const district = searchParams.get('district') || '';
  const upazila = searchParams.get('upazila') || '';
  const hasQuery = Boolean(bloodGroup && district && upazila);
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
    api.searchDonorsByUpazila({ blood_group: bloodGroup, district, upazila })
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
  }, [bloodGroup, district, upazila, hasQuery, reloadKey]);

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

  return (
    <div className="space-y-8 pb-8 sm:space-y-10">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white px-5 py-7 shadow-[0_24px_70px_-48px_rgba(4,120,87,0.5)] sm:px-8 sm:py-10 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <div className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-800">
              <UserRoundSearch className="h-4 w-4" aria-hidden="true" />
              Find blood
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Search donors in your upazila.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600">
              There is no separate form to fill in. Search for the blood you need, and the details you
              give to unlock a phone number become your request.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Numbers stay hidden until you tell us who needs blood
            </p>
          </div>

          <SearchCriteriaForm value={criteria} onChange={next => updateDraft({ ...draft, ...next })} onSubmit={runSearch} submitting={loading} />
        </div>
      </section>

      {hasQuery && (
        <section aria-labelledby="search-results-heading">
          <div className="mb-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">Results</p>
            <h2 id="search-results-heading" className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              {bloodGroup} donors in {upazila}, {district}
            </h2>
            {!loading && !error && results && (
              <p className="mt-2 text-sm font-medium text-slate-600">
                {results.totals.registered} registered member{results.totals.registered === 1 ? '' : 's'} and{' '}
                {results.totals.directory} public listing{results.totals.directory === 1 ? '' : 's'}.
                Compatible blood groups are included and marked.
              </p>
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
            <div className="theme-card px-5 py-12 text-center sm:px-8">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <UserRoundSearch className="h-7 w-7" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-xl font-extrabold text-slate-950">No donors listed in this upazila yet.</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Try a neighbouring upazila, and ask the collection facility which compatible groups they
                can accept for this patient.
              </p>
              <button type="button" onClick={() => setReloadKey(value => value + 1)} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-white hover:bg-primary-dark">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Search again
              </button>
            </div>
          ) : (
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
          )}
        </section>
      )}

      <aside className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Archive className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-extrabold text-slate-950">Browsing rather than searching?</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                The imported archive lists donors published by other organisations. Numbers there stay
                masked while you browse; they open only through a request like the one above.
              </p>
            </div>
          </div>
          <Link to="/directory/imported" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
            Browse imported listings
          </Link>
        </div>
      </aside>

      {gateOpen && selected && (
        <RequestGate
          draft={draft}
          onDraftChange={updateDraft}
          user={user}
          donorName={selected.name}
          onClose={() => setGateOpen(false)}
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
