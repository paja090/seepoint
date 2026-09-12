import { prisma } from '@/lib/db';
import type {
  CommercialNextBestAction,
  NextBestActionPriority,
} from './contracts/next-best-action';
import type { CommercialRequest } from './contracts/commercial-request';
import type { CommercialOpportunityContext } from './contracts/commercial-opportunity';
import type { AvailabilityResult } from './contracts/availability';

/**
 * Computes deterministic next-best-actions for a given CommercialRequest.
 * Enforces human approval by proposing actions rather than automatically executing them.
 */
export function determineNextBestActionForRequest(
  request: CommercialRequest
): CommercialNextBestAction {
  const now = new Date();

  if (request.status === 'NEEDS_MORE_INFORMATION' || request.missingRequirements.length > 0) {
    const missing = request.missingRequirements.join(', ');
    return {
      id: `nba-req-incomplete-${request.id}`,
      organizationId: request.organizationId,
      actionType: 'COMPLETE_INFORMATION',
      priority: 'HIGH',
      title: `Vyžádat upřesnění termínu od klienta: ${request.companyName || 'Poptávka'}`,
      description: `Poptávka nemá přesné datum (${request.rawDateDescription || 'termín nejasný'}). Chybějící údaje: ${missing}. Kontaktujte klienta před prověřováním ploch.`,
      targetEntityType: 'COMMERCIAL_REQUEST',
      targetEntityId: request.id,
      suggestedPayload: {
        missingRequirements: request.missingRequirements,
        clientEmail: request.contactEmail,
      },
      recommendedAt: now,
    };
  }

  if (request.status === 'READY_FOR_AVAILABILITY') {
    return {
      id: `nba-req-avail-${request.id}`,
      organizationId: request.organizationId,
      actionType: 'CHECK_AVAILABILITY',
      priority: 'HIGH',
      title: `Ověřit dostupnost inventáře: ${request.companyName || 'Poptávka'}`,
      description: `Poptávka má přesný termín (${request.dateFrom?.toISOString().slice(0, 10)}–${request.dateTo?.toISOString().slice(0, 10)}) i lokalitu (${request.cities.join(', ') || 'nespecifikováno'}). Spusťte ověření volných kapacit.`,
      targetEntityType: 'COMMERCIAL_REQUEST',
      targetEntityId: request.id,
      suggestedPayload: {
        dateFrom: request.dateFrom,
        dateTo: request.dateTo,
        cities: request.cities,
        mediaTypes: request.mediaTypes,
        quantity: request.quantity?.exact || 1,
      },
      recommendedAt: now,
    };
  }

  if (request.status === 'AVAILABILITY_CHECKED') {
    return {
      id: `nba-req-draft-${request.id}`,
      organizationId: request.organizationId,
      actionType: 'CREATE_OFFER_DRAFT',
      priority: 'HIGH',
      title: `Připravit koncept nabídky: ${request.companyName || 'Poptávka'}`,
      description: 'Dostupné plochy byly ověřeny. Vytvořte draft nabídky pro revizi obchodníkem.',
      targetEntityType: 'COMMERCIAL_REQUEST',
      targetEntityId: request.id,
      recommendedAt: now,
    };
  }

  return {
    id: `nba-req-follow-${request.id}`,
    organizationId: request.organizationId,
    actionType: 'FOLLOW_UP',
    priority: 'MEDIUM',
    title: `Sledovat stav poptávky: ${request.companyName || 'Poptávka'}`,
    description: `Poptávka je ve stavu ${request.status}. Zkontrolujte průběh zpracování.`,
    targetEntityType: 'COMMERCIAL_REQUEST',
    targetEntityId: request.id,
    recommendedAt: now,
  };
}

/**
 * Loads high-priority commercial actions for a whole organization.
 * Combines signals from incoming emails, sales opportunities, and expiring occupancy campaigns.
 */
export async function getOrganizationNextBestActions(
  organizationId: string
): Promise<CommercialNextBestAction[]> {
  const actions: CommercialNextBestAction[] = [];

  // 1. Check open EXPIRING_CAMPAIGN insights from AI Occupancy
  const expiringInsights = await prisma.occupancyInsight.findMany({
    where: {
      organizationId,
      status: { in: ['OPEN', 'REVIEWED'] },
      type: 'EXPIRING_CAMPAIGN',
    },
    take: 5,
    orderBy: { detectedAt: 'desc' },
  });

  for (const ins of expiringInsights) {
    actions.push({
      id: `nba-ins-${ins.id}`,
      organizationId,
      actionType: 'RENEWAL_CONTACT',
      priority: (ins.severity === 'HIGH' || ins.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM') as NextBestActionPriority,
      title: ins.title,
      description: ins.deterministicReason,
      targetEntityType: 'OCCUPANCY',
      targetEntityId: ins.occupancyId || ins.id,
      suggestedPayload: {
        surfaceId: ins.surfaceId,
        clientId: ins.clientId,
      },
      recommendedAt: ins.detectedAt,
    });
  }

  // 2. Check high-score NEW sales opportunities from AI Sales Radar
  const topRadarOpportunities = await prisma.salesOpportunity.findMany({
    where: {
      organizationId,
      status: 'NEW',
      opportunityScore: { gte: 70 },
    },
    take: 5,
    orderBy: { opportunityScore: 'desc' },
  });

  for (const opp of topRadarOpportunities) {
    actions.push({
      id: `nba-opp-${opp.id}`,
      organizationId,
      actionType: 'CHECK_AVAILABILITY',
      priority: opp.opportunityScore >= 85 ? 'CRITICAL' : 'HIGH',
      title: `Radar objev (${opp.opportunityScore} b.): ${opp.companyName} v lokalitě ${opp.city || 'ČR'}`,
      description: `${opp.summary} Doporučeno prověřit dostupnost ploch v okolí.`,
      targetEntityType: 'SALES_OPPORTUNITY',
      targetEntityId: opp.id,
      suggestedPayload: {
        city: opp.city,
        companyName: opp.companyName,
        eventDate: opp.eventDate,
      },
      recommendedAt: opp.detectedAt,
    });
  }

  // 3. Check DRAFT offers waiting for salesperson review and send
  const draftOffers = await prisma.offer.findMany({
    where: {
      organizationId,
      status: 'DRAFT',
      archivedAt: null,
    },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  });

  for (const off of draftOffers) {
    actions.push({
      id: `nba-off-${off.id}`,
      organizationId,
      actionType: 'REVIEW_AND_SEND_OFFER',
      priority: 'MEDIUM',
      title: `Zkontrolovat koncept nabídky: ${off.title}`,
      description: 'Koncept nabídky čeká na schválení a odeslání klientovi.',
      targetEntityType: 'OFFER',
      targetEntityId: off.id,
      recommendedAt: off.createdAt,
    });
  }

  return actions;
}

/**
 * Deterministic helper to evaluate next-best-actions across various input contexts.
 */
export function determineCommercialNextBestActions(context: {
  request?: CommercialRequest;
  opportunityContext?: CommercialOpportunityContext;
  availabilityResult?: AvailabilityResult;
}): CommercialNextBestAction[] {
  const actions: CommercialNextBestAction[] = [];
  const now = new Date();

  if (context.request) {
    actions.push(determineNextBestActionForRequest(context.request));
  }

  if (context.opportunityContext) {
    const opp = context.opportunityContext;
    actions.push({
      id: `nba-opp-${opp.opportunityId}`,
      organizationId: opp.organizationId,
      actionType: opp.score >= 85 ? 'CHECK_AVAILABILITY' : 'FOLLOW_UP',
      priority: opp.score >= 85 ? 'HIGH' : 'MEDIUM',
      title: `Radar objev (${opp.score} b.): ${opp.companyName} v lokalitě ${opp.city || 'ČR'}`,
      description: `${opp.reason || 'Nová obchodní příležitost.'} Typ: ${opp.opportunityType}. Doporučeno prověřit dostupnost ploch.`,
      targetEntityType: 'SALES_OPPORTUNITY',
      targetEntityId: opp.opportunityId,
      suggestedPayload: {
        city: opp.city,
        companyName: opp.companyName,
        eventDate: opp.eventDate,
      },
      recommendedAt: now,
    });
  }

  if (context.availabilityResult) {
    const avail = context.availabilityResult;
    if (avail.unavailableSurfaces && avail.unavailableSurfaces.length > 0) {
      actions.push({
        id: `nba-avail-conflict-${avail.organizationId}`,
        organizationId: avail.organizationId,
        actionType: 'COMPLETE_INFORMATION',
        priority: 'MEDIUM',
        title: `Vyřešit konflikt obsazenosti (${avail.unavailableSurfaces.length} ploch)`,
        description: `Detekován konflikt obsazenosti u ploch: ${avail.unavailableSurfaces.map((s) => s.surfaceName).join(', ')}. Vyberte alternativní plochy nebo upravte termín.`,
        targetEntityType: 'OCCUPANCY',
        targetEntityId: avail.unavailableSurfaces[0]?.surfaceId || 'unknown',
        suggestedPayload: {
          conflicts: avail.unavailableSurfaces,
        },
        recommendedAt: now,
      });
    }
  }

  return actions;
}
