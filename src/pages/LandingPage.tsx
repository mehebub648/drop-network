import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  HeartHandshake,
  LockKeyhole,
  Search,
  ShieldCheck,
  Users
} from 'lucide-react';
import { api } from '../lib/api';
import { DONATION_INTERVAL_DAYS } from '../lib/blood';
import SearchCriteriaForm, { type Criteria } from '../components/search/SearchCriteriaForm';
import { MetricCard } from '../components/ui';
import BloodBagDoodle from '../components/BloodBagDoodle';
import {
  readSearchDraft,
  writeSearchDraft,
  type RequesterRole,
  type SearchDraft
} from '../lib/searchDraft';

type NetworkStats = {
  /** Registered donor profiles plus unclaimed directory listings; null if the directory is unreadable. */
  donors: number | null;
  directory_donors: number | null;
  registered_donors: number;
  available_donors: number;
  active_requests: number;
  fulfilled_requests: number;
};

const steps = [
  {
    icon: Search,
    title: 'Search the right place',
    body: 'Choose a blood group, district and upazila to see registered donors and attributed public listings. No account is needed to search.'
  },
  {
    icon: LockKeyhole,
    title: 'Compare useful matches',
    body: 'See registration, availability and donation context before choosing anyone. Every phone number stays masked.'
  },
  {
    icon: HeartHandshake,
    title: 'Open one contact safely',
    body: 'Confirm the patient details, sign in, and open one contact at a time. Each reveal is tied to the request and recorded.'
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
    requester_role: draft.requester_role as RequesterRole | ''
  };

  const updateCriteria = (next: Criteria) => {
    const updated = { ...draft, ...next, request_id: undefined };
    setDraft(updated);
    writeSearchDraft(updated);
  };

  const search = () => {
    const nextDraft = { ...draft, request_id: undefined };
    setDraft(nextDraft);
    writeSearchDraft(nextDraft);
    const query = new URLSearchParams({
      blood_group: draft.blood_group,
      district: draft.district,
      upazila: draft.upazila
    });
    navigate(`/directory?${query.toString()}`);
  };


  return (
    <div className="space-y-12 pb-8 sm:space-y-16 lg:space-y-20">
      <div className="space-y-6 sm:space-y-8">
        <section className="landing-hero px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-12 xl:px-12">
          <div className="landing-hero-layout relative">
            <div className="landing-hero-copy min-w-0">
              <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.65rem]">
                Find the right blood donor <span className="text-primary">when it matters most.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Search by blood group and collection area. Donor phone numbers stay private until you confirm a genuine request.
              </p>
            </div>

            <div id="donor-search" className="landing-hero-search w-full min-w-0 scroll-mt-28">
              <SearchCriteriaForm
                value={criteria}
                onChange={updateCriteria}
                onSubmit={search}
                nextLabel="Search"
                submitLabel="Search"
                compact
              />
            </div>

            <BloodBagDoodle className="landing-doodle w-full" />
          </div>
        </section>

        <section aria-label="Drop Network activity" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { value: stats?.donors, label: 'Donors', icon: Users, tone: 'brand' as const },
            { value: stats?.available_donors, label: 'Available now', icon: CheckCircle2, tone: 'success' as const },
            { value: stats?.active_requests, label: 'Active requests', icon: Activity, tone: 'warning' as const },
            { value: stats?.fulfilled_requests, label: 'Fulfilled requests', icon: HeartHandshake, tone: 'neutral' as const }
          ].map(({ value, label, icon, tone }) => (
            <MetricCard key={label} value={value?.toLocaleString() ?? '—'} label={label} icon={icon} tone={tone} />
          ))}
        </section>
      </div>

      <section className="landing-illustrated-section">
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.58fr)] md:gap-10">
          <div className="max-w-3xl md:text-left">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Simple and accountable</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">How Drop works</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Drop helps people find one another and protect contact details. The receiving hospital or blood bank
              remains responsible for screening, collection, and clinical decisions.
            </p>
          </div>
          <img
            src="/images/doodles/facility-doodle.webp"
            alt=""
            className="landing-section-doodle mx-auto h-auto w-full max-w-md"
            loading="lazy"
            decoding="async"
            aria-hidden="true"
          />
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <article key={title} className="theme-card cartoon-step-card p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-primary">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-sm font-extrabold text-primary">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="cartoon-panel cartoon-panel-accent overflow-hidden p-6 sm:p-9">
          <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_12rem]">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-2xl font-extrabold text-slate-950 sm:text-3xl">Contact privacy is part of the workflow.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-slate-600">
                Search shows only what you need to judge a possible match, with every number masked. A number opens
                one at a time, for a published request in that donor's own upazila, and only after you say how the
                last call went. Every reveal is recorded, and claiming an imported profile never makes that donor
                available automatically.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/privacy"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-white hover:bg-primary-dark"
                >
                  Review privacy
                </Link>
                <Link
                  to="/directory"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-rose-200 bg-white px-5 text-sm font-extrabold text-slate-800 hover:bg-rose-50"
                >
                  Search donors
                </Link>
              </div>
            </div>
            <img
              src="/images/doodles/privacy-doodle.webp"
              alt=""
              className="landing-privacy-doodle mx-auto hidden h-auto w-full max-w-[12rem] md:block"
              loading="lazy"
              decoding="async"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="cartoon-panel p-6 sm:p-9">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-2xl font-extrabold text-slate-950">Need blood urgently?</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Confirm the blood group and collection place with the treating facility, then search that
            upazila. Telling us who needs the blood is what opens donors' numbers and publishes your
            request in one step.
          </p>
          <Link
            to="/directory"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-extrabold text-white transition-colors hover:bg-red-800"
          >
            Search donors now
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section>
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Before donating</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Common questions</h2>
        </div>
        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          {[
            {
              q: 'Who decides whether I can donate?',
              a: 'Qualified staff at the hospital or collection facility make the final decision after reviewing your health, medicines, donation history, and required screening.'
            },
            {
              q: 'Why does Drop use a donation interval?',
              a: `Drop uses a configurable ${DONATION_INTERVAL_DAYS}-day whole-blood interval as a conservative matching safeguard. Clinical policy and the facility’s assessment always take priority.`
            },
            {
              q: 'Can I search without creating an account?',
              a: 'Yes. Searching by blood group, district and upazila is public, and every phone number in the results is masked. A number only opens once you tell us who needs the blood, which is also what publishes your request.'
            },
            {
              q: 'Does a listed donor guarantee a successful donation?',
              a: 'No. Availability can change and every potential donor must pass the receiving facility’s checks. Continue coordinating with the treating hospital or blood bank until the need is resolved.'
            }
          ].map(({ q, a }) => (
            <details key={q} className="theme-card group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-extrabold text-slate-900 transition-colors hover:text-primary sm:px-6">
                {q}
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="px-5 pb-5 text-sm leading-7 text-slate-600 sm:px-6">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cartoon-panel cartoon-cta overflow-hidden p-6 sm:p-9">
        <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_15rem] xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Keep the network useful</p>
            <h2 className="mt-3 text-2xl font-extrabold text-slate-950 sm:text-3xl">Ready to help the next genuine request?</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Create a donor profile, keep availability current, and respond only when you can safely reach the
              named clinical facility.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to={user ? '/profile/donor' : '/register'}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-extrabold text-white hover:bg-primary-dark"
              >
                {user ? 'Update availability' : 'Join as a donor'}
              </Link>
              <Link
                to="/requests"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
              >
                View live requests
              </Link>
            </div>
          </div>
          <img
            src="/images/doodles/community-doodle.webp"
            alt=""
            className="landing-community-doodle mx-auto h-auto w-full max-w-[18rem]"
            loading="lazy"
            decoding="async"
            aria-hidden="true"
          />
        </div>
      </section>
    </div>
  );
}
