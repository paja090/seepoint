# SeePoint – report multi-tenant SaaS foundation

Datum implementace: 2026-08-23

## A. Analýza původního stavu

Původní aplikace byla důsledně jednofiremní. Session určovala globálního `User` a roli, ale ne organizaci. Všechny business tabulky byly sdílené a běžné Prisma operace (`findMany`, `findUnique`, `update`, `delete`, `count`, `aggregate`, relační dotazy) neměly tenant filtr. Změna ID v endpointu proto po přidání druhé firmy mohla zpřístupnit cizí záznam.

Schéma mělo 81 modelů. Globální byly nejen autentizační modely, ale fakticky všech 77 doménových modelů. Záměrně globálními systémovými zdroji pravdy nyní zůstávají pouze `User`, `UserSession`, `UserToken`, `RateLimitBucket` a platformní `Organization`. Prisma enumy jsou společná systémová metadata.

Riziková globální uniqueness byla zejména na názvu/kódu klienta, e-mailu zaměstnance, kódu a importním klíči nosiče/plochy/obsazenosti, kódu cenového pravidla, verzi ceníku a číslech faktur, CRM zakázek a smluv. Veřejná nabídka navíc historicky přijímala jako fallback přímo ID nabídky.

## B. Databázové změny

Přibyly modely `Organization`, `OrganizationMember`, `OrganizationInvitation`, `OrganizationOnboarding` a enumy `PlatformRole`, `OrganizationRole`, `OrganizationPlan`, `SubscriptionStatus`, `InventoryVisibility`, `OrganizationOnboardingStep`. `User.email` zůstal globálně unikátní a uživatel může mít více členství. `UserSession` má `activeOrganizationId`. První historický ADMIN je při migraci deterministicky povýšen na jediného `SUPER_ADMIN`; běžný organizační ADMIN se platformním správcem nestává.

`organizationId` dostalo 77 business modelů:

`UserAuditLog`, `Employee`, `EmployeeBillingProfile`, `EmployeeRate`, `Client`, `AdvertisingCarrier`, `WorkTask`, `Settlement`, `SettlementItem`, `Vehicle`, `VehicleReservation`, `VehicleServiceRecord`, `VehicleFuelExpense`, `EmployeeAbsence`, `ChatMessage`, `ChatRead`, `AdvertisingSurface`, `Occupancy`, `Offer`, `SalesOpportunity`, `NavigationOffer`, `NavigationPoint`, `NavigationDocumentationReport`, `NavigationDocumentationItem`, `NavigationReportAuditLog`, `CityGalleryProject`, `CityGalleryFleetConfig`, `CityGalleryOffer`, `MediaPackage`, `MediaPackageRule`, `OfferPackageSelection`, `OfferPriceRule`, `OfferCharge`, `OfferItem`, `OfferEvent`, `Photo`, `ImportBatch`, `PriceListItem`, `ImportRowError`, `WorkOrder`, `WorkAssignment`, `WorkOrderItem`, `WorkOrderRate`, `CompanyRate`, `WorkEntry`, `WorkExpense`, `RecurringAdjustment`, `SettlementAdjustment`, `SystemSettings`, `SettlementAuditLog`, `Invoice`, `InvoiceItem`, `ClientContact`, `ClientBranch`, `CrmOrder`, `CrmRealization`, `ClientContract`, `ClientInvoice`, `ClientInvoiceItem`, `ClientCommunication`, `CrmTask`, `ClientDocument`, `CrmAuditLog`, `ClientMergeLog`, `NavigationOrder`, `SurveyRoute`, `NavigationCandidatePoint`, `NavigationBillingPeriod`, `NavigationPriceVersion`, `NavigationPriceAuditLog`, `NavigationContract`, `NavigationContactPerson`, `CarrierHistoryLog`, `CompanyShoppingItem`, `WarehouseItem`, `WarehouseMovement`, `QuickInternalTask`.

Další tři modely s `organizationId` jsou tenantová infrastruktura `OrganizationMember`, `OrganizationInvitation` a `OrganizationOnboarding`. Celkem tedy schéma obsahuje 85 modelů, z nichž 80 nese přímé vlastnictví organizace.

Globální natural-key uniqueness byla nahrazena složenými unikátními indexy s `organizationId`. Všechny business modely mají index na `organizationId`; časté membership, status a pozvánkové dotazy mají cílené složené indexy. `AdvertisingCarrier` a `AdvertisingSurface` mají oddělené vlastnictví a budoucí `visibility`, nyní vždy `PRIVATE`.

## C. Bezpečnost

Tenant isolation má tři vrstvy:

1. `AsyncLocalStorage` drží serverový `TenantContext`, který vzniká pouze z ověřené session/membership, platného veřejného tokenu, platformní administrace nebo explicitního CLI tenant parametru.
2. Prisma query extension automaticky přidává `organizationId` do všech čtení, zápisů, agregací a mazání nad 77 business modely. Pokus poslat jiné `organizationId` je odmítnut. Bez tenant kontextu business dotaz selže zavřeně.
3. Migrační SQL přidává tenantové složené cizí klíče mezi business tabulkami. Ani přímý scalar FK zápis proto nemůže propojit záznamy různých organizací.

Raw SQL zámky nad business daty obsahují explicitní `organizationId`. Nechráněný `platformPrisma` je úmyslně omezen na autentizaci, platformní administraci a první lookup kryptografického veřejného tokenu. Cizí ID se v běžném API kvůli automatickému filtru chová jako neexistující záznam (404/P2025), nikoli jako potvrzení existence.

Veřejné nabídky už nepřijímají ID nabídky jako token. Tenant se bootstrapuje pouze přes globálně unikátní hash silného tokenu a teprve poté se načte nabídka v tenant kontextu. Totéž platí pro navigační reporty a jejich fotografie. Veřejné stránky používají logo, název a kontakty vlastní organizace.

AI, dashboardy, import API, exportní query a výběr inventory používají stejný centrální guard. CLI import vyžaduje/akceptuje explicitní `--organization-id` (se zpětně kompatibilním defaultem SeePoint), ověří aktivní organizaci a raw occupancy dotaz filtruje tenantem.

## D. Migrace dat

Bezpečná explicitní migrace je v `prisma/migrations/20260823120000_multi_tenant_foundation/migration.sql`.

Postup migrace:

1. vytvoří organizaci `SeePoint` se slugem `seepoint` a stabilním ID `org_seepoint_default`;
2. přidá `organizationId` nejprve jako nullable;
3. přiřadí defaultní organizaci všem historickým business řádkům;
4. převede historické singleton konfigurace na tenantová ID;
5. vytvoří memberships pro existující uživatele a nastaví aktivní organizaci session;
6. teprve poté nastaví `NOT NULL`, FK, indexy a tenantové unique constraints.

Migrace nic nemaže. Historické soubory v Google Drive se fyzicky nepřesouvají; jejich databázové vlastnictví je tenantové. Nové uploady jdou do podsložky organizace a dostávají metadata `seepointOrganizationId`.

Migrační postup byl následně ověřen na Vercel preview databázi. Čtyři starší migrace, jejichž změny už v databázi fyzicky existovaly, byly po katalogové kontrole označeny jako aplikované; poté byla multi-tenant migrace nasazena příkazem `prisma migrate deploy`. Produkční databáze zůstala beze změny.

## E. Authentication

Session ukládá `userId` prostřednictvím stávajícího bezpečného hashovaného session tokenu a nově `activeOrganizationId`. Server při každém načtení uživatele ověří, že organizace i membership jsou aktivní. U jednoho členství se tenant zvolí automaticky; u více členství jej uživatel mění přes serverově validovaný switch endpoint.

RBAC je rozdělen na platformní `SUPER_ADMIN` a organizační `OWNER`, `ADMIN`, `MANAGER`, `SALES`, `TECHNICIAN`, `WORKER`, `ACCOUNTANT`, `VIEWER`. Pro zpětnou kompatibilitu se OWNER v existujícím aplikačním RBAC chová jako ADMIN. Pozvánka nese organizaci, e-mail, roli, hash tokenu a expiraci a po přijetí/aktivaci vytváří membership; existující globální účet lze připojit k další firmě.

## F. API

Přímo bylo upraveno nebo přidáno 29 route handlerů (23 existujících a 6 nových). Centrální Prisma guard současně chrání všechny autentizované business endpointy v projektu, takže bezpečnost nestojí na ručním doplnění filtru do každého ze 177 handlerů. Zvláštní kontrola proběhla pro klienty, nosiče/plochy, nabídky, fotografie, work orders, zaměstnance, navigaci, dashboard, AI, importy a onboarding.

## G. UI

Přibylo:

- přepínání organizace v topbaru;
- `/settings/company` pro firemní, fakturační a branding údaje;
- `/settings/members` pro pozvání kolegů;
- `/admin/organizations` a `/admin/organizations/[id]` pro SUPER_ADMIN, včetně aktivace/deaktivace a statistik;
- `/onboarding` s pěti resumable SaaS kroky, uloženým průběhem a automatickým rozpoznáním aktivního OWNERA, inventory a členů;
- tenant branding veřejných nabídek.

Vzhled a existující navigační struktura zůstaly zachované. React review vedl také k oddělení čistých navigačních constraintů od serverového Prisma resolveru, takže tenant/server kód není bundlován do klienta.

## H. Testy

- `npm run typecheck`: **PASS**
- `npm test`: **PASS – 253/253 testů**
- `npm run security:tenant`: **PASS – platform bypass, raw SQL a API route guard baseline**
- `npm run build`: **PASS – Next.js production build, 80 statických stránek vygenerováno**
- Prisma generate + preview `migrate deploy`: **PASS**
- Vercel preview deploy: **PASS – `dpl_DEn6EES3KHsJhcmPpD99Cn3q7dfM`**
- Browser smoke test: **PASS – login, dashboard, clients, offers, AI radar, company settings, members, organization switcher, onboarding a SUPER_ADMIN administrace**
- Živý dvoutenantový E2E test: **PASS – SeePoint + Agentura B, shodný klient `McDonald's`, vlastní inventory, AI nabídka, CRM zakázka a Sales Opportunity**
- Cross-tenant API test: **PASS – vlastní klient 200, cizí čtení 404, cizí update 404, podvržené `organizationId` 404**
- Cross-tenant browser test: **PASS – cizí klient a nabídka vracejí bezpečnou 404 v obou směrech**
- AI inventory test: **PASS – Agentura B obdržela jedinou vlastní plochu, žádnou z ploch SeePointu**
- Dashboard test: **PASS – Agentura B počítá 1 plochu; SeePoint zachoval vlastní statistiky**
- Invitation lifecycle E2E: **PASS – seznam, změna role, resend, revokace, starý i zrušený token 400, cizí tenant 404**
- Onboarding unit isolation: **PASS – průběh organizace A neovlivňuje evidenci organizace B; uložené kroky se obnoví a dokončí na 100 %**
- Runtime error log po finálním průchodu: **bez chyb**

Nový test suite pokrývá izolovaný seznam klientů, cizí ID/read/update/delete, stejné jméno klienta ve dvou firmách, jeden e-mail ve více organizacích, AI inventory scope, dashboard agregace, veřejný offer token a automatické vlastnictví všech tenant modelů.

## I. Známá rizika

1. Migrační SQL bylo ověřeno na preview databázi, nikoli proti produkční databázi. Před produkčním deployem je stále nutný backup a kontrola počtů řádků před/po migraci.
2. Pozvánka, aktivace a přihlášení druhého nezávislého uživatele Agentury B byly ověřeny. Zbývá zprovoznit produkční doručování: Resend vyžaduje ověřit doménu `seepoint.cz`; současný Google OAuth token nemá scope `gmail.send`.
3. `platformPrisma` zůstává nutný escape hatch, ale nové nebo změněné použití, raw SQL, přímý `PrismaClient` a API handlery bez organization/auth guardu nyní blokuje CI. V GitHubu je ještě potřeba nastavit workflow jako povinný branch-protection check.
4. Historické Drive soubory mají logické DB ownership a canonical storage keys, ale nejsou fyzicky přesunuté do tenant podsložek. Provider-neutral vrstva je připravená; konkrétní privátní Blob/GCS adaptér a obrazové varianty je ještě potřeba připojit.
5. Onboarding má resumable tenantový stav, ale ještě nemá e-mailové šablony plně podle brandingu ani samoobslužné tarifní/billing kroky. Marketplace a sdílení inventory jsou záměrně pouze připravené datovým modelem.

## J. SaaS readiness

**SeePoint SaaS readiness: 95 %**

Pět nejdůležitějších kroků před onboardingem první externí reklamní agentury:

1. Udělat zálohu produkce, aplikovat ověřenou migraci v řízeném okně, porovnat row county a provést rollback rehearsal.
2. Ověřit doménu `seepoint.cz` v Resendu a provést akceptační test skutečného doručení pozvánky a resetu hesla.
3. Nastavit GitHub branch protection tak, aby workflow `Tenant security` bylo povinné před sloučením změn.
4. Provést audit Google Drive/storage ACL a připravit řízenou migraci historických souborů podle organizací.
5. Doplnit provozní observability/audit alerty a runbook pro deaktivaci, obnovu a podporu tenanta.
