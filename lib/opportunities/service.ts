import { prisma } from '@/lib/db';
import type { OpportunityEventType, OpportunityStatus, Prisma } from '@prisma/client';
import { calculateOpportunityScore } from './scoring';
import type { CreateOpportunityInput, OpportunityFilterParams } from './types';
import { normalizeClientName } from '@/lib/crm/domain';
import { assertOpportunityTransition, OpportunityValidationError } from './policy';

export async function getOpportunities(params: OpportunityFilterParams = {}, organizationId: string) {
  const where: Prisma.SalesOpportunityWhereInput = { organizationId };

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
  return prisma.salesOpportunity.findFirst({
    where: { id, organizationId },
    include: {
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
}

import { getOrganizationRadarProfile } from './radar-profile';
import { findNearbyCarriers } from './distance';

export async function findDuplicateOpportunity(
  companyName: string,
  eventType: OpportunityEventType,
  city: string | null | undefined,
  organizationId: string,
  sourceUrl?: string
) {
  const normCompany = companyName.trim().toLowerCase();

  // 1. Check exact source URL duplicate
  const source = sourceUrl?.trim();
  const isGenericInternalSource = !source || source.includes('radar.internal') || source === 'https://seepoint.cz' || source === 'https://seepoint.cz/';
  if (source && !isGenericInternalSource) {
    const existingByUrl = await prisma.salesOpportunity.findFirst({
      where: { organizationId, sourceUrl: source },
      select: { id: true, companyName: true, sourceUrl: true, createdAt: true },
    });
    if (existingByUrl) return existingByUrl;
  }

  // 2. Check company name match in database
  const where: Prisma.SalesOpportunityWhereInput = {
    organizationId,
    companyName: { contains: normCompany, mode: 'insensitive' },
    eventType,
    createdAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60_000) },
  };
  if (city?.trim()) {
    where.city = { equals: city.trim(), mode: 'insensitive' };
  }

  const candidates = await prisma.salesOpportunity.findMany({
    where,
    select: {
      id: true,
      companyName: true,
      sourceUrl: true,
      createdAt: true,
    },
  });

  return candidates.find(
    (c) => c.companyName.trim().toLowerCase() === normCompany
  );
}

export async function createOpportunity(input: CreateOpportunityInput, organizationId: string) {
  const duplicate = await findDuplicateOpportunity(
    input.companyName,
    input.eventType || 'NEW_BRANCH',
    input.city,
    organizationId,
    input.sourceUrl
  );
  if (duplicate) {
    if (input.radarSignalId) {
      await prisma.radarSignal.updateMany({
        where: { id: input.radarSignalId, organizationId },
        data: { status: 'DUPLICATE', discoveredOpportunityId: duplicate.id },
      }).catch(() => null);
    }
    return { created: false, duplicateId: duplicate.id, opportunity: await getOpportunityById(duplicate.id, organizationId) };
  }

  if (input.clientId) {
    const clientExists = await prisma.client.count({ where: { id: input.clientId, organizationId, active: true } });
    if (!clientExists) throw new OpportunityValidationError('Vybraný klient v aktivní organizaci neexistuje.', 404);
  }
  if (input.assignedToUserId) {
    const assigneeExists = await prisma.organizationMember.count({
      where: { organizationId, userId: input.assignedToUserId, isActive: true },
    });
    if (!assigneeExists) throw new OpportunityValidationError('Vybraný obchodník není aktivním členem organizace.');
  }

  const radarProfile = await getOrganizationRadarProfile(organizationId);

  // Check carriers in city or nearby by GPS
  let nearbyCount = 0;
  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
    const nearby = await findNearbyCarriers(organizationId, input.latitude, input.longitude, 5);
    nearbyCount = nearby.length;
  }

  let carrierCount = 0;
  if (input.city?.trim()) {
    carrierCount = await prisma.advertisingCarrier.count({
      where: {
        organizationId,
        archivedAt: null,
        status: 'ACTIVE',
        city: { contains: input.city.trim(), mode: 'insensitive' },
      },
    });
  }

  // Check if client exists in CRM
  let linkedClientId = input.clientId;
  if (!linkedClientId && input.companyName) {
    const existingClient = await prisma.client.findFirst({
      where: {
        organizationId,
        active: true,
        OR: [
          { name: { equals: input.companyName.trim(), mode: 'insensitive' } },
          { normalizedName: { equals: normalizeClientName(input.companyName) } },
        ],
      },
      select: { id: true },
    });
    if (existingClient) {
      linkedClientId = existingClient.id;
    }
  }

  const suggestedMediaTypes = input.suggestedMediaTypes?.length
    ? input.suggestedMediaTypes
    : radarProfile.preferredMediaTypes.slice(0, 3);

  const { score, breakdown, reasons } = calculateOpportunityScore({
    eventType: input.eventType || 'NEW_BRANCH',
    city: input.city,
    region: input.region,
    eventDate: input.eventDate,
    carrierCountInCity: carrierCount,
    nearbyCarriersCount: nearbyCount,
    suggestedMediaTypes,
    preferredMediaTypes: radarProfile.preferredMediaTypes,
    targetRegions: radarProfile.targetRegions,
    targetCities: radarProfile.targetCities,
    isInCrm: Boolean(linkedClientId),
    companyId: input.companyId,
    website: input.website,
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

  const opportunity = await prisma.salesOpportunity.create({
    data: {
      organizationId,
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
      scoreReasons: reasons as unknown as Prisma.InputJsonValue,
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
    await prisma.radarSignal.updateMany({
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
    prisma.salesOpportunity.count({ where: { organizationId, status: 'NEW' } }),
    prisma.salesOpportunity.count({ where: { organizationId, opportunityScore: { gte: 80 }, status: { notIn: ['DISMISSED'] } } }),
    prisma.salesOpportunity.count({
      where: {
        organizationId,
        status: { in: ['NEW', 'REVIEWED', 'CONTACT_PLANNED'] },
        eventDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.salesOpportunity.count({ where: { organizationId, status: 'PROPOSAL_CREATED' } }),
    prisma.salesOpportunity.count({ where: { organizationId, status: 'CONVERTED' } }),
  ]);

  return {
    totalNew,
    totalHighScore,
    totalContactThisWeek,
    totalProposals,
    totalConverted,
  };
}
