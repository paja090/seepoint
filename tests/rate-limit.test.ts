import assert from 'node:assert/strict';
import test from 'node:test';
import { forgotPasswordResponse, FORGOT_PASSWORD_MESSAGE } from '../lib/auth-responses.ts';
import { checkRateLimit, getClientIp, hashRateLimitIdentity, rateLimitResponseData, type RateLimitEntry, type RateLimitStore } from '../lib/rate-limit-core.ts';

class MemoryStore implements RateLimitStore {
  counts = new Map<string, number>();
  async increment(entry: RateLimitEntry) { const key = `${entry.scope}:${entry.keyHash}:${entry.windowStart.toISOString()}`; const count = (this.counts.get(key) ?? 0) + 1; this.counts.set(key, count); return count; }
}
const headers = new Headers({ 'x-vercel-forwarded-for': '203.0.113.10' });
const environment = { VERCEL: '1' };
const policy = { scope: 'test:login', windowMs: 60_000, limits: { ip: 3, identity: 2, pair: 2 } };
const at = new Date('2026-07-11T12:00:10Z');
const check = (store: MemoryStore, identity = 'alice', customPolicy = policy, now = at) => checkRateLimit({ headers, identityHash: hashRateLimitIdentity(identity), policy: customPolicy, store, now, environment, cleanupProbability: 0 });

test('request below the limit is allowed', async () => { assert.equal((await check(new MemoryStore())).allowed, true); });
test('limit produces HTTP 429 and Retry-After', async () => { const store = new MemoryStore(); await check(store); await check(store); const blocked = await check(store); assert.equal(blocked.allowed, false); const response = rateLimitResponseData(blocked); assert.equal(response.status, 429); assert.equal(Number(response.headers['Retry-After']) > 0, true); });
test('different identities have separate limits', async () => { const store = new MemoryStore(); await check(store, 'alice'); await check(store, 'alice'); assert.equal((await check(store, 'bob')).allowed, true); });
test('different endpoints have separate buckets', async () => { const store = new MemoryStore(); await check(store); await check(store); const other = { ...policy, scope: 'test:forgot' }; assert.equal((await check(store, 'alice', other)).allowed, true); });
test('block expires in the next window', async () => { const store = new MemoryStore(); await check(store); await check(store); assert.equal((await check(store)).allowed, false); assert.equal((await check(store, 'alice', policy, new Date('2026-07-11T12:01:01Z'))).allowed, true); });
test('untrusted forwarded IP is ignored outside Vercel', () => { const spoofed = new Headers({ 'x-forwarded-for': '198.51.100.22', 'x-vercel-forwarded-for': '198.51.100.23' }); assert.equal(getClientIp(spoofed, {}), 'unknown'); assert.equal(getClientIp(spoofed, { VERCEL: '1' }), '198.51.100.23'); assert.equal(getClientIp(new Headers({ 'x-vercel-forwarded-for': 'not-an-ip' }), { VERCEL: '1' }), 'unknown'); });
test('forgot-password response remains generic', () => { assert.deepEqual(forgotPasswordResponse(), { message: FORGOT_PASSWORD_MESSAGE }); assert.equal(forgotPasswordResponse().message.includes('@'), false); });
