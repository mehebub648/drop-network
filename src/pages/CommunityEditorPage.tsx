import GuidedForm from '../components/GuidedForm';
import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, BookOpenText, ChevronLeft, ChevronRight, FileImage, HeartHandshake, ImagePlus, LoaderCircle, Send, Trash2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import MarkdownContent from '../components/community/MarkdownContent';
import {
  api,
  type CommunityOwnerPost,
  type CommunityPostListResponse,
  type CommunityPostType
} from '../lib/api';
import {
  COMMUNITY_BODY_MAX_LENGTH,
  COMMUNITY_BODY_MIN_LENGTH,
  COMMUNITY_IMAGE_ALT_MAX_LENGTH,
  COMMUNITY_IMAGE_MAX_BYTES,
  COMMUNITY_TITLE_MAX_LENGTH,
  COMMUNITY_TITLE_MIN_LENGTH,
  communityPostTypeDescription,
  communityPostTypeLabel,
  formatCommunityDate
} from '../lib/community';

const emptyOwnerPosts: CommunityPostListResponse<CommunityOwnerPost> = {
  posts: [],
  page: 1,
  total: 0,
  total_pages: 0
};
const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

function countCharacters(value: string) {
  return Array.from(value).length;
}

export default function CommunityEditorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedDraftId = searchParams.get('draft') || '';
  const [type, setType] = useState<CommunityPostType>('DONATION_STORY');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [createdDraft, setCreatedDraft] = useState<CommunityOwnerPost | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const [ownerPage, setOwnerPage] = useState(1);
  const [ownerPosts, setOwnerPosts] = useState(emptyOwnerPosts);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [ownerError, setOwnerError] = useState('');
  const [ownerReloadKey, setOwnerReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState('');
  const [requestedDraftLoaded, setRequestedDraftLoaded] = useState(false);

  useEffect(() => {
    if (!image) {
      setPreviewUrl('');
      return;
    }
    const nextUrl = URL.createObjectURL(image);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [image]);

  useEffect(() => {
    let active = true;
    setOwnerLoading(true);
    setOwnerError('');
    api.getMyCommunityPosts(ownerPage)
      .then(result => {
        if (active) setOwnerPosts(result);
      })
      .catch(reason => {
        if (active) setOwnerError(reason instanceof Error ? reason.message : 'Could not load your posts.');
      })
      .finally(() => {
        if (active) setOwnerLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ownerPage, ownerReloadKey]);

  useEffect(() => {
    if (!requestedDraftId || requestedDraftLoaded) return;
    let active = true;
    api.getMyCommunityPost(requestedDraftId)
      .then(post => {
        if (!active || post.status !== 'DRAFT') return;
        setType(post.type);
        setTitle(post.title);
        setBody(post.body_markdown);
        setImage(null);
        setImageAlt('');
        setConsent(false);
        setCreatedDraft(post);
        setMessage({ type: 'info', text: 'Donation story draft reopened. Review every public detail and explicitly consent before publishing.' });
      })
      .catch(reason => {
        if (active) setMessage({ type: 'error', text: reason instanceof Error ? reason.message : 'Could not load that draft.' });
      })
      .finally(() => {
        if (active) setRequestedDraftLoaded(true);
      });
    return () => { active = false; };
  }, [requestedDraftId, requestedDraftLoaded]);

  const changeType = (nextType: CommunityPostType) => {
    if (createdDraft) return;
    setType(nextType);
    if (nextType === 'HEALTH_SUGGESTION') {
      setImage(null);
      setImageAlt('');
    }
  };

  const validate = () => {
    const titleLength = countCharacters(title.trim());
    const bodyLength = countCharacters(body.trim());
    if (titleLength < COMMUNITY_TITLE_MIN_LENGTH || titleLength > COMMUNITY_TITLE_MAX_LENGTH) {
      return `Use ${COMMUNITY_TITLE_MIN_LENGTH}-${COMMUNITY_TITLE_MAX_LENGTH} characters for the title.`;
    }
    if (bodyLength < COMMUNITY_BODY_MIN_LENGTH || bodyLength > COMMUNITY_BODY_MAX_LENGTH) {
      return `Use ${COMMUNITY_BODY_MIN_LENGTH.toLocaleString()}-${COMMUNITY_BODY_MAX_LENGTH.toLocaleString()} characters for the post.`;
    }
    if (type === 'HEALTH_SUGGESTION' && image) return 'Health suggestions cannot include an image.';
    if (image && !supportedImageTypes.includes(image.type)) return 'Choose a JPEG, PNG, or WebP image.';
    if (image && image.size > COMMUNITY_IMAGE_MAX_BYTES) return 'Choose an image no larger than 10 MB.';
    if (image && (!imageAlt.trim() || countCharacters(imageAlt.trim()) > COMMUNITY_IMAGE_ALT_MAX_LENGTH)) {
      return `Describe the image in 1-${COMMUNITY_IMAGE_ALT_MAX_LENGTH} characters.`;
    }
    if (!consent) return 'Confirm the public-post consent before publishing.';
    return null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) return setMessage({ type: 'error', text: validationError });

    setSubmitting(true);
    setMessage(null);
    let draft = createdDraft;
    try {
      if (!draft) {
        draft = await api.createCommunityPost({
          type,
          title: title.trim(),
          body_markdown: body.trim()
        });
        setCreatedDraft(draft);
      }
      if (type === 'DONATION_STORY' && image) {
        draft = await api.uploadCommunityPostImage(draft.id, image, imageAlt);
        setCreatedDraft(draft);
        setImage(null);
        setImageAlt('');
      }
      const published = await api.publishCommunityPost(draft.id);
      if (!published.slug) throw new Error('The post was published without a public address.');
      navigate(`/community/${published.slug}`);
    } catch (reason) {
      setMessage({
        type: 'error',
        text: reason instanceof Error ? reason.message : 'Could not publish the post.'
      });
      if (draft) {
        setCreatedDraft(draft);
        setOwnerReloadKey(current => current + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const deletePost = async (post: CommunityOwnerPost) => {
    if (!window.confirm(`Delete “${post.title}”? Published posts will disappear from the public community.`)) return;
    setDeletingId(post.id);
    setOwnerError('');
    try {
      await api.deleteCommunityPost(post.id);
      if (createdDraft?.id === post.id) setCreatedDraft(null);
      setOwnerReloadKey(current => current + 1);
    } catch (reason) {
      setOwnerError(reason instanceof Error ? reason.message : 'Could not delete the post.');
    } finally {
      setDeletingId('');
    }
  };

  const resumeDraft = (post: CommunityOwnerPost) => {
    if (post.status !== 'DRAFT' || createdDraft) return;
    setType(post.type);
    setTitle(post.title);
    setBody(post.body_markdown);
    setImage(null);
    setImageAlt('');
    setConsent(false);
    setCreatedDraft(post);
    setMessage({ type: 'info', text: 'Draft reopened. Review the preview and consent before publishing.' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const titleLength = countCharacters(title);
  const bodyLength = countCharacters(body);
  const locked = Boolean(createdDraft);

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Link to="/community" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-600 hover:text-primary">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Community
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Create a post</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Share a donation story or responsible health guidance without private details.</p>
      </header>

      <GuidedForm onSubmit={submit} className="community-editor-form space-y-4">
        <div className="theme-card border border-slate-100 p-5 sm:p-8">
          <fieldset disabled={submitting}>
            <legend className="text-sm font-extrabold text-slate-950">Choose a post type</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(['DONATION_STORY', 'HEALTH_SUGGESTION'] as CommunityPostType[]).map(option => {
                const Icon = option === 'DONATION_STORY' ? HeartHandshake : BookOpenText;
                const selected = type === option;
                return (
                  <label key={option} className={`cursor-pointer rounded-2xl border p-4 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${selected ? 'border-rose-300 bg-rose-50' : 'border-slate-200 hover:border-slate-300'} ${locked ? 'cursor-not-allowed opacity-70' : ''}`}>
                    <input type="radio" name="community-type" value={option} checked={selected} disabled={locked || submitting} onChange={() => changeType(option)} className="sr-only" />
                    <span className="flex items-center gap-2 font-extrabold text-slate-950"><Icon className="h-5 w-5 text-primary" aria-hidden="true" /> {communityPostTypeLabel(option)}</span>
                    <span className="mt-2 block text-xs leading-5 text-slate-500">{communityPostTypeDescription(option)}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between gap-3">
                <label htmlFor="community-title" className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Title</label>
                <span className={`text-xs font-semibold ${titleLength > COMMUNITY_TITLE_MAX_LENGTH ? 'text-red-700' : 'text-slate-400'}`}>{titleLength}/{COMMUNITY_TITLE_MAX_LENGTH}</span>
              </div>
              <input
                id="community-title"
                required
                disabled={locked || submitting}
                minLength={COMMUNITY_TITLE_MIN_LENGTH}
                maxLength={COMMUNITY_TITLE_MAX_LENGTH}
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Give readers a clear, specific headline"
                className="input mt-2"
              />
            </div>

            <div className="mt-5">
              <div className="flex items-end justify-between gap-3">
                <label htmlFor="community-body" className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Post in Markdown</label>
                <span className={`text-xs font-semibold ${bodyLength > COMMUNITY_BODY_MAX_LENGTH ? 'text-red-700' : 'text-slate-400'}`}>{bodyLength.toLocaleString()}/{COMMUNITY_BODY_MAX_LENGTH.toLocaleString()}</span>
              </div>
              <textarea
                id="community-body"
                required
                disabled={locked || submitting}
                minLength={COMMUNITY_BODY_MIN_LENGTH}
                maxLength={COMMUNITY_BODY_MAX_LENGTH}
                rows={14}
                value={body}
                onChange={event => setBody(event.target.value)}
                placeholder={'Tell the story in your own words.\n\n## A helpful heading\n\nUse **bold**, lists, and safe links when they help.'}
                className="input mt-2 min-h-72 resize-y font-mono text-sm leading-6"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">Markdown headings, emphasis, lists, tables, quotes and safe links are supported. Raw HTML and embedded Markdown images are removed.</p>
            </div>

            {type === 'DONATION_STORY' && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h2 className="font-extrabold text-slate-950">One story image (optional)</h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">Choose one image you own and have permission to publish. Avoid patient records, phone numbers, IDs and visible private details.</p>

                {createdDraft?.image && !image && (
                  <figure className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <img src={createdDraft.image.url} alt={createdDraft.image.alt} className="aspect-video w-full object-cover" />
                    <figcaption className="px-4 py-3 text-xs text-slate-500">Uploaded image: {createdDraft.image.alt}</figcaption>
                  </figure>
                )}
                <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center hover:border-rose-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                  <FileImage className="h-7 w-7 text-slate-400" aria-hidden="true" />
                  <span className="mt-2 text-sm font-extrabold text-slate-700">{image ? image.name : createdDraft?.image ? 'Choose a replacement image' : 'Choose one image'}</span>
                  <span className="mt-1 text-xs leading-5 text-slate-500">JPEG, PNG or WebP, up to 10 MB and 24 MP. Animated images are not supported.</span>
                  <input
                    key={image ? `${image.name}-${image.lastModified}` : 'empty-image'}
                    id="community-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={submitting}
                    onChange={event => {
                      const selected = event.target.files?.[0] || null;
                      setImage(selected);
                      setImageAlt('');
                    }}
                    className="sr-only"
                  />
                </label>
                {createdDraft?.image && !image && (
                  <p className="mt-2 text-xs leading-5 text-slate-500">A replacement removes the previous upload, so this story will still contain only one image.</p>
                )}
                {previewUrl && <img src={previewUrl} alt={imageAlt || 'Selected story image preview'} className="mt-4 aspect-video w-full rounded-2xl border border-slate-200 object-cover" />}
                {image && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="community-image-alt" className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Image description</label>
                      <button type="button" onClick={() => { setImage(null); setImageAlt(''); }} className="min-h-10 text-xs font-extrabold text-red-700 hover:underline">{createdDraft?.image ? 'Cancel replacement' : 'Remove image'}</button>
                    </div>
                    <input
                      id="community-image-alt"
                      required
                      maxLength={COMMUNITY_IMAGE_ALT_MAX_LENGTH}
                      value={imageAlt}
                      onChange={event => setImageAlt(event.target.value)}
                      placeholder="Describe what is visible for people using screen readers"
                      className="input mt-2"
                    />
                  </div>
                )}
              </div>
            )}

            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 h-4 w-4 rounded border-amber-400 text-primary focus:ring-primary" />
              <span className="text-sm leading-6 text-amber-950">
                I have permission to publish this content publicly. It contains no phone number, patient record or private personal detail, and I understand it may appear in search engines.
              </span>
            </label>
          </fieldset>

          {createdDraft && (
            <div className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900" role="status">
              <p className="font-semibold">Your draft is saved. The written fields are locked while Drop retries the remaining upload or publishing step.</p>
              <button type="button" disabled={submitting || deletingId === createdDraft.id} onClick={() => deletePost(createdDraft)} className="mt-2 min-h-10 font-extrabold underline underline-offset-4 disabled:opacity-50">
                Discard saved draft and unlock the editor
              </button>
            </div>
          )}
          {message && (
            <p className={`mt-5 rounded-xl px-4 py-3 text-sm font-bold ${message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-900'}`} role="alert">
              {message.text}
            </p>
          )}
          <button disabled={submitting} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-white shadow-sm shadow-rose-900/20 hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60 sm:w-auto">
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {submitting ? 'Publishing…' : createdDraft ? 'Retry publishing' : 'Publish post'}
          </button>
        </div>

        <details className="theme-card border border-slate-100 p-5 sm:p-7">
          <summary className="min-h-11 cursor-pointer font-extrabold text-slate-900">Preview post</summary>
          <h2 className="mt-2 break-words text-2xl font-extrabold tracking-tight text-slate-950">{title.trim() || 'Your title will appear here'}</h2>
          <p className="mt-2 text-xs font-bold text-rose-800">{communityPostTypeLabel(type)}</p>
          <div className="mt-5 border-t border-slate-100 pt-5">
            {body.trim() ? <MarkdownContent markdown={body} className="text-sm" /> : <p className="text-sm leading-6 text-slate-400">Start writing to preview the safely rendered Markdown.</p>}
          </div>
        </details>
      </GuidedForm>

      <details className="community-owner-posts border-t border-slate-200 pt-5">
        <summary id="my-community-posts" className="flex min-h-12 cursor-pointer items-center justify-between gap-4 text-xl font-extrabold text-slate-950">
          Your posts
          {!ownerLoading && <span className="text-sm font-bold text-slate-500">{ownerPosts.total}</span>}
        </summary>
        <div className="pt-1">

        {ownerLoading ? (
          <div className="mt-5 h-28 animate-pulse rounded-2xl bg-slate-100" role="status"><span className="sr-only">Loading your posts…</span></div>
        ) : ownerError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900" role="alert">
            <p className="font-bold">{ownerError}</p>
            <button type="button" onClick={() => setOwnerReloadKey(current => current + 1)} className="mt-3 min-h-11 font-extrabold text-red-800 underline underline-offset-4">Try again</button>
          </div>
        ) : ownerPosts.posts.length === 0 ? (
          <div className="theme-card mt-5 border border-slate-100 p-8 text-center text-sm text-slate-500">You have not created a community post yet.</div>
        ) : (
          <ul className="mt-5 space-y-3">
            {ownerPosts.posts.map(post => (
              <li key={post.id} className="theme-card flex flex-col gap-4 border border-slate-100 p-5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{communityPostTypeLabel(post.type)}</span>
                    <span className={post.status === 'PUBLISHED' ? 'text-green-700' : post.status === 'HIDDEN' ? 'text-amber-700' : 'text-slate-500'}>{post.status.toLowerCase()}</span>
                    <time dateTime={post.updated_at} className="text-slate-400">Updated {formatCommunityDate(post.updated_at)}</time>
                  </div>
                  <h3 className="mt-2 truncate font-extrabold text-slate-950">{post.title}</h3>
                  {post.status === 'HIDDEN' && post.moderation_reason && (
                    <p className="mt-2 text-xs leading-5 text-amber-800">Moderation note: {post.moderation_reason}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {post.status === 'DRAFT' && (
                    <button
                      type="button"
                      disabled={Boolean(createdDraft)}
                      onClick={() => resumeDraft(post)}
                      className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {createdDraft?.id === post.id ? 'Editing' : 'Resume'}
                    </button>
                  )}
                  {post.status === 'PUBLISHED' && post.slug && (
                    <Link to={`/community/${post.slug}`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-slate-300">View</Link>
                  )}
                  {post.status !== 'DELETED' && (
                    <button type="button" disabled={deletingId === post.id} onClick={() => deletePost(post)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                      <Trash2 className="h-4 w-4" aria-hidden="true" /> {deletingId === post.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {ownerPosts.total_pages > 1 && (
          <nav className="mt-5 flex items-center justify-center gap-3" aria-label="Your community post pages">
            <button type="button" disabled={ownerPage <= 1} onClick={() => setOwnerPage(current => Math.max(1, current - 1))} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 disabled:opacity-40" aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="text-sm font-bold text-slate-600">Page {ownerPage} of {ownerPosts.total_pages}</span>
            <button type="button" disabled={ownerPage >= ownerPosts.total_pages} onClick={() => setOwnerPage(current => current + 1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 disabled:opacity-40" aria-label="Next page">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        )}
        </div>
      </details>
    </div>
  );
}
