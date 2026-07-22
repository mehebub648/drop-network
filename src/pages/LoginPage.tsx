import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Droplet } from 'lucide-react';
import { api } from '../lib/api';

export default function LoginPage({ onLogin }: { onLogin: () => Promise<void> | void }) {
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
      await api.login(phone, password);
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
          <div className="text-right"><Link to="/forgot-password" className="text-xs font-bold text-primary hover:underline">Forgot password?</Link></div>
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
