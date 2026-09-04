import { Link, useNavigate, useSearchParams } from 'react-router';
import AuthShell from '../components/AuthShell';
import AccountFlow from '../components/AccountFlow';
import { getSafeReturnTo } from '../lib/navigation';

export default function LoginPage({ onLogin }: { onLogin: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return <AuthShell eyebrow="Welcome back" title="Your account, one step at a time." description="Start with your private phone number. Use your password or a verification code.">
    <AccountFlow onComplete={async () => { await onLogin(); navigate(getSafeReturnTo(params.get('returnTo'), '/profile'), { replace: true }); }} />
    <Link className="mt-5 inline-block text-primary underline" to="/forgot-password">Reset a forgotten password</Link>
  </AuthShell>;
}
