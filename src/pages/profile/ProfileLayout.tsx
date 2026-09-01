import { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, ChevronDown, Clock3, FileClock, HeartPulse, KeyRound, Settings, ShieldAlert, ShieldCheck, Siren, UserRound, X } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router';
import VerifiedBadge from '../../components/VerifiedBadge';
import { cn } from '../../lib/utils';
import type { ProfileUser } from './types';

const groups = [
  {
    label: 'Your profile',
    items: [
      { to: '/profile/account', label: 'Account', icon: UserRound },
      { to: '/profile/donor', label: 'Donor profile', icon: HeartPulse }
    ]
  },
  {
    label: 'Activity',
    items: [
      { to: '/profile/donor-requests', label: 'Requests near you', icon: Siren },
      { to: '/profile/requests', label: 'My requests', icon: Clock3 },
      { to: '/profile/responses', label: 'Responses & follow-ups', icon: BellRing },
      { to: '/profile/contact-reports', label: 'Contact reports', icon: ShieldAlert },
      { to: '/profile/history', label: 'Donation history', icon: FileClock }
    ]
  },
  {
    label: 'Preferences',
    items: [
      { to: '/profile/security', label: 'Security', icon: KeyRound },
      { to: '/profile/settings', label: 'Settings', icon: Settings }
    ]
  }
];

function ProfileNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Account sections">
      {groups.map(group => (
        <div key={group.label} className="profile-nav-group">
          <p>{group.label}</p>
          <div>
            {group.items.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) => cn('profile-nav-link', isActive && 'is-active')}
                >
                  <span><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function ProfileLayout({ user }: { user: ProfileUser }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const allItems = useMemo(() => groups.flatMap(group => group.items), []);
  const activeItem = allItems.find(item => item.to === pathname) || allItems[0];
  const initials = user.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const donorStatus = user.donor_profile?.availability_status;
  const statusLabel = donorStatus === 'AVAILABLE'
    ? 'Available to donate'
    : donorStatus === 'SICK'
      ? 'Sick or recovering'
      : donorStatus === 'TRAVELING'
        ? 'Traveling'
        : 'Not available';

  useEffect(() => setMobileNavOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileNavOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', close);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  return (
    <div className="profile-shell">
      <header className="profile-overview">
        <div className="profile-overview-pattern" aria-hidden="true" />
        <div className="profile-avatar">{initials}</div>
        <div className="profile-identity">
          <div>
            <h1>{user.name}</h1>
            <VerifiedBadge verified={user.is_verified} />
          </div>
          <span>{user.phone}</span>
          <div className="profile-summary-chips">
            {user.donor_profile && <span>{user.donor_profile.blood_group}</span>}
            {user.donor_profile?.location?.area_name && <span>{user.donor_profile.location.area_name}</span>}
            <span className={cn('profile-availability-chip', donorStatus === 'AVAILABLE' && 'is-available')}>
              <i aria-hidden="true" /> {statusLabel}
            </span>
          </div>
        </div>
        <div className="profile-privacy-note">
          <span><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
          <p><strong>Private by default.</strong> Health and account details stay out of donor search.</p>
        </div>
      </header>

      <button
        ref={menuButtonRef}
        type="button"
        className="profile-mobile-section-button"
        onClick={() => setMobileNavOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={mobileNavOpen}
      >
        <span>Account section</span>
        <strong>{activeItem.label}</strong>
        <ChevronDown aria-hidden="true" />
      </button>

      <div className="profile-workspace">
        <aside className="profile-rail"><ProfileNav /></aside>
        <section className="profile-page-content"><Outlet /></section>
      </div>

      {mobileNavOpen && (
        <div className="profile-nav-dialog" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setMobileNavOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="profile-nav-title">
            <header>
              <h2 id="profile-nav-title">Account</h2>
              <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close account sections"><X aria-hidden="true" /></button>
            </header>
            <ProfileNav onNavigate={() => setMobileNavOpen(false)} />
          </section>
        </div>
      )}
    </div>
  );
}
