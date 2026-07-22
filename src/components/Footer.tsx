import { Link } from 'react-router-dom';
import { Droplet, Mail, ShieldCheck } from 'lucide-react';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Find Blood', to: '/' },
      { label: 'Live Requests', to: '/requests' },
      { label: 'Become a Donor', to: '/register' }
    ]
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Verified Partners', to: '/partners' }
    ]
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Use', to: '/terms' },
      { label: 'Safety', to: '/safety' }
    ]
  }
];

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.5fr_2fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-3 text-white">
              <span className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Droplet className="w-6 h-6" />
              </span>
              <span className="text-2xl font-bold tracking-tight">Drop<span className="text-primary">.</span></span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
              A community blood-donor matching service helping people in Bangladesh find nearby, compatible donors.
            </p>
            <p className="mt-4 text-xs leading-5 text-amber-200/90">
              {'<TODO: Add the operating organization legal name, postal address, and official social links.>'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map(column => (
              <div key={column.title}>
                <h2 className="text-sm font-bold text-white">{column.title}</h2>
                <ul className="mt-4 space-y-3">
                  {column.links.map(link => (
                    <li key={link.to}>
                      <Link to={link.to} className="text-sm text-slate-400 hover:text-white transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Drop Network. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/safety" className="hover:text-slate-300 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Safety first</Link>
            <Link to="/contact" className="hover:text-slate-300 inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Contact operations</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
