import type { ReactNode } from 'react';

export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <article className="max-w-3xl mx-auto">
      <div className="theme-card p-7 sm:p-10 border border-slate-100">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">{intro}</p>
        <div className="mt-9 space-y-8 text-slate-600 leading-7 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_a]:text-primary [&_a]:font-semibold [&_a:hover]:underline">
          {children}
        </div>
      </div>
    </article>
  );
}
