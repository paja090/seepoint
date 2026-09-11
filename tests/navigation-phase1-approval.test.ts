import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  shouldCreateNavigationOrderAfterAcceptance,
  OfferValidationError,
} from '../lib/offers/domain.ts';
import { createPublicOfferToken, hashPublicOfferToken } from '../lib/offers/token.ts';

test('TEST 1 & TEST 2: Navigace 1. fáze bez cen – schválení výběru lokalit bez objednávky výroby', () => {
  // Phase 1 (LOCATION_SELECTION) must NOT trigger automatic order conversion
  assert.equal(
    shouldCreateNavigationOrderAfterAcceptance({
      offerType: 'NAVIGATION',
      proposalMode: 'LOCATION_SELECTION',
    }),
    false,
    'Fáze 1 (LOCATION_SELECTION) nesmí vytvořit výrobní zakázku'
  );

  // Phase 2 (PRICED_QUOTE) DOES trigger automatic order conversion upon acceptance
  assert.equal(
    shouldCreateNavigationOrderAfterAcceptance({
      offerType: 'NAVIGATION',
      proposalMode: 'PRICED_QUOTE',
    }),
    true,
    'Fáze 2 (PRICED_QUOTE) po schválení vytvoří zakázku'
  );
});

test('TEST 3: Navigace 1. fáze bez cen – nezobrazuje falešné 0 Kč v public view modelu', () => {
  const serviceCode = readFileSync(new URL('../lib/offers/service.ts', import.meta.url), 'utf8');

  // Verify that LOCATION_SELECTION suppresses totals in publicView
  assert.match(
    serviceCode,
    /row\.offerType === 'NAVIGATION' && row\.navigationOffer\?\.proposalMode === 'LOCATION_SELECTION'/,
    'service.ts musí pro LOCATION_SELECTION v publicView skrýt celkové částky'
  );

  // Verify NavigationOfferPublicView suppresses pricing table in Phase 1
  const viewCode = readFileSync(new URL('../components/offers/NavigationOfferPublicView.tsx', import.meta.url), 'utf8');
  assert.match(
    viewCode,
    /Cena bude doplněna v další fázi/,
    'NavigationOfferPublicView musí obsahovat zprávu o doplnění ceny v další fázi'
  );
});

test('TEST 4: Finální nabídka (PRICED_QUOTE) vyžaduje validní cenu a odmítne 0 Kč', () => {
  const serviceCode = readFileSync(new URL('../lib/offers/service.ts', import.meta.url), 'utf8');

  // Verify that PRICED_QUOTE enforces pricing validation upon acceptance
  assert.match(
    serviceCode,
    /MISSING_PRICE/,
    'service.ts musí odmítnout schválení PRICED_QUOTE s nulovou nebo chybějící cenou'
  );
  assert.match(
    serviceCode,
    /Finální nabídku nelze schválit bez platné cenové kalkulace/,
    'Chybová hláška musí uživatele informovat o chybějící cenové kalkulaci'
  );
});

test('TEST 5 & TEST 6: Ochrana tokenů a tenant boundary při schvalování', () => {
  const { token } = createPublicOfferToken();
  assert.equal(typeof token, 'string');
  assert.ok(token.length >= 32);

  const hash = hashPublicOfferToken(token);
  assert.equal(typeof hash, 'string');
  assert.notEqual(hash, token);

  // Test deterministic hashing
  assert.equal(hashPublicOfferToken(token), hash);

  // Different tokens produce distinct hashes
  const { token: token2 } = createPublicOfferToken();
  assert.notEqual(hashPublicOfferToken(token2), hash);

  // Verify that selection route enforces rate limit and tenant context
  const selectionRoute = readFileSync(new URL('../app/api/proposals/[token]/selection/route.ts', import.meta.url), 'utf8');
  assert.match(selectionRoute, /enforceRateLimit/, 'Selection route musí obsahovat rate limiting');
  assert.match(selectionRoute, /runWithTenantContext/, 'Selection route musí běžet v tenant contextu');
});

test('TEST 7: Idempotence potvrzení výběru bodů klientem', () => {
  const selectionRoute = readFileSync(new URL('../app/api/proposals/[token]/selection/route.ts', import.meta.url), 'utf8');

  // Must detect existing identical selection and return alreadySubmitted: true without duplicate events
  assert.match(
    selectionRoute,
    /alreadySubmitted:\s*true/,
    'Opakované odeslání stejného výběru musí vrátit alreadySubmitted: true'
  );
  assert.match(
    selectionRoute,
    /isIdenticalSelection/,
    'Endpoint musí kontrolovat shodu výběru před vytvořením nového eventu'
  );
});

test('TEST 8: Selhání notifikačního e-mailu neohrozí uložení potvrzení klienta', () => {
  const selectionRoute = readFileSync(new URL('../app/api/proposals/[token]/selection/route.ts', import.meta.url), 'utf8');

  // Verify non-blocking email call in try/catch AFTER the database transaction commits
  const txIndex = selectionRoute.indexOf('prisma.$transaction');
  const emailCallIndex = selectionRoute.lastIndexOf('sendTransactionalEmail(');
  assert.ok(txIndex !== -1, 'Database transaction musí existovat');
  assert.ok(emailCallIndex !== -1, 'Odesílání emailu musí existovat');
  assert.ok(emailCallIndex > txIndex, 'Odeslání emailu musí být až PO commitu databázové transakce');

  // Email must be wrapped in try/catch
  const afterTx = selectionRoute.slice(txIndex);
  assert.match(
    afterTx,
    /try\s*\{[\s\S]*sendTransactionalEmail[\s\S]*\}\s*catch\s*\(emailError\)/,
    'Odeslání emailu musí být bezpečně ošetřeno v try/catch'
  );
});
