import { Link } from 'react-router-dom';
import { Activity, Droplet, HeartHandshake, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

const columns = [
  {
    title: 'Use Drop',
    links: [
      { label: 'Find live donors', to: '/directory' },
      { label: 'Live blood requests', to: '/requests' },
      { label: 'Find blood', to: '/directory' }
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
    <footer className="site-footer relative mt-14">
      <div className="site-footer-inner mx-auto px-4 py-9 sm:px-6 sm:py-11">
        <div className="footer-trust-grid grid overflow-hidden lg:grid-cols-3">
          {trustItems.map(({ icon: Icon, title, body }, index) => (
            <div key={title} className={`footer-trust-item flex gap-4 p-5 sm:p-6 ${index ? 'lg:border-l' : ''}`}>
              <span className="cartoon-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-extrabold text-slate-950">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-10 py-10 md:grid-cols-[1.1fr_2fr] lg:gap-14">
          <div className="footer-story">
            <Link to="/" className="inline-flex min-h-11 items-center gap-3 rounded-xl" aria-label="Drop Network home">
              <span className="footer-logo relative flex h-11 w-11 items-center justify-center rounded-2xl bg-primary">
                <Droplet className="relative h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <span className="text-xl font-extrabold tracking-tight text-slate-950">Drop<span className="text-primary">.</span></span>
            </Link>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">
              A community blood-donor matching service helping people across Bangladesh find compatible,
              available donors and coordinate responsibly.
            </p>
            <div className="footer-note mt-5 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-slate-700">
              <Activity className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Coordination, not clinical care
            </div>
            <p className="mt-4 max-w-md text-xs leading-5 text-slate-500">
              Drop does not collect blood, provide medical care, or replace a hospital or licensed blood bank.
            </p>
            <img
              src="/images/doodles/facility-doodle.webp"
              alt=""
              className="footer-doodle mt-5 h-auto w-full max-w-sm"
              loading="lazy"
              decoding="async"
              aria-hidden="true"
            />
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map(column => (
              <div key={column.title}>
                <h2 className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-950">{column.title}</h2>
                <ul className="mt-4 space-y-1">
                  {column.links.map(link => (
                    <li key={`${link.to}:${link.label}`}>
                      <Link to={link.to} className="inline-flex min-h-10 items-center text-sm font-semibold text-slate-600 transition-colors hover:text-primary">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="footer-bottom flex flex-col gap-3 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Drop Network. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/safety" className="inline-flex min-h-10 items-center gap-1.5 hover:text-primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Safety first
            </Link>
            <Link to="/contact" className="inline-flex min-h-10 items-center gap-1.5 hover:text-primary">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Contact operations
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
