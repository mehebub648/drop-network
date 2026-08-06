import type { ReactNode } from 'react';
import { BookOpenText } from 'lucide-react';
import { PageHeader, Surface } from '../../components/ui';

export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-5xl space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={intro} icon={BookOpenText} />
      <Surface className="space-y-9 px-6 py-8 text-slate-600 leading-7 sm:px-10 sm:py-10 [&_section]:relative [&_section]:rounded-2xl [&_section]:border [&_section]:border-slate-100 [&_section]:bg-slate-50/55 [&_section]:px-5 [&_section]:py-5 [&_section]:sm:px-6 [&_h2]:mb-3 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-3 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-slate-950 [&_h2]:before:h-2 [&_h2]:before:w-2 [&_h2]:before:shrink-0 [&_h2]:before:rounded-full [&_h2]:before:bg-primary [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_li]:marker:text-primary [&_a]:font-bold [&_a]:text-primary [&_a:hover]:underline">
        {children}
      </Surface>
    </article>
  );
}
