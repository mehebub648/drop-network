import { useEffect, useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  LoaderCircle,
  MapPin,
  UserRound
} from 'lucide-react';
import { BLOOD_GROUPS } from '../../lib/blood';
import { BD_LOCATION_NAMES } from '../../lib/locations';
import { getUpazilasForDistrict } from '../../lib/upazilas';
import {
  loadRegisteredCollectionFacilities,
  type RegisteredCollectionFacility
} from '../../lib/collectionFacilities';
import type { RequesterRole } from '../../lib/searchDraft';

export type Criteria = {
  blood_group: string;
  district: string;
  upazila: string;
  collection_facility: string;
  requester_role: RequesterRole | '';
};

const ROLE_OPTIONS: Array<{ value: RequesterRole; label: string }> = [
  { value: 'PATIENT', label: "I'm the patient" },
  { value: 'RELATIVE', label: "I'm the patient's relative" },
  { value: 'THIRD_PARTY', label: "I'm a third-party volunteer" }
];

const QUESTIONS = [
  'What blood group is needed?',
  'Which district?',
  'Which upazila or thana?',
  'Which hospital or blood bank?',
  'Who are you?'
] as const;

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('en');
}

/**
 * The first search stage is intentionally one question at a time. The parent
 * still owns every answer so the same draft, URL handoff, privacy checks and
 * stale-request clearing continue to work across home and directory routes.
 */
export default function SearchCriteriaForm({
  value,
  onChange,
  onSubmit,
  submitting,
  submitLabel = 'Find donors'
}: {
  value: Criteria;
  onChange: (next: Criteria) => void;
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [facilityOpen, setFacilityOpen] = useState(false);
  const [activeFacilityIndex, setActiveFacilityIndex] = useState(0);
  const [districtFacilities, setDistrictFacilities] = useState<RegisteredCollectionFacility[]>([]);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [facilityLoadFailed, setFacilityLoadFailed] = useState(false);
  const facilityListId = useId();
  const question = QUESTIONS[activeStep];
  const upazilas = useMemo(() => getUpazilasForDistrict(value.district), [value.district]);

  useEffect(() => {
    if (!value.district) {
      setDistrictFacilities([]);
      setFacilityLoading(false);
      setFacilityLoadFailed(false);
      return;
    }

    const controller = new AbortController();
    setDistrictFacilities([]);
    setFacilityLoading(true);
    setFacilityLoadFailed(false);

    loadRegisteredCollectionFacilities(value.district, controller.signal)
      .then(facilities => setDistrictFacilities(facilities))
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFacilityLoadFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setFacilityLoading(false);
      });

    return () => controller.abort();
  }, [value.district]);

  const matchingFacilities = useMemo(() => {
    const query = normalized(value.collection_facility);
    return districtFacilities
      .filter(item => {
        if (!query) return true;
        return normalized(`${item.name} ${item.locality}`).includes(query);
      })
      .sort((a, b) => {
        const queryScore = (name: string) => query && normalized(name).startsWith(query) ? 0 : 1;
        const localityScore = (locality: string) => (locality === value.upazila ? 0 : 1);
        return queryScore(a.name) - queryScore(b.name)
          || localityScore(a.locality) - localityScore(b.locality)
          || a.name.localeCompare(b.name, 'en');
      })
      .slice(0, 10);
  }, [districtFacilities, value.collection_facility, value.upazila]);

  useEffect(() => {
    setActiveFacilityIndex(0);
  }, [value.collection_facility, value.district]);

  const complete = Boolean(
    value.blood_group
    && value.district
    && value.upazila
    && value.collection_facility.trim()
    && value.requester_role
  );
  const stepComplete = [
    Boolean(value.blood_group),
    Boolean(value.district),
    Boolean(value.upazila),
    Boolean(value.collection_facility.trim()),
    Boolean(value.requester_role)
  ][activeStep];

  const next = () => {
    if (!stepComplete) return;
    if (activeStep < QUESTIONS.length - 1) {
      setFacilityOpen(false);
      setActiveStep(step => step + 1);
    } else if (complete) {
      onSubmit();
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    next();
  };

  const chooseFacility = (name: string) => {
    onChange({ ...value, collection_facility: name });
    setFacilityOpen(false);
  };

  const handleFacilityKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setFacilityOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setFacilityOpen(true);
      if (!matchingFacilities.length) return;
      setActiveFacilityIndex(index => {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        return (index + direction + matchingFacilities.length) % matchingFacilities.length;
      });
      return;
    }
    if (event.key === 'Enter' && facilityOpen && matchingFacilities[activeFacilityIndex]) {
      event.preventDefault();
      chooseFacility(matchingFacilities[activeFacilityIndex].name);
    }
  };

  return (
    <form onSubmit={submit} className="surface p-5 sm:p-7">
      <div key={activeStep} className="fade-in min-h-[12rem] sm:min-h-[11rem]">
        <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-slate-950 sm:text-3xl">{question}</h2>

        {activeStep === 0 && (
          <fieldset className="mt-5">
            <legend className="sr-only">Blood group</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {BLOOD_GROUPS.map(group => {
                const selected = value.blood_group === group;
                return (
                  <button
                    key={group}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange({ ...value, blood_group: group })}
                    className={`flex min-h-12 items-center justify-center rounded-xl border text-sm font-extrabold transition-colors ${
                      selected
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    {group}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {activeStep === 1 && (
          <label className="mt-6 block max-w-lg">
            <span className="sr-only">District</span>
            <span className="relative block">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
              <select
                required
                autoFocus
                value={value.district}
                onChange={event => onChange({
                  ...value,
                  district: event.target.value,
                  upazila: '',
                  collection_facility: ''
                })}
                className="input appearance-none pl-11 pr-10"
              >
                <option value="">Choose a district</option>
                {BD_LOCATION_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            </span>
          </label>
        )}

        {activeStep === 2 && (
          <label className="mt-6 block max-w-lg">
            <span className="sr-only">Upazila / thana</span>
            <span className="relative block">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
              <select
                required
                autoFocus
                disabled={!value.district}
                value={value.upazila}
                onChange={event => onChange({ ...value, upazila: event.target.value })}
                className="input appearance-none pl-11 pr-10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{value.district ? 'Choose an upazila or thana' : 'Choose a district first'}</option>
                {upazilas.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            </span>
          </label>
        )}

        {activeStep === 3 && (
          <div className="mt-6 max-w-2xl">
            <label htmlFor={`${facilityListId}-input`} className="sr-only">
              Hospital or blood bank
            </label>
            <div
              className="relative"
              onBlur={event => {
                const nextTarget = event.relatedTarget;
                // Keep the in-flow panel mounted until Back/Continue receives
                // its click. Removing it during blur would move that button
                // between pointer down and click.
                if (nextTarget instanceof HTMLElement && nextTarget.closest('[data-search-navigation]')) return;
                if (!event.currentTarget.contains(nextTarget as Node | null)) setFacilityOpen(false);
              }}
            >
              <Building2 className="pointer-events-none absolute left-4 top-6 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                id={`${facilityListId}-input`}
                required
                autoFocus
                role="combobox"
                aria-autocomplete="list"
                aria-controls={facilityListId}
                aria-expanded={facilityOpen}
                aria-activedescendant={facilityOpen && matchingFacilities[activeFacilityIndex] ? `${facilityListId}-${activeFacilityIndex}` : undefined}
                value={value.collection_facility}
                onFocus={() => setFacilityOpen(true)}
                onClick={() => setFacilityOpen(true)}
                onKeyDown={handleFacilityKeys}
                onChange={event => {
                  onChange({ ...value, collection_facility: event.target.value });
                  setFacilityOpen(true);
                }}
                placeholder={`Search in ${value.district}`}
                className="input pl-11 pr-11"
              />
              <button
                type="button"
                aria-label={facilityOpen ? 'Close facility suggestions' : 'Open facility suggestions'}
                onClick={() => setFacilityOpen(open => !open)}
                className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                {facilityLoading
                  ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : <ChevronDown className={`h-4 w-4 transition-transform ${facilityOpen ? 'rotate-180' : ''}`} aria-hidden="true" />}
              </button>

              {facilityOpen && (facilityLoading || facilityLoadFailed || matchingFacilities.length > 0 || Boolean(value.collection_facility.trim())) && (
                <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
                  {facilityLoading ? (
                    <div id={facilityListId} role="status" className="flex items-center gap-2 p-4 text-sm font-semibold text-slate-600">
                      <LoaderCircle className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                      Loading hospitals…
                    </div>
                  ) : facilityLoadFailed ? (
                    <div id={facilityListId} role="status" className="p-4 text-sm font-semibold text-slate-700">
                      Type the hospital or blood bank instead.
                    </div>
                  ) : matchingFacilities.length ? (
                    <ul id={facilityListId} role="listbox" aria-label={`Registered facilities in ${value.district}`} className="max-h-64 overflow-y-auto p-1.5">
                      {matchingFacilities.map((item, index) => (
                        <li key={item.registryCode}>
                          <button
                            id={`${facilityListId}-${index}`}
                            type="button"
                            role="option"
                            aria-selected={value.collection_facility === item.name}
                            onMouseEnter={() => setActiveFacilityIndex(index)}
                            onClick={() => chooseFacility(item.name)}
                            className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${
                              index === activeFacilityIndex ? 'bg-rose-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-bold leading-5 text-slate-900">{item.name}</span>
                              {item.locality && <span className="mt-0.5 block text-xs font-medium text-slate-500">{item.locality}</span>}
                            </span>
                            {value.collection_facility === item.name && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div id={facilityListId} role="status" className="p-4">
                      <p className="text-sm font-semibold text-slate-700">
                        Use “{value.collection_facility.trim()}”.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <fieldset className="mt-6 max-w-2xl">
            <legend className="sr-only">Requester role</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {ROLE_OPTIONS.map(option => {
                const selected = value.requester_role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange({ ...value, requester_role: option.value })}
                    className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border px-3 text-center text-sm font-bold leading-5 transition-colors ${
                      selected
                        ? 'border-primary bg-rose-50 text-rose-950 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    <UserRound className={`h-4 w-4 shrink-0 ${selected ? 'text-primary' : 'text-slate-400'}`} aria-hidden="true" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3">
        {activeStep > 0 && (
          <button
            type="button"
            data-search-navigation
            onClick={() => {
              setFacilityOpen(false);
              setActiveStep(step => step - 1);
            }}
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition-colors hover:border-rose-200 hover:bg-rose-50"
          >
            Back
          </button>
        )}
        <button data-search-navigation type="submit" disabled={!stepComplete || submitting} className="primary-button disabled:cursor-not-allowed disabled:opacity-60">
          {submitting
            ? 'Searching...'
            : activeStep === QUESTIONS.length - 1
              ? submitLabel
              : 'Continue'}
        </button>
      </div>
    </form>
  );
}
