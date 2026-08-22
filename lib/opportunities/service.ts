import { prisma } from '@/lib/db';
import type { OpportunityEventType, OpportunityStatus, Prisma } from '@prisma/client';
import { calculateOpportunityScore } from './scoring';
import type { CreateOpportunityInput, OpportunityFilterParams, OpportunityScoreReason } from './types';
import { normalizeClientName } from '@/lib/crm/domain';

export async function getOpportunities(params: OpportunityFilterParams = {}) {
  const where: Prisma.SalesOpportunityWhereInput = {};

  if (params.status) {
    where.status = params.status;
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

export async function getOpportunityById(id: string) {
  return prisma.salesOpportunity.findUnique({
    where: { id },
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

export async function findDuplicateOpportunity(companyName: string, eventType: OpportunityEventType, city: string, sourceUrl?: string) {
  const normCompany = companyName.trim().toLowerCase();
  const normCity = city.trim().toLowerCase();

  const candidates = await prisma.salesOpportunity.findMany({
    where: {
      eventType,
      city: { contains: normCity, mode: 'insensitive' },
      status: { notIn: ['DISMISSED'] },
    },
    select: {
      id: true,
      companyName: true,
      sourceUrl: true,
      createdAt: true,
    },
  });

  return candidates.find(
    (c) =>
      c.companyName.trim().toLowerCase() === normCompany ||
      (sourceUrl && c.sourceUrl && c.sourceUrl.trim().toLowerCase() === sourceUrl.trim().toLowerCase())
  );
}

export async function createOpportunity(input: CreateOpportunityInput) {
  const duplicate = await findDuplicateOpportunity(
    input.companyName,
    input.eventType || 'NEW_BRANCH',
    input.city,
    input.sourceUrl
  );
  if (duplicate) {
    return { created: false, duplicateId: duplicate.id, opportunity: await getOpportunityById(duplicate.id) };
  }

  // Check carriers in city for scoring
  const carrierCount = await prisma.advertisingCarrier.count({
    where: {
      archivedAt: null,
      status: 'ACTIVE',
      city: { contains: input.city.trim(), mode: 'insensitive' },
    },
  });

  // Check if client exists in CRM
  let linkedClientId = input.clientId;
  if (!linkedClientId && input.companyName) {
    const existingClient = await prisma.client.findFirst({
      where: {
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

  const suggestedMediaTypes = input.suggestedMediaTypes || ['CITY_POSTER', 'PROMO_BENCH', 'NAVIGATION_SIGN'];

  const { score, reasons } = calculateOpportunityScore({
    eventType: input.eventType || 'NEW_BRANCH',
    city: input.city,
    region: input.region,
    eventDate: input.eventDate,
    carrierCountInCity: carrierCount,
    suggestedMediaTypes,
    isInCrm: Boolean(linkedClientId),
  });

  const defaultPhases = input.suggestedCampaignPhases || [
    {
      phase: 'TEASER',
      name: 'Před-otvírací fáze (Teaser)',
      timeframe: '2–3 týdny před otevřením',
      recommendedMediaTypes: ['CITY_POSTER', 'PROMO_BENCH'],
      description: 'Budování povědomí o příchodu značky a vyvolání prvotního zájmu obyvatel v širším okolí.',
    },
    {
      phase: 'OPENING',
      name: 'Fáze slavnostního otevření',
      timeframe: 'Týden otevření',
      recommendedMediaTypes: ['CITY_POSTER', 'NAVIGATION_SIGN', 'PROMO_BENCH'],
      description: 'Intenzivní lokální kampaň s přímou navigací zákazníků z hlavních příjezdových křižovatek k novému objektu.',
    },
    {
      phase: 'FOLLOW_UP',
      name: 'Stabilizační fáze (Follow-up)',
      timeframe: '1–2 týdny po otevření',
      recommendedMediaTypes: ['PROMO_BENCH', 'CITY_POSTER'],
      description: 'Upevnění návyku zákazníků navštěvovat novou pobočku v rezidenčních a spádových čtvrtích.',
    },
  ];

  const opportunity = await prisma.salesOpportunity.create({
    data: {
      companyName: input.companyName.trim(),
      companyId: input.companyId?.trim() || null,
      website: input.website?.trim() || null,
      eventType: input.eventType || 'NEW_BRANCH',
      title: input.title.trim(),
      summary: input.summary.trim(),
      city: input.city.trim(),
      region: input.region?.trim() || 'Moravskoslezský kraj',
      address: input.address?.trim() || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
      sourceUrl: input.sourceUrl.trim(),
      sourceTitle: input.sourceTitle.trim(),
      sourcePublishedAt: input.sourcePublishedAt ? new Date(input.sourcePublishedAt) : null,
      opportunityScore: score,
      scoreReasons: reasons as unknown as Prisma.InputJsonValue,
      suggestedMediaTypes: suggestedMediaTypes as unknown as Prisma.InputJsonValue,
      suggestedCampaignPhases: defaultPhases as unknown as Prisma.InputJsonValue,
      status: 'NEW',
      clientId: linkedClientId || null,
      assignedToUserId: input.assignedToUserId || null,
    },
    include: {
      client: true,
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return { created: true, opportunity };
}

export async function updateOpportunityStatus(
  id: string,
  status: OpportunityStatus,
  dismissedReason?: string,
  assignedToUserId?: string
) {
  const data: Prisma.SalesOpportunityUpdateInput = { status };
  if (dismissedReason !== undefined) {
    data.dismissedReason = dismissedReason;
  }
  if (assignedToUserId !== undefined) {
    data.assignedTo = assignedToUserId ? { connect: { id: assignedToUserId } } : { disconnect: true };
  }
  return prisma.salesOpportunity.update({
    where: { id },
    data,
    include: {
      client: true,
      createdOffer: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function linkOpportunityToClient(id: string, clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error('Vybraný klient v CRM neexistuje.');

  return prisma.salesOpportunity.update({
    where: { id },
    data: {
      clientId,
      status: 'REVIEWED',
    },
    include: {
      client: true,
    },
  });
}

export async function getOpportunityStats() {
  const [totalNew, totalHighScore, totalContactThisWeek, totalProposals, totalConverted] = await Promise.all([
    prisma.salesOpportunity.count({ where: { status: 'NEW' } }),
    prisma.salesOpportunity.count({ where: { opportunityScore: { gte: 80 }, status: { notIn: ['DISMISSED'] } } }),
    prisma.salesOpportunity.count({
      where: {
        status: { in: ['NEW', 'REVIEWED', 'CONTACT_PLANNED'] },
        eventDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.salesOpportunity.count({ where: { status: 'PROPOSAL_CREATED' } }),
    prisma.salesOpportunity.count({ where: { status: 'CONVERTED' } }),
  ]);

  return {
    totalNew,
    totalHighScore,
    totalContactThisWeek,
    totalProposals,
    totalConverted,
  };
}
