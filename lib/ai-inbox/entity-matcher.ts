import { prisma } from '@/lib/db';
import { hashPublicOfferToken } from '@/lib/offers/token';
import type { MatchedEntityResult } from './types';

export const ORDER_NUMBER_REGEX = /\b(ZAK-\d{4}-\d{4,6})\b/i;
export const NAV_NUMBER_REGEX = /\b(NAV-\d{4}-\d{4,6}|NAV-\d{4,8})\b/i;
export const PROPOSAL_TOKEN_REGEX = /(?:\/proposals\/|\/offer\/|\/p\/)([a-zA-Z0-9_-]{8,64})/i;

export async function matchRelatedEntities(input: {
  organizationId: string;
  providerThreadId?: string | null;
  internetMessageId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  subject: string;
  textBody?: string | null;
  clientId?: string | null;
}): Promise<Partial<MatchedEntityResult>> {
  const {
    organizationId,
    providerThreadId,
    inReplyTo,
    references = [],
    subject,
    textBody,
    clientId,
  } = input;

  const result: Partial<MatchedEntityResult> = {};
  const combinedText = `${subject} ${textBody || ''}`;

  // 1. Thread ID propojení (pokud už jiná zpráva ve stejném Gmail vlákně byla spárována)
  if (providerThreadId) {
    const threadSibling = await prisma.aiInboxMessage.findFirst({
      where: {
        organizationId,
        providerThreadId,
        OR: [
          { offerId: { not: null } },
          { crmOrderId: { not: null } },
          { navigationOrderId: { not: null } },
        ],
      },
      select: {
        offerId: true,
        crmOrderId: true,
        navigationOrderId: true,
        clientId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (threadSibling) {
      if (threadSibling.offerId) result.offerId = threadSibling.offerId;
      if (threadSibling.crmOrderId) result.crmOrderId = threadSibling.crmOrderId;
      if (threadSibling.navigationOrderId) result.navigationOrderId = threadSibling.navigationOrderId;
      result.matchReason = 'Propojeno na základě e-mailového vlákna (Thread ID)';
      return result;
    }
  }

  // 2. In-Reply-To / References propojení na dřívější zprávu
  const messageIdsToCheck = [inReplyTo, ...references].filter((id): id is string => Boolean(id?.trim()));
  if (messageIdsToCheck.length > 0) {
    const parentMsg = await prisma.aiInboxMessage.findFirst({
      where: {
        organizationId,
        internetMessageId: { in: messageIdsToCheck },
        OR: [
          { offerId: { not: null } },
          { crmOrderId: { not: null } },
          { navigationOrderId: { not: null } },
        ],
      },
      select: {
        offerId: true,
        crmOrderId: true,
        navigationOrderId: true,
      },
    });

    if (parentMsg) {
      if (parentMsg.offerId) result.offerId = parentMsg.offerId;
      if (parentMsg.crmOrderId) result.crmOrderId = parentMsg.crmOrderId;
      if (parentMsg.navigationOrderId) result.navigationOrderId = parentMsg.navigationOrderId;
      result.matchReason = 'Propojeno podle RFC zprávy (In-Reply-To / References)';
      return result;
    }
  }

  // 3. Detekce čísla zakázky: ZAK-YYYY-XXXX
  const orderNumberMatch = combinedText.match(/\b(ZAK-\d{4}-\d{4,6})\b/i);
  if (orderNumberMatch) {
    const foundOrder = await prisma.crmOrder.findFirst({
      where: {
        organizationId,
        orderNumber: { equals: orderNumberMatch[1], mode: 'insensitive' },
      },
      select: { id: true, offerId: true, clientId: true },
    });

    if (foundOrder) {
      result.crmOrderId = foundOrder.id;
      if (foundOrder.offerId) result.offerId = foundOrder.offerId;
      result.matchReason = `Nalezeno číslo zakázky ${orderNumberMatch[1]}`;
      return result;
    }
  }

  // 4. Detekce čísla navigační zakázky: NAV-YYYY-XXXX nebo NAV-XXXX
  const navNumberMatch = combinedText.match(/\b(NAV-\d{4}-\d{4,6}|NAV-\d{4,8})\b/i);
  if (navNumberMatch) {
    const foundNav = await prisma.navigationOrder.findFirst({
      where: {
        organizationId,
        crmOrder: { orderNumber: { equals: navNumberMatch[1], mode: 'insensitive' } },
      },
      select: { id: true, crmOrderId: true },
    });

    if (foundNav) {
      result.navigationOrderId = foundNav.id;
      if (foundNav.crmOrderId) result.crmOrderId = foundNav.crmOrderId;
      result.matchReason = `Nalezeno číslo navigační zakázky ${navNumberMatch[1]}`;
      return result;
    }
  }

  // 5. Detekce tokenu veřejné nabídky z URL (/proposals/[token] nebo /offer/[token])
  const tokenMatch = combinedText.match(/(?:\/proposals\/|\/offer\/|\/p\/)([a-zA-Z0-9_-]{8,64})/i);
  if (tokenMatch) {
    const token = tokenMatch[1];
    const tokenHash = hashPublicOfferToken(token);
    const foundOffer = await prisma.offer.findFirst({
      where: {
        organizationId,
        publicTokenHash: tokenHash,
      },
      select: { id: true, clientId: true },
    });

    if (foundOffer) {
      result.offerId = foundOffer.id;
      result.matchReason = `Identifikován klientský odkaz nabídky (${token.slice(0, 8)}…)`;
      return result;
    }
  }

  // 6. Pokud je znám klient, zkusit dohledat jedinou aktivní odeslanou nabídku
  if (clientId) {
    const activeOffers = await prisma.offer.findMany({
      where: {
        organizationId,
        clientId,
        status: 'SENT',
      },
      select: { id: true, title: true },
      take: 2,
    });

    if (activeOffers.length === 1) {
      result.offerId = activeOffers[0].id;
      result.matchReason = `Nalezena aktivní odeslaná nabídka klienta (${activeOffers[0].title})`;
    }
  }

  return result;
}
