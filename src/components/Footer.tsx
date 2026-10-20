import { Link } from 'react-router';
import { Activity, ArrowRight, Droplet, Mail, ShieldCheck } from 'lucide-react';

const columns = [
  { title: 'Use drop.', links: [
    { label: 'Find donors', to: '/directory' }, { label: 'Blood requests', to: '/requests' },
    { label: 'Become a donor', to: '/register' }, { label: 'My device requests', to: '/device-requests' }
  ] },
  { title: 'Community', links: [
    { label: 'Stories and suggestions', to: '/community' }, { label: 'Add donors', to: '/contribute' },
    { label: 'Partners', to: '/partners' }, { label: 'How drop. works', to: '/about' }
  ] },
  { title: 'Safety & support', links: [
    { label: 'Donation safety', to: '/safety' }, { label: 'Contact operations', to: '/contact' },
    { label: 'Delete my account', to: '/delete-account' }, { label: 'Remove my listing', to: '/directory/remove' }
  ] },
  { title: 'Legal', links: [
    { label: 'Privacy policy', to: '/privacy' }, { label: 'Terms of use', to: '/terms' },
    { label: 'Administration', to: '/admin' }
  ] }
];

export default function Footer({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={`site-footer ${compact ? 'site-footer-compact' : ''}`}>
      <div className="site-footer-inner">
        <div className="site-footer-lead">
          <div>
            <Link to="/" className="site-footer-brand" aria-label="drop. home">
              <span><Droplet fill="currentColor" aria-hidden="true" /></span><strong>drop<i>.</i></strong>
            </Link>
            <p>A community-powered way to find blood donors and coordinate urgent requests responsibly across Bangladesh.</p>
            <small><Activity aria-hidden="true" /> Coordination, not clinical care</small>
          </div>
          <Link to="/register" className="site-footer-join">Join as a donor<ArrowRight aria-hidden="true" /></Link>
        </div>
        <div className="site-footer-links">
          {columns.map(column => <div key={column.title}>
            <h2>{column.title}</h2>
            <ul>{column.links.map(link => <li key={`${link.to}:${link.label}`}><Link to={link.to}>{link.label}</Link></li>)}</ul>
          </div>)}
        </div>
        <div className="site-footer-bottom">
          <p>© {new Date().getFullYear()} drop<span>.</span> Every donor matters.</p>
          <div><Link to="/safety"><ShieldCheck aria-hidden="true" />Safety first</Link><Link to="/contact"><Mail aria-hidden="true" />Contact operations</Link></div>
        </div>
      </div>
    </footer>
  );
}
