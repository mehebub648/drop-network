import { Clock3, FileClock, HeartPulse, KeyRound, Settings, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import VerifiedBadge from '../../components/VerifiedBadge';
import { cn } from '../../lib/utils';
import type { ProfileUser } from './types';

const items = [
  { to: '/profile/account', label: 'Account', icon: UserRound },
  { to: '/profile/donor', label: 'Donor profile', icon: HeartPulse },
  { to: '/profile/requests', label: 'My requests', icon: Clock3 },
  { to: '/profile/history', label: 'Donation history', icon: FileClock },
  { to: '/profile/security', label: 'Security', icon: KeyRound },
  { to: '/profile/settings', label: 'Settings', icon: Settings }
];

export default function ProfileLayout({ user }: { user: ProfileUser }) {
  const initials = user.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="space-y-7">
      <div className="theme-card border border-slate-100 p-6 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-primary flex items-center justify-center text-xl font-extrabold border border-rose-100">
          {initials}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold tracking-tight">{user.name}</h1>
            <VerifiedBadge verified={user.is_verified} />
          </div>
          <p className="text-slate-500 font-medium mt-1">{user.phone}</p>
        </div>
      </div>

      <div className="grid gap-7 lg:grid-cols-[220px_1fr]">
        <nav className="theme-card border border-slate-100 p-3 h-fit overflow-x-auto" aria-label="Profile">
          <div className="flex lg:flex-col gap-1 min-w-max">
            {items.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors',
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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
