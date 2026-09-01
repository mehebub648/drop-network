import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { BookOpenText } from 'lucide-react';
import { PageHeader, Surface } from '../../components/ui';

export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  const sections = Children.toArray(children).map((child, index) => {
    if (!isValidElement(child)) return { id: `section-${index + 1}`, title: `Section ${index + 1}`, node: child };
    const element = child as ReactElement<{ children?: ReactNode; id?: string }>;
    const heading = Children.toArray(element.props.children).find(item => isValidElement(item) && item.type === 'h2');
    const headingTitle = isValidElement<{ children?: ReactNode }>(heading) && typeof heading.props.children === 'string'
      ? heading.props.children
      : `Section ${index + 1}`;
    const id = element.props.id || headingTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return { id, title: headingTitle, node: cloneElement(element, { id }) };
  });

  return (
    <article className="mx-auto max-w-5xl space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={intro} icon={BookOpenText} />
      <details className="info-contents surface px-5 py-4">
        <summary className="min-h-11 cursor-pointer font-extrabold text-slate-900">On this page</summary>
        <nav className="grid gap-1 pt-2 sm:grid-cols-2" aria-label={`${title} sections`}>
          {sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
        </nav>
      </details>
      <Surface className="space-y-9 px-6 py-8 text-slate-600 leading-7 sm:px-10 sm:py-10 [&_section]:relative [&_section]:rounded-2xl [&_section]:border [&_section]:border-slate-100 [&_section]:bg-slate-50/55 [&_section]:px-5 [&_section]:py-5 [&_section]:sm:px-6 [&_h2]:mb-3 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-3 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-slate-950 [&_h2]:before:h-2 [&_h2]:before:w-2 [&_h2]:before:shrink-0 [&_h2]:before:rounded-full [&_h2]:before:bg-primary [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_li]:marker:text-primary [&_a]:font-bold [&_a]:text-primary [&_a:hover]:underline">
        {sections.map(section => section.node)}
      </Surface>
    </article>
  );
}
