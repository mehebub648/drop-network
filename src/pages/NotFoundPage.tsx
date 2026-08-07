import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="max-w-2xl mx-auto theme-card p-10 text-center border border-slate-100">
      <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2">Page not found</h1>
      <p className="text-slate-500 font-medium mb-6">The page you requested does not exist.</p>
      <Link to="/" className="inline-flex items-center justify-center px-5 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark">
        Find Blood
      </Link>
    </div>
  );
}
