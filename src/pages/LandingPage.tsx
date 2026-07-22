import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertCircle, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, Droplet, Edit2, Filter, Heart, MapPin, MessageCircle, Phone, Plus, Search, Share2, Shield, Trash2, Users, Zap } from 'lucide-react';
import { api, BROWSER_FINGERPRINT } from '../lib/api';
import { BLOOD_GROUPS, compatibleDonorsFor, DONATION_INTERVAL_DAYS, getEligibility, getUrgency, URGENCY_ORDER } from '../lib/blood';
import { BD_LOCATION_NAMES, getLocationByName } from '../lib/locations';
import { cn } from '../lib/utils';
import { UrgencyBadge } from '../components/UrgencyBadge';

export default function LandingPage({ user }: { user: any }) {
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [neededBy, setNeededBy] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  const [locationSearch, setLocationSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [revealedContacts, setRevealedContacts] = useState<Record<string, boolean>>({});
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [stats, setStats] = useState<{ registered_donors: number; available_donors: number; active_requests: number; fulfilled_requests: number } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getStats().then(setStats).catch(() => setStats(null));
  }, []);

  const handleSearch = async () => {
    setSearching(true);
    setSearchError('');
    try {
      const requestedLocation = selectedLocation || locationSearch || 'Dhaka';
      const location = getLocationByName(requestedLocation);
      if (!location) {
        setSearchError('Choose a supported district from the list.');
        setSearching(false);
        return;
      }

      setTimeout(() => {
        setSearching(false);
        const query = new URLSearchParams({ blood_group: bloodGroup, district: location.area_name });
        if (neededBy) query.set('needed_by', neededBy);
        navigate(user ? `/request/new?${query}` : '/login');
      }, 250);
    } catch (e: any) {
      setSearchError(e.message || 'Unable to create request.');
      setSearching(false);
    }
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
       days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const isSelected = neededBy === currentDateStr;
        const isToday = new Date().toDateString() === new Date(year, month, i).toDateString();
        
        days.push(
           <button
             key={i}
             onClick={() => {
                setNeededBy(currentDateStr);
                setIsDatePickerOpen(false);
             }}
             className={cn(
               "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
               isSelected ? "bg-primary text-white shadow-md shadow-rose-200" :
               isToday ? "bg-rose-50 text-primary border border-rose-100" :
               "text-slate-700 hover:bg-slate-100"
             )}
           >
             {i}
           </button>
        );
    }
    return days;
  };

  return (
    <div className="space-y-24 w-full pb-10">
      {/* Hero Section */}
      <div className="space-y-12">
        <section className="text-center px-4 fade-in pt-6 pb-2">
          <h1 className="text-[2.75rem] md:text-[4rem] font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
            Find a life-saving match<br className="hidden md:block" />
            <span className="text-primary relative inline-block ml-3">
              instantly
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-rose-200" viewBox="0 0 100 20" preserveAspectRatio="none">
                <path d="M0 15 Q 50 0 100 15" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </span>.
          </h1>
          <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
            Search for available blood donors near you in real-time. No sign-up required.
          </p>
        </section>

        <div className="max-w-4xl mx-auto bg-white p-3 md:p-3 rounded-[2rem] relative overflow-visible transition-all duration-300 shadow-xl shadow-rose-900/5 border border-slate-100 z-30">
          {searching && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-md z-40 rounded-[2rem] flex flex-col items-center justify-center fade-in">
              <div className="w-8 h-8 border-[3px] border-rose-100 border-t-primary rounded-full animate-spin"></div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-2 relative">
            {/* Blood Group */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Droplet className="w-5 h-5 text-rose-400" />
              </div>
              <select 
                value={bloodGroup}
                onChange={e => setBloodGroup(e.target.value)}
                className="w-full pl-12 pr-10 py-4 bg-slate-50 hover:bg-slate-100 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary font-bold text-slate-900 appearance-none outline-none transition-all cursor-pointer h-full min-h-[56px]"
              >
                <option value="" disabled>Blood Group</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Location */}
            <div className="flex-[1.5] relative" onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}>
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none group-focus-within:text-primary">
                <MapPin className="w-5 h-5 text-slate-400" />
              </div>
              <input 
                type="text" 
                className="w-full pl-11 pr-4 py-4 bg-slate-50 hover:bg-slate-100 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary font-semibold text-slate-900 placeholder:text-slate-500 outline-none transition-all h-full min-h-[56px]" 
                placeholder="District (e.g. Dhaka)"
                value={isDropdownOpen ? locationSearch : selectedLocation || locationSearch}
                onChange={(e) => {
                  setLocationSearch(e.target.value);
                  setIsDropdownOpen(true);
                  if (!e.target.value) setSelectedLocation('');
                }}
                onFocus={() => setIsDropdownOpen(true)}
              />
              
              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 shadow-xl rounded-2xl max-h-60 overflow-y-auto left-0 md:-left-2 md:w-[calc(100%+16px)]">
                  {BD_LOCATION_NAMES.filter(loc => loc.toLowerCase().includes(locationSearch.toLowerCase())).map(loc => (
                    <button
                      key={loc}
                      type="button"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedLocation(loc);
                        setLocationSearch('');
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-5 py-3 hover:bg-slate-50 font-medium text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                    >
                      {loc}
                    </button>
                  ))}
                  {BD_LOCATION_NAMES.filter(loc => loc.toLowerCase().includes(locationSearch.toLowerCase())).length === 0 && (
                    <div className="px-5 py-4 text-sm text-slate-500 text-center font-medium">No districts found</div>
                  )}
                </div>
              )}
            </div>

            {/* Date Requirement */}
            <div className="flex-[1.5] relative" tabIndex={-1} onBlur={(e) => {
               if (!e.currentTarget.contains(e.relatedTarget)) {
                  setTimeout(() => setIsDatePickerOpen(false), 200);
               }
            }}>
              <button 
                type="button"
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className={cn(
                  "w-full text-left pl-6 pr-4 py-4 border-none rounded-2xl font-semibold text-sm md:text-base outline-none transition-all h-full min-h-[56px] cursor-pointer flex justify-between items-center group relative",
                  isDatePickerOpen ? "bg-white ring-2 ring-primary shadow-sm" : "bg-slate-50 hover:bg-slate-100",
                  neededBy ? "text-slate-900" : "text-slate-500"
                )}
              >
                <span>{neededBy ? new Date(neededBy).toLocaleDateString('en-GB') : "dd/mm/yyyy"}</span>
                <Calendar className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </button>

              {isDatePickerOpen && (
                <div 
                  className="absolute z-50 w-[280px] p-4 mt-2 bg-white border border-slate-100 shadow-2xl shadow-rose-900/10 rounded-3xl left-1/2 -translate-x-1/2 md:translate-x-0 md:-left-2 fade-in"
                  onPointerDown={e => e.preventDefault()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() - 1))); }}
                      className="p-1.5 hover:bg-rose-50 rounded-xl text-slate-600 hover:text-primary transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="font-bold text-[13px] uppercase tracking-wider text-slate-700">
                      {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() + 1))); }}
                      className="p-1.5 hover:bg-rose-50 rounded-xl text-slate-600 hover:text-primary transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div key={i} className="text-[10px] font-bold text-slate-400">{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 place-items-center">
                    {renderCalendar()}
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex-1 min-w-[140px]">
              <button 
                onClick={handleSearch}
                className="w-full h-full min-h-[56px] py-4 bg-primary text-white rounded-2xl font-bold text-[15px] shadow-[0_8px_20px_-4px_rgba(225,29,72,0.3)] hover:shadow-[0_12px_24px_-4px_rgba(225,29,72,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Search className="w-5 h-5" /> <span>Search</span>
              </button>
            </div>
          </div>
        </div>
        {searchError && (
          <div className="max-w-4xl mx-auto mt-3 px-5 py-3 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">
            {searchError}
          </div>
        )}
        <p className="text-center text-sm text-slate-500 font-medium">
          <CheckCircle2 className="w-4 h-4 inline text-emerald-500 mr-1 -mt-0.5" /> Matches are realtime and location-based
        </p>
      </div>

      {/* Informative Sections */}
      <section className="fade-in pt-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">How Drop Works</h2>
          <p className="text-slate-500 font-medium max-w-lg mx-auto">A seamless emergency response system designed specifically for the healthcare needs of Bangladesh.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="theme-card p-8 text-center hover:-translate-y-1 transition-transform duration-300">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">1. Real-time Search</h3>
            <p className="text-slate-500 text-sm leading-relaxed">Search supported Bangladesh districts to find active donors rather than broadcasting open pleas.</p>
          </div>
          
          <div className="theme-card p-8 text-center hover:-translate-y-1 transition-transform duration-300">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary">
              <Zap className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">2. Smart Matching</h3>
            <p className="text-slate-500 text-sm leading-relaxed">Our algorithm considers exact geolocation, time requirements, and live availability statuses.</p>
          </div>
          
          <div className="theme-card p-8 text-center hover:-translate-y-1 transition-transform duration-300">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary">
              <Shield className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">3. Secure Contact</h3>
            <p className="text-slate-500 text-sm leading-relaxed">Review request details first, then contact available donors directly when you are ready to respond.</p>
          </div>
        </div>
      </section>

      <section className="theme-card p-12 overflow-hidden relative fade-in border-0 bg-slate-900 text-white shadow-2xl shadow-slate-900/20">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Droplet className="w-64 h-64 text-primary" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <h2 className="text-3xl font-bold mb-6 text-white">Building a live donor network for urgent requests.</h2>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            Keep your donor status current so matching can prioritize the right blood group, district, and availability when a nearby request is created.
          </p>
          <div className="flex flex-wrap gap-x-10 gap-y-6 items-center">
            {[
              { icon: Users, value: stats?.registered_donors, label: 'Registered Donors' },
              { icon: Zap, value: stats?.available_donors, label: 'Available Now' },
              { icon: Activity, value: stats?.active_requests, label: 'Active Requests' },
              { icon: Heart, value: stats?.fulfilled_requests, label: 'Fulfilled' }
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className="w-10 h-10 text-primary" />
                <div>
                  <div className="text-3xl font-extrabold leading-none text-white">{value ?? '—'}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">{label}</div>
                </div>
              </div>
            ))}
          </div>
          {!user && (
            <Link to="/register" className="inline-block mt-10 px-8 py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg shadow-rose-900/40 active:scale-[0.98] transition-transform">
              Become a Donor
            </Link>
          )}
        </div>
      </section>

      {/* Blood Compatibility Chart */}
      <section className="fade-in">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Who Can Donate to Whom?</h2>
          <p className="text-slate-500 font-medium max-w-lg mx-auto">
            You don't need an exact match — these groups are medically compatible. Drop's matching already includes them automatically.
          </p>
        </div>
        <div className="theme-card border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Patient</th>
                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Can receive from</th>
              </tr>
            </thead>
            <tbody>
              {BLOOD_GROUPS.map(group => (
                <tr key={group} className="border-b border-slate-50 last:border-0 hover:bg-rose-50/30 transition-colors">
                  <td className="px-6 py-3.5">
                    <span className="inline-flex items-center justify-center w-11 h-9 bg-rose-50 border border-rose-100 rounded-lg text-primary font-extrabold">{group}</span>
                    {group === 'AB+' && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">Universal recipient</span>}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {compatibleDonorsFor(group).map(d => (
                        <span key={d} className={cn(
                          'px-2 py-0.5 rounded-md font-bold text-xs border',
                          d === 'O-' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-600'
                        )}>{d}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-xs text-slate-400 font-medium mt-3">
          <span className="text-emerald-600 font-bold">O−</span> is the universal donor and works for every patient.
        </p>
      </section>

      {/* Eligibility FAQ */}
      <section className="fade-in max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Can I Donate?</h2>
          <p className="text-slate-500 font-medium">Quick answers to the most common questions from donors in Bangladesh.</p>
        </div>
        <div className="space-y-3">
          {[
            { q: 'Who can donate blood?', a: 'Generally healthy adults aged 18–60, weighing at least 50 kg, with no recent serious illness. A quick screening at the donation point makes the final call.' },
            { q: 'How often can I donate?', a: `Whole blood can be donated safely about every ${DONATION_INTERVAL_DAYS} days (roughly 3–4 months). Your body fully replaces the donated blood well within that window.` },
            { q: 'Does donating hurt or make me weak?', a: 'Only a brief pinch. The donation takes 10–15 minutes, and most donors are back to normal the same day. Rest, drink water, and avoid heavy lifting for a few hours.' },
            { q: 'Should I eat before donating?', a: 'Yes — have a proper meal and plenty of water within 3 hours before donating. Avoid donating on an empty stomach.' },
            { q: 'Is my information safe on Drop?', a: 'Your phone number is only shown to logged-in members responding to a request, and you control your availability status at all times.' }
          ].map(({ q, a }) => (
            <details key={q} className="theme-card border border-slate-100 shadow-sm group">
              <summary className="px-6 py-4 font-bold text-slate-900 cursor-pointer list-none flex items-center justify-between hover:text-primary transition-colors">
                {q}
                <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="px-6 pb-5 text-sm text-slate-500 leading-relaxed font-medium">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
