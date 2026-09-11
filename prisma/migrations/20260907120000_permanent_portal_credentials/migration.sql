-- Additive: existing hashes and URLs are preserved, never regenerated.
ALTER TABLE "Offer" ADD COLUMN "publicTokenEncrypted" TEXT;
ALTER TABLE "Offer" ADD COLUMN "publicTokenRevokedAt" TIMESTAMP(3);
-- Public audit actors need no synthetic user identity.
ALTER TABLE "CrmAuditLog" ALTER COLUMN "userId" DROP NOT NULL;
