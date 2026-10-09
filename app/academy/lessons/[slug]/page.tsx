import { academyPrimaryButton } from '@/components/academy/styles';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { AcademyFeedbackForm } from '@/components/academy/AcademyFeedbackForm';
import { AcademySetupNotice } from '@/components/academy/AcademySetupNotice';
import { requirePageAccess } from '@/lib/page-auth';
import { getAcademyLesson, isAcademySchemaMissing } from '@/lib/academy/service';
import { canManageAcademy, statusLabels } from '@/lib/academy/policy';
export const dynamic = 'force-dynamic';
export default async function AcademyLessonPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const actor = await requirePageAccess('academy');
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const preview = query.preview === '1' && canManageAcademy(actor);
  let lesson;
  try { lesson = await getAcademyLesson(actor, slug, preview); }
  catch (error) { if (isAcademySchemaMissing(error)) return <AppShell><AcademySetupNotice /></AppShell>; throw error; }
  if (!lesson) notFound();
  return <AppShell><article className="mx-auto max-w-4xl space-y-6 pb-20"><Link className="inline-block py-2 text-sm text-emerald-700 underline" href={preview ? '/academy?preview=1' : '/academy'}>← Zpět do Akademie</Link><header><p className="text-sm text-slate-600">{lesson.category} · {lesson.durationMinutes} min · revize {lesson.version}</p><h1 className="mt-2 text-3xl font-bold">{lesson.title}</h1><p className="mt-3 text-slate-600">{lesson.summary}</p><p className="mt-3 text-sm font-medium">{statusLabels[lesson.status]} · {lesson.verifiedAt ? `Ověřeno ${new Date(lesson.verifiedAt).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })}` : 'Zatím neověřeno v běžící aplikaci'}</p></header>{lesson.status !== 'PUBLISHED' && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">Redakční návrh. Před publikací je nutné postup ověřit a doplnit skutečné vizuály. Tento obsah zatím není hotovým školením.</p>}<section className="card"><h2 className="text-lg font-semibold">Co budete potřebovat</h2><ul className="mt-3 list-disc space-y-2 pl-5">{lesson.content.prerequisites.map(item => <li key={item}>{item}</li>)}</ul></section><ol className="space-y-5">{lesson.content.steps.map((step, index) => <li key={step.id} id={`step-${step.id}`} className="card scroll-mt-8"><h2 className="text-xl font-semibold">{index + 1}. {step.title}</h2><p className="mt-3 leading-relaxed text-slate-700">{step.instruction}</p>{step.warning && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{step.warning}</p>}<div className="mt-4 rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">Vizuál tohoto kroku čeká na pořízení ze skutečného testovacího prostředí.</div></li>)}</ol><div className="card"><h2 className="text-lg font-semibold">Pokračovat v aplikaci</h2><p className="my-3 text-sm text-slate-600">Odkaz otevře příslušnou agendu. Žádná operace se neprovede automaticky.</p><Link href={lesson.moduleRoute} className={academyPrimaryButton}>Otevřít příslušný modul</Link></div><AcademyFeedbackForm revisionId={lesson.id} steps={lesson.content.steps.map(({ id, title }) => ({ id, title }))} /></article></AppShell>;
}
