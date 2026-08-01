import { useCallback, useEffect, useState } from 'react';
import { Droplet, MapPin, Phone } from 'lucide-react';
import { api } from '../../lib/api';
import { UrgencyBadge } from '../../components/UrgencyBadge';
import type { ProfilePageProps } from './types';

type DonorRequest = {
  id: string;
  blood_group: string;
  location: { area_name: string };
  upazila?: string;
  hospital_name?: string;
  needed_by?: string;
  requester_name?: string;
  requester_phone_masked: string;
  my_response_status: string | null;
  contacts?: Array<{ name: string; phone: string; type: string }>;
};

const RESPONSES = [
  { value: 'CAN_DONATE', label: 'I can donate', primary: true },
  { value: 'NEED_MORE_INFO', label: 'I have a question first', needsNote: true },
  { value: 'NOT_ELIGIBLE_RECENT_DONATION', label: 'I donated too recently' },
  { value: 'NOT_ELIGIBLE_HEALTH', label: "I'm unwell right now" },
  { value: 'TOO_FAR', label: "I'm too far away" },
  { value: 'REQUESTER_NO_LONGER_NEEDS', label: 'They no longer need blood' },
  { value: 'REQUESTER_UNREACHABLE', label: 'I could not reach them' },
  { value: 'WRONG_NUMBER', label: 'Wrong or invalid number' },
  { value: 'SUSPECTED_MISUSE', label: 'This looks like misuse', danger: true }
];

/**
 * The donor's half of the flow: requests they could actually answer, with the
 * requester's number masked until they say they can help - the mirror of how
 * their own number is treated on the requester's side.
 */
export default function DonorRequestsPage({ user }: ProfilePageProps) {
  const [items, setItems] = useState<DonorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState('');
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [pauseAvailability, setPauseAvailability] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getDonorRequests();
      setItems(response.items || []);
    } catch (cause: any) {
      setError(cause?.message || 'Could not load nearby requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (requestId: string) => {
    setBusy(true);
    setError('');
    try {
      await api.reportDonorOutcome(requestId, {
        outcome,
        note: note.trim() || undefined,
        pause_availability: outcome === 'NOT_ELIGIBLE_HEALTH' ? pauseAvailability : undefined
      });
      setOpenId('');
      setOutcome('');
      setNote('');
      setPauseAvailability(false);
      await load();
    } catch (cause: any) {
      setError(cause?.message || 'Could not send your response.');
    } finally {
      setBusy(false);
    }
  };

  if (!user.donor_profile) {
    return (
      <div className="theme-card border border-slate-100 p-6">
        <h2 className="font-extrabold">Add a donor profile first</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Set your blood group and upazila on the donor profile page, and requests in your area will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="theme-card border border-slate-100 p-6">
        <h2 className="text-2xl font-extrabold tracking-tight">Requests near you</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Patients your blood group can help, in {user.donor_profile.upazila || user.donor_profile.location.area_name}.
          {!user.donor_profile.upazila && ' Set your upazila to narrow this to your own area.'}
        </p>
      </div>

      {error && <div role="alert" className="alert alert-error">{error}</div>}

      {loading ? (
        <div aria-busy="true" className="theme-card border border-slate-100 p-6 text-sm font-semibold text-slate-500">
          Loading nearby requests...
        </div>
      ) : items.length === 0 ? (
        <div className="theme-card border border-slate-100 p-6">
          <h3 className="font-extrabold">No open requests in your area right now.</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            You will see requests here as soon as someone nearby needs a blood group you can give.
          </p>
        </div>
      ) : (
        items.map(request => (
          <article key={request.id} className="theme-card border border-slate-100 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-extrabold text-red-700">
                    <Droplet className="h-4 w-4" aria-hidden="true" />
                    {request.blood_group}
                  </span>
                  <UrgencyBadge neededBy={request.needed_by} />
                  {request.my_response_status && (
                    <span className="status-badge status-neutral">You answered: {request.my_response_status.toLowerCase()}</span>
                  )}
                </div>
                <h3 className="mt-3 text-lg font-extrabold text-slate-950">{request.hospital_name || 'Collection place not stated'}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                  <MapPin className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  {request.upazila ? `${request.upazila}, ` : ''}{request.location.area_name}
                </p>
                <p className="mt-2 text-sm text-slate-600">Requested by {request.requester_name || 'a member'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              {request.contacts?.length ? (
                <ul className="space-y-2">
                  {request.contacts.map(contact => (
                    <li key={contact.phone}>
                      <a href={`tel:${contact.phone}`} className="inline-flex min-h-11 items-center gap-2 font-extrabold text-primary tabular-nums">
                        <Phone className="h-4 w-4" aria-hidden="true" />
                        {contact.phone}
                      </a>
                      <span className="ml-2 text-sm text-slate-600">{contact.name} ({contact.type.toLowerCase()})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-semibold tabular-nums text-slate-600">
                  {request.requester_phone_masked || 'No number on file'} &mdash; say you can donate to see it in full.
                </p>
              )}
            </div>

            {openId === request.id ? (
              <div className="fade-in mt-4">
                <fieldset>
                  <legend className="text-sm font-extrabold text-slate-800">Your response</legend>
                  <div className="mt-3 space-y-2">
                    {RESPONSES.map(option => (
                      <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 has-[:checked]:border-primary has-[:checked]:bg-rose-50">
                        <input type="radio" name={`response-${request.id}`} value={option.value} checked={outcome === option.value} onChange={() => setOutcome(option.value)} className="h-4 w-4" />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {outcome === 'NOT_ELIGIBLE_HEALTH' && (
                  <label className="mt-3 flex items-start gap-3 text-sm font-semibold leading-6 text-slate-700">
                    <input type="checkbox" checked={pauseAvailability} onChange={event => setPauseAvailability(event.target.checked)} className="mt-1 h-5 w-5" />
                    Also mark me unavailable until I say otherwise
                  </label>
                )}

                <label className="mt-3 block">
                  <span className="mb-2 block text-sm font-extrabold text-slate-800">
                    Message {outcome === 'NEED_MORE_INFO' ? '(required)' : '(optional)'}
                  </span>
                  <textarea value={note} onChange={event => setNote(event.target.value)} maxLength={300} rows={3} className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium outline-none focus:border-primary" />
                </label>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" disabled={!outcome || busy || (outcome === 'NEED_MORE_INFO' && !note.trim())} onClick={() => send(request.id)} className="button button-primary">
                    {busy ? 'Sending...' : 'Send response'}
                  </button>
                  <button type="button" onClick={() => { setOpenId(''); setOutcome(''); }} className="button button-secondary">Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => { setOpenId(request.id); setOutcome(''); setNote(''); }} className="button button-primary mt-4">
                Respond
              </button>
            )}
          </article>
        ))
      )}
    </div>
  );
}
