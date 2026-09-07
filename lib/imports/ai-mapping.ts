import { cleanText, normalizeText } from '@/lib/carriers-2026/normalize';
import type { ColumnMappingProposal, SheetClassificationType, TransformRule } from './types';

export { TARGET_FIELDS_BY_ENTITY } from './types';

// Deterministic rule-based matching fallback
const KNOWN_COLUMN_PATTERNS: Array<{
  target: string;
  patterns: RegExp[];
  transform?: TransformRule;
}> = [
  // Specific multi-word or strong identifiers first:
  { target: 'campaignName', patterns: [/kampa[nň]/i, /motiv/i] },
  { target: 'clientName', patterns: [/inzerent/i, /klient/i, /z[aá]kazn[ií]k/i, /odb[eě]ratel/i] },
  { target: 'contactPerson', patterns: [/kontakt/i, /jméno/i] },
  { target: 'email', patterns: [/e-?mail/i, /po[sš]ta/i] },
  { target: 'phone', patterns: [/telefon/i, /mobil/i, /\btel\b/i, /gsm/i] },
  { target: 'companyId', patterns: [/\bi[cč]o\b/i, /\bi[cč]\b/i] },
  { target: 'dic', patterns: [/\bdi[cč]\b/i] },
  { target: 'gpsCoordinates', patterns: [/gps/i, /sou[rř]adnice/i, /poloha/i, /koordin/i], transform: 'COORDINATES_SPLIT' },
  { target: 'latitude', patterns: [/lat/i, /zem[eě]pisn[aá]\s*[sš][ií][rř]ka/i, /\b[sš][ií][rř]ka\b/i] },
  { target: 'longitude', patterns: [/l[on]g/i, /zem[eě]pisn[aá]\s*d[eé]lka/i, /\bd[eé]lka\b/i] },
  { target: 'dateFrom', patterns: [/\bod\b/i, /za[cč][aá]tek/i, /platnost\s*od/i, /podn[aá]jem\s*od/i, /datum\s*od/i], transform: 'DATE_ISO' },
  { target: 'dateTo', patterns: [/\bdo\b/i, /konec/i, /platnost\s*do/i, /podn[aá]jem\s*do/i, /datum\s*do/i], transform: 'DATE_ISO' },
  { target: 'rentalPrice', patterns: [/z[aá]kladn[ií]\s*m[eě]s[ií][cč]n[ií]\s*n[aá]jem/i, /n[aá]jem/i], transform: 'CURRENCY_CZK' },
  { target: 'productionPrice', patterns: [/v[yý]lep/i, /instalace/i, /v[yý]roba/i, /mont[aá][zž]/i], transform: 'CURRENCY_CZK' },
  { target: 'printPrice', patterns: [/tisk/i, /banner/i, /plak[aá]t/i], transform: 'CURRENCY_CZK' },
  { target: 'price', patterns: [/cena\s*\/\s*m[eě]s[ií]c/i, /cena/i, /cenn?[ií]k/i, /[cč][aá]stka/i], transform: 'CURRENCY_CZK' },
  { target: 'dimensions', patterns: [/rozm[eě]r/i, /velikost/i, /dimensions/i, /size/i] },
  { target: 'lighting', patterns: [/osv[eě]tlen/i, /sv[eě]tlo/i, /led/i, /lighting/i], transform: 'BOOLEAN_CZECH' },
  { target: 'carrierCode', patterns: [/eviden[cč]n[ií]/i, /k[oó]d.*nosi[cč]/i, /k[oó]d.*form[aá]t/i, /k[oó]d\s*plochy/i, /\b(k[oó]d|č\.|č[ií]slo|id)\b/i] },
  { target: 'carrierType', patterns: [/typ\s*m[eé]dia/i, /typ\s*nosi[cč]e/i, /typ\s*form[aá]tu/i, /kategorie/i, /\bform[aá]t\b/i] },
  { target: 'structureCode', patterns: [/st[ož]z[aá]r/i, /sloup/i, /stoziar/i] },
  { target: 'city', patterns: [/m[eě]sto/i, /obec/i, /city/i] },
  { target: 'street', patterns: [/ulice/i, /t[rř][ií]da/i, /street/i] },
  { target: 'address', patterns: [/adresa/i, /um[ií]st[eě]n[ií]/i] },
  { target: 'locality', patterns: [/katastr/i, /m[eě]stsk[aá]\s*[cč][aá]st/i] },
  { target: 'name', patterns: [/n[aá]zev/i, /lokalit/i, /popis/i] },
  { target: 'surfaceName', patterns: [/\b(plocha|strana|pozice)\b/i] },
  { target: 'sidePosition', patterns: [/strana\s*[ab]/i, /pozice\s*[0-9]/i] },
  { target: 'photoUrl', patterns: [/foto/i, /image/i, /photo/i, /obr[aá]zek/i] },
  { target: 'status', patterns: [/stav/i] },
  { target: 'note', patterns: [/pozn[aá]mk/i, /info/i] },
];

export function ruleBasedColumnMatch(
  header: string,
  sampleValues: string[]
): { targetField: string; confidence: number; transformation?: TransformRule } | null {
  const normHeader = normalizeText(header);

  // Check pattern matches
  for (const item of KNOWN_COLUMN_PATTERNS) {
    if (item.patterns.some((p) => p.test(normHeader) || p.test(header))) {
      return {
        targetField: item.target,
        confidence: 0.95,
        transformation: item.transform || 'NONE',
      };
    }
  }

  // Check sample value heuristics:
  // Is it coordinates? e.g. "49.832, 18.291"
  if (sampleValues.some((v) => /^\d{2}\.\d+[\s,;]+\d{2}\.\d+$/.test(v.trim()))) {
    return { targetField: 'gpsCoordinates', confidence: 0.95, transformation: 'COORDINATES_SPLIT' };
  }

  // Is it IČO? e.g. 8 digits
  if (sampleValues.some((v) => /^\d{8}$/.test(v.trim()))) {
    return { targetField: 'companyId', confidence: 0.9, transformation: 'NONE' };
  }

  // Is it photo url?
  if (sampleValues.some((v) => v.trim().startsWith('http://') || v.trim().startsWith('https://'))) {
    return { targetField: 'photoUrl', confidence: 0.9, transformation: 'NONE' };
  }

  return null;
}

export function classifySheetRuleBased(
  sheetName: string,
  headers: string[]
): { classification: SheetClassificationType; confidence: number } {
  const normName = normalizeText(sheetName);
  const normHeaders = headers.map(normalizeText);

  // 1. PRICES
  if (normName.includes('cen') || normName.includes('price')) {
    return { classification: 'PRICES', confidence: 0.95 };
  }
  // 2. CLIENTS
  if (
    normName.includes('klient') ||
    normName.includes('inzerent') ||
    normName.includes('zakaznik') ||
    normName.includes('client') ||
    normHeaders.some((h) => /\bi[cč]o\b/i.test(h))
  ) {
    return { classification: 'CLIENTS', confidence: 0.95 };
  }
  // 3. OCCUPANCY
  if (
    normName.includes('obsazen') ||
    normName.includes('kampan') ||
    normName.includes('rezervac') ||
    (normHeaders.some((h) => /\b(od|platnost\s*od|datum\s*od)\b/i.test(h)) &&
      normHeaders.some((h) => /\b(do|platnost\s*do|datum\s*do)\b/i.test(h)) &&
      !normHeaders.some((h) => h.includes('gps') || h.includes('lat') || h.includes('sirka')))
  ) {
    return { classification: 'OCCUPANCY', confidence: 0.95 };
  }
  // 4. NAVIGATION
  if (normName.includes('navig') || normHeaders.includes('stozar') || normHeaders.includes('sloup')) {
    return { classification: 'NAVIGATION', confidence: 0.95 };
  }
  // 5. CARRIERS (Carrier sheet with location/carriers)
  if (
    normName.includes('nosic') ||
    normName.includes('billboard') ||
    normName.includes('outdoor') ||
    normName.includes('reklam') ||
    normHeaders.some((h) =>
      h.includes('gps') ||
      h.includes('lat') ||
      h.includes('sirka') ||
      h.includes('adresa') ||
      h.includes('mesto') ||
      h.includes('obec') ||
      h.includes('evid') ||
      h.includes('lokalit')
    )
  ) {
    return { classification: 'CARRIERS', confidence: 0.95 };
  }
  // 6. SURFACES
  if (normName.includes('plocha') || normName.includes('surface') || normHeaders.includes('rozmer')) {
    return { classification: 'SURFACES', confidence: 0.9 };
  }

  return { classification: 'CARRIERS', confidence: 0.7 };
}

/**
 * AI-assisted sheet and column analysis using Gemini LLM
 */
export async function analyzeSheetWithAI(
  sheetName: string,
  headers: string[],
  sampleRows: Array<Record<string, string>>
): Promise<{
  classification: SheetClassificationType;
  confidence: number;
  columnMappings: ColumnMappingProposal[];
}> {
  // First, compute rule-based baseline
  const ruleClassification = classifySheetRuleBased(sheetName, headers);
  const ruleMappings: ColumnMappingProposal[] = headers.map((header) => {
    const samples = sampleRows.map((r) => r[header] || '').filter(Boolean).slice(0, 3);
    const matched = ruleBasedColumnMatch(header, samples);
    return {
      sourceColumn: header,
      targetField: matched ? matched.targetField : 'UNKNOWN',
      confidence: matched ? matched.confidence : 0.2,
      sampleValues: samples,
      transformation: matched?.transformation || 'NONE',
    };
  });

  const rawKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GEMINI_KEY ||
    process.env.GOOGLE_GEMINI_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  const apiKey = rawKey ? rawKey.replace(/[^\x20-\x7E]/g, '').replace(/["']/g, '').trim() : '';

  if (!apiKey || apiKey.startsWith('sk-')) {
    // Return deterministic rule-based result without AI
    return {
      classification: ruleClassification.classification,
      confidence: ruleClassification.confidence,
      columnMappings: ruleMappings,
    };
  }

  const prompt = `Jsi expert na venkovní reklamu (OOH - Out of Home advertising) a datovou analýzu pro platformu SeePoint OS.
Analyzuj strukturu tohoto listu z firemní tabulky outdoorové společnosti:

Název listu: "${sheetName}"
Sloupce v listu: ${JSON.stringify(headers)}
Vzorek dat (první řádky):
${JSON.stringify(sampleRows.slice(0, 4), null, 2)}

DOSTUPNÉ TYPY LISTŮ:
- "CARRIERS": Fyzické reklamní nosiče (kódy nosičů, adresy, GPS, města, typ konstrukce)
- "SURFACES": Reklamní plochy / strany nosičů (strany A/B, formáty, rozměry, ceny)
- "CLIENTS": Databáze inzerentů / klientů (názvy firem, IČO, kontakty)
- "OCCUPANCY": Plán obsazenosti, pronájmy, rezervace, kampaně
- "PRICES": Ceník reklamních ploch a produkčních prací
- "NAVIGATION": Navigační směrové tabule (VO sloupy, směry, popisy)
- "UNKNOWN": Pokud nelze určit

CÍLOVÁ DOMÉNOVÁ POLE PRO SLOUPCE:
- carrierCode, structureCode, name, city, street, address, locality, latitude, longitude, gpsCoordinates, type, mediaType, surfaceName, sidePosition, size, price, rentalPrice, productionPrice, clientName, companyId, dic, campaignName, dateFrom, dateTo, photoUrl, status, note, IGNORE

ÚKOL:
1. Urči typ listu (classification) a jistotu 0.0 - 1.0 (confidence).
2. Pro každý sloupec navrhni cílové doménové pole (targetField), jistotu 0.0 - 1.0 (confidence) a transformaci:
   - "COORDINATES_SPLIT" (pro sloučené GPS např. "49.8, 18.2")
   - "DATE_ISO" (pro datumy)
   - "CURRENCY_CZK" (pro částky v Kč)
   - "BOOLEAN_CZECH" (pro ANO/NE)
   - "NONE"

Vrať POUZE validní JSON v tomto přesném formátu bez markdownu:
{
  "classification": "CARRIERS",
  "confidence": 0.95,
  "mappings": [
    {
      "sourceColumn": "Název zdrojového sloupce",
      "targetField": "carrierCode",
      "confidence": 0.98,
      "transformation": "NONE"
    }
  ]
}`;

  try {
    const model = process.env.GEMINI_OPPORTUNITY_MODEL?.trim() || 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return {
        classification: ruleClassification.classification,
        confidence: ruleClassification.confidence,
        columnMappings: ruleMappings,
      };
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedJson = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);

    const aiClassification = (parsed.classification || ruleClassification.classification) as SheetClassificationType;
    const aiConfidence = Number(parsed.confidence) || ruleClassification.confidence;

    const mergedMappings: ColumnMappingProposal[] = headers.map((header) => {
      const samples = sampleRows.map((r) => r[header] || '').filter(Boolean).slice(0, 3);
      const aiMap = Array.isArray(parsed.mappings)
        ? parsed.mappings.find((m: any) => m.sourceColumn === header)
        : null;

      if (aiMap && aiMap.targetField) {
        return {
          sourceColumn: header,
          targetField: aiMap.targetField,
          confidence: Number(aiMap.confidence) || 0.8,
          sampleValues: samples,
          transformation: aiMap.transformation || 'NONE',
        };
      }

      const ruleMatch = ruleBasedColumnMatch(header, samples);
      return {
        sourceColumn: header,
        targetField: ruleMatch ? ruleMatch.targetField : 'UNKNOWN',
        confidence: ruleMatch ? ruleMatch.confidence : 0.2,
        sampleValues: samples,
        transformation: ruleMatch?.transformation || 'NONE',
      };
    });

    return {
      classification: aiClassification,
      confidence: aiConfidence,
      columnMappings: mergedMappings,
    };
  } catch (err) {
    console.warn('AI analysis fallback to rules:', err);
    return {
      classification: ruleClassification.classification,
      confidence: ruleClassification.confidence,
      columnMappings: ruleMappings,
    };
  }
}
