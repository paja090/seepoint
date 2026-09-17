# SeePoint Planner — Phase 1 / Foundation

Implementováno 16.–17. 9. 2026. Modul je standardně vypnutý pro všechny tenanty, včetně Enterprise. Tato změna neaktivuje AI ani nezapisuje události do Google Calendar.

## A. Audit původního systému

| Oblast | Existující zdroj a rozhodnutí |
| --- | --- |
| Tenant a členství | `Organization`, `OrganizationMember`, `User`, `Employee`; tenant v aplikaci znamená `organizationId`. Použit stávající `getCurrentUser`, aktivní členství a kontext požadavku. |
| Permissions | `lib/rbac.ts`, `module-policy.ts`, `organization-modules.ts`, `page-auth.ts`. Planner přidává sekci a explicitní tenant flags do těchto mechanismů. |
| Izolace databáze | `lib/tenant-prisma.ts` a `tenant-context.ts`; nové modely jsou registrované a mají tenant klíče. |
| Úkoly | `WorkTask`, `QuickInternalTask`, `CrmTask` jsou kanonické. Planner je čte přes adaptér a ukládá jen reference. Nevzniká druhý Task manager. |
| CRM a obchod | `Client`, `ClientContact`, `CrmOrder`, `CrmRealization`, `Offer`, komunikace a dokumenty již existují. Foundation používá úkoly a jejich odkazy; širší meeting kontext z těchto modulů patří do další fáze. |
| Absence a skutečná práce | `EmployeeAbsence` a `WorkEntry` již existují. Schválené absence vstupují do kapacity; skutečný odpracovaný čas se nekopíruje. |
| Audit a notifikace | Stávající `UserAuditLog`, doménové CRM/offer logy a notifikační mechanismy. Použit `UserAuditLog`; není nový notifikační subsystém. |
| Integrace/OAuth | Google Drive/Gmail a `IntegrationConnection`, šifrování a Google OAuth utility. Existující identita připojení je firemní, proto ji nelze bezpečně použít jako osobní CalendarConnection bez změny jejího významu. Sdílí se kryptografie a Google exchange utility, nikoli osobní tokeny. |
| Kalendář a plánování | `FieldPlan` řeší provozní/terénní plán. Obsazenost ploch řeší rezervace reklamních kapacit. Ani jeden není osobní pracovní kalendář. |
| Jobs a orchestrace | Projekt používá Vercel cron endpointy a doménové služby. Nenalezen univerzální message bus/queue ani generický Goals/OKR systém vhodný k převzetí. Přidán cron do existující konfigurace. |
| Navigace a design | Použity současné navigační huby, AppShell, karty, barvy a typografie. Planner je v osobní agendě, preference v Settings. |

Hlavní rizika duplicit byla druhý Task systém, převzetí firemního OAuth jako osobního a kopie FieldPlan. Zvolená architektura je read model + služby + adaptéry nad existujícími moduly.

## B. Nová architektura

`lib/planner` obsahuje doménové typy, autorizaci, datové adaptéry, read model, preference, scheduling, správu bloků a připojení, OAuth a sync. `providers` izoluje Google normalizaci/API za `CalendarProvider`. `components/planner` odděluje cockpit, timeline, editor bloků, dostupnost a settings. React komponenty neprovádějí doménové výpočty ani přístup do DB.

Externí API jednotlivých modulů se nekopíruje: canonical task adapter čte jen potřebná pole přes tenant-safe Prisma a respektuje přístup k odpovídajícím modulům. Dokončení úkolu zůstává ve stávajícím detailu úkolu.

## C. Databáze

Přírůstková migrace `20260916170000_planner_foundation` přidává:

- `CalendarConnection`: identita `(organizationId, userId, provider, providerAccountId)`, šifrované credentials, stav a synchronizační lease.
- `ExternalCalendar`: osobní/firemní typ, viditelnost, výběr, hlavní kalendář a sync cursor.
- `ExternalCalendarEvent`: minimální normalizovaný event bez popisů a hostů; unikátní tenant + kalendář + provider event ID.
- `PlannerPreferences`: konfigurace per tenant + user.
- `PlannerBlock`: interní časový blok, kategorie práce, sourceKind/sourceId, verze a idempotency key.
- `Organization.plannerDefaults` a audit action `PLANNER_CHANGED`.

Compound foreign keys nedovolí propojit event/kalendář s cizím tenantem. Intervaly a úrovně viditelnosti mají DB constraints. Reference úkolů jsou polymorfní a validované serverem; není vytvořena kopie jejich obsahu. Interní bloky přežívají offboarding.

DB triggery při deaktivaci/smazání členství nebo zaměstnance a při deaktivaci uživatele ihned zneplatní připojení, lease, odstraní importované eventy a osobní preference. Šifrovaný revokační payload zůstává do úspěšného pokusu o Google revokaci. Guard při aktivaci připojení zamyká aktivní user/employee/membership řádky, takže souběžný OAuth callback neobnoví přístup po offboardingu. Firemní úkoly, nabídky, zakázky, historie a pracovní bloky zůstávají.

## D. Routes/API

| Route | Účel |
| --- | --- |
| `/planner` | Dnes, Týden, Tým |
| `/settings/planner` | Calendar & Planner |
| `GET /api/planner` | Osobní/týmový read model s datem a pohledem |
| `POST /api/planner/blocks` | Potvrzené vytvoření interního bloku |
| `PATCH/DELETE /api/planner/blocks/[id]` | Vlastní blok, kontrola verze |
| `GET/PUT /api/planner/settings` | Vlastní preference a admin firemní defaults |
| `PATCH /api/planner/calendars/[id]` | Vlastní výběr, hlavní kalendář, soukromí |
| `DELETE /api/planner/connections/[id]` | Odpojení vlastního účtu |
| `POST /api/planner/connections/[id]/sync` | Ruční synchronizace s rate limitem |
| `POST /api/planner/calendar/connect` | OAuth začátek |
| `GET /api/planner/calendar/callback` | OAuth callback |
| `POST /api/planner/availability` | Návrhy společných termínů; nevytváří pozvánky |
| `GET /api/cron/planner` | Autorizovaný cron, sync/revokace |

## E. UI

Dnes nabízí další událost, evidovanou volnou kapacitu, časovou osu, nejvýše pět priorit, termíny/kolize a volná hodinová focus okna. Týden zobrazuje sedm dní od vybraného data včetně termínů kanonických úkolů. Tým je pouze pro ADMIN/MANAGER a zobrazuje kapacitu, důležité úkoly, termíny a hledání společného času.

Editor ukládá interní blok až po kliknutí uživatele. Úkoly se propojují referencí. Při překryvu interních bloků nebo zastaralé verzi vrací server konflikt. Překryvy s externím kalendářem se zobrazují v upozorněních; ruční plánování není automatické přesouvání Google událostí.

Settings obsahuje pracovní dny/hodiny, časovou zónu, oběd, focus/meeting hodiny, buffer a časy bez schůzek. Admin může nastavit firemní defaults pro uživatele bez vlastních preferencí a publikovat kalendář připojený svým účtem jako firemní. Nemůže převzít osobní credentials kolegy.

Jsou ošetřené prázdné úkoly/kalendáře, vypnutý modul, nepřipojený Google, nutnost nového připojení, chyba synchronizace, obsazený den, nenalezený společný termín a neaktivní AI. Dostupnost je označena jako evidovaná, protože nepřipojené/neaktuální kalendáře nejsou důkazem volného času.

## F. Google Calendar a sync

OAuth používá per-user/per-tenant identitu, PKCE, desetiminutovou šifrovanou HTTP-only SameSite cookie a náhodný state nonce. Callback kontroluje současného uživatele a firmu. Verifier ani tokeny nejsou v URL; bez cookie není fallback. Refresh token je uložen AES-GCM, access token existuje pouze během serverového požadavku. Public response selektory neposílají credentials.

Scopes: `openid`, `email`, `calendar.calendarlist.readonly`, `calendar.events.readonly`. Google adapter je v této fázi read-only. Free/busy se počítá z autorizované normalizované projekce uložených událostí; nejde o živý Google FreeBusy API dotaz.

Sync: první import, stránkování, `syncToken`, tombstones, upsert, změny a smazané kalendáře; HTTP 410 spouští nový import. Full sync pracuje s oknem −30/+120 dní a obnovuje se nejpozději po týdnu. Incremental request nepoužívá timeMin/timeMax. Každá kompletně načtená stránkovaná sada a její cursor se ukládá transakčně. Lease zamezuje souběžným jobům, opakovaný import nevytváří eventy podruhé. Chyby mají bezpečné kódy a retry po 15 minutách, zrušený token vyžaduje nové připojení.

Cron běží každých 15 minut; platformní dotaz vybírá pouze identifikátory/stavy čekající práce, zpracování probíhá v tenant kontextu. Revokace pokračuje i u vypnutého Planneru. MVP nemá webhooky, tudíž nemá druhý scheduler ani webhook provisioning.

Provider provoz má záměrné limity: nejvýše 500 kalendářů, 10 stránek/20 000 eventů na jeden kalendář, 50 připojení na cron běh a časový budget. Nadlimitní import skončí bezpečnou chybou; pro velké instalace bude potřeba pokračovat joby po menších dávkách.

Dokumentace Google: [scopes](https://developers.google.com/workspace/calendar/api/auth), [incremental sync](https://developers.google.com/workspace/calendar/api/guides/sync).

## G. Tenant isolation

Každé Planner API ověřuje session, aktivní organizaci, členství, roli a feature flag serverem. Mutace navíc ověřují Origin. Každý datový dotaz používá tenant-scoped Prisma a explicitní organizationId; klient nesmí přepsat kontext. Jedinou platformní výjimkou je autorizovaný cron dispatch metadat. Nové modely pokrývá stávající tenant security guard.

## H. Permissions a privacy

Připojení a jeho nastavení může spravovat jen vlastník ve stejné firmě. Manažerská role sama o sobě nezpřístupňuje soukromé detaily. Výchozí FREE_BUSY odstraňuje název i místo; WORK_DETAILS odhalí jen explicitně veřejné Google eventy (default/private jsou skryté); FULL musí vybrat vlastník. Transparentní eventy bez povolení detailů se nezobrazují. Firemní kalendáře jsou přístupné v tenantovi se stejným privacy filtrem. Detaily bloků kolegů se nezobrazují.

## I. AI preparedness a planned vs actual

AI není aktivována. Upozornění a sloty jsou deterministické, nikoli generovaný briefing. `PlannerContext` přijímá jen autorizované projekce a `PlannerProposal` má povinné `requiresConfirmation: true`. Budoucí AI musí před potvrzeným zápisem znovu ověřit oprávnění, verzi i dostupnost a zaznamenat audit.

Kategorie bloků a reference umožňují později porovnávat plán s existujícím `WorkEntry`. Morning briefing, persisted suggestions, goals, meeting brief, follow-up, Gmail kontext a actual-time agregace nejsou součástí Foundation. Nevznikly pro ně předčasné duplicitní modely. Provider interface obsahuje volitelné budoucí zápisy, které Google implementace nepodporuje.

## J. Ověření

Finální regresní sada: **757 prošlo, 4 přeskočeno, 0 selhání** (761 testů včetně vnořených testů). Cílená sada Planner + navigace: **18/18**. Tenant security guard a browser ověření prošly. Lint nových Planner souborů dokončil běh bez hlášených chyb. Testovací artefakty jsou lokálně v `tmp/planner/` a nevstupují do Gitu.

Finální `next build` dokončen s exit code 0 včetně TypeScript kontroly a všech nových routes; build ID `J6HeensgUGsZN3nBIlNmX`. `git diff --check` prošel. Migrace byla aplikována pouze v izolované PostgreSQL testovací databázi, nikoli v produkci.

- `tests/planner-security.test.ts`: tenant scoping, vlastnictví, privacy, AI-ready projekce, offboarding, OAuth state a opt-in flags.
- `tests/planner-scheduling.test.ts`: překryvy, DST, pracovní doba, buffer, oběd, zakázané intervaly, obsazený den, all-day/tombstones a preference.
- `tests/planner-migration.test.ts`: skutečný PostgreSQL přes PGlite; aplikace migrace, idempotentní upsert, compound tenant FK, deaktivace/smazání členství, deaktivace zaměstnance/uživatele, zákaz opětovného připojení a zachování interní práce.
- `tests/planner.browser.mjs`: skutečné React komponenty v Chromium s mock API; mobil 390 px, Dnes/Týden/Tým, potvrzené uložení task reference, preference, absence horizontálního přetékání a browser chyb. Nejde o živé ověření Google ani produkční DB.
- Regresní navigační test zachovává původních 36 položek a ověřuje přidané dvě položky podle rolí a flags.

## K. Aktivace a zbývající práce

1. Před nasazením nové aplikace aplikovat migraci standardním `npm run db:migrate:deploy` proti správnému prostředí. Nový Prisma klient čte také `Organization.plannerDefaults`, takže samotný vypnutý feature flag chybějící migraci nenahrazuje. Migrace je kompatibilní s předchozí aplikací a nebyla během lokální implementace spuštěna v produkci.
2. V Google Cloud zapnout Calendar API a přidat přesnou callback URL `https://<app-origin>/api/planner/calendar/callback`. OAuth consent/scopes musí odpovídat produkčnímu publiku aplikace.
3. Použít existující Google OAuth konfiguraci a šifrovací klíč: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_STATE_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, případně `GOOGLE_OAUTH_REDIRECT_ORIGIN`. Ověřit `CRON_SECRET`. Žádné hodnoty tajemství nejsou v tomto reportu ani v klientovi.
4. Tenantovi explicitně zapnout `planner`, podle potřeby `googleCalendar`. `aiPlanner` ponechat vypnutý; samotný flag v této verzi AI nespouští.
5. Každý uživatel připojí svůj účet, synchronizuje seznam, vybere kalendáře a synchronizuje eventy. Pro živé end-to-end ověření je potřebný jeho Google souhlas.

Další iterace: menší background job dávky pro velké týmy, přímé Google free/busy a monitoring stáří zdrojů, společné resource rezervace, rozsáhlejší integrační testy provider retry/lease závodů proti síťovým fixtures a pokročilejší kapacita s odhady práce. Týmový přehled zatím odhaduje přetížení pouze z dostupných odhadů úkolů s termínem v zobrazeném období; chybějící odhady nenahrazuje vymyšlenými hodinami.

Produkční migrace, nasazení a živý Google OAuth nejsou součástí ověřeného lokálního výsledku. Phase 2/3 zůstávají záměrně oddělené.
