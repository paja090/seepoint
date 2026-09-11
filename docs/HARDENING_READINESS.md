# Domain readiness review

Baseline: main 90f1b27. This review preserves existing domains; proposed migrations below are not implemented or deployed.

## Storage (stage 21)

`lib/storage/photo-storage.ts` already provides store/read/delete and a database fallback for Google Drive outages. `tenant-storage-key.ts` generates organization-prefixed keys. `app/api/mobile-photos/upload/route.ts` uses this layer and validated image metadata. SEEPOINT_STORAGE deliberately rejects writes until an adapter exists. Retain these behaviors.

Photos have original bytes/checksum, provider and Drive ID; contracts, invoices and documentation PDF use Drive document helpers separately. Print artwork currently points to external HTTP(S) resources: protocol validation prevents script URLs but does not make externally shared artwork private or enforce external provider ACLs. Receipts need stronger access restrictions than public campaign photos. Public document endpoints must check both resource ownership and client visibility; never infer public visibility from the storage provider.

Incremental target: extend the existing photo storage domain into a common interface with `upload`, `getDownloadUrl`, `getSignedUrl`, `delete`, `metadata`. Input includes trusted organization, resource type/ID, actor, MIME allowlist, byte limit and checksum. Private-by-default adapters retain provider references. Signed URL issuance first performs application authorization, logs issuance without the bearer URL, and uses short TTL. Reject mismatched file signatures, not just extensions. Provider deletion should follow application reference checks and audited tombstones.

Migration plan: inventory per provider/resource/tenant; identify shared URLs and missing owners; copy one tenant/resource cohort to private storage; verify byte counts/checksums and document ACLs; keep old reference for rollback; switch reads with monitored fallback; only retire old blobs after recovery window and explicit review. Never mass-delete existing Drive files or rewrite QR/client URLs during this task.

## Mobile photo reliability (stage 22)

`lib/mobile-photo-upload.ts` retries server-side operations and separates post-save failures from successful persistence. This cannot preserve a browser File after reload or browser termination. `MobilePhotoFieldAppView.tsx` is a substantial workflow, so offline capture is a separate bounded change rather than a UI rewrite here.

Detailed queue design: IndexedDB record with client-generated captureId, Blob, checksum, organizationId, userId, target IDs, capturedAt, GPS, retryCount, nextAttemptAt and state. Persist and confirm IndexedDB transaction before showing capture as saved; request persistent storage where available; if quota/write fails, offer immediate local download and keep image visible. Never remove on request dispatch. Server accepts idempotency key unique per organization and returns persisted photoId/checksum; remove local Blob only after matching confirmation. Retry transient network/5xx failures with exponential backoff/jitter, pause on 401/403, require explicit repair for invalid target/413/415. Resolve a lost response by captureId. Never replay a queue under another organization or account; show pending items and account binding during logout/switch. Test offline capture, reload, storage exhaustion, two tabs, organization switch, lost acknowledgment, duplicate retry and failure of optional OCR/notification. Service worker background sync is optional; foreground retry must work without it.

## Import (stage 23)

Main includes `lib/media-import.ts`, existing navigation/carrier import services and preview/confirmation checks. The universal importer visible on the original local feature branch is not part of this main baseline; do not merge it accidentally with security work.

Extend current normalized row structures with a saved mapping profile (tenant/source/header fingerprint) and source column provenance. Flow: upload → detect columns → propose mapping → user confirms mapping → normalized preview → runtime/foreign-ID validation → conflicts → dry-run snapshot/hash → explicit commit → transaction/batch audit. Treat changed input or stale conflicts as a new preview; retain original source and row errors. AI mapping is a suggestion and cannot commit. Support renamed/reordered/extra columns and unknown headers. Reuse ImportBatch/ImportRowError instead of parallel importer persistence; add resumable chunk semantics only with idempotency and a documented partial-failure policy.

## AI (stage 24)

`lib/ai-usage.ts` already records organization, user, feature, model and usage/cost fields; it now uses the tenant client. Existing Gemini integrations should gradually call a shared gateway adapter, retaining domain validation and approval. Add elapsed duration, success/error classification and provider request ID to usage metadata; mark unknown cost explicitly, avoid invented precise cost. Exclude secrets, full artwork URLs and sensitive prompts from logs; define retention. Review AI responses as untrusted data, never as authorization. Preserve explicit user confirmation before prices, reservations, sending offers or legal conclusions. The gateway proposal does not replace current AI integrations in this patch.

## Client billing (stage 25)

ClientInvoice already has `@@unique([organizationId, invoiceNumber])`, VAT line items, issueDate/dueDate and supplier/customer snapshots. Navigation invoice endpoint reuses stored PDF; later mutations update provider references, delivery status and pdfUrl rather than monetary values. Existing navigation-invoice and invoice-settings-policy tests verify snapshots, numbering and validation. Client merge changes clientId while retaining snapshots. No new financial edit endpoint is introduced.

Readiness limitation: database-level immutability is not yet a blanket guarantee for every future Prisma caller. Before adding editing, permit only delivery/payment metadata after issuance; correction must be a new linked credit/corrective document with reason, actor and immutable original snapshot. Avoid retroactive VAT/bank recalculation from mutable client settings. Review concurrent numbering against unique constraint/retry; do not create a second internal Invoice model.

## City Gallery / Inventory / Network (stage 26)

City Gallery uses existing policy validation, tenant-singleton fleet configuration and transaction retry; its API and pages are covered by shared module guards. City Inventory uses carrier data; its specialized page is entitled independently while common carrier APIs remain available under carrier permissions. GPS edits and carrier history should continue to use existing carrier workflow. Do not add a second inventory or QR identity. Existing readiness tests cover current domain boundaries and exports. Network remains enquiry/read-only sharing; cross-organization reservation, settlement and clearing require explicit consent from both organizations and a separate reviewed transaction design.

## Planning, vehicles, shopping and warehouse (stages 27–29)

Work task assignment currently allows absent workers. The work planning page now shows approved absence overlaps for assigned employees and open work orders, without exposing absence reasons or cancelling tasks. Warning is evaluated on render; final assignment is not blocked. Future inline assignment warning should reuse this date policy.

Vehicle page already shows expired/upcoming STK badges using technicalInspectionUntil. Retain vehicle reservations' serializable overlap checks and existing service records. Extend existing notification cards for service/insurance due dates only when authoritative due-date fields are populated; no fabricated reminders or new fleet domain.

Shopping and WarehouseMovement already contain references for assigned equipment/material handling. Receiving, consuming and returning stock must reuse one movement transaction with idempotency (source operation ID), never duplicate movements in Production delivery sync. This patch's Production delivery updates workflow only; it does not invent stock receipts. No dedicated ToolLoan exists. Proposed reusable equipment lending: tenant-owned loan referencing existing WarehouseItem and Employee, quantity/serial, issuedAt/dueAt/returnedAt, issuedBy/receivedBy, condition and linked issue/return movements. Partial returns must reconcile outstanding quantity and cannot make stock negative; no automatic creation of loans from consumable shopping lines.

## Verification limits

Unit tests use transaction doubles for failure injection; they are not proof of PostgreSQL commit/rollback behavior or a browser workflow. Run the Playwright foundation and release smoke with disposable tenants against this branch's deployed build. Existing repository preview tenant scripts remain available. Production credentials, migrations and external email were not used in local tests.

## Reconciliation with main 39fb532

UniversalImportWizard and lib/imports now exist in main (upload/analyze/map/dry-run/commit/history, saved ImportProfile and batch rows). Preserve this implementation rather than following the initial baseline proposal as a new importer. Its newly added tenant models are now in the reviewed registry; import/radar backend routes are included in entitlement enforcement. Current main also updates Gemini model selection and saves reviewed AI enrichment into existing client, branch and contact records. These latest behaviors are retained. Vehicle notifications now derive STK, insurance and highway-pass deadlines from existing DateTime fields; no new service due date is invented from historical service records.

## Závěrečné ověření nad 09adb77

Dřívější omezení pouze mock transakcemi již neplatí pro Production: doplněno a úspěšně spuštěno 10 skutečných PostgreSQL kontrol v samostatné Neon testovací větvi včetně rollbacku a CRM/auditu. Podrobný aktuální výsledek je v HARDENING_REPORT.md. Pro offline mobilní zachování fotek, storage přesuny a celý instalační happy path toto ověření stále nestačí.
