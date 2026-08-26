import { BellRing, Clock3, FileClock, HeartPulse, KeyRound, Settings, ShieldCheck, Siren, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
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
      { to: '/profile/invitations', label: 'Invitations', icon: BellRing },
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

export default function ProfileLayout({ user }: { user: ProfileUser }) {
  const initials = user.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const donorStatus = user.donor_profile?.availability_status;
  const statusLabel = donorStatus === 'AVAILABLE'
    ? 'Available to donate'
    : donorStatus === 'SICK'
      ? 'Sick or recovering'
      : donorStatus === 'TRAVELING'
        ? 'Traveling'
        : 'Not available';

  return (
    <div className="profile-shell">
      <header className="profile-overview">
        <div className="profile-overview-pattern" aria-hidden="true" />
        <div className="profile-avatar">
          {initials}
        </div>
        <div className="profile-identity">
          <p>Member profile</p>
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
          <p><strong>You control what is shared.</strong> Private health and account details never appear in donor search.</p>
        </div>
      </header>

      <div className="profile-workspace">
        <aside className="profile-rail">
          <nav aria-label="Profile">
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
        </aside>
        <section className="profile-page-content">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
