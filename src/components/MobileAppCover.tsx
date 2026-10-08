import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowDownToLine, ArrowUpRight, Monitor, Smartphone } from 'lucide-react';

export function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false;
  if (document.documentElement.dataset.dropAndroid === 'true') return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Privacy, support and listing removal must remain reachable from any device.
const publicHelpRoutes = new Set(['/privacy', '/terms', '/safety', '/contact', '/directory/remove']);

export default function MobileAppCover({ children, mobile, downloadUrl }: {
  children: ReactNode;
  mobile: boolean;
  downloadUrl: string | null;
}) {
  const { pathname } = useLocation();
  if (!mobile || publicHelpRoutes.has(pathname)) return children;

  return (
    <main id="main-content" className="min-h-dvh bg-[#faf9f7] px-6 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col">
        <Link to="/" aria-label="Drop Network home" className="flex w-fit items-center gap-2.5 text-2xl font-bold tracking-tight">
          <img src="/drop-icon.svg" alt="" className="h-9 w-9" />Drop
        </Link>
        <section className="flex flex-1 flex-col justify-center py-14">
          <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-100 bg-white text-primary">
            <Smartphone size={30} strokeWidth={1.6} aria-hidden="true" />
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-primary">A little help. A life changed.</p>
          <h1 className="text-[clamp(2rem,9vw,3rem)] font-bold leading-[1.12] tracking-[-.045em]">Blood help,<br />wherever you are.</h1>
          <p className="mt-5 text-base leading-7 text-slate-600">Find donors, follow blood requests, and stay connected with your community in the Drop app.</p>
          {downloadUrl ? (
            <a href={downloadUrl} className="mt-8 inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-primary px-5 font-semibold text-white transition hover:bg-primary-dark">
              <ArrowDownToLine size={20} aria-hidden="true" />Download for Android
            </a>
          ) : (
            <p role="status" className="mt-8 rounded-xl border border-rose-100 bg-white p-4 text-sm leading-6 text-slate-600">The Android download is being prepared. You can use Drop now from a desktop browser.</p>
          )}
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <Monitor className="mt-0.5 shrink-0 text-slate-500" size={20} aria-hidden="true" />
            <div><h2 className="text-sm font-semibold">Using a computer?</h2><p className="mt-1 text-sm leading-6 text-slate-600">Open this website on a desktop browser for the full web experience.</p></div>
          </div>
        </section>
        <footer className="flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-200 pt-5 text-sm text-slate-600">
          <Link to="/privacy" className="inline-flex min-h-11 items-center gap-1.5">Privacy<ArrowUpRight size={14} aria-hidden="true" /></Link>
          <Link to="/contact" className="inline-flex min-h-11 items-center gap-1.5">Get help<ArrowUpRight size={14} aria-hidden="true" /></Link>
          <Link to="/directory/remove" className="inline-flex min-h-11 items-center gap-1.5">Remove a listing<ArrowUpRight size={14} aria-hidden="true" /></Link>
        </footer>
      </div>
    </main>
  );
}
