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

  // Reuse Radar's reviewed semantic decisions instead of a competing company/city heuristic.
  const pending = await prisma.radarSignal.findMany({
    where: { organizationId, semanticDecision: 'POSSIBLE_DUPLICATE', canonicalOpportunity: { mergedIntoId: null } },
    include: { canonicalOpportunity: { select: { id: true, title: true } } },
    take: 50, orderBy: { updatedAt: 'desc' },
  });
  const targets = await prisma.salesOpportunity.findMany({
    where: { organizationId, mergedIntoId: null, id: { in: pending.flatMap(s => s.candidateOpportunityId ? [s.candidateOpportunityId] : []) } },
    select: { id: true, title: true },
  });
  for (const source of pending) {
    const primary = source.canonicalOpportunity;
    const target = targets.find(o => o.id === source.candidateOpportunityId);
    if (!primary || !target) continue;
    proposals.push({
      id: 'radar-review-' + source.id, type: 'DUPLICATE_OPPORTUNITY', title: 'Možná duplicitní obchodní příležitost',
      description: primary.title + ' / ' + target.title,
      primaryEntity: { type: 'SalesOpportunity', id: primary.id, name: primary.title },
      matchingEntity: { type: 'SalesOpportunity', id: target.id, name: target.title },
      confidence: source.semanticConfidence || 0,
      recommendation: 'Ověřit zdroje v AI Radaru → Možné duplicity.',
    });
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
      mergedIntoId: null,
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
