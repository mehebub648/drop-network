import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Droplet, Heart, MapPin, Search, Shield, Users, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { DONATION_INTERVAL_DAYS } from '../lib/blood';
import { BD_LOCATION_NAMES, getLocationByName } from '../lib/locations';
import { cn } from '../lib/utils';

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
    <div className="space-y-16 sm:space-y-24 w-full pb-10">
      {/* Hero Section */}
      <div className="space-y-12">
        <section className="text-center px-1 sm:px-4 fade-in pt-3 sm:pt-6 pb-2">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-4">Community blood coordination across Bangladesh</p>
          <h1 className="text-4xl sm:text-5xl md:text-[4rem] font-extrabold tracking-tight text-slate-900 leading-[1.08] mb-6">
            Start a clear, verified request<br className="hidden md:block" /> and reach available donors.
          </h1>
          <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
            Choose the required blood group, district, and date. Drop helps a verified requester coordinate privately with compatible donors who have marked themselves available.
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
          <CheckCircle2 className="w-4 h-4 inline text-emerald-500 mr-1 -mt-0.5" /> Search is based on current donor availability and supported districts
        </p>
      </div>

      <section className="fade-in pt-12">
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">How Drop Works</h2>
          <p className="text-slate-500 font-medium max-w-2xl mx-auto leading-7">Drop organizes the information needed for safer coordination. It does not replace clinical screening, a hospital, or a licensed blood bank.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          <div className="theme-card p-6 sm:p-8">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-5 text-primary">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">1. Prepare the request</h3>
            <p className="text-slate-500 text-sm leading-6">Confirm the patient reference, hospital, blood component, units, needed-by time, and a reliable contact before publishing.</p>
          </div>
          
          <div className="theme-card p-6 sm:p-8">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-5 text-primary">
              <Zap className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">2. Review current matches</h3>
            <p className="text-slate-500 text-sm leading-6">Drop checks compatible blood groups, district proximity, donation interval, deferrals, and the donor's latest availability confirmation.</p>
          </div>
          
          <div className="theme-card p-6 sm:p-8">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-5 text-primary">
              <Shield className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">3. Coordinate privately</h3>
            <p className="text-slate-500 text-sm leading-6">Invite suitable donors, reveal contact details only through the response workflow, and complete the donation at an appropriate clinical facility.</p>
          </div>
        </div>
      </section>

      <section className="theme-card p-6 sm:p-9 lg:p-12 overflow-hidden relative fade-in border-0 bg-slate-900 text-white shadow-2xl shadow-slate-900/20">
        <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-10">
          <Droplet className="w-64 h-64 text-primary" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-bold mb-5 text-white">A useful donor network depends on accurate availability.</h2>
          <p className="text-slate-300 text-base sm:text-lg mb-8 leading-7">
            Donors should pause availability when they are unwell, travelling, deferred, or unable to respond. Requesters should close completed or cancelled requests promptly so people can focus on current needs.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Users, value: stats?.registered_donors, label: 'Registered Donors' },
              { icon: Zap, value: stats?.available_donors, label: 'Available Now' },
              { icon: Activity, value: stats?.active_requests, label: 'Active Requests' },
              { icon: Heart, value: stats?.fulfilled_requests, label: 'Fulfilled' }
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className="w-10 h-10 text-primary" />
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold leading-none text-white">{value ?? '—'}</div>
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

      <section className="grid lg:grid-cols-2 gap-5 sm:gap-6 fade-in">
        <div className="theme-card border border-slate-100 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-slate-900">Before publishing a request</h2>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />Confirm the requirement with the treating hospital or blood bank.</li>
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />Use a patient reference instead of publishing unnecessary medical details.</li>
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />Provide a contact who can answer promptly and verify the facility location.</li>
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />Never offer payment for blood or share passwords, OTPs, or financial credentials.</li>
          </ul>
        </div>
        <div className="theme-card border border-slate-100 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-slate-900">Privacy and clinical safety</h2>
          <p className="mt-5 text-sm leading-6 text-slate-600">Public request listings omit phone numbers and private patient references. Contact information is shared through authenticated coordination steps. A match is only a lead: the receiving facility remains responsible for identity checks, donor screening, testing, collection, and clinical decisions.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link to="/safety" className="px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold text-center">Read safety guidance</Link>
            <Link to="/privacy" className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold text-center">Review privacy</Link>
          </div>
        </div>
      </section>

      <section className="fade-in max-w-3xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Can I Donate?</h2>
          <p className="text-slate-500 font-medium leading-7">These are coordination reminders, not medical clearance. The collection facility makes the final decision after screening.</p>
        </div>
        <div className="space-y-3">
          {[
            { q: 'Who decides whether I can donate?', a: 'Qualified staff at the hospital or blood collection facility make the final decision after reviewing your health, donation history, medicines, and required screening.' },
            { q: 'Why does Drop use a donation interval?', a: `Drop uses a configurable ${DONATION_INTERVAL_DAYS}-day whole-blood interval as a conservative matching safeguard. Local clinical policy and the facility's assessment always take priority.` },
            { q: 'What should I do before travelling to donate?', a: 'Confirm the patient reference, facility, required blood component, time, and official contact. Do not travel based only on an unverified social post or payment request.' },
            { q: 'What should I bring?', a: 'Follow the receiving facility’s instructions. They may require identification and information about recent health, medicines, travel, or previous donations.' },
            { q: 'How is my phone number protected?', a: 'Phone numbers are not included in public request lists. Contact details are shared only through authenticated, purpose-limited coordination steps.' },
            { q: 'Can Drop guarantee a donor or successful collection?', a: 'No. Availability can change, and every potential donor must pass the receiving facility’s checks. Keep coordinating with the hospital or blood bank until the need is resolved.' }
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

      <section className="theme-card border border-rose-100 bg-rose-50/60 p-6 sm:p-9 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Ready to help the next verified request?</h2>
          <p className="mt-3 text-slate-600 leading-7">Create a donor profile, keep your availability current, and respond only when you can safely reach the named clinical facility.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <Link to={user ? '/profile/donor' : '/register'} className="px-6 py-3.5 rounded-xl bg-primary text-white text-sm font-bold text-center">{user ? 'Update availability' : 'Become a donor'}</Link>
          <Link to="/requests" className="px-6 py-3.5 rounded-xl bg-white border border-rose-200 text-slate-800 text-sm font-bold text-center">View live requests</Link>
        </div>
      </section>
    </div>
  );
}
