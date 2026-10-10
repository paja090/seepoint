import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getCurrentUser } from '@/lib/auth';
import { canReviewAcademy, canReadSharedLesson } from '@/lib/academy/review-policy';
import { matchesAcademySearch } from '@/lib/academy/policy';
import lessons from '@/lib/academy/review-lessons.json';

export const dynamic = 'force-dynamic';
export default async function AcademyReview({ searchParams }: { searchParams: Promise<{ lesson?: string; step?: string; q?: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect('/login');
  if (!canReviewAcademy(actor)) notFound();
  const query = await searchParams;
  const available = lessons.filter(item => canReadSharedLesson(actor, item.capability));
  const lesson = available.find(item => item.slug === query.lesson);
  if (query.lesson && !lesson) notFound();
  const search = typeof query.q === 'string' ? query.q.slice(0, 160) : '';
  const results = available.filter(item => matchesAcademySearch(`${item.title} ${item.steps.map(step => step.title).join(' ')}`, search));
  const index = Math.max(0, Math.min((lesson?.steps.length ?? 1) - 1, Number.parseInt(query.step ?? '1', 10) - 1 || 0));
  const current = lesson?.steps[index];
  const followingLesson = lesson ? available[available.findIndex(item => item.slug === lesson.slug) + 1] : undefined;
  const stepUrl = (step: number) => `/academy?lesson=${lesson!.slug}&step=${step + 1}`;
  return <AppShell><main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <header className="rounded-3xl bg-slate-950 p-6 text-white md:p-10">
      <p className="text-sm font-semibold text-emerald-300">NÁVODY & AKADEMIE</p>
      <h1 className="mt-3 text-3xl font-bold">Naučte se SeePoint krok za krokem</h1>
      <p className="mt-3 max-w-3xl text-slate-200">Začněte nastavením agentury, firmy a týmu. Pokračujte krátkými návody pro každodenní práci. Zobrazují se lekce podle vašich oprávnění; rozsah ověření najdete u každého postupu.</p>
      <p className="mt-3 text-sm text-slate-300">Ve své agentuře používejte vlastní klienty a nabídky. Názvy školicích záznamů na obrázcích jsou pouze ukázka. Evidence dokončení a přiřazování školení se připravují.</p>
    </header>
    {!lesson ? <><form action="/academy" className="flex flex-wrap gap-3"><label htmlFor="academy-search" className="w-full font-semibold">Najít návod</label><input id="academy-search" name="q" defaultValue={search} maxLength={160} placeholder="Například klient, mapa nebo nabídka" className="min-w-0 flex-1 rounded-xl border px-4 py-3" /><button className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">Hledat</button></form>
    {results.length === 0 && <p className="rounded-xl border bg-white p-5">{available.length ? 'Pro tento dotaz jsme návod nenašli. Zkuste kratší výraz.' : 'Pro vaše dostupné moduly zatím nejsou zveřejněné lekce. Další návody postupně doplňujeme.'}</p>}
    <section className="grid gap-4 md:grid-cols-2" aria-label="Připravené lekce">{results.map((item, number) => <Link key={item.slug} href={`/academy?lesson=${item.slug}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
      <p className="text-sm font-semibold text-emerald-700">{item.category} · LEKCE {number + 1}</p><h2 className="mt-3 text-xl font-bold text-slate-900">{item.title}</h2><p className="mt-4 text-slate-600">{item.steps.length} {item.steps.length < 5 ? 'kroky' : 'kroků'} · {item.duration}</p><p className="mt-3 text-sm text-slate-500">{item.status === 'MEDIA_PENDING' ? 'Čeká na vizuály · ' : ''}{item.verification}</p><p className="mt-5 font-semibold text-emerald-700">Otevřít návod →</p>
    </Link>)}</section></> : <>
      <Link href="/academy" className="inline-flex min-h-11 items-center font-semibold text-emerald-700">← Všechny návody</Link>
      <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-slate-800"><p>{lesson.verification}</p><p className="mt-2">{lesson.status === 'MEDIA_PENDING' ? 'Screenshot zatím není dostupný. ' : ''}Poslední kontrola: {lesson.verifiedAt} · {lesson.duration}</p><Link href={lesson.route} className="mt-2 inline-flex min-h-11 items-center font-semibold underline">Otevřít odpovídající obrazovku →</Link></aside>
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
            <Link href={index + 1 < lesson.steps.length ? stepUrl(index + 1) : '/academy'} className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">{index + 1 < lesson.steps.length ? 'Další krok →' : 'Zpět na přehled'}</Link>
          </nav>
          {index === lesson.steps.length - 1 && followingLesson?.category === lesson.category && <Link href={`/academy?lesson=${followingLesson.slug}`} className="mt-5 block rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-900">Pokračovat: {followingLesson.title} →</Link>}
        </article>
      </div>
    </>}
  </main></AppShell>;
}
