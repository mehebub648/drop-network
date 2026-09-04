import { Children, Fragment, isValidElement, useEffect, useRef, useState, type FormHTMLAttributes, type ReactNode } from 'react';
import Select from './Select';
import DateInput from './DateInput';
import DonationExperienceFields from './DonationExperienceFields';
import DonorPreferencesFields from './DonorPreferencesFields';
import DonorAvailabilityFields from './DonorAvailabilityFields';

type NodeProps = { children?: ReactNode; type?: string; name?: string; className?: string };
function fieldCount(node: ReactNode): number {
  return Children.toArray(node).reduce<number>((count, child) => {
    if (!isValidElement<NodeProps>(child)) return count;
    if (['input', 'textarea', 'select'].includes(String(child.type)) || child.type === Select || child.type === DateInput) return count + (child.props.type === 'hidden' ? 0 : 1);
    // Composite field editors get their own page; their internal choices stay together.
    if ([DonationExperienceFields, DonorPreferencesFields, DonorAvailabilityFields].includes(child.type as any)) return count + 3;
    return count + fieldCount(child.props.children);
  }, 0);
}
function hasSubmit(node: ReactNode): boolean {
  return Children.toArray(node).some(child => isValidElement<NodeProps>(child) && (
    child.type === 'button' && (!child.props.type || child.props.type === 'submit') || hasSubmit(child.props.children)
  ));
}
function flattenGroups(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap<ReactNode>(child => {
    if (!isValidElement<NodeProps>(child)) return [child];
    const count = fieldCount(child);
    if (child.type === Fragment || (['div', 'section', 'fieldset', 'details'].includes(String(child.type)) && count > 3)) {
      return flattenGroups(child.props.children);
    }
    // A disclosure with at most three fields becomes an always-open question group.
    if (child.type === 'details') return flattenGroups(child.props.children);
    if (child.type === 'summary') return [<div key={child.key} className="guided-section-title">{child.props.children}</div>];
    return [child];
  });
}

/** Existing form values remain mounted: Back, FormData and validation keep their contracts. */
export default function GuidedForm({ children, onSubmit, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  const [step, setStep] = useState(0);
  const [validationMessage, setValidationMessage] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const groups: ReactNode[][] = [[]];
  const footer: ReactNode[] = [];
  let count = 0;
  for (const child of flattenGroups(children)) {
    const fields = fieldCount(child);
    if (!fields && hasSubmit(child)) { footer.push(child); continue; }
    if (fields && count + fields > 3 && count) { groups.push([]); count = 0; }
    groups[groups.length - 1].push(child); count += fields;
  }
  const current = Math.min(step, groups.length - 1);
  useEffect(() => {
    if (groups.length > 1) form.current?.querySelector<HTMLElement>(`[data-form-page="${current}"]`)?.focus();
  }, [current, groups.length]);
  if (groups.length === 1) return <form {...props} onSubmit={onSubmit}>{children}</form>;
  const submit: NonNullable<FormHTMLAttributes<HTMLFormElement>['onSubmit']> = event => {
    const last = current === groups.length - 1;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(last ? 'input,select,textarea' : `[data-form-page="${current}"] input,[data-form-page="${current}"] select,[data-form-page="${current}"] textarea`));
    const invalid = controls.find(control => !control.disabled && !control.checkValidity());
    if (invalid) {
      event.preventDefault();
      const page = Number(invalid.closest<HTMLElement>('[data-form-page]')?.dataset.formPage || 0);
      setStep(page);
      setValidationMessage(invalid.validationMessage || 'Check the highlighted answer before continuing.');
      requestAnimationFrame(() => {
        const target = invalid.matches('.drop-select-proxy') ? invalid.parentElement?.querySelector<HTMLElement>('[role="combobox"]') : invalid;
        target?.focus();
      });
    } else {
      setValidationMessage('');
      if (!last) { event.preventDefault(); setStep(current + 1); }
      else onSubmit?.(event);
    }
  };
  return <form {...props} className={`${props.className || ''} guided-form`} ref={form} noValidate onSubmit={submit}>
    <div className="step-flow-heading"><span aria-live="polite">Step {current + 1} of {groups.length}</span><progress value={current + 1} max={groups.length} aria-label="Form progress" /></div>
    {groups.map((group, index) => <section key={index} data-form-page={index} hidden={index !== current} tabIndex={-1} aria-label={`Step ${index + 1}`} className="guided-form-page">{group}</section>)}
    {validationMessage && <p role="alert" className="text-sm text-red-700">{validationMessage}</p>}
    <div className="step-flow-actions">{current > 0 && <button type="button" className="button button-secondary" onClick={() => { setValidationMessage(''); setStep(current - 1); }}>Back</button>}
      {current < groups.length - 1 ? <button type="submit" className="button button-primary">Continue</button> : <div className="guided-form-footer">{footer}</div>}
    </div>
  </form>;
}
