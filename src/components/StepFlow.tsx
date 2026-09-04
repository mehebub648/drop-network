import { useEffect, useRef, type ReactNode, type FormEvent } from 'react';

export default function StepFlow({ title, step, total, children, onBack, onNext, busy, nextLabel = 'Continue', error }: {
  title: string; step: number; total: number; children: ReactNode; onBack?: () => void;
  onNext: (event: FormEvent<HTMLFormElement>) => void; busy?: boolean; nextLabel?: string; error?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step, title]);
  return <form className="step-flow" onSubmit={onNext}>
    <header className="step-flow-heading"><span>Step {step} of {total}</span><h2 ref={heading} tabIndex={-1}>{title}</h2>
      <progress value={step} max={total} aria-label="Your progress" /></header>
    <div className="step-flow-fields">{children}</div>
    {error && <p role="alert" className="dialog-error">{error}</p>}
    <div className="step-flow-actions">{onBack && <button type="button" className="button button-secondary" disabled={busy} onClick={onBack}>Back</button>}
      <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Please wait…' : nextLabel}</button></div>
  </form>;
}
