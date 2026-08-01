import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Sparkles,
  Users
} from 'lucide-react';
import { api } from '../lib/api';
import { DONATION_INTERVAL_DAYS } from '../lib/blood';
import SearchCriteriaForm, { type Criteria } from '../components/search/SearchCriteriaForm';
import SearchJourneySteps from '../components/search/SearchJourneySteps';
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
    body: 'Choose a blood group, district and upazila to see registered donors and attributed public listings. No account is needed to browse.'
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
      <section className="relative overflow-hidden rounded-[2rem] border border-rose-100 bg-[linear-gradient(135deg,#ffffff_0%,#fffafa_48%,#fff1f2_100%)] px-5 py-7 shadow-[0_28px_80px_-52px_rgba(136,19,55,0.55)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-rose-200/45 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-64 w-64 rounded-full bg-amber-100/45 blur-3xl" />

        <div className="relative grid items-center gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10 xl:gap-14">
          <div>
            <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-rose-200 bg-white/85 px-4 text-[11px] font-extrabold uppercase tracking-[0.14em] text-rose-800 shadow-sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              One connected search
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.07] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[3.35rem] xl:text-6xl">
              Find the right blood donor, without losing your place.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Start here, compare private matches on the directory, then continue to a protected contact.
              Your search details move with you through every step.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="#donor-search"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/15 transition-colors hover:bg-primary-dark"
              >
                Start your search
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link
                to="/requests"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-extrabold text-slate-800 transition-colors hover:border-emerald-200 hover:bg-emerald-50"
              >
                See open requests
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-600">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Public search
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Opted-in donors
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Private phone numbers
              </span>
            </div>
          </div>

          <div id="donor-search" className="scroll-mt-28 rounded-[1.75rem] border border-white/80 bg-white/55 p-2.5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] backdrop-blur sm:p-3">
            <SearchJourneySteps activeStep={1} />
            <div className="mt-3">
              <SearchCriteriaForm
                value={criteria}
                onChange={updateCriteria}
                onSubmit={search}
                submitLabel="Continue to donor matches"
              />
            </div>
            <p className="mt-3 flex items-start gap-2 px-1 text-xs leading-5 text-slate-500">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              You can compare matches without signing in. A phone number opens only after the protected
              request step.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Drop Network activity" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { value: stats?.donors, label: 'Donors', icon: Users },
          { value: stats?.available_donors, label: 'Available now', icon: CheckCircle2 },
          { value: stats?.active_requests, label: 'Active requests', icon: Activity },
          { value: stats?.fulfilled_requests, label: 'Fulfilled requests', icon: HeartHandshake }
        ].map(({ value, label, icon: Icon }) => (
          <div key={label} className="theme-card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-extrabold tabular-nums text-slate-950">{value?.toLocaleString() ?? '—'}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">Simple and accountable</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">How Drop works</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Drop helps people find one another and protect contact details. The receiving hospital or blood bank
            remains responsible for screening, collection, and clinical decisions.
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <article key={title} className="theme-card p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-sm font-extrabold text-emerald-700">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6 sm:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
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
              to="/directory/imported"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-emerald-200 bg-white px-5 text-sm font-extrabold text-slate-800 hover:bg-emerald-50"
            >
              View imported listings
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-red-100 bg-white p-6 sm:p-9">
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

      <section className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">Before donating</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Common questions</h2>
        </div>
        <div className="mt-8 space-y-3">
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
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-extrabold text-slate-900 transition-colors hover:text-emerald-800 sm:px-6">
                {q}
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="px-5 pb-5 text-sm leading-7 text-slate-600 sm:px-6">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-white p-6 sm:p-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">Keep the network useful</p>
            <h2 className="mt-3 text-2xl font-extrabold text-slate-950 sm:text-3xl">Ready to help the next genuine request?</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Create a donor profile, keep availability current, and respond only when you can safely reach the
              named clinical facility.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link
              to={user ? '/profile/donor' : '/register'}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-extrabold text-white hover:bg-primary-dark"
            >
              {user ? 'Update availability' : 'Join as a donor'}
            </Link>
            <Link
              to="/requests"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-6 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
            >
              View live requests
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
