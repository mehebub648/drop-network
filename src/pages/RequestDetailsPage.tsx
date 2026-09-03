import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Calendar, CheckCircle2, ChevronLeft, Copy, Droplet, Edit2, Flag, HeartPulse, MapPin, MessageCircle, Phone, Plus, Share2, Trash2, User as UserIcon, Users } from 'lucide-react';
import { api, BROWSER_FINGERPRINT, type ContactedDonorSummary, type SearchDonorCard } from '../lib/api';
import { compatibleDonorsFor } from '../lib/blood';
import {
  loadRegisteredCollectionFacilities,
  type RegisteredCollectionFacility
} from '../lib/collectionFacilities';
import { BD_LOCATION_NAMES, getLocationByName } from '../lib/locations';
import { requestReasonLabel } from '../lib/requestReasons';
import { cn } from '../lib/utils';
import { UrgencyBadge } from '../components/UrgencyBadge';
import VerifiedBadge from '../components/VerifiedBadge';
import ModalPortal from '../components/ModalPortal';

export default function RequestDetailsPage({ user }: { user: any }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<{ request: any, matches: SearchDonorCard[], match_total?: number, responses?: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [contactedDonors, setContactedDonors] = useState<ContactedDonorSummary[]>([]);
  
  // UI States
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [anonName, setAnonName] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedContact, setCopiedContact] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'REQUEST' | 'COMMENT', id: string } | null>(null);
  const [reportReason, setReportReason] = useState('OTHER');
  const [reportDetails, setReportDetails] = useState('');

  const shareRequest = (target: 'copy' | 'whatsapp') => {
    if (!data) return;
    const url = window.location.href;
    const neededText = data.request.needed_by
      ? `by ${new Date(data.request.needed_by).toLocaleDateString('en-GB')}`
      : 'ASAP';
    const component = (data.request.blood_component || 'WHOLE_BLOOD').replaceAll('_', ' ').toLowerCase();
    const reason = requestReasonLabel(data.request.request_reason);
    const units = data.request.units_required || 1;
    const need = `${units} unit${units === 1 ? '' : 's'} of ${component}`;
    const text = `URGENT: ${data.request.blood_group} ${need} needed${reason ? ` for ${reason.toLowerCase()}` : ''} in ${data.request.location.area_name} ${neededText}. Details & contact: ${url}`;
    if (target === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const copyContact = async (phone: string, key: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedContact(key);
      setTimeout(() => setCopiedContact(current => current === key ? null : current), 2000);
    } catch {
      setActionMessage({ type: 'error', text: 'Could not copy the phone number.' });
    }
  };

  // Editing State
  const [editData, setEditData] = useState<any>({
    patient_name: '',
    requester_name: '',
    needed_by: '',
    hospital_name: '',
    hospital_address: '',
    ward: '',
    district: '',
    contacts: []
  });
  const [editFacilitySuggestions, setEditFacilitySuggestions] = useState<RegisteredCollectionFacility[]>([]);

  useEffect(() => {
    if (!isEditing || !editData.district) {
      setEditFacilitySuggestions([]);
      return;
    }

    const controller = new AbortController();
    loadRegisteredCollectionFacilities(editData.district, controller.signal)
      .then(setEditFacilitySuggestions)
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setEditFacilitySuggestions([]);
      });

    return () => controller.abort();
  }, [editData.district, isEditing]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const payload = await api.getRequestDetails(id);
        setData(payload);
        if (user?.id === payload.request.user_id) {
          const contacted = await api.getContactedDonors(id).catch(() => ({ items: [] }));
          setContactedDonors(contacted.items);
        }
        setEditData({
          patient_name: payload.request.patient_name || '',
          requester_name: payload.request.requester_name || '',
          needed_by: payload.request.needed_by ? new Date(payload.request.needed_by).toISOString().slice(0, 16) : '',
          hospital_name: payload.request.hospital_name || '',
          hospital_address: payload.request.hospital_address || '',
          ward: payload.request.ward || '',
          district: payload.request.location?.area_name || '',
          contacts: payload.request.contacts || []
        });
      } catch (e) {
        console.error(e);
        setLoadError('This request could not be loaded.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, navigate, user?.id]);

  const handleUpdateStatus = async (status: string) => {
    if (data?.request) {
      setActionMessage(null);
      try {
        const updated = await api.updateRequestStatus(data.request.id, status);
        setData({ ...data, request: { ...data.request, status: updated.status } });
        setActionMessage({ type: 'success', text: 'Request status updated.' });
      } catch (err: any) {
        setActionMessage({ type: 'error', text: err.message || 'Failed to update request status.' });
      }
    }
  };

  const handleSaveDetails = async () => {
    if (data?.request) {
      const location = getLocationByName(editData.district);
      if (!location) {
        setActionMessage({ type: 'error', text: 'Choose a valid collection district.' });
        return;
      }
      const formattedData = {
        ...editData,
        location,
        needed_by: editData.needed_by ? new Date(editData.needed_by).toISOString() : undefined
      };
      setActionMessage(null);
      try {
        const updated = await api.updateRequestDetails(data.request.id, formattedData);
        setData({ ...data, request: { ...data.request, ...updated } });
        setIsEditing(false);
        setActionMessage({ type: 'success', text: 'Request details updated.' });
      } catch (err: any) {
        setActionMessage({ type: 'error', text: err.message || 'Failed to update request details.' });
      }
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !data) return;
    if (!user && !anonName.trim()) {
      setActionMessage({ type: 'error', text: 'Please provide a name to comment.' });
      return;
    }
    
    try {
      const comment = await api.addComment(data.request.id, newComment, user ? undefined : anonName);
      setData({
        ...data,
        request: {
          ...data.request,
          comments: [...(data.request.comments || []), comment]
        }
      });
      setNewComment('');
      setActionMessage({ type: 'success', text: 'Comment posted.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to submit comment.' });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!data) return;
    try {
      await api.deleteComment(data.request.id, commentId);
      setData({
        ...data,
        request: {
          ...data.request,
          comments: data.request.comments.filter((c: any) => c.id !== commentId)
        }
      });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete comment.' });
    }
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    try {
      await api.report(reportTarget.type, reportTarget.id, reportReason, reportDetails || undefined);
      setReportTarget(null); setReportDetails('');
      setActionMessage({ type: 'success', text: 'Report submitted to the moderation team.' });
    } catch (error: any) { setActionMessage({ type: 'error', text: error.message || 'Could not submit the report.' }); }
  };

  if (loading) return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/requests"
          aria-label="Back to blood requests"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">Blood request</p>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-950 md:text-2xl">Request details</h2>
        </div>
      </div>
      <div role="status" aria-live="polite" aria-busy="true" className="surface flex min-h-48 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-rose-100 border-t-primary" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-700">Loading request details…</p>
      </div>
    </div>
  );
  if (loadError) return (
    <div className="max-w-3xl mx-auto theme-card p-10 text-center border border-slate-100">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <p className="font-bold text-slate-900">{loadError}</p>
      <Link to="/requests" className="inline-block mt-4 text-primary font-bold hover:underline">Back to requests</Link>
    </div>
  );
  if (!data) return null;

  const { request, matches } = data;
  const isOwner = (user && user.id === request.user_id) || request.user_id === BROWSER_FINGERPRINT;
  const neededLabel = request.needed_by
    ? new Date(request.needed_by).toLocaleDateString('en-GB')
    : 'As soon as possible';
  const componentLabel = (request.blood_component || 'WHOLE_BLOOD').replaceAll('_', ' ').toLowerCase();
  const unitsRequired = request.units_required || 1;
  const reasonLabel = requestReasonLabel(request.request_reason);
  const donorSearchQuery = new URLSearchParams({
    blood_group: request.blood_group,
    district: request.location.area_name,
    upazila: request.upazila || request.location.area_name,
    collection_facility: request.hospital_name || '',
    collection_facility_code: request.collection_facility_code || '',
    request_id: request.id,
    order_seed: request.id.replaceAll('-', '')
  });
  const donorSearchPath = `/directory?${donorSearchQuery.toString()}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/requests"
            aria-label="Back to blood requests"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">Blood request</p>
            <h2 className="truncate text-xl font-extrabold tracking-tight text-slate-950 md:text-2xl">Request details</h2>
          </div>
        </div>
        {user && !isOwner && <button onClick={() => setReportTarget({ type: 'REQUEST', id: request.id })} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"><Flag className="w-4 h-4" /> Report</button>}
      </div>

      {reportTarget && (
        <ModalPortal onClose={() => setReportTarget(null)}>
          <div className="dialog-backdrop" role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) setReportTarget(null);
          }}>
            <div className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
              <h2 id="report-title" className="mt-0">Report safety concern</h2>
              <p>Reports are visible only to authorized operators.</p>
              <label className="dialog-field">
                <span>Reason</span>
                <select value={reportReason} onChange={e => setReportReason(e.target.value)} className="input">
                  <option value="OTHER">Inaccurate or other concern</option>
                  <option value="SPAM">Spam or duplicate</option>
                  <option value="PAYMENT_REQUEST">Payment requested</option>
                  <option value="HARASSMENT">Harassment</option>
                  <option value="PRIVACY">Privacy concern</option>
                  <option value="FRAUD">Suspected fraud</option>
                </select>
              </label>
              <label className="dialog-field">
                <span>Optional details</span>
                <textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} maxLength={1000} rows={4} placeholder="Add context for the safety team" />
              </label>
              <div className="dialog-actions">
                <button onClick={() => setReportTarget(null)} className="button button-secondary">Cancel</button>
                <button onClick={submitReport} className="button button-danger">Submit report</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {actionMessage && (
        <div className={cn(
          "px-5 py-3 rounded-2xl text-sm font-bold",
          actionMessage.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
        )}>
          {actionMessage.text}
        </div>
      )}

      {/* Main Request Header */}
      <section className="relative overflow-hidden rounded-[2rem] border border-rose-100 bg-gradient-to-br from-white via-white to-rose-50/70 p-5 shadow-[0_16px_48px_-32px_rgba(136,19,55,0.45)] md:p-8">
        {request.status === 'FULFILLED' && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-green-100 text-green-700 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Request Fulfilled</h3>
            <p className="text-slate-500 font-medium mt-1">This request has been completed.</p>
          </div>
        )}

        {request.status === 'CANCELLED' && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Cancelled</h3>
            <p className="text-slate-500 font-medium mt-1">This request was cancelled by the owner.</p>
          </div>
        )}

        <div className="relative z-0 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4 md:gap-5">
             <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-red-100 bg-white text-2xl font-extrabold text-red-700 shadow-sm md:h-20 md:w-20 md:text-3xl">
               {request.blood_group}
             </div>
             <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span> {request.status === 'ACTIVE' ? 'Active' : request.status}
                  </span>
                  <UrgencyBadge neededBy={request.needed_by} />
                  <span className="text-[11px] font-bold text-slate-400">#{request.id.split('-')[1]}</span>
                </div>
                <h1 className="text-xl font-extrabold leading-tight text-slate-950 md:text-3xl">
                  {request.hospital_name || 'Collection facility'}
                </h1>
                {request.ward && <p className="mt-1 text-sm font-semibold text-slate-500">{request.ward}</p>}
             </div>
          </div>
          {isOwner && (
            <div className="flex flex-col gap-3 min-w-[160px]">
               <button onClick={() => handleUpdateStatus('CANCELLED')} className="w-full px-5 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-bold rounded-xl transition-all">
                 Cancel Request
               </button>
            </div>
          )}
        </div>

        <div className="relative z-0 mt-6 grid grid-cols-2 gap-2.5 border-t border-rose-100 pt-5 lg:grid-cols-5">
          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-slate-100">
            <MapPin className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
            <p className="request-metadata-label">Location</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{request.hospital_address || request.location.area_name}</p>
            {request.hospital_address && <p className="mt-0.5 text-xs font-semibold text-slate-500">{request.location.area_name}</p>}
          </div>
          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-slate-100">
            <Calendar className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
            <p className="request-metadata-label">Needed by</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{neededLabel}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-slate-100">
            <Droplet className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
            <p className="request-metadata-label">Amount</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{unitsRequired} unit{unitsRequired === 1 ? '' : 's'} · {componentLabel}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-slate-100">
            <Users className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
            <p className="request-metadata-label">Compatible</p>
            <p className="mt-1 flex flex-wrap gap-1">
              {compatibleDonorsFor(request.blood_group).map(g => (
                <span key={g} className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-extrabold text-red-700">{g}</span>
              ))}
            </p>
          </div>
          {reasonLabel && (
            <div className="col-span-2 rounded-2xl bg-white/80 p-3 ring-1 ring-slate-100 lg:col-span-1">
              <HeartPulse className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
              <p className="request-metadata-label">Reason</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{reasonLabel}</p>
              {request.request_reason === 'OTHER' && request.request_reason_details && <p className="mt-0.5 text-xs font-semibold text-slate-500">{request.request_reason_details}</p>}
            </div>
          )}
        </div>

        {request.status === 'ACTIVE' && (
          <div className="relative z-0 mt-5 flex flex-col gap-3 rounded-2xl border border-rose-100 bg-white/85 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="px-1">
              <p className="text-sm font-extrabold text-slate-900">Help this request reach donors</p>
              <p className="text-xs font-medium text-slate-500">Share only the public request link.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                onClick={() => shareRequest('whatsapp')}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-700"
              >
                <Share2 className="w-4 h-4" /> WhatsApp
              </button>
              <button
                onClick={() => shareRequest('copy')}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Copy className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        )}
      </section>

      {isOwner && (
        <section className="theme-card border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">Contacted donors</h3><p className="mt-1 text-sm text-slate-500">Numbers stay masked here. Reopen an active contact through donor search when needed.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{contactedDonors.length}</span></div>
          {contactedDonors.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No donor has been contacted for this request yet.</p> : <div className="mt-5 divide-y divide-slate-100">
            {contactedDonors.map(donor => <div key={donor.donor_ref} className="grid gap-3 py-4 sm:grid-cols-[1.2fr_1fr_1fr] sm:items-center"><div><p className="font-extrabold">{donor.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{donor.phone_masked || 'Masked'} · {donor.donor_kind === 'IMPORTED' ? 'Directory listing' : 'Registered donor'}</p></div><div className="text-sm"><p className="font-bold">{donor.latest_call_outcome?.replaceAll('_', ' ') || 'Contacted'}</p><p className="mt-1 text-xs text-slate-500">Reminder: {donor.reminder_state.replaceAll('_', ' ')}</p></div><div className="text-sm sm:text-right"><p className="font-bold text-primary">{donor.next_action}</p>{donor.final_state && <p className="mt-1 text-xs text-slate-500">{donor.final_state.replaceAll('_', ' ')}</p>}</div></div>)}
          </div>}
        </section>
      )}

      {/* Patient & Contact Details Section */}
      <section className="theme-card relative border border-slate-100 p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <UserIcon className="w-5 h-5 text-primary" /> Who is this request for?
            </h3>
            <p className="mt-1 text-sm font-medium text-slate-500">Patient and requester details for coordination.</p>
          </div>
          {isOwner && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4 fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Collection district</label>
                <select
                  value={editData.district}
                  onChange={e => setEditData({ ...editData, district: e.target.value, hospital_name: '' })}
                  className="input"
                >
                  {BD_LOCATION_NAMES.map(district => <option key={district}>{district}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Collection facility</label>
                <input
                  required
                  list="edit-registered-facilities"
                  type="text"
                  value={editData.hospital_name}
                  onChange={e => setEditData({ ...editData, hospital_name: e.target.value })}
                  className="input"
                  placeholder="Hospital or blood bank"
                />
                <datalist id="edit-registered-facilities">
                  {editFacilitySuggestions.map(facility => <option key={facility.registryCode} value={facility.name}>{facility.locality}</option>)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Full collection address</label>
                <input
                  required
                  type="text"
                  value={editData.hospital_address}
                  onChange={e => setEditData({ ...editData, hospital_address: e.target.value })}
                  className="input"
                  placeholder="Building, road, area"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Blood bank / ward / department</label>
                <input
                  type="text"
                  value={editData.ward}
                  onChange={e => setEditData({ ...editData, ward: e.target.value })}
                  className="input"
                  placeholder="For example, Transfusion Medicine"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Patient Name</label>
                <input
                  required
                  type="text" value={editData.patient_name} onChange={e => setEditData({...editData, patient_name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary text-sm font-medium outline-none" placeholder="Enter patient name..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Requester Name</label>
                <input 
                  type="text" value={editData.requester_name} onChange={e => setEditData({...editData, requester_name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary text-sm font-medium outline-none" placeholder="Who is requesting?"
                />
              </div>
              <div className="md:col-span-2 relative">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Needed By (Date)</label>
                <div className="relative">
                  <input 
                    type="date" value={editData.needed_by ? new Date(editData.needed_by).toISOString().slice(0, 10) : ''} 
                    onChange={e => setEditData({...editData, needed_by: e.target.value})}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary text-sm font-medium outline-none cursor-pointer"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 mt-2">Additional Contacts ({editData.contacts.length})</label>
              <div className="space-y-3">
                {editData.contacts.map((c: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <select 
                      value={c.type} 
                      onChange={e => {
                        const newContacts = [...editData.contacts];
                        newContacts[i].type = e.target.value;
                        setEditData({...editData, contacts: newContacts});
                      }}
                      className="w-1/3 px-3 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl focus:ring-2 focus:ring-primary text-xs font-bold outline-none transition-all"
                    >
                      <option value="PATIENT">Patient</option>
                      <option value="RELATIVE">Relative</option>
                      <option value="HOSPITAL">Hospital</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input 
                      type="text" 
                      value={c.name} 
                      onChange={e => {
                        const newContacts = [...editData.contacts];
                        newContacts[i].name = e.target.value;
                        setEditData({...editData, contacts: newContacts});
                      }}
                      className="w-1/3 px-3 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl focus:ring-2 focus:ring-primary text-xs font-medium outline-none transition-all" 
                      placeholder="Name" 
                    />
                    <input 
                      type="text" 
                      value={c.phone} 
                      onChange={e => {
                        const newContacts = [...editData.contacts];
                        newContacts[i].phone = e.target.value;
                        setEditData({...editData, contacts: newContacts});
                      }}
                      className="w-1/3 px-3 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl focus:ring-2 focus:ring-primary text-xs font-medium outline-none transition-all" 
                      placeholder="Phone" 
                    />
                    <button onClick={() => setEditData({...editData, contacts: editData.contacts.filter((_:any, idx:number) => idx !== i)})} className="px-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setEditData({...editData, contacts: [...editData.contacts, { type: 'RELATIVE', name: 'New Contact', phone: '' }]})}
                  className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3 h-3" /> Add Contact
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
               <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 text-slate-500 font-bold text-sm">Cancel</button>
               <button onClick={handleSaveDetails} className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-sm hover:bg-primary-dark">Save Changes</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 fade-in lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <dl className="overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-100 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
              <div className="p-4 sm:min-h-28">
                <dt className="request-metadata-label mb-1">Patient</dt>
                <dd className="font-bold text-slate-900">{request.patient_name || 'Name not provided'}</dd>
              </div>
              <div className="border-t border-slate-200 p-4 sm:min-h-28 sm:border-t-0">
                <dt className="request-metadata-label mb-1">Requested by</dt>
                <dd className="font-bold text-slate-900">{request.requester_name || 'Anonymous'}</dd>
              </div>
              <div className="border-t border-slate-200 p-4 sm:min-h-28 sm:border-t-0">
                <dt className="request-metadata-label mb-1">Needed by</dt>
                <dd className="flex items-center gap-2 font-bold text-slate-900">
                  <Calendar className="h-4 w-4 text-primary" />
                  {neededLabel}
                </dd>
              </div>
            </dl>

            <div className="grid gap-3">
              {request.contacts?.map((contact: any, index: number) => {
                const contactKey = `${contact.phone}-${index}`;
                return (
                  <div key={contactKey} className="flex min-h-28 items-stretch justify-between gap-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                    <div className="min-w-0 self-center">
                      <p className="request-metadata-label mb-1">{contact.type || 'Contact'}</p>
                      <p className="truncate font-bold text-slate-900">{contact.name || request.requester_name || 'Request contact'}</p>
                      <p className="mt-1 break-all text-sm font-semibold text-slate-600">{contact.phone}</p>
                    </div>
                    <div className="flex w-28 shrink-0 flex-col justify-center gap-2">
                      <a
                        href={`tel:${contact.phone}`}
                        aria-label={`Call ${contact.name || 'request contact'}`}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        <Phone className="h-4 w-4" /> Call
                      </a>
                      <button
                        type="button"
                        onClick={() => copyContact(contact.phone, contactKey)}
                        aria-label={`Copy ${contact.name || 'request contact'} phone number`}
                        aria-live="polite"
                        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        <Copy className="h-4 w-4" /> {copiedContact === contactKey ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Request-owner donor matches. Public viewers do not receive a fake zero. */}
      {isOwner && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
                <Users className="w-5 h-5 text-primary" /> Donors matching this request
              </h3>
              <p className="mt-1 text-sm font-medium text-slate-500">Registered donors and attributed public listings in {request.upazila || request.location.area_name}.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-extrabold text-primary">{data.match_total || 0} matches</span>
              <Link to={donorSearchPath} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-extrabold text-white shadow-sm hover:bg-primary-dark">Open donor search</Link>
            </div>
          </div>
          {matches.length === 0 ? (
            <div className="theme-card border border-slate-100 bg-white p-5 text-sm font-semibold text-slate-600 shadow-sm">No matching donor is listed in this upazila yet. Try a neighbouring upazila from donor search.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {matches.map(match => (
                <div key={match.donor_ref} className="theme-card flex items-center gap-4 border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-lg font-extrabold text-primary">{match.blood_group}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate font-extrabold text-slate-900">{match.name}</p>{match.donor_kind === 'REGISTERED' && <VerifiedBadge verified={Boolean(match.is_verified)} compact />}</div>
                    <p className="mt-1 font-mono text-xs font-semibold text-slate-500">{match.phone_masked} · {match.upazila}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{match.donor_kind === 'REGISTERED' ? 'Drop donor' : `Listed by ${match.source?.organization || 'a public directory'}`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Discussion / Comments Section */}
      <section className="theme-card border border-slate-100 p-5 shadow-sm md:p-6">
        <div className="mb-5">
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <MessageCircle className="w-5 h-5 text-primary" /> Updates & questions
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-500">Share useful public updates about this request.</p>
        </div>
        
        <div className="mb-5 space-y-5">
          {(!request.comments || request.comments.length === 0) ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">No updates yet.</p>
          ) : (
            request.comments.map((c: any) => (
              <div key={c.id} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold flex-shrink-0">
                  {c.user_name?.charAt(0) || '?'}
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl rounded-tl-none border border-slate-100 relative w-full group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-slate-900">{c.user_name}</span>
                    <span className="text-xs font-semibold text-slate-400">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{c.text}</p>
                  {(isOwner || (user && c.user_id === user.id)) && (
                    <button 
                      onClick={() => handleDeleteComment(c.id)}
                      className="absolute right-2 top-2 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {user && c.user_id !== user.id && <button onClick={() => setReportTarget({ type: 'COMMENT', id: c.id })} className="mt-2 text-xs font-bold text-slate-400 hover:text-red-600"><Flag className="inline w-3 h-3 mr-1" />Report</button>}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5">
          {!user && (
            <input 
              type="text" 
              value={anonName}
              onChange={e => setAnonName(e.target.value)}
              placeholder="Your Name (required)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-rose-100 sm:w-[240px]"
            />
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <input 
              type="text" 
              value={newComment} 
              onChange={e => setNewComment(e.target.value)}
              placeholder="Type your comment or question..."
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-rose-100 text-sm font-medium outline-none transition-all"
              onKeyDown={e => e.key === 'Enter' && submitComment()}
            />
            <button onClick={submitComment} className="min-h-11 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:bg-primary-dark active:scale-[0.98]">
              Post
            </button>
          </div>
          {!user && <p className="text-xs text-slate-500 font-medium">Commenting anonymously. Max 3/min. <Link to="/login" className="text-primary hover:underline">Log in</Link> for unlimited messaging.</p>}
        </div>
      </section>
    </div>
  );
}
