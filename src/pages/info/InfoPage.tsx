import type { ReactNode } from 'react';

export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-4xl">
      <div className="theme-card overflow-hidden">
        <header className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white px-6 py-8 sm:px-10 sm:py-11">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-slate-600 sm:text-lg sm:leading-8">{intro}</p>
        </header>
        <div className="space-y-9 px-6 py-8 text-slate-600 leading-7 sm:px-10 sm:py-10 [&_section]:border-l-2 [&_section]:border-emerald-100 [&_section]:pl-5 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-slate-950 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_li]:marker:text-emerald-600 [&_a]:font-bold [&_a]:text-primary [&_a:hover]:underline">
          {children}
        </div>
      </div>
    </article>
  );
}
