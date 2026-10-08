import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, BookOpen, CalendarDays, ChevronRight, Droplet, FileText, LifeBuoy, MapPin, Search, ShieldCheck, Users } from 'lucide-react';
import { api } from '../lib/api';
import { requestLocation } from '../lib/requestLocation';
import { readSearchDraft, writeSearchDraft } from '../lib/searchDraft';

type RecentRequest = { id: string; blood_group: string; units_required?: number; hospital_name?: string; upazila?: string; needed_by?: string; location?: { area_name?: string } };
const groups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export default function LandingPage({ user }: { user: any }) {
  const [group, setGroup] = useState('B+');
  const [requests, setRequests] = useState<RecentRequest[] | null>(null);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const load = () => {
    setError(false);
    api.getRequests({ limit: 2, sort: 'recent' }).then(data => setRequests(data.items || [])).catch(() => setError(true));
  };
  useEffect(load, []);
  const search = () => {
    writeSearchDraft({ ...readSearchDraft(), blood_group: group, request_id: undefined });
    navigate(`/directory?${new URLSearchParams({ blood_group: group })}`);
  };
  return <div className="home-dashboard">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-intro">
        <p className="home-eyebrow">Community donor network</p>
        <h1 id="home-title">Find the right blood donor, with less friction.</h1>
        <p className="home-intro-copy">Search verified and public-source donor listings across Bangladesh. Contact details stay protected until you create a blood request.</p>
        <div className="home-confidence"><ShieldCheck aria-hidden="true" /><span><strong>Private by default.</strong> Search first. Sign in only when you need to contact a donor.</span></div>
        <div className="home-intro-links">
          <Link to="/about">How Drop works <ArrowRight aria-hidden="true" /></Link>
          <Link to="/safety">Donation safety</Link>
        </div>
      </div>

      <div className="home-search-card" aria-labelledby="home-search-title">
        <div className="home-search-copy">
          <span className="home-search-icon" aria-hidden="true"><Droplet fill="currentColor" /></span>
          <div><p className="home-search-kicker">Start a donor search</p><h2 id="home-search-title">Which blood group do you need?</h2><p>Choose a group now. You can add the district and upazila on the next step.</p></div>
        </div>
        <div className="home-blood-groups" role="group" aria-label="Blood group needed">
          {groups.map(item => <button type="button" key={item} aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>)}
        </div>
        <button className="home-find" onClick={search}><Search aria-hidden="true" />Find {group} donors</button>
      </div>
    </section>

    <nav className="home-actions" aria-label="Quick actions">
      {[{ to: '/directory', icon: FileText, label: 'Create a blood request', note: 'Search and coordinate safely' }, { to: user ? '/profile/donor-requests' : '/register', icon: Users, label: user ? 'Donation opportunities' : 'Become a donor', note: user ? 'See requests near you' : 'Join the donor network' }, { to: '/safety', icon: BookOpen, label: 'Blood donation guide', note: 'Prepare and donate safely' }, { to: '/contact', icon: LifeBuoy, label: 'Get help', note: 'Contact Drop operations' }].map(({ to, icon: Icon, label, note }) => <Link key={label} to={to}><span><Icon aria-hidden="true" /></span><span className="home-action-copy"><strong>{label}</strong><small>{note}</small></span><ChevronRight aria-hidden="true" /></Link>)}
    </nav>

    <section aria-labelledby="recent-requests-title" className="home-recent">
      <div className="home-section-heading"><div><p className="home-eyebrow">Live coordination</p><h2 id="recent-requests-title">Recent blood requests</h2><p>Public details only. Patient contact information remains protected.</p></div><Link to="/requests">View all requests <ArrowRight aria-hidden="true" /></Link></div>
      {error && <p className="home-request-message" role="status">Requests are temporarily unavailable. <button onClick={load}>Try again</button></p>}
      {requests === null ? !error && <div role="status" aria-label="Loading recent requests" className="home-request-list home-skeletons">{[0, 1].map(key => <div key={key} className="home-request home-skeleton" aria-hidden="true"><span /><div><i /><i /><i /></div></div>)}</div> : requests.length === 0 ? <p className="home-request-message">No active requests right now.</p> : <div className="home-request-list">{requests.map(request => <Link className="home-request" key={request.id} to={`/request/${request.id}`}>
        <span className="home-request-group">{request.blood_group}</span>
        <div className="home-request-copy">
          <div className="home-request-title"><h3>{request.hospital_name || `Need ${request.units_required || 1} ${(request.units_required || 1) === 1 ? 'unit' : 'units'} of blood`}</h3>{request.needed_by && <span className="home-request-urgency">{new Date(request.needed_by).getTime() - Date.now() < 86400000 ? 'Urgent' : 'Scheduled'}</span>}</div>
          {request.hospital_name && <p className="home-request-units">{request.units_required || 1} {(request.units_required || 1) === 1 ? 'unit' : 'units'} needed</p>}
          <div className="home-request-meta"><span><MapPin aria-hidden="true" />{requestLocation(request)}</span>{request.needed_by && <span><CalendarDays aria-hidden="true" />{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(new Date(request.needed_by).getTime() - 1))}</span>}</div>
        </div><ChevronRight className="home-request-arrow" aria-hidden="true" />
      </Link>)}</div>}
    </section>
  </div>;
}
