import { Link } from 'react-router-dom';
import { Activity, Droplet, HeartHandshake, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

const columns = [
  {
    title: 'Use Drop',
    links: [
      { label: 'Find live donors', to: '/directory' },
      { label: 'Live blood requests', to: '/requests' },
      { label: 'Find blood', to: '/directory' },
      { label: 'Imported listings', to: '/directory/imported' }
    ]
  },
  {
    title: 'Community',
    links: [
      { label: 'Stories and suggestions', to: '/community' },
      { label: 'Join as a donor', to: '/register' },
      { label: 'Verified partners', to: '/partners' },
      { label: 'About Drop', to: '/about' },
      { label: 'Safety guidance', to: '/safety' }
    ]
  },
  {
    title: 'Support & legal',
    links: [
      { label: 'Contact operations', to: '/contact' },
      { label: 'Privacy policy', to: '/privacy' },
      { label: 'Terms of use', to: '/terms' }
    ]
  }
];

const trustItems = [
  {
    icon: LockKeyhole,
    title: 'Private by default',
    body: 'Phone numbers stay out of public search results.'
  },
  {
    icon: ShieldCheck,
    title: 'Verified coordination',
    body: 'Accounts and request workflows add accountability.'
  },
  {
    icon: HeartHandshake,
    title: 'Clinical care comes first',
    body: 'Every donation must happen through an appropriate facility.'
  }
];

export default function Footer() {
  return (
    <footer className="relative mt-16 border-t border-slate-800 bg-slate-950 text-slate-300">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" aria-hidden="true" />
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] lg:grid-cols-3">
          {trustItems.map(({ icon: Icon, title, body }, index) => (
            <div key={title} className={`flex gap-4 p-5 sm:p-6 ${index ? 'border-t border-white/10 lg:border-l lg:border-t-0' : ''}`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-300/15">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-extrabold text-white">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-10 py-11 md:grid-cols-[1.15fr_2fr] lg:gap-16">
          <div>
            <Link to="/" className="inline-flex min-h-11 items-center gap-3 rounded-xl" aria-label="Drop Network home">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-rose-950/30">
                <span className="absolute inset-1 rounded-xl border border-white/20" aria-hidden="true" />
                <Droplet className="relative h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <span className="text-xl font-extrabold tracking-tight text-white">Drop<span className="text-rose-400">.</span></span>
            </Link>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
              A community blood-donor matching service helping people across Bangladesh find compatible,
              available donors and coordinate responsibly.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300">
              <Activity className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
              Coordination, not clinical care
            </div>
            <p className="mt-4 max-w-md text-xs leading-5 text-slate-500">
              Drop does not collect blood, provide medical care, or replace a hospital or licensed blood bank.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map(column => (
              <div key={column.title}>
                <h2 className="text-xs font-extrabold uppercase tracking-[0.15em] text-white">{column.title}</h2>
                <ul className="mt-4 space-y-1">
                  {column.links.map(link => (
                    <li key={`${link.to}:${link.label}`}>
                      <Link to={link.to} className="inline-flex min-h-10 items-center text-sm font-medium text-slate-400 transition-colors hover:text-rose-300">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Drop Network. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/safety" className="inline-flex min-h-10 items-center gap-1.5 hover:text-slate-200">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Safety first
            </Link>
            <Link to="/contact" className="inline-flex min-h-10 items-center gap-1.5 hover:text-slate-200">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Contact operations
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
