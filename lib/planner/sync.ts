import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { googleOAuthConfiguration } from '@/lib/integrations/google-oauth';
import { decryptIntegrationSecret } from '@/lib/integrations/integration-crypto';
import { activeMembers } from './repository';
import { calendarProvider } from './providers/google';
import { ProviderError, type ProviderEvent } from './providers/types';
import { uniqueProviderEvents } from './sync-core';
import { disconnectConnection } from './connections';

export async function syncConnection(organizationId: string, userId: string, id: string) {
  const ownerActive = () => activeMembers(organizationId).then(members => members.some(m => m.userId === userId));
  if (!await ownerActive()) { await disconnectConnection(organizationId, userId, id); return { status: 'REVOKED' }; }
  const lease = randomUUID(), now = new Date();
  const claimed = await prisma.calendarConnection.updateMany({ where: { id, organizationId, userId, status: 'CONNECTED', AND: [{ OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lt: now } }] }, { OR: [{ retryAt: null }, { retryAt: { lte: now } }] }] }, data: { syncLeaseUntil: new Date(+now + 240000), syncLeaseId: lease, syncStatus: 'RUNNING' } });
  if (!claimed.count) return { status: 'BUSY_OR_RETRY_PENDING' };
  try {
    const connection = await prisma.calendarConnection.findFirstOrThrow({ where: { id, organizationId, userId, syncLeaseId: lease } });
    if (!connection.credentialsEncrypted) throw new ProviderError('REAUTH_REQUIRED');
    const { refreshToken } = decryptIntegrationSecret<{ refreshToken: string }>(connection.credentialsEncrypted, googleOAuthConfiguration().encryptionKey);
    const provider = calendarProvider(connection.provider);
    const token = await provider.refreshCredentials(refreshToken);
    const calendars = await provider.getCalendars(token);
    if (!await ownerActive()) { await disconnectConnection(organizationId, userId, id); return { status: 'REVOKED' }; }
    // Fence each write with the lease/status. Offboarding clears the lease in the DB trigger.
    await prisma.$transaction(async tx => {
      const alive = await tx.calendarConnection.updateMany({ where: { id, organizationId, status: 'CONNECTED', syncLeaseId: lease }, data: { syncStatus: 'RUNNING' } });
      if (!alive.count) throw new ProviderError('REAUTH_REQUIRED');
      await tx.externalCalendar.deleteMany({ where: { organizationId, connectionId: id, externalId: { notIn: calendars.map(c => c.externalId) } } });
      for (const c of calendars) await tx.externalCalendar.upsert({ where: { organizationId_connectionId_externalId: { organizationId, connectionId: id, externalId: c.externalId } }, create: { organizationId, connectionId: id, externalId: c.externalId, name: c.name, timezone: c.timezone }, update: { name: c.name, timezone: c.timezone } });
    });
    const selected = await prisma.externalCalendar.findMany({ where: { organizationId, connectionId: id, selected: true } });
    for (const c of selected) {
      if (Date.now() - +now > 150000) throw new ProviderError('PROVIDER_ERROR');
      let syncToken = c.fullSyncedAt && +now - +c.fullSyncedAt < 7 * 86400000 ? c.syncToken || undefined : undefined;
      let events: ProviderEvent[] = [], pageToken: string | undefined, nextSyncToken: string | undefined;
      let reset = false, pages = 0;
      do {
        try {
          const page = await provider.getEvents(token, { externalId: c.externalId, name: c.name, timezone: c.timezone, primary: c.isPrimary }, { syncToken, pageToken, from: new Date(+now - 30 * 86400000), to: new Date(+now + 120 * 86400000) });
          events.push(...page.events); pageToken = page.nextPageToken; nextSyncToken = page.nextSyncToken;
          if (++pages > 10 || events.length > 20000) throw new ProviderError('PROVIDER_ERROR');
        } catch (error) {
          if (error instanceof ProviderError && error.code === 'SYNC_RESET' && !reset) { syncToken = undefined; pageToken = undefined; events = []; reset = true; continue; }
          throw error;
        }
        if (!pageToken) break;
      } while (true);
      if (!nextSyncToken) throw new ProviderError('PROVIDER_ERROR');
      await prisma.$transaction(async tx => {
        const alive = await tx.calendarConnection.updateMany({ where: { id, organizationId, status: 'CONNECTED', syncLeaseId: lease }, data: { syncStatus: 'RUNNING' } });
        if (!alive.count) throw new ProviderError('REAUTH_REQUIRED');
        const stillSelected = await tx.externalCalendar.findFirst({ where: { id: c.id, organizationId, selected: true } });
        if (!stillSelected) return;
        if (!syncToken) await tx.externalCalendarEvent.deleteMany({ where: { organizationId, calendarId: c.id } });
        for (const event of uniqueProviderEvents(events)) {
          const identity = { organizationId, calendarId: c.id, externalEventId: event.externalEventId };
          if (event.cancelled) { await tx.externalCalendarEvent.deleteMany({ where: identity }); continue; }
          const data = { title: event.title, startAt: event.startAt!, endAt: event.endAt!, timezone: event.timezone, allDay: event.allDay, busy: event.busy, isPrivate: event.isPrivate, location: event.location, etag: event.etag, lastSyncedAt: new Date() };
          await tx.externalCalendarEvent.upsert({ where: { organizationId_calendarId_externalEventId: identity }, create: { ...identity, ...data }, update: data });
        }
        await tx.externalCalendar.update({ where: { id: c.id, organizationId }, data: { syncToken: nextSyncToken, lastSyncedAt: new Date(), ...(!syncToken ? { fullSyncedAt: new Date() } : {}) } });
      }, { timeout: 60000 });
    }
    await prisma.calendarConnection.updateMany({ where: { id, organizationId, syncLeaseId: lease, status: 'CONNECTED' }, data: { lastSyncAt: new Date(), syncStatus: 'OK', syncLeaseUntil: null, syncLeaseId: null, errorCode: null, retryAt: null } });
    return { status: 'OK' };
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : 'PROVIDER_ERROR';
    await prisma.calendarConnection.updateMany({ where: { id, organizationId, syncLeaseId: lease }, data: { syncStatus: 'ERROR', errorCode: code, ...(code === 'REAUTH_REQUIRED' ? { status: 'ERROR' } : {}), retryAt: new Date(Date.now() + 15 * 60000), syncLeaseUntil: null, syncLeaseId: null } });
    return { status: 'ERROR', errorCode: code };
  }
}
