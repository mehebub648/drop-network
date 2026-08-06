import type { ReactNode } from 'react';
import { Activity, CheckCircle2, HeartHandshake, LockKeyhole, ShieldCheck } from 'lucide-react';

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
    <div className="mx-auto grid min-h-0 w-full max-w-6xl overflow-hidden rounded-[2rem] border border-rose-100 bg-white shadow-[0_30px_90px_-48px_rgba(136,19,55,0.45)] lg:min-h-[680px] lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#4c0519_0%,#881337_58%,#be123c_145%)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:36px_36px]" aria-hidden="true" />
        <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-rose-300/20 blur-2xl" aria-hidden="true" />
        <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-rose-300/10 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-rose-100 ring-1 ring-white/15">
            <HeartHandshake className="h-6 w-6" />
          </span>
          <div className="mt-8 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-rose-200">
            <Activity className="h-4 w-4" aria-hidden="true" /> Verified coordination
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-rose-300">Drop Network</p>
          <h2 className="mt-4 max-w-sm text-4xl font-extrabold leading-[1.08] tracking-[-0.04em]">Verified people. Safer coordination. Faster help.</h2>
          <p className="mt-5 max-w-sm text-sm leading-7 text-rose-100/75">
            Your account keeps donor availability, request ownership, and contact access tied to a verified Bangladesh mobile.
          </p>
        </div>
        <div className="relative space-y-4">
          {([
            [ShieldCheck, 'Short-lived OTP verification'],
            [LockKeyhole, 'Private, httpOnly login sessions'],
            [CheckCircle2, 'Control your availability at any time']
          ] as const).map(([Icon, label]) => (
            <div key={label} className="flex items-center gap-3 text-sm font-semibold text-rose-50">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Icon className="h-4 w-4" /></span>
              {label}
            </div>
          ))}
        </div>
      </aside>

      <section className="flex items-center px-5 py-10 sm:px-10 lg:px-14">
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
