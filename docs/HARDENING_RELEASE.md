# Permanent portal release and recovery

## Environment

- `OFFER_PORTAL_KEYS`: JSON object mapping key IDs to base64-encoded 32-byte AES keys. Secret; store in Vercel environment settings, never Git.
- `OFFER_PORTAL_ACTIVE_KEY`: ID of the key used for new encrypted credentials.
- `OFFER_PORTAL_LEGACY_SECRETS`: optional JSON array of historical HMAC secrets, required only to recover legacy URLs whose hash does not match the current NEXTAUTH_SECRET/CRON_SECRET or old fallback.

Keep the current legacy secrets until legacy credential recovery has been completed and verified. Back up the key ring separately. Losing encryption keys prevents internal copying of a URL but does not prevent public hash lookup. Rotation: add new key, keep old keys, change active ID; reencrypt recovered tokens without changing hashes. Never remove a key still referenced by stored ciphertext.

## Mechanism

New first publication generates 32 random bytes, stores SHA-256 for lookup and AES-256-GCM ciphertext with key ID, random IV, authentication tag and Offer ID as authenticated additional data. Publication/delivery uses a serializable transaction and preserves an existing hash. Concurrent first publication can return a retryable serialization error; retry reads the winner's credential.

Legacy public URLs continue to hash to their original stored hash. Lookup has no secret dependency. Legacy internal recovery tries historical HMAC secrets and accepts a result only when its hash matches the stored hash; it never replaces an unknown hash. On next publish/delivery, a recoverable legacy token is encrypted without changing its URL. Old random tokens with no retained plaintext remain usable publicly but cannot be mathematically recovered from SHA-256: recover from an authorized historical communication before attempting administrative repair.

Archival does not revoke a public URL. Explicit administrator emergency revocation is `POST /api/offers/{id}/revoke-portal` with `confirmed: true` and nonempty `reason`. It requires active membership, offers entitlement and ADMIN role; it updates revokedAt and writes an OfferEvent in one transaction. It does not regenerate a replacement URL. No workflow action invokes this endpoint.

Print approval uses the permanent portal credential plus a job ID restricted to that offer and organization. No separate expiring action token is introduced. It checks CLIENT_APPROVAL and unapproved state and uses compare-and-set plus a serializable transaction. Replay fails; permanent URL remains usable.

## Deployment order

1. Review SQL and test against an isolated copy; confirm existing public hashes and representative legacy URLs. Verify audit nullable-user compatibility and all prior migrations.
2. Take database backup/recovery point and back up key ring; record recovery identifiers without logging credentials.
3. Configure the new environment variables and historical secrets. Keep old application online.
4. Run `npm run db:migrate:deploy` once in a controlled release job, never in each parallel Vercel build.
5. DB smoke: new nullable Offer fields exist, existing public hashes and counts are unchanged, CrmAuditLog accepts null userId. Do not print tokens.
6. Deploy the application built by passing CI.
7. App smoke: login A/B, disabled Warehouse page/API, legacy offer URL, random new URL, publish twice, acceptance, Production approval/replay, delivery/CRM sync, installation/photo portal, explicit revoke on disposable test offer.
8. Monitor errors. Roll back app only if compatible with new credentials; the old application cannot recover encrypted random credentials and overwrites hashes on publish. Therefore do not roll back token-writing code after new links have been issued. Prefer forward fix or suspend publication temporarily. Do not roll back/drop additive columns or restore a stale DB over new business data.

No production migration, backfill, secret rotation, email delivery or deployment is performed by the local hardening task.

## Doplnění pro main 09adb77

Migrace `20260908210000_email_domain_ownership` přidává unikátní indexy domain a providerDomainId na OrganizationEmailSettings. Musí běžet až po `20260907210000_multi_tenant_resend_email_system` z main. Před nasazením zkontrolujte duplicity; při konfliktu migrace bezpečně selže. Nic nemaže ani automaticky nepřevádí mezi organizacemi. Doména zaregistrovaná u poskytovatele bez vlastnictví zaznamenaného v SeePoint vyžaduje správcovské ověření a řízené přiřazení; nelze ji převzít zadáním jejího jména.

Testovací databáze je samostatná Neon větev `codex-saas-hardening-20260907`; její přístupové údaje nejsou v Gitu. E2E fixtures vytváří `e2e/seed.ts` při explicitním `E2E_ALLOW_TEST_TENANT=true` a shodě hostname s `E2E_DATABASE_HOST`. Hesla a tokeny ukládá pouze do ignorovaného `.env.e2e.local`. `e2e/database-check.ts` prověřuje skutečné databázové transakce. Produkční e-mailové klíče nebyly k testům použity.
