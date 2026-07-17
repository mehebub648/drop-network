import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Droplet, LogOut } from 'lucide-react';
import Footer from './Footer';

export default function Layout({ children, user, onLogout }: { children: ReactNode, user: any, onLogout: () => void }) {
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
              <Link to="/about" className="hidden lg:inline text-slate-600 hover:text-primary font-bold text-sm transition-colors">About</Link>
              <Link to="/safety" className="hidden lg:inline text-slate-600 hover:text-primary font-bold text-sm transition-colors">Safety</Link>
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
              <Link to="/about" className="hidden lg:inline text-slate-600 hover:text-primary font-bold text-sm transition-colors">About</Link>
              <Link to="/safety" className="hidden lg:inline text-slate-600 hover:text-primary font-bold text-sm transition-colors">Safety</Link>
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
      <Footer />
    </div>
  );
}
