import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getCurrentUser } from '@/lib/auth';
import { canReviewAcademy } from '@/lib/academy/review-policy';
import lessons from '@/lib/academy/review-lessons.json';

export const dynamic = 'force-dynamic';
export default async function AcademyReview({ searchParams }: { searchParams: Promise<{ lesson?: string; step?: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect('/login');
  if (!canReviewAcademy(actor)) notFound();
  const query = await searchParams;
  const lesson = lessons.find(item => item.slug === query.lesson);
  const index = Math.max(0, Math.min((lesson?.steps.length ?? 1) - 1, Number.parseInt(query.step ?? '1', 10) - 1 || 0));
  const current = lesson?.steps[index];
  const stepUrl = (step: number) => `/academy/review?lesson=${lesson!.slug}&step=${step + 1}`;
  return <AppShell><main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <header className="rounded-3xl bg-slate-950 p-6 text-white md:p-10">
      <p className="text-sm font-semibold text-emerald-300">NÁVODY & AKADEMIE · NÁHLED K PŘIPOMÍNKÁM</p>
      <h1 className="mt-3 text-3xl font-bold">Naučte se SeePoint krok za krokem</h1>
      <p className="mt-3 max-w-3xl text-slate-200">Čtyři návody se skutečnými snímky aplikace. Ověřeno 9. 10. 2026 na školicích datech QX promotion v roli administrátora na počítači.</p>
      <p className="mt-3 text-sm text-slate-300">Obsah je určený k doladění. Evidence dokončení, přiřazování školení a odesílání připomínek ještě nejsou v tomto náhledu zapnuté.</p>
    </header>
    {!lesson ? <section className="grid gap-4 md:grid-cols-2" aria-label="Připravené lekce">{lessons.map((item, number) => <Link key={item.slug} href={`/academy/review?lesson=${item.slug}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
      <p className="text-sm font-semibold text-emerald-700">LEKCE {number + 1} · OVĚŘENÝ POSTUP</p><h2 className="mt-3 text-xl font-bold text-slate-900">{item.title}</h2><p className="mt-4 text-slate-600">{item.steps.length} kroků · skutečné screenshoty</p><p className="mt-5 font-semibold text-emerald-700">Otevřít návod →</p>
    </Link>)}</section> : <>
      <Link href="/academy/review" className="inline-flex min-h-11 items-center font-semibold text-emerald-700">← Všechny návody</Link>
      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Kroky lekce" className="rounded-2xl border bg-white p-3"><h2 className="p-3 font-bold">{lesson.title}</h2>{lesson.steps.map((step, number) => <Link key={number} href={stepUrl(number)} aria-current={index === number ? 'step' : undefined} className={`my-1 block rounded-xl p-3 text-sm ${index === number ? 'bg-emerald-100 font-semibold text-emerald-950' : 'text-slate-700 hover:bg-slate-100'}`}>{number + 1}. {step.title}</Link>)}</nav>
        <article className="min-w-0 rounded-2xl border bg-white p-5 md:p-7">
          <p className="text-sm font-semibold text-emerald-700">Krok {index + 1} z {lesson.steps.length}</p><h2 className="mt-2 text-2xl font-bold">{current!.title}</h2>
          <div className="mt-5 space-y-5">{current!.blocks.map((block, number) => block.kind === 'image' && 'file' in block ? <figure key={number}>
            {/* Authenticated media must not pass through a public image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/academy/review-media/${block.file}`} alt={block.text} loading="lazy" className="h-auto w-full rounded-xl border" />
            <figcaption className="mt-2 text-sm text-slate-500">{block.text} · skutečná aplikace, školicí data</figcaption>
          </figure> : <p key={number} className="whitespace-pre-line leading-7 text-slate-700">{block.text}</p>)}</div>
          <nav aria-label="Přechod mezi kroky" className="mt-8 flex flex-wrap justify-between gap-3 border-t pt-5">
            {index > 0 ? <Link href={stepUrl(index - 1)} className="rounded-xl border px-5 py-3">← Předchozí krok</Link> : <span />}
            <Link href={index + 1 < lesson.steps.length ? stepUrl(index + 1) : '/academy/review'} className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">{index + 1 < lesson.steps.length ? 'Další krok →' : 'Zpět na přehled'}</Link>
          </nav>
        </article>
      </div>
    </>}
  </main></AppShell>;
}
