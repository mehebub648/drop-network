import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate, useParams } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { api, BROWSER_FINGERPRINT } from './lib/api';
import { Droplet, Heart, User as UserIcon, LogOut, CheckCircle2, MapPin, Search, Activity, ChevronDown, ChevronLeft, ChevronRight, Shield, Zap, Users, AlertCircle, Clock, MessageCircle, Plus, Trash2, Calendar, Edit2, Phone } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Global Auth State
let globalToken = localStorage.getItem('auth_token') || '';

const BD_LOCATIONS = [
  { area: 'Dhaka', lat: 23.8103, lng: 90.4125 },
  { area: 'Chittagong', lat: 22.3569, lng: 91.7832 },
  { area: 'Sylhet', lat: 24.8949, lng: 91.8687 },
  { area: 'Rajshahi', lat: 24.3636, lng: 88.6241 },
  { area: 'Khulna', lat: 22.8456, lng: 89.5403 },
  { area: 'Barisal', lat: 22.7010, lng: 90.3535 },
  { area: 'Rangpur', lat: 25.7439, lng: 89.2752 },
  { area: 'Mymensingh', lat: 24.7471, lng: 90.4203 },
  { area: 'Comilla', lat: 23.4607, lng: 91.1809 },
  { area: 'Narayanganj', lat: 23.6337, lng: 90.5000 },
  { area: 'Gazipur', lat: 23.9999, lng: 90.4203 },
  { area: 'Bogra', lat: 24.8465, lng: 89.3778 },
  { area: 'Jessore', lat: 23.1634, lng: 89.2182 },
  { area: 'Dinajpur', lat: 25.6217, lng: 88.6355 },
  { area: 'Pabna', lat: 24.0044, lng: 89.2504 },
  { area: "Cox's Bazar", lat: 21.4272, lng: 92.0058 }
];

const BD_LOCATION_NAMES = BD_LOCATIONS.map(location => location.area);

function getLocationByName(name: string) {
  const normalized = name.trim().toLowerCase();
  const location = BD_LOCATIONS.find(item => item.area.toLowerCase() === normalized);
  return location ? { lat: location.lat, lng: location.lng, area_name: location.area } : null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  declare props: Readonly<{ children: React.ReactNode }>;
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="theme-card p-10 text-center border border-slate-100 max-w-md">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-slate-500 font-medium">Refresh the page or return to the request list.</p>
            <Link to="/requests" className="inline-block mt-5 text-primary font-bold hover:underline">View requests</Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function LoginPage({ onLogin }: { onLogin: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(phone, password);
      localStorage.setItem('auth_token', res.token);
      globalToken = res.token;
      await onLogin();
      navigate('/profile');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md theme-card p-8 border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center">
            <Droplet className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-center mb-2">Welcome Back</h2>
        <p className="text-slate-500 text-center mb-8">Log in to your Drop account</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold text-center">{error}</div>}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Phone Number</label>
            <input 
              type="tel" 
              required
              className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none transition-all"
              placeholder="+1 234 567 8900"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Password</label>
            <input 
              type="password" 
              required
              className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button disabled={loading} className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg shadow-rose-200 active:scale-[0.98] transition-transform mt-2 disabled:opacity-50">
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <p className="text-center mt-6 text-sm font-medium text-slate-500">
          Don't have an account? <Link to="/register" className="text-primary hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}

function RegisterPage({ onLogin }: { onLogin: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'INFO'>('PHONE');
  
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [selectedLocation, setSelectedLocation] = useState('Dhaka');
  const [devOtp, setDevOtp] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const otpResponse = await api.sendOtp(phone);
      setDevOtp(otpResponse.dev_otp || '');
      setStep('OTP');
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.verifyOtp(phone, otp);
      setStep('INFO');
    } catch (e: any) {
      setError(e.message || 'Invalid OTP');
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const location = getLocationByName(selectedLocation);
      if (!location) throw new Error('Choose a supported district');

      const res = await api.register(phone, name, password, bloodGroup, location);
      localStorage.setItem('auth_token', res.token);
      globalToken = res.token;
      await onLogin();
      navigate('/profile');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md theme-card p-8 border border-slate-100 relative overflow-hidden">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center">
            <Droplet className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-center mb-2">Join Drop</h2>
        <p className="text-slate-500 text-center mb-8">Create your donor account</p>
        
        {step === 'PHONE' && (
          <form onSubmit={handleSendOtp} className="space-y-4 fade-in">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold text-center">{error}</div>}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Phone Number</label>
              <input 
                type="tel" 
                required
                className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none transition-all"
                placeholder="+880 1712 345678"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
            <button disabled={loading} className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg shadow-rose-200 active:scale-[0.98] transition-transform mt-2 disabled:opacity-50">
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 fade-in">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold text-center">{error}</div>}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Enter OTP</label>
              <input 
                type="text" 
                required
                className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none transition-all text-center tracking-[0.5em] text-lg"
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value)}
              />
              {devOtp && <p className="text-xs text-center text-slate-400 mt-2 font-medium">Development OTP: {devOtp}</p>}
            </div>
            <button disabled={loading} className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg shadow-rose-200 active:scale-[0.98] transition-transform mt-2 disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" onClick={() => setStep('PHONE')} className="w-full py-2 text-slate-500 font-bold text-sm hover:underline mt-2">
              Change Phone Number
            </button>
          </form>
        )}

        {step === 'INFO' && (
          <form onSubmit={handleRegister} className="space-y-4 fade-in">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold text-center">{error}</div>}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Full Name</label>
              <input 
                type="text" 
                required
                className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none transition-all"
                placeholder="John Doe"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Password</label>
              <input 
                type="password" 
                required
                className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Blood Group</label>
                <select 
                  value={bloodGroup}
                  onChange={e => setBloodGroup(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none appearance-none"
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Location</label>
                <select 
                  value={selectedLocation}
                  onChange={e => setSelectedLocation(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none appearance-none"
                >
                  {BD_LOCATION_NAMES.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>
            <button disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-lg active:scale-[0.98] transition-transform mt-4 disabled:opacity-50">
              {loading ? 'Creating...' : 'Complete Profile'}
            </button>
          </form>
        )}

        {step === 'PHONE' && (
          <p className="text-center mt-6 text-sm font-medium text-slate-500">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
          </p>
        )}
      </div>
    </div>
  );
}



function DonorProfile({ user, onUpdate }: { user: any, onUpdate: () => void }) {
  const [bloodGroup, setBloodGroup] = useState(user?.donor_profile?.blood_group || 'O+');
  const [status, setStatus] = useState(user?.donor_profile?.availability_status || 'AVAILABLE');
  const [selectedLocation, setSelectedLocation] = useState(user?.donor_profile?.location?.area_name || 'Dhaka');
  const [loading, setLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Donation History State
  const [donationHistory, setDonationHistory] = useState<any[]>(user?.donor_profile?.donation_history || []);
  const [showAddDonation, setShowAddDonation] = useState(false);
  const [newDonationDate, setNewDonationDate] = useState('');
  const [newDonationOrg, setNewDonationOrg] = useState('');

  useEffect(() => {
    async function loadRequests() {
      if (!globalToken) return;
      try {
        const reqs = await api.getMyRequests(globalToken);
        setMyRequests(reqs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingRequests(false);
      }
    }
    loadRequests();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setProfileMessage(null);
    try {
      const location = getLocationByName(selectedLocation);
      if (!location) throw new Error('Choose a supported district');

      await api.updateDonorProfile(globalToken, {
        blood_group: bloodGroup,
        availability_status: status,
        location,
        last_donation_date: user?.donor_profile?.last_donation_date || new Date().toISOString(),
        donation_history: donationHistory
      });
      setProfileMessage({ type: 'success', text: 'Profile updated successfully.' });
      onUpdate();
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    }
    setLoading(false);
  };

  const handleAddDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord = {
      id: `man-${Date.now()}`,
      date: newDonationDate,
      organization: newDonationOrg
    };
    const updatedHistory = [...donationHistory, newRecord];
    setDonationHistory(updatedHistory);
    setProfileMessage(null);
    try {
      const location = getLocationByName(selectedLocation);
      if (!location) throw new Error('Choose a supported district');

      await api.updateDonorProfile(globalToken, {
        blood_group: bloodGroup,
        availability_status: status,
        location,
        last_donation_date: user?.donor_profile?.last_donation_date || new Date().toISOString(),
        donation_history: updatedHistory
      });
      setNewDonationDate('');
      setNewDonationOrg('');
      setShowAddDonation(false);
      setProfileMessage({ type: 'success', text: 'Donation history updated.' });
      onUpdate();
    } catch (err: any) {
      setDonationHistory(donationHistory);
      setProfileMessage({ type: 'error', text: err.message || 'Failed to update donation history.' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="theme-card p-8 border border-slate-100 h-fit">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-xl font-bold text-slate-600">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{user?.name}</h2>
              <p className="text-slate-500 font-medium">{user?.phone}</p>
            </div>
          </div>

          <div className="space-y-8 pt-6 border-t border-slate-100">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" /> Donor Profile
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Blood Group</label>
                <select 
                  value={bloodGroup}
                  onChange={e => setBloodGroup(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none"
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Location</label>
                <select 
                  value={selectedLocation}
                  onChange={e => setSelectedLocation(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none"
                >
                  {BD_LOCATION_NAMES.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Availability</label>
                <select 
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none"
                >
                  <option value="AVAILABLE">Available for Donation</option>
                  <option value="SICK">Sick/Recovering</option>
                  <option value="TRAVELING">Traveling</option>
                  <option value="NOT_AVAILABLE">Not Available Right Now</option>
                </select>
              </div>
            </div>

            {profileMessage && (
              <div className={cn(
                "px-4 py-3 rounded-xl text-sm font-bold",
                profileMessage.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              )}>
                {profileMessage.text}
              </div>
            )}

            <button 
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-transform"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-6">
            <h3 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" /> My Requests
            </h3>

            {loadingRequests ? (
              <div className="flex justify-center p-12">
                <div className="w-8 h-8 border-[3px] border-rose-100 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : myRequests.length === 0 ? (
              <div className="theme-card p-10 text-center border border-slate-100 shadow-sm">
                <Heart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-bold mb-1">You haven't made any requests yet.</p>
                <Link to="/" className="text-primary hover:underline text-sm font-bold">Request blood now</Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {myRequests.map((req, i) => (
                  <div key={i} className="theme-card p-5 border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                          req.status === 'ACTIVE' ? "bg-emerald-100 text-emerald-700" :
                          req.status === 'FULFILLED' ? "bg-blue-100 text-blue-700" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {req.status}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-md flex items-center gap-1.5">
                        <div className="w-8 h-8 bg-rose-50 text-primary rounded-lg flex items-center justify-center font-extrabold text-sm border border-rose-100">
                          {req.blood_group}
                        </div>
                        {req.location.area_name}
                      </h3>
                    </div>
                    <Link to={`/request/${req.id}`} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm transition-colors border border-slate-200">
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-primary" /> Past Donations
              </h3>
              <button 
                onClick={() => setShowAddDonation(!showAddDonation)}
                className="text-sm font-bold text-primary hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                {showAddDonation ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Record</>}
              </button>
            </div>

            {showAddDonation && (
              <form onSubmit={handleAddDonation} className="theme-card p-5 border border-slate-100 bg-slate-50 space-y-4 fade-in">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Date</label>
                  <input type="date" required value={newDonationDate} onChange={e => setNewDonationDate(e.target.value)} className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Organization/Hospital</label>
                  <input type="text" required placeholder="e.g. Red Crescent Society" value={newDonationOrg} onChange={e => setNewDonationOrg(e.target.value)} className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                </div>
                <button type="submit" className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl active:scale-[0.98] transition-transform">Save Record</button>
              </form>
            )}

            {donationHistory.length === 0 ? (
              <div className="theme-card p-8 text-center border border-slate-100 shadow-sm">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-bold mb-1">No past donations recorded.</p>
                <p className="text-slate-400 text-sm mt-1">Keep track of your heroic moments.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {[...donationHistory].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((record, i) => (
                  <div key={record.id || i} className="theme-card p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">{record.organization}</h4>
                      <p className="text-sm font-medium text-slate-500 mt-0.5">{new Date(record.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-primary border border-rose-100">
                      <Droplet className="w-5 h-5 fill-rose-100" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingPage({ user }: { user: any }) {
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
  const navigate = useNavigate();

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

      const res = await api.requestBlood(globalToken || 'anonymous', {
        blood_group: bloodGroup,
        needed_by: neededBy ? new Date(neededBy).toISOString() : undefined,
        location
      });
      setTimeout(() => {
        setSearching(false);
        navigate(`/request/${res.request.id}`);
      }, 800);
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
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-3xl font-bold mb-6 text-white">Building a live donor network for urgent requests.</h2>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            Keep your donor status current so matching can prioritize the right blood group, district, and availability when a nearby request is created.
          </p>
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-3">
              <Users className="w-10 h-10 text-primary" />
              <div>
                <div className="text-3xl font-extrabold leading-none text-white">Live</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">Donor Status</div>
              </div>
            </div>
            <div className="h-12 w-px bg-slate-800 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <Activity className="w-10 h-10 text-primary" />
              <div>
                <div className="text-3xl font-extrabold leading-none text-white">24h</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">Request Window</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="max-w-4xl mx-auto space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Live Blood Requests</h1>
        <p className="text-slate-500 font-medium">Real-time feed of patients needing urgent blood donors across Bangladesh.</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-10 h-10 border-[3px] border-rose-100 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="theme-card p-12 text-center border border-slate-100 shadow-sm">
          <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-bold">No active requests right now.</p>
          <p className="text-slate-400 text-sm mt-2">The network is currently clear.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((req, i) => (
            <div key={i} className="theme-card p-6 flex flex-col md:flex-row md:items-center gap-6 hover:border-rose-200 border border-transparent transition-colors shadow-sm">
              <div className="flex items-center gap-6 flex-1">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-rose-50 flex-shrink-0 flex items-center justify-center text-primary text-2xl font-extrabold shadow-sm border border-rose-100">
                  {req.blood_group}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                      "bg-rose-100 text-rose-700"
                    )}>
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

function Layout({ children, user, onLogout }: { children: React.ReactNode, user: any, onLogout: () => void }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Droplet className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Drop<span className="text-primary">.</span></span>
          </Link>

          {user ? (
            <div className="flex items-center gap-6">
              <Link to="/" className="text-slate-600 hover:text-primary font-bold text-sm transition-colors">Find Blood</Link>
              <Link to="/requests" className="text-slate-600 hover:text-primary font-bold text-sm transition-colors flex items-center gap-1">
                <Activity className="w-4 h-4" /> Live Requests
              </Link>
              <Link to="/profile" className="text-slate-600 hover:text-primary font-bold text-sm transition-colors">My Profile</Link>
              <div className="h-6 w-px bg-slate-200"></div>
              <button onClick={onLogout} className="text-slate-400 hover:text-slate-600 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/requests" className="hidden sm:flex text-slate-600 hover:text-primary font-bold text-sm transition-colors items-center gap-1 mr-2">
                <Activity className="w-4 h-4" /> Live Requests
              </Link>
              <Link to="/login" className="text-slate-600 hover:text-slate-900 font-bold text-sm transition-colors">Log in</Link>
              <Link to="/register" className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-sm">Become a Donor</Link>
            </div>
          )}
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12">
        {children}
      </main>
    </div>
  );
}

function RequestDetailsPage({ user }: { user: any }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<{ request: any, matches: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // UI States
  const [revealedContacts, setRevealedContacts] = useState<Record<string, boolean>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [anonName, setAnonName] = useState('');

  // Editing State
  const [editData, setEditData] = useState<any>({ patient_name: '', requester_name: '', needed_by: '', contacts: [] });

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const payload = await api.getRequestDetails(id, globalToken || 'anonymous');
        setData(payload);
        setEditData({
          patient_name: payload.request.patient_name || '',
          requester_name: payload.request.requester_name || '',
          needed_by: payload.request.needed_by ? new Date(payload.request.needed_by).toISOString().slice(0, 16) : '',
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
        const updated = await api.updateRequestStatus(globalToken || 'anonymous', data.request.id, status);
        setData({ ...data, request: { ...data.request, status: updated.status } });
        setActionMessage({ type: 'success', text: 'Request status updated.' });
      } catch (err: any) {
        setActionMessage({ type: 'error', text: err.message || 'Failed to update request status.' });
      }
    }
  };

  const handleSaveDetails = async () => {
    if (data?.request) {
      const formattedData = {
        ...editData,
        needed_by: editData.needed_by ? new Date(editData.needed_by).toISOString() : undefined
      };
      setActionMessage(null);
      try {
        const updated = await api.updateRequestDetails(globalToken || 'anonymous', data.request.id, formattedData);
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
      const comment = await api.addComment(globalToken, data.request.id, newComment, user ? undefined : anonName);
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
      await api.deleteComment(globalToken, data.request.id, commentId);
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
    <div className="max-w-3xl mx-auto space-y-8 fade-in">
      <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
        <Link to="/requests" className="text-slate-400 hover:text-slate-900 transition-colors">
          &larr; Back
        </Link>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Request Dashboard</h2>
      </div>

      {actionMessage && (
        <div className={cn(
          "px-5 py-3 rounded-2xl text-sm font-bold",
          actionMessage.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        )}>
          {actionMessage.text}
        </div>
      )}

      {/* Main Request Header */}
      <div className="theme-card p-6 md:p-8 bg-rose-50/50 border border-rose-100 shadow-sm relative overflow-hidden">
        {request.status === 'FULFILLED' && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
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
             <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white border border-rose-100 flex items-center justify-center text-primary text-2xl md:text-3xl font-extrabold shadow-sm flex-shrink-0">
               {request.blood_group}
             </div>
             <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm border border-emerald-200">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Active
                  </span>
                  <span className="text-xs font-bold text-slate-400">ID: #{request.id.split('-')[1]}</span>
                </div>
                <h3 className="font-bold text-xl md:text-2xl text-slate-900 mt-2 flex items-center gap-1.5">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  {request.location.area_name}
                </h3>
                <p className="text-sm font-semibold text-slate-500 flex items-center gap-1.5 mt-2">
                  <Calendar className="w-4 h-4 text-emerald-500" /> 
                  Needed: <span className="text-slate-700">{request.needed_by ? new Date(request.needed_by).toLocaleDateString() : 'ASAP'}</span>
                </p>
             </div>
          </div>
          {isOwner && (
            <div className="flex flex-col gap-3 min-w-[160px]">
               <button onClick={() => handleUpdateStatus('FULFILLED')} className="w-full px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2">
                 <CheckCircle2 className="w-4 h-4" /> Mark Fulfilled
               </button>
               <button onClick={() => handleUpdateStatus('CANCELLED')} className="w-full px-5 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-bold rounded-xl transition-all">
                 Cancel Request
               </button>
            </div>
          )}
        </div>
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
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Patient Name</label>
                <input 
                  type="text" value={editData.patient_name} onChange={e => setEditData({...editData, patient_name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary text-sm font-medium outline-none" placeholder="Enter patient name..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Requester Name</label>
                <input 
                  type="text" value={editData.requester_name} onChange={e => setEditData({...editData, requester_name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary text-sm font-medium outline-none" placeholder="Who is requesting?"
                />
              </div>
              <div className="md:col-span-2 relative">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Needed By (Date)</label>
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
               <button onClick={handleSaveDetails} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-sm">Save Changes</button>
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
               {(!request.contacts || request.contacts.length === 0) && (
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
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Available</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-500 mt-1 flex items-center gap-2">
                      <span>{m.distance_km} km away</span>
                      <span>•</span>
                      <span>Active Donor</span>
                    </div>
                    {revealedContacts[m.user_id] && (
                      <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 fade-in w-full">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Donor Phone Number</p>
                        <a href={`tel:${m.phone}`} className="text-primary font-bold text-xl tracking-wide hover:underline inline-flex items-center gap-2">
                          {m.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                {!revealedContacts[m.user_id] && (
                  <div className="flex-shrink-0 md:w-32">
                    <button onClick={() => {
                      if (!user && !isOwner) navigate('/login');
                      else setRevealedContacts(prev => ({ ...prev, [m.user_id]: true }));
                    }} className="w-full px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-transform hover:bg-slate-800 shadow-sm">
                      Contact
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
                  {isOwner && (
                    <button 
                      onClick={() => handleDeleteComment(c.id)}
                      className="absolute right-2 top-2 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-200 focus:ring-4 focus:ring-rose-50 text-sm font-medium outline-none transition-all w-[240px]"
            />
          )}
          <div className="flex gap-3">
            <input 
              type="text" 
              value={newComment} 
              onChange={e => setNewComment(e.target.value)}
              placeholder="Type your comment or question..."
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-200 focus:ring-4 focus:ring-rose-50 text-sm font-medium outline-none transition-all"
              onKeyDown={e => e.key === 'Enter' && submitComment()}
            />
            <button onClick={submitComment} className="px-5 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-transform shadow-sm">
              Post
            </button>
          </div>
          {!user && <p className="text-xs text-slate-500 font-medium">Commenting anonymously. Max 3/min. <Link to="/login" className="text-primary hover:underline">Log in</Link> for unlimited messaging.</p>}
        </div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="max-w-2xl mx-auto theme-card p-10 text-center border border-slate-100">
      <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2">Page not found</h1>
      <p className="text-slate-500 font-medium mb-6">The page you requested does not exist.</p>
      <Link to="/" className="inline-flex items-center justify-center px-5 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">
        Find Blood
      </Link>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    if (!globalToken) {
      setLoading(false);
      return;
    }
    try {
      const u = await api.getMe(globalToken);
      setUser(u);
    } catch {
      localStorage.removeItem('auth_token');
      globalToken = '';
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const handleLogout = async () => {
    const token = globalToken;
    if (token) {
      try {
        await api.logout(token);
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.removeItem('auth_token');
    globalToken = '';
    setUser(null);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-red-100 border-t-primary rounded-full animate-spin"></div>
    </div>;
  }

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Layout user={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<LandingPage user={user} />} />
            <Route path="/request/:id" element={<RequestDetailsPage user={user} />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/login" element={!user ? <LoginPage onLogin={fetchUser} /> : <Navigate to="/profile" />} />
            <Route path="/register" element={!user ? <RegisterPage onLogin={fetchUser} /> : <Navigate to="/profile" />} />
            <Route path="/profile" element={user ? <DonorProfile user={user} onUpdate={fetchUser} /> : <Navigate to="/login" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
