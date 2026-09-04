import { useEffect, useId, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { isCalendarDate } from '../../server/requestLifecycle';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Select from './Select';

export default function DateInput({ value, onChange, min, max, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(String(value || new Date().toISOString().slice(0, 10)).slice(0, 7));
  const field = useRef<HTMLInputElement>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  useEffect(() => {
    const label = field.current?.closest('label');
    if (!label) return;
    const copy = label.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.drop-date').forEach(node => node.remove());
    setFieldLabel(copy.textContent?.trim() || '');
  }, []);
  const calendarId = useId();
  useEffect(() => {
    const date = String(value || '');
    field.current?.setCustomValidity(date && (!isCalendarDate(date) || min && date < String(min) || max && date > String(max)) ? 'Choose a valid date in the allowed range.' : '');
  }, [value, min, max]);
  const [year, monthNumber] = month.split('-').map(Number);
  const validYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const validMonth = Number.isFinite(monthNumber) ? monthNumber : 1;
  const days = new Date(Date.UTC(validYear, validMonth, 0)).getUTCDate();
  const offset = new Date(Date.UTC(validYear, validMonth - 1, 1)).getUTCDay();
  const select = (date: string) => {
    if (!field.current) return;
    field.current.value = date;
    onChange?.({ target: field.current, currentTarget: field.current, type: 'change' } as ChangeEvent<HTMLInputElement>);
    setOpen(false); field.current.focus();
  };
  const boundedMonth = (next: string) => setMonth(min && next < String(min).slice(0, 7) ? String(min).slice(0, 7) : max && next > String(max).slice(0, 7) ? String(max).slice(0, 7) : next);
  const moveMonth = (delta: number) => boundedMonth(new Date(Date.UTC(validYear, validMonth - 1 + delta, 1)).toISOString().slice(0, 7));
  return <div className="drop-date" onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); field.current?.focus(); } }}>
    <div className="drop-date-input"><input {...props} aria-label={props['aria-label'] || fieldLabel || undefined} ref={field} type="text" value={value} onChange={onChange} placeholder="YYYY-MM-DD" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" maxLength={10} />
      <button type="button" aria-label="Choose a date" aria-expanded={open} aria-controls={calendarId} onClick={() => setOpen(!open)}><CalendarDays size={20} /></button></div>
    {open && <div id={calendarId} className="drop-calendar" role="group" aria-label="Calendar">
      <div className="drop-calendar-nav"><button type="button" aria-label="Previous month" disabled={Boolean(min && month <= String(min).slice(0, 7))} onClick={() => moveMonth(-1)}><ChevronLeft /></button>
        <Select aria-label="Month" value={validMonth} onChange={event => boundedMonth(`${validYear}-${event.target.value.padStart(2, '0')}`)}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{new Date(2000, index, 1).toLocaleString('en', { month: 'short' })}</option>)}</Select>
        <Select aria-label="Year" value={validYear} onChange={event => boundedMonth(`${event.target.value}-${String(validMonth).padStart(2, '0')}`)}>{Array.from({ length: Number(String(max || '2100').slice(0, 4)) - Number(String(min || '1900').slice(0, 4)) + 1 }, (_, index) => Number(String(min || '1900').slice(0, 4)) + index).reverse().map(item => <option key={item}>{item}</option>)}</Select>
        <button type="button" aria-label="Next month" disabled={Boolean(max && month >= String(max).slice(0, 7))} onClick={() => moveMonth(1)}><ChevronRight /></button></div>
      <div className="drop-calendar-grid">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day}>{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: days }, (_, index) => { const date = `${validYear}-${String(validMonth).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
          return <button type="button" key={date} aria-label={date} aria-pressed={date === value} disabled={Boolean(min && date < String(min) || max && date > String(max))} onClick={() => select(date)}>{index + 1}</button>;
        })}</div><button type="button" className="button button-secondary" onClick={() => setOpen(false)}>Close calendar</button>
    </div>}
  </div>;
}
