import { useEffect, useMemo, useState } from 'react';
import { Building2, Clock3, MapPinned, Plus, Trash2 } from 'lucide-react';
import {
  loadRegisteredCollectionFacilities,
  type RegisteredCollectionFacility
} from '../lib/collectionFacilities';
import { BD_LOCATION_NAMES } from '../lib/locations';
import { getUpazilasForDistrict } from '../lib/upazilas';
import type {
  PreferredCollectionFacility,
  PreferredDonationArea,
  RecurringContactWindow,
  TravelWillingness
} from '../pages/profile/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type DonorPreferenceDraft = {
  preferredAreas: PreferredDonationArea[];
  preferredFacilities: PreferredCollectionFacility[];
  travelWillingness: TravelWillingness;
  contactWindows: RecurringContactWindow[];
  privateCoordinationNote: string;
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('en');
}

export default function DonorPreferencesFields({
  value,
  onChange,
  homeDistrict
}: {
  value: DonorPreferenceDraft;
  onChange: (next: DonorPreferenceDraft) => void;
  homeDistrict: string;
}) {
  const [areaDistrict, setAreaDistrict] = useState(homeDistrict);
  const [areaUpazila, setAreaUpazila] = useState('');
  const [facilityDistrict, setFacilityDistrict] = useState(homeDistrict);
  const [facilityQuery, setFacilityQuery] = useState('');
  const [facilities, setFacilities] = useState<RegisteredCollectionFacility[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);

  const areaUpazilas = useMemo(() => getUpazilasForDistrict(areaDistrict), [areaDistrict]);

  useEffect(() => {
    if (!facilityDistrict) return;
    const controller = new AbortController();
    setFacilitiesLoading(true);
    loadRegisteredCollectionFacilities(facilityDistrict, controller.signal)
      .then(setFacilities)
      .catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setFacilities([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setFacilitiesLoading(false);
      });
    return () => controller.abort();
  }, [facilityDistrict]);

  const facilityMatches = useMemo(() => {
    const query = normalized(facilityQuery);
    if (!query) return [];
    return facilities
      .filter(facility => normalized(`${facility.name} ${facility.locality}`).includes(query))
      .filter(facility => !value.preferredFacilities.some(selected => facility.registryCodes.includes(selected.registry_code)))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))
      .slice(0, 8);
  }, [facilities, facilityQuery, value.preferredFacilities]);

  const addArea = () => {
    if (!areaDistrict || !areaUpazila || value.preferredAreas.length >= 10) return;
    if (value.preferredAreas.some(area => area.district === areaDistrict && area.upazila === areaUpazila)) return;
    onChange({ ...value, preferredAreas: [...value.preferredAreas, { district: areaDistrict, upazila: areaUpazila }] });
    setAreaUpazila('');
  };

  const addFacility = (facility: RegisteredCollectionFacility) => {
    if (value.preferredFacilities.length >= 8) return;
    onChange({
      ...value,
      preferredFacilities: [...value.preferredFacilities, {
        registry_code: facility.registryCode,
        name: facility.name,
        district: facility.district,
        locality: facility.locality
      }]
    });
    setFacilityQuery('');
  };

  const updateWindow = (index: number, next: RecurringContactWindow) => {
    onChange({
      ...value,
      contactWindows: value.contactWindows.map((window, windowIndex) => windowIndex === index ? next : window)
    });
  };

  return (
    <div className="space-y-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">Travel willingness
          <select
            value={value.travelWillingness}
            onChange={event => onChange({ ...value, travelWillingness: event.target.value as TravelWillingness })}
            className="input"
          >
            <option value="HOME_ONLY">Only my home upazila</option>
            <option value="PREFERRED_AREAS">My home and preferred areas</option>
            <option value="ANYWHERE_IN_DISTRICT">Anywhere in my home district</option>
          </select>
          <small>This controls where your available profile can match a blood search.</small>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <MapPinned className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div><h3 className="font-extrabold text-slate-950">Preferred areas</h3><p className="text-sm leading-6 text-slate-600">Add up to 10 upazilas or thanas where donation is convenient.</p></div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <select value={areaDistrict} onChange={event => { setAreaDistrict(event.target.value); setAreaUpazila(''); }} className="input" aria-label="Preferred area district">
            {BD_LOCATION_NAMES.map(district => <option key={district}>{district}</option>)}
          </select>
          <select value={areaUpazila} onChange={event => setAreaUpazila(event.target.value)} className="input" aria-label="Preferred upazila or thana">
            <option value="">Choose upazila / thana</option>
            {areaUpazilas.map(upazila => <option key={upazila.value} value={upazila.value}>{upazila.label}</option>)}
          </select>
          <button type="button" disabled={!areaUpazila || value.preferredAreas.length >= 10} onClick={addArea} className="button button-secondary"><Plus className="h-4 w-4" aria-hidden="true" />Add</button>
        </div>
        {value.preferredAreas.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {value.preferredAreas.map(area => (
              <li key={`${area.district}:${area.upazila}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-3 pr-1.5 text-xs font-bold text-slate-700">
                {area.upazila}, {area.district}
                <button type="button" aria-label={`Remove ${area.upazila}, ${area.district}`} onClick={() => onChange({ ...value, preferredAreas: value.preferredAreas.filter(item => item !== area) })} className="rounded-full p-1 text-slate-500 hover:bg-slate-100"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div><h3 className="font-extrabold text-slate-950">Preferred collection facilities</h3><p className="text-sm leading-6 text-slate-600">Choose up to 8 facilities from the registered DGHS list.</p></div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select value={facilityDistrict} onChange={event => { setFacilityDistrict(event.target.value); setFacilityQuery(''); }} className="input" aria-label="Facility district">
            {BD_LOCATION_NAMES.map(district => <option key={district}>{district}</option>)}
          </select>
          <input value={facilityQuery} onChange={event => setFacilityQuery(event.target.value)} className="input" placeholder={facilitiesLoading ? 'Loading facilities…' : 'Type a facility name'} aria-label="Find a registered collection facility" />
        </div>
        {facilityMatches.length > 0 && (
          <ul className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {facilityMatches.map(facility => (
              <li key={facility.registryCode} className="border-b border-slate-100 last:border-0">
                <button type="button" onClick={() => addFacility(facility)} className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-rose-50">
                  <span><strong className="block text-sm text-slate-900">{facility.name}</strong><span className="text-xs text-slate-500">{facility.locality || facility.district}</span></span>
                  <Plus className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {value.preferredFacilities.length > 0 && (
          <ul className="mt-3 space-y-2">
            {value.preferredFacilities.map(facility => (
              <li key={facility.registry_code} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span><strong className="block text-sm text-slate-900">{facility.name}</strong><span className="text-xs text-slate-500">{facility.locality ? `${facility.locality}, ` : ''}{facility.district}</span></span>
                <button type="button" aria-label={`Remove ${facility.name}`} onClick={() => onChange({ ...value, preferredFacilities: value.preferredFacilities.filter(item => item.registry_code !== facility.registry_code) })} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><div><h3 className="font-extrabold text-slate-950">Usual contact or donation windows</h3><p className="text-sm leading-6 text-slate-600">Add up to 3 recurring times in Asia/Dhaka. Searchers see only a match reason, never your schedule.</p></div></div>
          <button type="button" disabled={value.contactWindows.length >= 3} onClick={() => onChange({ ...value, contactWindows: [...value.contactWindows, { days: [0, 1, 2, 3, 4, 5, 6], start_time: '09:00', end_time: '18:00' }] })} className="button button-secondary"><Plus className="h-4 w-4" aria-hidden="true" />Add</button>
        </div>
        <div className="mt-3 space-y-3">
          {value.contactWindows.map((window, index) => (
            <fieldset key={index} className="rounded-xl border border-slate-200 bg-white p-3">
              <legend className="px-1 text-xs font-extrabold uppercase tracking-wide text-slate-600">Window {index + 1}</legend>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day, dayIndex) => {
                  const selected = window.days.includes(dayIndex);
                  return <button key={day} type="button" aria-pressed={selected} onClick={() => updateWindow(index, { ...window, days: selected ? window.days.filter(item => item !== dayIndex) : [...window.days, dayIndex].sort() })} className={`min-h-9 min-w-11 rounded-lg border px-2 text-xs font-extrabold ${selected ? 'border-primary bg-primary text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{day}</button>;
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="min-w-32 flex-1">From<input type="time" value={window.start_time} onChange={event => updateWindow(index, { ...window, start_time: event.target.value })} className="input" /></label>
                <label className="min-w-32 flex-1">Until<input type="time" value={window.end_time} onChange={event => updateWindow(index, { ...window, end_time: event.target.value })} className="input" /></label>
                <button type="button" onClick={() => onChange({ ...value, contactWindows: value.contactWindows.filter((_, windowIndex) => windowIndex !== index) })} className="button button-secondary" aria-label={`Remove window ${index + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" />Remove</button>
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      <label>Private coordination note <em>Optional</em>
        <textarea rows={4} maxLength={500} value={value.privateCoordinationNote} onChange={event => onChange({ ...value, privateCoordinationNote: event.target.value })} className="input profile-textarea" placeholder="For example: I can usually travel after work; please call before leaving." />
        <small>{value.privateCoordinationNote.length}/500 characters. This stays private and is never copied into search results.</small>
      </label>
    </div>
  );
}
