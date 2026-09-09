import test from 'node:test';
import assert from 'node:assert/strict';
import { radarRequestSignal } from '../lib/opportunities/deadline.ts';
const profile = { organizationId: 'test', enabled: true, customRssSources: [], minScoreThreshold: 40, targetCities: [], targetRegions: [], preferredMediaTypes: [], focusEventTypes: [], customKeywords: [] };

test('expired shared deadline rejects before another request can start', () => {
  assert.throws(() => radarRequestSignal(Date.now() - 1), /limit/);
});
test('live search reports provider HTTP failures rather than a successful empty result', async () => {
  const { searchLiveOpportunitiesWithGemini } = await import('../lib/opportunities/live-search-core.ts');
  const original = globalThis.fetch; const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key'; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('{}', { status: 429 }); };
  try { await assert.rejects(searchLiveOpportunitiesWithGemini(profile as Parameters<typeof searchLiveOpportunitiesWithGemini>[0]), /HTTP 429/); assert.ok(calls >= 1); }
  finally { globalThis.fetch = original; if(oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey; }
});
test('valid empty search remains distinct from malformed provider output', async () => {
  const { searchLiveOpportunitiesWithGemini } = await import('../lib/opportunities/live-search-core.ts');
  const original = globalThis.fetch; const oldKey = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'test-key';
  const respond = (text: string) => async () => Response.json({candidates:[{content:{parts:[{text}]}}]});
  try {
    globalThis.fetch = respond('[]'); assert.deepEqual(await searchLiveOpportunitiesWithGemini(profile as Parameters<typeof searchLiveOpportunitiesWithGemini>[0]), []);
    globalThis.fetch = respond('not JSON'); await assert.rejects(searchLiveOpportunitiesWithGemini(profile as Parameters<typeof searchLiveOpportunitiesWithGemini>[0]), /neplatné/);
    globalThis.fetch = respond('[{}]'); await assert.rejects(searchLiveOpportunitiesWithGemini(profile as Parameters<typeof searchLiveOpportunitiesWithGemini>[0]), /neplatné/);
  } finally { globalThis.fetch = original; if(oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey; }
});
