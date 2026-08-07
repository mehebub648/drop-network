import type { ReactNode } from 'react';
import { Activity, CheckCircle2, HeartHandshake, LockKeyhole, ShieldCheck } from 'lucide-react';
import BloodBagDoodle from './BloodBagDoodle';

export default function AuthShell({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-shell mx-auto grid min-h-0 w-full max-w-5xl overflow-hidden lg:min-h-[660px] lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="auth-story relative hidden overflow-hidden p-9 lg:flex lg:flex-col lg:justify-between">
        <div className="relative">
          <span className="cartoon-icon inline-flex h-12 w-12 items-center justify-center rounded-2xl">
            <HeartHandshake className="h-6 w-6" />
          </span>
          <div className="mt-7 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-rose-800">
            <Activity className="h-4 w-4" aria-hidden="true" /> Verified coordination
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.22em] text-rose-700">Drop Network</p>
          <h2 className="mt-3 max-w-sm text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-slate-950">Verified people. Safer coordination. Faster help.</h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">
            Your account keeps donor availability, request ownership, and contact access tied to a verified Bangladesh mobile.
          </p>
          <BloodBagDoodle className="mt-2 w-full max-w-sm" />
        </div>
        <div className="relative space-y-4">
          {([
            [ShieldCheck, 'Short-lived OTP verification'],
            [LockKeyhole, 'Private, httpOnly login sessions'],
            [CheckCircle2, 'Control your availability at any time']
          ] as const).map(([Icon, label]) => (
            <div key={label} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <span className="cartoon-mini-icon flex h-9 w-9 items-center justify-center rounded-xl"><Icon className="h-4 w-4" /></span>
              {label}
            </div>
          ))}
        </div>
      </aside>

      <section className="auth-form-panel flex items-center px-5 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </div>
  );
}
