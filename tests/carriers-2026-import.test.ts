import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildImportPlan, classifyCampaignPeriod, databaseFingerprint, mergeCampaignMonths, validateScopePlan } from '../lib/carriers-2026/plan.ts';
import type { ExistingState, ParsedWorkbook, SourceCampaign, SourceCarrier } from '../lib/carriers-2026/types.ts';
import { campaignFromValue } from '../lib/carriers-2026/workbook.ts';
import { applyResolutionCsv, writeResolutionCsv } from '../lib/carriers-2026/resolutions.ts';
import { clientResolutionFilter, occupancyClientLabel } from '../lib/occupancy-client.ts';

function campaign(name: string, month: number, clientName?: string): SourceCampaign {
  return { year: 2026, month, campaignName: name, normalizedCampaignName: name.toLowerCase(), rawSourceText: name, clientName, clientResolution: clientName ? 'EXPLICIT_COLUMN' : 'UNRESOLVED', status: 'RESERVED', sourceColumn: month };
}

function carrier(overrides: Partial<SourceCarrier> = {}): SourceCarrier {
  return {
    sourceKey: 'CARRIERS2026:CARRIER:PL1', code: 'PL-1', codeAliases: ['1'], name: 'Lavička 1',
    type: 'PROMO_BENCH', city: 'Ostrava', sourceSheet: 'PL26', sourceRow: 3,
    surfaces: [{ sourceKey: 'CARRIERS2026:SURFACE:PL1:1', sourcePosition: '1', name: 'Celý nosič', mediaType: 'PROMO_BENCH', campaigns: [] }],
    ...overrides,
  };
}

function workbook(carriers = [carrier()]): ParsedWorkbook {
  return { fileName: 'db.xlsx', fileHash: 'hash', sheetNames: ['PL26', 'CENÍK 2026'], processedSheets: ['PL26', 'CENÍK 2026'], auxiliarySheets: [], processedRows: carriers.length, carriers, prices: [], issues: [] };
}

function state(): ExistingState {
  return { carriers: [], clients: [], prices: [] };
}

function deterministicPlan(source: ParsedWorkbook, existing: ExistingState) {
  return buildImportPlan(source, existing, 'local', '2026-01-01', { asOfDate: '2026-07-18' });
}

function existingCarrier(overrides: Partial<ExistingState['carriers'][number]> = {}): ExistingState['carriers'][number] {
  return {
    id: 'db-carrier', code: 'PL-1', name: 'Lavička 1', type: 'PROMO_BENCH', city: 'Ostrava', locality: null,
    street: null, address: null, latitude: null, longitude: null, sourceKey: null, sourceSystem: 'MEDIA_INVENTORY_IMPORT',
    sourceSheet: 'PL25', sourceRow: 2, photoCount: 4,
    surfaces: [{ id: 'db-surface', name: 'Celý nosič', mediaType: 'PROMO_BENCH', sourcePosition: '1', orientation: null, sourceKey: null, occupancies: [] }],
    ...overrides,
  };
}

test('měsíční text je kampaň, nikoli klient', () => {
  const parsed = campaignFromValue('Letní akce', 2026, 8, 22);
  assert.equal(parsed?.campaignName, 'Letní akce');
  assert.equal(parsed?.clientName, undefined);
  assert.equal(parsed?.clientResolution, 'UNRESOLVED');
});

test('číselné značky volnosti nevytvoří kampaň', () => {
  assert.equal(campaignFromValue(1, 2026, 8, 22), undefined);
  assert.equal(campaignFromValue(0, 2026, 8, 22), undefined);
});

test('navazující měsíce stejné kampaně se spojí', () => {
  const periods = mergeCampaignMonths([campaign('Jaro', 1), campaign('Jaro', 2), campaign('Jaro', 3)]);
  assert.equal(periods.length, 1);
  assert.equal(periods[0].dateFrom, '2026-01-01');
  assert.equal(periods[0].dateTo, '2026-03-31');
});

test('mezera rozdělí období', () => assert.equal(mergeCampaignMonths([campaign('Jaro', 1), campaign('Jaro', 3)]).length, 2));
test('různé kampaně stejného klienta se nesloučí', () => assert.equal(mergeCampaignMonths([campaign('A', 1, 'Klient'), campaign('B', 2, 'Klient')]).length, 2));
test('stejná kampaň různých klientů se nesloučí', () => assert.equal(mergeCampaignMonths([campaign('Akce', 1, 'A'), campaign('Akce', 2, 'B')]).length, 2));

test('kampaň bez klienta nevytvoří Client a je v reportu', () => {
  const source = carrier();
  source.surfaces[0].campaigns = [campaign('Kampaň', 8)];
  const plan = deterministicPlan(workbook([source]), state());
  assert.equal(plan.clients.create.length, 0);
  assert.equal(plan.occupancies[0].action, 'NEW_OCCUPANCY');
  assert.equal(plan.occupancies[0].clientResolutionStatus, 'UNRESOLVED');
  assert.ok(plan.issues.some(({ code }) => code === 'CAMPAIGN_WITHOUT_RESOLVED_CLIENT'));
});

test('existující jednoznačné mapování kampaně propojí klienta', () => {
  const source = carrier();
  source.surfaces[0].campaigns = [campaign('Známá', 8)];
  const current = existingCarrier();
  current.surfaces[0].occupancies.push({ id: 'old', clientId: 'client-1', clientName: 'Klient', campaignName: 'Známá', dateFrom: new Date('2025-01-01Z'), dateTo: new Date('2025-01-31Z'), status: 'FINISHED' });
  const existing = state(); existing.carriers = [current]; existing.clients = [{ id: 'client-1', name: 'Klient', normalizedName: 'klient', companyId: null, externalCode: null }];
  const plan = deterministicPlan(workbook([source]), existing);
  assert.equal(plan.occupancies[0].clientId, 'client-1');
  assert.equal(plan.stats.createdClients, 0);
});

test('klient ze samostatného pole se páruje, ale nevytváří z kampaně', () => {
  const source = carrier(); source.surfaces[0].campaigns = [campaign('Akce', 8, 'Objednavatel s.r.o.')];
  const existing = state(); existing.clients = [{ id: 'client-explicit', name: 'Objednavatel s.r.o.', normalizedName: 'objednavatel sro', companyId: null, externalCode: null }];
  const plan = deterministicPlan(workbook([source]), existing);
  assert.equal(plan.occupancies[0].clientId, 'client-explicit');
  assert.equal(plan.clients.create.length, 0);
});

test('klient se může bezpečně propojit přes existující číslo objednávky', () => {
  const source = carrier();
  const ordered = campaign('Akce OBJ-1254', 8); ordered.orderReference = 'OBJ-1254';
  source.surfaces[0].campaigns = [ordered];
  const current = existingCarrier();
  current.surfaces[0].occupancies.push({ id: 'old-order', clientId: 'client-order', clientName: 'Klient objednávky', campaignName: 'Jiná akce', externalOrderReference: 'OBJ-1254', dateFrom: new Date('2025-01-01Z'), dateTo: new Date('2025-01-31Z'), status: 'FINISHED' });
  const existing = state(); existing.carriers = [current]; existing.clients = [{ id: 'client-order', name: 'Klient objednávky', normalizedName: 'klient objednavky', companyId: null, externalCode: null }];
  assert.equal(deterministicPlan(workbook([source]), existing).occupancies[0].clientId, 'client-order');
});

test('existující nosič se aktualizuje bez operace s fotkami', () => {
  const existing = state(); existing.carriers = [existingCarrier({ city: 'Havířov', photoCount: 9 })];
  const plan = deterministicPlan(workbook(), existing);
  assert.equal(plan.carriers[0].action, 'UPDATE');
  assert.equal(plan.carriers[0].existingId, 'db-carrier');
  assert.ok(!plan.carriers[0].changes.some(({ field }) => field.toLowerCase().includes('photo')));
});

test('nový nosič je NEW a přesný kód zabrání duplicitě', () => {
  assert.equal(deterministicPlan(workbook(), state()).carriers[0].action, 'NEW');
  const existing = state(); existing.carriers = [existingCarrier()];
  assert.notEqual(deterministicPlan(workbook(), existing).carriers[0].action, 'NEW');
});

test('více kandidátů vytvoří AMBIGUOUS_MATCH', () => {
  const existing = state(); existing.carriers = [existingCarrier(), existingCarrier({ id: 'db-carrier-2' })];
  assert.equal(deterministicPlan(workbook(), existing).carriers[0].action, 'AMBIGUOUS_MATCH');
});

test('kolize obsazenosti nepřepíše ruční historii', () => {
  const source = carrier(); source.surfaces[0].campaigns = [campaign('Nová', 8)];
  const current = existingCarrier();
  current.surfaces[0].occupancies.push({ id: 'manual', clientId: null, clientName: 'Ruční', campaignName: 'Jiná', dateFrom: new Date('2026-08-01Z'), dateTo: new Date('2026-08-31Z'), status: 'RESERVED' });
  const existing = state(); existing.carriers = [current];
  assert.equal(deterministicPlan(workbook([source]), existing).occupancies[0].action, 'OCCUPANCY_CONFLICT');
});

test('opakovaný import identické obsazenosti je UNCHANGED', () => {
  const source = carrier(); source.surfaces[0].campaigns = [campaign('Stejná', 8)];
  const current = existingCarrier();
  current.surfaces[0].occupancies.push({ id: 'same', clientId: null, clientName: 'NEVYŘEŠENÝ KLIENT', campaignName: 'Stejná', dateFrom: new Date('2026-08-01T00:00:00Z'), dateTo: new Date('2026-08-31T23:59:59Z'), status: 'RESERVED' });
  const existing = state(); existing.carriers = [current];
  assert.equal(deterministicPlan(workbook([source]), existing).occupancies[0].action, 'UNCHANGED');
});

test('chybějící dříve importovaný nosič se pouze reportuje', () => {
  const existing = state(); existing.carriers = [existingCarrier({ id: 'missing', code: 'PL-9' })];
  assert.equal(deterministicPlan(workbook([]), existing).missingInNewSource.length, 0);
  const other = carrier({ code: 'PL-1' });
  const plan = deterministicPlan(workbook([other]), existing);
  assert.equal(plan.missingInNewSource[0].id, 'missing');
});

test('změna ceny vytvoří novou historickou verzi', () => {
  const source = workbook([]);
  source.prices = [{ identityKey: 'PRICE:x:1:1', name: 'X', rentalMonths: 1, minQuantity: 1, rentalPrice: '100.00', productionPrice: '20.00', totalPrice: '120.00', currency: 'CZK', sourceSheet: 'CENÍK 2026', sourceRow: 5 }];
  const existing = state(); existing.prices = [{ id: 'price', identityKey: 'PRICE:x:1:1', versionKey: 'old', rentalPrice: '90.00', productionPrice: '20.00', totalPrice: '110.00', validFrom: new Date('2025-01-01Z'), validTo: null, isActive: true }];
  assert.equal(deterministicPlan(source, existing).prices[0].action, 'CHANGED_PRICE');
});

test('manual conflict includes origin, classification and fingerprint', () => {
  const source = carrier(); source.surfaces[0].campaigns = [campaign('New', 8)];
  const current = existingCarrier();
  current.surfaces[0].occupancies.push({ id: 'manual-detail', clientId: null, clientName: 'Manual', campaignName: 'Other', dateFrom: new Date('2026-08-01Z'), dateTo: new Date('2026-08-31Z'), status: 'RESERVED' });
  const existing = state(); existing.carriers = [current];
  const conflict = deterministicPlan(workbook([source]), existing).occupancies[0].conflict;
  assert.equal(conflict?.classification, 'MANUAL_RECORD_CONFLICT');
  assert.equal(conflict?.existingRecordOrigin, 'MANUAL');
  assert.equal(conflict?.recordFingerprint.length, 64);
});

test('previous import extension is distinguished from manual history', () => {
  const source = carrier(); source.surfaces[0].campaigns = [campaign('Imported', 8), campaign('Imported', 9)];
  const current = existingCarrier();
  current.surfaces[0].occupancies.push({ id: 'prior', clientId: null, clientName: 'X', campaignName: 'Imported', dateFrom: new Date('2026-08-01Z'), dateTo: new Date('2026-08-31Z'), status: 'RESERVED', sourceSystem: 'CARRIERS_2026', sourceKey: 'prior-key' });
  const existing = state(); existing.carriers = [current];
  const conflict = deterministicPlan(workbook([source]), existing).occupancies[0].conflict;
  assert.equal(conflict?.classification, 'PREVIOUS_IMPORT_UPDATE');
  assert.equal(conflict?.underlyingClassification, 'SAME_CAMPAIGN_EXTENSION');
  assert.equal(conflict?.recommendedAction, 'MERGE_OR_EXTEND');
});

test('normalization and import metadata are not material updates', () => {
  const existing = state(); existing.carriers = [existingCarrier({ city: '  Ostrava  ', sourceSystem: null, sourceSheet: null, sourceRow: null, sourceKey: null })];
  const item = deterministicPlan(workbook(), existing).carriers[0];
  assert.equal(item.action, 'UNCHANGED');
  assert.equal(item.updateClass, 'NORMALIZATION_ONLY');
  assert.ok(item.normalizationChanges?.length);
  assert.ok(item.metadataChanges?.length);
});

test('new surface has an auditable reason', () => {
  const existing = state(); existing.carriers = [existingCarrier({ surfaces: [] })];
  const surface = deterministicPlan(workbook(), existing).surfaces[0];
  assert.equal(surface.action, 'NEW');
  assert.equal(surface.reason, 'NO_MATCHING_SURFACE_ON_EXISTING_CARRIER');
});

test('database fingerprint is stable and detects record changes', () => {
  const first = state(); first.carriers = [existingCarrier()];
  const second = state(); second.carriers = [existingCarrier()];
  assert.equal(databaseFingerprint(first), databaseFingerprint(second));
  second.carriers[0].name = 'Changed';
  assert.notEqual(databaseFingerprint(first), databaseFingerprint(second));
});

test('resolution validation rejects stale hashes, duplicate ids and unsafe actions', async () => {
  const source = carrier(); source.surfaces[0].campaigns = [campaign('New', 8)];
  const current = existingCarrier();
  current.surfaces[0].occupancies.push({ id: 'manual-resolution', clientId: null, clientName: 'Manual', campaignName: 'Old', dateFrom: new Date('2026-08-01Z'), dateTo: new Date('2026-08-31Z'), status: 'RESERVED' });
  const existing = state(); existing.carriers = [current];
  const plan = deterministicPlan(workbook([source]), existing);
  const row = { ...plan.resolution.rows[0], selectedAction: 'USE_IMPORT' as const, sourceFileHash: 'stale' };
  const path = join(tmpdir(), `carriers-resolution-${process.pid}-${Date.now()}.csv`);
  await writeResolutionCsv([row, row], path);
  await applyResolutionCsv(plan, path);
  assert.equal(plan.resolution.supplied, true);
  assert.equal(plan.resolution.stale, true);
  assert.ok(plan.resolution.invalid.some((message) => message.includes('Duplicate issueId')));
  assert.ok(plan.resolution.invalid.some((message) => message.includes('Source file hash mismatch')));
  assert.ok(plan.resolution.invalid.some((message) => message.includes('Manual record')));
  assert.equal(plan.safetyGate.blocked, true);
});

test('temporal classification is deterministic at boundaries', () => {
  assert.equal(classifyCampaignPeriod('2026-01-01', '2026-06-30', '2026-07-18'), 'HISTORICAL_COMPLETED');
  assert.equal(classifyCampaignPeriod('2026-05-01', '2026-09-30', '2026-07-18'), 'CURRENT_ACTIVE');
  assert.equal(classifyCampaignPeriod('2026-08-01', '2026-08-31', '2026-07-18'), 'FUTURE_RESERVED');
});

test('historical campaigns are reported but absent from safe and blocked plans', () => {
  const source = carrier(); source.surfaces[0].campaigns = [campaign('Past', 5)];
  const existing = state(); existing.carriers = [existingCarrier()];
  const plan = buildImportPlan(workbook([source]), existing, 'local', '2026-01-01', { asOfDate: '2026-07-18', scopes: ['occupancy'] });
  assert.equal(plan.historicalSkipped.length, 1);
  assert.equal(plan.occupancies.length, 0);
  assert.equal(plan.safePlan.operationCount, 0);
  assert.equal(plan.blockedPlan.operationCount, 0);
});

test('current and future unknown-client campaigns are safe with correct statuses', () => {
  const source = carrier(); source.surfaces[0].campaigns = [campaign('Current', 7), campaign('Future', 8)];
  const existing = state(); existing.carriers = [existingCarrier()];
  const plan = buildImportPlan(workbook([source]), existing, 'local', '2026-01-01', { asOfDate: '2026-07-18', scopes: ['occupancy'] });
  assert.deepEqual(plan.occupancies.map(({ status }) => status), ['OCCUPIED', 'RESERVED']);
  assert.ok(plan.occupancies.every(({ clientId, clientResolutionStatus }) => !clientId && clientResolutionStatus === 'UNRESOLVED'));
  assert.equal(plan.safePlan.operationCount, 2);
  assert.equal(plan.blockedPlan.operationCount, 0);
});

test('scopes isolate inventory pricing and occupancy operations', () => {
  const source = workbook(); source.prices = [{ identityKey: 'PRICE:x:1:1', name: 'X', rentalMonths: 1, minQuantity: 1, rentalPrice: '1.00', productionPrice: '2.00', totalPrice: '3.00', currency: 'CZK', sourceSheet: 'PRICE', sourceRow: 1 }];
  const inventory = buildImportPlan(source, state(), 'local', '2026-01-01', { scopes: ['inventory'], asOfDate: '2026-07-18' });
  const pricing = buildImportPlan(source, state(), 'local', '2026-01-01', { scopes: ['pricing'], asOfDate: '2026-07-18' });
  assert.ok(inventory.safePlan.operations.every(({ scope }) => scope === 'inventory'));
  assert.ok(pricing.safePlan.operations.every(({ scope }) => scope === 'pricing'));
  assert.equal(pricing.safePlan.operationCount, 1);
});

test('occupancy conflict does not block an inventory safe plan', () => {
  const source = carrier(); source.surfaces[0].campaigns = [campaign('Conflict', 8)];
  const current = existingCarrier(); current.surfaces[0].occupancies.push({ id: 'manual-scope', clientId: null, clientName: 'Manual', campaignName: 'Other', dateFrom: new Date('2026-08-01Z'), dateTo: new Date('2026-08-31Z'), status: 'RESERVED' });
  const existing = state(); existing.carriers = [current];
  const plan = buildImportPlan(workbook([source]), existing, 'local', '2026-01-01', { scopes: ['inventory'], asOfDate: '2026-07-18' });
  assert.equal(plan.safePlan.operations.some(({ scope }) => scope === 'occupancy'), false);
  assert.equal(plan.safetyGate.blocked, false);
});

test('photo audit is immutable and reports zero operations', () => {
  const existing = state(); existing.photos = [{ id: 'photo-1', carrierId: 'db-carrier', surfaceId: null, type: 'CARRIER' }];
  const plan = buildImportPlan(workbook(), existing, 'local', '2026-01-01', { scopes: ['inventory'], asOfDate: '2026-07-18' });
  assert.equal(plan.photoAudit.beforeCount, 1); assert.equal(plan.photoAudit.afterPlannedCount, 1); assert.equal(plan.photoAudit.operations, 0);
});

test('large GPS changes are excluded from the safe inventory plan', () => {
  const existing = state(); existing.carriers = [existingCarrier({ latitude: 49.8, longitude: 18.2 })];
  const source = carrier({ latitude: 50.0, longitude: 18.2 });
  const plan = buildImportPlan(workbook([source]), existing, 'local', '2026-01-01', { scopes: ['inventory'], asOfDate: '2026-07-18' });
  assert.equal(plan.stats.gpsChangesRequiringReview, 1);
  assert.ok(plan.blockedPlan.operations.some(({ kind }) => kind === 'UPDATE_CARRIER'));
  assert.ok(!plan.safePlan.operations.some(({ kind }) => kind === 'UPDATE_CARRIER'));
});

test('CP26 ambiguity is historical only when the whole source month is past', () => {
  const parsed = workbook([]); parsed.issues = [{ code: 'AMBIGUOUS_CAMPAIGN_DATA', sheetName: 'CP26', sourceRow: 10, sourceColumn: 15, rawValue: { month: 5, values: ['A', 'B'] }, message: 'x' }];
  const historical = buildImportPlan(parsed, state(), 'local', '2026-01-01', { scopes: ['occupancy'], asOfDate: '2026-07-18' });
  parsed.issues[0].rawValue = { month: 8, values: ['A', 'B'] };
  const future = buildImportPlan(parsed, state(), 'local', '2026-01-01', { scopes: ['occupancy'], asOfDate: '2026-07-18' });
  assert.equal(historical.stats.cpHistoricalPairs, 1); assert.equal(historical.blockedPlan.operationCount, 0);
  assert.equal(future.stats.cpUnresolvedTemporalPairs, 1); assert.equal(future.blockedPlan.operationCount, 1);
});

test('unresolved client UI label and filter are explicit', () => {
  assert.equal(occupancyClientLabel(null, null, 'placeholder'), 'Klient neurčen');
  assert.equal(clientResolutionFilter('unresolved'), 'unresolved');
  assert.equal(clientResolutionFilter('invalid'), 'all');
});

test('asOfDate is part of the immutable plan hash', () => {
  const first = buildImportPlan(workbook(), state(), 'local', '2026-01-01', { scopes: ['inventory'], asOfDate: '2026-07-18' });
  const second = buildImportPlan(workbook(), state(), 'local', '2026-01-01', { scopes: ['inventory'], asOfDate: '2026-07-19' });
  assert.notEqual(first.safePlan.planHash, second.safePlan.planHash);
});

test('safe plan validation rejects XLSX, database and as-of changes', () => {
  const plan = buildImportPlan(workbook(), state(), 'local', '2026-01-01', { scopes: ['inventory'], asOfDate: '2026-07-18' });
  assert.equal(validateScopePlan(plan.safePlan, plan, ['inventory']).planHash, plan.safePlan.planHash);
  assert.throws(() => validateScopePlan(plan.safePlan, { ...plan, fileHash: 'changed' }, ['inventory']), /XLSX hash/);
  assert.throws(() => validateScopePlan(plan.safePlan, { ...plan, databaseFingerprint: 'changed' }, ['inventory']), /Database snapshot/);
  assert.throws(() => validateScopePlan(plan.safePlan, { ...plan, asOfDate: '2026-07-19' }, ['inventory']), /asOfDate/);
});

test('campaign client groups do not merge the same generic name across sources', () => {
  const left = carrier({ sourceKey: 'left', code: 'PL-L', codeAliases: ['L'], sourceSheet: 'PL26' }); left.surfaces[0].sourceKey = 'left-surface'; left.surfaces[0].sourcePosition = 'L'; left.surfaces[0].campaigns = [campaign('Akce', 8)];
  const right = carrier({ sourceKey: 'right', code: 'CP-R', codeAliases: ['R'], sourceSheet: 'CP26', type: 'CITY_POSTER' }); right.surfaces[0].sourceKey = 'right-surface'; right.surfaces[0].sourcePosition = 'R'; right.surfaces[0].mediaType = 'CITY_POSTER'; right.surfaces[0].campaigns = [campaign('Akce', 8)];
  const existing = state(); existing.carriers = [existingCarrier({ id: 'left-db', code: 'PL-L', surfaces: [{ ...existingCarrier().surfaces[0], id: 'left-db-surface', sourcePosition: 'L' }] }), existingCarrier({ id: 'right-db', code: 'CP-R', type: 'CITY_POSTER', surfaces: [{ ...existingCarrier().surfaces[0], id: 'right-db-surface', sourcePosition: 'R', mediaType: 'CITY_POSTER' }] })];
  const plan = buildImportPlan(workbook([left, right]), existing, 'local', '2026-01-01', { scopes: ['occupancy'], asOfDate: '2026-07-18' });
  assert.equal(plan.campaignClientGroups.length, 2);
});

test('manual CP slot dates must stay in month and never overlap', async () => {
  const parsed = workbook([]); parsed.issues = [{ code: 'AMBIGUOUS_CAMPAIGN_DATA', sheetName: 'CP26', sourceRow: 20, sourceColumn: 15, rawValue: { month: 8, values: ['A', 'B'] }, message: 'x' }];
  const plan = buildImportPlan(parsed, state(), 'local', '2026-01-01', { scopes: ['occupancy'], asOfDate: '2026-07-18' });
  const row = { ...plan.resolution.rows[0], selectedAction: 'SET_MANUAL_DATE_RANGES' as const, slot1StartDate: '2026-08-01', slot1EndDate: '2026-08-20', slot2StartDate: '2026-08-15', slot2EndDate: '2026-09-01' };
  const path = join(tmpdir(), `cp-resolution-${process.pid}-${Date.now()}.csv`);
  await writeResolutionCsv([row], path); await applyResolutionCsv(plan, path);
  assert.ok(plan.resolution.invalid.some((message) => message.includes('outside the source month')));
  assert.ok(plan.resolution.invalid.some((message) => message.includes('overlap')));
});
