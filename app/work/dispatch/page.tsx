import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { DispatchBoard } from '@/components/dispatch/DispatchBoard';
import { WorkRoutePlanner } from '@/components/WorkRoutePlanner';
import { ElectionRoutePlanner } from '@/components/election-removal/ElectionRoutePlanner';
import { requirePageAccess } from '@/lib/page-auth';
import { hasModuleAccess } from '@/lib/module-policy';
import { runWithTenantContext } from '@/lib/tenant-context';
import { loadDispatch } from '@/lib/dispatch/data';
import { loadProfile } from '@/lib/field-planning/data';
import { dayInZone } from '@/lib/field-planning/profile';
import { loadElectionPlanningResources } from '@/lib/election-removal/planning';
import type { PlanningResult } from '@/lib/field-planning/contracts';
export const dynamic = 'force-dynamic';
type Query = { date?: string; planner?: string; jobs?: string; campaign?: string; points?: string; plan?: string; parentPlan?: string };
export default async function DispatchPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const user = await requirePageAccess('work', 'workRoute');
  if (!['ADMIN', 'MANAGER'].includes(user.role)) redirect('/my-route');
  const query = await searchParams ?? {};
  return runWithTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' }, async () => {
    const profile = await loadProfile();
    const requested = query.date;
    const valid = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && !Number.isNaN(Date.parse(requested)) && new Date(requested).toISOString().slice(0,10) === requested;
    const date = valid ? requested : dayInZone(new Date(), profile?.timezone ?? 'Europe/Prague');
    const fieldEnabled = hasModuleAccess(user, 'electionRemoval', 'electionRemoval');
    const navigation = hasModuleAccess(user, 'navigation');
    const data = await loadDispatch(date, fieldEnabled, navigation);
    const campaign = query.campaign && fieldEnabled ? await loadElectionPlanningResources(query.campaign, date, user.organizationId!) : null;
    const selectedPlan = query.plan ? data.plans.find(p => p.id === query.plan) : undefined;
    if (query.plan && !selectedPlan) notFound();
    if (selectedPlan?.electionCampaignId && selectedPlan.electionCampaignId !== campaign?.campaign.id) notFound();
    const result = selectedPlan?.planningSummary as PlanningResult | undefined;
    const jobs = query.jobs?.split(',').filter(Boolean);
    const points = query.points?.split(',').filter(Boolean);
    return <AppShell><div className="mx-auto max-w-7xl space-y-6">
      <DispatchBoard key={date} items={data.items} plans={data.plans} date={date} canCreate={fieldEnabled} messages={data.messages}/>
      <section id="planner" className="scroll-mt-20">
        {campaign && selectedPlan ? <div className="rounded-2xl border bg-white p-5 space-y-3"><h2 className="text-xl font-bold">{result?.planName || 'Výjezd'} · {selectedPlan.date}</h2>
          {result?.crews?.map(crew => <p key={crew.id}>{crew.name}: {crew.stops.length} zastávek</p>)}
          <Link className="block underline" href={'/election-removal/'+encodeURIComponent(campaign.campaign.id)}>Detail akce a výjezdů</Link>
          {['APPROVED','ACTIVE'].includes(selectedPlan.status) && <Link className="block underline" href={'/work/dispatch?'+new URLSearchParams({date,campaign:campaign.campaign.id,parentPlan:selectedPlan.id})+'#planner'}>Upravit nedokončenou práci výjezdu</Link>}
        </div> : campaign ? <ElectionRoutePlanner key={campaign.campaign.id+date+(query.parentPlan??'')} campaign={campaign.campaign} employees={campaign.employees} vehicles={campaign.vehicles} initialDepot={campaign.profile?.depot} timezone={campaign.profile?.timezone} initialPlanningDate={date} fieldPlans={campaign.fieldPlans} canManage parentPlanId={query.parentPlan} initialSelectedPointIds={points ?? (query.parentPlan ? campaign.campaign.points.filter(p=>p.assignedFieldPlanId===query.parentPlan).map(p=>p.id) : undefined)}/> : query.planner==='work' ? (jobs && jobs.length>200 ? <p role="alert">Vyberte nejvýše 200 prací pro jeden návrh.</p> : <WorkRoutePlanner unified key={date+(query.jobs??'')+(query.plan??'')} defaultDate={date} navigation={navigation} country={user.organization?.country??null} initialJobIds={jobs} initialPlanId={query.plan}/>) : null}
      </section>
    </div></AppShell>;
  });
}
