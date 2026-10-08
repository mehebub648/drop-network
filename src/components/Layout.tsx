import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ArrowUpRight, Bell, BookOpen, Droplet, FileText, Heart, Home, LifeBuoy, LogOut, Menu, MessagesSquare, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import Footer from './Footer';
import { api } from '../lib/api';

const navigation = [
  { label: 'Overview', to: '/', icon: Home, end: true },
  { label: 'Find donors', to: '/directory', icon: Search },
  { label: 'Blood requests', to: '/requests', icon: Droplet },
  { label: 'Community', to: '/community', icon: MessagesSquare },
  { label: 'My device requests', to: '/device-requests', icon: FileText }
];
const resources = [
  { label: 'How Drop works', to: '/about', icon: BookOpen },
  { label: 'Donation safety', to: '/safety', icon: ShieldCheck },
  { label: 'Help & support', to: '/contact', icon: LifeBuoy }
];

export default function Layout({ children, user, onLogout, otpBypassEnabled }: {
  children: ReactNode; user: any; onLogout: () => void; otpBypassEnabled: boolean;
}) {
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const embedded = document.documentElement.dataset.dropAndroid === 'true';
  const isStaff = Boolean(user?.staff_role || user?.roles?.some((role: string) => ['ADMIN', 'MODERATOR', 'SUPPORT', 'VERIFIER'].includes(role)));
  const section = pathname.startsWith('/admin') ? 'Administration' : pathname.startsWith('/profile') ? 'My account' : navigation.find(item => item.end ? pathname === item.to : pathname.startsWith(item.to))?.label || resources.find(item => pathname === item.to)?.label || ({ '/login': 'Sign in', '/register': 'Create account', '/forgot-password': 'Account recovery', '/privacy': 'Privacy', '/terms': 'Terms', '/partners': 'Partners' } as Record<string, string>)[pathname] || (pathname.startsWith('/request/') ? 'Blood request' : 'Drop Network');

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
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [menuOpen]);

  return (
    <div className={`web-shell ${user ? 'web-shell-member' : ''} ${embedded ? 'web-shell-embedded' : ''}`}>
      <a href="#main-content" className="web-skip-link">Skip to main content</a>
      <aside id="website-navigation" className={`web-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <Link to="/" className="web-brand" aria-label="Drop Network home">
          <span className="web-brand-mark"><Droplet fill="currentColor" aria-hidden="true" /></span>
          <span>drop<span className="web-brand-dot">.</span><small>Every donor matters</small></span>
        </Link>
        <nav aria-label="Primary navigation" className="web-navigation">
          <p className="web-nav-label">Discover</p>
          {navigation.map(({ label, to, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className="web-nav-link"><Icon aria-hidden="true" /><span>{label}</span></NavLink>)}
          {user && <><p className="web-nav-label">Your space</p><NavLink to="/profile" className="web-nav-link"><UserRound aria-hidden="true" /><span>My account</span></NavLink></>}
          {isStaff && <NavLink to="/admin" className="web-nav-link"><ShieldCheck aria-hidden="true" /><span>Administration</span></NavLink>}
          <p className="web-nav-label">Resources</p>
          {resources.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} className="web-nav-link"><Icon aria-hidden="true" /><span>{label}</span></NavLink>)}
        </nav>
        <div className="web-sidebar-bottom">
          <div className="web-donor-invite"><Heart aria-hidden="true" /><strong>A little of you.<br />A lot more life.</strong><p>Be there when someone needs a donor.</p><Link to={user ? '/profile/donor' : '/register'}>{user ? 'Your donor profile' : 'Become a donor'}<ArrowUpRight aria-hidden="true" /></Link></div>
          <p className="web-location">Community powered · Bangladesh</p>
        </div>
      </aside>
      <div className="web-workspace">
        <header className="web-topbar">
          <button ref={menuButton} type="button" className="web-menu-toggle" aria-expanded={menuOpen} aria-controls="website-navigation" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X /> : <Menu />}</button>
          <div className="web-breadcrumb"><span>Drop Network</span><span aria-hidden="true">/</span><strong>{section}</strong></div>
          <div className="web-topbar-actions">
            {user ? <>
              <Link to="/profile/responses" className="web-icon-button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Bell aria-hidden="true" />{unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}</Link>
              <Link to="/profile" className="web-account-link"><span>{String(user.name || 'D').charAt(0).toUpperCase()}</span>My account</Link>
              <button type="button" className="web-icon-button" onClick={onLogout} aria-label="Log out"><LogOut aria-hidden="true" /></button>
            </> : <><Link to="/login" className="web-login-link">Log in</Link><Link to="/register" className="button button-primary">Join as a donor<ArrowUpRight size={16} aria-hidden="true" /></Link></>}
          </div>
        </header>
        {otpBypassEnabled && <div role="alert" className="border-y border-amber-300 bg-amber-100 px-4 py-3 text-center text-sm font-bold text-amber-950">OTP bypass test mode is active. Phone ownership is not being verified.</div>}
        <main id="main-content" className="web-main" tabIndex={-1}>{children}</main>
        {!embedded && <Footer compact />}
      </div>
    </div>
  );
}
