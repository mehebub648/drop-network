import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { BookOpen, CalendarDays, ChevronRight, Droplet, FileText, LifeBuoy, MapPin, Search, Users } from 'lucide-react';
import { api } from '../lib/api';
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
    <section className="home-search-card" aria-labelledby="home-search-title">
      <div className="home-search-copy">
        <div><p className="home-eyebrow">Need blood?</p><h1 id="home-search-title">Which blood group<br />do you need?</h1><p>Select a blood group to find available donors near you.</p></div>
        <Droplet className="home-drop" aria-hidden="true" fill="currentColor" />
      </div>
      <div className="home-blood-groups" role="group" aria-label="Blood group needed">
        {groups.map(item => <button type="button" key={item} aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>)}
      </div>
      <button className="home-find" onClick={search}><Search aria-hidden="true" />Find {group} Donors</button>
    </section>
    <Link className="home-become-donor" to={user ? '/profile/donor' : '/register'}><Users aria-hidden="true" />Become a Donor<ChevronRight aria-hidden="true" /></Link>
    <section aria-labelledby="recent-requests-title" className="home-recent">
      <div className="home-section-heading"><h2 id="recent-requests-title">Recent Requests</h2><Link to="/requests">View All <ChevronRight aria-hidden="true" /></Link></div>
      {error ? <p role="status">Requests are temporarily unavailable. <button className="text-primary underline" onClick={load}>Try again</button></p> : requests === null ? <p role="status">Loading recent requests…</p> : requests.length === 0 ? <p>No active requests right now.</p> : requests.map(request => <Link className="home-request" key={request.id} to={`/request/${request.id}`}>
        <span className="home-request-group">{request.blood_group}</span>
        <div><h3>Need {request.units_required || 1} {(request.units_required || 1) === 1 ? 'unit' : 'units'} of blood</h3>
          {request.needed_by && <span className="home-request-urgency">{new Date(request.needed_by).getTime() - Date.now() < 86400000 ? 'Urgent' : 'Scheduled'}</span>}
          <p><MapPin aria-hidden="true" />{[request.hospital_name, request.location?.area_name || request.upazila].filter(Boolean).join(', ') || 'Location shared in request'}</p>
          {request.needed_by && <p><CalendarDays aria-hidden="true" />{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(new Date(request.needed_by).getTime() - 1))}</p>}
        </div><ChevronRight aria-hidden="true" />
      </Link>)}
    </section>
    <nav className="home-actions home-docs" aria-label="Helpful information">
      {[{ to: '/safety', icon: BookOpen, label: 'Blood Facts' }, { to: '/contact', icon: LifeBuoy, label: 'Help & Support' }, { to: '/privacy', icon: FileText, label: 'Privacy' }].map(({ to, icon: Icon, label }) => <Link key={label} to={to}><span><Icon aria-hidden="true" /></span><strong>{label}</strong></Link>)}
    </nav>
  </div>;
}
