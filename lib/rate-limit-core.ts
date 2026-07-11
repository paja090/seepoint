import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export type RateLimitPolicy = { scope: string; windowMs: number; limits: { ip: number; identity: number; pair: number } };
export type RateLimitEntry = { scope: string; keyHash: string; windowStart: Date; expiresAt: Date };
export type RateLimitStore = { increment(entry: RateLimitEntry): Promise<number>; cleanup?(now: Date): Promise<void> };
export type RateLimitResult = { allowed: boolean; retryAfter: number; limit: number; count: number };

export const RATE_LIMIT_MESSAGE = 'Příliš mnoho pokusů. Zkuste to prosím později.';

export function hashRateLimitIdentity(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function validIp(value: string | null) {
  const candidate = value?.split(',')[0]?.trim() ?? '';
  return isIP(candidate) ? candidate : null;
}

export function getClientIp(headers: Headers, environment: Record<string, string | undefined> = process.env) {
  if (environment.VERCEL === '1') return validIp(headers.get('x-vercel-forwarded-for')) ?? 'unknown';
  if (environment.TRUST_PROXY_IP_HEADERS === '1') return validIp(headers.get('x-forwarded-for')) ?? validIp(headers.get('x-real-ip')) ?? 'unknown';
  return 'unknown';
}

function dimensionHash(dimension: string, value: string) {
  return createHash('sha256').update(`${dimension}:${value}`).digest('hex');
}

export async function checkRateLimit(options: { headers: Headers; identityHash: string; policy: RateLimitPolicy; store: RateLimitStore; now?: Date; environment?: Record<string, string | undefined>; cleanupProbability?: number; random?: () => number }) {
  const now = options.now ?? new Date();
  const windowStartMs = Math.floor(now.getTime() / options.policy.windowMs) * options.policy.windowMs;
  const windowStart = new Date(windowStartMs); const expiresAt = new Date(windowStartMs + options.policy.windowMs);
  const ip = getClientIp(options.headers, options.environment);
  const dimensions = [
    { name: 'ip', value: ip, limit: options.policy.limits.ip },
    { name: 'identity', value: options.identityHash || 'anonymous', limit: options.policy.limits.identity },
    { name: 'pair', value: `${ip}:${options.identityHash || 'anonymous'}`, limit: options.policy.limits.pair },
  ];
  let result: RateLimitResult = { allowed: true, retryAfter: 0, limit: dimensions[0].limit, count: 0 };
  for (const dimension of dimensions) {
    const count = await options.store.increment({ scope: options.policy.scope, keyHash: dimensionHash(dimension.name, dimension.value), windowStart, expiresAt });
    if (count > dimension.limit) { result = { allowed: false, retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)), limit: dimension.limit, count }; break; }
  }
  if (options.store.cleanup && (options.random ?? Math.random)() < (options.cleanupProbability ?? 0.01)) {
    try { await options.store.cleanup(now); } catch { /* Cleanup is best-effort and must not break authentication. */ }
  }
  return result;
}

export function rateLimitResponseData(result: RateLimitResult) {
  return { status: 429 as const, body: { error: RATE_LIMIT_MESSAGE }, headers: { 'Retry-After': String(result.retryAfter), 'Cache-Control': 'no-store' } };
}
