import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, CalendarDays, ChevronRight, Droplet, LockKeyhole, MapPin, Search, ShieldCheck, Users } from 'lucide-react';
import { api } from '../lib/api';
import { requestLocation } from '../lib/requestLocation';
import { readSearchDraft, writeSearchDraft } from '../lib/searchDraft';
import Doodle from '../components/Doodle';
import Select from '../components/Select';
import { BD_LOCATION_NAMES } from '../lib/locations';

type RecentRequest = { id: string; blood_group: string; units_required?: number; hospital_name?: string; upazila?: string; needed_by?: string; location?: { area_name?: string }; match_reasons?: string[] };
const groups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export default function LandingPage({ user }: { user: any }) {
  const [requests, setRequests] = useState<RecentRequest[] | null>(null);
  const [bloodGroup, setBloodGroup] = useState('');
  const [district, setDistrict] = useState('');
  const [searchError, setSearchError] = useState('');
  const groupRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const hasDonorProfile = Boolean(user?.donor_profile);
  const feedIsPersonal = Boolean(user?.id);
  const load = useCallback(() => {
    setError(false);
    setRequests(null);
    if (hasDonorProfile) {
      api.getDonorRequests().then(data => setRequests((data.items || []).slice(0, 2))).catch(() => setError(true));
      return;
    }
    if (feedIsPersonal) {
      setRequests([]);
      return;
    }
    api.getRequests({ limit: 2, sort: 'recent' }).then(data => setRequests(data.items || [])).catch(() => setError(true));
  }, [feedIsPersonal, hasDonorProfile]);
  useEffect(() => { load(); }, [load]);
  const search = (event: FormEvent) => {
    event.preventDefault();
    if (!bloodGroup) {
      setSearchError('Choose the blood group you need.');
      groupRef.current?.focus();
      return;
    }
    const draft = readSearchDraft();
    const locationChanged = draft.district !== district;
    writeSearchDraft({
      ...draft, blood_group: bloodGroup, district,
      ...(locationChanged ? { upazila: '', collection_facility: '', collection_facility_code: undefined } : {}),
      request_id: undefined
    });
    navigate(`/directory?${new URLSearchParams({ blood_group: bloodGroup, district })}`);
  };
  return <div className="home-dashboard home-kindred">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-intro">
        <Doodle kind="welcome" className="home-mascot" />
        <p className="home-eyebrow">A little kindness.</p>
        <h1 id="home-title"><span>A life-changing</span><span>connection.</span></h1>
        <p className="home-intro-copy">Find blood donors in your community.<br />Search freely. Contact details stay protected.</p>
        <div className="home-trust">
          <span><ShieldCheck aria-hidden="true" />Free for everyone</span>
          <span><Users aria-hidden="true" />Community powered</span>
          <span><LockKeyhole aria-hidden="true" />Contacts stay protected</span>
        </div>
      </div>

      <form className="home-search-card" aria-labelledby="home-search-title" onSubmit={search}>
        <div className="home-search-copy">
          <div><p className="home-search-kicker">Find donors</p><h2 id="home-search-title">Which blood group?</h2><p>Select a blood group and district to find donors near you.</p></div>
        </div>
        <div className="home-blood-groups" role="group" aria-label="Blood group needed">
          {groups.map((item, index) => <button ref={index === 0 ? groupRef : undefined} type="button" key={item} aria-label={`${item} blood group`} aria-pressed={bloodGroup === item} onClick={() => { setBloodGroup(item); setSearchError(''); }}><Droplet aria-hidden="true" fill="currentColor" strokeWidth={0} /><span>{item}</span></button>)}
        </div>
        <label className="home-district">District
          <Select value={district} onChange={event => setDistrict(event.target.value)} required aria-label="District" className="home-district-select">
            <option value="" disabled>Select your district</option>
            {BD_LOCATION_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
          </Select>
        </label>
        {searchError && <p className="home-search-error" role="alert">{searchError}</p>}
        <button className="button button-primary home-find-button" type="submit"><Search aria-hidden="true" />Find donors</button>
      </form>
    </section>

    <section aria-labelledby="recent-requests-title" className="home-recent">
      <div className="home-section-heading"><div><p className="home-eyebrow">Recent blood requests</p><h2 id="recent-requests-title">{hasDonorProfile ? 'Requests where you can help' : feedIsPersonal ? 'Helpful matches start with your details' : 'People in your community need help'}</h2>{hasDonorProfile && <p>Near you, with the same or a compatible blood group.</p>}</div><Link to={hasDonorProfile ? '/profile/donor-requests' : feedIsPersonal ? '/profile/donor' : '/requests'}>{hasDonorProfile ? 'Your matches' : feedIsPersonal ? 'Add donor details' : 'View all requests'} <ArrowRight aria-hidden="true" /></Link></div>
      {error && <p className="home-request-message" role="status">{hasDonorProfile ? 'Your matched requests are temporarily unavailable.' : 'Requests are temporarily unavailable.'} <button onClick={load}>Try again</button></p>}
      {requests === null ? !error && <div role="status" aria-label="Loading recent requests" className="home-request-list home-skeletons">{[0, 1].map(key => <div key={key} className="home-request home-skeleton" aria-hidden="true"><span /><div><i /><i /><i /></div></div>)}</div> : requests.length === 0 ? <p className="home-request-message">{hasDonorProfile ? 'No nearby compatible requests need you right now.' : user ? 'Add your donor details to see nearby compatible requests.' : 'No active requests right now.'}</p> : <div className="home-request-list">{requests.map(request => <Link className="home-request" key={request.id} to={`/request/${request.id}`}>
        <span className="home-request-group"><Droplet aria-hidden="true" fill="currentColor" strokeWidth={0} /><span>{request.blood_group}</span></span>
        <div className="home-request-copy">
          <div className="home-request-title"><h3>{request.hospital_name || `Need ${request.units_required || 1} ${(request.units_required || 1) === 1 ? 'unit' : 'units'} of blood`}</h3>{request.needed_by && <span className="home-request-urgency">{new Date(request.needed_by).getTime() - Date.now() < 86400000 ? 'Urgent' : 'Scheduled'}</span>}</div>
          {request.hospital_name && <p className="home-request-units">{request.units_required || 1} {(request.units_required || 1) === 1 ? 'unit' : 'units'} needed</p>}
          {hasDonorProfile && request.match_reasons && request.match_reasons.length > 0 && <div className="home-request-matches" aria-label="Why this request matches you">{request.match_reasons.slice(0, 2).map(reason => <span key={reason}>{reason}</span>)}</div>}
          <div className="home-request-meta"><span><MapPin aria-hidden="true" />{requestLocation(request)}</span>{request.needed_by && <span><CalendarDays aria-hidden="true" />{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(new Date(request.needed_by).getTime() - 1))}</span>}</div>
        </div><ChevronRight className="home-request-arrow" aria-hidden="true" />
      </Link>)}</div>}
    </section>
    <section className="home-join" aria-labelledby="home-join-title">
      <Doodle kind="welcome" className="home-join-mascot" />
      <div><p className="home-eyebrow">{hasDonorProfile ? 'Be there for your community' : 'Be a donor'}</p><h2 id="home-join-title">Join a kind community</h2></div>
      <p>Your donation can give someone new hope. Be there for your community.</p>
      <Link className="button button-primary" to={user ? '/profile/donor' : '/register'}>{user ? 'Your donor profile' : 'Join as a donor'}<ArrowRight aria-hidden="true" /></Link>
    </section>
  </div>;
}
