import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { buildCommercialRequestFromMailbox } from '@/lib/ai-commercial/adapters/mailbox-adapter';
import { determineNextBestActionForRequest } from '@/lib/ai-commercial/next-best-action';
import type { AiInboxAnalysisResult } from '@/lib/ai-inbox/types';
import type { DatesClarity } from '@/lib/ai-commercial/contracts/commercial-request';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'aiInbox')) {
    return NextResponse.json({ error: 'Nemáte oprávnění pro přístup k AI Inboxu.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  const message = await prisma.aiInboxMessage.findFirst({
    where: { id: params.id, organizationId },
    include: {
      client: true,
      contact: true,
      attachments: true,
    },
  });

  if (!message) {
    return NextResponse.json({ error: 'Zpráva nebyla nalezena.' }, { status: 404 });
  }

  const commercialRequest = buildCommercialRequestFromMailbox(message);
  const nextBestAction = determineNextBestActionForRequest(commercialRequest);

  return NextResponse.json({
    commercialRequest,
    nextBestAction,
  });
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'aiInbox')) {
    return NextResponse.json({ error: 'Nemáte oprávnění pro úpravu AI poptávek.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  const message = await prisma.aiInboxMessage.findFirst({
    where: { id: params.id, organizationId },
    include: {
      client: true,
      contact: true,
      attachments: true,
    },
  });

  if (!message) {
    return NextResponse.json({ error: 'Zpráva nebyla nalezena.' }, { status: 404 });
  }

  const body = (await request.json()) as {
    companyName?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    cities?: string[];
    regions?: string[];
    dateFrom?: string | null;
    dateTo?: string | null;
    datesClarity?: DatesClarity;
    mediaTypes?: string[];
    quantity?: { min?: number | null; max?: number | null; exact?: number | null } | null;
    budget?: { min?: number | null; max?: number | null; exact?: number | null; currency?: string } | null;
    notes?: string;
    confirmed?: boolean;
  };

  const existingExtracted = (message.aiExtractedData || {}) as Partial<AiInboxAnalysisResult>;
  const existingReq = existingExtracted.request;

  const updatedReq = {
    ...existingReq,
    projectType: existingReq?.projectType || 'STANDARD_MEDIA',
    cities: body.cities !== undefined ? body.cities : existingReq?.cities || [],
    regions: body.regions !== undefined ? body.regions : existingReq?.regions || [],
    dateFrom: body.dateFrom !== undefined ? body.dateFrom : existingReq?.dateFrom || null,
    dateTo: body.dateTo !== undefined ? body.dateTo : existingReq?.dateTo || null,
    datesClarity: body.datesClarity !== undefined ? body.datesClarity : existingReq?.datesClarity || 'UNSPECIFIED',
    requestedMediaTypes: body.mediaTypes !== undefined ? body.mediaTypes : existingReq?.requestedMediaTypes || [],
    requestedQuantity: body.quantity !== undefined ? body.quantity : existingReq?.requestedQuantity || null,
    budget: body.budget !== undefined ? body.budget : existingReq?.budget || null,
    notes: body.notes !== undefined ? body.notes : existingReq?.notes || null,
    missingRequirements: [] as string[],
  };

  // Re-evaluate missing requirements
  if (updatedReq.datesClarity !== 'EXACT') {
    updatedReq.missingRequirements.push('EXACT_CAMPAIGN_DATES');
  }
  const hasQuantity = updatedReq.requestedQuantity && (
    updatedReq.requestedQuantity.exact !== null ||
    updatedReq.requestedQuantity.min !== null ||
    updatedReq.requestedQuantity.max !== null
  );
  if (!hasQuantity) {
    updatedReq.missingRequirements.push('EXACT_QUANTITY');
  }
  if (!updatedReq.cities.length && !updatedReq.location && !updatedReq.address) {
    updatedReq.missingRequirements.push('TARGET_LOCATION');
  }

  const updatedAnalysis: AiInboxAnalysisResult = {
    classification: existingExtracted.classification || 'NEW_INQUIRY',
    confidence: 1.0, // Human-reviewed
    company: {
      name: body.companyName || existingExtracted.company?.name || message.fromName || 'Neznámá společnost',
      tradingName: existingExtracted.company?.tradingName || null,
      ico: existingExtracted.company?.ico || null,
      dic: existingExtracted.company?.dic || null,
      address: existingExtracted.company?.address || null,
      city: existingExtracted.company?.city || null,
      confidence: 1.0,
    },
    contact: {
      name: body.contactName || existingExtracted.contact?.name || message.fromName || 'Neznámý kontakt',
      email: body.contactEmail || existingExtracted.contact?.email || message.fromEmail,
      phone: body.contactPhone || existingExtracted.contact?.phone || null,
      role: existingExtracted.contact?.role || null,
    },
    request: updatedReq,
    summary: existingExtracted.summary || message.subject,
    reasoningSummary: 'Ručně ověřeno a upraveno uživatelem v AI Inboxu.',
    suggestedReply: existingExtracted.suggestedReply,
  };

  const updatedMessage = await prisma.aiInboxMessage.update({
    where: { id: message.id },
    data: {
      aiExtractedData: updatedAnalysis as unknown as object,
      requiresReview: false,
      reviewedAt: new Date(),
      reviewedById: user.id,
      processingStatus: body.confirmed ? 'PROCESSED' : 'READY',
    },
    include: {
      client: true,
      contact: true,
      attachments: true,
    },
  });

  // Audit log entry
  await prisma.crmAuditLog.create({
    data: {
      organizationId,
      userId: user.id,
      userEmail: user.email,
      action: body.confirmed ? 'CONFIRM_COMMERCIAL_REQUEST' : 'UPDATE_COMMERCIAL_REQUEST',
      entityType: 'AI_INBOX_MESSAGE',
      entityId: message.id,
      detailsJson: JSON.stringify({
        changes: body,
        updatedStatus: updatedMessage.processingStatus,
      }),
    },
  });

  const commercialRequest = buildCommercialRequestFromMailbox(updatedMessage);
  const nextBestAction = determineNextBestActionForRequest(commercialRequest);

  return NextResponse.json({
    success: true,
    commercialRequest,
    nextBestAction,
  });
}
