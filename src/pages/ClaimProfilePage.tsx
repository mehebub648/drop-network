import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, ExternalLink, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { BLOOD_GROUPS } from '../lib/blood';
import { BD_LOCATION_NAMES, getLocationByName } from '../lib/locations';

type DirectoryProfile = {
  id: string;
  name: string;
  blood_group: string;
  district: string;
  upazila: string;
  phone_masked: string;
  has_phone: boolean;
  claim_status: string;
  missing_fields: string[];
  source: { organization: string; url: string; scraped_at: string };
};

export default function ClaimProfilePage({ user, onUpdate }: { user: any; onUpdate: () => void }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<DirectoryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<{ status: string; reason: string } | null>(null);

  const [name, setName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [district, setDistrict] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data: DirectoryProfile = await api.getDirectoryProfile(id);
        setProfile(data);
        setName(data.name);
        setBloodGroup(data.blood_group);
        setDistrict(data.district);
      } catch (e: any) {
        setError(e.message || 'Failed to load that profile');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const location = getLocationByName(district);
      const result = await api.claimDirectoryProfile(id, {
        name: name.trim() || undefined,
        blood_group: bloodGroup || undefined,
        location: location || undefined
      });
      setOutcome({ status: result.status, reason: result.reason });
      if (result.status === 'CLAIMED') onUpdate();
    } catch (e: any) {
      setError(e.message || 'Failed to claim that profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="max-w-xl mx-auto theme-card p-12 animate-pulse h-48" />;
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto theme-card p-12 text-center border border-slate-100 shadow-sm">
        <p className="text-slate-600 font-bold">{error || 'Profile not found.'}</p>
        <Link to="/directory/imported" className="text-primary font-bold hover:underline mt-4 inline-block">Back to the imported archive</Link>
      </div>
    );
  }

  if (outcome) {
    const approved = outcome.status === 'CLAIMED';
    return (
      <div className="max-w-xl mx-auto theme-card p-10 text-center border border-slate-100 shadow-sm space-y-4 fade-in">
        {approved
          ? <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
          : <Clock className="w-12 h-12 text-amber-500 mx-auto" />}
        <h1 className="text-2xl font-extrabold text-slate-900">
          {approved ? 'Profile claimed' : 'Claim sent for review'}
        </h1>
        <p className="text-slate-500 font-medium">{outcome.reason}</p>
        <p className="text-slate-500 font-medium">
          {approved
            ? 'Your donor profile has been filled in. You are still marked unavailable until you choose to turn availability on.'
            : 'We could not verify ownership automatically, so a moderator will check this claim before the profile becomes yours.'}
        </p>
        <button onClick={() => navigate(approved ? '/profile/donor' : '/directory/imported')} className="theme-button px-6 py-3 font-bold">
          {approved ? 'Go to my donor profile' : 'Back to the imported archive'}
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto theme-card p-10 text-center border border-slate-100 shadow-sm space-y-4">
        <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
        <h1 className="text-2xl font-extrabold text-slate-900">Sign in to claim this profile</h1>
        <p className="text-slate-500 font-medium">
          Claiming needs a verified phone number, so we know the profile is going to the right person.
        </p>
        <Link to="/login" className="theme-button px-6 py-3 font-bold inline-block">Sign in</Link>
      </div>
    );
  }

  const missing = new Set(profile.missing_fields);

  return (
    <div className="max-w-xl mx-auto space-y-6 fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Claim this profile</h1>
        <p className="text-slate-500 font-medium">
          Listed as <span className="font-bold text-slate-700">{profile.name}</span> by{' '}
          <a href={profile.source.url} target="_blank" rel="noreferrer noopener" className="text-primary font-bold hover:underline inline-flex items-center gap-1">
            {profile.source.organization} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </p>
      </div>

      <div className="theme-card p-5 border border-slate-100 shadow-sm text-sm font-medium text-slate-500 space-y-1">
        {profile.has_phone ? (
          <p>
            The listing publishes the number <span className="font-mono text-slate-700">{profile.phone_masked}</span>.
            If that is your number and it matches the phone on your account, the claim is approved immediately.
            Otherwise a moderator reviews it.
          </p>
        ) : (
          <p>
            This listing has no phone number to check against, so the claim goes to a moderator for review.
          </p>
        )}
      </div>

      {missing.size > 0 && (
        <p className="text-sm font-bold text-amber-600">
          This listing is missing {profile.missing_fields.join(', ')}. Fill it in below to finish the profile.
        </p>
      )}

      <form onSubmit={submit} className="theme-card p-6 border border-slate-100 shadow-sm space-y-5">
        <div>
          <label htmlFor="claim-name" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Full name</label>
          <input
            id="claim-name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary font-semibold text-slate-700 outline-none"
          />
        </div>

        <div>
          <label htmlFor="claim-group" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Blood group</label>
          <select
            id="claim-group"
            value={bloodGroup}
            onChange={e => setBloodGroup(e.target.value)}
            required
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary font-semibold text-slate-700 outline-none"
          >
            <option value="">Select your blood group</option>
            {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="claim-district" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">District</label>
          <select
            id="claim-district"
            value={district}
            onChange={e => setDistrict(e.target.value)}
            required
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary font-semibold text-slate-700 outline-none"
          >
            <option value="">Select your district</option>
            {BD_LOCATION_NAMES.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>

        {error && <p className="text-sm font-bold text-primary">{error}</p>}

        <button type="submit" disabled={submitting} className="theme-button w-full py-3 font-bold disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Claim this profile'}
        </button>
        <p className="text-xs text-slate-400 font-medium">
          Claiming links the listing to your account and fills in your donor profile. You stay marked unavailable
          until you turn availability on yourself.
        </p>
      </form>
    </div>
  );
}
