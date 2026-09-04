import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import {
  matchingRequestReasonOptions,
  requestReasonLabel,
  type RequestReason
} from '../../lib/requestReasons';

export default function RequestReasonCombobox({
  value,
  onChange
}: {
  value: RequestReason | '';
  onChange: (value: RequestReason) => void;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(() => requestReasonLabel(value));
  const [activeIndex, setActiveIndex] = useState(0);
  const options = useMemo(() => matchingRequestReasonOptions(query), [query]);

  useEffect(() => {
    if (!open) setQuery(requestReasonLabel(value));
  }, [open, value]);

  const choose = (reason: RequestReason) => {
    input.current?.focus();
    onChange(reason);
    setQuery(requestReasonLabel(reason));
    setOpen(false);
  };

  const handleKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && options[activeIndex]) {
      event.preventDefault();
      choose(options[activeIndex].value);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div
      className="request-reason-combobox relative"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Search className="pointer-events-none absolute left-4 top-6 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      <input
        ref={input}
        role="combobox"
        aria-label="Reason blood is needed"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={open && options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        value={query}
        onFocus={event => {
          setOpen(true);
          setActiveIndex(0);
          if (value) {
            setQuery('');
            event.currentTarget.select();
          }
        }}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeys}
        onChange={event => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        placeholder="Search or choose a reason"
        className="input pl-11 pr-11"
      />
      <button
        type="button"
        aria-label={open ? 'Close reason options' : 'Open reason options'}
        onClick={() => {
          setOpen(current => !current);
          if (!open) setQuery('');
        }}
        className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <ul id={listId} role="listbox" aria-label="Common reasons blood is needed" className="request-reason-options mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
          {options.map((option, index) => (
            <li key={option.value}>
              <button
                id={`${listId}-${index}`}
                type="button"
                tabIndex={-1}
                onMouseDown={event => event.preventDefault()}
                role="option"
                aria-selected={value === option.value}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option.value)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${
                  index === activeIndex ? 'bg-rose-50 text-slate-950' : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span>{option.label}</span>
                {value === option.value && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
              </button>
            </li>
          ))}
          {!options.length && <li role="status" className="p-3 text-sm">No matching reasons. Try another search.</li>}
        </ul>
      )}
    </div>
  );
}
