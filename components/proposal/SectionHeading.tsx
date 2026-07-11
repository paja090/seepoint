import type { ReactNode } from 'react';

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
        <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-slate-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}
