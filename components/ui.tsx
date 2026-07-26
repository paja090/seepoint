import type { ReactNode, ComponentPropsWithoutRef } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('card', className)}>{children}</section>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">SeePOINT</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Button({
  children,
  href,
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  onClick,
  disabled,
  ...buttonProps
}: ComponentPropsWithoutRef<'button'> & ComponentPropsWithoutRef<'a'> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}) {
  const classes = cx(
    'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-300',
    variant === 'primary' && 'bg-slate-950 text-white hover:bg-slate-800',
    variant === 'secondary' && 'border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50',
    variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
    variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
    size === 'sm' && 'px-2.5 py-1 text-xs',
    disabled && 'cursor-not-allowed opacity-50',
    className,
  );
  if (href) return <a className={classes} href={href} onClick={onClick} {...buttonProps}>{children}</a>;
  return <button className={classes} type={type} onClick={onClick} disabled={disabled} {...buttonProps}>{children}</button>;
}

export function StatCard({
  label,
  value,
  description,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
  tone?: 'slate' | 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'zinc';
}) {
  const tones = {
    slate: 'bg-slate-50 text-slate-700 ring-slate-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    orange: 'bg-orange-50 text-orange-700 ring-orange-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    purple: 'bg-purple-50 text-purple-700 ring-purple-200',
    zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  } satisfies Record<string, string>;
  return (
    <Card className="min-h-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        {icon && <div className={cx('rounded-xl p-2 ring-1', tones[tone])}>{icon}</div>}
      </div>
      {description && <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>}
    </Card>
  );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('card mb-6 !p-4', className)}>{children}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="font-semibold text-slate-950">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-2 text-sm leading-6 text-red-700">{description}</p>}
    </div>
  );
}

export function LoadingState({ label = 'Načítám data…' }: { label?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{label}</div>;
}

export function Table({ children, minWidth = 'min-w-[900px]' }: { children: ReactNode; minWidth?: string }) {
  return <div className="overflow-x-auto"><table className={cx('w-full text-left text-sm', minWidth)}>{children}</table></div>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{children}</thead>;
}

export function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cx('border-b border-slate-100 px-4 py-3 align-top', className)}>{children}</td>;
}

export function TableHeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cx('border-b border-slate-200 px-4 py-3 font-semibold', className)}>{children}</th>;
}

export function Tabs({ items }: { items: string[] }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm font-medium text-slate-600">
      {items.map((item, index) => <span className={cx('rounded-lg px-3 py-1.5', index === 0 && 'bg-slate-950 text-white')} key={item}>{item}</span>)}
    </div>
  );
}
