import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowDownToLine, ArrowUpRight } from 'lucide-react';
import Doodle from './Doodle';

export function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false;
  if (document.documentElement.dataset.dropAndroid === 'true') return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Privacy, support and listing removal must remain reachable from any device.
const publicHelpRoutes = new Set(['/privacy', '/terms', '/safety', '/contact', '/delete-account', '/directory/remove']);

export default function MobileAppCover({ children, mobile, downloadUrl }: {
  children: ReactNode;
  mobile: boolean;
  downloadUrl: string | null;
}) {
  const { pathname } = useLocation();
  if (!mobile || publicHelpRoutes.has(pathname)) return children;

  return (
    <main id="main-content" className="mobile-app-cover">
      <div className="mobile-app-cover-inner">
        <Link to="/" aria-label="drop. home" className="mobile-app-cover-brand">
          <img src="/drop-icon.svg" alt="" className="h-9 w-9" /><span>drop<span className="text-primary">.</span></span>
        </Link>
        <section className="mobile-app-cover-card">
          <div className="mobile-app-cover-art" aria-hidden="true">
            <span className="mobile-app-spark mobile-app-spark-one">✦</span>
            <Doodle kind="welcome" className="mobile-app-cover-doodle" />
            <span className="mobile-app-spark mobile-app-spark-two">♡</span>
          </div>
          <p className="eyebrow">drop<span className="text-primary">.</span> for Android</p>
          <h1>Help is closer<br />in the app.</h1>
          <p>Find donors. Follow requests. Share hope.</p>
          {downloadUrl ? (
            <a href={downloadUrl} className="mobile-app-download-button">
              <ArrowDownToLine size={20} aria-hidden="true" />Get the Android app
            </a>
          ) : (
            <p role="status" className="mobile-app-download-status">Almost ready for your phone.</p>
          )}
          <p className="mobile-app-desktop-note">On a computer? Open drop<span className="text-primary">.</span> there for the full website.</p>
        </section>
        <footer className="mobile-app-cover-footer">
          <Link to="/privacy" className="inline-flex min-h-11 items-center gap-1.5">Privacy<ArrowUpRight size={14} aria-hidden="true" /></Link>
          <Link to="/contact" className="inline-flex min-h-11 items-center gap-1.5">Get help<ArrowUpRight size={14} aria-hidden="true" /></Link>
          <Link to="/delete-account" className="inline-flex min-h-11 items-center gap-1.5">Delete account<ArrowUpRight size={14} aria-hidden="true" /></Link>
          <Link to="/directory/remove" className="inline-flex min-h-11 items-center gap-1.5">Remove a listing<ArrowUpRight size={14} aria-hidden="true" /></Link>
        </footer>
      </div>
    </main>
  );
}
