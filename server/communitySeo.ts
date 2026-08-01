import type { CommunityPostType } from './communityPosts';

export type CommunitySeoPost = {
  slug: string;
  type: CommunityPostType;
  title: string;
  excerpt: string;
  body_text: string;
  author_name: string;
  published_at: string;
  updated_at: string;
  image_url?: string;
  image_alt?: string;
};

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function replaceMeta(html: string, selector: RegExp, tag: string) {
  return selector.test(html)
    ? html.replace(selector, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`);
}

export function renderPublicOriginHtml(template: string, publicOrigin: string) {
  const origin = new URL(publicOrigin).origin;
  return replaceMeta(
    template,
    /<meta\s+name=["']drop-public-origin["'][^>]*>/i,
    `<meta name="drop-public-origin" content="${escapeHtml(origin)}" />`
  );
}

/**
 * Adds crawler-visible article metadata to the production SPA shell. Values
 * are escaped for HTML attributes and JSON-LD is made inert against `</script>`
 * injection before it is inserted into the document.
 */
export function renderCommunityPostHtml(
  template: string,
  post: CommunitySeoPost,
  publicOrigin: string
) {
  const origin = new URL(publicOrigin).origin;
  const canonical = `${origin}/community/${encodeURIComponent(post.slug)}`;
  const title = `${post.title} — Drop Community`;
  const articleSection = post.type === 'DONATION_STORY' ? 'Donation stories' : 'Health suggestions';
  const imageUrl = post.image_url ? new URL(post.image_url, origin).toString() : undefined;

  let html = renderPublicOriginHtml(template, origin)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(
    html,
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeHtml(post.excerpt)}" />`
  );
  html = replaceMeta(html, /<meta\s+property=["']og:type["'][^>]*>/i, '<meta property="og:type" content="article" />');
  html = replaceMeta(
    html,
    /<meta\s+property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(title)}" />`
  );
  html = replaceMeta(
    html,
    /<meta\s+property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(post.excerpt)}" />`
  );

  const extraMeta = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="article:published_time" content="${escapeHtml(post.published_at)}" />`,
    `<meta property="article:modified_time" content="${escapeHtml(post.updated_at)}" />`,
    `<meta property="article:section" content="${escapeHtml(articleSection)}" />`,
    `<meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(post.excerpt)}" />`,
    ...(imageUrl
      ? [
          `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
          `<meta property="og:image:alt" content="${escapeHtml(post.image_alt || post.title)}" />`,
          `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`
        ]
      : [])
  ];

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    articleBody: post.body_text,
    articleSection,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: { '@type': 'Person', name: post.author_name },
    publisher: { '@type': 'Organization', name: 'Drop Network', url: origin },
    mainEntityOfPage: canonical,
    isAccessibleForFree: true,
    ...(imageUrl ? { image: [imageUrl] } : {})
  };
  const jsonLd = JSON.stringify(structuredData)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return html.replace(
    '</head>',
    `    ${extraMeta.join('\n    ')}\n    <script id="community-post-structured-data" type="application/ld+json">${jsonLd}</script>\n  </head>`
  );
}
