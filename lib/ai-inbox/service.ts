import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import type { MailboxSyncSettings, RawInboundMessage } from './types';
import {
  getGmailAccessToken,
  getGmailMessage,
  listGmailMessages,
  parseRawGmailMessage,
} from './providers/gmail';
import { analyzeInboundMessageWithGemini } from './extraction';
import { matchClientForInboundMessage } from './client-matcher';
import { matchRelatedEntities } from './entity-matcher';
import { buildProposedActions } from './action-builder';

export async function ingestRawMessage(
  organizationId: string,
  integrationConnectionId: string | null,
  raw: RawInboundMessage
) {
  const existing = await prisma.aiInboxMessage.findUnique({
    where: {
      organizationId_provider_providerMessageId: {
        organizationId,
        provider: raw.provider,
        providerMessageId: raw.providerMessageId,
      },
    },
    include: {
      attachments: true,
      actions: true,
    },
  });

  if (existing) {
    return { message: existing, isDuplicate: true };
  }

  const created = await prisma.aiInboxMessage.create({
    data: {
      organizationId,
      integrationConnectionId,
      provider: raw.provider,
      providerMessageId: raw.providerMessageId,
      providerThreadId: raw.providerThreadId,
      internetMessageId: raw.internetMessageId,
      inReplyTo: raw.inReplyTo,
      references: raw.references || [],
      fromEmail: raw.fromEmail,
      fromName: raw.fromName,
      toEmails: raw.toEmails,
      ccEmails: raw.ccEmails || [],
      subject: raw.subject,
      textBody: raw.textBody,
      htmlBody: raw.htmlBody,
      receivedAt: raw.receivedAt,
      processingStatus: 'INGESTED',
      attachments: {
        create: (raw.attachments || []).map((att) => ({
          organizationId,
          providerAttachmentId: att.providerAttachmentId,
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
          classification: 'OTHER',
          fileUrl: att.fileUrl,
        })),
      },
    },
    include: {
      attachments: true,
      actions: true,
    },
  });

  return { message: created, isDuplicate: false };
}

export async function syncMailbox(
  organizationId: string,
  connectionId: string,
  options?: MailboxSyncSettings
) {
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, organizationId, provider: 'GMAIL' },
  });

  if (!connection) {
    throw new Error('Připojená Gmail schránka nebyla nalezena.');
  }

  const existingSettings = (connection.settings && typeof connection.settings === 'object'
    ? connection.settings
    : {}) as Record<string, unknown>;

  const filterMode = options?.syncFilter || (existingSettings.syncFilter as string) || 'INBOX_ONLY';
  const label = options?.syncLabel || (existingSettings.syncLabel as string) || 'SeePoint AI';
  const preset = options?.preset;
  const customQuery = options?.query?.trim();

  let query = '-label:SPAM -label:TRASH';
  if (customQuery) {
    query = `${customQuery} -label:SPAM -label:TRASH`;
  } else if (preset === 'ORDERS_ONLY') {
    query = '(zakázka OR nabídka OR objednávka OR poptávka OR faktura OR ZAK- OR NAV- OR kalkulace OR schválení) -label:SPAM -label:TRASH';
  } else if (filterMode === 'INBOX_ONLY') {
    query = 'label:INBOX -label:SPAM -label:TRASH';
  } else if (filterMode === 'LABEL_ONLY') {
    query = `label:"${label}"`;
  }

  const defaultMax = (preset === 'ORDERS_ONLY' || customQuery) ? 50 : 25;
  const maxResults = Math.min(Math.max(options?.maxResults || defaultMax, 5), 100);

  try {
    const accessToken = await getGmailAccessToken(connectionId);
    const listResult = await listGmailMessages(accessToken, { query, maxResults });
    const messages = listResult.messages || [];

    const ingested = [];
    for (const item of messages) {
      try {
        const rawPayload = await getGmailMessage(accessToken, item.id);
        const parsed = parseRawGmailMessage(rawPayload);
        const result = await ingestRawMessage(organizationId, connection.id, parsed);
        ingested.push(result);
      } catch (itemError) {
        console.warn(`[AI Inbox Ingest] Chyba při stahování zprávy ${item.id}:`, itemError);
      }
    }

    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        lastCheckedAt: new Date(),
        error: null,
        settings: {
          ...existingSettings,
          lastSyncAt: new Date().toISOString(),
          syncStatus: 'OK',
          syncError: null,
        },
      },
    });

    return {
      syncedCount: messages.length,
      newMessagesCount: ingested.filter((r) => !r.isDuplicate).length,
      duplicatesCount: ingested.filter((r) => r.isDuplicate).length,
      ingested,
    };
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : 'Neznámá chyba synchronizace';
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        lastCheckedAt: new Date(),
        error: message,
        settings: {
          ...existingSettings,
          lastSyncAt: new Date().toISOString(),
          syncStatus: 'ERROR',
          syncError: message,
        },
      },
    }).catch(() => null);
    throw syncError;
  }
}

export type AiInboxListFilters = {
  status?: string;
  classification?: string;
  mailboxId?: string;
  search?: string;
  requiresReview?: boolean;
  take?: number;
  skip?: number;
};

export async function listAiInboxMessages(organizationId: string, filters?: AiInboxListFilters) {
  const where: Prisma.AiInboxMessageWhereInput = {
    organizationId,
  };

  if (filters?.requiresReview !== undefined) {
    where.requiresReview = filters.requiresReview;
  }

  if (filters?.status) {
    where.processingStatus = filters.status as Prisma.EnumAiInboxStatusFilter;
  }

  if (filters?.classification) {
    where.classification = filters.classification as Prisma.EnumAiInboxClassificationFilter;
  }

  if (filters?.mailboxId) {
    where.integrationConnectionId = filters.mailboxId;
  }

  if (filters?.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { subject: { contains: q, mode: 'insensitive' } },
      { fromEmail: { contains: q, mode: 'insensitive' } },
      { fromName: { contains: q, mode: 'insensitive' } },
      { textBody: { contains: q, mode: 'insensitive' } },
      { aiSummary: { contains: q, mode: 'insensitive' } },
      { client: { name: { contains: q, mode: 'insensitive' } } },
      { crmOrder: { orderNumber: { contains: q, mode: 'insensitive' } } },
      { crmOrder: { title: { contains: q, mode: 'insensitive' } } },
      { offer: { title: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [totalCount, items] = await Promise.all([
    prisma.aiInboxMessage.count({ where }),
    prisma.aiInboxMessage.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: filters?.take ?? 50,
      skip: filters?.skip ?? 0,
      include: {
        integrationConnection: {
          select: { accountEmail: true, provider: true },
        },
        client: {
          select: { id: true, name: true, companyId: true },
        },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        crmOrder: {
          select: { id: true, orderNumber: true, title: true, status: true },
        },
        offer: {
          select: { id: true, title: true, status: true },
        },
        navigationOrder: {
          select: { id: true, status: true, targetName: true, crmOrder: { select: { orderNumber: true } } },
        },
        _count: {
          select: { attachments: true, actions: true },
        },
      },
    }),
  ]);

  return { totalCount, items };
}

export async function getAiInboxMessageDetail(organizationId: string, messageId: string) {
  const message = await prisma.aiInboxMessage.findFirst({
    where: { id: messageId, organizationId },
    include: {
      integrationConnection: {
        select: { id: true, accountEmail: true, provider: true, status: true },
      },
      client: {
        select: { id: true, name: true, companyId: true, email: true, phone: true },
      },
      contact: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      },
      crmOrder: {
        select: { id: true, orderNumber: true, title: true, status: true, totalPrice: true },
      },
      offer: {
        select: { id: true, title: true, status: true, totalPrice: true },
      },
      navigationOrder: {
        select: { id: true, status: true, targetName: true, crmOrder: { select: { orderNumber: true } } },
      },
      reviewedBy: {
        select: { id: true, name: true, email: true },
      },
      attachments: true,
      actions: {
        orderBy: { createdAt: 'asc' },
        include: {
          executedBy: { select: { id: true, name: true } },
          rejectedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!message) return null;

  let activeClientOrders: Array<{
    id: string;
    orderNumber: string;
    title: string;
    status: string;
    projectType: string;
    isNavigation: boolean;
  }> = [];

  if (message.clientId) {
    const orders = await prisma.crmOrder.findMany({
      where: {
        organizationId,
        clientId: message.clientId,
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        status: true,
        projectType: true,
        navigationOrder: { select: { id: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    activeClientOrders = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      title: o.title,
      status: o.status,
      projectType: o.projectType,
      isNavigation: Boolean(o.navigationOrder),
    }));
  }

  return {
    ...message,
    activeClientOrders,
  };
}

export async function processAiInboxMessage(organizationId: string, messageId: string) {
  const msg = await prisma.aiInboxMessage.findFirst({
    where: { id: messageId, organizationId },
    include: { attachments: true },
  });

  if (!msg) throw new Error('Zpráva nebyla nalezena.');

  await prisma.aiInboxMessage.update({
    where: { id: msg.id },
    data: { processingStatus: 'ANALYZING', errorMessage: null },
  });

  try {
    const analysis = await analyzeInboundMessageWithGemini({
      organizationId,
      fromEmail: msg.fromEmail,
      fromName: msg.fromName,
      subject: msg.subject,
      textBody: msg.textBody,
      attachmentNames: msg.attachments.map((a) => a.filename),
    });

    const clientMatch = await matchClientForInboundMessage({
      organizationId,
      fromEmail: msg.fromEmail,
      extractedCompany: analysis.company,
      extractedContact: analysis.contact,
    });

    const bestClient = clientMatch.bestMatch;

    const entityMatch = await matchRelatedEntities({
      organizationId,
      providerThreadId: msg.providerThreadId,
      internetMessageId: msg.internetMessageId,
      inReplyTo: msg.inReplyTo,
      references: msg.references,
      subject: msg.subject,
      textBody: msg.textBody,
      clientId: bestClient?.id,
      extractedOrderNumber: analysis.extractedOrderNumber,
      extractedClientOrderCode: analysis.extractedClientOrderCode,
    });

    const proposedActions = buildProposedActions({
      analysis,
      entities: {
        client: bestClient,
        candidateClients: clientMatch.candidates,
        ...entityMatch,
      },
      message: {
        id: msg.id,
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        subject: msg.subject,
        textBody: msg.textBody,
        hasAttachments: msg.attachments.length > 0,
      },
    });

    await prisma.aiInboxAction.deleteMany({
      where: {
        messageId: msg.id,
        status: 'PROPOSED',
      },
    });

    for (const action of proposedActions) {
      await prisma.aiInboxAction.create({
        data: {
          organizationId,
          messageId: msg.id,
          type: action.type,
          title: action.title,
          description: action.description,
          payload: action.payload as Prisma.InputJsonValue,
          confidence: action.confidence,
          status: 'PROPOSED',
        },
      });
    }

    const nextStatus = analysis.confidence < 0.8 || !bestClient ? 'REVIEW_REQUIRED' : 'READY';

    const updated = await prisma.aiInboxMessage.update({
      where: { id: msg.id },
      data: {
        processingStatus: nextStatus,
        classification: analysis.classification,
        confidence: analysis.confidence,
        aiSummary: analysis.summary,
        aiReasoningSummary: analysis.reasoningSummary || null,
        aiExtractedData: analysis as unknown as Prisma.InputJsonValue,
        suggestedReply: analysis.suggestedReply || null,
        clientId: bestClient?.id || msg.clientId || null,
        contactId: bestClient?.contactId || msg.contactId || null,
        crmOrderId: entityMatch.crmOrderId || msg.crmOrderId || null,
        offerId: entityMatch.offerId || msg.offerId || null,
        navigationOrderId: entityMatch.navigationOrderId || msg.navigationOrderId || null,
        errorMessage: null,
      },
      include: {
        attachments: true,
        actions: true,
      },
    });

    return updated;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Chyba při AI analýze';
    return prisma.aiInboxMessage.update({
      where: { id: msg.id },
      data: {
        processingStatus: 'ERROR',
        errorMessage: errorMsg,
      },
      include: {
        attachments: true,
        actions: true,
      },
    });
  }
}

export async function reprocessAiInboxMessage(organizationId: string, messageId: string) {
  return processAiInboxMessage(organizationId, messageId);
}

