import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from './db';
import { checkRateLimit, rateLimitResponseData, type RateLimitEntry, type RateLimitPolicy, type RateLimitStore } from './rate-limit-core';

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
} satisfies Record<string, RateLimitPolicy>;

export async function enforceRateLimit(request: Request, identityHash: string, policy: RateLimitPolicy) {
  const result = await checkRateLimit({ headers: request.headers, identityHash, policy, store: prismaRateLimitStore });
  if (result.allowed) return null;
  const response = rateLimitResponseData(result);
  return NextResponse.json(response.body, { status: response.status, headers: response.headers });
}
