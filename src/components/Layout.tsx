import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Droplet, LogOut, ShieldCheck } from 'lucide-react';
import Footer from './Footer';

export default function Layout({ children, user, onLogout }: { children: ReactNode, user: any, onLogout: () => void }) {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:px-4 focus:py-3 focus:rounded-lg">Skip to main content</a>
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Droplet className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Drop<span className="text-primary">.</span></span>
          </Link>

          {user ? (
            <div className="flex items-center gap-3 sm:gap-6">
              <Link to="/requests" className="hidden sm:flex text-slate-600 hover:text-primary font-bold text-sm transition-colors items-center gap-1">
                <Activity className="w-4 h-4" /> Live Requests
              </Link>
              <Link to="/profile" className="text-slate-600 hover:text-primary font-bold text-sm transition-colors">My Profile</Link>
              {(user.staff_role || user.roles?.some((role: string) => ['ADMIN', 'MODERATOR', 'SUPPORT', 'VERIFIER'].includes(role))) && <Link to="/admin" className="text-slate-600 hover:text-primary font-bold text-sm transition-colors" aria-label="Operations console"><ShieldCheck className="w-5 h-5" /></Link>}
              <div className="hidden sm:block h-6 w-px bg-slate-200"></div>
              <button onClick={onLogout} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Log out" title="Log out">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/requests" className="hidden sm:flex text-slate-600 hover:text-primary font-bold text-sm transition-colors items-center gap-1 mr-2">
                <Activity className="w-4 h-4" /> Live Requests
              </Link>
              <Link to="/login" className="text-slate-600 hover:text-slate-900 font-bold text-sm transition-colors">Log in</Link>
              <Link to="/register" className="px-4 sm:px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-sm">Become a Donor</Link>
            </div>
          )}
        </div>
      </header>
      
      <main id="main-content" className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {children}
      </main>
      <Footer />
    </div>
  );
}
