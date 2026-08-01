import { useMemo, type FormEvent } from 'react';
import { Building2, ChevronDown, Droplet, MapPin, Search, UserRound } from 'lucide-react';
import { BLOOD_GROUPS } from '../../lib/blood';
import { BD_LOCATION_NAMES } from '../../lib/locations';
import { getUpazilasForDistrict } from '../../lib/upazilas';
import { REGISTERED_BLOOD_BANKS, COLLECTION_FACILITY_SOURCE_URL } from '../../lib/collectionFacilities';
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

/**
 * Step one. Blood group, district and upazila are asked first and nothing is
 * pre-selected, because a wrong default here is worse than an empty field: it
 * silently searches the wrong place.
 *
 * The remaining two questions appear only once those three are answered, so the
 * first screen stays short enough to fill in one-handed.
 */
export default function SearchCriteriaForm({
  value,
  onChange,
  onSubmit,
  submitting
}: {
  value: Criteria;
  onChange: (next: Criteria) => void;
  onSubmit: () => void;
  submitting?: boolean;
}) {
  const upazilas = useMemo(() => getUpazilasForDistrict(value.district), [value.district]);
  const facilities = useMemo(() => {
    const inDistrict = REGISTERED_BLOOD_BANKS.filter(item => item.district === value.district);
    // Facilities in the searched upazila first: they are the likely answer.
    return [...inDistrict].sort((a, b) => {
      const score = (locality: string) => (locality === value.upazila ? 0 : 1);
      return score(a.locality) - score(b.locality) || a.name.localeCompare(b.name, 'en');
    });
  }, [value.district, value.upazila]);

  const hasPlace = Boolean(value.blood_group && value.district && value.upazila);
  const complete = hasPlace && Boolean(value.collection_facility.trim() && value.requester_role);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (complete) onSubmit();
  };

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">Blood group</span>
          <span className="relative block">
            <Droplet className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-red-600" aria-hidden="true" />
            <select
              required
              value={value.blood_group}
              onChange={event => onChange({ ...value, blood_group: event.target.value })}
              className="input appearance-none pl-11 pr-10"
            >
              <option value="">Select</option>
              {BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">District</span>
          <span className="relative block">
            <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" aria-hidden="true" />
            <select
              required
              value={value.district}
              onChange={event => onChange({
                ...value,
                district: event.target.value,
                // Upazila and facility names belong to one district.
                upazila: '',
                collection_facility: ''
              })}
              className="input appearance-none pl-11 pr-10"
            >
              <option value="">Select</option>
              {BD_LOCATION_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">Upazila / thana</span>
          <span className="relative block">
            <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" aria-hidden="true" />
            <select
              required
              disabled={!value.district}
              value={value.upazila}
              onChange={event => onChange({ ...value, upazila: event.target.value })}
              className="input appearance-none pl-11 pr-10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{value.district ? 'Select' : 'Choose a district first'}</option>
              {upazilas.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          </span>
        </label>
      </div>

      {hasPlace && (
        <div className="fade-in mt-4 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Where will the blood be collected?</span>
            <span className="relative block">
              <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                required
                list="collection-facilities"
                value={value.collection_facility}
                onChange={event => onChange({ ...value, collection_facility: event.target.value })}
                placeholder="Hospital or blood bank"
                className="input pl-11"
              />
            </span>
            <datalist id="collection-facilities">
              {facilities.map(item => (
                <option key={item.registryCode} value={item.name}>{item.locality}</option>
              ))}
            </datalist>
            <span className="mt-2 block text-xs leading-5 text-slate-500">
              Suggestions come from the{' '}
              <a href={COLLECTION_FACILITY_SOURCE_URL} target="_blank" rel="noreferrer" className="font-bold underline">
                DGHS facility registry
              </a>
              . Type any other place. Confirm collection with them directly.
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Who are you?</span>
            <span className="relative block">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <select
                required
                value={value.requester_role}
                onChange={event => onChange({ ...value, requester_role: event.target.value as RequesterRole })}
                className="input appearance-none pl-11 pr-10"
              >
                <option value="">Select</option>
                {ROLE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            </span>
          </label>
        </div>
      )}

      <button type="submit" disabled={!complete || submitting} className="primary-button mt-4 disabled:cursor-not-allowed disabled:opacity-60">
        <Search className="h-5 w-5" aria-hidden="true" />
        {submitting ? 'Searching...' : 'Find donors'}
      </button>
      {!hasPlace && (
        <p className="mt-3 text-xs font-semibold text-slate-500">
          Choose a blood group, district and upazila to continue.
        </p>
      )}
    </form>
  );
}
