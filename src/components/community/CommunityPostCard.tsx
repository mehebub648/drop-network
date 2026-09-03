import { BookOpenText, HeartHandshake } from 'lucide-react';
import { Link } from 'react-router';
import type { PublicCommunityPostSummary } from '../../lib/api';
import { communityPostTypeLabel, formatCommunityDate } from '../../lib/community';

export default function CommunityPostCard({ post }: { post: PublicCommunityPostSummary }) {
  const StoryIcon = post.type === 'DONATION_STORY' ? HeartHandshake : BookOpenText;

  return (
    <article
      className={`community-post-row grid min-w-0 gap-5 border-b border-slate-200 py-6 sm:items-center ${post.image ? 'sm:grid-cols-[12rem_minmax(0,1fr)]' : ''}`}
      itemScope
      itemType="https://schema.org/BlogPosting"
    >
      {post.image && (
        <Link to={`/community/${post.slug}`} className="block overflow-hidden border border-slate-200 bg-slate-100" tabIndex={-1} aria-hidden="true">
          <img
            src={post.image.url}
            alt=""
            width={post.image.width}
            height={post.image.height}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
          />
        </Link>
      )}

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-rose-800">
            <StoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {communityPostTypeLabel(post.type)}
          </span>
          <time dateTime={post.published_at} itemProp="datePublished">
            {formatCommunityDate(post.published_at)}
          </time>
        </div>

        <h2 className="mt-4 text-xl font-extrabold leading-tight tracking-tight text-slate-950" itemProp="headline">
          <Link to={`/community/${post.slug}`} className="rounded-sm hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4">
            {post.title}
          </Link>
        </h2>
        <p className="mt-3 flex-1 text-sm leading-7 text-slate-600" itemProp="description">{post.excerpt}</p>
        <div className="mt-4 flex items-center justify-between gap-4 text-sm">
          <span className="font-semibold text-slate-600" itemProp="author">By {post.author.name}</span>
          <Link to={`/community/${post.slug}`} className="inline-flex min-h-11 items-center font-extrabold text-primary hover:text-primary-dark">
            Read post<span className="sr-only">: {post.title}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
