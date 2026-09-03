import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRight,
  ChevronDown,
  Database,
  HeartHandshake,
  LockKeyhole,
  Search,
  ShieldCheck
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
  directory_donors: number | null;
  registered_donors: number;
  available_donors: number;
  active_requests: number;
  fulfilled_requests: number;
};

const trustPromises = [
  {
    icon: Search,
    title: 'No account needed',
    body: 'Start a donor search without signing in.'
  },
  {
    icon: LockKeyhole,
    title: 'Protected contacts',
    body: 'Phone numbers stay masked until a verified request.'
  },
  {
    icon: ShieldCheck,
    title: 'Source clarity',
    body: 'Results identify Drop members and public-source listings.'
  }
];

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
      blood_group: draft.blood_group
    });
    navigate(`/directory?${query.toString()}`);
  };

  return (
    <div className="landing-task-shell">
      <section className="landing-task-hero">
        <div className="landing-task-copy">
          <span className="landing-task-icon" aria-hidden="true"><HeartHandshake /></span>
          <h1>Find a blood donor</h1>
          <p>Search by blood group, then choose where the patient will receive blood. No account is needed to begin.</p>
          <img
            className="landing-task-doodle"
            src="/images/doodles/facility-doodle.webp"
            alt=""
            width="640"
            height="640"
            aria-hidden="true"
          />
        </div>

        <div id="donor-search" className="landing-task-search scroll-mt-24">
          <SearchCriteriaForm
            value={criteria}
            onChange={updateCriteria}
            onSubmit={search}
            submitLabel="Continue to location"
            compact
            handoffAfterBloodGroup
          />
        </div>

        <ul className="landing-trust-row" aria-label="Why people can search with confidence">
          {trustPromises.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Icon aria-hidden="true" />
              <span><strong>{title}</strong><small>{body}</small></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-directory-proof" aria-labelledby="directory-proof-title">
        <span aria-hidden="true"><Database /></span>
        <div>
          <p>Transparent directory</p>
          <h2 id="directory-proof-title">{stats?.donors?.toLocaleString() ?? '—'} searchable donor listings</h2>
          <p>
            {stats && stats.directory_donors !== null
              ? `Includes ${stats.directory_donors.toLocaleString()} public-source listings and ${stats.registered_donors.toLocaleString()} registered Drop ${stats.registered_donors === 1 ? 'member' : 'members'}. `
              : 'Includes public-source listings and registered Drop members. '}
            Drop labels the source on each result; listing does not guarantee current availability.
          </p>
          <nav aria-label="Directory transparency">
            <Link to="/privacy">How listings work</Link>
            <Link to="/directory/remove">Remove my listing</Link>
            <Link to="/contact">Report an issue</Link>
          </nav>
        </div>
      </section>

      <nav className="landing-shortcuts" aria-label="Other actions">
        <Link to="/requests">
          <span><HeartHandshake aria-hidden="true" /></span>
          <strong>View blood requests</strong>
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

      <aside className="landing-clinical-note">
        <ShieldCheck aria-hidden="true" />
        <p><strong>Coordination, not clinical care.</strong> Hospitals and blood banks decide donor eligibility, compatibility, and whether a donation can proceed.</p>
      </aside>
    </div>
  );
}
