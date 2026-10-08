import { useEffect, useState } from 'react';
import { AlertCircle, BookOpenText, ChevronLeft, ChevronRight, HeartHandshake, PenLine, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import CommunityPostCard from '../components/community/CommunityPostCard';
import { PageHeader } from '../components/ui';
import { api, type CommunityPostListResponse, type CommunityPostType, type PublicCommunityPostSummary } from '../lib/api';

const filters: Array<{ value: '' | CommunityPostType; label: string; icon?: typeof HeartHandshake }> = [
  { value: '', label: 'All posts' },
  { value: 'DONATION_STORY', label: 'Donation stories', icon: HeartHandshake },
  { value: 'HEALTH_SUGGESTION', label: 'Health suggestions', icon: BookOpenText }
];

function pageHref(type: CommunityPostType | undefined, page: number) {
  const query = new URLSearchParams();
  if (type) query.set('type', type);
  if (page > 1) query.set('page', String(page));
  const suffix = query.toString();
  return suffix ? `/community?${suffix}` : '/community';
}

export default function CommunityPage({ user }: { user: any }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const type: CommunityPostType | undefined = rawType === 'DONATION_STORY' || rawType === 'HEALTH_SUGGESTION'
    ? rawType
    : undefined;
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const [data, setData] = useState<CommunityPostListResponse<PublicCommunityPostSummary> | null>(null);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    api.getCommunityPosts({ type, page })
      .then(result => {
        if (active) setData(result);
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load community posts.');
      });
    return () => {
      active = false;
    };
  }, [page, retryKey, type]);

  useEffect(() => {
    if (!data) return;
    const lastPage = Math.max(1, data.total_pages);
    if (page > lastPage) navigate(pageHref(type, lastPage), { replace: true });
  }, [data, navigate, page, type]);

  const totalPages = Math.max(1, data?.total_pages || 1);

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="The Drop community" title="Small acts. Shared stories." description="Experiences, encouragement, and practical guidance from our donor community." aside={
        <Link
          to={user ? '/community/new' : '/login?returnTo=%2Fcommunity%2Fnew'}
          className="button button-primary"
        >
          <PenLine className="h-4 w-4" aria-hidden="true" />
          Share a helpful post
        </Link>
      } />

      <section aria-labelledby="community-feed-heading">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="community-feed-heading" className="text-lg font-semibold tracking-tight text-slate-800">From the community</h2>
            <p className="mt-1 text-sm text-slate-500" aria-live="polite">
              {data ? `${data.total.toLocaleString()} published post${data.total === 1 ? '' : 's'}` : 'Loading published posts…'}
            </p>
          </div>
          <nav className="flex max-w-full flex-wrap gap-2 sm:justify-end" aria-label="Filter community posts">
            {filters.map(filter => {
              const active = (filter.value || undefined) === type;
              const Icon = filter.icon;
              return (
                <Link
                  key={filter.value || 'all'}
                  to={pageHref(filter.value || undefined, 1)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors ${
                    active ? 'bg-primary text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:text-primary'
                  }`}
                >
                  {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                  {filter.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {!data && !error ? (
          <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200" role="status" aria-label="Loading community posts">
            {[0, 1, 2].map(item => (
              <div key={item} className="grid gap-5 py-6 sm:grid-cols-[12rem_minmax(0,1fr)]" aria-hidden="true">
                <div className="aspect-[4/3] animate-pulse bg-slate-100" />
                <div className="space-y-4">
                  <div className="h-4 w-2/5 animate-pulse rounded bg-slate-100" />
                  <div className="h-7 w-4/5 animate-pulse rounded bg-slate-100" />
                  <div className="h-20 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
            <span className="sr-only">Loading community posts…</span>
          </div>
        ) : error ? (
          <div className="theme-card mt-6 border border-red-200 bg-red-50 p-8 text-center" role="alert">
            <AlertCircle className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
            <h2 className="mt-3 font-extrabold text-red-950">Community posts could not be loaded</h2>
            <p className="mt-1 text-sm text-red-800">{error}</p>
            <button type="button" onClick={() => setRetryKey(current => current + 1)} className="mt-5 min-h-11 rounded-xl bg-red-700 px-5 text-sm font-extrabold text-white hover:bg-red-800">
              Try again
            </button>
          </div>
        ) : data && data.posts.length === 0 ? (
          <div className="theme-card mt-6 border border-slate-100 p-10 text-center sm:p-14">
            <BookOpenText className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-extrabold text-slate-900">No posts in this section yet</h2>
            <p className="mt-2 text-sm text-slate-500">Choose another category or be the first member to share something helpful.</p>
            <Link to="/community" className="mt-5 inline-flex min-h-11 items-center font-extrabold text-primary hover:text-primary-dark">View all community posts</Link>
          </div>
        ) : data ? (
          <div className="community-feed-grid">
            {data.posts.map(post => <CommunityPostCard key={post.id} post={post} />)}
          </div>
        ) : null}
      </section>

      {data && totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Community post pages">
          <Link
            to={pageHref(type, Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:border-slate-300'}`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
          </Link>
          <span className="text-sm font-bold text-slate-600">Page {page} of {totalPages}</span>
          <Link
            to={pageHref(type, Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            tabIndex={page >= totalPages ? -1 : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold ${page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:border-slate-300'}`}
          >
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </nav>
      )}

      <aside className="community-safety-note">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p><strong>Community content is not medical care.</strong> Health suggestions are member-written. Confirm medical decisions and donation eligibility with a qualified clinician or collection facility.</p>
      </aside>
    </div>
  );
}
