# Inventura skutečných funkcí a mapa workflow

Zdroje: `app/**/page.tsx`, `app/api/**/route.ts`, `lib/navigation.ts`, `lib/organization-modules.ts`, `lib/rbac.ts`, `prisma/schema.prisma`. Kompletní jednotlivé adresy, importované komponenty, přímé guardy, API metody a modelová pole jsou v `inventory.json` a `route-index.md`. Nepřebírat neexistující stránky `/crm/clients`, `/crm/orders`, `/surfaces`, `/work-orders`, `/invoices` nebo `/settlement` z README; některé domény mají API nebo záložku, nikoli vlastní stránku pod touto adresou.

## Přístupový model

Aktivní aplikační role: ADMIN (A), MANAGER (M), SALES (S), TECHNICIAN (T), WORKER (W), ACCOUNTANT (Ú), VIEWER (V). `OrganizationMember` má také OWNER; `lib/auth.ts` jej převádí na ADMIN. Uživatel může mít více dovolených rolí, ale pro menu a guardy rozhoduje aktivní role z ověřeného seznamu. Platformní SUPER_ADMIN není běžná firemní role.

Níže uvedené role jsou orientační oprávnění sekce z kódu, nikoli záruka všech akcí. Současně musí platit aktivní organizace, členství, dostupný modul a případné vlastnictví/přiřazení záznamu. Například SALES smí vytvářet nabídky, ale interní přijetí nabídky je omezeno na ADMIN/MANAGER. Plánovač a volební demontáže mají explicitní tenant rollout; ani ENTERPRISE je automaticky nezapne.

## Mapa modulů

Náročnost N/S/V = nízká/střední/vysoká; odhad pro návrh zaškolení, nikoli měření s uživateli. „Implementováno“ znamená existující kód; provozní dokončenost je bez E2E neověřená.

| Funkce a vstup | Uživatelé | Správná činnost a návaznost | Stav a důkaz | Zaškolení / zjednodušení |
|---|---|---|---|---|
| Přihlášení, aktivace, obnova hesla, profil; `/login`, `/activate/[token]`, `/forgot-password`, `/reset-password/[token]`, `/profile` | všichni, podle session | aktivace → login → organizace/aktivní role → profil | implementováno; auth a middleware přečteny | N; vysvětlit rozdíl role a organizace |
| Nástěnka `/dashboard` | A M S T W Ú V | přehled → detail doménové agendy | indexováno | N; zobrazit jen relevantní ukazatele |
| Planner `/planner`, `/settings/planner` | všichni kromě V + modul | osobní blok → dostupnost → Google kalendář | implementováno; AI doporučení výslovně připravována (`PlannerCockpit`, API settings) | S; nezařadit neexistující AI plánování do funkčních lekcí |
| Mapa/nosiče `/map`, `/carriers`, `/carriers/[id]` | A M S T V; editace užší | filtr → nosič → obchodovatelná plocha → foto/obsazenost | implementováno; Photo/Carrier/Surface a filtry | S; naučit rozdíl fyzický nosič versus plocha |
| Obsazenost `/occupancy` | A M S | termín → plocha → rezervace/kampaň → kontrola kolizí | service a vybrané testy ověřeny lokálně | V; jedna legenda závazné/nezávazné blokace |
| AI obsazenost `/occupancy/ai` | A M S + aiOccupancy | vyhodnotit nález → otevřít zdroj → potvrdit postup | implementováno; `OccupancyInsight`, intelligence služby | S; AI závěr nesmí zastoupit zdrojovou rezervaci |
| Klienti `/clients`, `/clients/[id]`, `/clients/dashboard` | A M S | firma → kontakty/pobočky → nabídky, zakázky, faktury a komunikace | indexováno; `components/crm/*`, modely CRM | V; kontextové záložky místo hledání neexistujících samostatných rout |
| Nabídky `/offers`, `/offers/new/*`, `/offers/[id]/*`, `/offers/templates` | A M S | typ → klient → výběr → cena → kontrola → klientský odkaz → přijetí | service/workflow/doména přečteny, část testů prošla | V; nezaměňovat průvodce STANDARD_MEDIA a NAVIGATION |
| Navigační návrhy a více cílů `/offers/new/navigation`, `/offers/[id]/navigation/edit` | A M S | cíle/pobočky → body a fotografie → lokační výběr → nacenění | `NavigationOfferCockpit`, `NavigationTarget`, service; lokální test fáze 1 | V; jasně oddělit výběr lokalit a finální souhlas |
| Klientské portály `/proposal/[token]`, `/offer/[token]`, `/campaign/[token]`, `/p/[token]` | držitel platného veřejného tokenu | prohlédnout → výběr/souhlas/dotaz → následný přehled kampaně | implementováno, `/p` má potvrzený middleware problém | S; jednotná kanonická URL a názvy fází |
| Navigační zakázky `/navigation`, `/navigation/orders/[id]` | A M S T W; akce dle policy | potvrzení → smlouva → grafika → výroba → instalace → foto → fakturace | 13 stavů v `workflow-service`; lokální RBAC testy | V; zobrazit další povolenou akci a důvod blokace |
| Instalace, QC, plánování `/navigation/installations`, `/navigation/installations/planning`, `/navigation/qc` | sekce navigation, přesná akce dle guardu | přidělení → montáž → foto → QC | indexováno, návazné služby přečteny částečně | V; společná fronta nehotových úkolů |
| Navigační smlouvy/kontakty `/navigation/contracts`, `/navigation/contacts` | A M S | kontakt → smlouva → verze ceny a fakturační období | modely a routy potvrzeny | S; odkazy z detailu zakázky |
| Dokumentace `/navigation/documentation`, `/client/navigation-documentation/[token]` | A M S T / veřejný token | sestavit report → vybrat klientské foto → publikovat → export | nové lokální testy tokenů/fotek prošly; bez provozního ověření | V; rozlišit interní foto a klientskou viditelnost |
| Focení `/mobile-photos` | A M S T W V podle dostupnosti carriers/navigation | GPS → nosič/plocha → foto a účel → upload → potvrzení přiřazení | UI + upload helpers/storage přečteny, testy prošly | S; V vstup není důkaz práva uploadovat; akce má vlastní kontrolu |
| Navigační průzkum `/mobile-surveys`, `/mobile-surveys/[id]` | A M S T W + mobileSurveys | vybrat nabídku/zakázku → kandidátní body → ověření | `NavigationCandidatePoint`, `SurveyRoute`, page guard | V; odlišit od samostatného Field Survey |
| Field Survey `/field-survey`, `/field-survey/new`, `/field-survey/[id]`, `/mobile-field-survey/*` | A M S T W + carriers | průzkum → bod GPS → foto → parcela/kontakt → export | vlastní FieldSurvey* modely; export/RBAC testy prošly | S; neslibovat automatický vznik reklamního nosiče |
| Realizace `/realization`, `/realization/[id]` | A M S Ú | CrmOrder → stav položek → podklady/výroba/instalace → billing readiness | aktuálně rozpracovaný kód, engine a adaptéry | V; souhrn max. 100 objednávek, nález AUD-05 |
| Výroba `/production` | A M S T | podklady → tisková úloha → stav dodání → instalace | `PrintProductionJob`, production service, dashboard | S; rozlišit schválení podkladů od zahájení tisku |
| Práce a výjezdy `/work`, `/work/[id]`, `/work/route`, `/my-route` | A M S T W | pracovní příkaz → přiřazení → trasa → dokončení položky | WorkOrder/Assignment/Item, field-planning | V; průchod podle přidělené práce, ne všech zakázek |
| Úkoly `/tasks`, `/my-tasks` | všechny úkoly A M S T; vlastní A M S T W | převzetí → průběh → dokončení; vazba na zakázku | WorkTask, QuickInternalTask, CrmTask jsou různé entity | S; v lekci vždy pojmenovat druh úkolu |
| Výkazy `/work-entries`, `/my-work-entries` | všechny A M Ú; vlastní A M S T W | práce/výdaj → sazba → odevzdání → schválení | WorkEntry/Expense, policy a sazby | V; nezaměnit vlastní vykázání a schvalování |
| Vyúčtování `/settlements`, `/my-settlements`, detaily | všechny A M Ú; vlastní A M S T W Ú | návrh → odevzdání → schválení → uzamčení → platba | Settlement, Invoice; odlišné od ClientInvoice | V; jasně oddělit fakturu pracovníka a klientskou fakturu |
| Tým `/employees`, `/employees/[id]`, `/team`, `/chat`, `/vacations` | zaměstnanci A M Ú; tým všichni; absence dle vlastní/team policy | účet/sazby → spolupráce → absence | modely a route index | S; citlivé mzdy odděleně od kontaktů |
| Vozidla `/vehicles`, detail, `/vehicle-reservations` | A M S T W | rezervovat → provoz/tankování → servis | VehicleReservation/Service/Fuel | S; kolize a účtenky zvlášť |
| Sklad `/warehouse`, `/warehouse/print-qr`, `/qr/scan`, `/qr/[code]` | A M T W | položka → příjem/výdej → inventura/QR | policy a stránka; menu chybuje pro SALES | S; podle role příjem/výdej versus správa katalogu |
| Nákupy `/shopping`, alias `/nakupy` | všichni kromě V pro editaci | požadavek → nákup → návaznost skladu | CompanyShoppingItem, shopping policy | N; jeden preferovaný název a odkaz |
| Výstavní sítě `/projects/city-gallery`, městský inventář `/projects/city-inventory` | A M S / A M S T V dle modulu | projekt/síť → místa/balíčky → nabídka | indexováno; CityGallery* a MediaPackage | S; před publikací jednotlivé akce E2E ověřit |
| B2B Network `/network` | A M S | přehled dostupného inventáře; partnerství omezené | UI výslovně upozorňuje na neimplementované perzistentní partnerství | S; označit částečné, neučit jako hotovou partnerskou síť |
| AI obchod `/commercial`, `/sales/opportunities`, `/crm/intelligence`, `/ai-inbox` | A M S + příslušné moduly | podnět → zdroj a confidence → revize → potvrzení akce | oddělené ai-commercial/orchestrator/inbox/radar služby | V; žádný doložený univerzální znalostní asistent |
| Analytics `/analytics` | A M S | finanční přehled → zdrojové záznamy | indexováno, finance helpery | S; vymezit rozsah období a dat |
| Volební demontáže `/election-removal/*` | A M T W + explicitní modul | KML/import kampaně → plán → trasa → demontáž → sklad | ElectionCampaign/RemovalPoint, specializovaný engine | V; samostatná volitelná cesta, ne univerzální onboarding |
| Import `/import` | A | soubor → mapování → dry-run → potvrzení | ImportProfile/Batch/Row, executor | V; nikdy cvičný import do produkce |
| Správa `/settings/*`, `/onboarding`, `/admin/organizations/*` | A; platforma SUPER_ADMIN; Planner výjimka | členství → role/moduly → integrace → nastavení firmy | auth/module policy/modely potvrzeny | V; firemní administrace oddělit od správy platformy |
| Veřejný web `/`, `/os`; `/module-unavailable` | veřejnost / přihlášení dle route | prezentace produktu / vysvětlení nedostupnosti | indexováno | N; marketing nesmí být zdrojem návodů |

## Hlavní workflow a zdroje pravdy

### W1 Standardní nabídka → realizace

`/clients` → `/offers/new/standard` → výběr `AdvertisingSurface` + termín → cena → `/offers/[id]/approval` → odeslání/publikace → klientské přijetí → konverze → `CrmOrder`, obsazenost → `CrmRealization`/pracovní příkaz → výroba → instalace → Photo → ClientInvoice.

Zdroj: `lib/offers/service.ts` (transitionOffer/respondToPublicOffer/konverze), `lib/occupancy/availability-service.ts`, `lib/ai-realization/adapters/standard-media-*`. Kontrola kolizí běží i při přijetí, nikoli pouze při výběru. Ověřit souběh dvou přijetí, opakovaný request a změnu termínu po konverzi; v tomto auditu neproběhl DB E2E.

### W2 Navigace se dvěma schváleními

`NavigationOffer` + více `NavigationTarget` → `NavigationPoint` + terénní fotografie → LOCATION_SELECTION → klientský výběr přes `/api/proposals/[token]/selection` → obchodník nacení PRICED_QUOTE → klient schválí cenu → konverze do `NavigationOrder`/`CrmOrder` → pracovní příkaz a realizace.

`lib/navigation/navigation-service.ts`, `navigation-work-sync.ts` a `workflow-service.ts` řeší navazující domény. Neprovádět konverzi po prvním výběru. Při změně přijaté zakázky navrhnout lekci nad `NavigationChangeSet`, nikoli slibovat automatickou synchronizaci libovolné úpravy původní nabídky. Zachování všech vazeb cílů, vybraných bodů a fotografií musí potvrdit integrační scénář.

Realizační stavový automat: POPTAVKA → NABIDKA → POTVRZENO_KLIENTEM → SMLOUVA_OBJEDNAVKA → GRAFICKE_PODKLADY → SCHVALENI_GRAFIKY → TISK_VYROBA → PRIPRAVENO_K_INSTALACI → INSTALACE → FOTODOKUMENTACE → PRIPRAVENO_K_FAKTURACI → FAKTUROVANO → DOKONCENO. Povolené návraty a výjimky nejsou stejné pro každý stav. Přechod k fotodokumentaci/fakturaci kontroluje instalované fotografie; FAKTUROVANO vyžaduje navázané fakturované období.

### W3 Terénní fotografie

`/mobile-photos` → získat GPS → najít nosič → zvolit plochu/stranu a účel → pořídit fotografii → `/api/mobile-photos/upload` → `Photo` + tenant storage → případné potvrzení správné plochy `/confirm` → galerie/QC/report. UI rozlišuje uloženou fotku a selhání vedlejší akce (Drive fallback, historie, zpráva do chatu). Chyba chatu není důvod automaticky znovu nahrávat již uloženou fotografii.

Google Drive může mít tenant-scoped DB fallback; `SEEPOINT_STORAGE` v `photo-storage.ts` záměrně vyhodí chybu, protože adapter není nakonfigurován. To je omezení konfigurace, nikoli důkaz rozbitého běžného uploadu. Reálnou dostupnost storage jsme neověřili.

### W4 Nezávislý Field Survey

`/field-survey/new` → průzkum → `/mobile-field-survey/[surveyId]` → `FieldSurveyPoint` → `FieldSurveyPhoto` → parcela/vlastník/kontakt → export GeoJSON/KML/XLSX. Upload používá společný storage helper, ale nezapisuje do `Photo`. Tato nezávislost je doménová, nikoli slib samostatného storage provideru či licence; přístup je vázán na carriers.

### W5 Práce a finance

`WorkOrder` → `WorkAssignment`/`WorkTask` → vykázání `WorkEntry` + `WorkExpense` → `Settlement` → dodavatelská `Invoice`. Odděleně: `CrmOrder`/`NavigationBillingPeriod` → `ClientInvoice`. Zaměstnanecké vyúčtování nelze dokumentovat jako klientskou fakturaci.

### W6 AI

AI Inbox: přijetí zprávy → klasifikace/párování → `AiInboxAction` → kontrola oprávnění a ruční potvrzení → doménová služba. Radar: signál → vyhodnocení → příležitost. Realizace/obsazenost: vyhodnotit existující záznamy → doporučení → otevřít zdroj. Existují AI Vision, hlasový úkolníček a různé provider cally; `/chat` je týmový chat, nikoli doložený univerzální AI helpdesk.

## Hranice pokrytí

Detaily všech formulářových validací, příloh, importních formátů, fakturačních scénářů a mobilních gesture nebyly ručně ověřeny. Katalog níže je baseline všech objevených domén, doplňuje se po prvním autentizovaném průchodu. U všech workflow zůstává runtime stav UNVERIFIED; jednotlivé helper testy jsou uvedeny odděleně.
