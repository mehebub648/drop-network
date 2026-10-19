import { useNavigate, useSearchParams } from 'react-router';
import AuthShell from '../components/AuthShell';
import AccountFlow from '../components/AccountFlow';
import { getSafeReturnTo } from '../lib/navigation';

export default function RegisterPage({ onLogin }: { onLogin: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return <AuthShell eyebrow="Hello, kind human" title="Make yourself at home." description="Join in. Donating is always your choice.">
    <AccountFlow onComplete={async () => { await onLogin(); navigate(getSafeReturnTo(params.get('returnTo'), '/profile'), { replace: true }); }} />
  </AuthShell>;
}
