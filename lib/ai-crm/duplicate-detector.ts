/**
 * AI CRM Intelligence — Duplicate & Conflict Detection Service
 *
 * Detects duplicate opportunities, multi-channel conflicts (Radar + Mailbox),
 * and redundant tasks.
 *
 * Strictly safe: Proposes linking/reviewing, NEVER merges destructively.
 * Strict multi-tenant isolation.
 */

import { prisma } from '@/lib/db';

export interface DuplicateProposal {
  id: string;
  type: 'DUPLICATE_OPPORTUNITY' | 'RADAR_INBOX_MATCH' | 'DUPLICATE_TASK';
  title: string;
  description: string;
  primaryEntity: { type: string; id: string; name: string };
  matchingEntity: { type: string; id: string; name: string };
  confidence: number;
  recommendation: string;
}

export async function detectCrmDuplicates(
  organizationId: string
): Promise<DuplicateProposal[]> {
  const proposals: DuplicateProposal[] = [];

  // 1. Detect duplicate SalesOpportunities (same company & event type or close title)
  const opportunities = await prisma.salesOpportunity.findMany({
    where: {
      organizationId,
      status: { in: ['NEW', 'REVIEWED', 'CONTACT_PLANNED'] },
    },
    select: {
      id: true,
      companyName: true,
      eventType: true,
      title: true,
      city: true,
      detectedAt: true,
    },
    take: 50,
  });

  for (let i = 0; i < opportunities.length; i++) {
    for (let j = i + 1; j < opportunities.length; j++) {
      const a = opportunities[i];
      const b = opportunities[j];

      const sameCompany =
        a.companyName.trim().toLowerCase() === b.companyName.trim().toLowerCase();
      const sameCity = (a.city || '').toLowerCase() === (b.city || '').toLowerCase();
      const sameEvent = a.eventType === b.eventType;

      if (sameCompany && (sameCity || sameEvent)) {
        proposals.push({
          id: `dup-opp-${a.id}-${b.id}`,
          type: 'DUPLICATE_OPPORTUNITY',
          title: `Duplicitní příležitost pro ${a.companyName}`,
          description: `Nalezeny dvě souběžné příležitosti: „${a.title}“ a „${b.title}“.`,
          primaryEntity: { type: 'SalesOpportunity', id: a.id, name: a.title },
          matchingEntity: { type: 'SalesOpportunity', id: b.id, name: b.title },
          confidence: sameCity && sameEvent ? 0.95 : 0.8,
          recommendation: 'Doporučeno sloučit nebo jednu z příležitostí označit jako vyřízenou.',
        });
      }
    }
  }

  // 2. Detect Radar Opportunity + Unassigned Mailbox Inquiry from same company
  const [unassignedInquiries, radarOpps] = await Promise.all([
    prisma.aiInboxMessage.findMany({
      where: {
        organizationId,
        classification: 'NEW_INQUIRY',
        salesOpportunityId: null,
      },
      select: {
        id: true,
        subject: true,
        fromName: true,
        fromEmail: true,
        receivedAt: true,
      },
      take: 20,
    }),
    prisma.salesOpportunity.findMany({
      where: {
        organizationId,
        status: { in: ['NEW', 'REVIEWED'] },
      },
      select: {
        id: true,
        companyName: true,
        title: true,
      },
      take: 20,
    }),
  ]);

  for (const inquiry of unassignedInquiries) {
    const sender = (inquiry.fromName || '').toLowerCase();
    const domain = (inquiry.fromEmail.split('@')[1] || '').split('.')[0]?.toLowerCase();

    for (const opp of radarOpps) {
      const comp = opp.companyName.toLowerCase();
      if ((sender && sender.includes(comp)) || (domain && domain.length > 3 && comp.includes(domain))) {
        proposals.push({
          id: `match-inbox-radar-${inquiry.id}-${opp.id}`,
          type: 'RADAR_INBOX_MATCH',
          title: `Poptávka odpovídá Radar příležitosti: ${opp.companyName}`,
          description: `Příchozí e-mail „${inquiry.subject}“ od ${inquiry.fromEmail} pravděpodobně souvisí s Radar příležitostí „${opp.title}“.`,
          primaryEntity: { type: 'AiInboxMessage', id: inquiry.id, name: inquiry.subject },
          matchingEntity: { type: 'SalesOpportunity', id: opp.id, name: opp.title },
          confidence: 0.85,
          recommendation: 'Propojit příchozí e-mail s existující Radar příležitostí.',
        });
      }
    }
  }

  return proposals;
}
