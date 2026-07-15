/**
 * Text-based logo placeholder. Real client brand logos should be supplied by the
 * backend / asset pipeline later. This intentionally avoids using real trademarks.
 */
export function LogoPlaceholder({
  label,
  className = '',
  size = 'md',
}: {
  label: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-12 px-4 text-base',
    lg: 'h-16 px-5 text-lg',
  } as const;
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 font-semibold tracking-tight text-slate-500 ${sizes[size]} ${className}`}
      aria-label={`Logo ${label} (zástupný obrázek)`}
    >
      {label}
    </div>
  );
}
