import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';

export default function StepFlow({ title, step, total, children, onBack, onNext, busy, nextLabel = 'Continue', error }: {
  title: string; step: number; total: number; children: ReactNode; onBack?: () => void;
  onNext: (event: FormEvent<HTMLFormElement>) => void; busy?: boolean; nextLabel?: string; error?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [validationError, setValidationError] = useState('');
  useEffect(() => { setValidationError(''); heading.current?.focus(); }, [step, title]);
  return <form className="step-flow" noValidate onSubmit={event => {
    const invalid = event.currentTarget.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(':invalid');
    if (invalid) {
      event.preventDefault();
      setValidationError(invalid.validationMessage || 'Complete this field to continue.');
      const trigger = invalid.closest('.drop-select')?.querySelector<HTMLButtonElement>('.drop-select-trigger');
      (trigger || invalid).focus();
      return;
    }
    setValidationError('');
    onNext(event);
  }}>
    <header className="step-flow-heading"><span>Step {step} of {total}</span><h2 ref={heading} tabIndex={-1}>{title}</h2>
      <progress value={step} max={total} aria-label="Your progress" /></header>
    <div className="step-flow-fields">{children}</div>
    {(validationError || error) && <p role="alert" className="dialog-error">{validationError || error}</p>}
    <div className="step-flow-actions">{onBack && <button type="button" className="button button-secondary" disabled={busy} onClick={onBack}>Back</button>}
      <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Please wait…' : nextLabel}</button></div>
  </form>;
}
