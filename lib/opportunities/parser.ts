import type { OpportunityEventType } from '@prisma/client';
import type { CreateOpportunityInput } from './types';

export type ParsedOpportunityResult = CreateOpportunityInput & {
  isRelevant: boolean;
  relevanceReason?: string;
};

export async function parseOpportunityFromAiInput(
  rawInput: string,
  urlHint?: string
): Promise<ParsedOpportunityResult> {
  const rawKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  const rawOpenAiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  const apiKey = rawKey ? rawKey.replace(/[^\x20-\x7E]/g, '').replace(/["']/g, '').trim() : '';
  const openAiKey = rawOpenAiKey ? rawOpenAiKey.replace(/[^\x20-\x7E]/g, '').replace(/["']/g, '').trim() : '';
  const effectiveOpenAiKey = apiKey.startsWith('sk-') ? apiKey : openAiKey;
  const effectiveGeminiKey = apiKey.startsWith('sk-') ? '' : apiKey;

  let pageContent = rawInput.trim();
  let pageTitle = urlHint ? `Článek z ${new URL(urlHint).hostname}` : 'Manuální vložení zprávy';

  // If a URL was provided, attempt to fetch its text content if it starts with http
  if (urlHint && (urlHint.startsWith('http://') || urlHint.startsWith('https://'))) {
    try {
      const res = await fetch(urlHint, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SeePointBot/1.0' } });
      if (res.ok) {
        const text = await res.text();
        const titleMatch = text.match(/<title>(.*?)<\/title>/i);
        if (titleMatch?.[1]) pageTitle = titleMatch[1].trim();
        const bodyText = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 4000);
        if (bodyText.length > 200) {
          pageContent = bodyText;
        }
      }
    } catch {
      // Fallback to rawInput text
    }
  }

  const promptText = `Jsi AI Obchodní radar pro českou outdoorovou reklamní společnost SeePOINT (seepoint.cz).
Tvým úkolem je posoudit, zda text zprávy představuje REÁLNOU obchodní příležitost pro OOH reklamu (např. otevření konkrétní nové prodejny, pobočky, restaurace, autosalonu, stěhování firmy, kulturní/sportovní akce).

POZOR: Pokud jde o obecné novinové články (např. "Otevírací doba o svátcích", "Počasí v Ostravě", "Nehoda na dálnici"), zadej "isRelevant": false.

Vrať VÝHRADNĚ platný JSON (JSON format) s těmito poli:
{
  "isRelevant": true nebo false,
  "relevanceReason": "Stručný důvod relevance či nerelevance",
  "companyName": "Přesný konkrétní název firmy/značky nebo akce (NIDKY nepoužívej obecné fráze jako 'Nový potenciální klient')",
  "companyId": "IČO pokud je uvedeno, jinak null",
  "website": "webová stránka firmy pokud je známa, jinak null",
  "eventType": "NEW_BRANCH | STORE_OPENING | RESTAURANT_OPENING | CAR_DEALERSHIP | RETAIL_PARK | EXPANSION | RELOCATION | REOPENING | MARKETING_EVENT | SEASONAL_CAMPAIGN | OTHER",
  "title": "Stručný atraktivní titulek příležitosti (max 8 slov)",
  "summary": "Stručné shrnutí události (2-3 věty)",
  "city": "Město v ČR (např. Ostrava, Opava, Havířov, Frýdek-Místek)",
  "region": "Moravskoslezský kraj nebo jiný kraj v ČR",
  "address": "Přesná ulice/adresa pokud je známa, jinak null",
  "eventDate": "Datum otevření/události YYYY-MM-DD pokud je známo, jinak null",
  "suggestedMediaTypes": ["CITY_POSTER", "PROMO_BENCH", "NAVIGATION_SIGN"]
}

TEXT K ANALÝZE:
Title: "${pageTitle}"
Text: "${pageContent.slice(0, 3000)}"`;

  let jsonResultText = '';

  if (effectiveGeminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${effectiveGeminiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
      });
      if (resp.ok) {
        const data = await resp.json();
        jsonResultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    } catch {
      // Ignore API error
    }
  } else if (effectiveOpenAiKey) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveOpenAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: promptText }],
          response_format: { type: 'json_object' },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        jsonResultText = data.choices?.[0]?.message?.content || '';
      }
    } catch {
      // Ignore API error
    }
  }

  let parsed: Record<string, unknown> = {};
  if (jsonResultText) {
    try {
      const cleanJson = jsonResultText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      // Fallback
    }
  }

  const isRelevant = parsed.isRelevant === true && Boolean(parsed.companyName) && String(parsed.companyName).trim().toLowerCase() !== 'nový potenciální klient';
  const companyName = String(parsed.companyName || '').trim() || 'Nespecifikovaná firma';
  const city = String(parsed.city || '').trim() || 'Ostrava';
  const title = String(parsed.title || '').trim() || `Příležitost ${companyName}`;
  const summary = String(parsed.summary || '').trim() || pageTitle;
  const eventType = (['NEW_BRANCH', 'STORE_OPENING', 'RESTAURANT_OPENING', 'CAR_DEALERSHIP', 'RETAIL_PARK', 'EXPANSION', 'RELOCATION', 'REOPENING', 'MARKETING_EVENT', 'OTHER'].includes(String(parsed.eventType))
    ? parsed.eventType
    : 'NEW_BRANCH') as OpportunityEventType;

  return {
    isRelevant,
    relevanceReason: typeof parsed.relevanceReason === 'string' ? parsed.relevanceReason : undefined,
    companyName,
    companyId: typeof parsed.companyId === 'string' && parsed.companyId.trim() ? parsed.companyId.trim() : undefined,
    website: typeof parsed.website === 'string' && parsed.website.trim() ? parsed.website.trim() : undefined,
    eventType,
    title,
    summary,
    city,
    region: String(parsed.region || 'Moravskoslezský kraj').trim(),
    address: typeof parsed.address === 'string' && parsed.address.trim() ? parsed.address.trim() : undefined,
    eventDate: typeof parsed.eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.eventDate) ? parsed.eventDate : undefined,
    sourceUrl: urlHint || 'https://seepoint.cz',
    sourceTitle: pageTitle,
    sourcePublishedAt: new Date(),
    suggestedMediaTypes: Array.isArray(parsed.suggestedMediaTypes) ? (parsed.suggestedMediaTypes as string[]) : ['CITY_POSTER', 'PROMO_BENCH', 'NAVIGATION_SIGN'],
  };
}
