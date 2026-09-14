import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { syncMailbox, processAiInboxMessage } from '@/lib/ai-inbox/service';
import { hasModuleAccess } from '@/lib/module-policy';
import { runWithTenantContext } from '@/lib/tenant-context';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Automated Cron Endpoint for AI Inbox Mailbox Synchronization
 * Invoked by Vercel Cron on schedule (e.g. every 15 minutes).
 * Authenticates via Bearer CRON_SECRET or an authenticated ADMIN/MANAGER session.
 */
async function handleCronExecution(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization');
  const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  let isAuthorized = isCronAuthorized;
  let callerOrganizationId: string | undefined;

  if (!isAuthorized) {
    const user = await getCurrentUser();
    if (user && ['ADMIN', 'MANAGER'].includes(user.role) && hasModuleAccess(user, 'aiInbox')) {
      isAuthorized = true;
      callerOrganizationId = user.organizationId;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Neautorizovaný přístup k plánovači AI Inboxu.' },
      { status: 401 }
    );
  }

  try {
    const connections = await prisma.integrationConnection.findMany({
      where: {
        provider: 'GMAIL',
        status: 'CONNECTED',
        ...(isCronAuthorized ? {} : { organizationId: callerOrganizationId }),
      },
      select: {
        id: true,
        organizationId: true,
        accountEmail: true,
        settings: true,
        lastCheckedAt: true,
      },
    });

    const now = Date.now();
    const results = [];

    for (const conn of connections) {
      const settings = (conn.settings && typeof conn.settings === 'object' ? conn.settings : {}) as Record<string, unknown>;
      const intervalMinutes = typeof settings.autoSyncIntervalMinutes === 'number' ? settings.autoSyncIntervalMinutes : 15;

      // Pokud má uživatel nastaveno 0, automatický cron pro tuto schránku je vypnut
      if (intervalMinutes === 0 && isCronAuthorized) {
        continue;
      }

      // Kontrola intervalu od poslední kontroly
      if (conn.lastCheckedAt && isCronAuthorized) {
        const elapsedMinutes = (now - conn.lastCheckedAt.getTime()) / (1000 * 60);
        if (elapsedMinutes < intervalMinutes - 1) {
          continue;
        }
      }

      try {
        const syncResult = await runWithTenantContext(
          { organizationId: conn.organizationId, source: 'session' },
          () => syncMailbox(conn.organizationId, conn.id)
        );

        // Zpracovat AI analýzu pro nově stažené e-maily
        for (const item of syncResult.ingested) {
          if (item.message.id && (!item.isDuplicate || item.message.processingStatus === 'INGESTED')) {
            try {
              await processAiInboxMessage(conn.organizationId, item.message.id);
            } catch (pErr) {
              console.warn(`[Cron AI Inbox] Chyba analýzy zprávy ${item.message.id}:`, pErr);
            }
          }
        }

        results.push({
          connectionId: conn.id,
          accountEmail: conn.accountEmail,
          syncedCount: syncResult.syncedCount,
          newMessagesCount: syncResult.newMessagesCount,
        });
      } catch (connErr) {
        console.error(`[Cron AI Inbox] Chyba synchronizace schránky ${conn.id}:`, connErr);
        results.push({
          connectionId: conn.id,
          accountEmail: conn.accountEmail,
          error: connErr instanceof Error ? connErr.message : 'Chyba synchronizace',
        });
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      processedMailboxes: results.length,
      results,
    });
  } catch (error) {
    console.error('Fatal cron AI Inbox execution error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chyba při běhu cronu' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleCronExecution(request);
}

export async function POST(request: Request) {
  return handleCronExecution(request);
}
