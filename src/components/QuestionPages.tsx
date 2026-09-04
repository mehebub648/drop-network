import { Children, useRef, useState, type ReactNode } from 'react';

/** Short nested editing sections without nesting HTML forms. */
export default function QuestionPages({ children }: { children: ReactNode }) {
  const pages = Children.toArray(children);
  const [step, setStep] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const current = Math.min(step, pages.length - 1);
  const next = () => {
    const invalid = Array.from(root.current?.querySelectorAll<HTMLInputElement>(`[data-question-page="${current}"] input,[data-question-page="${current}"] select,[data-question-page="${current}"] textarea`) || []).find(field => !field.disabled && !field.checkValidity());
    if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
    setStep(current + 1);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-question-page="${current + 1}"]`)?.focus());
  };
  return <div ref={root} className="question-pages" onInvalidCapture={event => {
    const page = Array.from(root.current?.children || []).find(child => child.hasAttribute('data-question-page') && child.contains(event.target as Node));
    if (page) setStep(Number(page.getAttribute('data-question-page')));
  }}>
    {pages.length > 1 && <p className="mb-5 text-sm text-slate-600" aria-live="polite">Section {current + 1} of {pages.length}</p>}
    {pages.map((page, index) => <section key={index} hidden={index !== current} data-question-page={index} tabIndex={-1}>{page}</section>)}
    {pages.length > 1 && <div className="mt-5 flex justify-between gap-3">{current > 0 ? <button type="button" className="button button-secondary" onClick={() => setStep(current - 1)}>Previous section</button> : <span />}{current < pages.length - 1 && <button type="button" className="button button-secondary" onClick={next}>Next section</button>}</div>}
  </div>;
}
