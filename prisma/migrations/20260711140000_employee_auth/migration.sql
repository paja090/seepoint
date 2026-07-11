CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "UserTokenType" AS ENUM ('ACTIVATION', 'PASSWORD_RESET');
CREATE TYPE "AuditAction" AS ENUM ('ACCOUNT_CREATED', 'ROLE_CHANGED', 'ACCOUNT_ACTIVATED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_RESTORED', 'PASSWORD_CHANGED', 'INVITATION_RESENT');

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- Existing accounts remain non-loginable until an admin sends an activation invitation.
CREATE TABLE "UserSession" ("id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "userId" TEXT NOT NULL, "sessionVersion" INTEGER NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id"));
CREATE TABLE "UserToken" ("id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "type" "UserTokenType" NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "userId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UserToken_pkey" PRIMARY KEY ("id"));
CREATE TABLE "UserAuditLog" ("id" TEXT NOT NULL, "action" "AuditAction" NOT NULL, "actorUserId" TEXT, "targetUserId" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UserAuditLog_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash"); CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId"); CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");
CREATE UNIQUE INDEX "UserToken_tokenHash_key" ON "UserToken"("tokenHash"); CREATE INDEX "UserToken_userId_type_idx" ON "UserToken"("userId", "type"); CREATE INDEX "UserToken_expiresAt_idx" ON "UserToken"("expiresAt");
CREATE INDEX "UserAuditLog_actorUserId_idx" ON "UserAuditLog"("actorUserId"); CREATE INDEX "UserAuditLog_targetUserId_createdAt_idx" ON "UserAuditLog"("targetUserId", "createdAt");
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
