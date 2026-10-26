import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAIUsage } from '@/lib/ai-usage';
import { getGeminiApiKey } from '@/lib/ai-gemini';
import { enterTenantContext } from '@/lib/tenant-context';
import { DEFAULT_WORK_CATEGORIES } from '@/lib/work-categories';
import { getOrganizationSavedPlaces } from '@/lib/saved-places-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 40;

const PREFERRED_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];

export async function POST(request: Request) {
  try {
    const user = await requireApiAccess('work');
    if (isApiDenied(user)) return user;

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

    const timezone = body.timezone || 'Europe/Prague';
    const nowInTz = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const [employees, clients, savedPlaces] = await Promise.all([
      prisma.employee.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, firstName: true, lastName: true, position: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.client.findMany({
        where: { organizationId, active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 100,
      }),
      getOrganizationSavedPlaces(organizationId),
    ]);

    const employeeListStr = employees
      .map((e) => `- "${e.firstName} ${e.lastName}" (${e.position || 'Pracovník'})`)
      .join('\n');

    const clientListStr = clients.map((c) => `- "${c.name}" (ID: ${c.id})`).join('\n');

    const savedPlacesStr = savedPlaces
      .map(
        (p) =>
          `- Název: "${p.name}", Adresa: "${p.address}", GPS: [${p.latitude ?? 'null'}, ${p.longitude ?? 'null'}]${
            p.openingHours ? `, Otevírací doba: "${p.openingHours}"` : ''
          }${p.contactPhone ? `, Tel: "${p.contactPhone}"` : ''}${p.accessNote ? `, Poznámka: "${p.accessNote}"` : ''}`
      )
      .join('\n');

    const categoryListStr = DEFAULT_WORK_CATEGORIES.map(
      (c) => `- Klíč: "${c.key}", Název: "${c.label}", Typ práce: ${c.scope === 'WORKSHOP' ? 'DÍLNA / TISK (WORKSHOP)' : 'VÝJEZD / TERÉN (FIELD)'}`
    ).join('\n');

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini AI API klíč není nakonfigurován.' }, { status: 503 });
    }

    const stripDiacritics = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    const systemPrompt = `Jsi inteligentní asistent pro zadávání zakázek a plánování práce v reklamní a signmakingové agentuře (SeePOINT).
Dnešní datum v systému je: ${nowInTz}. Časová zóna: ${timezone}.

Tvým úkolem je porozumět zadání od vedoucího nebo dispečera (text nebo mluvená řeč) a převést ho na strukturovanou zakázku (WorkOrder) se všemi užitečnými detaily pro posádku.

DOSTUPNÉ KATEGORIE PRÁCE:
${categoryListStr}

DOSTUPNÍ PRACOVNÍCI:
${employeeListStr || 'Žádní zaměstnanci'}

DOSTUPNÍ KLIENTI:
${clientListStr || 'Žádní klienti'}

ULOŽENÁ ČASTÁ MÍSTA A PROVOZOVNY FIRMY (pokud zadání odpovídá některému z těchto míst, přednostně použij jeho uloženou adresu, GPS, otevírací dobu a telefon):
${savedPlacesStr || 'Zatím žádná uložená místa'}

PRAVIDLA PRO VYPLNĚNÍ A ODHADY ČASU:
1. "scope": Zda je to na firmě ("WORKSHOP" - tisk, laminace, DTP, řezaná grafika, kašírování, expedice) nebo výjezd ("FIELD" - polep výlohy, montáž banneru na fasádu, výlep, montáž tabulí u klienta, vyzvednutí plošiny či materiálu v terénu).
2. "categoryKey": Vyber nejvhodnější klíč z dostupných kategorií (např. PRINT, DTP, MANUFACTURE, FIELD_WRAPPING, FIELD_INSTALL, BILLBOARD_POSTING, atd.).
3. "title": Vytvoř výstižný, reprezentativní název zakázky (např. "Tisk 4× PVC banner 3×1 m – Kofola", "Polep dodávky Ford Transit – Stavomat", nebo při výjezdu do firmy/půjčovny např. "Vyzvednutí montážní plošiny – ČEVAS Sviadnov").
4. "clientName" a "clientId":
   - Pokud zadání zmiňuje existujícího klienta, spáruj s existujícím ID nebo uveď jeho název.
   - Pokud jde o výjezd do konkrétní firmy, dodavatele či půjčovny (např. půjčovna plošin ČEVAS group s.r.o. ve Sviadnově), uveď její oficiální název v "clientName".
   - Pokud jde o interní údržbu/práci pro vlastní firmu na dílně bez externího subjektu, nastav "isInternal": true.
5. "scheduledAt": Datum a čas zahájení práce (formát YYYY-MM-DDTHH:mm, např. "2026-10-27T08:00"). "dnes" = ${nowInTz}, "zítra" = den po dnešku, dny v týdnu dopočítej k nejbližšímu datu. Výchozí ranní čas je 08:00.
6. "deadlineAt": Termín dokončení (YYYY-MM-DDTHH:mm), pokud byl zmíněn, jinak null.
7. "estimatedHours": ODHAD ČASU V HODINÁCH (např. "1.5", "2", "4"):
   - Pokud uživatel čas přímo uvedl (např. "zabere to 3 hodiny"), použij jeho hodnotu.
   - POKUD ČAS NENÍ UVEDEN, AUTOMATICKY ODHADNI REÁLNÝ ČAS PODLE DRUHU PRÁCE:
     * DTP grafická příprava / úprava dat: "1" až "1.5"
     * Běžný tisk a laminace banneru / fólie: "1.5" až "2"
     * Výroba a kašírování desek / cedulí: "2" až "3"
     * Řezaná grafika a separace: "1"
     * Polep výlohy u klienta: "2.5" až "3.5"
     * Celopolep vozidla (Car Wrap): "6" až "8"
     * Částečný polep firemní dodávky (texty, logo): "3" až "4"
     * Montáž banneru na fasádu: "2" až "3"
     * Výlep 1 billboardu: "0.5" (30 min), více ks násob
     * Vyzvednutí plošiny / materiálu u dodavatele: "1" až "1.5"
     * Expedice a balení: "0.5" až "1"
8. "workerNames": Pole přesných jmen pracovníků z dostupného seznamu (i pokud byli v řeči zmíněni jen křestním jménem nebo ve skloňovaném tvaru, např. "s Pavlem" -> najdi odpovídajícího "Pavel ..." v seznamu).
9. "priority": "LOW" | "NORMAL" | "HIGH" | "URGENT" (pokud je zmíněno "spěchá", "urgentní", "ihned" -> URGENT / HIGH, jinak NORMAL).
10. "locationAddress", "latitude", "longitude" a UŽITEČNÉ DETAILY MÍSTA ("openingHours", "contactPhone", "contactName", "website", "accessNote"):
   - Pokud zadání zmiňuje jakékoliv místo výjezdu, firmu, prodejnu, stavebniny, půjčovnu nářadí/plošin, subdodavatele, adresu nebo město (např. "půjčovna ve Sviadnově", "zítra pojedu pro plošinu do sviadnova tam je půjčovna", "stavebniny DEK Ostrava"):
     * VŽDY aktivně použij Google Search nástroj k dohledání KONKRÉTNÍ firmy / provozovny v dané lokalitě. Např. pro "půjčovna ve Sviadnově" nebo "plošina Sviadnov" vyhledej specializovanou firmu a půjčovnu techniky/plošin ve Sviadnově (např. ČEVAS group s.r.o., Ostravská 51, 739 25 Sviadnov).
     * Zjisti její oficiální název, přesnou ulici s číslem popisným/orientačním, obec a PSČ (např. "Ostravská 51, 739 25 Sviadnov"), a přesné GPS souřadnice: "latitude" (číslo) a "longitude" (číslo).
     * Zjisti také praktické údaje o provozovně z webu/Google:
       - "openingHours": Otevírací doba provozovny (např. "Po–Pá 6:30–16:00, So–Ne zavřeno"), pokud je dohledatelná.
       - "contactPhone": Telefonní číslo na pobočku/recepci/půjčovnu (např. "+420 558 638 011") nebo telefon zmíněný v zadání.
       - "contactName": Jméno kontaktní osoby ze zadání nebo název oddělení/provozovny (např. "Půjčovna plošin ČEVAS Sviadnov").
       - "website": Oficiální web firmy/provozovny (např. "https://www.cevas.cz").
       - "accessNote": Praktické poznámky k přístupu, otevírací době, orientačnímu bodu, areálu nebo potřebnému vybavení (např. "Areál u hlavní tahu Ostravská, otevírací doba Po–Pá 6:30–16:00").
     * NIKDY nevracej pouze obecný název obce nebo souřadnice středu obce, pokud v obci existuje konkrétní hledaná provozovna/firma!
   - Pokud jde o interní práci na dílně bez výjezdu ("WORKSHOP" - tisk, laminace, balení) a žádné místo nebylo zmíněno, nastav "locationAddress": "", "latitude": null, "longitude": null.
11. "quantity": Počet kusů (číslo), pokud byl v zadání zmíněn konkrétní počet kusů (např. 4 bannery -> 4), jinak null.
12. "description": Jasné, stručné instrukce pro pracovníky, shrnující co a jak mají udělat (pokud jsi dohledal otevírací dobu nebo telefon/adresu provozovny, přehledně je uveď i na konci popisu).

Vrať VÝHRADNĚ platný JSON objekt:
{
  "title": string,
  "scope": "WORKSHOP" | "FIELD",
  "categoryKey": string,
  "clientName": string,
  "clientId": string | null,
  "isInternal": boolean,
  "scheduledAt": "YYYY-MM-DDTHH:mm",
  "deadlineAt": "YYYY-MM-DDTHH:mm" | null,
  "estimatedHours": string,
  "priority": "LOW" | "NORMAL" | "HIGH" | "URGENT",
  "workerNames": string[],
  "locationAddress": string,
  "latitude": number | null,
  "longitude": number | null,
  "contactName": string,
  "contactPhone": string,
  "openingHours": string,
  "website": string,
  "accessNote": string,
  "quantity": number | null,
  "description": string
}`;

    let parsed: {
      title?: string;
      scope?: 'WORKSHOP' | 'FIELD';
      categoryKey?: string;
      clientName?: string;
      clientId?: string | null;
      isInternal?: boolean;
      scheduledAt?: string;
      deadlineAt?: string | null;
      estimatedHours?: string;
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      workerNames?: string[];
      locationAddress?: string;
      latitude?: number | null;
      longitude?: number | null;
      contactName?: string;
      contactPhone?: string;
      openingHours?: string;
      website?: string;
      accessNote?: string;
      quantity?: number | null;
      description?: string;
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
        if (firstBrace !== -1 && lastBrace !== -1) {
          parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        } else {
          parsed = JSON.parse(cleaned);
        }

        if (parsed) {
          const lat = typeof parsed.latitude === 'number' && !Number.isNaN(parsed.latitude) ? parsed.latitude : null;
          const lng = typeof parsed.longitude === 'number' && !Number.isNaN(parsed.longitude) ? parsed.longitude : null;
          parsed.latitude = lat;
          parsed.longitude = lng;
        }

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
        console.warn(`Gemini model ${modelName} parsing work order failed:`, err);
      }
    }

    if (!parsed || !parsed.title) {
      return NextResponse.json(
        { error: 'AI se nepodařilo rozpoznat zakázku. Zkontrolujte zadání nebo vyplňte formulář ručně.' },
        { status: 422 }
      );
    }

    // Fuzzy match workerNames against organization employees so first names / inflected names always match
    if (Array.isArray(parsed.workerNames) && parsed.workerNames.length > 0 && employees.length > 0) {
      const matchedWorkers = new Set<string>();
      for (const rawName of parsed.workerNames) {
        if (typeof rawName !== 'string' || !rawName.trim()) continue;
        const normTarget = stripDiacritics(rawName);
        const exact = employees.find(
          (e) => stripDiacritics(`${e.firstName} ${e.lastName}`) === normTarget
        );
        if (exact) {
          matchedWorkers.add(`${exact.firstName} ${exact.lastName}`);
          continue;
        }
        const partial = employees.find((e) => {
          const fn = stripDiacritics(e.firstName);
          const ln = stripDiacritics(e.lastName);
          return (
            normTarget.includes(fn) ||
            normTarget.includes(ln) ||
            (fn.length >= 3 && normTarget.startsWith(fn.slice(0, -1)))
          );
        });
        if (partial) {
          matchedWorkers.add(`${partial.firstName} ${partial.lastName}`);
        }
      }
      parsed.workerNames = Array.from(matchedWorkers);
    }

    // Fuzzy match clientId if clientName matches an existing CRM client
    if (!parsed.clientId && parsed.clientName && clients.length > 0) {
      const normClient = stripDiacritics(parsed.clientName);
      const foundClient = clients.find(
        (c) =>
          stripDiacritics(c.name) === normClient ||
          (normClient.length >= 4 && stripDiacritics(c.name).includes(normClient))
      );
      if (foundClient) {
        parsed.clientId = foundClient.id;
      }
    }

    // Match saved places if prompt, clientName, or locationAddress references a saved frequent place
    if (savedPlaces.length > 0) {
      const normPrompt = stripDiacritics(prompt);
      const normClient = parsed.clientName ? stripDiacritics(parsed.clientName) : '';
      const normLoc = parsed.locationAddress ? stripDiacritics(parsed.locationAddress) : '';
      const matchedPlace = savedPlaces.find((sp) => {
        const normSpName = stripDiacritics(sp.name);
        if (normSpName.length < 3) return false;
        return (
          normPrompt.includes(normSpName) ||
          (normClient && (normClient.includes(normSpName) || normSpName.includes(normClient))) ||
          (normLoc && normLoc.includes(normSpName))
        );
      });
      if (matchedPlace) {
        if (!parsed.locationAddress && matchedPlace.address) {
          parsed.locationAddress = matchedPlace.address;
        }
        if (
          (parsed.latitude === null || parsed.longitude === null) &&
          typeof matchedPlace.latitude === 'number' &&
          typeof matchedPlace.longitude === 'number'
        ) {
          parsed.latitude = matchedPlace.latitude;
          parsed.longitude = matchedPlace.longitude;
        }
        if (!parsed.contactName && matchedPlace.contactName) {
          parsed.contactName = matchedPlace.contactName;
        }
        if (!parsed.contactPhone && matchedPlace.contactPhone) {
          parsed.contactPhone = matchedPlace.contactPhone;
        }
        if (!parsed.openingHours && matchedPlace.openingHours) {
          parsed.openingHours = matchedPlace.openingHours;
        }
        if (!parsed.website && matchedPlace.website) {
          parsed.website = matchedPlace.website;
        }
        if (!parsed.accessNote && matchedPlace.accessNote) {
          parsed.accessNote = matchedPlace.accessNote;
        }
      }
    }

    // Server-side geocoding fallback if locationAddress was found but coordinates are missing
    if (
      (parsed.latitude === null || parsed.longitude === null) &&
      typeof parsed.locationAddress === 'string' &&
      parsed.locationAddress.trim().length >= 3
    ) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=cz&q=${encodeURIComponent(
            parsed.locationAddress.trim()
          )}`,
          {
            headers: { 'User-Agent': 'SeePOINT-internal/1.0' },
            signal: AbortSignal.timeout(3500),
          }
        );
        if (geoRes.ok) {
          const geoRows = (await geoRes.json()) as Array<{ lat: string; lon: string }>;
          if (Array.isArray(geoRows) && geoRows[0]) {
            const lat = Number(geoRows[0].lat);
            const lng = Number(geoRows[0].lon);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              parsed.latitude = lat;
              parsed.longitude = lng;
            }
          }
        }
      } catch {
        // Ignore geocoding timeout; coordinates remain optional
      }
    }

    return NextResponse.json({ ok: true, data: parsed });
  } catch (error) {
    console.error('[ai/parse-work-order] Request failed:', error);
    return NextResponse.json({ error: 'Došlo k chybě při zpracování AI zadání.' }, { status: 500 });
  }
}
