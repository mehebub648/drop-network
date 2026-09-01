import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, ChevronDown, Clock, HeartPulse, LockKeyhole, MapPin, Save, Stethoscope } from 'lucide-react';
import DonationExperienceFields from '../../components/DonationExperienceFields';
import DonorPreferencesFields, { type DonorPreferenceDraft } from '../../components/DonorPreferencesFields';
import { api } from '../../lib/api';
import { BLOOD_GROUPS, DONATION_INTERVAL_DAYS, getEligibility } from '../../lib/blood';
import {
  canonicalLastDonationDate,
  donationExperienceDraft,
  donationExperiencePayload,
  validateDonationExperience,
  type DonationExperienceDraft
} from '../../lib/donation';
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

function preferenceDraft(user: ProfilePageProps['user']): DonorPreferenceDraft {
  return {
    preferredAreas: user.donor_profile?.preferred_areas || [],
    preferredFacilities: user.donor_profile?.preferred_facilities || [],
    travelWillingness: user.donor_profile?.travel_willingness || 'HOME_ONLY',
    contactWindows: user.donor_profile?.contact_windows || [],
    privateCoordinationNote: user.donor_profile?.private_coordination_note || ''
  };
}

export default function DonorPage({ user, onUpdate }: ProfilePageProps) {
  const [bloodGroup, setBloodGroup] = useState(user.donor_profile?.blood_group || 'O+');
  const [district, setDistrict] = useState(user.donor_profile?.location.area_name || 'Dhaka');
  const [upazila, setUpazila] = useState(user.donor_profile?.upazila || '');
  const [age, setAge] = useState(user.donor_profile?.age ? String(user.donor_profile.age) : '');
  const [weight, setWeight] = useState(user.donor_profile?.weight_kg ? String(user.donor_profile.weight_kg) : '');
  const [medicalConditions, setMedicalConditions] = useState(user.donor_profile?.medical_conditions || '');
  const [status, setStatus] = useState<AvailabilityStatus>(user.donor_profile?.availability_status || 'NOT_AVAILABLE');
  const [availabilityReason, setAvailabilityReason] = useState(user.donor_profile?.availability_reason || '');
  const [donationExperience, setDonationExperience] = useState<DonationExperienceDraft>(() => donationExperienceDraft(
    user.donor_profile?.last_donation,
    user.donor_profile?.last_donation_date,
    user.donor_profile?.donation_count
  ));
  const [preferences, setPreferences] = useState<DonorPreferenceDraft>(() => preferenceDraft(user));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setBloodGroup(user.donor_profile?.blood_group || 'O+');
    setDistrict(user.donor_profile?.location.area_name || 'Dhaka');
    setUpazila(user.donor_profile?.upazila || '');
    setAge(user.donor_profile?.age ? String(user.donor_profile.age) : '');
    setWeight(user.donor_profile?.weight_kg ? String(user.donor_profile.weight_kg) : '');
    setMedicalConditions(user.donor_profile?.medical_conditions || '');
    setStatus(user.donor_profile?.availability_status || 'NOT_AVAILABLE');
    setAvailabilityReason(user.donor_profile?.availability_reason || '');
    setDonationExperience(donationExperienceDraft(
      user.donor_profile?.last_donation,
      user.donor_profile?.last_donation_date,
      user.donor_profile?.donation_count
    ));
    setPreferences(preferenceDraft(user));
  }, [user]);

  const upazilas = useMemo(() => getUpazilasForDistrict(district), [district]);
  const latestDonation = useMemo(() => [
    canonicalLastDonationDate(user.donor_profile?.last_donation),
    user.donor_profile?.last_donation_date,
    ...(user.donor_profile?.donation_history || []).map(record => record.date)
  ].filter(Boolean).sort().pop(), [user]);
  const eligibility = getEligibility(latestDonation);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const location = getLocationByName(district);
    if (!location) return setMessage({ type: 'error', text: 'Choose a supported district.' });
    const donationError = validateDonationExperience(donationExperience, user.donor_profile?.donation_history?.length || 0);
    if (donationError) return setMessage({ type: 'error', text: donationError });
    if (preferences.contactWindows.some(window => window.days.length === 0 || !window.start_time || !window.end_time || window.start_time === window.end_time)) {
      return setMessage({ type: 'error', text: 'Each contact window needs at least one day and different start and end times.' });
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.updateDonorProfile(donorProfilePayload(user, {
        blood_group: bloodGroup,
        location,
        upazila: upazila || undefined,
        age: age ? Number(age) : undefined,
        weight_kg: weight ? Number(weight) : undefined,
        medical_conditions: medicalConditions,
        availability_status: status,
        availability_reason: status === 'AVAILABLE' ? undefined : availabilityReason,
        preferred_areas: preferences.preferredAreas,
        preferred_facilities: preferences.preferredFacilities,
        travel_willingness: preferences.travelWillingness,
        contact_windows: preferences.contactWindows,
        private_coordination_note: preferences.privateCoordinationNote,
        ...donationExperiencePayload(donationExperience)
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
    <div className="profile-editor-stack">
      <div className={cn('profile-eligibility', eligibility.eligible ? 'is-eligible' : 'is-waiting')}>
        <span>{eligibility.eligible ? <CheckCircle2 aria-hidden="true" /> : <Clock aria-hidden="true" />}</span>
        <div>
          <p>Donation reminder</p>
          <h2>{eligibility.eligible ? 'Your waiting period is complete' : `${eligibility.daysLeft} day${eligibility.daysLeft === 1 ? '' : 's'} remaining`}</h2>
          <span>
            Drop uses a {DONATION_INTERVAL_DAYS}-day reminder. The collection facility always makes the final decision.
            {eligibility.nextEligibleDate && !eligibility.eligible ? ` Next reminder: ${eligibility.nextEligibleDate.toLocaleDateString()}.` : ''}
          </span>
        </div>
      </div>

      <form onSubmit={save} className="profile-editor">
        <header className="profile-editor-header">
          <span><HeartPulse aria-hidden="true" /></span>
          <div>
            <p>Donor profile</p>
            <h1>Keep your donor details current</h1>
            <span>Accurate location and availability help people contact the right donors.</span>
          </div>
        </header>

        <details className="profile-form-section profile-collapsible" open>
          <summary className="profile-section-heading">
            <span><MapPin aria-hidden="true" /></span>
            <div><h2>Search details</h2><p>These details help people find you when you are available.</p></div>
            <ChevronDown className="profile-section-chevron" aria-hidden="true" />
          </summary>
          <div className="profile-section-body profile-form-grid">
            <label>Blood group
              <select id="donor-blood-group" value={bloodGroup} onChange={event => setBloodGroup(event.target.value)} className="input">
                {BLOOD_GROUPS.map(group => <option key={group}>{group}</option>)}
              </select>
            </label>
            <label>Home district
              <select id="donor-district" value={district} onChange={event => { setDistrict(event.target.value); setUpazila(''); }} className="input">
                {BD_LOCATION_NAMES.map(name => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label className="profile-grid-wide">Home upazila / thana
              <select id="donor-upazila" value={upazila} onChange={event => setUpazila(event.target.value)} className="input">
                <option value="">Not set</option>
                {upazilas.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <small>Without an upazila, your profile will not appear in donor search results.</small>
            </label>
          </div>
        </details>

        <details className="profile-form-section profile-collapsible">
          <summary className="profile-section-heading">
            <span><MapPin aria-hidden="true" /></span>
            <div><h2>Where and when donation is convenient</h2><p>Optional preferences improve matching without publishing your private schedule or note.</p></div>
            <ChevronDown className="profile-section-chevron" aria-hidden="true" />
          </summary>
          <div className="profile-section-body"><DonorPreferencesFields value={preferences} onChange={setPreferences} homeDistrict={district} /></div>
        </details>

        <details className="profile-form-section profile-health-section profile-collapsible">
          <summary className="profile-section-heading">
            <span><Stethoscope aria-hidden="true" /></span>
            <div><h2>Private health details</h2><p>Helpful context for keeping your availability honest.</p></div>
            <ChevronDown className="profile-section-chevron" aria-hidden="true" />
          </summary>
          <div className="profile-section-body profile-form-grid">
            <label>Age <em>Optional</em>
              <input id="donor-age" type="number" inputMode="numeric" min={16} max={70} value={age} onChange={event => setAge(event.target.value)} className="input" />
            </label>
            <label>Weight in kg <em>Optional</em>
              <input id="donor-weight" type="number" inputMode="numeric" min={30} max={200} value={weight} onChange={event => setWeight(event.target.value)} className="input" />
            </label>
            <label className="profile-grid-wide">Any medical condition or current sickness? <em>Optional</em>
              <textarea
                id="donor-medical-conditions"
                rows={4}
                maxLength={500}
                value={medicalConditions}
                onChange={event => setMedicalConditions(event.target.value)}
                className="input profile-textarea"
                placeholder="For example: recovering from fever, taking prescribed medicine, or a long-term condition"
              />
              <small>{medicalConditions.length}/500 characters</small>
            </label>
          </div>
          <div className="profile-private-note">
            <LockKeyhole aria-hidden="true" />
            <p><strong>Private to your account.</strong> This information never appears in donor search and is not medical clearance. Do not upload medical records; the collection facility will screen you before donation.</p>
          </div>
          {medicalConditions.trim() && status === 'AVAILABLE' && (
            <p className="profile-health-reminder">If you are currently unwell, consider changing your availability to “Sick or recovering”.</p>
          )}
        </details>

        <details className="profile-form-section profile-collapsible">
          <summary className="profile-section-heading">
            <span><Clock aria-hidden="true" /></span>
            <div><h2>Donation experience</h2><p>Add only what you remember. Exact dates are not required.</p></div>
            <ChevronDown className="profile-section-chevron" aria-hidden="true" />
          </summary>
          <div className="profile-section-body">
            <DonationExperienceFields
              idPrefix="donor-profile"
              value={donationExperience}
              onChange={setDonationExperience}
              optional
              minimumCount={user.donor_profile?.donation_history?.length || 0}
            />
            <p className="profile-section-footnote">Your last-donation summary and lifetime count can appear publicly while you are available. Detailed records stay private.</p>
          </div>
        </details>

        <details className="profile-form-section profile-collapsible" open>
          <summary className="profile-section-heading">
            <span><HeartPulse aria-hidden="true" /></span>
            <div><h2>Availability</h2><p>Pause your listing any time. You can return when you are ready.</p></div>
            <ChevronDown className="profile-section-chevron" aria-hidden="true" />
          </summary>
          <div className="profile-section-body profile-form-grid">
            <label className="profile-grid-wide">Current status
              <select id="donor-status" value={status} onChange={event => setStatus(event.target.value as AvailabilityStatus)} className="input">
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {status !== 'AVAILABLE' && (
              <label className="profile-grid-wide">Reason <em>Optional</em>
                <textarea id="donor-availability-reason" maxLength={240} rows={3} value={availabilityReason} onChange={event => setAvailabilityReason(event.target.value)} className="input profile-textarea" placeholder="For example: recovering, traveling, or taking a break" />
                <small>This stays private and is never shown in donor search.</small>
              </label>
            )}
          </div>
        </details>

        <footer className="profile-editor-actions">
          <div aria-live="polite">
            {message && <p className={message.type === 'success' ? 'profile-message is-success' : 'profile-message is-error'}>{message.text}</p>}
          </div>
          <button disabled={saving} className="profile-save-button"><Save aria-hidden="true" /> {saving ? 'Saving…' : 'Save donor profile'}</button>
        </footer>
      </form>

      <section className="profile-history-card">
        <h2>Availability history</h2>
        {(user.donor_profile?.availability_history || []).length === 0 ? (
          <p>No availability changes recorded yet.</p>
        ) : (
          <ul>
            {[...(user.donor_profile?.availability_history || [])].reverse().slice(0, 8).map((entry, index) => (
              <li key={entry.changed_at + index}>
                <span>{statusLabels[entry.status]}</span>
                <time>{new Date(entry.changed_at).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
