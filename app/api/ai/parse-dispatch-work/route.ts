import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAIUsage } from '@/lib/ai-usage';
import { getGeminiApiKey } from '@/lib/ai-gemini';
import { enterTenantContext } from '@/lib/tenant-context';
import { getOrganizationSavedPlaces } from '@/lib/saved-places-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 40;

const PREFERRED_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];

export async function POST(request: Request) {
  try {
    const user = await requireApiAccess('work', 'workRoute');
    if (isApiDenied(user)) return user;
    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění používat AI dispečink.' }, { status: 403 });
    }

    const organizationId = user.organizationId!;
    enterTenantContext({ organizationId, userId: user.id, source: 'session' });

    const body = (await request.json().catch(() => ({}))) as {
      prompt?: string;
      timezone?: string;
    };

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json({ error: 'Zadejte nebo nadiktujte text zadání.' }, { status: 400 });
    }
    if (prompt.length > 5000) {
      return NextResponse.json({ error: 'Zadání je příliš dlouhé.' }, { status: 400 });
    }

    const timezone = body.timezone || 'Europe/Prague';
    const nowInTz = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const [employees, vehicles, savedPlaces] = await Promise.all([
      prisma.employee.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, firstName: true, lastName: true, position: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.vehicle.findMany({
        where: { organizationId, status: { notIn: ['SERVICE', 'OUT_OF_SERVICE'] } },
        select: { id: true, name: true, registrationNumber: true, type: true },
        orderBy: { name: 'asc' },
      }),
      getOrganizationSavedPlaces(organizationId),
    ]);

    const employeeListStr = employees
      .map((e) => `- ID: "${e.id}", Jméno: "${e.firstName} ${e.lastName}" (${e.position || 'Pracovník'})`)
      .join('\n');

    const vehicleListStr = vehicles
      .map((v) => `- ID: "${v.id}", Název: "${v.name}" (${v.type}, RZ: ${v.registrationNumber || 'bez RZ'})`)
      .join('\n');

    const savedPlacesStr = savedPlaces
      .map(
        (p) =>
          `- Název: "${p.name}", Adresa: "${p.address}", GPS: [${p.latitude ?? 'null'}, ${p.longitude ?? 'null'}]${
            p.openingHours ? `, Otevírací doba: "${p.openingHours}"` : ''
          }${p.contactPhone ? `, Tel: "${p.contactPhone}"` : ''}`
      )
      .join('\n');

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini AI API klíč není nakonfigurován.' }, { status: 503 });
    }

    const systemPrompt = `Jsi inteligentní dispečerský asistent pro plánování venkovní reklamy a terénních montáží (OOH).
Dnešní datum v systému je: ${nowInTz}. Časová zóna: ${timezone}.

Tvým úkolem je porozumět zadání od vedoucího nebo dispečera (často mluvený záznam nebo rychlá poznámka) a převést ho na strukturovanou práci pro dispečink.

DOSTUPNÉ TYPY OBJEKTŮ (objectType):
- "BILLBOARD" (Euroformát 5,1 × 2,4 m)
- "BIGBOARD" (Bigboard / Megaboard 9,6 × 3,6 m)
- "CITYLIGHT" (Citylight / CLV vitrína 118,5 × 175 cm)
- "BANNER" (Reklamní plachta / banner)
- "FACADE" (Fasáda / štít domu)
- "PLOT" (Plotová reklama)
- "BENCH" (Lavička)
- "CITY_POSTER" (Plakátovací plocha)
- "TOWER" (Reklamní věž)
- "MINI_TOWER" (Mini věž)
- "ACKO" (Áčko / stojan)
- "NAVIGATION" (Navigační směrovka VO)
- "NAVIGATION_SIGN" (Navigační tabule / pylon)
- "OTHER" (Jiné)

DOSTUPNÉ OPERACE (operation):
- "REPLACE_AD" (Výměna reklamy / plakátu / výlep / přelep) -> výchozí pro výlepy billboardů, plakátů!
- "INSTALL_AD" (Prvotní instalace reklamního materiálu)
- "INSTALL_OBJECT" (Montáž konstrukce / nového nosiče)
- "REMOVE_AD" (Stržení / odstranění reklamy)
- "REMOVE_OBJECT" (Demontáž konstrukce)
- "RELOCATION" (Přesun / stěhování)
- "REPAIR" (Oprava / servis)
- "INSPECTION" (Kontrola / fotodokumentace)
- "OTHER" (Jiné)

DOSTUPNÍ ZAMĚSTNANCI:
${employeeListStr || 'Žádní zaměstnanci'}

DOSTUPNÁ VOZIDLA:
${vehicleListStr || 'Žádná vozidla'}

ULOŽENÁ ČASTÁ MÍSTA FIRMY (pokud zadání odpovídá některému z těchto míst, použij jeho přesnou adresu, GPS, otevírací dobu a telefon):
${savedPlacesStr || 'Zatím žádná uložená místa'}

PRAVIDLA PRO PARSOVÁNÍ A VYHLEDÁNÍ FIREM / PROVOZOVEN (POI):
1. Datum ("date"): Pokud text říká "dnes", použij ${nowInTz}. Pokud "zítra", použij datum zítřka (YYYY-MM-DD). Pokud zazní den v týdnu (např. "ve středu"), dopočítej nejbližší příští daný den. Formát: YYYY-MM-DD.
2. Počet kusů ("quantity"): Vyhledej přesný počet kusů k lepení/montáži (např. 4 billboardy -> quantity: 4).
3. Čas ("serviceMinutes"): Pro výlep 1 billboardu počítej cca 25 minut (např. 4 billboardy = 100 min). Pro vyzvednutí plošiny/materiálu cca 30–45 minut.
4. Lokalita ("label", "addressSearch", "latitude", "longitude", "openingHours", "contactPhone"):
   - Pokud zadání zmiňuje firmu, půjčovnu plošin/techniky, stavebniny, prodejnu nebo orientační bod (např. "půjčovna ve Sviadnově", "ČEVAS Sviadnov", "Mustang Aréna"):
     * VŽDY aktivně použij Google Search k dohledání přesného názvu firmy, přesné ulice s číslem popisným a obcí (např. "Ostravská 51, 739 25 Sviadnov"), GPS souřadnic ("latitude" a "longitude"), případně otevírací doby ("openingHours") a telefonu ("contactPhone").
   - "label": Stručný lidský název místa a firmy (např. "ČEVAS Sviadnov – půjčovna plošin", "Mustang Aréna").
   - "addressSearch": Přesná dohledaná adresa včetně ulice, č.p. a města (např. "Ostravská 51, 739 25 Sviadnov").
5. Název zakázky ("title"): Vytvoř srozumitelný lidský název (např. "Výlep 4× Billboard – Mustang Aréna").
6. Pokyny ("description"): Stručné jasné instrukce pro kluky na výjezdu. Pokud jsi dohledal otevírací dobu nebo telefon provozovny, uveď je rovněž do popisu zastávky.

Vrať VÝHRADNĚ platný JSON objekt ve tvaru:
{
  "clientName": string,
  "date": "YYYY-MM-DD",
  "employeeId": string nebo null,
  "vehicleId": string nebo null,
  "title": string,
  "stops": [
    {
      "operation": "REPLACE_AD" | "INSTALL_AD" | "INSTALL_OBJECT" | "REMOVE_AD" | "REMOVE_OBJECT" | "RELOCATION" | "REPAIR" | "INSPECTION" | "OTHER",
      "objectType": "BILLBOARD" | "BIGBOARD" | "CITYLIGHT" | "BANNER" | "FACADE" | "PLOT" | "BENCH" | "CITY_POSTER" | "TOWER" | "MINI_TOWER" | "ACKO" | "NAVIGATION" | "NAVIGATION_SIGN" | "OTHER",
      "quantity": number,
      "label": string,
      "addressSearch": string,
      "latitude": number nebo null,
      "longitude": number nebo null,
      "openingHours": string nebo null,
      "contactPhone": string nebo null,
      "description": string,
      "serviceMinutes": number
    }
  ]
}
Vrať čisté JSON bez markdown backticků a bez zbytečného textu.`;

    let parsedResult: {
      clientName?: string;
      date?: string;
      employeeId?: string | null;
      vehicleId?: string | null;
      title?: string;
      stops?: Array<{
        operation?: string;
        objectType?: string;
        quantity?: number;
        label?: string;
        addressSearch?: string;
        description?: string;
        serviceMinutes?: number;
        latitude?: number | null;
        longitude?: number | null;
        openingHours?: string | null;
        contactPhone?: string | null;
      }>;
    } | null = null;

    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]);
    for (const modelName of PREFERRED_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\nZadání vedoucího:\n"${prompt}"` }] }],
              tools: [{ googleSearch: {} }],
              generationConfig: {
                temperature: 0.1,
              },
            }),
          }
        );

        if (!response.ok) continue;

        const data = await response.json();
        const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
          ? data.candidates[0].content.parts
          : [];
        const rawText = parts
          .map((p: { text?: string }) => (typeof p?.text === 'string' ? p.text : ''))
          .join('\n')
          .trim();
        if (!rawText) continue;

        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        parsedResult = JSON.parse(
          firstBrace !== -1 && lastBrace !== -1 ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned
        );

        await logAIUsage({
          organizationId,
          userId: user.id,
          modelName,
          feature: 'ASSISTANT',
          promptTokens: Math.ceil(prompt.length / 4),
          outputTokens: Math.ceil(rawText.length / 4),
        });
        break;
      } catch (err) {
        console.warn(`Gemini model ${modelName} parsing dispatch failed:`, err);
      }
    }

    if (!parsedResult || !Array.isArray(parsedResult.stops) || parsedResult.stops.length === 0) {
      return NextResponse.json(
        { error: 'AI se nepodařilo rozpoznat strukturu práce. Zkontrolujte zadání nebo zadejte údaje ručně.' },
        { status: 422 }
      );
    }

    // Geocode stops if latitude/longitude were not already resolved by Gemini Grounding
    for (const stop of parsedResult.stops) {
      const hasValidCoords =
        typeof stop.latitude === 'number' &&
        Number.isFinite(stop.latitude) &&
        typeof stop.longitude === 'number' &&
        Number.isFinite(stop.longitude);

      const extraDetails: string[] = [];
      if (stop.addressSearch?.trim()) extraDetails.push(`Adresa: ${stop.addressSearch.trim()}`);
      if (stop.openingHours?.trim()) extraDetails.push(`Otevírací doba: ${stop.openingHours.trim()}`);
      if (stop.contactPhone?.trim()) extraDetails.push(`Tel.: ${stop.contactPhone.trim()}`);
      if (extraDetails.length > 0) {
        const baseDesc = (stop.description || '').trim();
        const missingDetails = extraDetails.filter((d) => !baseDesc.includes(d));
        if (missingDetails.length > 0) {
          stop.description = [baseDesc, missingDetails.join(' · ')].filter(Boolean).join(' | ');
        }
      }

      if (!hasValidCoords) {
        const q = stop.addressSearch?.trim() || stop.label?.trim();
        if (q && q.length >= 3) {
          try {
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=cz&q=${encodeURIComponent(q)}`,
              {
                headers: { 'User-Agent': 'SeePOINT-internal/1.0' },
                signal: AbortSignal.timeout(3500),
              }
            );
            if (geoRes.ok) {
              const geoRows = (await geoRes.json()) as Array<{ lat: string; lon: string }>;
              if (Array.isArray(geoRows) && geoRows[0]) {
                stop.latitude = Number(geoRows[0].lat);
                stop.longitude = Number(geoRows[0].lon);
              }
            }
          } catch {
            // ignore geocoding timeout
          }
        }
      }
    }

    return NextResponse.json({ success: true, parsed: parsedResult });
  } catch (error) {
    console.error('Error in parse-dispatch-work:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Zpracování selhalo.' },
      { status: 500 }
    );
  }
}
