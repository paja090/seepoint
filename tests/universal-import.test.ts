import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySheetRuleBased, TARGET_FIELDS_BY_ENTITY } from '../lib/imports/ai-mapping.ts';
import { matchCarrier, matchClient } from '../lib/imports/matching.ts';
import type { ExistingCarrierRecord, ExistingClientRecord } from '../lib/imports/matching.ts';
import { checkSchemaDrift } from '../lib/imports/profile-service.ts';
import { parseUploadedWorkbook } from '../lib/imports/parser.ts';

test('1. rule-based sheet classification rozpozná české i anglické názvy listů', () => {
  assert.equal(classifySheetRuleBased('CENÍK 2026', ['Formát', 'Cena']).classification, 'PRICES');
  assert.equal(classifySheetRuleBased('PriceList', ['Format', 'Price']).classification, 'PRICES');
  assert.equal(classifySheetRuleBased('Nosiče Ostrava', ['Kód', 'Adresa', 'GPS']).classification, 'CARRIERS');
  assert.equal(classifySheetRuleBased('Klienti', ['Firma', 'IČO', 'Email']).classification, 'CLIENTS');
  assert.equal(classifySheetRuleBased('Obsazenost 2026', ['Kód', 'Leden', 'Únor']).classification, 'OCCUPANCY');
  assert.equal(classifySheetRuleBased('Navigace VO', ['Číslo sloupu', 'Ulice']).classification, 'NAVIGATION');
});

test('2. carrier matching: stejný kód nosiče vrátí MATCHED', () => {
  const existing: ExistingCarrierRecord[] = [
    {
      id: 'c1',
      code: 'BB-01',
      name: 'Billboard Nádražní',
      type: 'BILLBOARD',
      city: 'Ostrava',
      street: 'Nádražní',
      latitude: 49.835,
      longitude: 18.292,
      sourceKey: 'IMPORT:ORG1:CARRIER:BB01',
      photoCount: 2,
    },
  ];

  const res = matchCarrier({ carrierCode: 'bb-01', city: 'Ostrava' }, existing);
  assert.equal(res.status, 'MATCHED');
  if (res.status === 'MATCHED') {
    assert.equal(res.carrier.id, 'c1');
  }
});

test('3. carrier matching: stejný kód v jiném městě detekuje CONFLICT', () => {
  const existing: ExistingCarrierRecord[] = [
    {
      id: 'c1',
      code: 'BB-01',
      name: 'Billboard Ostrava',
      type: 'BILLBOARD',
      city: 'Ostrava',
      street: 'Nádražní',
      latitude: 49.835,
      longitude: 18.292,
      sourceKey: 'KEY1',
      photoCount: 1,
    },
  ];

  const res = matchCarrier({ carrierCode: 'BB-01', city: 'Brno' }, existing);
  assert.equal(res.status, 'CONFLICT');
});

test('4. carrier matching: více blízkých kandidátů vrátí AMBIGUOUS a nesloučí naslepo', () => {
  const existing: ExistingCarrierRecord[] = [
    {
      id: 'c1',
      code: 'BB-01',
      name: 'Kandidát 1',
      type: 'BILLBOARD',
      city: 'Praha',
      street: 'Evropská',
      latitude: 50.098,
      longitude: 14.365,
      sourceKey: 'KEY1',
      photoCount: 0,
    },
    {
      id: 'c2',
      code: 'BB-02',
      name: 'Kandidát 2',
      type: 'BILLBOARD',
      city: 'Praha',
      street: 'Evropská',
      latitude: 50.09805,
      longitude: 14.36505,
      sourceKey: 'KEY2',
      photoCount: 0,
    },
  ];

  const res = matchCarrier({ latitude: 50.09802, longitude: 14.36502 }, existing);
  assert.equal(res.status, 'AMBIGUOUS');
});

test('5. client matching: shoda přes IČO je 100% MATCHED', () => {
  const existing: ExistingClientRecord[] = [
    {
      id: 'cl-1',
      name: 'ABC Auto s.r.o.',
      normalizedName: 'abc auto sro',
      companyId: '12345678',
    },
  ];

  const res = matchClient({ name: 'Zcela jiný název pobočky', companyId: '12345678' }, existing);
  assert.equal(res.status, 'MATCHED');
  if (res.status === 'MATCHED') {
    assert.equal(res.client.id, 'cl-1');
  }
});

test('6. client matching: normalizovaný název bez právní formy a diakritiky vrátí MATCHED', () => {
  const existing: ExistingClientRecord[] = [
    {
      id: 'cl-2',
      name: 'Pekárna U Anděla s.r.o.',
      normalizedName: 'pekarna u andela sro',
      companyId: null,
    },
  ];

  const res = matchClient({ name: 'Pekárna U Anděla, spol. s r.o.' }, existing);
  assert.equal(res.status, 'MATCHED');
});

test('7. parser: CSV buffer se bezpečně naparsuje a detekuje hlavičky a řádky', async () => {
  const csvContent = 'Kód;Město;Ulice;GPS\nBB-10;Ostrava;Hlavní;49.83, 18.29\nBB-11;Opava;Olomoucká;49.93, 17.90';
  const buffer = Buffer.from(csvContent, 'utf-8');

  const result = await parseUploadedWorkbook(buffer, 'test_export.csv');
  assert.equal(result.sheets.length, 1);
  assert.equal(result.sheets[0].totalRows, 2);
  assert.deepEqual(result.sheets[0].headers, ['Kód', 'Město', 'Ulice', 'GPS']);
  assert.equal(result.sheets[0].rows[0]['Kód'], 'BB-10');
  assert.equal(result.sheets[0].rows[0]['Město'], 'Ostrava');
});

test('8. parser: prázdný buffer vyhodí kontrolovanou chybu', async () => {
  await assert.rejects(
    async () => parseUploadedWorkbook(Buffer.from(''), 'empty.xlsx'),
    /Nahraný soubor je prázdný/
  );
});

test('9. cílová doménová pole: CARRIERS obsahuje carrierCode, city, latitude, longitude', () => {
  const fields = TARGET_FIELDS_BY_ENTITY.CARRIERS.map((f) => f.field);
  assert.ok(fields.includes('carrierCode'));
  assert.ok(fields.includes('city'));
  assert.ok(fields.includes('latitude'));
  assert.ok(fields.includes('longitude'));
});
