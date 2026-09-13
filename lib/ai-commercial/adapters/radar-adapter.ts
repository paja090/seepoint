import type { SalesOpportunity, Client } from '@prisma/client';
import type {
  CommercialOpportunityContext,
  CommercialOpportunityType,
} from '../contracts/commercial-opportunity';
import type { CommercialRequest, DatesClarity } from '../contracts/commercial-request';

export type SalesOpportunityWithRelations = SalesOpportunity & {
  client?: Client | null;
};

/**
 * Transforms a SalesOpportunity from AI Sales Radar into a canonical CommercialOpportunityContext.
 * Automatically classifies the opportunity as UPSELL or EXPANSION when an existing CRM client is linked.
 */
export function buildCommercialOpportunityContextFromRadar(
  opportunity: SalesOpportunityWithRelations
): CommercialOpportunityContext {
  let opportunityType: CommercialOpportunityType = 'NEW_ACQUISITION';

  if (opportunity.clientId || opportunity.client) {
    if (
      opportunity.eventType === 'NEW_BRANCH' ||
      opportunity.eventType === 'NEW_ESTABLISHMENT' ||
      opportunity.eventType === 'STORE_OPENING' ||
      opportunity.eventType === 'EXPANSION' ||
      opportunity.eventType === 'RELOCATION' ||
      opportunity.eventType === 'RETAIL_PARK' ||
      opportunity.eventType === 'RETAIL_PARK_TENANT'
    ) {
      opportunityType = 'EXPANSION';
    } else {
      opportunityType = 'UPSELL';
    }
  }

  const suggestedMedia = Array.isArray(opportunity.suggestedMediaTypes)
    ? (opportunity.suggestedMediaTypes as string[])
    : [];

  return {
    organizationId: opportunity.organizationId,
    opportunityId: opportunity.id,
    source: 'SALES_RADAR',
    opportunityType,
    clientId: opportunity.clientId,
    companyName: opportunity.client?.name || opportunity.companyName,
    companyId: opportunity.companyId,
    title: opportunity.title,
    reason: opportunity.summary,
    city: opportunity.city,
    region: opportunity.region,
    address: opportunity.address,
    latitude: opportunity.latitude,
    longitude: opportunity.longitude,
    eventDate: opportunity.eventDate,
    score: opportunity.opportunityScore,
    suggestedMediaTypes: suggestedMedia,
    sourceUrl: opportunity.sourceUrl,
    sourceTitle: opportunity.sourceTitle,
    assignedToUserId: opportunity.assignedToUserId,
    createdAt: opportunity.createdAt,
  };
}

/**
 * Converts a Sales Radar opportunity into a structured CommercialRequest.
 * Enables the Commercial Engine to check availability and draft an offer for radar discoveries.
 */
export function buildCommercialRequestFromRadar(
  opportunity: SalesOpportunityWithRelations
): CommercialRequest {
  const context = buildCommercialOpportunityContextFromRadar(opportunity);
  const now = new Date();

  // If eventDate is in the future, propose campaign timeframe starting 2 weeks before event
  let dateFrom: Date | null = null;
  let dateTo: Date | null = null;
  const datesClarity: DatesClarity = opportunity.eventDate ? 'APPROXIMATE' : 'UNSPECIFIED';

  if (opportunity.eventDate) {
    const eventTime = new Date(opportunity.eventDate).getTime();
    if (eventTime > now.getTime()) {
      // 14 days before opening to 14 days after opening
      dateFrom = new Date(eventTime - 14 * 24 * 60 * 60 * 1000);
      dateTo = new Date(eventTime + 14 * 24 * 60 * 60 * 1000);
    }
  }

  const missingRequirements: string[] = ['EXACT_CAMPAIGN_DATES', 'EXACT_QUANTITY'];
  if (context.suggestedMediaTypes.length === 0) {
    missingRequirements.push('PREFERRED_MEDIA_TYPES');
  }

  const cities = opportunity.city ? [opportunity.city] : [];
  const regions = opportunity.region ? [opportunity.region] : [];

  return {
    organizationId: opportunity.organizationId,
    id: `req-radar-${opportunity.id}`,
    source: 'SALES_RADAR',
    sourceReference: {
      type: 'SalesOpportunity',
      id: opportunity.id,
    },
    clientId: opportunity.clientId,
    companyName: context.companyName,
    cities,
    regions,
    targetAddress: opportunity.address,
    dateFrom,
    dateTo,
    datesClarity,
    rawDateDescription: opportunity.eventDate
      ? `Událost plánována na ${opportunity.eventDate.toISOString().slice(0, 10)}`
      : null,
    mediaTypes: context.suggestedMediaTypes.length ? context.suggestedMediaTypes : [],
    quantity: null,
    budget: null,
    campaignTitle: `Příležitost: ${context.companyName} (${opportunity.title})`,
    notes: `Generováno z AI Sales Radaru (Skóre: ${opportunity.opportunityScore}/100). Typ příležitosti: ${context.opportunityType}.`,
    specificRequirements: opportunity.address ? [`Vhodné nosiče v dojezdové vzdálenosti od adresy: ${opportunity.address}`] : [],
    missingRequirements,
    status: 'NEEDS_MORE_INFORMATION',
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
  };
}

