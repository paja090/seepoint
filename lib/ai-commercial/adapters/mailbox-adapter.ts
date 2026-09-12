import type { AiInboxMessage, Client, ClientContact } from '@prisma/client';
import type {
  CommercialRequest,
  CommercialRequestStatus,
  DatesClarity,
} from '../contracts/commercial-request';
import type { AiInboxAnalysisResult } from '@/lib/ai-inbox/types';

export type InboxMessageWithRelations = AiInboxMessage & {
  client?: Client | null;
  contact?: ClientContact | null;
};

/**
 * Transforms an ingested and analyzed AiInboxMessage into a canonical CommercialRequest.
 * Enforces the strict rule: NO GUESSING DATES.
 * If dates are approximate or unspecified, status is marked NEEDS_MORE_INFORMATION.
 */
export function buildCommercialRequestFromInboxMessage(
  message: InboxMessageWithRelations,
  explicitContact?: ClientContact | null
): CommercialRequest {
  const extracted = (message.aiExtractedData || (message as { extractedData?: unknown }).extractedData || {}) as Partial<AiInboxAnalysisResult>;
  const req = extracted.request;
  const company = extracted.company;
  const contact = extracted.contact;

  // 1. Resolve timing and clarity
  let dateFrom: Date | null = null;
  let dateTo: Date | null = null;
  let datesClarity: DatesClarity = req?.datesClarity || 'UNSPECIFIED';

  if (req?.dateFrom && req?.dateTo) {
    const dFrom = new Date(req.dateFrom);
    const dTo = new Date(req.dateTo);
    if (!isNaN(dFrom.getTime()) && !isNaN(dTo.getTime()) && dFrom <= dTo) {
      dateFrom = dFrom;
      dateTo = dTo;
      datesClarity = 'EXACT';
    } else {
      datesClarity = 'APPROXIMATE';
    }
  } else if (req?.openingDate) {
    const dOpening = new Date(req.openingDate);
    if (!isNaN(dOpening.getTime())) {
      dateFrom = dOpening;
      datesClarity = 'APPROXIMATE';
    }
  }

  // 2. Identify missing requirements
  const missingRequirements: string[] = [...(req?.missingRequirements || [])];
  if (datesClarity !== 'EXACT' && !missingRequirements.includes('EXACT_CAMPAIGN_DATES')) {
    missingRequirements.push('EXACT_CAMPAIGN_DATES');
  }

  const cities = req?.cities?.length
    ? req.cities
    : req?.location
    ? [req.location]
    : [];

  if (cities.length === 0 && !req?.address) {
    if (!missingRequirements.includes('TARGET_LOCATION')) {
      missingRequirements.push('TARGET_LOCATION');
    }
  }

  // Check if quantity is missing for a commercial inquiry
  const hasQuantity = req?.requestedQuantity && (
    req.requestedQuantity.exact !== null ||
    req.requestedQuantity.min !== null ||
    req.requestedQuantity.max !== null
  );
  if (!hasQuantity && !missingRequirements.includes('EXACT_QUANTITY')) {
    missingRequirements.push('EXACT_QUANTITY');
  }

  // 3. Determine status
  let status: CommercialRequestStatus = 'READY_FOR_AVAILABILITY';
  if (missingRequirements.length > 0 || datesClarity !== 'EXACT') {
    status = 'NEEDS_MORE_INFORMATION';
  }

  return {
    organizationId: message.organizationId,
    id: `req-inbox-${message.id}`,
    source: 'AI_MAILBOX',
    sourceReference: {
      type: 'AiInboxMessage',
      id: message.id,
      threadId: message.providerThreadId,
    },
    clientId: message.clientId || null,
    contactId: (message.contactId || explicitContact?.id) || null,
    companyName: message.client?.name || company?.name || message.fromName || 'Neznámá společnost',
    contactName: (explicitContact || message.contact)
      ? `${(explicitContact || message.contact)!.firstName} ${(explicitContact || message.contact)!.lastName}`.trim()
      : contact?.name || message.fromName,
    contactEmail: (explicitContact || message.contact)?.email || contact?.email || message.fromEmail,
    contactPhone: (explicitContact || message.contact)?.phone || contact?.phone,
    cities,
    regions: req?.regions || [],
    targetAddress: req?.address,
    dateFrom,
    dateTo,
    datesClarity,
    rawDateDescription: req?.rawDateDescription,
    mediaTypes: req?.requestedMediaTypes?.length
      ? req.requestedMediaTypes
      : req?.projectType === 'NAVIGATION'
      ? ['NAVIGATION_SIGN']
      : req?.projectType === 'STANDARD_MEDIA'
      ? ['BILLBOARD']
      : [],
    quantity: req?.requestedQuantity,
    budget: req?.budget,
    campaignTitle: message.subject,
    notes: req?.notes || extracted.summary,
    specificRequirements: req?.specificRequirements || [],
    missingRequirements,
    status,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

export const buildCommercialRequestFromMailbox = buildCommercialRequestFromInboxMessage;
