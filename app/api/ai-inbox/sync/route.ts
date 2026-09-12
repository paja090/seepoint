import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { syncMailbox, processAiInboxMessage } from '@/lib/ai-inbox/service';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'aiInbox' as any)) {
    return NextResponse.json({ error: 'Nemáte oprávnění pro synchronizaci AI Inboxu.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  let connectionId: string | undefined;
  try {
    const body = await request.json() as { connectionId?: string };
    if (body.connectionId) connectionId = body.connectionId;
  } catch {
    // optional body
  }

  try {
    let connectionsToSync: string[] = [];
    if (connectionId) {
      connectionsToSync = [connectionId];
    } else {
      const activeConnections = await prisma.integrationConnection.findMany({
        where: {
          organizationId,
          provider: 'GMAIL',
          status: 'CONNECTED',
        },
        select: { id: true },
      });
      connectionsToSync = activeConnections.map((c) => c.id);
    }

    if (connectionsToSync.length === 0) {
      return NextResponse.json(
        { error: 'Není připojena žádná aktivní Gmail schránka k synchronizaci.' },
        { status: 400 }
      );
    }

    const syncResults = [];
    for (const cId of connectionsToSync) {
      const syncResult = await syncMailbox(organizationId, cId);
      // Spustit AI analýzu na nově stažených zprávách
      for (const item of syncResult.ingested) {
        if (!item.isDuplicate && item.message.id) {
          try {
            await processAiInboxMessage(organizationId, item.message.id);
          } catch (procErr) {
            console.warn(`[AI Inbox Sync] Chyba při analýze zprávy ${item.message.id}:`, procErr);
          }
        }
      }
      syncResults.push(syncResult);
    }

    return NextResponse.json({ ok: true, results: syncResults });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chyba při synchronizaci schránek';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
