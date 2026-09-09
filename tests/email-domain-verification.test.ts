import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyResendDomain } from '../lib/resend-service.ts';

for (const status of ['verified', 'pending']) {
  test(`Verification reads ${status} without restarting the provider check`, async (t) => {
    const calls: string[] = [];
    t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`);
      assert.equal(init.cache, 'no-store');
      return Response.json({ id: 'domain-1', name: 'example.cz', status, records: [] });
    });
    const domain = await verifyResendDomain('domain-1', 'test-key');
    assert.equal(domain.status, status);
    assert.deepEqual(calls, ['GET https://api.resend.com/domains/domain-1']);
  });
}

for (const status of ['not_started', 'failed']) {
  test(`Verification starts an asynchronous check for ${status}`, async (t) => {
    const calls: string[] = [];
    t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`);
      return Response.json(init.method === 'POST'
        ? { id: 'domain-1', object: 'domain' }
        : { id: 'domain-1', name: 'example.cz', status: calls.length === 1 ? status : 'pending' });
    });
    assert.equal((await verifyResendDomain('domain-1', 'test-key')).status, 'pending');
    assert.deepEqual(calls, [
      'GET https://api.resend.com/domains/domain-1',
      'POST https://api.resend.com/domains/domain-1/verify',
      'GET https://api.resend.com/domains/domain-1',
    ]);
  });
}

test('Provider read failure does not initiate a fresh verification', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ message: 'Service unavailable' }, { status: 503 });
  });
  await assert.rejects(verifyResendDomain('domain-1', 'test-key'), /Načtení stavu domény selhalo/);
  assert.equal(calls, 1);
});
