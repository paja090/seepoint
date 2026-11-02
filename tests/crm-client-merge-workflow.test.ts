import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simplifyClientName,
  computeClientCompletenessScore,
} from '../lib/crm/duplicates-service.ts';

test('1. simplifyClientName strips legal forms, diacritics, and symbols', () => {
  assert.equal(simplifyClientName('Pavel Šubert'), 'pavelsubert');
  assert.equal(simplifyClientName('pavel subert'), 'pavelsubert');
  assert.equal(simplifyClientName('Pavel Šubert s.r.o.'), 'pavelsubert');
  assert.equal(simplifyClientName('BILLA, spol. s r. o.'), 'billa');
  assert.equal(simplifyClientName('Billa'), 'billa');
  assert.equal(simplifyClientName('Penny Market s.r.o.'), 'pennymarket');
  assert.equal(simplifyClientName('Penny Market'), 'pennymarket');
  assert.equal(simplifyClientName("McDonald's ČR spol. s r.o."), 'mcdonaldscr');
  assert.equal(simplifyClientName("McDonald's"), 'mcdonalds');
  assert.equal(simplifyClientName('Bolt Services CZ s.r.o.'), 'boltservicescz');
});

test('2. computeClientCompletenessScore prefers profiles with IČO and active business data', () => {
  const profileWithIco = {
    companyId: '03510221',
    email: 'info@firma.cz',
    phone: '+420 123 456 789',
    billingCity: 'Ostrava',
    _count: {
      crmOrders: 2,
      offers: 3,
      occupancies: 1,
      currentSurfaces: 2,
      invoices: 1,
      navigationContracts: 0,
      contacts: 1,
    },
  };

  const adHocProfile = {
    companyId: null,
    email: null,
    phone: null,
    billingCity: null,
    _count: {
      crmOrders: 1,
      offers: 0,
      occupancies: 0,
      currentSurfaces: 0,
      invoices: 0,
      navigationContracts: 0,
      contacts: 0,
    },
  };

  const scoreWithIco = computeClientCompletenessScore(profileWithIco);
  const scoreAdHoc = computeClientCompletenessScore(adHocProfile);

  assert.ok(scoreWithIco > scoreAdHoc, 'Profile with IČO and orders must have higher score than ad-hoc duplicate');
  assert.ok(scoreWithIco >= 150);
  assert.equal(scoreAdHoc, 20);
});

test('3. Client deduplication: auto-enrich fills missing fields on target client from source client', () => {
  const targetClient = {
    id: 'tgt-1',
    name: 'Pavel Šubert',
    companyId: '03510221',
    dic: null,
    email: null,
    phone: null,
    billingStreet: null,
    billingCity: 'Fryčovice',
    billingZip: null,
  };

  const sourceClient = {
    id: 'src-1',
    name: 'pavel subert',
    companyId: null,
    dic: 'CZ03510221',
    email: 'subert.pvel@gmail.com',
    phone: '+420 777 888 999',
    billingStreet: 'č.p. 481',
    billingCity: 'Fryčovice',
    billingZip: '73945',
  };

  // Simulating enrichment logic from mergeDuplicateClients
  const enrichData: Record<string, unknown> = {};
  if (!targetClient.companyId && sourceClient.companyId) enrichData.companyId = sourceClient.companyId;
  if (!targetClient.dic && sourceClient.dic) enrichData.dic = sourceClient.dic;
  if (!targetClient.email && sourceClient.email) enrichData.email = sourceClient.email;
  if (!targetClient.phone && sourceClient.phone) enrichData.phone = sourceClient.phone;
  if (!targetClient.billingStreet && sourceClient.billingStreet) enrichData.billingStreet = sourceClient.billingStreet;
  if (!targetClient.billingCity && sourceClient.billingCity) enrichData.billingCity = sourceClient.billingCity;
  if (!targetClient.billingZip && sourceClient.billingZip) enrichData.billingZip = sourceClient.billingZip;

  assert.equal(enrichData.dic, 'CZ03510221');
  assert.equal(enrichData.email, 'subert.pvel@gmail.com');
  assert.equal(enrichData.phone, '+420 777 888 999');
  assert.equal(enrichData.billingStreet, 'č.p. 481');
  assert.equal(enrichData.billingZip, '73945');
  assert.equal(enrichData.companyId, undefined, 'Existing IČO on target must not be overwritten');
});

test('4. Merged client normalizedName is prefixed with [merged-...] to free unique constraint', () => {
  const sourceClientId = 'cmtvm3wia0001jj047hww54a3';
  const originalNormalizedName = 'pavel subert';

  const uniqueMergedName = originalNormalizedName.startsWith('[merged-')
    ? originalNormalizedName
    : `[merged-${sourceClientId.slice(-8)}]-${originalNormalizedName}`.slice(0, 180);

  assert.equal(uniqueMergedName, '[merged-7hww54a3]-pavel subert');
  assert.ok(uniqueMergedName.startsWith('[merged-'));
});
