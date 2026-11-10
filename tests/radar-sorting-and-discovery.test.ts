/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import type { OrganizationRadarProfileData } from '../lib/opportunities/types';

const loader = Module as unknown as { _load: (...args: any[]) => any };
const originalLoad = loader._load;
loader._load = function (id: string, ...args: any[]) {
  return id === 'server-only' ? {} : originalLoad.call(this, id, ...args);
};

test('Radar Sorting and Discovery Enhancement Tests', async (t) => {
  const { parseOpportunityFilters, OpportunityValidationError } = await import('../lib/opportunities/policy');
  const { getCuratedRssFeeds } = await import('../lib/opportunities/feed-collector');

  await t.test('parseOpportunityFilters defaults to date_desc and parses allowed sortBy values', () => {
    // Default
    const defaultFilters = parseOpportunityFilters(new URLSearchParams());
    assert.equal(defaultFilters.sortBy, 'date_desc');

    // Explicit date_desc
    const dateDescFilters = parseOpportunityFilters(new URLSearchParams('sortBy=date_desc'));
    assert.equal(dateDescFilters.sortBy, 'date_desc');

    // Score desc
    const scoreFilters = parseOpportunityFilters(new URLSearchParams('sortBy=score_desc'));
    assert.equal(scoreFilters.sortBy, 'score_desc');

    // Event date
    const eventDateFilters = parseOpportunityFilters(new URLSearchParams('sortBy=event_date'));
    assert.equal(eventDateFilters.sortBy, 'event_date');

    // Date asc
    const dateAscFilters = parseOpportunityFilters(new URLSearchParams('sortBy=date_asc'));
    assert.equal(dateAscFilters.sortBy, 'date_asc');

    // Invalid sortBy throws OpportunityValidationError
    assert.throws(
      () => parseOpportunityFilters(new URLSearchParams('sortBy=invalid_sort')),
      OpportunityValidationError
    );
  });

  await t.test('getCuratedRssFeeds returns national business and matching regional feeds', () => {
    const profile: OrganizationRadarProfileData = {
      organizationId: 'org_test_123',
      enabled: true,
      targetRegions: ['Ústecký kraj'],
      targetCities: ['Most', 'Ústí nad Labem'],
      focusEventTypes: ['STORE_OPENING'],
      preferredMediaTypes: ['BILLBOARD'],
      customKeywords: [],
      customRssSources: [],
      minScoreThreshold: 40,
    };

    const feeds = getCuratedRssFeeds(profile);
    assert.ok(feeds.length >= 4, 'Should include multiple feeds');

    // National feeds
    assert.ok(feeds.some(f => f.includes('ekonomika')), 'Should contain national business feeds');

    // Ustecky regional feeds
    assert.ok(feeds.some(f => f.includes('servis.idnes.cz/rss.aspx?c=usti') || f.includes('denik.cz/rss/ustecky-kraj')), 'Should contain Ustecky regional feed');
  });

  await t.test('getCuratedRssFeeds handles empty targets with default major regional feeds', () => {
    const profile: OrganizationRadarProfileData = {
      organizationId: 'org_test_empty',
      enabled: true,
      targetRegions: [],
      targetCities: [],
      focusEventTypes: [],
      preferredMediaTypes: [],
      customKeywords: [],
      customRssSources: [],
      minScoreThreshold: 40,
    };

    const feeds = getCuratedRssFeeds(profile);
    assert.ok(feeds.length >= 4, 'Should contain fallback feeds');
    assert.ok(feeds.some(f => f.includes('denik.cz') || f.includes('idnes.cz')));
  });
});
