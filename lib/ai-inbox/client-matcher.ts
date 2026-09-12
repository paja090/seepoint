import { prisma } from '@/lib/db';
import { normalizeClientName } from '@/lib/crm/domain';
import type { ExtractedCompanyData, ExtractedContactData, MatchedClientCandidate } from './types';

export const COMMON_FREEMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'seznam.cz',
  'email.cz',
  'post.cz',
  'centrum.cz',
  'atlas.cz',
  'volny.cz',
  'tiscali.cz',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'gmx.com',
  'mail.com',
]);

export function extractDomain(email?: string | null): string | null {
  if (!email || !email.includes('@')) return null;
  const parts = email.trim().toLowerCase().split('@');
  return parts[1] || null;
}

export function isFreemailDomain(domainOrEmail?: string | null): boolean {
  if (!domainOrEmail) return false;
  const domain = domainOrEmail.includes('@') ? extractDomain(domainOrEmail) : domainOrEmail.toLowerCase().trim();
  return domain ? COMMON_FREEMAIL_DOMAINS.has(domain) : false;
}

export async function matchClientForInboundMessage(input: {
  organizationId: string;
  fromEmail: string;
  extractedCompany?: ExtractedCompanyData | null;
  extractedContact?: ExtractedContactData | null;
}): Promise<{
  bestMatch: MatchedClientCandidate | null;
  candidates: MatchedClientCandidate[];
}> {
  const { organizationId, fromEmail, extractedCompany, extractedContact } = input;
  const candidates: MatchedClientCandidate[] = [];
  const seenClientIds = new Set<string>();

  function addCandidate(cand: MatchedClientCandidate) {
    if (!seenClientIds.has(cand.id)) {
      seenClientIds.add(cand.id);
      candidates.push(cand);
    }
  }

  // 1. Přesná shoda podle e-mailu v kontaktech klienta
  const emailsToCheck = [fromEmail, extractedContact?.email].filter((e): e is string => Boolean(e?.includes('@')));
  for (const email of emailsToCheck) {
    const contactMatch = await prisma.clientContact.findFirst({
      where: {
        organizationId,
        email: { equals: email.trim(), mode: 'insensitive' },
        active: true,
      },
      include: { client: true },
    });

    if (contactMatch && contactMatch.client && contactMatch.client.active) {
      addCandidate({
        id: contactMatch.client.id,
        name: contactMatch.client.name,
        companyId: contactMatch.client.companyId,
        email: contactMatch.client.email,
        matchType: 'EXACT_CONTACT_EMAIL',
        confidence: 0.98,
        contactId: contactMatch.id,
        contactName: `${contactMatch.firstName} ${contactMatch.lastName}`.trim(),
      });
    }
  }

  // 2. Přesná shoda podle e-mailu na kartě klienta
  const directClientMatch = await prisma.client.findFirst({
    where: {
      organizationId,
      email: { equals: fromEmail.trim(), mode: 'insensitive' },
      active: true,
    },
  });

  if (directClientMatch) {
    addCandidate({
      id: directClientMatch.id,
      name: directClientMatch.name,
      companyId: directClientMatch.companyId,
      email: directClientMatch.email,
      matchType: 'EXACT_COMPANY_EMAIL',
      confidence: 0.95,
    });
  }

  // 3. IČO shoda (pokud bylo extrahováno z podpisu / patičky)
  if (extractedCompany?.ico) {
    const ico = extractedCompany.ico.trim();
    const icoMatch = await prisma.client.findFirst({
      where: {
        organizationId,
        companyId: { equals: ico, mode: 'insensitive' },
        active: true,
      },
    });

    if (icoMatch) {
      addCandidate({
        id: icoMatch.id,
        name: icoMatch.name,
        companyId: icoMatch.companyId,
        email: icoMatch.email,
        matchType: 'COMPANY_ID_MATCH',
        confidence: 0.96,
      });
    }
  }

  // 4. Shoda podle domény odesílatele (mimo freemaily)
  const senderDomain = extractDomain(fromEmail);
  if (senderDomain && !COMMON_FREEMAIL_DOMAINS.has(senderDomain)) {
    const domainClients = await prisma.client.findMany({
      where: {
        organizationId,
        active: true,
        OR: [
          { email: { endsWith: `@${senderDomain}`, mode: 'insensitive' } },
          { website: { contains: senderDomain, mode: 'insensitive' } },
        ],
      },
      take: 5,
    });

    for (const c of domainClients) {
      addCandidate({
        id: c.id,
        name: c.name,
        companyId: c.companyId,
        email: c.email,
        matchType: 'DOMAIN_MATCH',
        confidence: 0.85,
      });
    }
  }

  // 5. Normalizovaný název firmy
  if (extractedCompany?.name) {
    const normalized = normalizeClientName(extractedCompany.name);
    const normalizedMatch = await prisma.client.findFirst({
      where: {
        organizationId,
        normalizedName: normalized,
        active: true,
      },
    });

    if (normalizedMatch) {
      addCandidate({
        id: normalizedMatch.id,
        name: normalizedMatch.name,
        companyId: normalizedMatch.companyId,
        email: normalizedMatch.email,
        matchType: 'NORMALIZED_NAME_MATCH',
        confidence: 0.90,
      });
    }

    // 6. Částečná shoda pro nabídku alternativních kandidátů
    if (extractedCompany.name.length >= 4) {
      const fuzzyClients = await prisma.client.findMany({
        where: {
          organizationId,
          active: true,
          name: { contains: extractedCompany.name.trim(), mode: 'insensitive' },
        },
        take: 3,
      });

      for (const fc of fuzzyClients) {
        addCandidate({
          id: fc.id,
          name: fc.name,
          companyId: fc.companyId,
          email: fc.email,
          matchType: 'FUZZY_NAME_MATCH',
          confidence: 0.70,
        });
      }
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const bestMatch = candidates.length > 0 && candidates[0].confidence >= 0.80 ? candidates[0] : null;

  return {
    bestMatch,
    candidates,
  };
}
