import React from 'react';
import { Link } from 'react-router';
import { AlertCircle } from 'lucide-react';

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
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
