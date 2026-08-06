import { BellRing, Clock3, FileClock, HeartPulse, KeyRound, Settings, ShieldCheck, Siren, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import VerifiedBadge from '../../components/VerifiedBadge';
import { cn } from '../../lib/utils';
import type { ProfileUser } from './types';

const items = [
  { to: '/profile/account', label: 'Account', icon: UserRound },
  { to: '/profile/donor', label: 'Donor profile', icon: HeartPulse },
  { to: '/profile/donor-requests', label: 'Requests near you', icon: Siren },
  { to: '/profile/requests', label: 'My requests', icon: Clock3 },
  { to: '/profile/invitations', label: 'Invitations', icon: BellRing },
  { to: '/profile/history', label: 'Donation history', icon: FileClock },
  { to: '/profile/security', label: 'Security', icon: KeyRound },
  { to: '/profile/settings', label: 'Settings', icon: Settings }
];

export default function ProfileLayout({ user }: { user: ProfileUser }) {
  const initials = user.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="page-hero flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="page-hero-grid" aria-hidden="true" />
        <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-rose-200 bg-white text-xl font-extrabold text-primary shadow-sm">
          {initials}
        </div>
        <div className="relative z-10 flex-1">
          <p className="eyebrow">Member workspace</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] text-slate-950 sm:text-3xl">{user.name}</h1>
            <VerifiedBadge verified={user.is_verified} />
          </div>
          <p className="mt-1 font-medium text-slate-500">{user.phone}</p>
        </div>
        <div className="relative z-10 hidden items-center gap-3 rounded-2xl border border-white bg-white/75 p-4 text-sm font-semibold text-slate-600 shadow-sm md:flex">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
          <span>Privacy and availability<br />stay under your control.</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[250px_1fr] lg:gap-8">
        <nav className="surface h-fit overflow-x-auto p-2 sm:p-3 lg:sticky lg:top-28" aria-label="Profile">
          <div className="flex min-w-max gap-1 lg:flex-col">
            {items.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => cn(
                    'flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors',
                    isActive ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-rose-50 hover:text-rose-950'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
