import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySheetRuleBased, ruleBasedColumnMatch, TARGET_FIELDS_BY_ENTITY } from '../lib/imports/ai-mapping.ts';
import { parseCarrierType, parseMediaType } from '../lib/imports/executor.ts';
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

test('10. rule-based mapování správně rozpozná všech 10 sloupců vzorového listu OOH nosičů', () => {
  const columns = [
    { header: 'Evidenční kód', expected: 'carrierCode' },
    { header: 'Název nosiče a lokality', expected: 'name' },
    { header: 'Město', expected: 'city' },
    { header: 'Adresa / Umístění', expected: 'address' },
    { header: 'Typ média', expected: 'carrierType' },
    { header: 'Rozměr', expected: 'dimensions' },
    { header: 'Osvětlení', expected: 'lighting' },
    { header: 'GPS souřadnice', expected: 'gpsCoordinates' },
    { header: 'Cena / měsíc (Kč)', expected: 'price' },
    { header: 'Poznámka', expected: 'note' },
  ];

  for (const col of columns) {
    const match = ruleBasedColumnMatch(col.header, []);
    assert.ok(match, `Sloupec "${col.header}" nebyl rozpoznán`);
    assert.equal(match.targetField, col.expected, `Sloupec "${col.header}" měl být namapován na "${col.expected}", ale byl "${match?.targetField}"`);
    assert.ok(match.confidence >= 0.9, `Confidence pro "${col.header}" je příliš nízká: ${match?.confidence}`);
  }
});

test('11. sheet "Nosiče a reklamní plochy" je klasifikován jako CARRIERS i s obsahem ploch', () => {
  const result = classifySheetRuleBased('Nosiče a reklamní plochy', [
    'Evidenční kód',
    'Název nosiče a lokality',
    'Město',
    'Adresa / Umístění',
    'Typ média',
    'Rozměr',
    'Osvětlení',
    'GPS souřadnice',
    'Cena / měsíc (Kč)',
  ]);
  assert.equal(result.classification, 'CARRIERS');
  assert.equal(result.confidence, 0.95);
});

test('12. parseCarrierType a parseMediaType normalizují české názvy na validní enumy', () => {
  assert.equal(parseCarrierType('Billboard 5,1x2,4'), 'BILLBOARD');
  assert.equal(parseCarrierType('Bigboard osvětlený'), 'BIGBOARD');
  assert.equal(parseCarrierType('Citylight (CLV)'), 'CITYLIGHT');
  assert.equal(parseCarrierType('LED obrazovka'), 'LED_SCREEN');
  assert.equal(parseCarrierType('Navigační směrovka'), 'NAVIGATION');
  assert.equal(parseCarrierType('Neznámý'), 'OTHER');

  assert.equal(parseMediaType('Citylight (CLV)'), 'CITYLIGHT');
  assert.equal(parseMediaType('Navigační směrovka'), 'NAVIGATION_SIGN');
});

test('13. resilientní mapování rozpozná clientName a ceníkové názvy bez chyb', () => {
  const matchClientCol = ruleBasedColumnMatch('Název inzerenta', []);
  assert.equal(matchClientCol?.targetField, 'clientName');

  const matchRentCol = ruleBasedColumnMatch('Základní měsíční nájem (Kč)', []);
  assert.equal(matchRentCol?.targetField, 'rentalPrice');

  const matchFormatCol = ruleBasedColumnMatch('Kód formátu', []);
  assert.ok(['carrierCode', 'code'].includes(matchFormatCol?.targetField || ''));
});

test('14. alternativní testovací soubor (seepoint-alternativni-vzor-ooh.xlsx) je kompletně a správně klasifikován a namapován', async () => {
  const filePath = path.join(process.cwd(), 'public', 'seepoint-alternativni-vzor-ooh.xlsx');
  const buffer = await readFile(filePath);
  const parsed = await parseUploadedWorkbook(buffer, 'seepoint-alternativni-vzor-ooh.xlsx');

  assert.equal(parsed.sheets.length, 4);

  // Sheet 1: CARRIERS
  const s1 = parsed.sheets[0];
  assert.equal(classifySheetRuleBased(s1.name, s1.headers).classification, 'CARRIERS');
  const s1Mappings = s1.headers.map((h) => ({ header: h, match: ruleBasedColumnMatch(h, []) }));
  assert.equal(s1Mappings.find((m) => m.header === 'Kód plochy')?.match?.targetField, 'carrierCode');
  assert.equal(s1Mappings.find((m) => m.header === 'Lokalita')?.match?.targetField, 'name');
  assert.equal(s1Mappings.find((m) => m.header === 'Obec')?.match?.targetField, 'city');
  assert.equal(s1Mappings.find((m) => m.header === 'Kategorie nosiče')?.match?.targetField, 'carrierType');
  assert.equal(s1Mappings.find((m) => m.header === 'Velikost (š x v)')?.match?.targetField, 'dimensions');
  assert.equal(s1Mappings.find((m) => m.header === 'Světlo')?.match?.targetField, 'lighting');
  assert.equal(s1Mappings.find((m) => m.header === 'Zeměpisná šířka')?.match?.targetField, 'latitude');
  assert.equal(s1Mappings.find((m) => m.header === 'Zeměpisná délka')?.match?.targetField, 'longitude');
  assert.equal(s1Mappings.find((m) => m.header === 'Cena bez DPH')?.match?.targetField, 'price');
  assert.equal(s1Mappings.find((m) => m.header === 'Doplňující info')?.match?.targetField, 'note');

  // Sheet 2: CLIENTS
  const s2 = parsed.sheets[1];
  assert.equal(classifySheetRuleBased(s2.name, s2.headers).classification, 'CLIENTS');

  // Sheet 3: PRICES
  const s3 = parsed.sheets[2];
  assert.equal(classifySheetRuleBased(s3.name, s3.headers).classification, 'PRICES');

  // Sheet 4: OCCUPANCY
  const s4 = parsed.sheets[3];
  assert.equal(classifySheetRuleBased(s4.name, s4.headers).classification, 'OCCUPANCY');
});


