import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { runWithTenantContext, requireTenantContext } from '@/lib/tenant-context';
import { isModuleEnabled } from '@/lib/organization-modules';
import { syncConnection } from '@/lib/planner/sync';
import { disconnectConnection } from '@/lib/planner/connections';
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim() || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET.trim()}`) return NextResponse.json({ error: 'Neautorizováno.' }, { status: 401 });
  // Only due-work metadata bypasses tenant scoping. No event data or credentials are enumerated.
  const organizations = await platformPrisma.organization.findMany({ select: { id: true, isActive: true, enabledModules: true, plan: true }, orderBy: { id: 'asc' } });
  const enabledIds = organizations.filter(o => o.isActive && isModuleEnabled(o, 'planner') && isModuleEnabled(o, 'googleCalendar')).map(o => o.id);
  const inactiveIds = organizations.filter(o => !o.isActive).map(o => o.id);
  const due = await platformPrisma.calendarConnection.findMany({ where: { credentialsEncrypted: { not: null }, AND: [{ OR: [{ status: 'REVOKED' }, { status: 'CONNECTED', organizationId: { in: enabledIds } }, { organizationId: { in: inactiveIds } }] }, { OR: [{ retryAt: null }, { retryAt: { lte: new Date() } }] }] }, select: { id: true, organizationId: true, userId: true, status: true }, orderBy: { updatedAt: 'asc' }, take: 50 });
  let processed = 0; let okCount = 0; let errorCount = 0; const started = Date.now();
  for (const c of due) {
    if (Date.now() - started > 240000) break;
    await runWithTenantContext({ organizationId: c.organizationId, source: 'script' }, async () => {
        requireTenantContext();
        try {
          if (c.status === 'REVOKED' || inactiveIds.includes(c.organizationId)) {
            await disconnectConnection(c.organizationId, c.userId, c.id);
            okCount++;
          } else {
            const syncRes = await syncConnection(c.organizationId, c.userId, c.id);
            if (syncRes.status === 'OK') okCount++;
            else if (syncRes.status === 'ERROR') errorCount++;
          }
          processed++;
        } catch { errorCount++; /* Each connection carries its own safe status; no credentials are logged. */ }
    });
  }
  console.log('[cron/planner]', JSON.stringify({ due: due.length, processed, okCount, errorCount, durationMs: Date.now() - started }));
  return NextResponse.json({ ok: true, processed, okCount, errorCount });
}
