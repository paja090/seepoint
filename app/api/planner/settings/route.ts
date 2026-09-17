import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { plannerApi } from '@/lib/planner/auth';
import { preferencesFor } from '@/lib/planner/repository';
import { validatePreferences } from '@/lib/planner/preferences';
import { publicConnectionSelect } from '@/lib/planner/connections';
import { isGoogleOAuthConfigured } from '@/lib/integrations/google-oauth';
import { PlannerError } from '@/lib/planner/domain';
import { hasModuleAccess } from '@/lib/module-policy';
export function GET(request: Request) { return plannerApi(request, async actor => ({
  preferences: await preferencesFor(actor.organizationId, actor.id, actor.organization?.plannerDefaults),
  connections: await prisma.calendarConnection.findMany({ where: { organizationId: actor.organizationId, userId: actor.id }, select: publicConnectionSelect }),
  isAdmin: actor.role === 'ADMIN', googleConfigured: isGoogleOAuthConfigured(), googleEnabled: hasModuleAccess(actor, 'googleCalendar', 'planner'), aiAvailable: false,
})); }
export function PUT(request: Request) { return plannerApi(request, async actor => {
  const body = await request.json(), configuration = validatePreferences(body.preferences);
  if (configuration.aiEnabled || configuration.autoSuggestions) throw new PlannerError('AI plánování připravujeme. Zatím lze plánovat ručně.');
  if (body.company && actor.role !== 'ADMIN') throw new PlannerError('Firemní pravidla může změnit pouze administrátor.', 403);
  await prisma.$transaction(async tx => {
    if (body.company) await tx.organization.update({ where: { id: actor.organizationId }, data: { plannerDefaults: configuration as unknown as Prisma.InputJsonValue } });
    else await tx.plannerPreferences.upsert({ where: { organizationId_userId: { organizationId: actor.organizationId, userId: actor.id } }, create: { organizationId: actor.organizationId, userId: actor.id, configuration: configuration as unknown as Prisma.InputJsonValue }, update: { configuration: configuration as unknown as Prisma.InputJsonValue } });
    await tx.userAuditLog.create({ data: { organizationId: actor.organizationId, targetUserId: actor.id, actorUserId: actor.id, action: 'PLANNER_CHANGED', metadata: { event: body.company ? 'COMPANY_PLANNER_RULES_CHANGED' : 'PLANNER_PREFERENCES_CHANGED' } } });
  });
  return { ok: true };
}); }
