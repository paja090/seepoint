import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { profileForNavigation } from '@/lib/field-planning/profile';
import type { PlanView, PlanningInput } from '@/lib/field-planning/contracts';
import { navigationAvailable } from '@/lib/field-planning/capabilities';
import { prisma } from '@/lib/db';
import { loadPlanningData, loadProfile } from '@/lib/field-planning/data';
import { approvePlan, cancelDraft, generatePlan, getPlan, planView, requirePlannerManager, saveProfile } from '@/lib/field-planning/service';

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
    const data = profile?.enabled ? await loadPlanningData(date) : null;
    const plans = await prisma.fieldPlan.findMany({ where: { organizationId: user.organizationId, date }, orderBy: { version: 'desc' }, take: 20 });
    const navigation = await navigationAvailable();
    return NextResponse.json({ profile, data, plans: plans.filter(p => navigation || !(p.planningInputSnapshot as unknown as PlanningInput).jobs.some(j => j.navigationPointId)).map(planView).map(p => ({ ...p, profile: profileForNavigation(p.profile, navigation) })) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const user = await requireApiAccess('work', 'workRoute'); if (isApiDenied(user)) return user;
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  try { requirePlannerManager(user); return NextResponse.json(await publicPlan(await generatePlan(await request.json(), user))); }
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
    throw new Error('Neplatná akce.');
  } catch (error) { return failure(error); }
}
