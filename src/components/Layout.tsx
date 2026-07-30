import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Droplet, LogOut, Menu, Plus, ShieldCheck, UserRound, X } from 'lucide-react';
import Footer from './Footer';

const navigation = [
  { label: 'Find donors', to: '/directory', end: true },
  { label: 'Live requests', to: '/requests' },
  { label: 'Partners', to: '/partners' },
  { label: 'About', to: '/about' }
];

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold transition-colors ${
    isActive
      ? 'bg-rose-50 text-rose-800'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
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
  onLogout
}: {
  children: ReactNode;
  user: any;
  onLogout: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
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
    <div className="min-h-screen flex flex-col bg-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-slate-950 focus:shadow-lg"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 border-b border-rose-950/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-h-11 shrink-0 items-center gap-3 rounded-xl" aria-label="Drop Network home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm shadow-rose-900/20">
              <Droplet className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-slate-950">
              Drop<span className="text-primary">.</span>
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {navigation.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end} className={desktopLink}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            {user ? (
              <>
                <Link
                  to="/request/new"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-white shadow-sm shadow-rose-900/20 transition-colors hover:bg-primary-dark"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Post a request
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
                  className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-extrabold text-white shadow-sm shadow-rose-900/20 transition-colors hover:bg-primary-dark"
                >
                  Join as a donor
                </Link>
              </>
            )}
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
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
          <div id="mobile-navigation" className="border-t border-slate-100 bg-white px-4 pb-5 pt-3 shadow-lg lg:hidden">
            <nav className="mx-auto grid max-w-7xl gap-1" aria-label="Mobile navigation">
              {navigation.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end} className={mobileLink}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mx-auto mt-3 grid max-w-7xl gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
              {user ? (
                <>
                  <Link
                    to="/request/new"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-white"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Post a request
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
          </div>
        )}
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
