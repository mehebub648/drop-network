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
    <article className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={intro} icon={BookOpenText} />
      <div className="info-document">
      <aside className="info-contents surface">
        <h2 className="font-semibold text-slate-800">On this page</h2>
        <nav className="pt-3" aria-label={`${title} sections`}>
          {sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
        </nav>
      </aside>
      <Surface className="info-content space-y-8 text-sm text-slate-600 leading-7 [&_section]:border-b [&_section]:border-slate-100 [&_section]:pb-8 [&_section:last-child]:border-0 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-800 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline">
        {sections.map(section => section.node)}
      </Surface>
      </div>
    </article>
  );
}
