import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertCircle, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, Droplet, Edit2, Filter, Flag, Heart, Hospital, MapPin, MessageCircle, Phone, Plus, Search, Share2, Shield, Trash2, User as UserIcon, Users, Zap } from 'lucide-react';
import { api, BROWSER_FINGERPRINT } from '../lib/api';
import { BLOOD_GROUPS, compatibleDonorsFor, DONATION_INTERVAL_DAYS, getEligibility, getUrgency, URGENCY_ORDER } from '../lib/blood';
import {
  loadRegisteredCollectionFacilities,
  type RegisteredCollectionFacility
} from '../lib/collectionFacilities';
import { BD_LOCATION_NAMES, getLocationByName } from '../lib/locations';
import { cn } from '../lib/utils';
import { UrgencyBadge } from '../components/UrgencyBadge';
import VerifiedBadge from '../components/VerifiedBadge';
import ModalPortal from '../components/ModalPortal';

export default function RequestDetailsPage({ user }: { user: any }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<{ request: any, matches: any[], responses?: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // UI States
  const [inviting, setInviting] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [anonName, setAnonName] = useState('');
  const [copied, setCopied] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'REQUEST' | 'COMMENT', id: string } | null>(null);
  const [reportReason, setReportReason] = useState('OTHER');
  const [reportDetails, setReportDetails] = useState('');

  const shareRequest = (target: 'copy' | 'whatsapp') => {
    if (!data) return;
    const url = window.location.href;
    const neededText = data.request.needed_by
      ? `by ${new Date(data.request.needed_by).toLocaleDateString('en-GB')}`
      : 'ASAP';
    const text = `URGENT: ${data.request.blood_group} blood needed in ${data.request.location.area_name} ${neededText}. Details & contact: ${url}`;
    if (target === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
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
  }, [id, navigate]);

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

  const inviteDonor = async (donorId: string) => {
    if (!data) return;
    setInviting(donorId);
    setActionMessage(null);
    try {
      const response = await api.inviteDonor(data.request.id, donorId);
      setData({ ...data, responses: [...(data.responses || []), response] });
      setActionMessage({ type: 'success', text: 'Private invitation sent. Contact details remain hidden until the donor accepts.' });
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message || 'Could not invite donor.' });
    } finally {
      setInviting('');
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

  if (loading) return <div className="flex justify-center p-12"><div className="w-10 h-10 border-[3px] border-rose-100 border-t-primary rounded-full animate-spin"></div></div>;
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

  return (
    <div className="mx-auto max-w-6xl space-y-8 fade-in">
      <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
        <Link to="/requests" className="text-slate-400 hover:text-slate-900 transition-colors">
          &larr; Back
        </Link>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Request Dashboard</h2>
        {user && !isOwner && <button onClick={() => setReportTarget({ type: 'REQUEST', id: request.id })} className="ml-auto text-xs font-bold text-slate-500 hover:text-red-600 flex items-center gap-1"><Flag className="w-4 h-4" /> Report</button>}
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
      <div className="theme-card p-6 md:p-8 bg-white border border-slate-200 shadow-sm relative overflow-hidden">
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

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-0">
          <div className="flex items-start gap-5">
             <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-700 text-2xl md:text-3xl font-extrabold shadow-sm flex-shrink-0">
               {request.blood_group}
             </div>
             <div>
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span className="bg-green-100 text-green-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm border border-green-200">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> Active
                  </span>
                  <UrgencyBadge neededBy={request.needed_by} />
                  <span className="text-xs font-bold text-slate-400">ID: #{request.id.split('-')[1]}</span>
                </div>
                <h1 className="mt-2 flex items-start gap-2 text-xl font-bold text-slate-900 md:text-2xl">
                  <Hospital className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>{request.hospital_name || 'Collection facility'}</span>
                </h1>
                <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <span>{request.hospital_address ? `${request.hospital_address}, ` : ''}{request.location.area_name}</span>
                </p>
                {request.ward && <p className="mt-1 pl-5 text-xs font-semibold text-slate-500">{request.ward}</p>}
                 <p className="text-sm font-semibold text-slate-500 flex items-center gap-1.5 mt-2">
                   <Calendar className="w-4 h-4 text-primary" />
                   Needed: <span className="text-slate-700">{request.needed_by ? new Date(request.needed_by).toLocaleDateString() : 'ASAP'}</span>
                 </p>
                 <p className="text-sm font-semibold text-slate-600 mt-2">
                   {request.units_required || 1} unit(s) · {(request.blood_component || 'WHOLE_BLOOD').replaceAll('_', ' ').toLowerCase()}
                 </p>
                <p className="text-xs font-semibold text-slate-500 mt-2 flex items-center gap-1.5 flex-wrap">
                  <Droplet className="w-3.5 h-3.5 text-primary" /> Compatible donors:
                  {compatibleDonorsFor(request.blood_group).map(g => (
                    <span key={g} className="px-1.5 py-0.5 bg-white border border-red-100 rounded-md text-red-700 font-bold text-[11px]">{g}</span>
                  ))}
                </p>
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

        {request.status === 'ACTIVE' && (
          <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-100 relative z-0">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mr-1">Spread the word</span>
            <button
              onClick={() => shareRequest('whatsapp')}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" /> WhatsApp
            </button>
            <button
              onClick={() => shareRequest('copy')}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
            >
              <Copy className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        )}
      </div>

      {/* Patient & Contact Details Section */}
      <div className="theme-card p-6 border border-slate-100 shadow-sm relative">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900">
            <UserIcon className="w-5 h-5 text-primary" /> Patient & Contact Info
          </h3>
          {isOwner && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="text-sm font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1">
              <Edit2 className="w-4 h-4" /> Edit Details
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 fade-in">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Patient Name</p>
              <p className="font-semibold text-slate-900">{request.patient_name || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Requested By</p>
              <p className="font-semibold text-slate-900">{request.requester_name || 'Anonymous'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Needed By</p>
              <p className="font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                {request.needed_by ? new Date(request.needed_by).toLocaleDateString('en-GB') : 'As soon as possible'}
              </p>
            </div>
            
            <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-2">
               <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Contact Details</p>
               {request.contacts === undefined ? (
                 <p className="text-sm font-medium text-slate-500 italic">
                   Contact details are shared only after a donor response is accepted.
                 </p>
               ) : request.contacts.length === 0 && (
                 <p className="text-sm font-medium text-slate-500 italic">No secondary contacts provided. Respond through normal channels to reveal primary phone number.</p>
               )}
               <div className="grid gap-3">
                 {request.contacts?.map((c: any, i: number) => (
                   <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                     <div>
                       <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400">{c.type}</span>
                       <p className="font-bold text-slate-900">{c.name}</p>
                     </div>
                     <a href={`tel:${c.phone}`} className="text-primary font-bold tracking-wide hover:underline mt-2 sm:mt-0 flex items-center gap-1.5">
                       <Phone className="w-3.5 h-3.5" /> {c.phone}
                     </a>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Potential Donors Section */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900">
           <Users className="w-5 h-5 text-primary" /> Potential Donors Nearby ({matches.length})
        </h3>
        {matches.length === 0 ? (
          <div className="theme-card p-10 text-center border border-slate-100 shadow-sm bg-slate-50/50">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-700 font-bold text-lg">No donors are currently available in this specific area.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {matches.map((m, i) => (
              <div key={i} className="theme-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-rose-200 border border-slate-100 transition-colors shadow-sm bg-white">
                <div className="flex items-center gap-5 flex-1">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl overflow-hidden bg-slate-50 flex-shrink-0 flex items-center justify-center text-primary text-xl font-extrabold border border-slate-100">
                    {m.blood_group}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg text-slate-900">{m.name}</span>
                      <VerifiedBadge verified={Boolean(m.is_verified)} compact />
                      <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Available</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-500 mt-1 flex items-center gap-2">
                      <span>{m.distance_km} km away</span>
                      <span>•</span>
                      <span>Active Donor</span>
                    </div>
                  </div>
                </div>
                {!data.responses?.some(response => response.donor_id === m.user_id && !['DECLINED', 'CANCELLED', 'NO_SHOW'].includes(response.status)) && (
                  <div className="flex-shrink-0 md:w-32">
                    <button disabled={inviting === m.user_id} onClick={() => inviteDonor(m.user_id)} className="w-full px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-transform hover:bg-primary-dark shadow-sm disabled:opacity-50">
                      {inviting === m.user_id ? 'Sending…' : 'Invite donor'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discussion / Comments Section */}
      <div className="theme-card p-6 border border-slate-100 shadow-sm mt-8">
        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 mb-6">
          <MessageCircle className="w-5 h-5 text-primary" /> Discussion & Updates
        </h3>
        
        <div className="space-y-5 mb-8">
          {(!request.comments || request.comments.length === 0) ? (
            <p className="text-slate-500 text-sm font-medium text-center py-4 italic">No comments yet. Be the first to ask a question or provide an update!</p>
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

        <div className="flex flex-col gap-3">
          {!user && (
            <input 
              type="text" 
              value={anonName}
              onChange={e => setAnonName(e.target.value)}
              placeholder="Your Name (required)"
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-rose-100 text-sm font-medium outline-none transition-all w-[240px]"
            />
          )}
          <div className="flex gap-3">
            <input 
              type="text" 
              value={newComment} 
              onChange={e => setNewComment(e.target.value)}
              placeholder="Type your comment or question..."
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-rose-100 text-sm font-medium outline-none transition-all"
              onKeyDown={e => e.key === 'Enter' && submitComment()}
            />
            <button onClick={submitComment} className="px-5 py-3 bg-primary text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-transform shadow-sm hover:bg-primary-dark">
              Post
            </button>
          </div>
          {!user && <p className="text-xs text-slate-500 font-medium">Commenting anonymously. Max 3/min. <Link to="/login" className="text-primary hover:underline">Log in</Link> for unlimited messaging.</p>}
        </div>
      </div>
    </div>
  );
}
