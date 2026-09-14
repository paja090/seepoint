/**
 * AI CRM Intelligence — Follow-Up Draft Service
 *
 * Generates context-aware draft follow-up emails for waiting offers.
 * Strictly DRAFT ONLY: Requires human review and manual send.
 */

import { prisma } from '@/lib/db';
import { getGeminiApiKey } from '@/lib/ai-gemini';

export interface FollowUpDraftResult {
  offerId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  daysWaiting: number;
  totalPriceCz: number;
  isDraft: true;
}

export async function generateFollowUpDraft(
  offerId: string,
  organizationId: string
): Promise<FollowUpDraftResult | null> {
  const offer = await prisma.offer.findFirst({
    where: { id: offerId, organizationId },
    include: {
      client: {
        include: {
          contacts: {
            where: { active: true },
            orderBy: [{ isPrimary: 'desc' }, { isCommercial: 'desc' }],
            take: 1,
          },
        },
      },
      items: {
        include: {
          surface: {
            include: {
              carrier: { select: { name: true, city: true } },
            },
          },
        },
        take: 5,
      },
    },
  });

  if (!offer || !offer.client) {
    return null;
  }

  const primaryContact = offer.client.contacts[0];
  const recipientEmail = primaryContact?.email || offer.contactEmail || offer.client.email || '';
  const recipientName = primaryContact
    ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim()
    : offer.contactPerson || offer.client.name;

  const now = new Date();
  const daysWaiting = offer.sentAt
    ? Math.max(1, Math.floor((now.getTime() - offer.sentAt.getTime()) / 86400000))
    : 5;
  const totalPriceCz = Number(offer.totalPrice || 0);

  const surfaceNames = offer.items
    .map((item) => item.surface?.carrier?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  const defaultSubject = `Navázání na nabídku: ${offer.title}`;
  const defaultBody = `Dobrý den, ${recipientName},\n\nnavazuji na naši nabídku „${offer.title}“${
    surfaceNames ? ` pro reklamní plochy (${surfaceNames})` : ''
  }, kterou jsme Vám zaslali před ${daysWaiting} dny.\n\nRádi bychom se zeptali, zda jste měli možnost se na návrh podívat a zda k němu máte nějaké doplňující dotazy či připomínky k termínům nebo výběru lokalit.\n\nRezervaci ploch máme pro Vás prozatím připravenou. Budu moc rád za Vaši krátkou zprávu, jak se situace vyvíjí.\n\nS přátelským pozdravem,\nObchodní tým SeePOINT`;

  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey.startsWith('sk-')) {
    return {
      offerId: offer.id,
      recipientEmail,
      recipientName,
      subject: defaultSubject,
      body: defaultBody,
      daysWaiting,
      totalPriceCz,
      isDraft: true,
    };
  }

  try {
    const prompt = `Jsi profesionální asistent obchodníka SeePoint OS pro venkovní reklamu.
Napiš zdvořilý, stručný a personalizovaný follow-up e-mail pro klienta.

Parametry nabídky:
- Klient: ${offer.client.name}
- Oslovení: ${recipientName}
- Název nabídky: ${offer.title}
- Hodnota nabídky: ${totalPriceCz.toLocaleString('cs-CZ')} Kč
- Ploch / lokalit: ${surfaceNames || 'venkovní reklamní plochy'}
- Doba od odeslání: před ${daysWaiting} dny

Požadavky:
- Žádný agresivní nátlak, profesionální a vstřícný tón.
- Zeptej se na stav rozhodnutí a nabídni případné zodpovězení dotazů nebo úpravu lokalit.
- Výstup vrať přesně ve formátu:
PŘEDMĚT: <předmět>
TĚLO:
<text e-mailu>`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 350 },
        }),
      }
    );

    if (res.ok) {
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text && text.includes('PŘEDMĚT:') && text.includes('TĚLO:')) {
        const subjectMatch = text.match(/PŘEDMĚT:\s*(.+)/);
        const bodyMatch = text.match(/TĚLO:\s*([\s\S]+)/);
        return {
          offerId: offer.id,
          recipientEmail,
          recipientName,
          subject: subjectMatch?.[1]?.trim() || defaultSubject,
          body: bodyMatch?.[1]?.trim() || defaultBody,
          daysWaiting,
          totalPriceCz,
          isDraft: true,
        };
      }
    }

    return {
      offerId: offer.id,
      recipientEmail,
      recipientName,
      subject: defaultSubject,
      body: defaultBody,
      daysWaiting,
      totalPriceCz,
      isDraft: true,
    };
  } catch {
    return {
      offerId: offer.id,
      recipientEmail,
      recipientName,
      subject: defaultSubject,
      body: defaultBody,
      daysWaiting,
      totalPriceCz,
      isDraft: true,
    };
  }
}
