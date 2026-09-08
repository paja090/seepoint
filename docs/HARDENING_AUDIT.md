# SeePoint hardening — main 90f1b27

Read-only audit baseline: 2026-09-07. Existing untracked import examples are outside this change.

| Stage | Finding | Classification / priority |
| --- | --- | --- |
| 1 | PrintProductionJob is absent from TENANT_MODEL_NAMES; no schema coverage gate. Session resolver falls back to a stale activeOrganizationId without membership. | confirmed, requires change / P0 |
| 2 | /offer already selects CampaignLivePortalView for ACCEPTED/CONVERTED; specialized and concept views take precedence. | partly fixed / P0 |
| 3–4 | HMAC(offer:id), NEXTAUTH_SECRET or CRON_SECRET or known fallback. Only SHA256 stored; publish and delivery overwrite it; serialization recomputes token. | confirmed, requires compatible change / P0 |
| 5 | No explicit audited emergency portal revocation. Archival currently denies public access. | requires change / P0 |
| 6 | Shared page/API guards only check role; organization modules primarily affect navigation. | confirmed / P1 |
| 7 | printProduction declared twice; unknown plan defaults to PRO. | confirmed / P1 |
| 8–15 | Production actions authenticate only; caller controls create fields/status; foreign IDs unchecked; public approval duplicated, replayable, no transition policy. CRM synchronization occurs after job update outside a transaction. | confirmed / P1 |
| 16–17 | Production cards show constants 12/8/3/45; portal impressions = carriers × 35000. | confirmed / P1 |
| 18–19 | Both Next build bypasses enabled; CI lacks lint/build. | confirmed / P1 |
| 20 | Build already excludes migrate deploy. | already fixed; document release / P1 |
| 21 | Existing Drive/photo tenant storage helpers; no unified private storage migration. | review and migration design / P2 |
| 22 | Existing mobile upload tests; persistent capture queue requires ownership, retry and confirmation design. | readiness review / P2 |
| 23 | Current main has existing imports; universal wizard on the original local feature branch is not in main. | preserve existing importer; design / P2 |
| 24 | Existing ai-usage.ts; keep domain AI behavior and propose shared gateway. | review / P2 |
| 25 | ClientInvoice number already unique per organization; supplier/customer snapshots exist; inspect financial mutations and merge behavior. | partly fixed; review / P1 |
| 26 | Existing city-gallery, inventory and network readiness tests. Preserve enquiry-only network. | review / P2 |
| 27 | Existing absence policy/tests; inspect assignment conflict integration. | review / P2 |
| 28 | Vehicle page already displays STK expiry badges. | partly fixed / P2 |
| 29 | Existing WarehouseMovement and shopping tests. Preserve movements, design reusable equipment lending only if missing. | review / P2 |
| 30 | Production actions currently hold DB workflow; domain service extraction is bounded. | requires change / P1 |
| 31–32 | Node/tsx test suite and preview tenant scripts already exist; no Playwright dependency. | extend regressions, E2E foundation / P1–P2 |

## Implementation sequence

1. P0: schema tenant coverage, valid session membership, stable random encrypted portal credentials with unchanged legacy hash lookup and emergency revoke.
2. P1: shared module policy in existing guards, Production validation/foreign keys/transitions/audit/atomic CRM sync, accurate dashboards, strict build and CI.
3. P2: domain readiness findings, release/recovery runbook, Definition of Done, regression and E2E verification.

No production database migration or deployment is performed during local implementation. Existing public hashes must never be regenerated. Previously distributed secrets cannot be made secret again; compromised legacy URLs require an explicit administrator decision.

## Updated main audit — 39fb532

The shared checkout was advanced by other work. Hardening was restored from its preserved stash into `.worktrees/saas-hardening-current`, branch `codex/saas-hardening-current`, based on current origin/main 39fb532. No carrier-type-model stash was applied. New main already contains universal import, updated Gemini model selection, navigation/mobile survey synchronization and CRM AI-result persistence. These changes are retained, not reimplemented. Seven new tenant models were detected by the regression gate: OrganizationRadarProfile, RadarSignal, RadarRun, RadarFeedback, ImportProfile, ImportBatchSheet and ImportRow. They are added to the central reviewed registry; new import/radar entrypoints receive module guards. Earlier build/test results are superseded by verification in this worktree.

## Kontrola aktuálního main 09adb77

Zahrnuty nové Resend konfigurace a delivery webhook, cron obchodního radaru, AI limity a notifikace. OrganizationEmailSettings a EmailLog jsou tenant-owned. Ruční cron je omezen na aktivní organizaci a salesRadar; globální běh vyžaduje CRON_SECRET. Profil se načítá v tenant contextu. Webhook nejprve ověřuje podpis, pak rozpozná vlastníka přes platform klienta a zapisuje tenant-aware klientem. Opětovné použití Resend domény vyžaduje providerDomainId již vlastněné organizací. Unikátní indexy brání konkurenčnímu dvojímu přiřazení. Notifikace respektují vypnutý modul.

## Poslední reconciliation: main 7f1e98f

Zachováno nové UI zadání Resend API klíče. Systémový klíč může obnovit pouze domain ID již vlastněné tenantem. Explicitně dodaný klíč se ověřuje skutečným úspěšným seznamem domén u poskytovatele; DB unikátní indexy i v tomto režimu zakazují převod domény vlastněné jinou organizací. Žádný reálný klíč ani externí odeslání nebyly použity v testech. Doplněn regresní test této policy. Cron AI audit nyní používá NULL místo fiktivního user FK a čeká na dokončení logu; odhadované hodnoty jsou označeny v metadata. Závěrečná regresní sada: 453/453.
