import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PUBLIC_SITE_URL } from '../RouteMetadata';

const PUBLIC_SITE_ORIGIN = new URL(PUBLIC_SITE_URL).origin;

export function safeMarkdownHref(value: string | undefined) {
  if (!value) return null;
  const candidate = value.trim();
  if (!candidate) return null;
  if (candidate.startsWith('#') || candidate.startsWith('?')) return candidate;
  try {
    const parsed = new URL(candidate, PUBLIC_SITE_URL);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return null;
    if (['http:', 'https:'].includes(parsed.protocol) && parsed.origin === PUBLIC_SITE_ORIGIN) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function isExternalMarkdownHref(value: string) {
  try {
    const parsed = new URL(value, PUBLIC_SITE_URL);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== PUBLIC_SITE_ORIGIN;
  } catch {
    return false;
  }
}

export default function MarkdownContent({ markdown, className = '' }: { markdown: string; className?: string }) {
  return (
    <div className={`min-w-0 break-words text-slate-700 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={['img']}
        unwrapDisallowed
        urlTransform={url => safeMarkdownHref(url) || ''}
        components={{
          h1: ({ children }) => <h2 className="mb-4 mt-8 text-2xl font-extrabold tracking-tight text-slate-950 first:mt-0">{children}</h2>,
          h2: ({ children }) => <h2 className="mb-3 mt-8 text-xl font-extrabold tracking-tight text-slate-950 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-3 mt-7 text-lg font-extrabold text-slate-950">{children}</h3>,
          p: ({ children }) => <p className="my-4 leading-8 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-5 list-disc space-y-2 pl-6 marker:text-primary">{children}</ul>,
          ol: ({ children }) => <ol className="my-5 list-decimal space-y-2 pl-6 marker:font-bold marker:text-primary">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-6 border-l-4 border-rose-300 bg-rose-50/60 px-5 py-3 text-slate-700">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => {
            const safeHref = safeMarkdownHref(href);
            if (!safeHref) return <span>{children}</span>;
            const external = isExternalMarkdownHref(safeHref);
            return (
              <a
                href={safeHref}
                target={external ? '_blank' : undefined}
                rel={external ? 'nofollow noreferrer noopener' : undefined}
                className="font-bold text-primary underline decoration-rose-300 underline-offset-4 hover:text-primary-dark"
              >
                {children}
              </a>
            );
          },
          strong: ({ children }) => <strong className="font-extrabold text-slate-900">{children}</strong>,
          hr: () => <hr className="my-8 border-slate-200" />,
          code: ({ children }) => <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900">{children}</code>,
          pre: ({ children }) => <pre className="my-6 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">{children}</pre>,
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100 text-slate-900">{children}</thead>,
          th: ({ children }) => <th className="border-b border-slate-200 px-4 py-3 font-extrabold">{children}</th>,
          td: ({ children }) => <td className="border-b border-slate-100 px-4 py-3 align-top last:border-b-0">{children}</td>,
          img: () => null
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
