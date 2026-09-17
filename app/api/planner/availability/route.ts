import { plannerApi } from '@/lib/planner/auth';
import { PlannerError } from '@/lib/planner/domain';
import { canSeeTeam } from '@/lib/planner/permissions';
import { preferencesFor } from '@/lib/planner/repository';
import { userTimeline } from '@/lib/planner/read-model';
import { findSlots } from '@/lib/planner/scheduling';
export function POST(request: Request) { return plannerApi(request, async actor => {
  const body = await request.json(), from = new Date(body.from), to = new Date(body.to);
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || to <= from || +to - +from > 14 * 86400000 || !Number.isInteger(body.durationMinutes) || body.durationMinutes < 15 || body.durationMinutes > 480) throw new PlannerError('Vyberte interval do 14 dnů a délku schůzky 15–480 minut.');
  const ids: string[] = body.userIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 20 || ids.some(id => typeof id !== 'string' || (id !== actor.id && !canSeeTeam(actor)))) throw new PlannerError('Nemáte přístup k dostupnosti účastníků.', 403);
  const participants = await Promise.all([...new Set(ids)].map(async userId => ({ preferences: await preferencesFor(actor.organizationId, userId, actor.organization?.plannerDefaults), busy: (await userTimeline(actor, userId, from, to)).filter(i => i.busy) })));
  return { slots: findSlots({ from: new Date(Math.max(+from, Date.now())), to, durationMinutes: body.durationMinutes, participants }), provisional: true, message: 'Návrhy vycházejí ze synchronizovaných kalendářů. Před rezervací ověřte aktuální dostupnost.' };
}); }
