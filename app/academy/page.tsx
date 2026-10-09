import { AppShell } from '@/components/AppShell';
import { redirect } from 'next/navigation';
import { AcademyCatalog } from '@/components/academy/AcademyCatalog';
import { AcademySetupNotice } from '@/components/academy/AcademySetupNotice';
import { requirePageAccess } from '@/lib/page-auth';
import { canManageAcademy } from '@/lib/academy/policy';
import { getAcademyCatalog, isAcademySchemaMissing } from '@/lib/academy/service';
export const dynamic = 'force-dynamic';
export default async function AcademyPage({ searchParams }: { searchParams: Promise<{ q?: string; preview?: string }> }) {
  if (process.env.VERCEL_ENV === 'preview') redirect('/academy/review');
  const actor = await requirePageAccess('academy');
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 160) : '';
  const preview = params.preview === '1' && canManageAcademy(actor);
  let lessons;
  try { lessons = await getAcademyCatalog(actor, { query, preview }); }
  catch (error) { if (isAcademySchemaMissing(error)) return <AppShell><AcademySetupNotice /></AppShell>; throw error; }
  return <AppShell><AcademyCatalog lessons={lessons} query={query} preview={preview} canManage={canManageAcademy(actor)} /></AppShell>;
}
