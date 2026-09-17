import 'server-only';
import { prisma } from '@/lib/db';
import { googleOAuthConfiguration } from '@/lib/integrations/google-oauth';
import { decryptIntegrationSecret } from '@/lib/integrations/integration-crypto';
import { hasModuleAccess } from '@/lib/module-policy';
import type { AuthenticatedPlannerActor } from './auth';
import { PlannerError } from './domain';
import { assertOwner } from './permissions';
import { calendarProvider } from './providers/google';

export const publicConnectionSelect = { id: true, provider: true, email: true, status: true, syncStatus: true, errorCode: true, lastSyncAt: true, connectedAt: true, calendars: { select: { id: true, name: true, timezone: true, kind: true, visibility: true, selected: true, isPrimary: true, lastSyncedAt: true } } } as const;
export function assertCalendarEnabled(actor: AuthenticatedPlannerActor) {
  if (!hasModuleAccess(actor, 'googleCalendar', 'planner')) throw new PlannerError('Google Calendar není pro firmu aktivovaný.', 403);
}
export async function disconnectConnection(organizationId: string, userId: string, id: string) {
  // Disable locally BEFORE any external revocation attempt. The encrypted secret is a retry payload only.
  const connection = await prisma.$transaction(async tx => {
    const c = await tx.calendarConnection.findFirst({ where: { id, organizationId, userId } });
    if (!c) throw new PlannerError('Připojení nebylo nalezeno.', 404);
    await tx.calendarConnection.update({ where: { id, organizationId }, data: { status: 'REVOKED', syncStatus: 'IDLE', syncLeaseId: null, syncLeaseUntil: null } });
    await tx.externalCalendarEvent.deleteMany({ where: { organizationId, calendar: { connectionId: id, organizationId } } });
    await tx.externalCalendar.updateMany({ where: { organizationId, connectionId: id }, data: { syncToken: null, selected: false } });
    await tx.userAuditLog.create({ data: { organizationId, targetUserId: userId, actorUserId: userId, action: 'PLANNER_CHANGED', metadata: { event: 'CALENDAR_DISCONNECTED', connectionId: id } } });
    return c;
  });
  if (connection.credentialsEncrypted) {
    try {
      const { refreshToken } = decryptIntegrationSecret<{ refreshToken: string }>(connection.credentialsEncrypted, googleOAuthConfiguration().encryptionKey);
      await calendarProvider(connection.provider).disconnect(refreshToken);
      await prisma.calendarConnection.updateMany({ where: { id, organizationId, status: 'REVOKED', credentialsEncrypted: connection.credentialsEncrypted }, data: { credentialsEncrypted: null, errorCode: null } });
    } catch {
      await prisma.calendarConnection.updateMany({ where: { id, organizationId, status: 'REVOKED' }, data: { errorCode: 'REVOCATION_PENDING', retryAt: new Date(Date.now() + 15 * 60000) } });
    }
  }
  return { ok: true };
}
export async function updateCalendar(actor: AuthenticatedPlannerActor, id: string, body: Record<string, unknown>) {
  const c = await prisma.externalCalendar.findFirst({ where: { id, organizationId: actor.organizationId }, include: { connection: true } });
  assertOwner(actor, c?.connection ?? null);
  if (!c || c.connection.status !== 'CONNECTED') throw new PlannerError('Kalendář je odpojený.', 409);
  if (!['PERSONAL', 'COMPANY'].includes(String(body.kind)) || !['FREE_BUSY', 'WORK_DETAILS', 'FULL'].includes(String(body.visibility)) || typeof body.selected !== 'boolean' || typeof body.isPrimary !== 'boolean') throw new PlannerError('Neplatné nastavení kalendáře.');
  if ((body.kind === 'COMPANY' || c.kind === 'COMPANY') && actor.role !== 'ADMIN') throw new PlannerError('Firemní kalendáře spravuje administrátor.', 403);
  return prisma.$transaction(async tx => {
    if (body.isPrimary) await tx.externalCalendar.updateMany({ where: { organizationId: actor.organizationId, connection: { userId: actor.id } }, data: { isPrimary: false } });
    const updated = await tx.externalCalendar.update({ where: { id, organizationId: actor.organizationId }, data: { kind: body.kind as string, visibility: body.visibility as string, selected: body.selected as boolean, isPrimary: body.isPrimary as boolean, ...(!body.selected ? { syncToken: null } : {}) }, select: { id: true } });
    if (!body.selected) await tx.externalCalendarEvent.deleteMany({ where: { organizationId: actor.organizationId, calendarId: id } });
    await tx.userAuditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.id, targetUserId: actor.id, action: 'PLANNER_CHANGED', metadata: { event: 'CALENDAR_VISIBILITY_CHANGED', calendarId: id, visibility: body.visibility as string, kind: body.kind as string, selected: body.selected as boolean } } });
    return updated;
  });
}
