# AI Radar: audit a sémantické sjednocování příležitostí

Datum: 17. 9. 2026. Implementace rozšiřuje současný Radar; nezavádí nový modul, poskytovatele AI ani auditní framework.

## Audit před změnou

1. **Umístění a tok:** `app/sales/opportunities/page.tsx`, komponenty v `components/opportunities`, služby v `lib/opportunities`. Zobrazovanou obchodní entitou je `SalesOpportunity`. `DemoLead` patří jinému toku a není modelem Radaru.
2. **Zdroje:** `feed-collector.ts` načítá vlastní RSS a Google News RSS sestavené z měst, regionů a klíčových slov profilu. Omezuje stáří RSS zpráv na 45 dní a velikost dávek. `live-search-core.ts` hledá pomocí Gemini Google Search grounding. Další vstupy: ruční AI analýza URL/textu a řízený import.
3. **Scraping a AI:** parser používá `fetchPublicArticle` s ochranou veřejných URL, získá titulek a omezený text HTML; Gemini nebo stávající fallback OpenAI vrátí JSON. Live search kombinuje hledání a extrakci v jednom placeném volání. Není to samostatný crawler, který by předem stáhl každý výsledek vyhledávání.
4. **Vytváření:** discovery runner, import a ruční POST používají `createOpportunity` v `service.ts`; ta provádí skórování, CRM přiřazení a ukládání. Nabídka vzniká později přes Commercial Engine.
5. **Dosavadní deduplikace:** RSS v dávce porovnává shodný titulek nebo URL. `RadarSignal` má unikátní `(organizationId, sourceUrl)`, RSS používá `createMany/skipDuplicates`, live search upsert. Původní `findDuplicateOpportunity` kontrolovala přesnou URL a poté firmu + typ události + případně město v okně 180 dní. Firma a město byly nebezpečně silnou automatickou podmínkou. Hash ani embeddingy se nepoužívaly.
6. **Modely:** `SalesOpportunity`, `RadarSignal`, `RadarRun`, `RadarFeedback`, `OrganizationRadarProfile`; souvisejí s `Client`, `Offer`, uživatelem a AI Inboxem. Příležitost měla jediný `radarSignalId` a inline zdrojové údaje. Signál měl `discoveredOpportunityId` bez skutečné databázové relace.
7. **Další detekce:** CRM Intelligence mělo vlastní heuristické návrhy „firma + město/typ“, které neslučovaly záznamy. Nově čte skutečné návrhy semantic resolveru, aby nedávalo protichůdná doporučení po KEEP SEPARATE.
8. **Znovupoužití:** `RadarSignal` plní úlohu OpportunitySource; `SalesOpportunity` zůstává kanonickou obchodní entitou. `RadarRun.summaryLog` uchovává audit, `AIUsageLog` spotřebu. Existující skórování, profily, vyloučené firmy/domény, CRM a nabídky zůstávají.
9. **Rizika:** opakované akce stejné firmy, více poboček v témže městě, obecné názvy projektů, stejné kategorie, podobné titulky a chybějící parametry. Žádná z těchto kombinací sama neopravňuje automatické sloučení.
10. **Náklady:** zachovat technickou Stage 1, indexovaně omezit kandidáty, rozhodnout přesné identifikátory deterministicky a teprve zbytek řešit jedním omezeným voláním stávající AI.

## Databázová změna

Přírůstková migrace `20260917120000_radar_semantic_sources`:

- `SalesOpportunity`: `semanticData`, `fieldProvenance`, `dataConflicts`, normalizovaná firma/město/projekt, project/tender identifikátor, `mergedIntoId` a relační `sources`.
- `RadarSignal`: `canonicalOpportunityId`, `candidateOpportunityId`, `semanticDecision`, `semanticConfidence`, `resolution`, `keptSeparateIds`, `sourceDomain`.
- Složený FK `(organizationId, canonicalOpportunityId)` zaručuje 1:N v rámci organizace. `ON DELETE RESTRICT` chrání přiřazené články. Původní sloupce a relace zůstávají pro kompatibilitu.
- Indexy s organizací na začátku pokrývají firmu/město, město/typ, název projektu, identifikátory, URL, kanonické zdroje a stav kontroly.
- Migrace doplní historické signály a normalizované klíče. Přednostně využije existující signály. Nevytváří další zdroj se stejnou tenantovou URL, neslučuje ani nemaže historické příležitosti.
- Nevzniká nová tabulka OpportunitySource ani samostatný auditní model.

Migrace byla ověřena v lokálním PGlite (PostgreSQL). Nebyla aplikována na produkční ani připojenou cloudovou databázi. Při nasazení nejprve použít standardní `npm run db:migrate:deploy`, poté nasadit aplikaci s nově vygenerovaným Prisma klientem. Starší verze aplikace nové nullable sloupce nepotřebuje; automaticky je při rollbacku neodstraňovat.

## Nový přesný tok

1. RSS / live search / URL-text analýza / import dodá zdroj.
2. Stage 1 zachová přesnou URL a tenantovou unikátnost. Původní kontrola titulků zůstává prioritizací RSS dávky, ale odlišné URL se ukládají, aby se neztrácely další články se stejným titulkem. Zpracované zdroje se znovu neextrahují. Ruční parser vrací uloženou extrakci známé URL.
3. Stávající AI extrakce navíc vrací `semanticData`: investor, projekt, přesná lokalita, město, region, země, typ/kategorie, popis, hodnota/měna, kapacita, project/tender ID, oznámení, plánované zahájení/dokončení a zdrojová metadata. Neznámé údaje zůstávají prázdné; zdrojová doména se odvozuje z URL. Neznámé datum publikace se nenahrazuje dneškem.
4. Transakce zamkne tenantově unikátní řádek `OrganizationRadarProfile` pomocí Prisma upsertu. Všechny nové zápisy i ruční zásahy používají stejný zámek. Následuje opakovaná URL kontrola, která chrání souběžné běhy.
5. Candidate retrieval používá indexované identifikátory, název projektu, firmu a město (včetně kandidátů s dosud neznámým městem). Každá větev načítá nejvýše 20 položek; sjednocená sada se lokálně seřadí podle přesných znaků a textového překryvu popisu. Resolver dostane maximálně 10 kandidátů, nikdy celou databázi.
6. Shodný jednoznačný project/tender ID bez konfliktů rozhoduje deterministicky. Prokazatelně rozdílné identifikátory nebo města mohou kandidáty vyloučit bez AI. Žádný kandidát znamená novou příležitost bez comparison callu.
7. Jinak proběhne nejvýše jedno porovnání přes stávající Gemini (konfigurovaný `GEMINI_OPPORTUNITY_MODEL`, jinak Flash) nebo existující OpenAI fallback. Požadavek má nejvýše 8 sekund v rámci společného deadline, omezené délky dat a žádný web grounding.
8. Výsledek obsahuje decision, ID kanonické příležitosti, confidence, důvod, shodné/konfliktní znaky a použitý model. Server ověří typy, rozsah confidence a příslušnost ID mezi kandidáty. Následně uplatní vlastní konfliktní pravidla nezávisle na názoru AI.
9. SAME přidá zdroj ke kanonické příležitosti. POSSIBLE vytvoří samostatnou příležitost se zdrojem a návrhem na kandidáta. NEW vytvoří novou příležitost. Selhání AI s existujícím kandidátem skončí ruční kontrolou s confidence 0, nikdy automatickým sloučením nebo ztrátou zdroje.
10. Fakta se přepočítají z uchovaných zdrojů, zapíše se provenance, konflikty a audit. Hlavní seznam, počty, notifikace a aktivní obchodní doporučení nezobrazují `mergedIntoId != null`.

Live search nadále kombinuje hledání a extrakci v jednom volání; před ním nejsou URL výsledků známé. Stage 1 před uložením i porovnáním platí i pro tento vstup, ale nelze odstranit náklad samotného opakovaného vyhledávání.

## Prahy a ochrana proti chybnému merge

- `RADAR_MERGE_THRESHOLD=0.90`.
- `RADAR_REVIEW_THRESHOLD=0.75`.
- Pod review prahem NEW; prostřední pásmo POSSIBLE; nad merge prahem SAME pouze při konkrétní oporě a bez konfliktů. Explicitní nejistota AI zůstává POSSIBLE i při vysoké confidence.
- Firma + město + kategorie nestačí. Obecné projectName jako „Nová prodejna“ nejsou identifikační kotvou.
- Opora: explicitní ID, konkrétní název projektu společně s lokalitou/kapacitou, shodná adresa s číslem a investor, nebo přesné místo společně s kapacitou.
- Odlišné project/tender ID, město, země, adresa, přesná lokalita či kapacita blokují automatický merge. Rozdílná doložená investice/měna a termíny vzdálené o více než 90 dní rovněž vyžadují kontrolu. Rozdílné formulace mohou způsobit raději false negative než chybný merge.
- Více stejně podložených kandidátů blokuje automatické rozhodnutí.
- KEEP SEPARATE je trvalý stav zdroje a uložená oboustranná výjimka mezi příležitostmi. Recrawl známé URL nevolá resolver. Nový článek s jednoznačnou oporou respektuje výjimky; pokud odpovídá oběma ručně odděleným projektům, jde znovu pouze do kontroly. Automatická revize ručního rozhodnutí není zapnutá.

## Enrichment, audit a undo

První doložená neprázdná hodnota zůstává; nový zdroj doplňuje chybějící hodnoty. Podrobnější popis lze rozšířit. Odlišné faktické hodnoty se uchovávají jako konflikty včetně source ID, nepřepisují se odhadem. `fieldProvenance` ukazuje, který článek dodal přijatou hodnotu.

Ruční MERGE přesune zdroje, ale původní Opportunity ponechá s `mergedIntoId`. Její CRM/offer vazby se nemažou ani násilně nepřepisují. DETACH přesune vybraný zdroj do samostatné Opportunity; pokud lze obnovit prázdnou původní příležitost z ručního merge, obnoví ji. Obě strany se přepočítají ze zbývajících zdrojů. Poslední zdroj nelze odpojit. Akce jsou povolené pouze ADMIN/MANAGER s přístupem k modulu.

Audit používá `RadarRun.summaryLog`, typy SEMANTIC a SEMANTIC_MANUAL: source ID, kandidátní snapshoty, rozhodnutí, confidence, důvod, znaky, datum, model, automatický/ruční režim a actor ID. Průběžný stav je i na signálu. Volání AI využívá `AIUsageLog` se skutečnými tokenovými údaji poskytovatele, pokud jsou vráceny.

Metriky: analyzované zdroje, URL duplicity, automatická sjednocení, možné duplicity, nové příležitosti, ruční zásahy a součet/počet confidence. `/api/sales/radar/runs` vrací standardní běhy odděleně od souhrnu posledních nejvýše 1000 semantic událostí v období 30 dní; `metricsTruncated` výslovně označuje limit. RSS Stage 1 počty jsou zvlášť v `summaryLog.rssStage1Duplicates` discovery běhu.

## UI a historický backfill

- Jedna hlavní karta za jednu kanonickou příležitost; badge počtu zdrojů, datum aktualizace a jistota posledního přiřazení. Jistota merge není vydávána za důvěryhodnost celého článku ani skóre obchodního potenciálu.
- Rozbalitelné Zdroje: titulek, URL, doména, datum publikace/nalezení, převzatá fakta a jejich provenance, konflikty a oprávněné oddělení zdroje. Sekce původních obchodních záznamů zachovává přístup k původním nabídkám a zobrazuje původního CRM klienta.
- Možné duplicity: srovnání obou příležitostí, důvod/confidence/konflikty, „Je to stejná příležitost“ a „Jde o jinou příležitost“.
- Backfill Semantic Deduplication: explicitní tlačítko, 20 příležitostí na dávku a kurzor pro pokračování. Pouze návrhy, žádné automatické historické merge a žádné placené AI porovnávání. Uživatel nejprve vidí obě strany a následně potvrdí konkrétní návrh.

## Změněné soubory

- Schéma/migrace: `prisma/schema.prisma`, `prisma/migrations/20260917120000_radar_semantic_sources/migration.sql`, `.env.example`.
- Služby: nové `lib/opportunities/semantic-core.ts`, `semantic-resolver.ts`, `semantic-service.ts`; upravené `service.ts`, `types.ts`, `policy.ts`, `parser.ts`, `live-search-core.ts`, `feed-collector.ts`, `discovery-runner.ts`.
- API: nové `app/api/sales/radar/duplicates/route.ts`; upravené `sales/radar/runs`, `sales/opportunities/[id]`, `parse-input`, `scheduled-discovery` a `notifications/unread`.
- UI: nové `OpportunitySources.tsx`, `RadarDuplicateReview.tsx`; upravené `OpportunityCard.tsx`, `SalesOpportunitiesClientView.tsx`.
- Návaznosti: `lib/ai-crm/duplicate-detector.ts`, `crm-intelligence-service.ts`, `lib/ai-commercial/next-best-action.ts`, `lib/ai-orchestrator/attention-service.ts`, `commercial-center-service.ts`, `lib/notifications-service.ts`.
- Testy: nové `tests/radar-semantic.test.ts`, `radar-semantic-service.test.ts`, `radar-semantic-migration.test.ts`, `e2e/radar-semantic-ui.spec.ts`; rozšířené fixtures `tests/ai-sales-radar-integration.test.ts`.
- Tato dokumentace. Předchozí uživatelská změna `lib/work.ts` nebyla součástí úprav.

## Ověření a limity

Výsledky: 74/74 cílených a regresních Node testů prošlo; zahrnují 23 kontrol nové sémantické vrstvy a migrace. TypeScript (`tsc --noEmit`), Prisma validace/generování klienta a `security:tenant` prošly. Cílený ESLint skončil bez chyb; ponechaný warning nevyužitého `CheckCircle2` je v nezměněném `RadarSettingsModal.tsx`. Browser test prošel v nainstalovaném Chromu pro desktop i mobil. Celý produkční build a živá kvalita LLM nebyly součástí tohoto ověření.

Testy pokrývají všechny požadované scénáře, serverovou validaci rozhodnutí, ztrátu AI providera, nové články po KEEP SEPARATE, dohledatelnost investice, undo enrichmentu, návrhový backfill, omezený retrieval a tenantové oddělení. PostgreSQL test skutečně provádí SQL migrace, kontroluje unikátní URL a FK mezi organizacemi. Servisní testy volají produkční služby nad transakčním paměťovým adaptérem a mockovanou AI; nejsou testem produkční databáze ani kvality živého modelu.

Browser test používá skutečné React komponenty a styly, HTTP fixtures a Chrome; ověřuje desktop/mobil, klikací review/oddělení/preview a absenci JS chyb. Nejde o přihlášený end-to-end test produkčního Radaru.

Embeddings ani nový fulltextový systém nebyly zavedeny, protože projekt žádný nemá. Bounded retrieval může minout projekt, u něhož se liší jméno investora i místo a chybí společný identifikátor/název; starší projekty mohou v hustých lokalitách vypadnout z top 20 jedné větve. Bezpečným výsledkem je další samostatná příležitost nebo ruční kontrola. Zlepšení recall lze později měřit z auditních dat.

Zámek profilu serializuje zápisy jedné organizace a transakce může držet zámek během maximálně osmivteřinového porovnání. To odpovídá současným malým dávkám Radaru; při větším provozu je vhodná fronta nebo optimistické přepočítání kandidátů. Metadata dlouhodobého auditu vyžadují standardní retenční politiku projektu.

Datum publikace bez podkladu zůstává neznámé. Jistota není kalibrovaná statistická pravděpodobnost. Jednotky/aliasy lokalit jsou záměrně porovnávány konzervativně; například odlišný zápis kapacity může skončit ruční kontrolou. Existující stav obchodního procesu a vztahy nabídek na historických sloučených záznamech se zachovávají, automaticky se mezi CRM/Offer entitami neslučují.
