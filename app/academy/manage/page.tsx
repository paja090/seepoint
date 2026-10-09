import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { AcademyBootstrapButton } from '@/components/academy/AcademyBootstrapButton';
import { AcademySetupNotice } from '@/components/academy/AcademySetupNotice';
import { requirePageAccess } from '@/lib/page-auth';
import { canManageAcademy } from '@/lib/academy/policy';
import { getAcademyFeedback, isAcademySchemaMissing } from '@/lib/academy/service';
export const dynamic = 'force-dynamic';
const categories: Record<string, string> = { UNCLEAR: 'Nejasný postup', WRONG_UI: 'Jiné ovládání', BROKEN: 'Nefunkční postup', ACCESS: 'Oprávnění', OUTDATED: 'Zastaralý návod' };
export default async function AcademyManagePage() {
  const actor = await requirePageAccess('academy');
  if (!canManageAcademy(actor)) notFound();
  let feedback;
  try { feedback = await getAcademyFeedback(actor); }
  catch (error) { if (isAcademySchemaMissing(error)) return <AppShell><AcademySetupNotice /></AppShell>; throw error; }
  return <AppShell><div className="mx-auto max-w-5xl space-y-6 pb-20"><Link href="/academy" className="inline-block py-2 text-emerald-700 underline">← Akademie</Link><h1 className="text-3xl font-bold">Obsah a podněty Akademie</h1><section className="card space-y-4"><h2 className="text-xl font-semibold">Pilotní návody</h2><p className="text-slate-600">Připravte pět návrhů pro tuto organizaci. Opakování nepřepíše existující obsah. Návrhy zůstávají neveřejné do ověření a publikace.</p><AcademyBootstrapButton /><Link href="/academy?preview=1" className="inline-block py-2 text-emerald-700 underline">Otevřít redakční náhled</Link><p className="text-sm text-slate-500">Redakční publikace a přiřazování školicích cest budou doplněny v další fázi.</p></section><section><h2 className="mb-3 text-xl font-semibold">Posledních nejvýše 100 podnětů</h2>{!feedback.length ? <p className="card text-slate-600">Zatím nebyl nahlášen žádný problém s návodem.</p> : <ul className="space-y-3">{feedback.map(item => <li key={item.id} className="card"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{item.revision.title} · revize {item.revision.version}</h3><span className="text-sm text-slate-500">{item.createdAt.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })}</span></div><p className="mt-2 text-sm text-emerald-700">{categories[item.category]}{item.stepId ? ` · krok ${item.stepId}` : ''}</p><p className="mt-3 whitespace-pre-wrap break-words text-slate-700">{item.message}</p><p className="mt-2 text-xs text-slate-500">{item.resolvedAt ? 'Vyřešeno' : 'Čeká na zpracování'}</p></li>)}</ul>}</section></div></AppShell>;
}
