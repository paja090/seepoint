import Link from 'next/link';
import type { SubscriptionBannerInfo } from '@/lib/subscription';

const TONE_CLASSES: Record<SubscriptionBannerInfo['tone'], { wrapper: string; badge: string; button: string }> = {
  info: {
    wrapper: 'border-sky-200 bg-sky-50/90 text-sky-950',
    badge: 'bg-sky-200/80 text-sky-900',
    button: 'bg-sky-800 text-white hover:bg-sky-700',
  },
  warning: {
    wrapper: 'border-amber-300 bg-amber-50/95 text-amber-950',
    badge: 'bg-amber-200/80 text-amber-900',
    button: 'bg-amber-800 text-white hover:bg-amber-700',
  },
  danger: {
    wrapper: 'border-rose-300 bg-rose-50/95 text-rose-950',
    badge: 'bg-rose-200/80 text-rose-900',
    button: 'bg-rose-700 text-white hover:bg-rose-600',
  },
};

export function SubscriptionStatusBanner({ banner }: { banner: SubscriptionBannerInfo | null }) {
  if (!banner) return null;
  const style = TONE_CLASSES[banner.tone];

  return (
    <div
      role="status"
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs shadow-xs ${style.wrapper}`}
    >
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
            Licence
          </span>
          <strong className="text-sm font-bold">{banner.title}</strong>
        </div>
        <p className="text-xs opacity-90">{banner.description}</p>
      </div>
      <Link
        href={banner.ctaHref}
        className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${style.button}`}
      >
        {banner.ctaLabel} →
      </Link>
    </div>
  );
}
