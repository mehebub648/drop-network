import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PUBLIC_SITE_URL = 'https://findadrop.org';

const metadata: Record<string, [string, string]> = {
  '/': ['Drop Network — Find blood donors in Bangladesh', 'Search opted-in blood donors by blood group and district, then coordinate safely through Drop.'],
  '/requests': ['Live blood requests — Drop Network', 'Browse active verified blood requests across Bangladesh.'],
  '/login': ['Member sign in — Drop Network', 'Sign in to manage your Drop account and view opted-in donor contacts.'],
  '/register': ['Become a donor — Drop Network', 'Join the Bangladesh community blood donor network with a verified phone.'],
  '/forgot-password': ['Reset your password — Drop Network', 'Verify your phone and securely reset your Drop account password.'],
  '/about': ['About Drop Network', 'How Drop connects requesters with compatible community donors.'],
  '/safety': ['Blood donation safety — Drop Network', 'Safety guidance for community blood donor coordination.'],
  '/contact': ['Contact Drop Network operations', 'Submit support, safety, privacy, or partnership questions.'],
  '/partners': ['Verified blood donation partners — Drop Network', 'Browse reviewed hospitals, blood banks, NGOs, and public donation campaigns.'],
  '/privacy': ['Privacy Policy — Drop Network', 'How Drop protects donor, requester, account, and contact information.'],
  '/terms': ['Terms of Use — Drop Network', 'Rules and safety expectations for using Drop responsibly.'],
  '/directory': ['Find blood donors near you — Drop Network', 'Search donors by blood group, district and upazila. Numbers stay masked until you say who needs blood.'],
  '/directory/imported': ['Imported donor archive — Drop Network', 'Browse donor entries published by other Bangladesh organisations. Contact details remain masked for everyone.'],
  '/profile': ['My Drop account', 'Manage your donor profile, requests, invitations, history, security, and privacy settings.'],
  '/admin': ['Drop operations workspace', 'Role-aware administration for Drop Network operations.']
};

export default function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const key = pathname.startsWith('/request/')
      ? '/requests'
      : pathname.startsWith('/directory/imported') || (pathname.startsWith('/directory/') && pathname !== '/directory')
        ? '/directory/imported'
        : pathname.startsWith('/profile')
          ? '/profile'
          : pathname;
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
    const canonicalUrl = `${PUBLIC_SITE_URL}${pathname}`;
    setMeta('og:title', title); setMeta('og:description', description); setMeta('og:url', canonicalUrl);
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) { robots = document.createElement('meta'); robots.setAttribute('name', 'robots'); document.head.appendChild(robots); }
    // A call page carries a revealed contact number, so it must never be indexed.
    const privatePage = pathname.startsWith('/profile') || pathname.startsWith('/admin') || pathname.startsWith('/directory/call/');
    robots.setAttribute('content', privatePage ? 'noindex, nofollow' : 'index, follow');
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.setAttribute('rel', 'canonical'); document.head.appendChild(canonical); }
    canonical.setAttribute('href', canonicalUrl);
  }, [pathname]);
  return null;
}
