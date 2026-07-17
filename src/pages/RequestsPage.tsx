import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertCircle, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, Droplet, Edit2, Filter, Heart, MapPin, MessageCircle, Phone, Plus, Search, Share2, Shield, Trash2, Users, Zap } from 'lucide-react';
import { api, BROWSER_FINGERPRINT } from '../lib/api';
import { BLOOD_GROUPS, compatibleDonorsFor, DONATION_INTERVAL_DAYS, getEligibility, getUrgency, URGENCY_ORDER } from '../lib/blood';
import { BD_LOCATION_NAMES, getLocationByName } from '../lib/locations';
import { cn } from '../lib/utils';
import { UrgencyBadge } from '../components/UrgencyBadge';

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);

  useEffect(() => {
    async function loadRequests() {
      try {
        const data = await api.getRequests();
        setRequests(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadRequests();
  }, []);

  const filtered = useMemo(() => {
    return requests
      .filter(r => !groupFilter || r.blood_group === groupFilter)
      .filter(r => !districtFilter || r.location.area_name === districtFilter)
      .filter(r => !urgentOnly || getUrgency(r.needed_by) !== 'SCHEDULED')
      .sort((a, b) => {
        const urgencyDiff = URGENCY_ORDER[getUrgency(a.needed_by)] - URGENCY_ORDER[getUrgency(b.needed_by)];
        if (urgencyDiff !== 0) return urgencyDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [requests, groupFilter, districtFilter, urgentOnly]);

  const hasFilters = Boolean(groupFilter || districtFilter || urgentOnly);

  return (
    <div className="max-w-4xl mx-auto space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Live Blood Requests</h1>
        <p className="text-slate-500 font-medium">Real-time feed of patients needing urgent blood donors across Bangladesh.</p>
      </div>

      <div className="theme-card p-4 border border-slate-100 shadow-sm flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mr-1">
          <Filter className="w-3.5 h-3.5" /> Filter
        </span>
        <select
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold text-sm text-slate-700 outline-none appearance-none cursor-pointer"
        >
          <option value="">All groups</option>
          {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
        </select>
        <select
          value={districtFilter}
          onChange={e => setDistrictFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold text-sm text-slate-700 outline-none appearance-none cursor-pointer"
        >
          <option value="">All districts</option>
          {BD_LOCATION_NAMES.map(loc => <option key={loc} value={loc}>{loc}</option>)}
        </select>
        <button
          onClick={() => setUrgentOnly(!urgentOnly)}
          className={cn(
            'px-4 py-2.5 rounded-xl font-bold text-sm transition-colors',
            urgentOnly ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          )}
        >
          Urgent only
        </button>
        {hasFilters && (
          <button
            onClick={() => { setGroupFilter(''); setDistrictFilter(''); setUrgentOnly(false); }}
            className="px-3 py-2.5 text-sm font-bold text-primary hover:underline"
          >
            Clear
          </button>
        )}
        {!loading && (
          <span className="ml-auto text-sm font-semibold text-slate-400">
            {filtered.length} of {requests.length} request{requests.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="theme-card p-6 border border-slate-100 shadow-sm animate-pulse flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex-shrink-0"></div>
              <div className="flex-1 space-y-3">
                <div className="h-3 bg-slate-100 rounded w-1/3"></div>
                <div className="h-4 bg-slate-100 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="theme-card p-12 text-center border border-slate-100 shadow-sm">
          <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-bold">
            {hasFilters ? 'No requests match these filters.' : 'No active requests right now.'}
          </p>
          <p className="text-slate-400 text-sm mt-2">
            {hasFilters ? 'Try widening your search.' : 'The network is currently clear.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(req => (
            <div key={req.id} className="theme-card p-6 flex flex-col md:flex-row md:items-center gap-6 hover:border-rose-200 border border-transparent transition-colors shadow-sm">
              <div className="flex items-center gap-6 flex-1">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-rose-50 flex-shrink-0 flex items-center justify-center text-primary text-2xl font-extrabold shadow-sm border border-rose-100">
                  {req.blood_group}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <UrgencyBadge neededBy={req.needed_by} />
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-100 text-rose-700">
                      Needed: {req.needed_by ? new Date(req.needed_by).toLocaleDateString() : 'ASAP'}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 flex items-center gap-1.5 mt-1">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {req.location.area_name}
                  </h3>
                  {req.comment_count > 0 && (
                    <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> {req.comment_count} update{req.comment_count === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 md:w-32">
                <Link to={`/request/${req.id}`} className="w-full block text-center px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-transform hover:bg-slate-800">
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

