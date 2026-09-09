# SeePoint – závěrečná zpráva technického zpevnění

Ověřovaný základ: `main` **7f1e98f**, zapracovaný do `codex/saas-hardening-current` (merge **abf4fea**). Práce je v izolovaném worktree `.worktrees/saas-hardening-current`. Produkční nasazení ani změny produkčních dat nebyly provedeny.

## 1. Audit

Podrobný audit etap: [HARDENING_AUDIT.md](HARDENING_AUDIT.md). Doménové návrhy a omezení: [HARDENING_READINESS.md](HARDENING_READINESS.md).

Nalezeny nechráněné nové tenant modely, chybějící backend entitlements, duplicitní printProduction, přepočítávané deterministické URL, nevalidované výrobní vazby a přechody, oddělené CRM zápisy, falešné KPI/impresní údaje a ignorované build chyby. Novější main již obsahoval univerzální importer, aktualizace AI a mobilní synchronizace: zachovány, nevytvářeny znovu. V nejnovějším main doplněna ochrana nových e-mailových modelů, ručního radar cronu, notifikací a opětovného připojení domény.

## 2. Změněné soubory

Seznam vůči main 7f1e98f (bez lokálních env, logů a prohlížečových artefaktů):

- `.github/workflows/tenant-security.yml`
- `app/analytics/page.tsx`
- `app/api/absences/route.ts`
- `app/api/ai/parse-quick-tasks/route.ts`
- `app/api/crm/orders/convert-from-offer/route.ts`
- `app/api/cron/sales-radar/route.ts`
- `app/api/employees/[id]/account/route.ts`
- `app/api/employees/[id]/billing/route.ts`
- `app/api/employees/[id]/rates/[rateId]/route.ts`
- `app/api/employees/[id]/rates/route.ts`
- `app/api/employees/[id]/route.ts`
- `app/api/employees/cleanup/route.ts`
- `app/api/employees/route.ts`
- `app/api/imports/[batchId]/analyze/route.ts`
- `app/api/imports/[batchId]/commit/route.ts`
- `app/api/imports/[batchId]/dry-run/route.ts`
- `app/api/imports/[batchId]/map/route.ts`
- `app/api/imports/history/route.ts`
- `app/api/imports/upload/route.ts`
- `app/api/mobile-photos/campaigns/route.ts`
- `app/api/navigation/orders/[id]/invoice/route.ts`
- `app/api/navigation/orders/[id]/price/route.ts`
- `app/api/navigation/orders/[id]/route.ts`
- `app/api/navigation/orders/[id]/survey/candidates/[candidateId]/convert/route.ts`
- `app/api/navigation/orders/[id]/survey/candidates/[candidateId]/route.ts`
- `app/api/navigation/orders/[id]/survey/candidates/[candidateId]/supervise/route.ts`
- `app/api/navigation/orders/[id]/survey/candidates/route.ts`
- `app/api/navigation/orders/[id]/survey/route.ts`
- `app/api/navigation/orders/[id]/survey/routes/route.ts`
- `app/api/navigation/orders/route.ts`
- `app/api/navigation/surveys/route.ts`
- `app/api/network/demands/route.ts`
- `app/api/network/holds/route.ts`
- `app/api/network/inventory/route.ts`
- `app/api/network/notifications/route.ts`
- `app/api/network/partners/route.ts`
- `app/api/network/proofs/route.ts`
- `app/api/network/settlements/route.ts`
- `app/api/notifications/unread/route.ts`
- `app/api/occupancy/bulk/route.ts`
- `app/api/offers/[id]/revoke-portal/route.ts`
- `app/api/quick-search/route.ts`
- `app/api/quick-tasks/[id]/route.ts`
- `app/api/quick-tasks/route.ts`
- `app/api/route/route.ts`
- `app/api/sales/opportunities/[id]/feedback/route.ts`
- `app/api/sales/opportunities/[id]/link-crm/route.ts`
- `app/api/sales/opportunities/[id]/route.ts`
- `app/api/sales/opportunities/auto-discover/route.ts`
- `app/api/sales/opportunities/parse-input/route.ts`
- `app/api/sales/opportunities/route.ts`
- `app/api/sales/opportunities/scheduled-discovery/route.ts`
- `app/api/sales/radar/profile/route.ts`
- `app/api/sales/radar/runs/route.ts`
- `app/api/settings/email/connect/route.ts`
- `app/api/settlements/[id]/[action]/route.ts`
- `app/api/settlements/[id]/adjustments/route.ts`
- `app/api/settlements/adjustments/[adjustmentId]/route.ts`
- `app/api/shopping-items/[id]/route.ts`
- `app/api/shopping-items/[id]/toggle/route.ts`
- `app/api/shopping-items/options/route.ts`
- `app/api/shopping-items/route.ts`
- `app/api/surfaces/[id]/client/route.ts`
- `app/api/vehicles/[id]/route.ts`
- `app/api/vehicles/[id]/service/route.ts`
- `app/api/warehouse/ai-import-photo/route.ts`
- `app/api/warehouse/items/[id]/restock/route.ts`
- `app/api/warehouse/items/[id]/route.ts`
- `app/api/warehouse/items/route.ts`
- `app/api/warehouse/movements/route.ts`
- `app/api/warehouse/photo-recognition/route.ts`
- `app/api/warehouse/voice-issue/route.ts`
- `app/api/webhooks/resend/route.ts`
- `app/api/work-entries/[id]/confirm/route.ts`
- `app/api/work-entries/[id]/correct/route.ts`
- `app/api/work-entries/[id]/return/route.ts`
- `app/api/work-entries/[id]/route.ts`
- `app/api/work-entries/resolve-rate/route.ts`
- `app/api/work-entries/route.ts`
- `app/api/work-entries/submit/route.ts`
- `app/api/work-expenses/[id]/approve/route.ts`
- `app/api/work-expenses/[id]/reject/route.ts`
- `app/api/work-orders/[id]/acknowledge/route.ts`
- `app/api/work-orders/[id]/rates/[rateId]/route.ts`
- `app/api/work-orders/[id]/rates/route.ts`
- `app/api/work-orders/[id]/status/route.ts`
- `app/api/work-orders/pdf-upload/route.ts`
- `app/mobile-surveys/[id]/page.tsx`
- `app/mobile-surveys/page.tsx`
- `app/module-unavailable/page.tsx`
- `app/my-settlements/[id]/page.tsx`
- `app/network/page.tsx`
- `app/production/PrintProductionDashboard.tsx`
- `app/production/actions.ts`
- `app/production/page.tsx`
- `app/production/public-actions.ts`
- `app/projects/city-inventory/page.tsx`
- `app/sales/opportunities/page.tsx`
- `app/settings/email/page.tsx`
- `app/settlements/[id]/page.tsx`
- `app/shopping/page.tsx`
- `app/vacations/page.tsx`
- `app/work/page.tsx`
- `app/work/route/page.tsx`
- `components/campaign-portal/CampaignLiveMap.tsx`
- `components/campaign-portal/CampaignLivePortalView.tsx`
- `components/campaign-portal/PrintApprovalModule.tsx`
- `components/imports/ImportHistoryList.tsx`
- `components/imports/UniversalImportWizard.tsx`
- `components/offers/GoogleNavigationOfferMap.tsx`
- `docs/DEFINITION_OF_DONE.md`
- `docs/HARDENING_AUDIT.md`
- `docs/HARDENING_READINESS.md`
- `docs/HARDENING_RELEASE.md`
- `e2e/database-check.ts`
- `e2e/hardening.spec.ts`
- `e2e/seed.ts`
- `lib/ai-usage.ts`
- `lib/api-auth.ts`
- `lib/auth.ts`
- `lib/email-domain-ownership.ts`
- `lib/imports/ai-mapping.ts`
- `lib/imports/dry-run.ts`
- `lib/imports/executor.ts`
- `lib/imports/json.ts`
- `lib/imports/parser.ts`
- `lib/imports/profile-service.ts`
- `lib/maps/ostrava-restricted-zones-data.ts`
- `lib/module-access.ts`
- `lib/module-policy.ts`
- `lib/notifications-service.ts`
- `lib/offers/service.ts`
- `lib/offers/token.ts`
- `lib/opportunities/discovery-runner.ts`
- `lib/opportunities/scoring.ts`
- `lib/organization-modules.ts`
- `lib/page-auth.ts`
- `lib/production/production-policy.ts`
- `lib/production/production-service.ts`
- `lib/public-tenant.ts`
- `lib/resend-service.ts`
- `lib/tenant-prisma.ts`
- `lib/tenant-request-context.ts`
- `lib/tenant-result.ts`
- `lib/vehicle-deadlines.ts`
- `lib/work-absence-conflicts.ts`
- `next.config.mjs`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `prisma/migrations/20260907120000_permanent_portal_credentials/migration.sql`
- `prisma/migrations/20260908210000_email_domain_ownership/migration.sql`
- `prisma/schema.prisma`
- `scripts/check-tenant-security.mjs`
- `tests/absences.test.ts`
- `tests/current-main-security.test.ts`
- `tests/multi-tenant-isolation.test.ts`
- `tests/navigation-invoice.test.ts`
- `tests/production-transactions.test.ts`
- `tests/saas-hardening.test.ts`
- `tests/shopping.test.ts`

Dále tento report a pravidla ignorování lokálních testovacích artefaktů v `.gitignore`.

## 3. Bezpečnostní opravy

Centrální tenant registry + automatická detekce modelů; zrušen fallback na organizaci bez aktivního členství; centrální kontrola modulů na pages/API/actions; scope agregovaných notifikací a vyhledávání; kontrola všech načtených tenant objektů veřejného portálu; validace výrobních FK a atomické přechody; náhodné šifrované permanentní tokeny a auditovaný administrátorský revoke. Ruční cron běží pouze pro organizaci oprávněného volajícího; globální běh vyžaduje CRON_SECRET. E-mailový webhook ověřuje podpis před platformním lookupem a zapisuje pod rozpoznaným tenantem. Již registrovanou doménu nelze převzít pouhým zadáním jejího jména. Nový fallback z main zachovává připojení pomocí explicitního klíče ověřeného poskytovatelem; unikátní DB indexy nadále brání přiřazení domény další organizaci.

## 4. Permanentní portál

Nový token vzniká jednou z 32 kryptograficky náhodných bajtů. DB obsahuje SHA-256 lookup hash a AES-256-GCM šifrovanou kopii s ID klíče a vazbou na Offer ID. Publish/odeslání zachovají existující hash. Změna obchodního stavu, CRM, výroby či fotografií token nemění. Čtení veřejného URL závisí na uloženém hashi, nikoliv na přepočtu ze secretu.

Legacy URL nadále používá tentýž lookup. Interní kopírování legacy URL zkouší dosavadní a explicitně uchované staré secrety, ale přijme pouze token odpovídající uloženému hashi. Pokud ho nelze obnovit, nedochází k přepsání hashe a klientův uložený odkaz dál funguje. Rotace šifrovacího klíče musí zachovat staré klíče pro dešifrování. Schválená nabídka pokračuje do již existujícího live portálu.

Nouzový `POST /api/offers/[id]/revoke-portal` vyžaduje ADMIN, aktivní modul, `confirmed: true` a důvod; ukládá explicitní revocation a audit. Workflow jej automaticky nevolá. Deaktivovaná organizace nebo vypnutý modul nadále znamenají zamítnutý přístup; nejde o změnu URL.

## 5. Tenant isolation

Runtime detekuje modely podle organizationId v Prisma DMMF. Security gate porovnává Prisma schema s explicitně zkontrolovaným seznamem a selže při novém nezaregistrovaném modelu. Výjimky OrganizationMember a OrganizationInvitation slouží platformnímu identity bootstrapu. Platformní klient a raw SQL mají vlastní explicitní baseline. Production navíc ověřuje Offer/Client FK a jejich vzájemnou shodu. Nelze tím tvrdit, že všechny historické scalar FK napříč celým ERP dostaly databázové composite constraints; to zůstává samostatná etapa.

## 6. SaaS plans

Sdílená policy kontroluje autentizaci, aktivní organizaci, aktivní členství se shodným ID, RBAC a povolený modul. Page guard přesměruje na module-unavailable, API vrací 403 a server action odmítá. Neznámý plán je fail-closed START. Module IDs mají test unikátnosti; route matching volí nejdelší platnou shodu. Entitlements platí i pro nově přidaný import/radar a agregované výstupy.

## 7. Production

Přechody: PREPARATION → CLIENT_APPROVAL → IN_PRINT → DELIVERED_TO_WAREHOUSE. Žádné automatické návraty. Create: ADMIN/MANAGER/SALES; interní změny také TECHNICIAN. Runtime whitelist validuje množství, enum, datum, texty a HTTP(S) artwork URL. Public approval vyžaduje správný portál, organizaci, job a stav; podruhé se odmítá. Nepoužívá se nový samostatný approval bearer token.

Významné změny používají stávající CrmAuditLog s předchozím/novým stavem, organizací, job ID, aktérem, časem a poznámkou. Serializable transakce a compare-and-set brání nekontrolovaným přechodům. CRM se označí PRODUCED až po dokončení všech tiskových jobů nabídky; audit a CRM jsou součástí stejné transakce. Nevytváří se duplicitní skladový pohyb. KPI se počítají z dat; konstantní odhad zásahu byl odstraněn.

## 8. Database migrations

- `20260907120000_permanent_portal_credentials`: dvě nullable Offer pole a povolení NULL audit userId pro veřejného aktéra. Bez regenerace tokenů a bez mazání dat.
- `20260907210000_multi_tenant_resend_email_system`: převzato z aktuálního main, nové e-mailové tabulky.
- `20260908210000_email_domain_ownership`: dva unikátní indexy domény/provider ID. Předem zkontrolovat případné duplicity; nevynucovat jejich odstranění automaticky.

Na izolované Neon větvi prošly migrace v opraveném pořadí. První test chytil předčasný index před vytvořením tabulky; neúspěšný krok byl označen rolled back a opravená migrace prošla. Produkční databáze nebyla změněna. Automatické migrace se nevracejí do paralelních Vercel buildů.

## 9. Testy

Regresní sada (`npm test` i přímé spuštění tsx):

```text
tests: 453
passed: 453
failed: 0
skipped: 0
```

Skutečná PostgreSQL integrace na izolované větvi:

```text
tests: 10
passed: 10
failed: 0
```

Ověřuje cizí job read/update, cizí Offer/Client, neplatný přechod, platné schválení, replay, skutečný rollback a atomické CRM/audit dokončení. Syntetická data jsou ve třech nových testovacích organizacích; nebyly upravovány zákaznické organizace.

Playwright: PASS proti finálnímu buildu main 7f1e98f, instalovaný Chrome:

```text
tests: 3
passed: 3
failed: 0
```

Scénáře: START nemá Warehouse přes page ani GET/POST API; klient vlastní organizace je dostupný a klient cizí organizace odmítnutý; permanentní accepted/live URL zobrazuje portál i po reloadu a neuvádí falešný zásah. První běh na dřívějším buildu měl timeout prvního přihlášení; opakování bez zvýšení limitu i závěrečný běh nového buildu prošly. Poslední běh trval 59,5 s. Nejde o úplný test capture → offline → instalace → upload fotky.

## 10. Security check

`npm run security:tenant`: PASS; závěrečný přímý běh stejného skriptu rovněž `Tenant security guard: OK`.

## 11. Typecheck

`npm run typecheck`: PASS, exit 0 nad aktualizovaným Prisma klientem a sloučeným main.

## 12. Lint

`npm run lint`: PASS, exit 0; 0 errors, 389 warnings nad posledním main. Původní chyba any v e-mailové stránce byla opravena runtime validací DNS JSON. Následný produkční build se zapnutým lintem také prošel. Zbývající warnings jsou technický dluh; nebyly skryty změnou pravidel.

## 13. Build

`npm run build`: PASS, exit 0, Next.js 15.5.25. TypeScript ani ESLint bypass nejsou zapnuty. Lokální vnořené worktree vyvolává informativní warning o několika lockfiles; build dokončen. CI nově spouští npm ci, tenant security, lint, typecheck, testy a build s bezpečnými testovacími env.

## 14. Environment variables

Nové pro permanentní portál ve Vercelu:

- `OFFER_PORTAL_KEYS`: JSON keyring; každá hodnota je base64 32bajtového klíče.
- `OFFER_PORTAL_ACTIVE_KEY`: ID aktivního klíče z keyringu.
- `OFFER_PORTAL_LEGACY_SECRETS`: volitelný JSON seznam dřívějších secretů pro interní obnovu legacy URL; neměnit kvůli tomu existující hash.

Dosavadní NEXTAUTH_SECRET/CRON_SECRET nemažte při tomto přechodu. Zachovejte staré šifrovací klíče. Z e-mailové implementace nového main pocházejí RESEND_API_KEY, RESEND_WEBHOOK_SECRET a EMAIL_CREDENTIALS_ENCRYPTION_KEY; jejich nastavení se řídí používáním této funkce. E2E_* proměnné patří pouze lokálnímu testování, ne produkci. Hodnoty secretů nejsou součástí této zprávy ani Gitu.

## 15. Production deployment

1. Review diffu a migrací; ověřit aktuální cílový main a případné nové souběžné změny.
2. Preflight duplicit e-mailových domén a připravenost token keyringu/legacy secretů.
3. Recovery point/backup a ověřený rollback plán.
4. Jednou spustit prisma migrate deploy v určeném release kroku.
5. DB smoke: tabulky/indexy, zachované publicTokenHash, audit nullable aktér.
6. Nasadit aplikaci s připravenými env.
7. Smoke: původní legacy URL, nové URL, accepted/live portál, tenant B nepřístupný, START zákazy a výrobní schválení.
8. Sledovat autorizace, chyby dešifrování a transakční konflikty. Nesnižovat aplikaci na starý kód, který by mohl přepsat náhodné tokeny deterministickými; viz HARDENING_RELEASE.md.

Tato práce aplikaci do produkce nenasazuje.

## 16. Co zůstává

- Playwright základ nepokrývá kompletní instalační/mobilní/offline/fotografický happy path. Viz výsledky a explicitní rozsah testů výše.
- Soukromé jednotné storage, signed URLs, offline persistent queue a idempotence mají postupný návrh; bez riskantní migrace souborů.
- Pro budoucí editaci vydaných faktur doplnit plošné immutability/corrective-document pravidlo; stávající invoice model/snapshoty zachovány.
- AI usage sjednotit v gateway, oddělit odhad od skutečné ceny, doplnit duration/outcome. Radar označuje usage/cost jako odhad; systémový cron nyní používá NULL userId a čeká na dokončení logování.
- Není zavedena globální DB záruka pro každý historický cross-tenant scalar FK; Production a veřejný načtený graf jsou zpevněny, další domény vyžadují cílené integrační testy.
- Po nebreaking npm audit fix zůstává 7 dependency findings (4 high, 3 moderate): deepmerge-ts přes Prisma, vnořený PostCSS přes Next, uuid přes ExcelJS. Automatický force navrhuje breaking upgrady/downgrady; neprovedeny. Nutná samostatná kompatibilitní aktualizace před širším rolloutem.
- Legacy odkazy vytvořené známým fallback secretem si kvůli požadované kompatibilitě zachovávají původní předvídatelnost. Nové odkazy toto riziko nemají; podezření na kompromitaci starého URL řeší výhradně explicitní auditovaný revoke, nikoli hromadná regenerace.
- 389 lint warnings zůstává k postupnému odstranění. Automatické skladové pohyby a mezifiremní rezervace se nepřidávají.
- Izolovaná Neon větev zůstává pro opakování testů, compute má autosuspend. Její odstranění není součástí této práce.
## Aktualizace před otevřením PR

Před odesláním větve byl zapracován také main `d237773` (#311, zachování a obnova DNS záznamů), merge `2d18c08`. Tři dotčené soubory zachovávají tenant-scoped načítání a zápis. Cílená regresní sada Resend + current-main-security: 13 testů, 13 passed, 0 failed. Úplné výsledky 453 testů / 10 DB / 3 E2E výše odpovídají předchozímu ověřenému buildu nad 7f1e98f; úplné ověření posledního merge zajistí CI v PR. Produkční nasazení zůstává samostatný krok.

## Reconciliation s PR #313 a #314

Zapracován main `577a980` včetně editace odesílatele / obnovy DNS (#313) a klientské komprese fotografií / HEIC handling (#314). Zachována runtime validace DNS; nový PATCH odesílatele navíc validuje adresy a nevrací šifrovaný provider klíč. Fotografie nezavádějí persistentní offline frontu.

Lokální ověření výsledného merge: 470/470 testů, tenant security check a typecheck PASS; lint PASS, 0 errors, 386 warnings. Dřívější výsledky 10 DB / 3 browser E2E se tímto nepřepisují. CI na předchozím head c69656a prošlo včetně buildu (run 34193693574); build nového merge musí potvrdit následující CI.

## Radar: diagnostika timeoutů a oprava

Runtime preview e6f1c38 (2026-09-08 23:08 UTC) potvrdil timeout obou Gemini pokusů, přesto API hlásilo úspěch s nulovým výsledkem. Ruční discovery nyní sdílí deadline 45 s, živé hledání má 60 % rozpočtu a RSS se načítá souběžně. Parsování článků i opakované AI požadavky respektují zbývající čas. Chyby zdrojů se počítají, neúspěšný běh se ukládá jako FAILED a částečné výsledky mají upozornění. Neplatné AI odpovědi se nepletou s platným prázdným seznamem. Příležitosti bez zdrojové URL se neukládají s vymyšlenou adresou.

Cílené offline regresní testy: 13/13 PASS. Živý běh opravy musí být ověřen na novém preview; uživatel autorizoval skutečná AI volání a zápis testovacích příležitostí do izolované firmy.

### Radar live test — 2026-09-09

- Isolated preview eee7b5d real authenticated API run: 42.5 s, 75 RSS articles, 2 processed and ignored, 0 created, 1 live-search timeout correctly reported as warning.
- Direct paid provider diagnostics: gemini-2.5-flash returned HTTP 404; gemini-3.8-flash exceeded 30 s but completed with a 90 s diagnostic allowance in 33.5 s, returning 10 candidates. Only the NATO Days date was independently checked against the organizer; other candidates are not yet verified.
- Prepared manual route budget 100 s within maxDuration 120 s, shared live deadline up to 60 s, default model gemini-3.8-flash. This timing change has NOT yet been deployed or verified through CRM storage/UI.
- Integrated main baccd52 (PRs 315, 316), preserving hardening access checks. Full tests before timing adjustment: 478 passed. After timing adjustment: 13 targeted tests passed, typecheck passed; merged-source lint: 0 errors, 393 warnings.
- Pending: automated cron execution budget/multi-organization behavior, final deployed real run and source quality checks. Automatic approval review blocked migration 20260908180000_photo_survey_navigation_point on the isolated test DB; no migration applied, no production changes.

### Approved migration and deployed radar verification — 2026-09-09

- User approved the test-only photo migration. Its first attempt failed before executing SQL because the upstream SQL file started with a UTF-8 BOM. Removed the BOM, marked the failed attempt rolled back, then successfully applied the migration to the verified isolated Neon host. All 54 migrations are applied; production was untouched.
- Preview d7042fd: https://seepoint-kj7qjt6xn-pavels-projects-073588fb.vercel.app (READY). GitHub Actions run 34348984181 passed.
- Configured test organization A via browser for Ostrava / Moravskoslezsky kraj; DB readback confirmed the profile. Browser start confirmation stalled, and a DB read confirmed no new run, so the paid test was performed through the authenticated API.
- Actual API run cmtu23vpi0004jr044k7rdfns completed in 31.6 seconds: 9 live candidates processed, 8 opportunities stored, 1 duplicate, 0 errors. Independent DB read confirmed all 8 records and the completed run. This verifies discovery and persistence, not independent factual validation of every AI candidate. Browser refresh remains unreliable.
- Follow-up fixes cap live processing to the requested batch size and allow 100 seconds per cron organization within a 300-second function. The cron explicitly reports deferred organizations and partial failures rather than unconditional success; very large installations still need a durable per-organization queue. UI schedule now states winter/summer local times accurately.
