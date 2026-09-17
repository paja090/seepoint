/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import type { CreateOpportunityInput } from '../lib/opportunities/types';

// Next aliases server-only in production. This Node test runs services with DB/provider doubles.
const loader = Module as unknown as { _load: (...args: any[]) => any };
const originalLoad = loader._load;
loader._load = function (id: string, ...args: any[]) { return id === 'server-only' ? {} : originalLoad.call(this, id, ...args); };

test('production semantic ingestion and manual review preserve source identity and canonical records', async t => {
  const { prisma } = await import('../lib/db');
  const { ingestOpportunity, reviewSource, findCandidates, backfillSemanticPreview } = await import('../lib/opportunities/semantic-service');
  loader._load = originalLoad;
  type Row = Record<string, any>;
  let rows: Record<string, Row[]> = { salesOpportunity: [], radarSignal: [], radarRun: [] }, seq = 0, calls = 0;
  let confidence = .97, failProvider = false;
  const profile = { organizationId: 'org', enabled: true, targetCities: [], targetRegions: [], focusEventTypes: [], preferredMediaTypes: ['BILLBOARD'], customKeywords: [], customRssSources: [], minScoreThreshold: 0, scoringWeights: {} };
  function match(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true;
      if (key === 'organizationId_sourceUrl') return match(row, value);
      if (key === 'OR') return value.some((w: Row) => match(row, w));
      if (key === 'NOT') return !match(row, value);
      if (key === 'sources') return !rows.radarSignal.some(s => s.canonicalOpportunityId === row.id);
      const actual = row[key] ?? null;
      if (value && typeof value === 'object') {
        if ('in' in value) return value.in.includes(actual);
        if ('notIn' in value) return !value.notIn.includes(actual);
        if ('isEmpty' in value) return (actual.length === 0) === value.isEmpty;
        if ('gt' in value) return actual > value.gt;
        if ('equals' in value) return actual === value.equals;
      }
      return actual === value;
    });
  }
  const db: Row = { organizationRadarProfile: { upsert: async () => profile }, client: { findFirst: async () => null, count: async () => 0 }, organizationMember: { count: async () => 1 }, advertisingCarrier: { count: async () => 0 } };
  for (const model of Object.keys(rows)) {
    const findMany = async (args: Row = {}) => {
      assert.ok(args.where?.organizationId, `${model} lookup must be tenant scoped`);
      let found = rows[model].filter(row => match(row, args.where));
      for (const order of [...(Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy])].reverse()) if (order) { const [field, direction] = Object.entries(order)[0]; found.sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * (direction === 'desc' ? -1 : 1)); }
      if (args.take) found = found.slice(0, args.take);
      return structuredClone(found);
    };
    const create = async ({ data }: Row) => {
      const row = { id: `id${String(++seq).padStart(5, '0')}`, createdAt: new Date(seq * 1000), updatedAt: new Date(seq * 1000), keptSeparateIds: [], canonicalOpportunityId: null, semanticDecision: null, mergedIntoId: null, ...structuredClone(data) };
      if (model === 'radarSignal') assert.ok(!rows[model].some(r => r.organizationId === row.organizationId && r.sourceUrl === row.sourceUrl), 'unique source constraint');
      rows[model].push(row); return structuredClone(row);
    };
    const update = async ({ where, data }: Row) => {
      const row = rows[model].find(r => match(r, where)); if (!row) throw new Error('not found');
      for (const [k, v] of Object.entries(data) as [string, any][]) if (v !== undefined) row[k] = v && typeof v === 'object' && Object.hasOwn(v, 'push') ? [...row[k], v.push] : structuredClone(v);
      return structuredClone(row);
    };
    db[model] = { findMany, findFirst: async (args: Row) => (await findMany(args))[0] || null, findFirstOrThrow: async (args: Row) => { const row = (await findMany(args))[0]; if (!row) throw new Error('not found'); return row; }, findUnique: async (args: Row) => (await findMany({ ...args, where: { organizationId: args.where.organizationId_sourceUrl?.organizationId, ...args.where } }))[0] || null,
      count: async (args: Row) => (await findMany(args)).length, create, update, updateMany: async (args: Row) => { const found = await findMany(args); for (const row of found) await update({ where: { id: row.id }, data: args.data }); return { count: found.length }; },
      upsert: async (args: Row) => { const found = rows[model].find(r => match(r, args.where)); return found ? update({ where: { id: found.id }, data: args.update }) : create({ data: args.create }); } };
  }
  const replace = (object: any, key: string, method: any) => { const original = object[key]; object[key] = method; t.after(() => { object[key] = original; }); };
  replace(prisma, '$transaction', async (fn: (tx: any) => Promise<unknown>) => { const snapshot = structuredClone(rows); try { return await fn(db); } catch (e) { rows = snapshot; throw e; } });
  replace(prisma.organizationRadarProfile, 'findUnique', async () => profile);
  replace(prisma.aIUsageLog, 'create', async () => ({}));
  replace(prisma.salesOpportunity, 'findMany', (args: Row) => db.salesOpportunity.findMany(args));
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only';
  t.after(() => { if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; });
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    calls++;
    if (failProvider) return new Response('{}', { status: 503 });
    const prompt = JSON.parse(String(options.body)).contents[0].parts[0].text;
    const payload = JSON.parse(prompt.split('\nDATA: ')[1]);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ decision: 'SAME_OPPORTUNITY', canonicalOpportunityId: payload.candidates[0].id, confidence, reason: 'Stejný projekt', conflictingSignals: [] }) }] } }] });
  });
  const base: CreateOpportunityInput = { companyName: 'ČEZ', title: 'Baterie Tušimice', summary: 'Bateriové úložiště u elektrárny', eventType: 'EXPANSION', city: 'Kadaň', sourceUrl: 'https://a.example/1', sourceTitle: 'První zpráva', semanticData: { projectName: 'BESS Tušimice', location: 'Elektrárna Tušimice', projectSize: '200 MW', city: 'Kadaň' } };
  const ingest = (overrides: Partial<CreateOpportunityInput> = {}, org = 'org') => ingestOpportunity({ ...base, ...overrides }, org, Date.now() + 15000);
  const active = () => rows.salesOpportunity.filter(r => !r.mergedIntoId);
  const reset = () => { rows = { salesOpportunity: [], radarSignal: [], radarRun: [] }; calls = 0; confidence = .97; failProvider = false; };
  await t.test('same URL twice -> one source and one opportunity, zero comparison calls', async () => {
    reset(); await ingest(); await ingest(); assert.equal(rows.radarSignal.length, 1); assert.equal(active().length, 1); assert.equal(calls, 0);
  });
  await t.test('two URLs, same concrete project -> two sources and one opportunity', async () => {
    reset(); await ingest(); await ingest({ sourceUrl: 'https://b.example/2', sourceTitle: 'Projekt získal povolení' });
    assert.equal(rows.radarSignal.length, 2); assert.equal(active().length, 1); assert.equal(calls, 1);
    assert.ok(rows.radarRun.some(r => r.summaryLog.metrics.automaticMerge === 1));
  });
  await t.test('different cities -> separate; same company and city alone -> never auto merge', async () => {
    reset(); await ingest(); await ingest({ sourceUrl: 'https://b.example/2', city: 'Opava', semanticData: { ...base.semanticData, city: 'Opava' } }); assert.equal(active().length, 2);
    reset(); await ingest({ semanticData: {} }); await ingest({ sourceUrl: 'https://b.example/2', semanticData: {} }); assert.equal(active().length, 2); assert.equal(rows.radarSignal[1].semanticDecision, 'POSSIBLE_DUPLICATE');
  });
  await t.test('same tender, distinct titles -> deterministic merge without provider', async () => {
    reset(); const semanticData = { tenderIdentifier: 'CZ/123' }; await ingest({ semanticData }); await ingest({ semanticData, sourceUrl: 'https://b.example/2', title: 'Jiný titulek' }); assert.equal(active().length, 1); assert.equal(calls, 0);
  });
  await t.test('.82 confidence -> review; manual merge moves both sources; detach reverses enrichment', async () => {
    reset(); confidence = .82; await ingest(); await ingest({ sourceUrl: 'https://b.example/2', semanticData: { ...base.semanticData, estimatedValue: '350000000', currency: 'CZK' } });
    const source = rows.radarSignal[1]; assert.equal(source.semanticDecision, 'POSSIBLE_DUPLICATE'); assert.equal(active().length, 2);
    await reviewSource('org', 'manager', source.id, 'MERGE'); assert.equal(active().length, 1); assert.equal(rows.radarSignal.length, 2); assert.equal(active()[0].semanticData.estimatedValue, '350000000');
    assert.equal(active()[0].fieldProvenance.estimatedValue, source.id);
    await reviewSource('org', 'manager', source.id, 'DETACH'); assert.equal(active().length, 2); assert.equal(rows.radarSignal.length, 2);
    assert.equal(rows.salesOpportunity.find(o => o.id === rows.radarSignal[0].canonicalOpportunityId)?.semanticData.estimatedValue, undefined);
  });
  await t.test('keep separate survives recrawl and higher resolver confidence', async () => {
    reset(); confidence = .82; await ingest(); await ingest({ sourceUrl: 'https://b.example/2' });
    await reviewSource('org', 'manager', rows.radarSignal[1].id, 'KEEP_SEPARATE'); const before = calls;
    confidence = .99; await ingest({ sourceUrl: 'https://b.example/2' }); assert.equal(calls, before); assert.equal(active().length, 2); assert.equal(rows.radarSignal[1].semanticDecision, 'KEEP_SEPARATE');
  });
  await t.test('new investment is added without overwriting confirmed facts and sources remain', async () => {
    reset(); await ingest(); await ingest({ sourceUrl: 'https://b.example/2', semanticData: { ...base.semanticData, estimatedValue: '350000000', currency: 'CZK' } });
    assert.equal(active().length, 1); assert.equal(active()[0].semanticData.estimatedValue, '350000000'); assert.equal(active()[0].fieldProvenance.estimatedValue, rows.radarSignal[1].id);
  });
  await t.test('provider failure retains source and creates review instead of an automatic merge', async () => {
    reset(); await ingest(); failProvider = true; await ingest({ sourceUrl: 'https://b.example/2' });
    assert.equal(rows.radarSignal.length, 2); assert.equal(active().length, 2);
    assert.equal(rows.radarSignal[1].semanticDecision, 'POSSIBLE_DUPLICATE');
    assert.deepEqual(rows.radarSignal[1].resolution.conflictingSignals, ['resolverUnavailable']);
  });
  await t.test('new article cannot override an indistinguishable pair previously kept separate', async () => {
    reset(); confidence = .82; await ingest(); await ingest({ sourceUrl: 'https://b.example/2' });
    await reviewSource('org', 'manager', rows.radarSignal[1].id, 'KEEP_SEPARATE');
    const before = calls; confidence = .99; await ingest({ sourceUrl: 'https://c.example/3' });
    assert.equal(calls, before); assert.equal(rows.radarSignal[2].semanticDecision, 'POSSIBLE_DUPLICATE');
    assert.deepEqual(rows.radarSignal[2].resolution.conflictingSignals, ['manualSeparation']);
  });
  await t.test('conflicting exact location or identifier vetoes automatic merge', async () => {
    reset(); await ingest({ semanticData: { ...base.semanticData, projectIdentifier: 'A' } }); await ingest({ sourceUrl: 'https://b.example/2', semanticData: { ...base.semanticData, projectIdentifier: 'B' } }); assert.equal(active().length, 2);
    reset(); await ingest(); await ingest({ sourceUrl: 'https://b.example/2', semanticData: { ...base.semanticData, location: 'Elektrárna Prunéřov' } }); assert.equal(active().length, 2);
  });
  await t.test('foreign-tenant review cannot move sources', async () => {
    reset(); await ingest(); await assert.rejects(reviewSource('foreign', 'manager', rows.radarSignal[0].id, 'DETACH')); assert.equal(rows.radarSignal[0].organizationId, 'org');
  });
  await t.test('historical preview is non-destructive and does not call paid AI', async () => {
    reset(); confidence = .82; await ingest(); await ingest({ sourceUrl: 'https://b.example/2', semanticData: { ...base.semanticData, projectIdentifier: 'B' } });
    // Simulate old independent Opportunities before resolver decisions existed.
    for (const s of rows.radarSignal) { s.semanticDecision = null; s.candidateOpportunityId = null; }
    const before = calls; const count = active().length; await backfillSemanticPreview('org', 'manager');
    assert.equal(active().length, count); assert.equal(calls, before); assert.ok(rows.radarSignal.some(s => s.semanticDecision === 'POSSIBLE_DUPLICATE'));
  });
  await t.test('candidate retrieval bounds every database branch and returns at most ten', async () => {
    reset(); for (let i = 0; i < 30; i++) rows.salesOpportunity.push({ id: `p${i}`, organizationId: 'org', normalizedCompany: 'cez', normalizedCity: 'kadan', companyName: 'ČEZ', city: 'Kadaň', semanticData: {}, mergedIntoId: null });
    assert.ok((await findCandidates(db as any, 'org', { companyName: 'ČEZ', city: 'Kadaň' })).length <= 10);
  });
});
