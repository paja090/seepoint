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

  if (!canAccess(user.role, 'aiInbox')) {
    return NextResponse.json({ error: 'Nemáte oprávnění pro synchronizaci AI Inboxu.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  let connectionId: string | undefined;
  let query: string | undefined;
  let preset: 'INBOX' | 'ORDERS_ONLY' | 'ALL' | undefined;
  let maxResults: number | undefined;

  try {
    const body = await request.json() as {
      connectionId?: string;
      query?: string;
      preset?: 'INBOX' | 'ORDERS_ONLY' | 'ALL';
      maxResults?: number;
    };
    if (body.connectionId) connectionId = body.connectionId;
    if (body.query) query = body.query;
    if (body.preset) preset = body.preset;
    if (body.maxResults) maxResults = body.maxResults;
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
    const messagesToAnalyze: string[] = [];

    for (const cId of connectionsToSync) {
      const syncResult = await syncMailbox(organizationId, cId, {
        query,
        preset,
        maxResults,
      });

      for (const item of syncResult.ingested) {
        if (item.message.id && (!item.isDuplicate || item.message.processingStatus === 'INGESTED')) {
          messagesToAnalyze.push(item.message.id);
        }
      }
      syncResults.push(syncResult);
    }

    // Pro zamezení vypršení časového limitu (timeout na mobilu):
    // Zpracujeme první zprávu inline (do ~2-3 s), zbytek spustíme asynchronně na pozadí.
    if (messagesToAnalyze.length > 0) {
      const firstBatch = messagesToAnalyze.slice(0, 2);
      const remainingBatch = messagesToAnalyze.slice(2);

      await Promise.allSettled(
        firstBatch.map((id) => processAiInboxMessage(organizationId, id).catch((err) => {
          console.warn(`[AI Inbox Sync] Chyba při analýze zprávy ${id}:`, err);
        }))
      );

      if (remainingBatch.length > 0) {
        void (async () => {
          for (const id of remainingBatch) {
            try {
              await processAiInboxMessage(organizationId, id);
            } catch (err) {
              console.warn(`[AI Inbox Background Sync] Chyba při analýze zprávy ${id}:`, err);
            }
          }
        })();
      }
    }

    return NextResponse.json({ ok: true, results: syncResults });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chyba při synchronizaci schránek';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
