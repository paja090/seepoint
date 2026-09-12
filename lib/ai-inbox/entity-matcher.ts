import { prisma } from '@/lib/db';
import { hashPublicOfferToken } from '@/lib/offers/token';
import type { MatchedEntityResult } from './types';

export const ORDER_NUMBER_REGEX = /\b(ZAK[- /]?\d{4}[- /]?\d{1,6}|TEST-NAV[- /]?\d{4}[- /]?\d{1,6})\b/i;
export const NAV_NUMBER_REGEX = /\b(NAV[- /]?\d{4}[- /]?\d{1,6}|NAV[- /]?\d{4,8})\b/i;
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
  extractedOrderNumber?: string | null;
  extractedClientOrderCode?: string | null;
}): Promise<Partial<MatchedEntityResult>> {
  const {
    organizationId,
    providerThreadId,
    inReplyTo,
    references = [],
    subject,
    textBody,
    clientId,
    extractedOrderNumber,
    extractedClientOrderCode,
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

  // 3. Detekce čísla zakázky: ZAK-YYYY-XXXX nebo TEST-NAV-YYYY-XXX
  const orderNumberMatch = combinedText.match(ORDER_NUMBER_REGEX);
  const rawOrderCandidates = [
    extractedOrderNumber,
    orderNumberMatch ? orderNumberMatch[1] : null,
  ].filter((c): c is string => Boolean(c?.trim()));

  for (const rawCode of rawOrderCandidates) {
    const normCode = rawCode.replace(/\s+/g, '-').replace(/\//g, '-').toUpperCase();
    const foundOrder = await prisma.crmOrder.findFirst({
      where: {
        organizationId,
        OR: [
          { orderNumber: { equals: rawCode.trim(), mode: 'insensitive' } },
          { orderNumber: { equals: normCode, mode: 'insensitive' } },
          { orderNumber: { contains: normCode, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        offerId: true,
        clientId: true,
        navigationOrder: { select: { id: true } },
      },
    });

    if (foundOrder) {
      result.crmOrderId = foundOrder.id;
      result.orderNumber = foundOrder.orderNumber;
      result.orderTitle = foundOrder.title;
      if (foundOrder.offerId) result.offerId = foundOrder.offerId;
      if (foundOrder.navigationOrder) result.navigationOrderId = foundOrder.navigationOrder.id;
      result.matchReason = `Nalezeno číslo zakázky ${foundOrder.orderNumber}`;
      return result;
    }
  }

  // 4. Detekce čísla objednávky zákazníka (clientOrderCode)
  if (extractedClientOrderCode) {
    const foundByClientCode = await prisma.crmOrder.findFirst({
      where: {
        organizationId,
        clientOrderCode: { equals: extractedClientOrderCode.trim(), mode: 'insensitive' },
      },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        offerId: true,
        navigationOrder: { select: { id: true } },
      },
    });

    if (foundByClientCode) {
      result.crmOrderId = foundByClientCode.id;
      result.orderNumber = foundByClientCode.orderNumber;
      result.orderTitle = foundByClientCode.title;
      if (foundByClientCode.offerId) result.offerId = foundByClientCode.offerId;
      if (foundByClientCode.navigationOrder) result.navigationOrderId = foundByClientCode.navigationOrder.id;
      result.matchReason = `Nalezena objednávka zákazníka ${extractedClientOrderCode}`;
      return result;
    }
  }

  // 5. Detekce čísla navigační zakázky: NAV-YYYY-XXXX nebo NAV-XXXX
  const navNumberMatch = combinedText.match(NAV_NUMBER_REGEX);
  if (navNumberMatch) {
    const rawNav = navNumberMatch[1];
    const normNav = rawNav.replace(/\s+/g, '-').replace(/\//g, '-').toUpperCase();
    const foundNav = await prisma.navigationOrder.findFirst({
      where: {
        organizationId,
        OR: [
          { crmOrder: { orderNumber: { equals: rawNav, mode: 'insensitive' } } },
          { crmOrder: { orderNumber: { equals: normNav, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        crmOrderId: true,
        crmOrder: { select: { orderNumber: true, title: true } },
      },
    });

    if (foundNav) {
      result.navigationOrderId = foundNav.id;
      result.crmOrderId = foundNav.crmOrderId;
      result.orderNumber = foundNav.crmOrder?.orderNumber;
      result.orderTitle = foundNav.crmOrder?.title;
      result.matchReason = `Nalezeno číslo navigační zakázky ${foundNav.crmOrder?.orderNumber || rawNav}`;
      return result;
    }
  }

  // 6. Detekce tokenu veřejné nabídky z URL (/proposals/[token] nebo /offer/[token])
  const tokenMatch = combinedText.match(PROPOSAL_TOKEN_REGEX);
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

  // 7. Pokud je znám klient, dohledat jeho aktivní zakázky
  if (clientId) {
    const clientOrders = await prisma.crmOrder.findMany({
      where: {
        organizationId,
        clientId,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
      },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        status: true,
        projectType: true,
        offerId: true,
        navigationOrder: { select: { id: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    result.candidateOrders = clientOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      title: o.title,
      status: o.status,
      projectType: o.projectType,
      isNavigation: Boolean(o.navigationOrder),
    }));

    // Zkusit shodu podle názvu zakázky (v předmětu nebo textu e-mailu)
    const lowerCombined = combinedText.toLowerCase();
    const titleMatchedOrder = clientOrders.find((o) => {
      if (!o.title) return false;
      const lowerTitle = o.title.toLowerCase().trim();
      if (lowerTitle.length >= 4 && lowerCombined.includes(lowerTitle)) return true;
      // Klíčová slova z názvu zakázky (min 5 znaků)
      const words = lowerTitle.split(/\s+/).filter((w) => w.length >= 5);
      return words.some((w) => lowerCombined.includes(w));
    });

    if (titleMatchedOrder) {
      result.crmOrderId = titleMatchedOrder.id;
      result.orderNumber = titleMatchedOrder.orderNumber;
      result.orderTitle = titleMatchedOrder.title;
      if (titleMatchedOrder.navigationOrder) result.navigationOrderId = titleMatchedOrder.navigationOrder.id;
      if (titleMatchedOrder.offerId) result.offerId = titleMatchedOrder.offerId;
      result.matchReason = `Spárováno s aktivní zakázkou klienta (${titleMatchedOrder.orderNumber} – ${titleMatchedOrder.title})`;
      return result;
    }

    // Pokud má klient právě 1 aktivní zakázku, navrhnout ji
    if (clientOrders.length === 1) {
      const singleOrder = clientOrders[0];
      result.crmOrderId = singleOrder.id;
      result.orderNumber = singleOrder.orderNumber;
      result.orderTitle = singleOrder.title;
      if (singleOrder.navigationOrder) result.navigationOrderId = singleOrder.navigationOrder.id;
      if (singleOrder.offerId) result.offerId = singleOrder.offerId;
      result.matchReason = `Přiřazena aktivní zakázka klienta (${singleOrder.orderNumber} – ${singleOrder.title})`;
      return result;
    }

    // 8. Pokud nebyla nalezena zakázka, zkusit dohledat aktivní odeslanou nabídku
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
