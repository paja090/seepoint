import { prisma } from '@/lib/db';
import type { Prisma, AiInboxStatus } from '@prisma/client';
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

export function isBotOrSystemEmail(email: string): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();

  // Známí boti a notifikační adresy
  const knownBots = [
    'notifications@github.com',
    'noreply@github.com',
    'no-reply@accounts.google.com',
    'security-noreply@accounts.google.com',
    'mailer-daemon@googlemail.com',
    'mailer-daemon@google.com',
    'invitations@linkedin.com',
    'messages-noreply@linkedin.com',
    'notification@facebookmail.com',
    'support@vercel.com',
    'notifications@vercel.com',
  ];
  if (knownBots.includes(e)) return true;

  // Typické noreply a robotické prefixy
  if (
    e.startsWith('no-reply@') ||
    e.startsWith('noreply@') ||
    e.startsWith('donotreply@') ||
    e.startsWith('do-not-reply@') ||
    e.startsWith('postmaster@') ||
    e.startsWith('mailer-daemon@')
  ) {
    return true;
  }

  // Bounce a delivery subsystemy
  if (e.includes('mailer-daemon') || e.includes('bounce') || e.includes('system-notification')) {
    return true;
  }

  return false;
}

export async function addSenderToIgnoreList(
  organizationId: string,
  email: string,
  connectionId?: string | null
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const connections = await prisma.integrationConnection.findMany({
    where: {
      organizationId,
      provider: 'GMAIL',
      ...(connectionId ? { id: connectionId } : {}),
    },
  });

  for (const conn of connections) {
    const existingSettings = (conn.settings && typeof conn.settings === 'object'
      ? conn.settings
      : {}) as Record<string, unknown>;
    const ignoredSenders = new Set(
      Array.isArray(existingSettings.ignoredSenders)
        ? (existingSettings.ignoredSenders as string[]).map((s) => s.toLowerCase().trim()).filter(Boolean)
        : []
    );
    ignoredSenders.add(normalizedEmail);
    await prisma.integrationConnection.update({
      where: { id: conn.id },
      data: {
        settings: {
          ...existingSettings,
          ignoredSenders: Array.from(ignoredSenders),
        },
      },
    });
  }
}

export type CustomMailboxSettings = {
  syncFilter?: 'INBOX_ONLY' | 'ORDERS_ONLY' | 'LABEL_ONLY';
  syncLabel?: string;
  batchSize?: number;
  autoSyncIntervalMinutes?: number; // 0 = off, 15, 60
  ignoredSenders?: string[];
};

export async function updateMailboxSettings(
  organizationId: string,
  connectionId: string,
  settingsUpdate: CustomMailboxSettings
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

  const mergedSettings = {
    ...existingSettings,
    ...(settingsUpdate.syncFilter !== undefined ? { syncFilter: settingsUpdate.syncFilter, ingestMode: settingsUpdate.syncFilter } : {}),
    ...(settingsUpdate.syncLabel !== undefined ? { syncLabel: settingsUpdate.syncLabel, labelName: settingsUpdate.syncLabel } : {}),
    ...(settingsUpdate.batchSize !== undefined ? { batchSize: settingsUpdate.batchSize } : {}),
    ...(settingsUpdate.autoSyncIntervalMinutes !== undefined ? { autoSyncIntervalMinutes: settingsUpdate.autoSyncIntervalMinutes } : {}),
    ...(settingsUpdate.ignoredSenders !== undefined ? { ignoredSenders: settingsUpdate.ignoredSenders.map((s) => s.trim().toLowerCase()).filter(Boolean) } : {}),
  };

  const updated = await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      settings: mergedSettings,
    },
  });

  return { ok: true, settings: updated.settings };
}


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

  const isBot = isBotOrSystemEmail(raw.fromEmail);

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
      processingStatus: isBot ? 'IGNORED' : 'INGESTED', // processingStatus: 'INGESTED'
      classification: isBot ? 'SPAM_IRRELEVANT' : 'UNKNOWN',
      requiresReview: !isBot,
      aiSummary: isBot ? 'Automaticky ignorovaná systémová/robotická zpráva' : null,
      confidence: isBot ? 1.0 : 0.0,
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

  const configuredMode = (existingSettings.syncFilter as string) || (existingSettings.ingestMode as string) || 'INBOX_ONLY';
  const filterMode = options?.syncFilter || configuredMode;
  const label = options?.syncLabel || (existingSettings.syncLabel as string) || (existingSettings.labelName as string) || 'SeePoint AI';
  const preset = options?.preset;
  const customQuery = options?.query?.trim();

  // Vyloučení známých botů a uživatelsky ignorovaných odesílatelů přímo z vyhledávání Gmailu
  const customIgnored = Array.isArray(existingSettings.ignoredSenders)
    ? (existingSettings.ignoredSenders as string[]).map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const excludedSenders = Array.from(
    new Set([
      'notifications@github.com',
      'no-reply@accounts.google.com',
      'noreply@github.com',
      ...customIgnored,
    ])
  );

  const excludeQuery = excludedSenders.length > 0
    ? ` -from:(${excludedSenders.join(' OR ')})`
    : '';

  let query = `-label:SPAM -label:TRASH${excludeQuery}`;
  if (customQuery) {
    query = `${customQuery} -label:SPAM -label:TRASH${excludeQuery}`;
  } else if (preset === 'ORDERS_ONLY' || filterMode === 'ORDERS_ONLY') {
    query = `(zakázka OR nabídka OR objednávka OR poptávka OR faktura OR ZAK- OR NAV- OR kalkulace OR schválení) -label:SPAM -label:TRASH${excludeQuery}`;
  } else if (filterMode === 'INBOX_ONLY') {
    query = `label:INBOX -label:SPAM -label:TRASH${excludeQuery}`;
  } else if (filterMode === 'LABEL_ONLY') {
    query = `label:"${label}"${excludeQuery}`;
  }

  const configuredBatchSize = typeof existingSettings.batchSize === 'number' ? existingSettings.batchSize : undefined;
  const defaultMax = (preset === 'ORDERS_ONLY' || customQuery) ? 50 : (configuredBatchSize || 25);
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
    let threadContext: string | null = null;
    if (msg.providerThreadId) {
      const priorMessages = await prisma.aiInboxMessage.findMany({
        where: {
          organizationId,
          providerThreadId: msg.providerThreadId,
          id: { not: msg.id },
          receivedAt: { lte: msg.receivedAt },
        },
        orderBy: { receivedAt: 'asc' },
        take: 3,
        select: {
          fromEmail: true,
          fromName: true,
          receivedAt: true,
          subject: true,
          textBody: true,
          aiSummary: true,
          classification: true,
        },
      });

      if (priorMessages.length > 0) {
        threadContext = priorMessages
          .map(
            (p, idx) =>
              `[Zpráva ${idx + 1} od ${p.fromName || p.fromEmail} (${p.receivedAt.toISOString().slice(0, 10)})]\nPředmět: ${p.subject}\nShrnutí: ${p.aiSummary || p.textBody?.slice(0, 250) || 'Bez textu'}`
          )
          .join('\n\n');
      }
    }

    const analysis = await analyzeInboundMessageWithGemini({
      organizationId,
      fromEmail: msg.fromEmail,
      fromName: msg.fromName,
      subject: msg.subject,
      textBody: msg.textBody,
      attachmentNames: msg.attachments.map((a) => a.filename),
      threadContext,
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

    const isSpam = analysis.classification === 'SPAM_IRRELEVANT';
    const nextStatus: AiInboxStatus = isSpam
      ? 'IGNORED'
      : (analysis.confidence < 0.8 || !bestClient ? 'REVIEW_REQUIRED' : 'READY');
    const requiresReview = !isSpam && (nextStatus === 'REVIEW_REQUIRED' || !bestClient);

    const updated = await prisma.aiInboxMessage.update({
      where: { id: msg.id },
      data: {
        processingStatus: nextStatus,
        classification: analysis.classification,
        confidence: analysis.confidence,
        requiresReview,
        aiSummary: analysis.summary,
        aiReasoningSummary: analysis.reasoningSummary || null,
        aiExtractedData: analysis as unknown as Prisma.InputJsonValue,
        suggestedReply: isSpam ? null : (analysis.suggestedReply || null),
        clientId: isSpam ? null : (bestClient?.id || msg.clientId || null),
        contactId: isSpam ? null : (bestClient?.contactId || msg.contactId || null),
        crmOrderId: isSpam ? null : (entityMatch.crmOrderId || msg.crmOrderId || null),
        offerId: isSpam ? null : (entityMatch.offerId || msg.offerId || null),
        navigationOrderId: isSpam ? null : (entityMatch.navigationOrderId || msg.navigationOrderId || null),
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

export async function deleteAiInboxMessage(
  organizationId: string,
  messageId: string,
  ignoreSender: boolean = false
) {
  const existing = await prisma.aiInboxMessage.findFirst({
    where: { id: messageId, organizationId },
    select: { id: true, fromEmail: true, integrationConnectionId: true },
  });

  if (!existing) {
    throw new Error('Zpráva nebyla nalezena.');
  }

  if (ignoreSender && existing.fromEmail) {
    await addSenderToIgnoreList(organizationId, existing.fromEmail, existing.integrationConnectionId);
  }

  await prisma.aiInboxMessage.delete({
    where: { id: messageId },
  });

  return { success: true, deletedId: messageId, ignoredSender: ignoreSender ? existing.fromEmail : null };
}

export async function cleanupSpamMessages(
  organizationId: string,
  addSendersToIgnoreListFlag: boolean = true
) {
  const spamMessages = await prisma.aiInboxMessage.findMany({
    where: {
      organizationId,
      OR: [
        { classification: 'SPAM_IRRELEVANT' },
        { processingStatus: 'IGNORED' },
      ],
    },
    select: {
      id: true,
      fromEmail: true,
      integrationConnectionId: true,
    },
  });

  if (spamMessages.length === 0) {
    return { deletedCount: 0, ignoredSendersAdded: [] };
  }

  const sendersToIgnore = new Set<string>();
  if (addSendersToIgnoreListFlag) {
    for (const msg of spamMessages) {
      if (msg.fromEmail?.trim()) {
        sendersToIgnore.add(msg.fromEmail.trim().toLowerCase());
      }
    }

    for (const sender of sendersToIgnore) {
      await addSenderToIgnoreList(organizationId, sender);
    }
  }

  const ids = spamMessages.map((m) => m.id);
  const deleteResult = await prisma.aiInboxMessage.deleteMany({
    where: {
      organizationId,
      id: { in: ids },
    },
  });

  return {
    deletedCount: deleteResult.count,
    ignoredSendersAdded: Array.from(sendersToIgnore),
  };
}

