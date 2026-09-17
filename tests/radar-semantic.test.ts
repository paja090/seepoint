import test from 'node:test';
import assert from 'node:assert/strict';
import { combineSources, deterministicResolution, extractFacts, guardResolution, semanticConfig, type Facts } from '../lib/opportunities/semantic-core';

const base: Facts = { companyName: 'ČEZ', projectName: 'BESS Tušimice', city: 'Kadaň', location: 'Elektrárna Tušimice', projectSize: '200 MW', category: 'BESS' };
const candidates = [{ id: 'canonical', facts: base }];
const response = (confidence: number) => ({ decision: 'SAME_OPPORTUNITY', canonicalOpportunityId: 'canonical', confidence, reason: 'Stejný konkrétní projekt.' });
test('two differently titled articles with a shared tender identifier resolve without LLM', () => {
  const result = deterministicResolution({ tenderIdentifier: 'CZ-2026/123', sourceTitle: 'Nová výzva' }, [{ id: 'one', facts: { tenderIdentifier: 'CZ-2026/123', sourceTitle: 'Zakázka vyhlášena' } }]);
  assert.equal(result?.decision, 'SAME_OPPORTUNITY');
});
test('same company and category or same company and city cannot auto merge', () => {
  for (const facts of [{ companyName: 'ČEZ', category: 'BESS' }, { companyName: 'ČEZ', city: 'Kadaň', category: 'BESS' }]) {
    assert.equal(guardResolution(response(.99), facts, [{ id: 'canonical', facts }]).decision, 'POSSIBLE_DUPLICATE');
  }
});
test('configured confidence boundaries: .90 auto, .82 review, .74 new', () => {
  assert.equal(guardResolution(response(.90), base, candidates).decision, 'SAME_OPPORTUNITY');
  assert.equal(guardResolution(response(.82), base, candidates).decision, 'POSSIBLE_DUPLICATE');
  assert.equal(guardResolution(response(.74), base, candidates).decision, 'NEW_OPPORTUNITY');
  assert.equal(guardResolution(response(.94), base, candidates, semanticConfig({ RADAR_MERGE_THRESHOLD: '.95' })).decision, 'POSSIBLE_DUPLICATE');
  assert.throws(() => semanticConfig({ RADAR_MERGE_THRESHOLD: '.70' }));
});
test('critical conflicts veto high-confidence auto merge, including an identical identifier', () => {
  for (const conflict of [{ city: 'Opava' }, { location: 'Elektrárna Prunéřov' }, { projectSize: '100 MW' }, { projectIdentifier: 'other' }, { address: 'Ulice 20' }]) {
    const incoming = { ...base, projectIdentifier: 'one', address: 'Ulice 10', ...conflict };
    const result = guardResolution(response(.99), incoming, [{ id: 'canonical', facts: { ...base, projectIdentifier: 'one', address: 'Ulice 10' } }]);
    assert.notEqual(result.decision, 'SAME_OPPORTUNITY');
    assert.ok(result.conflictingSignals.length);
  }
});
test('different cities and distinct identifiers bypass paid comparison', () => {
  assert.equal(deterministicResolution({ ...base, city: 'Opava' }, candidates)?.decision, 'NEW_OPPORTUNITY');
  assert.equal(deterministicResolution({ tenderIdentifier: 'A' }, [{ id: 'b', facts: { tenderIdentifier: 'B' } }])?.decision, 'NEW_OPPORTUNITY');
});
test('untrusted resolver output cannot invent candidate IDs or confidence', () => {
  assert.throws(() => guardResolution({ ...response(.99), canonicalOpportunityId: 'foreign' }, base, candidates));
  assert.throws(() => guardResolution(response(2), base, candidates));
  assert.throws(() => guardResolution({ ...response(.9), confidence: '0.9' }, base, candidates));
});
test('enrichment retains investment provenance and conflicts; detach reconstruction removes its facts', () => {
  const sources = [{ id: 'a', facts: base }, { id: 'b', facts: { ...base, estimatedValue: '350000000', currency: 'CZK' } }];
  const combined = combineSources(sources);
  assert.equal(combined.facts.estimatedValue, '350000000');
  assert.equal(combined.provenance.estimatedValue, 'b');
  assert.equal(combineSources(sources.slice(0, 1)).facts.estimatedValue, undefined);
  const conflict = combineSources([...sources, { id: 'c', facts: { estimatedValue: '500000000', currency: 'CZK' } }]);
  assert.equal(conflict.facts.estimatedValue, '350000000');
  assert.equal(conflict.conflicts[0].sourceId, 'c');
});
test('optional extraction fields stay absent; domain comes from actual URL', () => {
  assert.deepEqual(extractFacts({ city: null, estimatedValue: NaN, country: 'null', announcementDate: '2026-02-31', sourceUrl: 'https://news.example/a', sourceDomain: 'invented.example' }), { sourceUrl: 'https://news.example/a', sourceDomain: 'news.example' });
});
