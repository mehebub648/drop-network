import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ArrowRight, Bell, CircleHelp, Droplet, FileText, Home, Info, LifeBuoy, LogOut, Menu, MessagesSquare, MoreHorizontal, Search, ShieldCheck, UserRound, UserRoundPlus, UsersRound, X } from 'lucide-react';
import Footer from './Footer';
import { api } from '../lib/api';

const primaryNavigation = [
  { label: 'Find donors', to: '/directory', icon: Search },
  { label: 'Blood requests', to: '/requests', icon: Droplet },
  { label: 'Community', to: '/community', icon: UsersRound },
  { label: 'About', to: '/about', icon: Info }
];

const secondaryNavigation = [
  { label: 'Overview', to: '/', icon: Home, end: true },
  { label: 'Add donors', to: '/contribute', icon: UserRoundPlus, end: false },
  { label: 'My device requests', to: '/device-requests', icon: FileText, end: false },
  { label: 'Donation safety', to: '/safety', icon: ShieldCheck, end: false },
  { label: 'Help & support', to: '/contact', icon: LifeBuoy, end: false },
  { label: 'Partners', to: '/partners', icon: MessagesSquare, end: false },
  { label: 'Administration', to: '/admin', icon: ShieldCheck, end: false }
];

const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Layout({ children, user, onLogout, otpBypassEnabled }: {
  children: ReactNode; user: any; onLogout: () => void; otpBypassEnabled: boolean;
}) {
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const mobilePanel = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const moreMenu = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const embedded = document.documentElement.dataset.dropAndroid === 'true';

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!user) { setUnread(0); return; }
      api.getNotifications().then(items => { if (active) setUnread(items.filter((item: { read_at?: string }) => !item.read_at).length); }).catch(() => undefined);
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('drop-notifications-changed', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); window.removeEventListener('drop-notifications-changed', refresh); };
  }, [user]);

  useEffect(() => { setMenuOpen(false); setMoreOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobilePanel.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        menuButton.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !mobilePanel.current) return;
      const focusable = Array.from(mobilePanel.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === mobilePanel.current)) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', trapFocus);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: Event) => {
      const target = event.target as Node;
      if (!moreMenu.current?.contains(target) && !moreButton.current?.contains(target)) setMoreOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMoreOpen(false); moreButton.current?.focus(); }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [moreOpen]);

  const logout = () => {
    setMenuOpen(false);
    setMoreOpen(false);
    onLogout();
  };

  return (
    <div className={`web-shell site-shell ${user ? 'web-shell-member site-shell-member' : ''} ${embedded ? 'web-shell-embedded site-shell-embedded' : ''}`}>
      <a href="#main-content" className="web-skip-link">Skip to main content</a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="site-brand" aria-label="drop. home">
            <span className="site-brand-mark"><Droplet fill="currentColor" aria-hidden="true" /></span>
            <span className="site-brand-copy"><strong>drop<span>.</span></strong><small>Every donor matters</small></span>
          </Link>
          <nav aria-label="Primary navigation" className="site-primary-navigation">
            {primaryNavigation.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} className="site-primary-link"><Icon aria-hidden="true" /><span>{label}</span></NavLink>)}
          </nav>
          <div className="site-header-actions">
            <div className="site-more">
              <button ref={moreButton} type="button" className="site-more-button" aria-expanded={moreOpen} aria-controls="site-more-menu" onClick={() => setMoreOpen(open => !open)}><MoreHorizontal aria-hidden="true" /><span>More</span></button>
              {moreOpen && <div ref={moreMenu} id="site-more-menu" className="site-more-menu">
                {secondaryNavigation.map(({ label, to, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className="site-more-link"><Icon aria-hidden="true" /><span>{label}</span></NavLink>)}
              </div>}
            </div>
            {user ? <div className="site-member-actions">
              <Link to="/profile/responses" className="site-icon-button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Bell aria-hidden="true" />{unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}</Link>
              <Link to="/profile" className="site-account-link"><span>{String(user.name || 'D').charAt(0).toUpperCase()}</span><b>My account</b></Link>
              <button type="button" className="site-icon-button" onClick={logout} aria-label="Log out"><LogOut aria-hidden="true" /></button>
            </div> : <div className="site-guest-actions"><Link to="/login" className="site-login-link">Log in</Link><Link to="/register" className="site-join-link">Join as a donor<ArrowRight aria-hidden="true" /></Link></div>}
            <button ref={menuButton} type="button" className="site-menu-toggle" aria-expanded={menuOpen} aria-controls="site-mobile-navigation" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
          </div>
        </div>
      </header>
      {menuOpen && <div className="site-mobile-menu-layer">
        <button type="button" className="site-mobile-backdrop" tabIndex={-1} aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />
        <div ref={mobilePanel} id="site-mobile-navigation" className="site-mobile-panel" role="dialog" aria-modal="true" aria-label="Site navigation" tabIndex={-1}>
          <div className="site-mobile-heading"><strong>Menu</strong><button type="button" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation menu"><X aria-hidden="true" /></button></div>
          <nav aria-label="Mobile navigation" className="site-mobile-navigation">
            <p>Explore</p><NavLink to="/" end><Home aria-hidden="true" />Overview</NavLink>
            {primaryNavigation.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to}><Icon aria-hidden="true" />{label}</NavLink>)}
            <p>More from drop.</p>
            {secondaryNavigation.filter(item => item.to !== '/').map(({ label, to, icon: Icon }) => <NavLink key={to} to={to}><Icon aria-hidden="true" />{label}</NavLink>)}
            {user && <><p>Your space</p><NavLink to="/profile"><UserRound aria-hidden="true" />My account</NavLink><NavLink to="/profile/responses"><Bell aria-hidden="true" />Notifications{unread > 0 ? ` (${unread > 99 ? '99+' : unread})` : ''}</NavLink><button type="button" onClick={logout}><LogOut aria-hidden="true" />Log out</button></>}
          </nav>
          {!user && <div className="site-mobile-auth"><Link to="/login">Log in</Link><Link to="/register">Join as a donor<ArrowRight aria-hidden="true" /></Link></div>}
          <div className="site-mobile-note"><CircleHelp aria-hidden="true" /><span>Need help? <Link to="/contact">Contact operations</Link></span></div>
        </div>
      </div>}
      <div className="web-workspace site-workspace">
        {otpBypassEnabled && <div role="alert" className="border-y border-amber-300 bg-amber-100 px-4 py-3 text-center text-sm font-bold text-amber-950">OTP bypass test mode is active. Phone ownership is not being verified.</div>}
        <main id="main-content" className="web-main site-main" tabIndex={-1}>{children}</main>
        {!embedded && <Footer compact />}
      </div>
    </div>
  );
}
