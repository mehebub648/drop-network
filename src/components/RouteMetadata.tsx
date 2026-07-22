import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const metadata: Record<string, [string, string]> = {
  '/': ['Drop Network — Find compatible blood donors in Bangladesh', 'Create a verified blood request and coordinate privately with eligible nearby donors.'],
  '/requests': ['Live blood requests — Drop Network', 'Browse active verified blood requests across Bangladesh.'],
  '/request/new': ['Create a blood request — Drop Network', 'Review and publish a complete verified blood request.'],
  '/register': ['Become a donor — Drop Network', 'Join the Bangladesh community blood donor network with a verified phone.'],
  '/about': ['About Drop Network', 'How Drop connects requesters with compatible community donors.'],
  '/safety': ['Blood donation safety — Drop Network', 'Safety guidance for community blood donor coordination.'],
  '/contact': ['Contact Drop Network operations', 'Submit support, safety, privacy, or partnership questions.']
};

export default function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const key = pathname.startsWith('/request/') ? '/requests' : pathname;
    const [title, description] = metadata[key] || ['Drop Network', 'Bangladesh community blood donor matching network.'];
    document.title = title;
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) { tag = document.createElement('meta'); tag.setAttribute('name', 'description'); document.head.appendChild(tag); }
    tag.setAttribute('content', description);
    const setMeta = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) { meta = document.createElement('meta'); meta.setAttribute('property', property); document.head.appendChild(meta); }
      meta.setAttribute('content', content);
    };
    setMeta('og:title', title); setMeta('og:description', description); setMeta('og:url', window.location.href);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.setAttribute('rel', 'canonical'); document.head.appendChild(canonical); }
    canonical.setAttribute('href', `${window.location.origin}${pathname}`);
  }, [pathname]);
  return null;
}
