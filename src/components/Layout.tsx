import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Droplet, Heart, LogOut, MapPin, Menu, Plus, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react';
import Footer from './Footer';

const navigation: Array<{ label: string; to: string; end?: boolean }> = [
  { label: 'Live requests', to: '/requests' },
  { label: 'Device requests', to: '/device-requests' },
  { label: 'Community', to: '/community' },
  { label: 'About', to: '/about' }
];

const supportNavigation = [
  { label: 'Safety', to: '/safety' },
  { label: 'Contact', to: '/contact' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' }
];

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-bold transition-colors ${
    isActive
      ? 'bg-white text-primary shadow-sm ring-1 ring-rose-100'
      : 'text-slate-600 hover:bg-white/80 hover:text-slate-950'
  }`;

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-12 items-center rounded-xl px-4 text-sm font-bold transition-colors ${
    isActive
      ? 'bg-rose-50 text-rose-800'
      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
  }`;

export default function Layout({
  children,
  user,
  onLogout,
  otpBypassEnabled
}: {
  children: ReactNode;
  user: any;
  onLogout: () => void;
  otpBypassEnabled: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const isAndroidEmbed = typeof document !== 'undefined' && document.documentElement.dataset.dropAndroid === 'true';
  const isTaskRoute = /^(\/directory|\/requests|\/request\/|\/community(?:\/|$)|\/profile(?:\/|$)|\/login$|\/register$|\/forgot-password$|\/follow-up$|\/c\/|\/contribute$|\/admin(?:\/|$))/.test(pathname);
  const hideFooter = isAndroidEmbed;
  const isStaff = Boolean(
    user?.staff_role ||
      user?.roles?.some((role: string) => ['ADMIN', 'MODERATOR', 'SUPPORT', 'VERIFIER'].includes(role))
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  return (
    <div className={`min-h-screen flex flex-col bg-transparent ${isAndroidEmbed ? 'android-embedded-layout' : ''}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-slate-950 focus:shadow-lg"
      >
        Skip to main content
      </a>

      <header className="site-header sticky top-0 z-50">
        <div className="site-header-inner mx-auto flex min-h-[4.5rem] items-center gap-4 px-4 sm:px-5">
          <Link to="/" className="group flex min-h-11 shrink-0 items-center gap-3 rounded-xl" aria-label="Drop Network home">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-primary shadow-[0_12px_28px_-14px_rgba(190,18,60,0.8)] transition-transform group-hover:-rotate-3">
              <span className="absolute inset-1 rounded-xl border border-white/25" aria-hidden="true" />
              <Droplet className="relative h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xl font-extrabold leading-none tracking-[-0.04em] text-slate-950">
                Drop<span className="text-primary">.</span>
              </span>
              <span className="mt-1 hidden text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400 sm:block">Donor network</span>
            </span>
          </Link>

          <nav className="site-desktop-nav ml-4 hidden items-center gap-0.5 rounded-full p-1 xl:flex" aria-label="Primary navigation">
            {navigation.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end} className={desktopLink}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-2 xl:flex">
            {user ? (
              <>
                <Link
                  to="/directory"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-white shadow-[0_12px_28px_-18px_rgba(190,18,60,0.9)] transition-all hover:-translate-y-0.5 hover:bg-primary-dark"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Find blood
                </Link>
                <NavLink
                  to="/profile"
                  className={({ isActive }) =>
                    `inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors ${
                      isActive ? 'bg-rose-50 text-rose-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                    }`
                  }
                >
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                  My account
                </NavLink>
                {isStaff && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      `inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors ${
                        isActive ? 'bg-rose-50 text-rose-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                      }`
                    }
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Operations
                  </NavLink>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-extrabold text-white shadow-[0_12px_28px_-18px_rgba(190,18,60,0.9)] transition-all hover:-translate-y-0.5 hover:bg-primary-dark"
                >
                  Join as a donor
                </Link>
              </>
            )}
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm xl:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-haspopup="true"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileOpen(current => !current)}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {mobileOpen && (
          <div id="mobile-navigation" className="site-mobile-navigation px-4 pb-5 pt-3 xl:hidden">
            <nav className="mx-auto grid gap-1 rounded-2xl p-2" aria-label="Mobile navigation">
              {navigation.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end} className={mobileLink}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mx-auto mt-3 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
              {user ? (
                <>
                  <Link
                    to="/directory"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-white"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Find blood
                  </Link>
                  <Link
                    to="/profile"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"
                  >
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    My account
                  </Link>
                  {isStaff && (
                    <Link
                      to="/admin"
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      Operations
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onLogout();
                    }}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 text-sm font-extrabold text-white"
                  >
                    Join as a donor
                  </Link>
                </>
              )}
            </div>
            <nav className="mobile-support-navigation mx-auto mt-3 grid grid-cols-4 gap-1 border-t border-slate-100 pt-3" aria-label="Help and legal">
              {supportNavigation.map(item => (
                <Link key={item.to} to={item.to} className="flex min-h-11 items-center justify-center rounded-xl px-2 text-center text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {otpBypassEnabled && (
        <div role="alert" className="border-y border-amber-300 bg-amber-100 px-4 py-3 text-center text-sm font-extrabold text-amber-950">
          OTP bypass test mode is active. Phone ownership is not being verified.
        </div>
      )}

      <main id="main-content" className="site-main mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="site-doodle-layer" aria-hidden="true">
          <Heart className="site-doodle-mark site-doodle-heart" />
          <Sparkles className="site-doodle-mark site-doodle-sparkles" />
          <Droplet className="site-doodle-mark site-doodle-drop" />
          <MapPin className="site-doodle-mark site-doodle-pin" />
          <Plus className="site-doodle-mark site-doodle-plus" />
        </div>
        {children}
      </main>
      {!hideFooter && <Footer compact={isTaskRoute} />}
    </div>
  );
}
