/**
 * AI Advertising Land Scout & Evaluator Service
 * Leverages Gemini/OpenAI models to suggest high-potential private land plots for OOH advertising,
 * evaluate commercial visibility, and draft owner acquisition pitches.
 */

export interface AiScoutedLocation {
  id: string;
  title: string;
  addressOrJunction: string;
  city: string;
  latitude: number;
  longitude: number;
  propertyType:
    | 'FIRST_CLASS_ROAD_CORRIDOR'
    | 'PRIVATE_COMMERCIAL'
    | 'RETAIL_PARK'
    | 'LOGISTICS_INDUSTRIAL'
    | 'GAS_STATION_SERVICES'
    | 'PRIVATE_INDIVIDUAL';
  propertyTypeLabel: string;
  trafficEstimate: string;
  visibilityScore: number; // 1 to 10
  recommendedCarrierType: string;
  estimatedMonthlyRentCzk: number;
  commercialRationale: string;
  acquisitionTip: string;
  roadProximityMeters?: string;
  visualAngle?: string;
  isExtremeProximity?: boolean;
}

export interface AiPlotAnalysis {
  overallScore: number; // 1 to 10
  trafficRating: 'EXTREME' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedCarrier: string;
  estimatedFairRentCzk: number;
  estimatedCampaignValueCzk: number;
  pros: string[];
  cons: string[];
  negotiationPoints: string[];
  outreachSubject: string;
  outreachLetterTemplate: string;
}

function getAiKeys() {
  const geminiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY ||
    ''
  ).replace(/[^\x20-\x7E]/g, '').replace(/["']/g, '').trim();

  const openAiKey = (process.env.OPENAI_API_KEY || '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["']/g, '')
    .trim();

  return { geminiKey, openAiKey };
}

/**
 * Rich regional presets for major Czech cities (used when offline or as immediate instant results)
 */
const REGIONAL_PRESETS: Record<string, AiScoutedLocation[]> = {
  ostrava: [
    {
      id: 'ova-i11-1',
      title: 'Rudná (silnice I/11) – křížení Frýdecká / Vratimov (soukromý areál)',
      addressOrJunction: 'Rudná (I/11) u sjezdu Frýdecká, Ostrava - Kunčice',
      city: 'Ostrava',
      latitude: 49.808142,
      longitude: 18.283120,
      propertyType: 'FIRST_CLASS_ROAD_CORRIDOR',
      propertyTypeLabel: '🛣️ Koridor I. třídy (I/11 Rudná) – soukromý pozemek',
      trafficEstimate: '42 000+ vozidel/den',
      visibilityScore: 9.8,
      recommendedCarrierType: 'Samostatný navigační sloupek (COLUMN) nebo pylon na soukromé parcele',
      estimatedMonthlyRentCzk: 4000,
      commercialRationale: 'Silnice I. třídy I/11 – reklama na sloupech VO je zákonem 13/1997 Sb. zakázána. Umístění samostatného navigačního sloupku na přilehlém soukromém pozemku u vjezdu do areálu je legální a nabízí mimořádný dosah pro navigaci zákazníků.',
      acquisitionTip: 'Oslovit majitele přilehlého komerčního areálu – zábor je jen 0,5 m² na patku sloupku, nabídnout pasivní příjem 4 000 Kč/měsíc.',
      roadProximityMeters: '4–7 m od krajnice I/11 (čelní plot u vjezdu)',
      visualAngle: 'Čelní nájezdový úhel, přímá linie pohledu 180 m bez clonění',
      isExtremeProximity: true,
    },
    {
      id: 'ova-i56-1',
      title: 'Místecká (silnice I/56) – sjezd Hrabůvka / Ostrava-Jih (čerpací stanice OMV)',
      addressOrJunction: 'Místecká (I/56) u sjezdu Dr. Martínka / Aviatiků, Ostrava - Hrabůvka',
      city: 'Ostrava',
      latitude: 49.789500,
      longitude: 18.261200,
      propertyType: 'FIRST_CLASS_ROAD_CORRIDOR',
      propertyTypeLabel: '🛣️ Koridor I. třídy (I/56 Místecká) – soukromý pozemek',
      trafficEstimate: '48 000+ vozidel/den',
      visibilityScore: 9.7,
      recommendedCarrierType: 'Navigační sloupek SeePOINT (mimo VO)',
      estimatedMonthlyRentCzk: 4500,
      commercialRationale: 'Páteřní rychlostní tah I/56 z Frýdku-Místku do centra. Komerční vjezd na soukromý pozemek přímo u sjezdové rampy zajišťuje vysoký čtecí čas.',
      acquisitionTip: 'Zdůraznit, že na silnici I. třídy nikdo jiný na sloupech VO reklamu mít nemůže, takže sloupek na soukromém pozemku je vysoce exkluzivní.',
      roadProximityMeters: '3–6 m od odbočovacího pruhu (čelo vjezdu stanice OMV)',
      visualAngle: 'Přední linie chodníku a vjezdu, perfektní viditelnost z aut sjíždějících z I/56',
      isExtremeProximity: true,
    },
    {
      id: 'ova-i11-2',
      title: 'Rudná (silnice I/11) – křižovatka Závodní / Vítkovice (pneuservis)',
      addressOrJunction: 'Rudná (I/11) / Závodní, Ostrava - Vítkovice',
      city: 'Ostrava',
      latitude: 49.805500,
      longitude: 18.259800,
      propertyType: 'FIRST_CLASS_ROAD_CORRIDOR',
      propertyTypeLabel: '🛣️ Koridor I. třídy (I/11 Rudná) – soukromý pozemek',
      trafficEstimate: '36 000+ vozidel/den',
      visibilityScore: 9.6,
      recommendedCarrierType: 'Navigační sloupek (COLUMN) pro navádění do zóny',
      estimatedMonthlyRentCzk: 3500,
      commercialRationale: 'Nájezdový roh na frekventovanou I/11, zpomalení dopravy před odbočením do Vítkovic a Zábřehu.',
      acquisitionTip: 'Nabídnout majiteli pneuservisu reciproční směrovou šipku na navigačním sloupku zdarma jako součást smlouvy.',
      roadProximityMeters: '4–8 m od krajnice I/11 (nájezdový roh pneuservisu)',
      visualAngle: 'Přímo v zorném poli řidičů brzdících před křižovatkou Závodní',
      isExtremeProximity: true,
    },
    {
      id: 'ova-i56-2',
      title: 'Mariánskohorská (I/56) – sjezd Cihelní / Hornopolní (areál autosalonu)',
      addressOrJunction: 'Mariánskohorská (I/56) u sjezdu Cihelní, Moravská Ostrava',
      city: 'Ostrava',
      latitude: 49.839200,
      longitude: 18.272100,
      propertyType: 'FIRST_CLASS_ROAD_CORRIDOR',
      propertyTypeLabel: '🛣️ Koridor I. třídy (I/56 Mariánskohorská) – soukromý pozemek',
      trafficEstimate: '39 000+ vozidel/den',
      visibilityScore: 9.5,
      recommendedCarrierType: 'Navigační sloupek / pylon na soukromém vjezdu',
      estimatedMonthlyRentCzk: 4200,
      commercialRationale: 'Čtyřproudý průtah s vysokou hustotou. Soukromý pozemek navazuje přímo na zpevněnou plochu mimo těleso vozovky.',
      acquisitionTip: 'Umístění do rohu oploceného areálu bez jakéhokoliv omezení manipulační plochy nebo vjezdu.',
      roadProximityMeters: '3–5 m od obrubníku (přední plot autosalonu u sjezdu)',
      visualAngle: 'Dlouhá pohledová rovina přes 200 m po Mariánskohorské',
      isExtremeProximity: true,
    },
    {
      id: 'ova-i11-3',
      title: 'I/11 Rudná / Opavská (Poruba – nájezd Svinov / Globus)',
      addressOrJunction: 'Opavská / Rudná (I/11), Ostrava - Poruba / Svinov',
      city: 'Ostrava',
      latitude: 49.827800,
      longitude: 18.192500,
      propertyType: 'FIRST_CLASS_ROAD_CORRIDOR',
      propertyTypeLabel: '🛣️ Koridor I. třídy (I/11 Opavská/Rudná) – soukromý pozemek',
      trafficEstimate: '44 000+ vozidel/den',
      visibilityScore: 9.6,
      recommendedCarrierType: 'Navigační sloupek mimo těleso silnice',
      estimatedMonthlyRentCzk: 4000,
      commercialRationale: 'Masivní dopravní uzel spojující Opavu, dálnici D1 a Ostravu. Ideální pro směrovou navigaci do areálů.',
      acquisitionTip: 'Dlouhodobá smlouva na 5 let s garancí pasivního výnosu a nulové administrativy.',
      roadProximityMeters: '5–8 m od tělesa křižovatky (roh vjezdu do nákupního areálu)',
      visualAngle: 'Čelní pohled pro oba směry Opava <-> Ostrava bez překážek',
      isExtremeProximity: true,
    },
    {
      id: 'ova-1',
      title: 'Komerční zóna Rudná – křížení s ul. Frýdecká',
      addressOrJunction: 'Rudná / Frýdecká (směr Havířov & Frýdek-Místek), Ostrava',
      city: 'Ostrava',
      latitude: 49.808142,
      longitude: 18.283120,
      propertyType: 'PRIVATE_COMMERCIAL',
      propertyTypeLabel: 'Soukromý komerční areál',
      trafficEstimate: '38 000+ vozidel/den',
      visibilityScore: 9.6,
      recommendedCarrierType: 'Bigboard 9,6 × 3,6 m (osvětlený)',
      estimatedMonthlyRentCzk: 6500,
      commercialRationale: 'Klíčová 4proudá spojnice Ostravy s Havířovem a dálnicí D56. Konstantní kolony v ranní i odpolední špičce, bez clonění stromy.',
      acquisitionTip: 'Oslovit majitele přilehlého autoservisu/areálu – nabídnout bezúdržbový pasivní příjem a garanci bezpečné instalace.',
    },
    {
      id: 'ova-2',
      title: 'Severní spoj – nájezd Místecká / Slovenská',
      addressOrJunction: 'ul. Místecká u sjezdu Přívoz / Vítkovice, Ostrava',
      city: 'Ostrava',
      latitude: 49.829150,
      longitude: 18.271500,
      propertyType: 'LOGISTICS_INDUSTRIAL',
      propertyTypeLabel: 'Průmyslový / skladový areál',
      trafficEstimate: '45 000+ vozidel/den',
      visibilityScore: 9.4,
      recommendedCarrierType: 'LED obrazovka nebo Bigboard 9,6 × 3,6 m',
      estimatedMonthlyRentCzk: 7500,
      commercialRationale: 'Páteřní severojižní tah Ostravou. Dlouhá pohledová rovina přes 350 metrů s přímým čelním úhlem na plot průmyslového dvora.',
      acquisitionTip: 'Argumentovat dlouhodobým stabilním nájmem na 3-5 let s indexací a SeePOINT pojištěním odpovědnosti.',
    },
    {
      id: 'ova-3',
      title: 'Kruhový objezd Makro / Tesco Hrabová',
      addressOrJunction: 'Krmelínská / Místecká, Ostrava - Hrabová',
      city: 'Ostrava',
      latitude: 49.774500,
      longitude: 18.258200,
      propertyType: 'RETAIL_PARK',
      propertyTypeLabel: 'Retail & Obchodní zóna',
      trafficEstimate: '26 000+ vozidel/den',
      visibilityScore: 9.1,
      recommendedCarrierType: 'Billboard 5,1 × 2,4 m (oboustranný)',
      estimatedMonthlyRentCzk: 4500,
      commercialRationale: 'Vysoká koncentrace bonitních nakupujících. Zpomalení vozidel před vjezdem na kruhový objezd zajišťuje maximální čtecí čas reklamy.',
      acquisitionTip: 'Rychlá domluva se správcem soukromého pozemku přilehlého parkoviště či technického zázemí.',
    },
    {
      id: 'ova-4',
      title: 'Mariánskohorská – vjezd do centra u Bauhausu',
      addressOrJunction: 'Mariánskohorská / Novoveská, Ostrava',
      city: 'Ostrava',
      latitude: 49.831200,
      longitude: 18.248300,
      propertyType: 'PRIVATE_COMMERCIAL',
      propertyTypeLabel: 'Areál hobby marketu / autosalon',
      trafficEstimate: '34 000+ vozidel/den',
      visibilityScore: 9.5,
      recommendedCarrierType: 'Bigboard 9,6 × 3,6 m',
      estimatedMonthlyRentCzk: 6000,
      commercialRationale: 'Hlavní spojnice z Poruby do centra Ostravy. Trvalý proud vozidel a vynikající úhel pohledu z mírného stoupání.',
      acquisitionTip: 'Nabídnout majiteli pozemku barterovou reklamu na SeePOINT síti pro zvýšení návštěvnosti jeho provozovny.',
    },
    {
      id: 'ova-5',
      title: 'Plzeňská – u Ostravar Arény / ČEZ Arény',
      addressOrJunction: 'Plzeňská / Závodní, Ostrava - Zábřeh',
      city: 'Ostrava',
      latitude: 49.804200,
      longitude: 18.251100,
      propertyType: 'GAS_STATION_SERVICES',
      propertyTypeLabel: 'Čerpací stanice / Pneuservis',
      trafficEstimate: '42 000+ vozidel/den',
      visibilityScore: 9.7,
      recommendedCarrierType: 'LED totem nebo Bigboard 9,6 × 3,6 m',
      estimatedMonthlyRentCzk: 8000,
      commercialRationale: 'Masivní denní provoz a statisíce návštěvníků sportovních i kulturních akcí v aréně. Široká světelná křižovatka s dlouhým stáním na červenou.',
      acquisitionTip: 'Oslovit majitele soukromé části pozemku podél plotu – nosič nezabere parkovací místa pro zákazníky.',
    },
    {
      id: 'ova-6',
      title: '17. listopadu – Poruba u VŠB-TUO',
      addressOrJunction: 'ul. 17. listopadu / Opavská, Ostrava - Poruba',
      city: 'Ostrava',
      latitude: 49.833500,
      longitude: 18.163200,
      propertyType: 'PRIVATE_COMMERCIAL',
      propertyTypeLabel: 'Komerční parter / soukromý pozemek',
      trafficEstimate: '29 000+ vozidel/den',
      visibilityScore: 9.2,
      recommendedCarrierType: 'Billboard 5,1 × 2,4 m nebo CLV panel',
      estimatedMonthlyRentCzk: 5000,
      commercialRationale: 'Centrum největšího ostravského obvodu. Hustá pěší i automobilová frekvence studentů a obyvatel Poruby.',
      acquisitionTip: 'Ideální formát pro prémiový eurobillboard nebo podsvícený citylight u vjezdu do areálu.',
    },
    {
      id: 'ova-7',
      title: 'Bohumínská – výpadovka na Karvinou',
      addressOrJunction: 'Bohumínská / Těšínská, Slezská Ostrava',
      city: 'Ostrava',
      latitude: 49.840200,
      longitude: 18.299500,
      propertyType: 'LOGISTICS_INDUSTRIAL',
      propertyTypeLabel: 'Stavebniny / velkoobchodní dvůr',
      trafficEstimate: '23 000+ vozidel/den',
      visibilityScore: 9.0,
      recommendedCarrierType: 'Billboard 5,1 × 2,4 m (oboustranný)',
      estimatedMonthlyRentCzk: 4000,
      commercialRationale: 'Tranzitní tah směr Bohumín a Polsko. Dlouhý rovný úsek s výbornou viditelností na plotový prostor skladového areálu.',
      acquisitionTip: 'Rychlé schválení se soukromým majitelem areálu bez nutnosti stavebního řízení pro lehký nosič.',
    },
    {
      id: 'ova-8',
      title: 'Výškovická – nákupní centrum Kotva',
      addressOrJunction: 'Výškovická / Čujkovova, Ostrava - Zábřeh',
      city: 'Ostrava',
      latitude: 49.791500,
      longitude: 18.232100,
      propertyType: 'RETAIL_PARK',
      propertyTypeLabel: 'Obchodní středisko / služby',
      trafficEstimate: '21 000+ vozidel/den',
      visibilityScore: 9.1,
      recommendedCarrierType: 'Billboard 5,1 × 2,4 m',
      estimatedMonthlyRentCzk: 4500,
      commercialRationale: 'Spádová nákupní lokalita celého sídliště Zábřeh a Výškovice. Pomalý průjezd vozidel a tramvajová křižovatka.',
      acquisitionTip: 'Předložit správci areálu referenční smlouvu SeePOINT s garantovanou čtvrtletní platbou předem.',
    },
  ],
  praha: [
    {
      id: 'prg-1',
      title: 'Průmyslová ulice – křižovatka Černokostelecká',
      addressOrJunction: 'Průmyslová / Černokostelecká, Praha 10 - Štěrboholy',
      city: 'Praha',
      latitude: 50.071200,
      longitude: 14.536100,
      propertyType: 'PRIVATE_COMMERCIAL',
      propertyTypeLabel: 'Soukromý areál / velkoobchod',
      trafficEstimate: '52 000+ vozidel/den',
      visibilityScore: 9.8,
      recommendedCarrierType: 'Bigboard 9,6 × 3,6 m (oboustranný)',
      estimatedMonthlyRentCzk: 12000,
      commercialRationale: 'Nejvytíženější nákladní a osobní tepna východní Prahy. Celodenní hustý provoz a světelné křižovatky s dlouhou čekací dobou.',
      acquisitionTip: 'Majitel soukromého pozemku získá měsíční nájemné přesahující 10 tis. Kč bez jakéhokoliv zásahu do svého provozu.',
    },
    {
      id: 'prg-2',
      title: 'Poděbradská / Kolbenova – Vysočany',
      addressOrJunction: 'Poděbradská poblíž Kbelské, Praha 9',
      city: 'Praha',
      latitude: 50.104500,
      longitude: 14.521800,
      propertyType: 'LOGISTICS_INDUSTRIAL',
      propertyTypeLabel: 'Skladový areál / autoservis',
      trafficEstimate: '34 000+ vozidel/den',
      visibilityScore: 9.2,
      recommendedCarrierType: 'Billboard 5,1 × 2,4 m nebo LED panel',
      estimatedMonthlyRentCzk: 8000,
      commercialRationale: 'Dynamicky rostoucí rezidenční a komerční čtvrť. Ploty podél silnice přímo lákají pro instalaci euroformátů.',
      acquisitionTip: 'Přímá domluva s místním servisem či velkoobchodem – SeePOINT garantuje převzetí veškeré byrokracie.',
    },
    {
      id: 'prg-3',
      title: 'Strakonická – výpadovka směr Příbram a Písek',
      addressOrJunction: 'Strakonická u Zbraslavi / Radotína, Praha 5',
      city: 'Praha',
      latitude: 49.981200,
      longitude: 14.391500,
      propertyType: 'PRIVATE_COMMERCIAL',
      propertyTypeLabel: 'Areál čerpací stanice / autosalón',
      trafficEstimate: '48 000+ vozidel/den',
      visibilityScore: 9.6,
      recommendedCarrierType: 'Bigboard 9,6 × 3,6 m',
      estimatedMonthlyRentCzk: 11000,
      commercialRationale: 'Masivní víkendový i denní tah z jižních Čech do metropole. Skvělá dálková viditelnost.',
      acquisitionTip: 'Využít nezastavěný pás u plotu, který majiteli negeneruje žádný zisk.',
    },
    {
      id: 'prg-4',
      title: 'Jižní spojka – nájezd Vídeňská / Kačerov',
      addressOrJunction: 'Jižní spojka u Kačerova, Praha 4',
      city: 'Praha',
      latitude: 50.038500,
      longitude: 14.461200,
      propertyType: 'LOGISTICS_INDUSTRIAL',
      propertyTypeLabel: 'Průmyslový a technický areál',
      trafficEstimate: '75 000+ vozidel/den',
      visibilityScore: 9.9,
      recommendedCarrierType: 'Megaboard nebo Bigboard 9,6 × 3,6 m',
      estimatedMonthlyRentCzk: 16000,
      commercialRationale: 'Jedna z nejfrekventovanějších dopravních tepen ve střední Evropě.',
      acquisitionTip: 'Dlouhodobý lukrativní kontrakt pro vlastníka pozemku.',
    },
  ],
  brno: [
    {
      id: 'brn-1',
      title: 'Vídeňská ulice – komerční uzel Horní Heršpice',
      addressOrJunction: 'Vídeňská / Kaštanová, Brno-jih',
      city: 'Brno',
      latitude: 49.162300,
      longitude: 16.602100,
      propertyType: 'PRIVATE_COMMERCIAL',
      propertyTypeLabel: 'Soukromý areál stavebnin / showroom',
      trafficEstimate: '41 000+ vozidel/den',
      visibilityScore: 9.7,
      recommendedCarrierType: 'Bigboard 9,6 × 3,6 m',
      estimatedMonthlyRentCzk: 9000,
      commercialRationale: 'Příjezdový koridor z Vídně a dálnice D1 do centra Brna. Enormní exponovanost.',
      acquisitionTip: 'Využít nezastavěný roh firemního pozemku k plotu, kde nosič nepřekáží vjezdu kamionů.',
    },
    {
      id: 'brn-2',
      title: 'Hradecká – výpadovka na Svitavy',
      addressOrJunction: 'Hradecká / Purkyňova, Brno - Královo Pole',
      city: 'Brno',
      latitude: 49.231200,
      longitude: 16.582400,
      propertyType: 'GAS_STATION_SERVICES',
      propertyTypeLabel: 'Služby / Čerpací stanice / Pneuservis',
      trafficEstimate: '36 000+ vozidel/den',
      visibilityScore: 9.3,
      recommendedCarrierType: 'Billboard 5,1 × 2,4 m',
      estimatedMonthlyRentCzk: 6000,
      commercialRationale: 'Denní dojíždění z Blanenska a Kuřimi do Technologického parku v Brně.',
      acquisitionTip: 'Nabídnout majiteli pozemku barterovou reklamu pro jeho vlastní provozovnu zdarma.',
    },
    {
      id: 'brn-3',
      title: 'Olomoucká – výpadovka na D1 a Vyškov',
      addressOrJunction: 'Olomoucká u Černovické terasy, Brno',
      city: 'Brno',
      latitude: 49.184500,
      longitude: 16.652100,
      propertyType: 'LOGISTICS_INDUSTRIAL',
      propertyTypeLabel: 'Logistické centrum / průmyslový park',
      trafficEstimate: '32 000+ vozidel/den',
      visibilityScore: 9.4,
      recommendedCarrierType: 'Bigboard 9,6 × 3,6 m (oboustranný)',
      estimatedMonthlyRentCzk: 7500,
      commercialRationale: 'Příjezd do největší brněnské průmyslové zóny Černovická terasa s desítkami tisíc zaměstnanců.',
      acquisitionTip: 'Využít oplocení soukromého areálu s přímým výhledem z dálničního přivaděče.',
    },
    {
      id: 'brn-4',
      title: 'Jihlavská – u Fakultní nemocnice Bohunice',
      addressOrJunction: 'Jihlavská / Kamenice, Brno - Bohunice',
      city: 'Brno',
      latitude: 49.172400,
      longitude: 16.571200,
      propertyType: 'RETAIL_PARK',
      propertyTypeLabel: 'Obchodní centrum Campus Square',
      trafficEstimate: '39 000+ vozidel/den',
      visibilityScore: 9.5,
      recommendedCarrierType: 'Billboard 5,1 × 2,4 m nebo LED panel',
      estimatedMonthlyRentCzk: 8000,
      commercialRationale: 'Kampus Masarykovy univerzity, FN Bohunice a nákupní centrum Campus. Koncentrovaná cílová skupina.',
      acquisitionTip: 'Oslovit soukromého vlastníka přilehlých komerčních prostor či parkoviště.',
    },
  ],
};

function generateExtendedPresetFallback(cityOrArea: string, count = 8, preferredFocus = 'ALL'): AiScoutedLocation[] {
  const norm = cityOrArea.trim().toLowerCase();
  for (const [key, list] of Object.entries(REGIONAL_PRESETS)) {
    if (norm.includes(key)) {
      let filtered = [...list];
      if (preferredFocus === 'FIRST_CLASS_ROAD' || preferredFocus === 'FIRST_CLASS_ROAD_CORRIDOR') {
        filtered.sort((a, b) => {
          const aMatch = a.propertyType === 'FIRST_CLASS_ROAD_CORRIDOR' ? 1 : 0;
          const bMatch = b.propertyType === 'FIRST_CLASS_ROAD_CORRIDOR' ? 1 : 0;
          return bMatch - aMatch;
        });
      } else if (preferredFocus !== 'ALL') {
        const matching = filtered.filter((item) => item.propertyType === preferredFocus);
        if (matching.length > 0) {
          filtered = [...matching, ...filtered.filter((item) => item.propertyType !== preferredFocus)];
        }
      }
      return filtered.slice(0, count);
    }
  }

  // Realistic generic suggestions for any Czech city
  const genericList: AiScoutedLocation[] = [
    {
      id: `gen-${Date.now()}-1`,
      title: `Silnice I. třídy – soukromý vjezd do areálu (${cityOrArea})`,
      addressOrJunction: `Koridor silnice I. třídy u vjezdu do komerční zóny, ${cityOrArea}`,
      city: cityOrArea,
      latitude: 49.820000,
      longitude: 18.260000,
      propertyType: 'FIRST_CLASS_ROAD_CORRIDOR',
      propertyTypeLabel: '🛣️ Koridor I. třídy – soukromý pozemek',
      trafficEstimate: '38 000+ vozidel/den',
      visibilityScore: 9.7,
      recommendedCarrierType: 'Samostatný navigační sloupek (COLUMN) mimo VO',
      estimatedMonthlyRentCzk: 4500,
      commercialRationale: 'Podél silnice I. třídy je reklama na sloupech VO zákonem zakázána. Umístění navigačního sloupku na přilehlém soukromém pozemku u sjezdu/vjezdu je plně legální a zajišťuje vysokou viditelnost.',
      acquisitionTip: 'Oslovit majitele komerčního areálu – zábor patky je minimální (cca 0,5 m²), pasivní příjem 4 500 Kč/měs.',
      roadProximityMeters: '3–6 m od krajnice I. třídy (čelní roh plotu u vjezdu)',
      visualAngle: 'Přímý čelní pohled 180 m bez clonění pro projíždějící vozy',
      isExtremeProximity: true,
    },
    {
      id: `gen-${Date.now()}-2`,
      title: `Hlavní vjezdový koridor a obchvat (${cityOrArea})`,
      addressOrJunction: `Výpadová silnice I. třídy u vjezdu do města, ${cityOrArea}`,
      city: cityOrArea,
      latitude: 49.820000,
      longitude: 18.260000,
      propertyType: 'PRIVATE_COMMERCIAL',
      propertyTypeLabel: 'Soukromý komerční areál / oplocení',
      trafficEstimate: '26 000+ vozidel/den',
      visibilityScore: 9.5,
      recommendedCarrierType: 'Bigboard 9,6 × 3,6 m (osvětlený)',
      estimatedMonthlyRentCzk: 5500,
      commercialRationale: 'Vysoká čelní viditelnost před vjezdem do města, dlouhý nájezdový úhel pro řidiče.',
      acquisitionTip: 'Oslovit majitele soukromého areálu na parcele – snadné schválení bez průtahů na zastupitelstvu obce.',
      roadProximityMeters: '6–10 m od krajnice',
      visualAngle: 'Čelní nájezdový úhel',
    },
    {
      id: `gen-${Date.now()}-3`,
      title: `Světelná křižovatka u retail zóny (${cityOrArea})`,
      addressOrJunction: `Křížení obchodní zóny a průtahu městem, ${cityOrArea}`,
      city: cityOrArea,
      latitude: 49.835000,
      longitude: 18.280000,
      propertyType: 'RETAIL_PARK',
      propertyTypeLabel: 'Obchodní a nákupní areál',
      trafficEstimate: '29 000+ vozidel/den',
      visibilityScore: 9.6,
      recommendedCarrierType: 'Billboard 5,1 × 2,4 m (oboustranný)',
      estimatedMonthlyRentCzk: 6000,
      commercialRationale: 'Zpomalení a stání vozidel na světlech zaručuje detailní zhlédnutí reklamního sdělení.',
      acquisitionTip: 'Navrhnout majiteli dlouhodobou nájemní smlouvu s pravidelnou čtvrtletní platbou předem.',
      roadProximityMeters: '5–8 m od obrubníku',
      visualAngle: 'Pohled přímo z čekající kolony na semaforech',
    },
    {
      id: `gen-${Date.now()}-4`,
      title: `Průmyslová zóna – plot logistického areálu (${cityOrArea})`,
      addressOrJunction: `Příjezdová komunikace k logistickému parku, ${cityOrArea}`,
      city: cityOrArea,
      latitude: 49.812000,
      longitude: 18.245000,
      propertyType: 'LOGISTICS_INDUSTRIAL',
      propertyTypeLabel: 'Průmyslový / skladový areál',
      trafficEstimate: '22 000+ vozidel/den',
      visibilityScore: 9.1,
      recommendedCarrierType: 'Bigboard 9,6 × 3,6 m',
      estimatedMonthlyRentCzk: 4500,
      commercialRationale: 'Trvalý proud zaměstnanců, dodavatelů a kamionové dopravy. Bezpečný odstup od silnice na soukromém pozemku.',
      acquisitionTip: 'Garantovat převzetí veškerého servisu a pojištění, nulové starosti pro správce areálu.',
    },
    {
      id: `gen-${Date.now()}-5`,
      title: `Areál čerpací stanice / pneuservisu (${cityOrArea})`,
      addressOrJunction: `Čerpací stanice u frekventovaného tahu, ${cityOrArea}`,
      city: cityOrArea,
      latitude: 49.825000,
      longitude: 18.291000,
      propertyType: 'GAS_STATION_SERVICES',
      propertyTypeLabel: 'Služby motoristům / čerpací stanice',
      trafficEstimate: '31 000+ vozidel/den',
      visibilityScore: 9.4,
      recommendedCarrierType: 'Billboard 5,1 × 2,4 m nebo LED totem',
      estimatedMonthlyRentCzk: 5000,
      commercialRationale: 'Pravidelný proud řidičů, kteří na místě tankují a mají čas vnímat reklamní plochu.',
      acquisitionTip: 'Možnost bezplatného umístění navigační směrovky pro majitele servisu na nosiči.',
    },
    {
      id: `gen-${Date.now()}-6`,
      title: `Kruhový objezd na obchvatu (${cityOrArea})`,
      addressOrJunction: `Okružní křižovatka na silnici I. třídy, ${cityOrArea}`,
      city: cityOrArea,
      latitude: 49.845000,
      longitude: 18.265000,
      propertyType: 'PRIVATE_COMMERCIAL',
      propertyTypeLabel: 'Soukromý pozemek u kruhového objezdu',
      trafficEstimate: '27 000+ vozidel/den',
      visibilityScore: 9.3,
      recommendedCarrierType: 'Billboard 5,1 × 2,4 m oboustranný',
      estimatedMonthlyRentCzk: 4800,
      commercialRationale: 'Zpomalení vozidel před kruhovým objezdem zaručuje prodloužený kontakt s reklamou.',
      acquisitionTip: 'Jednání přímo s majitelem přilehlé zahrady či dvora u obchvatu.',
      roadProximityMeters: '4–7 m od vnější hrany okruhu',
    },
    {
      id: `gen-${Date.now()}-7`,
      title: `Centrální městský koridor (${cityOrArea})`,
      addressOrJunction: `Páteřní městská třída, ${cityOrArea}`,
      city: cityOrArea,
      latitude: 49.832000,
      longitude: 18.272000,
      propertyType: 'PRIVATE_COMMERCIAL',
      propertyTypeLabel: 'Soukromá zástavba / obchodní dům',
      trafficEstimate: '24 000+ vozidel/den',
      visibilityScore: 9.2,
      recommendedCarrierType: 'CLV panel nebo štítová stěna',
      estimatedMonthlyRentCzk: 6500,
      commercialRationale: 'Vysoký podíl pěších i pomalé městské dopravy v centru.',
      acquisitionTip: 'Nabídnout majiteli moderní osvětlený nosič, který zlepší vzhled zanedbaného plotu.',
    },
  ];

  let list = genericList;
  if (preferredFocus === 'FIRST_CLASS_ROAD' || preferredFocus === 'FIRST_CLASS_ROAD_CORRIDOR') {
    list = [...genericList].sort((a, b) => {
      const aMatch = a.propertyType === 'FIRST_CLASS_ROAD_CORRIDOR' ? 1 : 0;
      const bMatch = b.propertyType === 'FIRST_CLASS_ROAD_CORRIDOR' ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  return list.slice(0, count);
}

/**
 * AI Scout for attractive advertising locations in a given city or region.
 * Returns requested number of strategic plots (default 8 to 12).
 */
export async function scoutAdvertisingLocationsAi(
  cityOrArea: string,
  preferredFocus = 'ALL',
  count = 8,
  offset = 0
): Promise<AiScoutedLocation[]> {
  const { geminiKey, openAiKey } = getAiKeys();

  // If no AI key configured, return our extended presets
  if (!geminiKey && !openAiKey) {
    const list = generateExtendedPresetFallback(cityOrArea, count + offset, preferredFocus);
    return list.slice(offset, offset + count);
  }

  const promptText = `Jsi špičkový expert na venkovní reklamu (OOH - Out-of-Home, billboardy, bigboardy, LED totemy, navigační sloupky) a akvizici pozemků v České republice pro SeePOINT.
Tvým úkolem je navrhnout PŘESNĚ ${count} konkrétních, vysoce lukrativních LOKALIT / SOUKROMÝCH POZEMKŮ pro umístění nových reklamních nosičů ve městě/lokalitě: "${cityOrArea}".
Zaměření vyhledávání: "${preferredFocus}".
Číslo stránky / posun (offset): ${offset}. Navrhni jiné různorodé tahy a křižovatky v různých čtvrtích města.

DŮLEŽITÁ PRAVIDLA PRO REKLAMNÍ POZEMKY:
1. Zaměř se prioritně na SOUKROMÉ POZEMKY (areály firem, autoservisy, stavebniny, logistické parky, čerpací stanice, soukromé oplocené dvory u frekventovaných silnic I. a II. třídy, křižovatek či obchvatů).
2. KRITICKÉ PRAVIDLO PRO SILNICE I. TŘÍDY ("FIRST_CLASS_ROAD"):
   U koridorů silnic I. třídy (např. I/11 Rudná, I/56 Místecká, I/58 Plzeňská) musí být pozemek v EXTRÉMNÍ BLÍZKOSTI k vozovce – odstup pouhých 3 až 10 metrů od krajnice (čelní plotová linie, roh komerčního vjezdu, začátek odbočovacího pruhu, okraj parkoviště sousedící s chodníkem/krajnicí).
   DŮVOD: Řidiči jedou 50–90 km/h a navigační sloupek (COLUMN) má menší formát písma než velkoplošný bigboard – řidič musí šipku i název firmy bezpečně přečíst během jízdy! Pozemky posunuté více než 12 metrů hluboko do areálu nebo kryté stromy/valy jsou pro navigace ZCELA NEPOUŽITELNÉ.
   U těchto položek nastav:
   - propertyType: "FIRST_CLASS_ROAD_CORRIDOR"
   - isExtremeProximity: true
   - roadProximityMeters: "např. 3–7 m od krajnice I/11 (čelní plot u vjezdu)"
   - visualAngle: "např. Přímý čelní pohled 180 m bez clonění z pravého pruhu"
   - recommendedCarrierType: "Navigační sloupek (COLUMN) – oboustranný"
3. Soukromé pozemky jsou pro SeePOINT mnohem lepší než městské, protože dohoda o nájmu je rychlá a přímá (nemusí se čekat na schválení rady obce a záměr §39).
4. U každé lokality uveď reálné přibližné GPS souřadnice odpovídající danému městu/lokalitě v ČR (WGS-84).
5. Odhadni férový měsíční nájem v CZK, který vyjednavač nabídne majiteli pozemku (obvykle 3 000 až 12 000 Kč/měsíc dle atraktivity).
6. Vrať celkem ${count} různých položek.

Odpověz VÝHRADNĚ jako validní JSON bez markdownu kolem (žádné \`\`\`json):
[
  {
    "id": "loc-${offset}-1",
    "title": "Stručný název lokality (např. Vjezdová komunikace - plot autoservisu)",
    "addressOrJunction": "Konkrétní ulice nebo křížení ulic",
    "city": "${cityOrArea}",
    "latitude": 49.123456,
    "longitude": 16.123456,
    "propertyType": "FIRST_CLASS_ROAD_CORRIDOR | PRIVATE_COMMERCIAL | RETAIL_PARK | LOGISTICS_INDUSTRIAL | GAS_STATION_SERVICES | PRIVATE_INDIVIDUAL",
    "propertyTypeLabel": "Popisek typu (např. 🛣️ Koridor I. třídy (I/11 Rudná) – soukromý pozemek)",
    "trafficEstimate": "odhad průjezdu např. 28 000 vozidel/den",
    "visibilityScore": 9.4,
    "recommendedCarrierType": "Navigační sloupek (COLUMN) | Billboard 5,1 × 2,4 m | Bigboard 9,6 × 3,6 m | LED obrazovka",
    "estimatedMonthlyRentCzk": 5000,
    "commercialRationale": "Proč je to pro inzerenty extrémně lákavé (viditelnost, kolony, nákupní spád, zákaz reklamy na VO)",
    "acquisitionTip": "Konkrétní tip pro obchodníka, jak oslovit majitele a co mu nabídnout",
    "roadProximityMeters": "3–7 m od krajnice vozovky (čelní plot u vjezdu)",
    "visualAngle": "Přímý čelní pohled 180 m bez clonění pro projíždějící vozy",
    "isExtremeProximity": true
  }
]`;

  try {
    let jsonString = '';
    if (geminiKey) {
      // Cascade through valid Gemini model names
      const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest', 'gemini-1.5-pro'];
      for (const model of geminiModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const parts = data.candidates?.[0]?.content?.parts || [];
            jsonString = parts.map((p: { text?: string }) => p.text || '').join('');
            if (jsonString) break;
          }
        } catch {
          // try next model
        }
      }
    } else if (openAiKey) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.3,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        jsonString = data.choices?.[0]?.message?.content || '';
      }
    }

    if (jsonString) {
      const cleaned = jsonString.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[AI Scout] Generation error, using extended fallback:', err);
  }

  // Fallback to extended regional presets
  const list = generateExtendedPresetFallback(cityOrArea, count + offset);
  return list.slice(offset, offset + count);
}

/**
 * Evaluates a single specific plot for advertising suitability, returns score, fair rent and negotiation letter.
 */
export async function analyzePlotAdvertisingPotentialAi(plot: {
  label?: string;
  parcelNumber?: string | null;
  cadastralArea?: string | null;
  landType?: string | null;
  latitude: number;
  longitude: number;
  landownerName?: string | null;
  monthlyRent?: number | null;
}): Promise<AiPlotAnalysis> {
  const { geminiKey, openAiKey } = getAiKeys();

  const promptText = `Jsi expert na OOH reklamu (billboardy, bigboardy, LED) a oceňování pozemků.
Proveď detailní komerční analýzu a připrav argumentář pro tento pozemek v ČR:
- Název / Označení: "${plot.label || 'Pozemek'}"
- Katastrální území: "${plot.cadastralArea || 'neznámé'}"
- Parcelní číslo: "${plot.parcelNumber || 'neznámé'}"
- Druh pozemku: "${plot.landType || 'neuveden'}"
- GPS: ${plot.latitude.toFixed(6)}, ${plot.longitude.toFixed(6)}
- Jméno majitele / firmy: "${plot.landownerName || 'Vlastník pozemku'}"
- Aktuálně uvažovaný nájem: ${plot.monthlyRent ? `${plot.monthlyRent} Kč/měs` : 'dosud nestanoven'}

Vrať VÝHRADNĚ validní JSON bez formátování kolem:
{
  "overallScore": 8.8,
  "trafficRating": "EXTREME | HIGH | MEDIUM | LOW",
  "recommendedCarrier": "Doporučený formát (např. Bigboard 9,6 × 3,6 m jednostranný osvětlený)",
  "estimatedFairRentCzk": 5500,
  "estimatedCampaignValueCzk": 18000,
  "pros": ["Výhoda 1", "Výhoda 2", "Výhoda 3"],
  "cons": ["Riziko nebo omezení 1", "Omezení 2"],
  "negotiationPoints": ["Argument 1 pro jednání s majitelem", "Argument 2", "Argument 3"],
  "outreachSubject": "Předmět e-mailu / dopisu majiteli (např. Nabídka dlouhodobého pronájmu části pozemku)",
  "outreachLetterTemplate": "Kompletní profesionální, uctivý dopis/e-mail majiteli s nabídkou pasivního příjmu za instalaci reklamního zařízení SeePOINT."
}`;

  try {
    let jsonString = '';
    if (geminiKey) {
      const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
      for (const model of geminiModels) {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiKey,
              },
              body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            jsonString = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('');
            if (jsonString) break;
          }
        } catch {
          // try next model
        }
      }
    } else if (openAiKey) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.2,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        jsonString = data.choices?.[0]?.message?.content || '';
      }
    }

    if (jsonString) {
      const cleaned = jsonString.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    }
  } catch (err) {
    console.error('[AI Plot Analysis] Generation error, using fallback:', err);
  }

  // Fallback analysis
  return {
    overallScore: 8.9,
    trafficRating: 'HIGH',
    recommendedCarrier: 'Billboard 5,1 × 2,4 m (oboustranný, osvětlený)',
    estimatedFairRentCzk: 4500,
    estimatedCampaignValueCzk: 14000,
    pros: [
      'Výborná čelní viditelnost pro projíždějící řidiče',
      'Minimální zábor plochy – nosič zabere pouze cca 0,5 m² na základové patky',
      'Pravidelný pasivní příjem pro majitele bez nutnosti jakékoliv práce',
    ],
    cons: [
      'Nutné prověřit ochranné pásmo inženýrských sítí podél oplocení',
    ],
    negotiationPoints: [
      'Garantujeme čtvrtletní platbu nájemného předem na účet majitele.',
      'Veškeré stavební povolení, revize i pojištění odpovědnosti hradí a zařizuje SeePOINT.',
      'Možnost bezplatného umístění vlastní navigační šipky pro provozovnu majitele.',
    ],
    outreachSubject: `Nabídka spolupráce a zhodnocení pozemku – ${plot.cadastralArea || 'reklamní plocha'}`,
    outreachLetterTemplate: `Vážený pane / paní,\n\nobracím se na Vás jménem společnosti SeePOINT s nabídkou dlouhodobého pronájmu malé části Vašeho pozemku (p.č. ${plot.parcelNumber || 'v k.ú. ' + (plot.cadastralArea || '')}) pro umístění moderního reklamního nosiče.\n\nVaše lokalita má vynikající polohu u frekventovaného tahu. Rádi bychom Vám nabídli garantovaný roční/měsíční pasivní příjem bez jakýchkoliv starostí:\n- Veškeré náklady na výrobu, instalaci a provoz zařízení hradíme my.\n- Nosič zabere minimální prostor a neomezí běžný provoz Vašeho areálu.\n- Zajišťujeme plné pojištění a technickou údržbu.\n\nV případě zájmu Vám rád zašlu nezávazný grafický návrh a návrh smlouvy.\n\nS pozdravem,\nSeePOINT Akviziční tým`,
  };
}
