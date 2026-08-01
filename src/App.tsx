import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { api } from './lib/api';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import RegisterPage from './pages/RegisterPage';
import RequestDetailsPage from './pages/RequestDetailsPage';
import RequestsPage from './pages/RequestsPage';
import AboutPage from './pages/info/AboutPage';
import ContactPage from './pages/info/ContactPage';
import PrivacyPage from './pages/info/PrivacyPage';
import SafetyPage from './pages/info/SafetyPage';
import TermsPage from './pages/info/TermsPage';
import AccountPage from './pages/profile/AccountPage';
import DonorPage from './pages/profile/DonorPage';
import DonorRequestsPage from './pages/profile/DonorRequestsPage';
import HistoryPage from './pages/profile/HistoryPage';
import InvitationsPage from './pages/profile/InvitationsPage';
import ProfileLayout from './pages/profile/ProfileLayout';
import ProfileRequestsPage from './pages/profile/ProfileRequestsPage';
import SecurityPage from './pages/profile/SecurityPage';
import SettingsPage from './pages/profile/SettingsPage';
import AdminPage from './pages/AdminPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import RouteMetadata from './components/RouteMetadata';
import PartnersPage from './pages/PartnersPage';
import DirectoryPage from './pages/DirectoryPage';
import ClaimProfilePage from './pages/ClaimProfilePage';
import DonorSearchPage from './pages/DonorSearchPage';
import CallDonorPage from './pages/CallDonorPage';
import { getSafeReturnTo } from './lib/navigation';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const u = await api.getMe();
      setUser(u);
    } catch {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error(e);
    }
    setUser(null);
  };

  const requireUser = (element: ReactNode) => loading
    ? <RouteLoading />
    : user
      ? element
      : <Navigate to="/login" replace />;
  const isStaff = Boolean(
    user?.staff_role ||
    user?.roles?.some((role: string) => ['ADMIN', 'MODERATOR', 'SUPPORT', 'VERIFIER'].includes(role))
  );

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <RouteMetadata />
        <Layout user={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<LandingPage user={user} />} />
            <Route path="/request/:id" element={<RequestDetailsPage user={user} />} />
            {/* Posting a request is no longer a separate form: searching for
                donors is how a request is created. Old links land on search. */}
            <Route path="/request/new" element={<Navigate to="/directory" replace />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/directory" element={<DonorSearchPage user={user} onLogin={fetchUser} />} />
            <Route path="/directory/call/:requestId/:donorRef" element={requireUser(<CallDonorPage />)} />
            <Route path="/directory/imported" element={<DirectoryPage />} />
            <Route path="/directory/imported/:id" element={<ClaimProfilePage user={user} onUpdate={fetchUser} />} />
            <Route path="/directory/:id" element={<ClaimProfilePage user={user} onUpdate={fetchUser} />} />
            <Route path="/login" element={<GuestOnlyRoute user={user} loading={loading} fallback="/profile"><LoginPage onLogin={fetchUser} /></GuestOnlyRoute>} />
            <Route path="/register" element={<GuestOnlyRoute user={user} loading={loading} fallback="/profile/donor"><RegisterPage onLogin={fetchUser} /></GuestOnlyRoute>} />
            <Route path="/forgot-password" element={<GuestOnlyRoute user={user} loading={loading} fallback="/profile/security"><ForgotPasswordPage /></GuestOnlyRoute>} />
            <Route path="/profile" element={requireUser(<ProfileLayout user={user} />)}>
              <Route index element={<Navigate to="donor" replace />} />
              <Route path="account" element={<AccountPage user={user} onUpdate={fetchUser} />} />
              <Route path="donor" element={<DonorPage user={user} onUpdate={fetchUser} />} />
              <Route path="donor-requests" element={<DonorRequestsPage user={user} onUpdate={fetchUser} />} />
              <Route path="requests" element={<ProfileRequestsPage />} />
              <Route path="invitations" element={<InvitationsPage user={user} />} />
              <Route path="history" element={<HistoryPage user={user} onUpdate={fetchUser} />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="settings" element={<SettingsPage user={user} />} />
            </Route>
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/safety" element={<SafetyPage />} />
            <Route path="/partners" element={<PartnersPage user={user} />} />
            <Route path="/admin" element={loading ? <RouteLoading /> : isStaff ? <AdminPage user={user} /> : <Navigate to="/" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

function RouteLoading() {
  return (
    <div className="min-h-[45vh] flex items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
        <span className="h-5 w-5 rounded-full border-2 border-emerald-100 border-t-emerald-700 animate-spin" aria-hidden="true" />
        Loading your account…
      </div>
    </div>
  );
}

function GuestOnlyRoute({
  user,
  loading,
  fallback,
  children
}: {
  user: any;
  loading: boolean;
  fallback: string;
  children: ReactNode;
}) {
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'), fallback);
  if (loading) return <RouteLoading />;
  return user ? <Navigate to={returnTo} replace /> : children;
}
