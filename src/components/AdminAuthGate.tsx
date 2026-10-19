import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { api, type AdminSessionUser } from '../lib/api';

export default function AdminAuthGate({ children }: { children: (admin: AdminSessionUser) => ReactNode }) {
  const location = useLocation();
  const [admin, setAdmin] = useState<AdminSessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.getAdminSession()
      .then(result => { if (active) setAdmin(result.admin); })
      .catch(() => { if (active) setAdmin(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="flex min-h-[45vh] items-center justify-center" role="status">Checking administration access…</div>;
  if (!admin) return <Navigate to={`/admin/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children(admin)}</>;
}
