import { useEffect } from 'react';
import { useLocation } from 'react-router';

export const PUBLIC_SITE_URL = (() => {
  if (typeof document !== 'undefined') {
    const configured = document.querySelector('meta[name="drop-public-origin"]')?.getAttribute('content');
    if (configured) {
      try {
        return new URL(configured).origin;
      } catch {
        // Fall through to the browser origin when the shell metadata is invalid.
      }
    }
  }
  return typeof window !== 'undefined' ? window.location.origin : 'https://findadrop.org';
})();

const metadata: Record<string, [string, string]> = {
  '/': ['drop. — Find blood donors in Bangladesh', 'Search opted-in blood donors by blood group and district, then coordinate safely through drop.'],
  '/requests': ['Live blood requests — drop.', 'Browse active verified blood requests across Bangladesh.'],
  '/community': ['Donation stories and health suggestions — drop.', 'Read first-hand blood donation stories and practical community health suggestions from members across Bangladesh.'],
  '/community/new': ['Write a community post — drop.', 'Create a donation story or health suggestion for the drop. community.'],
  '/login': ['Member sign in — drop.', 'Sign in to manage your drop. account and view opted-in donor contacts.'],
  '/register': ['Become a donor — drop.', 'Join the Bangladesh community blood donor network with a verified phone.'],
  '/forgot-password': ['Reset your password — drop.', 'Verify your phone and securely reset your drop. account password.'],
  '/about': ['About drop.', 'How drop. connects requesters with compatible community donors.'],
  '/safety': ['Blood donation safety — drop.', 'Safety guidance for community blood donor coordination.'],
  '/contact': ['Contact drop. operations', 'Submit support, safety, privacy, or partnership questions.'],
  '/partners': ['Verified blood donation partners — drop.', 'Browse reviewed hospitals, blood banks, NGOs, and public donation campaigns.'],
  '/privacy': ['Privacy Policy — drop.', 'How drop. protects donor, requester, account, and contact information.'],
  '/delete-account': ['Delete your drop. account', 'Delete your drop. account in profile settings or request help when you cannot sign in.'],
  '/terms': ['Terms of Use — drop.', 'Rules and safety expectations for using drop. responsibly.'],
  '/directory': ['Find blood donors near you — drop.', 'Search donors by blood group, district and upazila. Numbers stay masked until you say who needs blood.'],
  '/directory/imported': ['Claim an imported donor profile — drop.', 'Verify ownership of an imported donor record and bring it under your control.'],
  '/directory/call': ['Report a donor call — drop.', 'Complete the required outcome for a previously revealed donor contact.'],
  '/directory/remove': ['Remove your number from the directory — drop.', 'Take a publicly imported donor listing off drop. by verifying the number. No account needed.'],
  '/contribute': ['Add blood donors — drop.', 'Invite one donor privately or send a larger donor list for careful staff review.'],
  '/claim': ['Claim a donor profile — drop.', 'Verify your phone, confirm every detail, and control your drop. donor profile.'],
  '/profile': ['My drop. account', 'Manage your donor profile, requests, responses, follow-ups, history, security, and privacy settings.'],
  '/follow-up': ['Donation follow-up', 'Privately update whether a planned blood donation was completed.'],
  '/admin': ['drop. operations workspace', 'Role-aware administration for drop. operations.'],
  '/admin/login': ['Administration sign in — drop.', 'Sign in with separate Drop administration credentials.']
};

export default function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const key = pathname === '/community/new'
      ? '/community/new'
      : pathname.startsWith('/community/')
        ? '/community'
        : pathname.startsWith('/request/')
          ? '/requests'
          // Old call links redirect to search, but retain private metadata while
          // that compatibility route is resolving.
          : pathname.startsWith('/directory/call/')
            ? '/directory/call'
          : pathname === '/directory/remove'
            ? '/directory/remove'
          : pathname.startsWith('/c/')
            ? '/claim'
          : pathname.startsWith('/directory/imported') || (pathname.startsWith('/directory/') && pathname !== '/directory')
            ? '/directory/imported'
            : pathname.startsWith('/profile')
              ? '/profile'
              : pathname;
    const [title, description] = metadata[key] || ['drop.', 'Bangladesh community blood donor matching network.'];
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
    ['og:image', 'og:image:alt', 'article:published_time', 'article:modified_time', 'article:section'].forEach(property => {
      document.querySelector(`meta[property="${property}"]`)?.remove();
    });
    ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].forEach(name => {
      document.querySelector(`meta[name="${name}"]`)?.remove();
    });
    setMeta('og:type', 'website');
    setMeta('og:title', title); setMeta('og:description', description); setMeta('og:url', canonicalUrl);
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) { robots = document.createElement('meta'); robots.setAttribute('name', 'robots'); document.head.appendChild(robots); }
    // Legacy call links and imported-record ownership pages remain private.
    const privatePage = pathname === '/community/new' || pathname.startsWith('/profile') || pathname.startsWith('/follow-up') || pathname.startsWith('/admin') || pathname.startsWith('/directory/call/') || pathname.startsWith('/directory/imported/') || pathname.startsWith('/c/');
    robots.setAttribute('content', privatePage ? 'noindex, nofollow' : 'index, follow');
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.setAttribute('rel', 'canonical'); document.head.appendChild(canonical); }
    canonical.setAttribute('href', canonicalUrl);
  }, [pathname]);
  return null;
}
