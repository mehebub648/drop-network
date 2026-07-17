import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertCircle, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, Droplet, Edit2, Filter, Heart, MapPin, MessageCircle, Phone, Plus, Search, Share2, Shield, Trash2, Users, Zap } from 'lucide-react';
import { api, BROWSER_FINGERPRINT } from '../lib/api';
import { BLOOD_GROUPS, compatibleDonorsFor, DONATION_INTERVAL_DAYS, getEligibility, getUrgency, URGENCY_ORDER } from '../lib/blood';
import { BD_LOCATION_NAMES, getLocationByName } from '../lib/locations';
import { cn } from '../lib/utils';
import { UrgencyBadge } from '../components/UrgencyBadge';

export default function RegisterPage({ onLogin }: { onLogin: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [selectedLocation, setSelectedLocation] = useState('Dhaka');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const location = getLocationByName(selectedLocation);
      if (!location) throw new Error('Choose a supported district');

      await api.register(phone, name, password, bloodGroup, location);
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

        <form onSubmit={handleRegister} className="space-y-4 fade-in">
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
                minLength={8}
                className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary font-medium outline-none transition-all"
                placeholder="At least 8 characters"
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
              {loading ? 'Creating...' : 'Create Account'}
            </button>
        </form>

        <p className="text-center mt-6 text-sm font-medium text-slate-500">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}

