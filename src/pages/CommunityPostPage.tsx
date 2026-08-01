import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, BookOpenText, Flag, HeartHandshake, LoaderCircle, PenLine, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import MarkdownContent from '../components/community/MarkdownContent';
import { api, type PublicCommunityPostDetail } from '../lib/api';
import { communityPostTypeLabel, formatCommunityDate } from '../lib/community';
import { PUBLIC_SITE_URL } from '../components/RouteMetadata';

const STRUCTURED_DATA_ID = 'community-post-structured-data';
type ReportReason = 'SPAM' | 'FRAUD' | 'PAYMENT_REQUEST' | 'HARASSMENT' | 'PRIVACY' | 'OTHER';
const reportReasons: Array<{ value: ReportReason; label: string }> = [
  { value: 'SPAM', label: 'Spam or misleading content' },
  { value: 'FRAUD', label: 'Fraud or impersonation' },
  { value: 'PAYMENT_REQUEST', label: 'Payment or blood-sale request' },
  { value: 'HARASSMENT', label: 'Harassment or abuse' },
  { value: 'PRIVACY', label: 'Private information exposed' },
  { value: 'OTHER', label: 'Unsafe health claim or another issue' }
];

function setPropertyMeta(property: string, content: string) {
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setNamedMeta(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function absolutePublicUrl(value: string) {
  try {
    return new URL(value, PUBLIC_SITE_URL).href;
  } catch {
    return value;
  }
}

function useCommunityPostMetadata(post: PublicCommunityPostDetail | null) {
  useEffect(() => {
    if (!post) return;
    const canonicalUrl = `${PUBLIC_SITE_URL}/community/${encodeURIComponent(post.slug)}`;
    const pageTitle = `${post.title} — Drop Community`;
    document.title = pageTitle;

    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.setAttribute('name', 'description');
      document.head.appendChild(description);
    }
    description.setAttribute('content', post.excerpt);
    setPropertyMeta('og:type', 'article');
    setPropertyMeta('og:title', pageTitle);
    setPropertyMeta('og:description', post.excerpt);
    setPropertyMeta('og:url', canonicalUrl);
    setPropertyMeta('article:published_time', post.published_at);
    setPropertyMeta('article:modified_time', post.updated_at);
    setPropertyMeta('article:section', communityPostTypeLabel(post.type));
    setNamedMeta('twitter:card', post.image ? 'summary_large_image' : 'summary');
    setNamedMeta('twitter:title', pageTitle);
    setNamedMeta('twitter:description', post.excerpt);
    if (post.image) {
      const imageUrl = absolutePublicUrl(post.image.url);
      setPropertyMeta('og:image', imageUrl);
      setPropertyMeta('og:image:alt', post.image.alt);
      setNamedMeta('twitter:image', imageUrl);
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    document.getElementById(STRUCTURED_DATA_ID)?.remove();
    const structuredData = document.createElement('script');
    structuredData.id = STRUCTURED_DATA_ID;
    structuredData.type = 'application/ld+json';
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      articleBody: post.body_markdown,
      articleSection: communityPostTypeLabel(post.type),
      datePublished: post.published_at,
      dateModified: post.updated_at,
      author: { '@type': 'Person', name: post.author.name },
      publisher: { '@type': 'Organization', name: 'Drop Network', url: PUBLIC_SITE_URL },
      mainEntityOfPage: canonicalUrl,
      isAccessibleForFree: true,
      ...(post.image ? { image: [absolutePublicUrl(post.image.url)] } : {})
    }).replace(/</g, '\\u003c');
    document.head.appendChild(structuredData);

    return () => {
      structuredData.remove();
    };
  }, [post]);
}

export default function CommunityPostPage({ user }: { user: any }) {
  const { slug = '' } = useParams();
  const [post, setPost] = useState<PublicCommunityPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('OTHER');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  useCommunityPostMetadata(post);

  useEffect(() => {
    let active = true;
    setPost(null);
    setLoading(true);
    setError('');
    setNotFound(false);
    api.getCommunityPost(slug)
      .then(result => {
        if (active) setPost(result);
      })
      .catch(reason => {
        if (!active) return;
        if ((reason as Error & { status?: number })?.status === 404) setNotFound(true);
        else setError(reason instanceof Error ? reason.message : 'Could not load this community post.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retryKey, slug]);

  const submitReport = async (event: FormEvent) => {
    event.preventDefault();
    if (!post) return;
    setReportBusy(true);
    setReportMessage(null);
    try {
      await api.report('POST', post.id, reportReason, reportDetails.trim() || undefined);
      setReportMessage({ type: 'success', text: 'Report sent to the moderation team.' });
      setReportOpen(false);
      setReportDetails('');
    } catch (reason) {
      setReportMessage({ type: 'error', text: reason instanceof Error ? reason.message : 'Could not send the report.' });
    } finally {
      setReportBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl" role="status" aria-label="Loading community post">
        <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
        <div className="mt-8 h-12 w-4/5 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 h-5 w-2/5 animate-pulse rounded bg-slate-100" />
        <div className="mt-8 aspect-[16/9] animate-pulse rounded-3xl bg-slate-100" />
        <span className="sr-only">Loading post…</span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="theme-card mx-auto max-w-2xl border border-slate-100 p-10 text-center">
        <BookOpenText className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950">Community post not found</h1>
        <p className="mt-2 text-slate-500">This post may have been removed or its address may be incorrect.</p>
        <Link to="/community" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-extrabold text-white hover:bg-slate-800">Browse community posts</Link>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="theme-card mx-auto max-w-2xl border border-red-200 bg-red-50 p-10 text-center" role="alert">
        <AlertCircle className="mx-auto h-12 w-12 text-red-600" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-extrabold text-red-950">This post could not be loaded</h1>
        <p className="mt-2 text-sm text-red-800">{error || 'Please try again.'}</p>
        <button type="button" onClick={() => setRetryKey(current => current + 1)} className="mt-6 min-h-11 rounded-xl bg-red-700 px-5 text-sm font-extrabold text-white hover:bg-red-800">Try again</button>
      </div>
    );
  }

  const TypeIcon = post.type === 'DONATION_STORY' ? HeartHandshake : BookOpenText;

  return (
    <article className="mx-auto max-w-4xl" itemScope itemType="https://schema.org/BlogPosting">
      <nav aria-label="Breadcrumb" className="mb-7">
        <Link to="/community" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-600 hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Community
        </Link>
      </nav>

      <header>
        <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-800">
          <TypeIcon className="h-4 w-4" aria-hidden="true" />
          {communityPostTypeLabel(post.type)}
        </span>
        <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl" itemProp="headline">
          {post.title}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-slate-500">
          <span itemProp="author">By {post.author.name}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.published_at} itemProp="datePublished">Published {formatCommunityDate(post.published_at)}</time>
          {post.updated_at !== post.published_at && <meta itemProp="dateModified" content={post.updated_at} />}
        </div>
      </header>

      {post.image && (
        <figure className="mt-8 overflow-hidden rounded-3xl border border-slate-100 bg-slate-100">
          <img
            src={post.image.url}
            alt={post.image.alt}
            width={post.image.width}
            height={post.image.height}
            decoding="async"
            className="max-h-[38rem] w-full object-cover"
            itemProp="image"
          />
        </figure>
      )}

      <div className="theme-card mt-8 border border-slate-100 p-6 sm:p-10" itemProp="articleBody">
        <MarkdownContent markdown={post.body_markdown} />
      </div>

      {post.type === 'HEALTH_SUGGESTION' && (
        <aside className="mt-6 flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p><strong>This is community guidance, not medical advice.</strong> Check symptoms, treatment, medicines, and donation eligibility with a qualified clinician or collection facility.</p>
        </aside>
      )}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="report-community-post">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="report-community-post" className="text-sm font-extrabold text-slate-900">See something unsafe or private?</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Reports are reviewed by authorized moderators and are not shown publicly.</p>
          </div>
          {user ? (
            <button type="button" onClick={() => setReportOpen(current => !current)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-slate-300">
              <Flag className="h-4 w-4" aria-hidden="true" /> {reportOpen ? 'Cancel report' : 'Report post'}
            </button>
          ) : (
            <Link to={`/login?returnTo=${encodeURIComponent(`/community/${post.slug}`)}`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-slate-300">
              <Flag className="h-4 w-4" aria-hidden="true" /> Sign in to report
            </Link>
          )}
        </div>

        {reportOpen && user && (
          <form onSubmit={submitReport} className="mt-5 grid gap-4 border-t border-slate-100 pt-5">
            <div>
              <label htmlFor="community-report-reason" className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Reason</label>
              <select id="community-report-reason" value={reportReason} onChange={event => setReportReason(event.target.value as ReportReason)} className="input mt-2" disabled={reportBusy}>
                {reportReasons.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="community-report-details" className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Details (optional)</label>
              <textarea id="community-report-details" rows={3} maxLength={1000} value={reportDetails} onChange={event => setReportDetails(event.target.value)} className="input mt-2 resize-y" disabled={reportBusy} placeholder="Help the moderation team understand the issue" />
            </div>
            <button disabled={reportBusy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-extrabold text-white hover:bg-red-800 disabled:opacity-60 sm:justify-self-start">
              {reportBusy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {reportBusy ? 'Sending report…' : 'Send report'}
            </button>
          </form>
        )}
        {reportMessage && (
          <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${reportMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`} role={reportMessage.type === 'error' ? 'alert' : 'status'}>
            {reportMessage.text}
          </p>
        )}
      </section>

      <footer className="mt-8 flex flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-xl font-extrabold">Have something useful to share?</h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">Publish a donation experience or a responsible health suggestion.</p>
        </div>
        <Link to="/community/new" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-slate-950 hover:bg-slate-100">
          <PenLine className="h-4 w-4" aria-hidden="true" /> Write a post
        </Link>
      </footer>
    </article>
  );
}
