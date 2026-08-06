import { Check, MapPin, PhoneCall, UserRoundSearch } from 'lucide-react';

const steps = [
  {
    icon: MapPin,
    label: 'Search area',
    description: 'Tell us what and where'
  },
  {
    icon: UserRoundSearch,
    label: 'Choose donor',
    description: 'Compare private matches'
  },
  {
    icon: PhoneCall,
    label: 'Confirm & call',
    description: 'Open one contact safely'
  }
];

export default function SearchJourneySteps({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Donor search progress" className="relative grid grid-cols-3 gap-1.5 rounded-2xl border border-rose-100/80 bg-white/80 p-1.5 shadow-sm backdrop-blur sm:gap-2 sm:p-2">
      <span className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-[1.55rem] h-px bg-rose-100 sm:top-[1.8rem]" aria-hidden="true" />
      {steps.map(({ icon: Icon, label, description }, index) => {
        const step = index + 1;
        const complete = step < activeStep;
        const active = step === activeStep;

        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={`relative min-w-0 rounded-xl border px-1.5 py-2.5 transition-colors sm:rounded-2xl sm:px-3 sm:py-3 ${
              active
                ? 'border-rose-200 bg-rose-50 text-rose-950 shadow-sm'
                : complete
                  ? 'border-rose-100 bg-white text-slate-800'
                  : 'border-transparent bg-white/65 text-slate-500'
            }`}
          >
            <div className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-2.5 sm:text-left">
              <span
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-4 ring-white sm:h-8 sm:w-8 sm:rounded-xl ${
                  active || complete ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[9px] font-extrabold leading-3 sm:text-xs sm:leading-4">{label}</span>
                <span className="mt-0.5 hidden text-[11px] font-medium leading-4 text-slate-500 lg:block">{description}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
