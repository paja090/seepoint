import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertOfferTransition,
  assertAvailability,
  calculateOffer,
  canAccessOffer,
  canConvertOfferRole,
  cloneOfferInput,
  normalizeOfferInput,
  OfferValidationError,
  planOfferConversion,
  recoverFixedDiscount,
  serverOfferAuthor,
  stripPublicOfferSecrets,
} from '../lib/offers/domain.ts';
import { createPublicOfferToken, hashPublicOfferToken, isPlausiblePublicOfferToken } from '../lib/offers/token.ts';

const item = (surfaceId = 'surface-1') => ({ surfaceId, dateFrom: '2026-08-01', dateTo: '2026-08-31', quantity: '2', unit: 'plocha', unitPrice: '1000.25', discountPercent: '10', discountAmount: '50', groupLabel: 'CITY_POSTER' });
const payload = (items = [item()]) => ({ clientId: 'client-1', title: 'Interní nabídka', campaignName: 'Letní kampaň', taxRate: '21', confirmNegotiation: false, items });

test('vytvoření a úprava nabídky zachová více položek', () => {
  const normalized = normalizeOfferInput(payload([item('surface-1'), item('surface-2')]));
  assert.equal(normalized.items.length, 2);
  assert.deepEqual(normalized.items.map((row) => row.surfaceId), ['surface-1', 'surface-2']);
});

test('finanční výpočty používají Decimal a bezpečné zaokrouhlení', () => {
  const calculated = calculateOffer([item()], '21');
  assert.equal(calculated.items[0].baseAmount, '2000.50');
  assert.equal(calculated.items[0].calculatedDiscount, '250.05');
  assert.equal(calculated.totals.subtotal, '1750.45');
  assert.equal(calculated.totals.taxAmount, '367.59');
  assert.equal(calculated.totals.totalWithTax, '2118.04');
});

test('standardní nabídka zachová identitu vybraného databázového balíčku', () => {
  assert.equal(normalizeOfferInput({ ...payload(), packageId: 'package-1' }).packageId, 'package-1');
});

test('ceník připočítá výrobu a služby serverově pomocí Decimal', () => {
  const calculated = calculateOffer([item()], '21', [
    { priceRuleId: 'print', category: 'PRODUCTION', code: 'PRINT', label: 'Tisk', quantity: '2', unit: 'ks', unitPrice: '174.50', sortOrder: 0 },
    { priceRuleId: 'service', category: 'SERVICE', code: 'SERVICE', label: 'Servis', quantity: '1', unit: 'projekt', unitPrice: '2000', sortOrder: 1 },
  ]);
  assert.equal(calculated.charges[0].subtotal, '349.00');
  assert.equal(calculated.charges[1].subtotal, '2000.00');
  assert.equal(calculated.totals.subtotalBeforeDiscount, '4349.50');
  assert.equal(calculated.totals.subtotal, '4099.45');
  assert.equal(calculated.totals.totalWithTax, '4960.33');
});

test('editace a duplikace obnoví pevnou část slevy z uložené celkové slevy', () => {
  assert.equal(recoverFixedDiscount('2', '1000.25', '10', '250.05'), '50.00');
  assert.equal(recoverFixedDiscount('1', '999.99', '0', '25.50'), '25.50');
  assert.equal(recoverFixedDiscount('1', '100', '10', null), '0.00');
});

test('prázdná nabídka je zamítnuta', () => {
  assert.throws(() => normalizeOfferInput(payload([])), (error: unknown) => error instanceof OfferValidationError && error.code === 'EMPTY_OFFER');
});

test('duplicitní plocha je zamítnuta', () => {
  assert.throws(() => normalizeOfferInput(payload([item(), item()])), (error: unknown) => error instanceof OfferValidationError && error.code === 'DUPLICATE_SURFACE');
});

const conflict = (status: 'OCCUPIED' | 'RESERVED' | 'NEGOTIATION') => ({ surfaceId: 'surface-1', surfaceName: 'A', carrierCode: 'SP-1', status, clientName: 'Klient', campaignName: 'Kampaň', dateFrom: '2026-08-01', dateTo: '2026-08-31', severity: status === 'NEGOTIATION' ? 'warning' as const : 'block' as const });

test('OCCUPIED a RESERVED blokují nabídku', () => {
  for (const status of ['OCCUPIED', 'RESERVED'] as const) assert.throws(() => assertAvailability([conflict(status)], false), OfferValidationError);
});

test('NEGOTIATION vyžaduje výslovné potvrzení a poté pokračuje', () => {
  assert.throws(() => assertAvailability([conflict('NEGOTIATION')], false), (error: unknown) => error instanceof OfferValidationError && error.code === 'NEGOTIATION_CONFIRMATION_REQUIRED');
  assert.doesNotThrow(() => assertAvailability([conflict('NEGOTIATION')], true));
});

test('createdBy je vždy odvozen ze serverového uživatele a klientský createdBy se ignoruje', () => {
  const normalized = normalizeOfferInput({ ...payload(), createdBy: 'PODVRŽENÝ UŽIVATEL' });
  assert.equal('createdBy' in normalized, false);
  assert.deepEqual(serverOfferAuthor({ id: 'user-1', name: 'Obchodník', email: 'sales@example.test', role: 'SALES' }), { createdBy: 'Obchodník', createdByUserId: 'user-1', updatedByUserId: 'user-1' });
});

test('RBAC omezuje vlastnictví SALES a převod pouze na ADMIN/MANAGER', () => {
  const sales = { id: 'sales-1', name: 'Sales', email: 'sales@example.test', role: 'SALES' as const };
  assert.equal(canAccessOffer(sales, 'sales-1'), true);
  assert.equal(canAccessOffer(sales, 'sales-2'), false);
  assert.equal(canConvertOfferRole('SALES'), false);
  assert.equal(canConvertOfferRole('MANAGER'), true);
  assert.equal(canAccessOffer({ ...sales, role: 'ADMIN' }, 'sales-2'), true);
});

test('nepovolené statusové přechody jsou zamítnuty', () => {
  assert.doesNotThrow(() => assertOfferTransition('DRAFT', 'SENT'));
  assert.doesNotThrow(() => assertOfferTransition('SENT', 'ACCEPTED'));
  assert.throws(() => assertOfferTransition('DRAFT', 'ACCEPTED'), (error: unknown) => error instanceof OfferValidationError && error.code === 'INVALID_STATUS_TRANSITION');
  assert.throws(() => assertOfferTransition('ACCEPTED', 'SENT'), OfferValidationError);
});

test('duplikace vytváří nezávislý koncept se všemi položkami', () => {
  const source = normalizeOfferInput({ ...payload([item('surface-1'), item('surface-2')]), chargeSelections: [{ priceRuleId: 'print', quantity: '2' }] });
  const copy = cloneOfferInput(source);
  copy.items[0].unitPrice = '999';
  copy.chargeSelections[0].quantity = '5';
  assert.equal(copy.title, 'Kopie – Interní nabídka');
  assert.equal(copy.items.length, 2);
  assert.equal(source.items[0].unitPrice, '1000.25');
  assert.equal(source.chargeSelections[0].quantity, '2.00');
});

test('veřejný token má dostatečnou entropii a v databázi se ukládá jen hash', () => {
  const first = createPublicOfferToken(); const second = createPublicOfferToken();
  assert.equal(isPlausiblePublicOfferToken(first.token), true);
  assert.notEqual(first.token, second.token);
  assert.equal(first.hash, hashPublicOfferToken(first.token));
  assert.equal(first.hash.length, 64);
  assert.equal(first.hash.includes(first.token), false);
});

test('veřejný view model skryje interní ID, poznámku, rozpočet a e-mail autora', () => {
  const publicJson = stripPublicOfferSecrets({ id: 'offer-secret', clientId: 'client-secret', title: 'Veřejná kampaň', internalNote: 'TAJNÁ POZNÁMKA', budget: '10000', events: [{ type: 'CREATED' }], converted: false, archivedAt: null, hasPublicLink: true, createdBy: { id: 'user-secret', name: 'Sales', email: 'private@example.test' }, client: { name: 'Klient', companyId: '123' }, items: [{ id: 'item-secret', surfaceId: 'surface-secret', note: 'interní', surface: { name: 'Plocha', status: 'AVAILABLE' } }] });
  assert.equal(publicJson.title, 'Veřejná kampaň');
  for (const key of ['id', 'clientId', 'internalNote', 'budget', 'events', 'converted']) assert.equal(key in publicJson, false, key);
  assert.equal(JSON.stringify(publicJson).includes('private@example.test'), false);
  assert.equal(JSON.stringify(publicJson).includes('TAJNÁ POZNÁMKA'), false);
});

test('převod je idempotentní a částečný stav se zastaví před zápisy', () => {
  assert.equal(planOfferConversion(['a', 'b'], []), 'create');
  assert.equal(planOfferConversion(['a', 'b'], ['b', 'a']), 'idempotent');
  assert.throws(() => planOfferConversion(['a', 'b'], ['a']), (error: unknown) => error instanceof OfferValidationError && error.code === 'PARTIAL_CONVERSION');
});
