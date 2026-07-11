export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 max-w-2xl">
      {eyebrow && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">{eyebrow}</p>
      )}
      <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl" id={id}>
        {title}
      </h2>
      {description && <p className="mt-2 text-pretty text-sm leading-6 text-slate-600">{description}</p>}
    </div>
  );
}
