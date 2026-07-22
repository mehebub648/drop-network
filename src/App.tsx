import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { api } from './lib/api';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import RegisterPage from './pages/RegisterPage';
import RequestDetailsPage from './pages/RequestDetailsPage';
import NewRequestPage from './pages/NewRequestPage';
import RequestsPage from './pages/RequestsPage';
import AboutPage from './pages/info/AboutPage';
import ContactPage from './pages/info/ContactPage';
import PrivacyPage from './pages/info/PrivacyPage';
import SafetyPage from './pages/info/SafetyPage';
import TermsPage from './pages/info/TermsPage';
import AccountPage from './pages/profile/AccountPage';
import DonorPage from './pages/profile/DonorPage';
import HistoryPage from './pages/profile/HistoryPage';
import InvitationsPage from './pages/profile/InvitationsPage';
import ProfileLayout from './pages/profile/ProfileLayout';
import ProfileRequestsPage from './pages/profile/ProfileRequestsPage';
import SecurityPage from './pages/profile/SecurityPage';
import SettingsPage from './pages/profile/SettingsPage';
import AdminPage from './pages/AdminPage';

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
            <Route path="/request/new" element={user ? <NewRequestPage user={user} /> : <Navigate to="/login" />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/login" element={!user ? <LoginPage onLogin={fetchUser} /> : <Navigate to="/profile" />} />
            <Route path="/register" element={!user ? <RegisterPage onLogin={fetchUser} /> : <Navigate to="/profile" />} />
            <Route path="/profile" element={user ? <ProfileLayout user={user} /> : <Navigate to="/login" />}>
              <Route index element={<Navigate to="donor" replace />} />
              <Route path="account" element={<AccountPage user={user} onUpdate={fetchUser} />} />
              <Route path="donor" element={<DonorPage user={user} onUpdate={fetchUser} />} />
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
            <Route path="/admin" element={user?.roles?.some((role: string) => ['ADMIN', 'MODERATOR', 'SUPPORT', 'VERIFIER'].includes(role)) ? <AdminPage /> : <Navigate to="/" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
