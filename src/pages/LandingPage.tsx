import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  HeartHandshake,
  LockKeyhole,
  Search,
  ShieldCheck,
  Users
} from 'lucide-react';
import SearchCriteriaForm, { type Criteria } from '../components/search/SearchCriteriaForm';
import { api } from '../lib/api';
import { DONATION_INTERVAL_DAYS } from '../lib/blood';
import {
  readSearchDraft,
  writeSearchDraft,
  type RequesterRole,
  type SearchDraft
} from '../lib/searchDraft';

type NetworkStats = {
  donors: number | null;
  available_donors: number;
  active_requests: number;
  fulfilled_requests: number;
};

const helpSteps = [
  {
    icon: Search,
    title: 'Search the right place',
    body: 'Choose the required blood group and collection area. No account is needed to search.'
  },
  {
    icon: LockKeyhole,
    title: 'Compare protected matches',
    body: 'Review availability and donation context while every phone number stays masked.'
  },
  {
    icon: HeartHandshake,
    title: 'Coordinate safely',
    body: 'Confirm the patient and facility before opening one contact through the recorded request flow.'
  }
];

export default function LandingPage({ user }: { user: any }) {
  const [draft, setDraft] = useState<SearchDraft>(() => readSearchDraft());
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getStats().then(setStats).catch(() => setStats(null));
  }, []);
  const criteria: Criteria = {
    blood_group: draft.blood_group,
    district: draft.district,
    upazila: draft.upazila,
    collection_facility: draft.collection_facility,
    collection_facility_code: draft.collection_facility_code,
    requester_role: draft.requester_role as RequesterRole | ''
  };

  const updateCriteria = (next: Criteria) => {
    const updated = { ...draft, ...next, request_id: undefined };
    setDraft(updated);
    writeSearchDraft(updated);
  };

  const search = () => {
    writeSearchDraft({ ...draft, request_id: undefined });
    const query = new URLSearchParams({
      blood_group: draft.blood_group,
      district: draft.district,
      upazila: draft.upazila
    });
    navigate(`/directory?${query.toString()}`);
  };

  return (
    <div className="landing-task-shell">
      <section className="landing-task-hero">
        <div className="landing-task-copy">
          <span className="landing-task-icon" aria-hidden="true"><HeartHandshake /></span>
          <h1>Find a blood donor</h1>
          <p>Search by blood group and collection area. Contact details remain protected.</p>
        </div>

        <div id="donor-search" className="landing-task-search scroll-mt-24">
          <SearchCriteriaForm
            value={criteria}
            onChange={updateCriteria}
            onSubmit={search}
            nextLabel="Continue"
            submitLabel="Search donors"
            compact
          />
        </div>
      </section>

      <section className="landing-network-strip" aria-label="Drop Network activity">
        {[
          { value: stats?.donors, label: 'Donors', icon: Users },
          { value: stats?.available_donors, label: 'Available', icon: CheckCircle2 },
          { value: stats?.active_requests, label: 'Active requests', icon: Activity },
          { value: stats?.fulfilled_requests, label: 'Fulfilled', icon: HeartHandshake }
        ].map(({ value, label, icon: Icon }) => (
          <div key={label}>
            <Icon aria-hidden="true" />
            <strong>{value?.toLocaleString() ?? '—'}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <nav className="landing-shortcuts" aria-label="Other actions">
        <Link to="/requests">
          <span><HeartHandshake aria-hidden="true" /></span>
          <strong>Blood requests</strong>
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link to={user ? '/profile/donor' : '/register'}>
          <span><ShieldCheck aria-hidden="true" /></span>
          <strong>{user ? 'Update donor profile' : 'Become a donor'}</strong>
          <ArrowRight aria-hidden="true" />
        </Link>
      </nav>

      <div className="landing-help-stack">
        <details className="landing-help-panel">
          <summary>
            <span>
              <strong>How contact and privacy work</strong>
              <small>Three steps, safety guidance, and urgent help</small>
            </span>
            <ChevronDown aria-hidden="true" />
          </summary>
          <div className="landing-help-content">
            <ol>
              {helpSteps.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <Icon aria-hidden="true" />
                  <span><strong>{title}</strong><small>{body}</small></span>
                </li>
              ))}
            </ol>
            <div className="landing-help-links">
              <Link to="/safety">Safety guidance</Link>
              <Link to="/privacy">How privacy works</Link>
              <Link to="/requests">See urgent requests</Link>
            </div>
          </div>
        </details>

        <details className="landing-help-panel">
          <summary>
            <span>
              <strong>Common donation questions</strong>
              <small>Eligibility, timing, public search, and matching</small>
            </span>
            <ChevronDown aria-hidden="true" />
          </summary>
          <div className="landing-faq-list">
            <p><strong>Who decides eligibility?</strong> Qualified staff at the hospital or collection facility make the final decision after screening.</p>
            <p><strong>Why a donation interval?</strong> Drop uses a conservative {DONATION_INTERVAL_DAYS}-day whole-blood interval; clinical policy always takes priority.</p>
            <p><strong>Can I search without an account?</strong> Yes. Search is public, while contact details remain masked until the protected request flow.</p>
            <p><strong>Is a listed donor guaranteed?</strong> No. Availability can change and every donor must pass the receiving facility’s checks.</p>
          </div>
        </details>
      </div>

      <p className="landing-clinical-note">Hospitals and blood banks remain responsible for screening and clinical decisions.</p>
    </div>
  );
}
