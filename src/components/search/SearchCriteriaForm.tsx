import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  LoaderCircle,
  MapPin,
  Search,
  X
} from 'lucide-react';
import { BLOOD_GROUPS } from '../../lib/blood';
import { BD_LOCATION_NAMES } from '../../lib/locations';
import { getUpazilasForDistrict } from '../../lib/upazilas';
import {
  loadRegisteredCollectionFacilities,
  type RegisteredCollectionFacility
} from '../../lib/collectionFacilities';
import type { RequesterRole } from '../../lib/searchDraft';
import ModalPortal from '../ModalPortal';
import RequesterRolePicker from './RequesterRolePicker';

export type Criteria = {
  blood_group: string;
  district: string;
  upazila: string;
  collection_facility: string;
  collection_facility_code?: string;
  requester_role: RequesterRole | '';
};

const QUESTIONS = [
  'What blood group is needed?',
  'Where is the blood needed?',
  'Which hospital or blood bank?',
  'Who are you?'
] as const;

const STEP_HELP = [
  'Choose the blood group the patient needs.',
  'Choose where the patient will receive blood.',
  'Enter the collection hospital or blood bank.',
  'Tell donors whether you are the patient, a relative, or helping someone else.'
] as const;

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('en');
}

function DistrictPicker({ value, onChange }: { value: string; onChange: (district: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const openerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const resultId = useId();
  const filteredDistricts = useMemo(() => {
    const needle = normalized(query);
    return needle ? BD_LOCATION_NAMES.filter(name => normalized(name).includes(needle)) : BD_LOCATION_NAMES;
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      window.setTimeout(() => openerRef.current?.focus(), 0);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        autoFocus
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`District: ${value || 'not selected'}`}
        onClick={() => setOpen(true)}
        className="input relative flex items-center gap-3 pl-11 pr-10 text-left"
      >
        <MapPin className="pointer-events-none absolute left-4 h-4 w-4 text-primary" aria-hidden="true" />
        <span className={value ? 'text-slate-900' : 'text-slate-500'}>{value || 'Choose a district'}</span>
        <ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 text-slate-500" aria-hidden="true" />
      </button>

      {open && (
        <ModalPortal onClose={close}>
          <div
            className="fixed inset-0 z-[100] flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-5"
            onMouseDown={event => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6"
            >
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">Location</p>
                <h3 id={titleId} className="mt-1 text-xl font-extrabold text-slate-950">Choose a district</h3>
              </div>
              <label className="relative mt-4 block">
                <span className="sr-only">Search districts</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  aria-describedby={resultId}
                  placeholder="Type a district name"
                  className="input pl-11 pr-20"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="absolute right-1 top-1 flex min-h-10 items-center gap-1 rounded-xl px-2 text-xs font-extrabold text-primary hover:bg-rose-50">
                    <X className="h-4 w-4" aria-hidden="true" /> Clear
                  </button>
                )}
              </label>
              <p id={resultId} role="status" aria-live="polite" className="mt-3 text-xs font-bold text-slate-600">
                {filteredDistricts.length} district{filteredDistricts.length === 1 ? '' : 's'}
              </p>
              <div role="listbox" aria-label="Districts" className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 p-1.5">
                {filteredDistricts.map(district => (
                  <button
                    key={district}
                    type="button"
                    role="option"
                    aria-selected={district === value}
                    onClick={() => {
                      onChange(district);
                      close();
                    }}
                    className={`flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-bold ${district === value ? 'bg-rose-50 text-primary' : 'text-slate-800 hover:bg-slate-50'}`}
                  >
                    {district}
                    {district === value && <Check className="h-4 w-4" aria-hidden="true" />}
                  </button>
                ))}
                {filteredDistricts.length === 0 && (
                  <p className="p-4 text-sm font-semibold text-slate-600">No district matches that search.</p>
                )}
              </div>
              <button type="button" onClick={close} className="button button-secondary mt-4 w-full">Close district picker</button>
            </section>
          </div>
        </ModalPortal>
      )}
    </>
  );
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
  submitLabel = 'Find donors',
  nextLabel = 'Continue',
  compact = false,
  initialStep = 0,
  skipBloodGroup = false,
  handoffAfterBloodGroup = false
}: {
  value: Criteria;
  onChange: (next: Criteria) => void;
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel?: string;
  nextLabel?: string;
  compact?: boolean;
  initialStep?: number;
  skipBloodGroup?: boolean;
  handoffAfterBloodGroup?: boolean;
}) {
  const firstStep = skipBloodGroup ? 1 : Math.max(0, Math.min(QUESTIONS.length - 1, initialStep));
  const [activeStep, setActiveStep] = useState(firstStep);
  const [facilityOpen, setFacilityOpen] = useState(false);
  const [activeFacilityIndex, setActiveFacilityIndex] = useState(0);
  const [districtFacilities, setDistrictFacilities] = useState<RegisteredCollectionFacility[]>([]);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [facilityLoadFailed, setFacilityLoadFailed] = useState(false);
  const facilityListId = useId();
  const facilityInputRef = useRef<HTMLInputElement>(null);
  const question = activeStep === 1 && value.blood_group
    ? `Where is ${value.blood_group} blood needed?`
    : QUESTIONS[activeStep];
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
    Boolean(value.district && value.upazila),
    Boolean(value.collection_facility.trim()),
    Boolean(value.requester_role)
  ][activeStep];

  const next = () => {
    if (!stepComplete) return;
    if (activeStep === 0 && handoffAfterBloodGroup) {
      onSubmit();
      return;
    }
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

  const chooseFacility = (facility: RegisteredCollectionFacility) => {
    onChange({ ...value, collection_facility: facility.name, collection_facility_code: facility.registryCode });
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
      chooseFacility(matchingFacilities[activeFacilityIndex]);
    }
  };

  return (
    <form onSubmit={submit} className={`search-criteria-form surface p-5 ${compact ? 'sm:p-6' : 'sm:p-7'}`}>
      <div className="mb-4 flex min-h-9 items-center justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
          {activeStep > 0 && value.blood_group ? `Finding ${value.blood_group} donors` : 'Donor search'}
        </p>
        {activeStep > 0 && value.blood_group && !skipBloodGroup && (
          <button type="button" onClick={() => setActiveStep(0)} className="rounded-lg px-2 py-1.5 text-xs font-extrabold text-primary hover:bg-rose-50">
            Change blood group
          </button>
        )}
      </div>

      <div
        key={activeStep}
        className={`fade-in ${compact ? '' : 'min-h-[10rem]'}`}
      >
        <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-slate-950 sm:text-3xl">{question}</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{STEP_HELP[activeStep]}</p>

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
          <div className="mt-5 grid max-w-2xl gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">District</span>
              <DistrictPicker
                value={value.district}
                onChange={district => onChange({
                    ...value,
                    district,
                    upazila: '',
                    collection_facility: '',
                    collection_facility_code: undefined
                  })}
              />
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Upazila or thana</span>
              <span className="relative block">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                <select
                  required
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
          </div>
        )}

        {activeStep === 2 && (
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
                ref={facilityInputRef}
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
                  onChange({ ...value, collection_facility: event.target.value, collection_facility_code: undefined });
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
                  <div className="flex min-h-11 items-center justify-between gap-3 border-b border-slate-100 px-3">
                    <span className="text-xs font-bold text-slate-600" role="status" aria-live="polite">
                      {facilityLoading ? 'Loading suggestions' : `${matchingFacilities.length} suggestion${matchingFacilities.length === 1 ? '' : 's'}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        facilityInputRef.current?.blur();
                        setFacilityOpen(false);
                      }}
                      className="min-h-10 rounded-lg px-2 text-xs font-extrabold text-primary hover:bg-rose-50"
                    >
                      Hide keyboard
                    </button>
                  </div>
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
                    <ul id={facilityListId} role="listbox" aria-label={`Registered facilities in ${value.district}`} className="max-h-48 overflow-y-auto overscroll-contain p-1.5">
                      {matchingFacilities.map((item, index) => (
                        <li key={item.registryCode}>
                          <button
                            id={`${facilityListId}-${index}`}
                            type="button"
                            role="option"
                            aria-selected={value.collection_facility === item.name}
                            onMouseEnter={() => setActiveFacilityIndex(index)}
                            onClick={() => chooseFacility(item)}
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

        {activeStep === 3 && (
          <RequesterRolePicker
            value={value.requester_role}
            onChange={requesterRole => onChange({ ...value, requester_role: requesterRole })}
            hideLegend
            className="mt-5 max-w-lg"
          />
        )}
      </div>

      <div className={`${compact ? 'mt-4' : 'mt-5'} search-step-navigation flex items-center gap-3`}>
        {activeStep > firstStep && (
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
            : activeStep === QUESTIONS.length - 1 || (activeStep === 0 && handoffAfterBloodGroup)
              ? submitLabel
              : nextLabel}
        </button>
      </div>
    </form>
  );
}
