import { enterTenantContext } from '@/lib/tenant-context';
import { hasModuleAccess } from '@/lib/module-policy';
import { isFieldJobId } from '@/lib/field-planning/field-jobs';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { profileForNavigation } from '@/lib/field-planning/profile';
import type { PlanView, PlanningInput } from '@/lib/field-planning/contracts';
import { navigationAvailable } from '@/lib/field-planning/capabilities';
import { prisma } from '@/lib/db';
import { loadPlanningData, loadProfile } from '@/lib/field-planning/data';
import { approvePlan, cancelDraft, generatePlan, getPlan, planView, renameCrew, requirePlannerManager, saveProfile, transferCrew } from '@/lib/field-planning/service';
import { enrichCrewsWithLiveLocations } from '@/lib/field-planning/live-location';

async function publicPlan(plan: PlanView) { return { ...plan, profile: profileForNavigation(plan.profile, await navigationAvailable()) }; }
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Plánování selhalo.';
  return NextResponse.json({ error: message }, { status: message.startsWith('FORBIDDEN') ? 403 : message.startsWith('NOT_FOUND') ? 404 : 409 });
}
export async function GET(request: Request) {
  const user = await requireApiAccess('work', 'workRoute'); if (isApiDenied(user)) return user;
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  try {
    requirePlannerManager(user); const query = new URL(request.url).searchParams;
    if (query.get('id')) return NextResponse.json(await publicPlan(planView(await getPlan(query.get('id')!))));
    const profile = await loadProfile(); const date = query.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Vyberte den.' }, { status: 400 });
    const jobs=query.get('jobs')?.split(',').filter(Boolean);
    if(jobs && (jobs.length>200||jobs.some(id=>id.length>100)))throw new Error('Vyberte nejvýše 200 prací.');
    const field=hasModuleAccess(user,'electionRemoval','electionRemoval');
    if(!field&&jobs?.some(isFieldJobId))throw new Error('FORBIDDEN: Terénní práce nejsou dostupné.');
    const data = profile?.enabled ? await loadPlanningData(date,{jobIds:jobs,includeField:query.get('source')==='dispatch'&&field}) : null;
    const plans = await prisma.fieldPlan.findMany({ where: { organizationId: user.organizationId, date, ...(['work','dispatch'].includes(query.get('source')??'') ? { electionCampaignId: null } : {}) }, orderBy: { version: 'desc' }, take: 20 });
    const navigation = await navigationAvailable();
    const rawPlans = plans.filter(p=>field || !(p.planningInputSnapshot as unknown as PlanningInput).jobs.some(j=>j.electionRemovalPointId)).filter(p => navigation || !(p.planningInputSnapshot as unknown as PlanningInput).jobs.some(j => j.navigationPointId)).map(planView);
    const enrichedPlans = await Promise.all(rawPlans.map(async p => {
      const crewsWithLocations = await enrichCrewsWithLiveLocations(p.result.crews, p.id, user.organizationId!);
      return { ...p, result: { ...p.result, crews: crewsWithLocations }, profile: profileForNavigation(p.profile, navigation) };
    }));
    return NextResponse.json({ profile, data, plans: enrichedPlans });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const user = await requireApiAccess('work', 'workRoute'); if (isApiDenied(user)) return user;
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  try { requirePlannerManager(user); const body=await request.json();
    if(Array.isArray(body?.jobIds)&&body.jobIds.some((id:unknown)=>typeof id==='string'&&isFieldJobId(id))&&!hasModuleAccess(user,'electionRemoval','electionRemoval'))throw new Error('FORBIDDEN: Terénní práce nejsou dostupné.');
    return NextResponse.json(await publicPlan(await generatePlan(body, user))); }
  catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  const user = await requireApiAccess('work', 'workRoute'); if (isApiDenied(user)) return user;
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  try {
    requirePlannerManager(user); const body = await request.json();
    if (body.action === 'profile') return NextResponse.json(await saveProfile(body.profile, user));
    if (typeof body.id !== 'string') throw new Error('Chybí plán.');
    if (body.action === 'approve') return NextResponse.json(await publicPlan(await approvePlan(body.id, user, body.acceptEstimated === true)));
    if (body.action === 'cancel') return NextResponse.json(await publicPlan(await cancelDraft(body.id, user)));
    if (body.action === 'renameCrew') {
      if (typeof body.crewId !== 'string') throw new Error('Chybí posádka.');
      if (typeof body.name !== 'string') throw new Error('Chybí název trasy.');
      return NextResponse.json(await publicPlan(await renameCrew(body.id, body.crewId, body.name, user)));
    }
    if (body.action === 'transferCrew') {
      if (typeof body.crewId !== 'string') throw new Error('Chybí posádka.');
      if (typeof body.targetEmployeeId !== 'string') throw new Error('Chybí cílový pracovník.');
      return NextResponse.json(await publicPlan(await transferCrew(body.id, body.crewId, body.targetEmployeeId, user, body.mode)));
    }
    throw new Error('Neplatná akce.');
  } catch (error) { return failure(error); }
}
