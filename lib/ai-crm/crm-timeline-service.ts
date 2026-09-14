/**
 * AI CRM Intelligence — Client Unified Chronological Timeline
 *
 * Reconstructs a single coherent timeline of events for a client
 * directly from existing business records (Mailbox, Radar, Offers, Realizations, Invoices).
 *
 * Never duplicates data.
 */

import { prisma } from '@/lib/db';
import type { ClientTimelineEvent } from './contracts/types';

export async function getClientTimeline(
  clientId: string,
  organizationId: string
): Promise<ClientTimelineEvent[]> {
  const events: ClientTimelineEvent[] = [];

  const [
    client,
    offers,
    inboxMessages,
    communications,
    crmOrders,
    invoices,
    radarOpportunities,
  ] = await Promise.all([
    prisma.client.findFirst({
      where: { id: clientId, organizationId },
      select: { createdAt: true, name: true },
    }),
    prisma.offer.findMany({
      where: { clientId, organizationId, archivedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        totalPrice: true,
        createdAt: true,
        sentAt: true,
        acceptedAt: true,
        rejectedAt: true,
      },
    }),
    prisma.aiInboxMessage.findMany({
      where: { clientId, organizationId },
      orderBy: { receivedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        subject: true,
        fromEmail: true,
        receivedAt: true,
        classification: true,
      },
    }),
    prisma.clientCommunication.findMany({
      where: { clientId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        subject: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    }),
    prisma.crmOrder.findMany({
      where: { clientId, organizationId },
      include: {
        realizations: {
          include: {
            photos: { select: { id: true, createdAt: true } },
          },
        },
      },
    }),
    prisma.clientInvoice.findMany({
      where: { clientId, organizationId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        issueDate: true,
        paidAt: true,
      },
    }),
    prisma.salesOpportunity.findMany({
      where: { clientId, organizationId },
      select: {
        id: true,
        title: true,
        opportunityScore: true,
        detectedAt: true,
      },
    }),
  ]);

  if (!client) return [];

  // 1. Radar signals
  for (const opp of radarOpportunities) {
    events.push({
      id: `timeline-radar-${opp.id}`,
      date: opp.detectedAt,
      eventType: 'RADAR_SIGNAL',
      title: 'AI Radar zachytil příležitost',
      description: `${opp.title} (${opp.opportunityScore} bodů)`,
      sourceEntity: 'SalesOpportunity',
      entityId: opp.id,
    });
  }

  // 2. Inbound emails
  for (const msg of inboxMessages) {
    events.push({
      id: `timeline-msg-${msg.id}`,
      date: msg.receivedAt,
      eventType: 'INBOUND_EMAIL',
      title: 'Příchozí e-mail od klienta',
      description: `${msg.subject} (od: ${msg.fromEmail})`,
      sourceEntity: 'AiInboxMessage',
      entityId: msg.id,
    });
  }

  // 3. CRM Communications (Calls/Meetings)
  for (const comm of communications) {
    events.push({
      id: `timeline-comm-${comm.id}`,
      date: comm.createdAt,
      eventType: 'COMMUNICATION',
      title: `Záznam kontaktu: ${comm.type}`,
      description: `${comm.subject} (zapsal: ${comm.author?.name || 'Obchodník'})`,
      sourceEntity: 'ClientCommunication',
      entityId: comm.id,
    });
  }

  // 4. Offers lifecycle
  for (const off of offers) {
    events.push({
      id: `timeline-off-created-${off.id}`,
      date: off.createdAt,
      eventType: 'OFFER_CREATED',
      title: 'Vytvořena cenová nabídka',
      description: `${off.title} (${Number(off.totalPrice || 0).toLocaleString('cs-CZ')} Kč)`,
      sourceEntity: 'Offer',
      entityId: off.id,
    });

    if (off.sentAt) {
      events.push({
        id: `timeline-off-sent-${off.id}`,
        date: off.sentAt,
        eventType: 'OFFER_SENT',
        title: 'Nabídka odeslána klientovi',
        description: `${off.title} – odesláno k vyjádření`,
        sourceEntity: 'Offer',
        entityId: off.id,
      });
    }

    if (off.acceptedAt) {
      events.push({
        id: `timeline-off-acc-${off.id}`,
        date: off.acceptedAt,
        eventType: 'OFFER_ACCEPTED',
        title: 'Nabídka akceptována klientem',
        description: `${off.title} – klient nabídku přijal`,
        sourceEntity: 'Offer',
        entityId: off.id,
      });
    }

    if (off.rejectedAt) {
      events.push({
        id: `timeline-off-rej-${off.id}`,
        date: off.rejectedAt,
        eventType: 'OFFER_REJECTED',
        title: 'Nabídka odmítnuta',
        description: `${off.title}`,
        sourceEntity: 'Offer',
        entityId: off.id,
      });
    }
  }

  // 5. Realizations & Photos
  for (const order of crmOrders) {
    for (const r of order.realizations) {
      if (r.status === 'CLAIM' || Boolean(r.claimNote)) {
        events.push({
          id: `timeline-real-block-${r.id}`,
          date: r.updatedAt,
          eventType: 'REALIZATION_BLOCKED',
          title: 'Blokovaná realizace',
          description: r.claimNote || 'Realizace narazila na překážku',
          sourceEntity: 'CrmRealization',
          entityId: r.id,
        });
      } else if (r.status === 'COMPLETED') {
        events.push({
          id: `timeline-real-comp-${r.id}`,
          date: r.actualDate || r.updatedAt,
          eventType: 'REALIZATION_COMPLETED',
          title: 'Realizace zakázky dokončena',
          description: `Zakázka č. ${order.orderNumber} byla úspěšně instalována.`,
          sourceEntity: 'CrmRealization',
          entityId: r.id,
        });
      } else if (r.plannedDate) {
        events.push({
          id: `timeline-real-start-${r.id}`,
          date: r.plannedDate,
          eventType: 'REALIZATION_STARTED',
          title: 'Zahájení realizace zakázky',
          description: `Zakázka ${order.orderNumber}`,
          sourceEntity: 'CrmRealization',
          entityId: r.id,
        });
      }
    }
  }

  // 6. Invoices
  for (const inv of invoices) {
    events.push({
      id: `timeline-inv-iss-${inv.id}`,
      date: inv.issueDate,
      eventType: 'INVOICE_ISSUED',
      title: `Vystavena faktura č. ${inv.invoiceNumber}`,
      description: `Částka: ${Number(inv.totalAmount).toLocaleString('cs-CZ')} Kč`,
      sourceEntity: 'ClientInvoice',
      entityId: inv.id,
    });

    if (inv.paidAt) {
      events.push({
        id: `timeline-inv-paid-${inv.id}`,
        date: inv.paidAt,
        eventType: 'INVOICE_PAID',
        title: `Faktura č. ${inv.invoiceNumber} uhrazena`,
        description: `Úspěšně připsána platba ${Number(inv.totalAmount).toLocaleString('cs-CZ')} Kč`,
        sourceEntity: 'ClientInvoice',
        entityId: inv.id,
      });
    }
  }

  // Sort chronologically descending (newest first)
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  return events;
}
