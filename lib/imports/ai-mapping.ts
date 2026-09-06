import { cleanText, normalizeText } from '@/lib/carriers-2026/normalize';
import type { ColumnMappingProposal, SheetClassificationType, TransformRule } from './types';

export { TARGET_FIELDS_BY_ENTITY } from './types';

// Deterministic rule-based matching fallback
const KNOWN_COLUMN_PATTERNS: Array<{
  target: string;
  patterns: RegExp[];
  transform?: TransformRule;
}> = [
  { target: 'carrierCode', patterns: [/^(k[oó]d|č\.|č[ií]slo|id|k[oó]d\s*plochy|kod\s*nosi[cč]e|ozna[cč]en[ií])$/i, /carrier.*code/i] },
  { target: 'structureCode', patterns: [/st[ož]z[aá]r/i, /sloup/i, /stoziar/i] },
  { target: 'name', patterns: [/^(n[aá]zev|um[ií]st[eě]n[ií]|lokalita|popis\s*um[ií]st[eě]n[ií])$/i] },
  { target: 'city', patterns: [/^(m[eě]sto|obec|obec\s*\/\s*m[eě]sto|m[eě]sto\s*obec)$/i, /city/i] },
  { target: 'street', patterns: [/^(ulice|t[rř][ií]da)$/i, /street/i] },
  { target: 'address', patterns: [/^(adresa|cel[aá]\s*adresa)$/i, /address/i] },
  { target: 'locality', patterns: [/^(katastr|katastr[aá]ln[ií]\s*[uú]zem[ií]|m[eě]stsk[aá]\s*[cč][aá]st)$/i] },
  { target: 'gpsCoordinates', patterns: [/^gps$/i, /sou[rř]adnice/i, /poloha\s*gps/i], transform: 'COORDINATES_SPLIT' },
  { target: 'latitude', patterns: [/^(lat|latitude|[sš][ií][rř]ka|lan)$/i] },
  { target: 'longitude', patterns: [/^(lon|lng|longitude|d[eé]lka|lot)$/i] },
  { target: 'type', patterns: [/^(typ|typ\s*nosi[cč]e|druh|kategorie)$/i] },
  { target: 'mediaType', patterns: [/^(typ\s*reklamy|typ\s*m[eé]dia|form[aá]t)$/i] },
  { target: 'surfaceName', patterns: [/^(plocha|strana|pozice|n[aá]zev\s*plochy)$/i] },
  { target: 'sidePosition', patterns: [/^(strana\s*[ab]|pozice\s*[0-9])$/i] },
  { target: 'companyId', patterns: [/^(i[cč]o|i[cč])$/i] },
  { target: 'dic', patterns: [/^(di[cč])$/i] },
  { target: 'clientName', patterns: [/^(klient|z[aá]kazn[ií]k|inzerent|kone[cč]n[yý]\s*z[aá]kazn[ií]k|odb[eě]ratel|firma)$/i] },
  { target: 'campaignName', patterns: [/^(kampa[nň]|motiv|produkt|n[aá]zev\s*kampan[eě])$/i] },
  { target: 'dateFrom', patterns: [/^(od|platnost\s*od|za[cč][aá]tek|podn[aá]jem\s*od|pron[aá]jem\s*od)$/i], transform: 'DATE_ISO' },
  { target: 'dateTo', patterns: [/^(do|platnost\s*do|konec|podn[aá]jem\s*do|pron[aá]jem\s*do)$/i], transform: 'DATE_ISO' },
  { target: 'price', patterns: [/^(cena|n[aá]jem|cena\s*za\s*m[eě]s[ií]c|částka)$/i], transform: 'CURRENCY_CZK' },
  { target: 'rentalPrice', patterns: [/^(n[aá]jem|cena\s*n[aá]jmu)$/i], transform: 'CURRENCY_CZK' },
  { target: 'productionPrice', patterns: [/^(v[yý]roba|instalace|tisk|mont[aá][zž])$/i], transform: 'CURRENCY_CZK' },
  { target: 'photoUrl', patterns: [/^(foto|fotografie|odkaz\s*na\s*foto|photo|image|url\s*fotky)$/i] },
  { target: 'size', patterns: [/^(rozm[eě]r|rozm[eě]ry|velikost)$/i] },
  { target: 'note', patterns: [/^(pozn[aá]mka|pozn|intern[ií]\s*pozn[aá]mka)$/i] },
];

function ruleBasedColumnMatch(
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
    return { targetField: 'gpsCoordinates', confidence: 0.9, transformation: 'COORDINATES_SPLIT' };
  }

  // Is it IČO? e.g. 8 digits
  if (sampleValues.some((v) => /^\d{8}$/.test(v.trim()))) {
    return { targetField: 'companyId', confidence: 0.85, transformation: 'NONE' };
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

  if (normName.includes('cen') || normName.includes('price')) {
    return { classification: 'PRICES', confidence: 0.95 };
  }
  if (normName.includes('navig') || normHeaders.includes('stozar') || normHeaders.includes('sloup')) {
    return { classification: 'NAVIGATION', confidence: 0.92 };
  }
  if (normName.includes('klient') || normName.includes('zakaznik') || normName.includes('client')) {
    return { classification: 'CLIENTS', confidence: 0.92 };
  }
  if (normName.includes('obsazen') || normName.includes('kampan') || normName.includes('rezervac')) {
    return { classification: 'OCCUPANCY', confidence: 0.9 };
  }
  if (normHeaders.some((h) => h.includes('podnajem') || h.includes('mesic') || h.includes('leden'))) {
    return { classification: 'OCCUPANCY', confidence: 0.85 };
  }
  if (normName.includes('plocha') || normName.includes('surface') || normHeaders.includes('rozmer')) {
    return { classification: 'SURFACES', confidence: 0.85 };
  }
  if (normHeaders.some((h) => h.includes('gps') || h.includes('lat') || h.includes('adresa') || h.includes('mesto'))) {
    return { classification: 'CARRIERS', confidence: 0.85 };
  }

  return { classification: 'CARRIERS', confidence: 0.6 };
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
    const model = process.env.GEMINI_OPPORTUNITY_MODEL?.trim() || 'gemini-2.5-flash';
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
