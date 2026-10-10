import { getGeminiApiKey } from '@/lib/ai-gemini';
import { prisma } from '@/lib/db';
import type { CurrentUser } from '@/lib/rbac';
import { OfferValidationError } from '@/lib/offers/domain';
import type { ProposalBenefit, ProposalCampaignPhase } from './presentation';

export type GeneratedOfferStrategy = {
  clientMessage: string;
  strategySummary: string;
  campaignPhases: ProposalCampaignPhase[];
  benefits: ProposalBenefit[];
};

export async function generateClientTailoredCopy(params: {
  clientName: string;
  clientSegment?: string | null;
  city?: string | null;
  campaignGoal?: string | null;
  mediaTypes: string[];
  carrierCount: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  days?: number;
  existingMessage?: string | null;
}): Promise<GeneratedOfferStrategy> {
  const {
    clientName,
    clientSegment = 'COMMERCIAL',
    city = 'regionu',
    campaignGoal,
    mediaTypes,
    carrierCount,
    dateFrom = '',
    dateTo = '',
    days = 30,
  } = params;

  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      const prompt = `Jsi seniorní commercial stratég a OOH copywriter české mediální agentury SeePOINT.
Máš za úkol vytvořit vysoce přesvědčivý a profesionální klientský text nabídky, strategické shrnutí, fáze kampaně a 6 klíčových přínosů pro konkrétního klienta.

KLIENT A ZADÁNÍ:
- Název klienta: ${clientName}
- Segment / obor: ${clientSegment}
- Cílové město / lokalita: ${city}
- Termín kampaně: ${dateFrom} až ${dateTo} (${days} dní)
- Cíl kampaně: ${campaignGoal || 'Posílení povědomí o nabídce a přímé oslovení zákazníků v lokalitě'}
- Vybrané nosiče a formáty: ${mediaTypes.join(', ') || 'venkovní reklamní plochy'} (${carrierCount} ploch)
${params.existingMessage ? `- Dosavadní text: ${params.existingMessage}` : ''}

PRAVIDLA PRO OBSAH:
1. PŘIZPŮSOB TEXT PŘÍMO OBORU A FIRMĚ ${clientName}:
   - Pokud je to kulturní dům, divadlo, festival nebo koncert: text musí mluvit o návštěvnosti programu, prodeji vstupenek a prestiži kulturní akce.
   - Pokud je to fitness, wellness nebo sportovní centrum: text musí mluvit o nových členech, zdravém životním stylu a lokální komunitě.
   - Pokud je to restaurace, obchod, autosalon nebo komerční služby: text musí mluvit o přílivu zákazníků, lokální dominanci a zvýšení obratu.
   - NIKDY nepředpokládej 'otevření nové pobočky (teaser / opening)', pokud klient vysloveně neotevírá nový provoz!
2. NIKDY nezmiňuj navigační tabule na sloupech VO, pokud nejsou v mediálním mixu.
3. Vrať POUZE validní JSON ve formátu:
{
  "clientMessage": "string (profesionální a zdvořilý průvodní dopis nabídky pro klienta, 2-3 odstavce)",
  "strategySummary": "string (strategické vysvětlení, proč je výběr těchto konkrétních pozic a formátů ideální pro klienta)",
  "campaignPhases": [
    {
      "phase": "LAUNCH | FREQUENCY | RETENTION | EVENT | TEASER | OPENING",
      "name": "string (název fáze/pilíře)",
      "timeframe": "string (časové vymezení)",
      "description": "string (popis přínosu této fáze)",
      "recommendedMediaTypes": ["string (formáty)"]
    }
  ],
  "benefits": [
    {
      "id": "reach | visibility | locations | traffic | brand | documentation",
      "icon": "reach | clock | pin | traffic | brand | camera",
      "title": "string (úderný název přínosu na míru)",
      "description": "string (1-2 věty vysvětlující konkrétní přínos pro firmu ${clientName})"
    }
  ]
}`;

      const models = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, response_mime_type: 'application/json' },
            }),
            signal: AbortSignal.timeout(18_000),
          });

          if (resp.ok) {
            const data = (await resp.json()) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            };
            const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textContent) {
              const parsed = JSON.parse(textContent) as {
                clientMessage?: string;
                strategySummary?: string;
                campaignPhases?: ProposalCampaignPhase[];
                benefits?: ProposalBenefit[];
              };

              if (parsed.clientMessage && parsed.strategySummary && Array.isArray(parsed.benefits)) {
                return {
                  clientMessage: parsed.clientMessage.trim(),
                  strategySummary: parsed.strategySummary.trim(),
                  campaignPhases: Array.isArray(parsed.campaignPhases) && parsed.campaignPhases.length > 0
                    ? parsed.campaignPhases
                    : fallbackPhases(campaignGoal, mediaTypes),
                  benefits: parsed.benefits.slice(0, 6).map((b) => ({
                    id: b.id || 'benefit',
                    icon: (['reach', 'clock', 'pin', 'traffic', 'brand', 'camera'].includes(b.icon) ? b.icon : 'brand') as ProposalBenefit['icon'],
                    title: b.title || 'Klíčový přínos',
                    description: b.description || 'Vysoká efektivita kampaně.',
                  })),
                };
              }
            }
          }
        } catch {
          // try next model
        }
      }
    } catch {
      // Deterministic fallback
    }
  }

  return generateDeterministicStrategy({
    clientName,
    city: city || 'regionu',
    campaignGoal,
    mediaTypes,
    carrierCount,
    days,
  });
}

function fallbackPhases(campaignGoal?: string | null, mediaTypes: string[] = []): ProposalCampaignPhase[] {
  const isOpening = /otevření|opening|otevíráme/i.test(campaignGoal || '');
  const isEvent = /akce|koncert|festival|divadlo|kultura|vstupenk/i.test(campaignGoal || '');

  if (isEvent) {
    return [
      {
        phase: 'EVENT',
        name: '1. Fáze: Zahájení předprodeje & Povědomí',
        timeframe: 'Zahájení kampaně',
        description: 'Představení programu a zahájení předprodeje na klíčových dopravních uzlech města.',
        recommendedMediaTypes: mediaTypes,
      },
      {
        phase: 'FREQUENCY',
        name: '2. Fáze: Hlavní vlna zájmu & Zásah publika',
        timeframe: 'Průběh kampaně',
        description: 'Vysoká vizuální frekvence v rezidenčních i nákupních zónách stimulující nákup vstupenek.',
        recommendedMediaTypes: mediaTypes,
      },
      {
        phase: 'RETENTION',
        name: '3. Fáze: Finální výzva k návštěvě (Last Call)',
        timeframe: 'Týdny před akcí',
        description: 'Závěrečné připomenutí termínu a vyprodání kapacity akce.',
        recommendedMediaTypes: mediaTypes,
      },
    ];
  }

  if (isOpening) {
    return [
      {
        phase: 'TEASER',
        name: '1. Fáze: Před-otvírací kampaň (Teaser)',
        timeframe: '2–3 týdny před otevřením',
        description: 'Budování povědomí o značce a vyvolání prvotního zájmu obyvatel a řidičů v širším okolí.',
        recommendedMediaTypes: mediaTypes,
      },
      {
        phase: 'OPENING',
        name: '2. Fáze: Slavnostní otevření (Grand Opening)',
        timeframe: 'Týden otevření a start',
        description: 'Maximální vizuální dominance na příjezdových tazích a klíčových křižovatkách města.',
        recommendedMediaTypes: mediaTypes,
      },
      {
        phase: 'RETENTION',
        name: '3. Fáze: Stabilizace a retence zákazníků',
        timeframe: 'Následné období kampaně',
        description: 'Upevnění nákupního návyku zákazníků v rezidenčních i spádových zónách.',
        recommendedMediaTypes: mediaTypes,
      },
    ];
  }

  return [
    {
      phase: 'LAUNCH',
      name: '1. Fáze: Pokrytí klíčových dopravních tahů',
      timeframe: 'Zahájení kampaně',
      description: 'Okamžitý zásah cílové skupiny na hlavních příjezdových komunikacích a klíčových uzlech města.',
      recommendedMediaTypes: mediaTypes,
    },
    {
      phase: 'FREQUENCY',
      name: '2. Fáze: Budování frekvence a povědomí',
      timeframe: 'Průběh hlavní kampaně',
      description: 'Opakovaný vizuální kontakt v rezidenčních i nákupních zónách upevňuje povědomí o značce.',
      recommendedMediaTypes: mediaTypes,
    },
    {
      phase: 'RETENTION',
      name: '3. Fáze: Dlouhodobý dopad a stabilizace',
      timeframe: 'Závěr kampaně a stabilizace',
      description: 'Stabilní přítomnost v myslích zákazníků pro dlouhodobou podporu návštěvnosti a prodejů.',
      recommendedMediaTypes: mediaTypes,
    },
  ];
}

function generateDeterministicStrategy(params: {
  clientName: string;
  city: string;
  campaignGoal?: string | null;
  mediaTypes: string[];
  carrierCount: number;
  days: number;
}): GeneratedOfferStrategy {
  const { clientName, city, campaignGoal, mediaTypes, carrierCount, days } = params;

  const isEvent = /akce|koncert|festival|divadlo|kultura|vstupenk|akord/i.test(`${clientName} ${campaignGoal || ''}`);
  const isFitness = /fit|gym|sport|wellness|bazen|hala/i.test(`${clientName} ${campaignGoal || ''}`);

  let clientMessage = `Dobrý den,\n\npředkládáme Vám strategický návrh venkovní reklamní kampaně pro společnost ${clientName} v lokalitě ${city}.\n\nNávrh zahrnuje ${carrierCount} pečlivě prověřených reklamních ploch v celkové délce ${days} dní. Pozice byly vybrány s důrazem na maximální viditelnost, hustotu dopravy a přirozenou spádovost k vaší cílové skupině.\n\nVšechny plochy jsou v požadovaném termínu volné a připravené k okamžité rezervaci. V případě dotazů jsme Vám plně k dispozici.`;

  let strategySummary = `Navržený výběr ploch v lokalitě ${city} zajišťuje optimální poměr mezi okamžitým zásahem na hlavních tazích a dlouhodobou frekvencí kontaktů v rezidenčních i komerčních zónách.`;

  if (isEvent) {
    clientMessage = `Dobrý den,\n\npředkládáme Vám návrh OOH kampaně pro ${clientName} v ${city}. Cílem kampaně je maximální podpora návštěvnosti a prodeje vstupenek na připravovaný program.\n\nVybrané reklamní plochy (${carrierCount} pozic) pokrývají frekventované dopravní tepny i pěší trasy v klíčových spádových oblastech. Formáty zajišťují vysokou čitelnost vizuálu i při rychlém průjezdu vozidel.\n\nPlochy jsou v termínu rezervovatelné a připravené k realizaci na klíč.`;
    strategySummary = `Strategie je zacílena na kombinaci okamžitého oznámení programu na příjezdových uzlech v ${city} s následným budováním nákupního impulsu pro pořízení vstupenek v rezidenčních čtvrtích.`;
  } else if (isFitness) {
    clientMessage = `Dobrý den,\n\npředkládáme Vám návrh kampaně pro ${clientName} v ${city}. Kampaň je navržena pro aktivní oslovení nových zájemců a posílení povědomí o vašich službách v přirozené spádové oblasti.\n\nVybrali jsme ${carrierCount} atraktivních nosičů na frekventovaných tazích s vysokým denním zásahem aktivní populace.`;
  }

  const benefits: ProposalBenefit[] = isEvent ? [
    { id: 'reach', icon: 'reach', title: 'Maximální zájem o program', description: `Intenzivní oslovení obyvatel v ${city} a okolí pro zajištění vysoké návštěvnosti vašich akcí.` },
    { id: 'visibility', icon: 'clock', title: 'Nepřetržitá viditelnost 24/7', description: 'Vaše pozvánka na program působí ve veřejném prostoru nonstop ve dne i v noci.' },
    { id: 'locations', icon: 'pin', title: 'Klíčové spádové zóny', description: `Umístění na hlavních tazích, ze kterých přirozeně proudí návštěvníci do ${clientName}.` },
    { id: 'traffic', icon: 'traffic', title: 'Vysokofrekvenční uzly', description: 'Světelné křižovatky a zastávky s dlouhým vizuálním kontaktem pro čitelnost programu.' },
    { id: 'brand', icon: 'brand', title: 'Prestižní kulturní prezentace', description: 'Velkoformátová prezentace podtrhuje vysokou úroveň a tradici pořádaných akcí.' },
    { id: 'documentation', icon: 'camera', title: 'Kompletní servis & fotoreport', description: 'Zajištění tisku, instalace plakátů a detailní fotografický reporting provedení.' },
  ] : [
    { id: 'reach', icon: 'reach', title: 'Vysoký zásah a frekvence', description: `Plochy na klíčových dopravních tepnách v ${city} denně oslovují desetitisíce řidičů a cestujících.` },
    { id: 'visibility', icon: 'clock', title: 'Nepřetržitá viditelnost 24/7', description: 'Vaše sdělení působí ve veřejném prostoru nonstop bez možnosti reklamu přeskočit.' },
    { id: 'locations', icon: 'pin', title: 'Strategické spádové zóny', description: `Umístění v přirozených nákupních i rezidenčních zónách s vysokou afinitou pro ${clientName}.` },
    { id: 'traffic', icon: 'traffic', title: 'Dopravní uzly & křižovatky', description: 'Pozice s dlouhou dobou vizuálního kontaktu u světelných křižovatek a kruhových objezdů.' },
    { id: 'brand', icon: 'brand', title: 'Budování silné značky', description: `Velkoformátová prezentace posiluje důvěryhodnost a povědomí o společnosti ${clientName}.` },
    { id: 'documentation', icon: 'camera', title: 'Kompletní servis & fotoreport', description: 'Realizace na klíč od tisku po precizní montáž a protokolární fotodokumentaci výlepu.' },
  ];

  return {
    clientMessage,
    strategySummary,
    campaignPhases: fallbackPhases(campaignGoal, mediaTypes),
    benefits,
  };
}

export async function applyAiCopy(user: CurrentUser, offerId: string): Promise<GeneratedOfferStrategy> {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      client: true,
      items: {
        include: {
          surface: {
            include: {
              carrier: true,
            },
          },
        },
      },
    },
  });

  if (!offer) {
    throw new OfferValidationError('Nabídka nebyla nalezena.', 'NOT_FOUND');
  }

  const cities = Array.from(new Set(offer.items.map((i) => i.surface.carrier.city).filter(Boolean)));
  const mediaTypes = Array.from(new Set(offer.items.map((i) => i.surface.mediaType).filter(Boolean)));

  const dateFrom = offer.items[0]?.dateFrom ? new Date(offer.items[0].dateFrom).toLocaleDateString('cs-CZ') : '';
  const dateTo = offer.items[0]?.dateTo ? new Date(offer.items[0].dateTo).toLocaleDateString('cs-CZ') : '';
  const days = offer.items[0]?.dateFrom && offer.items[0]?.dateTo
    ? Math.max(1, Math.round((new Date(offer.items[0].dateTo).getTime() - new Date(offer.items[0].dateFrom).getTime()) / 86400000))
    : 30;

  const generated = await generateClientTailoredCopy({
    clientName: offer.client.name,
    clientSegment: offer.pricingSegment,
    city: cities.join(', ') || 'ČR',
    campaignGoal: offer.campaignGoal,
    mediaTypes,
    carrierCount: offer.items.length,
    dateFrom,
    dateTo,
    days,
    existingMessage: offer.clientMessage,
  });

  const existingStrategy = (offer.campaignStrategy && typeof offer.campaignStrategy === 'object' && !Array.isArray(offer.campaignStrategy))
    ? (offer.campaignStrategy as Record<string, unknown>)
    : {};

  await prisma.$transaction([
    prisma.offer.update({
      where: { id: offerId },
      data: {
        clientMessage: generated.clientMessage,
        campaignStrategy: {
          ...existingStrategy,
          summary: generated.strategySummary,
          city: cities.join(', ') || offer.client.name,
          recommendedMediaTypes: mediaTypes,
          benefits: generated.benefits,
        },
        campaignPhases: generated.campaignPhases,
        updatedByUserId: user.id,
      },
    }),
    prisma.offerEvent.create({
      data: {
        offerId,
        organizationId: offer.organizationId,
        type: 'UPDATED',
        actorUserId: user.id,
        actorName: user.name,
        message: 'AI vygenerovala strategii a klientské texty na míru.',
        metadata: {
          event: 'AI_STRATEGY_GENERATED',
          clientName: offer.client.name,
        },
      },
    }),
  ]);

  return generated;
}
