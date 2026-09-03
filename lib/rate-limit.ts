import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from './db';
import { checkRateLimit, hashRateLimitIdentity, rateLimitResponseData, type RateLimitEntry, type RateLimitPolicy, type RateLimitStore } from './rate-limit-core';

const prismaRateLimitStore: RateLimitStore = {
  async increment(entry: RateLimitEntry) {
    const bucket = await prisma.rateLimitBucket.upsert({
      where: { scope_keyHash_windowStart: { scope: entry.scope, keyHash: entry.keyHash, windowStart: entry.windowStart } },
      create: { ...entry, count: 1 }, update: { count: { increment: 1 }, expiresAt: entry.expiresAt }, select: { count: true },
    });
    return bucket.count;
  },
  async cleanup(now: Date) {
    const expired = await prisma.rateLimitBucket.findMany({ where: { expiresAt: { lt: now } }, select: { id: true }, orderBy: { expiresAt: 'asc' }, take: 200 });
    if (expired.length) await prisma.rateLimitBucket.deleteMany({ where: { id: { in: expired.map((item) => item.id) } } });
  },
};

export const rateLimitPolicies = {
  login: { scope: 'auth:login', windowMs: 15 * 60_000, limits: { ip: 30, identity: 10, pair: 8 } },
  forgotPassword: { scope: 'auth:forgot-password', windowMs: 60 * 60_000, limits: { ip: 20, identity: 5, pair: 5 } },
  resetPassword: { scope: 'auth:reset-password', windowMs: 60 * 60_000, limits: { ip: 20, identity: 8, pair: 6 } },
  activate: { scope: 'auth:activate', windowMs: 60 * 60_000, limits: { ip: 20, identity: 8, pair: 6 } },
  resendInvitation: { scope: 'auth:resend-invitation', windowMs: 60 * 60_000, limits: { ip: 30, identity: 5, pair: 5 } },
  chatMessage: { scope: 'chat:message', windowMs: 60_000, limits: { ip: 120, identity: 40, pair: 30 } },
  fuelOcr: { scope: 'ai:fuel-ocr', windowMs: 60 * 60_000, limits: { ip: 40, identity: 20, pair: 15 } },
  notificationsAi: { scope: 'ai:notifications-summary', windowMs: 60 * 60_000, limits: { ip: 30, identity: 10, pair: 8 } },
  transactionalEmail: { scope: 'email:transactional', windowMs: 60 * 60_000, limits: { ip: 60, identity: 20, pair: 15 } },
  publicOfferResponse: { scope: 'offers:public-response', windowMs: 15 * 60_000, limits: { ip: 30, identity: 12, pair: 10 } },
  warehouseAi: { scope: 'warehouse:ai', windowMs: 60 * 60_000, limits: { ip: 60, identity: 30, pair: 20 } },
  crmAi: { scope: 'crm:ai', windowMs: 60 * 60_000, limits: { ip: 30, identity: 10, pair: 8 } },
  opportunityAi: { scope: 'sales:opportunity-ai', windowMs: 60 * 60_000, limits: { ip: 30, identity: 10, pair: 8 } },
  opportunityDiscovery: { scope: 'sales:opportunity-discovery', windowMs: 60 * 60_000, limits: { ip: 10, identity: 3, pair: 2 } },
  photoUpload: { scope: 'files:photo-upload', windowMs: 60 * 60_000, limits: { ip: 150, identity: 80, pair: 60 } },
} satisfies Record<string, RateLimitPolicy>;

export async function enforceRateLimit(request: Request, identityHash: string, policy: RateLimitPolicy) {
  const result = await checkRateLimit({ headers: request.headers, identityHash, policy, store: prismaRateLimitStore });
  if (result.allowed) return null;
  const response = rateLimitResponseData(result);
  return NextResponse.json(response.body, { status: response.status, headers: response.headers });
}

export function enforcePhotoUploadRateLimit(request: Request, user: { id: string; organizationId?: string | null }) {
  return enforceRateLimit(
    request,
    hashRateLimitIdentity(`${user.organizationId || 'missing-tenant'}:${user.id}`),
    rateLimitPolicies.photoUpload,
  );
}
