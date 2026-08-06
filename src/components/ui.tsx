import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { ArrowRight, Inbox } from 'lucide-react';
import { cn } from '../lib/utils';

type Tone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger';

const toneClasses: Record<Tone, string> = {
  brand: 'border-rose-200 bg-rose-50 text-rose-900',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  success: 'border-green-200 bg-green-50 text-green-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-950'
};

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  aside,
  className
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: ElementType;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('page-hero', aside && 'page-hero-with-aside', className)}>
      <div className="page-hero-grid" aria-hidden="true" />
      <div className="relative z-10 min-w-0 max-w-3xl">
        <div className="eyebrow-chip">
          {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
          {eyebrow}
        </div>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
        {actions && <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>}
      </div>
      {aside && <div className="relative z-10 min-w-0">{aside}</div>}
    </header>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('section-heading', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Surface({
  children,
  className,
  as: Component = 'div',
  ...props
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
} & HTMLAttributes<HTMLElement>) {
  return <Component className={cn('surface', className)} {...props}>{children}</Component>;
}

export function StatusBadge({
  children,
  tone = 'neutral',
  icon: Icon,
  className
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ElementType;
  className?: string;
}) {
  return (
    <span className={cn('status-badge', toneClasses[tone], className)}>
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Notice({
  children,
  tone = 'neutral',
  icon: Icon,
  actions,
  className
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ElementType;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('notice', toneClasses[tone], className)}>
      {Icon && (
        <span className="notice-icon">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1 text-sm font-semibold leading-6">{children}</div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function MetricCard({
  value,
  label,
  detail,
  icon: Icon,
  tone = 'brand'
}: {
  value: ReactNode;
  label: string;
  detail?: string;
  icon: ElementType;
  tone?: Tone;
}) {
  return (
    <Surface className="metric-tile">
      <span className={cn('metric-icon', toneClasses[tone])}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="metric-value">{value}</p>
        <p className="metric-label">{label}</p>
        {detail && <p className="metric-detail">{detail}</p>}
      </div>
    </Surface>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action
}: {
  title: string;
  description: string;
  icon?: ElementType;
  action?: ReactNode;
}) {
  return (
    <Surface className="empty-state">
      <span className="empty-state-icon"><Icon className="h-7 w-7" aria-hidden="true" /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </Surface>
  );
}

export function TextLinkArrow({ children }: { children: ReactNode }) {
  return <>{children}<ArrowRight className="h-4 w-4" aria-hidden="true" /></>;
}
