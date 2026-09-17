import { prisma } from '@/lib/db';
import type { OpportunityStatus, Prisma } from '@prisma/client';
import { calculateOpportunityScore } from './scoring';
import type { CreateOpportunityInput, OpportunityFilterParams } from './types';
import { normalizeClientName } from '@/lib/crm/domain';
import { assertOpportunityTransition, OpportunityValidationError } from './policy';

export async function getOpportunities(params: OpportunityFilterParams = {}, organizationId: string) {
  const where: Prisma.SalesOpportunityWhereInput = { organizationId, mergedIntoId: null };

  if (params.status) {
    where.status = params.status;
  } else {
    where.status = { notIn: ['DISMISSED'] };
  }
  if (params.eventType) {
    where.eventType = params.eventType;
  }
  if (params.city) {
    where.city = { contains: params.city.trim(), mode: 'insensitive' };
  }
  if (params.region) {
    where.region = { contains: params.region.trim(), mode: 'insensitive' };
  }
  if (params.assignedToUserId) {
    where.assignedToUserId = params.assignedToUserId;
  }
  if (params.minScore !== undefined || params.maxScore !== undefined) {
    where.opportunityScore = {
      gte: params.minScore !== undefined ? params.minScore : 0,
      lte: params.maxScore !== undefined ? params.maxScore : 100,
    };
  }
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { companyName: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { sourceTitle: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.salesOpportunity.findMany({
      where,
      include: {
        _count: { select: { sources: true } },
        sources: { where: { organizationId, semanticDecision: 'SAME_OPPORTUNITY', semanticConfidence: { not: null } }, select: { semanticConfidence: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
        client: {
          select: {
            id: true,
            name: true,
            companyId: true,
            status: true,
          },
        },
        createdOffer: {
          select: {
            id: true,
            title: true,
            status: true,
            isNoPriceConcept: true,
            createdAt: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { opportunityScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: params.take || 50,
      skip: params.skip || 0,
    }),
    prisma.salesOpportunity.count({ where }),
  ]);

  return { items, total };
}

export async function getOpportunityById(id: string, organizationId: string) {
  const item = await prisma.salesOpportunity.findFirst({
    where: { id, organizationId },
    include: {
      sources: { where: { organizationId }, orderBy: { createdAt: 'asc' } },
      client: true,
      createdOffer: {
        include: {
          items: true,
          navigationOffer: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
  if (!item) return null;
  const mergedRecords = await prisma.salesOpportunity.findMany({ where: { organizationId, mergedIntoId: id }, select: { id: true, title: true, status: true, client: { select: { name: true } }, createdOffer: { select: { id: true, title: true } } }, take: 50 });
  return { ...item, mergedRecords };
}

import { getOrganizationRadarProfile } from './radar-profile';
import { findNearbyCarriers } from './distance';
import { factsFromInput, semanticKeys } from './semantic-core';

export async function createOpportunity(input: CreateOpportunityInput, organizationId: string, deadline = Date.now() + 15000) {
  const profile = await getOrganizationRadarProfile(organizationId);
  const excludedCompany = profile.excludedCompanies?.some(c => c.trim().toLowerCase() === input.companyName.trim().toLowerCase());
  let excludedDomain = false;
  try { const host = new URL(input.sourceUrl).hostname.toLowerCase(); excludedDomain = Boolean(profile.excludedDomains?.some(d => host === d || host.endsWith('.' + d))); } catch { /* validated by caller */ }
  if (excludedCompany || excludedDomain) {
    if (input.radarSignalId) await prisma.radarSignal.updateMany({ where: { organizationId, id: input.radarSignalId }, data: { status: 'SUPPRESSED' } });
    return { created: false, stage: 'SUPPRESSED', duplicateId: undefined, opportunity: null };
  }
  const { ingestOpportunity } = await import('./semantic-service');
  return ingestOpportunity(input, organizationId, deadline);
}

// Existing scoring/CRM creation reused inside the resolver transaction.
export async function persistOpportunity(input: CreateOpportunityInput, organizationId: string, db: Prisma.TransactionClient) {
  if (input.clientId && !await db.client.count({ where: { id: input.clientId, organizationId, active: true } })) throw new OpportunityValidationError('Klient nebyl nalezen.', 404);
  if (input.assignedToUserId && !await db.organizationMember.count({ where: { organizationId, userId: input.assignedToUserId, isActive: true } })) throw new OpportunityValidationError('Obchodník není členem organizace.');
  const radarProfile = await getOrganizationRadarProfile(organizationId);
  const nearbyCount = typeof input.latitude === 'number' && typeof input.longitude === 'number' ? (await findNearbyCarriers(organizationId, input.latitude, input.longitude, 5)).length : 0;
  const carrierCount = input.city ? await db.advertisingCarrier.count({ where: { organizationId, archivedAt: null, status: 'ACTIVE', city: { contains: input.city, mode: 'insensitive' } } }) : 0;
  let linkedClientId = input.clientId;
  if (!linkedClientId) {
    if (input.companyId) {
      const matchByIco = await db.client.findFirst({ where: { organizationId, active: true, companyId: input.companyId }, select: { id: true } });
      if (matchByIco) {
        linkedClientId = matchByIco.id;
      }
    }

    // 2. Exact or normalized name match (minimum 3 characters to prevent false positives)
    if (!linkedClientId && input.companyName?.trim()) {
      const normInput = normalizeClientName(input.companyName);
      if (normInput.length >= 3) {
        const existingClient = await db.client.findFirst({
          where: {
            organizationId,
            active: true,
            OR: [
              { name: { equals: input.companyName.trim(), mode: 'insensitive' } },
              { normalizedName: { equals: normInput } },
            ],
          },
          select: { id: true },
        });
        if (existingClient) {
          linkedClientId = existingClient.id;
        }
      }
    }
  }

  const suggestedMediaTypes = input.suggestedMediaTypes?.length
    ? input.suggestedMediaTypes
    : radarProfile.preferredMediaTypes.slice(0, 3);

  const { score, components, breakdown, reasons } = calculateOpportunityScore({
    eventType: input.eventType || 'NEW_BRANCH',
    city: input.city,
    region: input.region,
    eventDate: input.eventDate,
    sourcePublishedAt: input.sourcePublishedAt,
    carrierCountInCity: carrierCount,
    nearbyCarriersCount: nearbyCount,
    suggestedMediaTypes,
    preferredMediaTypes: radarProfile.preferredMediaTypes,
    targetRegions: radarProfile.targetRegions,
    targetCities: radarProfile.targetCities,
    targetIndustries: radarProfile.targetIndustries,
    isInCrm: Boolean(linkedClientId),
    companyId: input.companyId,
    website: input.website,
    sourceUrl: input.sourceUrl,
  });

  const topMedia = suggestedMediaTypes.length ? suggestedMediaTypes : radarProfile.preferredMediaTypes.slice(0, 3);
  const defaultPhases = input.suggestedCampaignPhases || [
    {
      phase: 'TEASER',
      name: 'Před-otvírací fáze (Teaser)',
      timeframe: '2–3 týdny před otevřením',
      recommendedMediaTypes: topMedia.slice(0, 2),
      description: 'Budování povědomí o příchodu značky a vyvolání prvotního zájmu obyvatel v širším okolí.',
    },
    {
      phase: 'OPENING',
      name: 'Fáze slavnostního otevření',
      timeframe: 'Týden otevření',
      recommendedMediaTypes: topMedia,
      description: 'Intenzivní lokální kampaň pro maximální zásah zákazníků v dané lokalitě.',
    },
    {
      phase: 'FOLLOW_UP',
      name: 'Stabilizační fáze (Follow-up)',
      timeframe: '1–2 týdny po otevření',
      recommendedMediaTypes: topMedia.slice(0, 2),
      description: 'Upevnění nákupního návyku a stabilizace návštěvnosti nové pobočky.',
    },
  ];

  const scoreMetadata = {
    reasons,
    components,
    evidenceFact: input.evidenceFact || null,
    aiInterpretation: input.aiInterpretation || null,
    aiRecommendation: input.aiRecommendation || null,
  };

  const opportunity = await db.salesOpportunity.create({
    data: {
      organizationId,
      semanticData: factsFromInput(input),
      ...semanticKeys(factsFromInput(input)),
      companyName: input.companyName.trim(),
      companyId: input.companyId?.trim() || null,
      website: input.website?.trim() || null,
      eventType: input.eventType || 'NEW_BRANCH',
      title: input.title.trim(),
      summary: input.summary.trim(),
      city: input.city?.trim() || null,
      region: input.region?.trim() || null,
      address: input.address?.trim() || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
      sourceUrl: input.sourceUrl.trim(),
      sourceTitle: input.sourceTitle.trim(),
      sourcePublishedAt: input.sourcePublishedAt ? new Date(input.sourcePublishedAt) : null,
      opportunityScore: score,
      scoreReasons: scoreMetadata as unknown as Prisma.InputJsonValue,
      scoreTrigger: breakdown.trigger,
      scoreCustomerFit: breakdown.customerFit,
      scoreTiming: breakdown.timing,
      scoreGeo: breakdown.geo,
      scoreMediaFit: breakdown.mediaFit,
      scoreEvidence: breakdown.evidence,
      suggestedMediaTypes: suggestedMediaTypes as unknown as Prisma.InputJsonValue,
      suggestedCampaignPhases: defaultPhases as unknown as Prisma.InputJsonValue,
      status: 'NEW',
      clientId: linkedClientId || null,
      assignedToUserId: input.assignedToUserId || null,
      radarSignalId: input.radarSignalId || null,
    },
    include: {
      client: true,
      createdOffer: true,
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      radarSignal: true,
    },
  });

  if (input.radarSignalId) {
    await db.radarSignal.updateMany({
      where: { id: input.radarSignalId, organizationId },
      data: { status: 'PROMOTED', discoveredOpportunityId: opportunity.id },
    }).catch(() => null);
  }

  return { created: true, opportunity };
}

export async function updateOpportunityStatus(
  id: string,
  status: OpportunityStatus,
  organizationId: string,
  dismissedReason?: string,
  assignedToUserId?: string
) {
  const current = await prisma.salesOpportunity.findFirst({ where: { id, organizationId }, select: { status: true } });
  if (!current) throw new OpportunityValidationError('Příležitost nebyla nalezena.', 404);
  assertOpportunityTransition(current.status, status);
  if (assignedToUserId) {
    const member = await prisma.organizationMember.count({ where: { organizationId, userId: assignedToUserId, isActive: true } });
    if (!member) throw new OpportunityValidationError('Vybraný obchodník není aktivním členem organizace.');
  }
  const data: Prisma.SalesOpportunityUpdateInput = { status };
  if (dismissedReason !== undefined) {
    data.dismissedReason = dismissedReason;
  }
  if (assignedToUserId !== undefined) {
    data.assignedTo = assignedToUserId ? { connect: { id: assignedToUserId } } : { disconnect: true };
  }
  const changed = await prisma.salesOpportunity.updateMany({
    where: { id, organizationId, status: current.status },
    data,
  });
  if (changed.count !== 1) throw new OpportunityValidationError('Příležitost mezitím změnil jiný uživatel. Obnovte stránku.', 409);
  return prisma.salesOpportunity.findFirstOrThrow({
    where: { id, organizationId },
    include: {
      client: true,
      createdOffer: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function linkOpportunityToClient(id: string, clientId: string, organizationId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, organizationId, active: true } });
  if (!client) throw new Error('Vybraný klient v CRM neexistuje.');

  await prisma.salesOpportunity.updateMany({
    where: { id, organizationId },
    data: {
      clientId,
      status: 'REVIEWED',
    },
  });
  return prisma.salesOpportunity.findFirstOrThrow({
    where: { id, organizationId },
    include: {
      client: true,
    },
  });
}

export async function getOpportunityStats(organizationId: string) {
  const [totalNew, totalHighScore, totalContactThisWeek, totalProposals, totalConverted] = await Promise.all([
    prisma.salesOpportunity.count({ where: { organizationId, mergedIntoId: null, status: 'NEW' } }),
    prisma.salesOpportunity.count({ where: { organizationId, mergedIntoId: null, opportunityScore: { gte: 80 }, status: { notIn: ['DISMISSED'] } } }),
    prisma.salesOpportunity.count({
      where: {
        organizationId,
        mergedIntoId: null,
        status: { in: ['NEW', 'REVIEWED', 'CONTACT_PLANNED'] },
        eventDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.salesOpportunity.count({ where: { organizationId, mergedIntoId: null, status: 'PROPOSAL_CREATED' } }),
    prisma.salesOpportunity.count({ where: { organizationId, mergedIntoId: null, status: 'CONVERTED' } }),
  ]);

  return {
    totalNew,
    totalHighScore,
    totalContactThisWeek,
    totalProposals,
    totalConverted,
  };
}
