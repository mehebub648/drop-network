import { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

type Option = { value: string; label: string; disabled: boolean };
function optionsFrom(children: ReactNode, disabled = false): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return [];
    if (child.type !== 'option') return optionsFrom(child.props.children, disabled || Boolean(child.props.disabled));
    const label = Children.toArray(child.props.children).join('');
    return [{ value: String(child.props.value ?? label), label, disabled: disabled || Boolean(child.props.disabled) }];
  });
}

/** Branded select with real form participation and keyboard-operable searchable choices. */
export default function Select({ children, value, defaultValue, onChange, className = '', id, disabled, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [ownValue, setOwnValue] = useState(String(defaultValue ?? ''));
  const selected = String(value ?? ownValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [fieldLabel, setFieldLabel] = useState('');
  useEffect(() => {
    const label = root.current?.closest('label') || root.current?.parentElement?.querySelector(':scope > label');
    if (!label) return;
    const copy = label.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('input,select,button,.drop-select,small').forEach(node => node.remove());
    setFieldLabel(copy.textContent?.trim() || '');
  }, []);
  const options = useMemo(() => optionsFrom(children), [children]);
  const filtered = options.filter(option => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const close = () => { setOpen(false); setQuery(''); };
  // The browser's top layer escapes animated parents, overflow clipping and
  // dialog stacking contexts while retaining this control's DOM/focus scope.
  useLayoutEffect(() => {
    if (!open || !popup.current || !trigger.current) return;
    const panel = popup.current;
    panel.showPopover();
    const position = () => {
      if (!trigger.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upwards = below < 220 && above > below;
      const available = Math.max(120, upwards ? above : below);
      panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`;
      panel.style.width = `${Math.min(rect.width, window.innerWidth - 16)}px`;
      panel.style.maxHeight = `${available}px`;
      panel.style.top = upwards ? 'auto' : `${rect.bottom + 6}px`;
      panel.style.bottom = upwards ? `${window.innerHeight - rect.top + 6}px` : 'auto';
    };
    position();
    panel.querySelector<HTMLInputElement>('input')?.focus();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); if (panel.matches(':popover-open')) panel.hidePopover(); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const choose = (option: Option) => {
    if (option.disabled || !native.current) return;
    native.current.value = option.value;
    setOwnValue(option.value);
    onChange?.({ target: native.current, currentTarget: native.current, type: 'change' } as ChangeEvent<HTMLSelectElement>);
    close(); trigger.current?.focus();
  };
  const move = (delta: number) => {
    if (!filtered.length) return;
    let next = active;
    for (let i = 0; i < filtered.length; i++) {
      next = (next + delta + filtered.length) % filtered.length;
      if (!filtered[next].disabled) break;
    }
    setActive(next);
    document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' });
  };
  return <div ref={root} className="drop-select" onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); trigger.current?.focus(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); move(event.key === 'ArrowDown' ? 1 : -1); }
    else if (event.key === 'Enter' && open) { event.preventDefault(); if (filtered[active]) choose(filtered[active]); }
    else if (event.key === 'Tab' && open) { trigger.current?.focus(); close(); }
  }}>
    <select {...props} disabled={disabled} ref={native} value={selected} onChange={onChange} tabIndex={-1} aria-hidden="true" className="drop-select-proxy" onInvalid={event => {
      event.preventDefault(); setOpen(true); trigger.current?.focus();
    }}>{children}</select>
    <button ref={trigger} type="button" id={id} disabled={disabled} role="combobox" aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
      aria-label={props['aria-label'] || fieldLabel || undefined} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']} aria-required={props.required}
      className={`drop-select-trigger ${className}`} onClick={() => { setOpen(!open); setActive(Math.max(0, filtered.findIndex(option => option.value === selected))); }}>
      <span>{options.find(option => option.value === selected)?.label || 'Choose an option'}</span><ChevronDown size={18} aria-hidden="true" />
    </button>
    {open && <div ref={popup} popover="manual" className="drop-select-popup">
      {options.length > 6 && <div className="drop-select-search"><Search size={17} aria-hidden="true" /><input autoFocus value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} placeholder="Type to find…" aria-label="Search options" role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined} /></div>}
      <div id={listId} role="listbox" aria-label={props['aria-label'] || 'Options'} className="drop-select-options">
        {filtered.map((option, index) => <button key={`${option.value}-${index}`} id={`${listId}-${index}`} type="button" tabIndex={-1} role="option" aria-selected={option.value === selected} disabled={option.disabled}
          className={active === index ? 'is-active' : ''} onPointerMove={() => setActive(index)} onClick={() => choose(option)}>
          <span>{option.label || 'Choose an option'}</span>{option.value === selected && <Check size={17} aria-hidden="true" />}
        </button>)}
        {!filtered.length && <p role="status">No matching options. Try another spelling.</p>}
      </div>
    </div>}
  </div>;
}
