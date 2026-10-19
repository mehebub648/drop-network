import type { ReactNode } from 'react';
import { LockKeyhole, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router';
import Doodle from './Doodle';

const benefits = [
  { icon: ShieldCheck, text: 'Safer phone contact' },
  { icon: LockKeyhole, text: 'Your privacy, your choice' },
  { icon: UserRoundCheck, text: 'Help at your own pace' }
];

export default function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="auth-shell">
    <aside className="auth-story">
      <Doodle kind="welcome" className="auth-welcome-doodle" />
      <p className="eyebrow">A community that cares</p>
      <h2>A little hello.<br />A lot of heart.</h2>
      <ul>{benefits.map(({ icon: Icon, text }) => <li key={text}><Icon aria-hidden="true" /><span>{text}</span></li>)}</ul>
      <Link to="/directory">Need blood now? Find donors →</Link>
    </aside>
    <section className="auth-form-panel"><div>
      <p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-description">{description}</p><div className="mt-7">{children}</div>
    </div></section>
  </div>;
}
