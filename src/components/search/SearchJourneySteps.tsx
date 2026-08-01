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
    <ol aria-label="Donor search progress" className="grid grid-cols-3 gap-2 sm:gap-3">
      {steps.map(({ icon: Icon, label, description }, index) => {
        const step = index + 1;
        const complete = step < activeStep;
        const active = step === activeStep;

        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={`min-w-0 rounded-2xl border px-2.5 py-3 transition-colors sm:px-4 ${
              active
                ? 'border-rose-200 bg-rose-50 text-rose-950'
                : complete
                  ? 'border-rose-100 bg-white text-slate-800'
                  : 'border-slate-200 bg-white/70 text-slate-500'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8 ${
                  active || complete ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-extrabold leading-4 sm:text-xs">{label}</span>
                <span className="mt-0.5 hidden text-[11px] font-medium leading-4 text-slate-500 lg:block">{description}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
