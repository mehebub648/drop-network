import type { ReactNode } from 'react';
import { HeartHandshake, LockKeyhole, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router';

const benefits = [
  { icon: ShieldCheck, text: 'Phone verification for safer contact' },
  { icon: LockKeyhole, text: 'Control how your details are shared' },
  { icon: UserRoundCheck, text: 'Manage your donor availability' }
];

export default function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="auth-shell">
    <aside className="auth-story">
      <HeartHandshake className="auth-story-icon" aria-hidden="true" />
      <p className="eyebrow">A community that cares</p>
      <h2>Your next small act<br />could mean everything.</h2>
      <p>Join people across Bangladesh helping each other find blood when it matters.</p>
      <ul>{benefits.map(({ icon: Icon, text }) => <li key={text}><Icon aria-hidden="true" /><span>{text}</span></li>)}</ul>
      <Link to="/directory">Need blood now? Find donors →</Link>
    </aside>
    <section className="auth-form-panel"><div>
      <p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-description">{description}</p><div className="mt-7">{children}</div>
    </div></section>
  </div>;
}
