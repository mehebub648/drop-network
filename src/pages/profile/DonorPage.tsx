import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, HeartPulse, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { BLOOD_GROUPS, DONATION_INTERVAL_DAYS, getEligibility } from '../../lib/blood';
import { BD_LOCATION_NAMES, getLocationByName } from '../../lib/locations';
import { getUpazilasForDistrict } from '../../lib/upazilas';
import { cn } from '../../lib/utils';
import { donorProfilePayload } from './profileUtils';
import type { AvailabilityStatus, ProfilePageProps } from './types';

const statusLabels: Record<AvailabilityStatus, string> = {
  AVAILABLE: 'Available for donation',
  SICK: 'Sick or recovering',
  TRAVELING: 'Traveling',
  NOT_AVAILABLE: 'Not available right now'
};

export default function DonorPage({ user, onUpdate }: ProfilePageProps) {
  const [bloodGroup, setBloodGroup] = useState(user.donor_profile?.blood_group || 'O+');
  const [district, setDistrict] = useState(user.donor_profile?.location.area_name || 'Dhaka');
  const [upazila, setUpazila] = useState(user.donor_profile?.upazila || '');
  const [age, setAge] = useState(user.donor_profile?.age ? String(user.donor_profile.age) : '');
  const [weight, setWeight] = useState(user.donor_profile?.weight_kg ? String(user.donor_profile.weight_kg) : '');
  const [status, setStatus] = useState<AvailabilityStatus>(user.donor_profile?.availability_status || 'NOT_AVAILABLE');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setBloodGroup(user.donor_profile?.blood_group || 'O+');
    setDistrict(user.donor_profile?.location.area_name || 'Dhaka');
    setUpazila(user.donor_profile?.upazila || '');
    setAge(user.donor_profile?.age ? String(user.donor_profile.age) : '');
    setWeight(user.donor_profile?.weight_kg ? String(user.donor_profile.weight_kg) : '');
    setStatus(user.donor_profile?.availability_status || 'NOT_AVAILABLE');
  }, [user]);

  const upazilas = useMemo(() => getUpazilasForDistrict(district), [district]);

  const latestDonation = useMemo(() => [
    user.donor_profile?.last_donation_date,
    ...(user.donor_profile?.donation_history || []).map(record => record.date)
  ].filter(Boolean).sort().pop(), [user]);
  const eligibility = getEligibility(latestDonation);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const location = getLocationByName(district);
    if (!location) return setMessage({ type: 'error', text: 'Choose a supported district.' });
    setSaving(true);
    setMessage(null);
    try {
      await api.updateDonorProfile(donorProfilePayload(user, {
        blood_group: bloodGroup,
        location,
        upazila: upazila || undefined,
        age: age ? Number(age) : undefined,
        weight_kg: weight ? Number(weight) : undefined,
        availability_status: status
      }));
      await onUpdate();
      setMessage({ type: 'success', text: 'Donor profile updated.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Could not update donor profile.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={cn('theme-card border p-6 flex gap-4', eligibility.eligible ? 'border-green-100 bg-green-50/40' : 'border-rose-100')}>
        <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0', eligibility.eligible ? 'bg-green-100 text-green-700' : 'bg-rose-50 text-primary')}>
          {eligibility.eligible ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
        </div>
        <div>
          <h2 className="font-extrabold text-lg">{eligibility.eligible ? 'Eligible to donate again' : `${eligibility.daysLeft} day${eligibility.daysLeft === 1 ? '' : 's'} until eligibility`}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Drop uses a {DONATION_INTERVAL_DAYS}-day whole-blood reminder. The collection facility makes the final eligibility decision.
            {eligibility.nextEligibleDate && !eligibility.eligible ? ` Next date: ${eligibility.nextEligibleDate.toLocaleDateString()}.` : ''}
          </p>
        </div>
      </div>

      <form onSubmit={save} className="theme-card border border-slate-100 p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-extrabold tracking-tight">Donor profile</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 mt-7">
          <div>
            <label htmlFor="donor-blood-group" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Blood group</label>
            <select id="donor-blood-group" value={bloodGroup} onChange={event => setBloodGroup(event.target.value)} className="w-full px-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-medium">
              {BLOOD_GROUPS.map(group => <option key={group}>{group}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="donor-district" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">District</label>
            <select
              id="donor-district"
              value={district}
              onChange={event => {
                setDistrict(event.target.value);
                // Upazila names belong to one district, so a move clears it.
                setUpazila('');
              }}
              className="w-full px-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-medium"
            >
              {BD_LOCATION_NAMES.map(name => <option key={name}>{name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="donor-upazila" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Upazila / thana</label>
            <select id="donor-upazila" value={upazila} onChange={event => setUpazila(event.target.value)} className="w-full px-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-medium">
              <option value="">Not set</option>
              {upazilas.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Requesters search by upazila. Without one you will not appear in their results.
            </p>
          </div>
          <div>
            <label htmlFor="donor-age" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Age (optional)</label>
            <input id="donor-age" type="number" inputMode="numeric" min={16} max={70} value={age} onChange={event => setAge(event.target.value)} className="w-full px-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-medium" />
          </div>
          <div>
            <label htmlFor="donor-weight" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Weight in kg (optional)</label>
            <input id="donor-weight" type="number" inputMode="numeric" min={30} max={200} value={weight} onChange={event => setWeight(event.target.value)} className="w-full px-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-medium" />
          </div>
          <p className="sm:col-span-2 -mt-2 text-xs text-slate-500">
            Age and weight are shown to nobody and never block a request. The collection facility screens you on the day.
          </p>
          <div className="sm:col-span-2">
            <label htmlFor="donor-status" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Availability</label>
            <select id="donor-status" value={status} onChange={event => setStatus(event.target.value as AvailabilityStatus)} className="w-full px-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-medium">
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        {message && <p className={message.type === 'success' ? 'mt-4 text-green-700 font-bold text-sm' : 'mt-4 text-red-600 font-bold text-sm'}>{message.text}</p>}
        <button disabled={saving} className="mt-6 inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-50"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save donor profile'}</button>
      </form>

      <div className="theme-card border border-slate-100 p-6">
        <h2 className="font-extrabold">Availability history</h2>
        {(user.donor_profile?.availability_history || []).length === 0 ? (
          <p className="text-sm text-slate-500 mt-2">No availability changes recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {[...(user.donor_profile?.availability_history || [])].reverse().slice(0, 8).map((entry, index) => (
              <li key={entry.changed_at + index} className="flex items-center justify-between gap-4 text-sm border-b border-slate-100 pb-3 last:border-0">
                <span className="font-bold text-slate-700">{statusLabels[entry.status]}</span>
                <time className="text-slate-400">{new Date(entry.changed_at).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
