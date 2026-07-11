import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { TONE_CLASSES, type MockAccentTone } from '@/lib/mock-offer-data';
import { workflowStages } from '@/lib/mock-sales-data';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/** Extra status tones beyond the media accent palette. */
type StatusTone = 'red' | 'amber' | 'green' | 'slate';
type ChipTone = MockAccentTone | StatusTone;

const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  red: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  slate: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
};

function isAccentTone(tone: ChipTone): tone is MockAccentTone {
  return tone in TONE_CLASSES;
}

/** Small rounded label. Tone-aware for media accents and status colors. */
export function Chip({
  children,
  tone,
  className,
}: {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  let toneClass = 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
  if (tone) {
    toneClass = isAccentTone(tone)
      ? cx(TONE_CLASSES[tone].softBg, TONE_CLASSES[tone].text, 'ring-1', TONE_CLASSES[tone].ring)
      : STATUS_TONE_CLASS[tone];
  }
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', toneClass, className)}>
      {children}
    </span>
  );
}

/** Colored dot used in legends and rows. */
export function ToneDot({ tone, className }: { tone: MockAccentTone; className?: string }) {
  return <span aria-hidden className={cx('inline-block h-2.5 w-2.5 rounded-full', TONE_CLASSES[tone].dot, className)} />;
}

export function StatusPill({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: 'slate' | 'blue' | 'indigo' | 'emerald' | 'amber' | 'red';
  icon?: ReactNode;
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    blue: 'bg-sky-50 text-sky-700 ring-sky-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
  } as const;
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1', tones[tone])}>
      {icon}
      {label}
    </span>
  );
}

/** Prev / next navigation between workflow stages. */
export function WorkflowFooter({
  current,
  nextLabel,
  onNextHref,
}: {
  current: string;
  nextLabel?: string;
  onNextHref?: string;
}) {
  const index = workflowStages.findIndex((stage) => stage.key === current);
  const prev = index > 0 ? workflowStages[index - 1] : null;
  const next = index >= 0 && index < workflowStages.length - 1 ? workflowStages[index + 1] : null;
  const nextHref = onNextHref ?? next?.href;

  return (
    <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
      {prev ? (
        <Link
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          href={prev.href}
        >
          <ArrowLeft aria-hidden size={16} />
          Zpět: {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next && nextHref && (
        <Link
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          href={nextHref}
        >
          {nextLabel ?? `Pokračovat: ${next.label}`}
          <ArrowRight aria-hidden size={16} />
        </Link>
      )}
    </div>
  );
}

/** Compact metric shown inside cards. */
export function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
