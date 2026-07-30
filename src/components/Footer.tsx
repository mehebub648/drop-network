import { Link } from 'react-router-dom';
import { Droplet, HeartHandshake, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

const columns = [
  {
    title: 'Use Drop',
    links: [
      { label: 'Find live donors', to: '/directory' },
      { label: 'Live blood requests', to: '/requests' },
      { label: 'Post a request', to: '/request/new' },
      { label: 'Imported listings', to: '/directory/imported' }
    ]
  },
  {
    title: 'Community',
    links: [
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
    body: 'Every donation must be completed through an appropriate facility.'
  }
];

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-rose-950/10 bg-white text-slate-700">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-4 rounded-2xl border border-rose-100 bg-rose-50/60 p-5 sm:p-6 lg:grid-cols-3">
          {trustItems.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-rose-700 shadow-sm">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-extrabold text-slate-950">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-10 py-10 md:grid-cols-[1.3fr_2fr]">
          <div>
            <Link to="/" className="inline-flex min-h-11 items-center gap-3 rounded-xl" aria-label="Drop Network home">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Droplet className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <span className="text-xl font-extrabold tracking-tight text-slate-950">
                Drop<span className="text-primary">.</span>
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">
              A community blood-donor matching service helping people across Bangladesh find compatible,
              available donors and coordinate responsibly.
            </p>
            <p className="mt-4 max-w-md text-xs leading-5 text-slate-500">
              Drop is an independent coordination platform. It does not collect blood, provide medical care,
              or replace a hospital or licensed blood bank.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map(column => (
              <div key={column.title}>
                <h2 className="text-sm font-extrabold text-slate-950">{column.title}</h2>
                <ul className="mt-4 space-y-1">
                  {column.links.map(link => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="inline-flex min-h-11 items-center text-sm font-medium text-slate-600 transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Drop Network. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/safety" className="inline-flex min-h-11 items-center gap-1.5 hover:text-slate-800">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Safety first
            </Link>
            <Link to="/contact" className="inline-flex min-h-11 items-center gap-1.5 hover:text-slate-800">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              Contact operations
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
