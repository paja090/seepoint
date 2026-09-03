import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseMediaImport } from '../lib/media-import.ts';
import { parseNavigationImport } from '../lib/navigation-import.ts';
import { buildNavigationImportPlan } from '../lib/navigation-import-plan.ts';

const header = 'Pozice\tUlice\tPopis\tKonečný zákazník\tPodnájem od\tPodnájem do\tFoto';

function report(row: string) {
  return parseNavigationImport(`${header}\n${row}`, 'Ostrava 2026');
}

test('navigační plán používá SHA-256 a změna neidentitních polí zneplatní náhled', () => {
  const original = buildNavigationImportPlan([report('1\tNádražní\tSměr centrum\tKlient A\t2026-01-01\t2026-12-31\tfoto-a.jpg')]);
  const changedDate = buildNavigationImportPlan([report('1\tNádražní\tSměr centrum\tKlient A\t2026-01-01\t2027-12-31\tfoto-a.jpg')]);
  const changedPhoto = buildNavigationImportPlan([report('1\tNádražní\tSměr centrum\tKlient A\t2026-01-01\t2026-12-31\tfoto-b.jpg')]);

  assert.match(original.planHash, /^[a-f0-9]{64}$/);
  assert.notEqual(original.planHash, changedDate.planHash);
  assert.notEqual(original.planHash, changedPhoto.planHash);
});

test('chybějící klient nevytvoří sdíleného zástupného zákazníka', () => {
  const parsed = report('1\tNádražní\tSměr centrum\t\t2026-01-01\t2026-12-31\tfoto-a.jpg');
  assert.equal(parsed.records[0]?.clientName, '');
  assert.ok(parsed.records[0]?.issues.some((issue) => issue.code === 'MISSING_CLIENT'));
  assert.equal(buildNavigationImportPlan([parsed]).stats.clients, 0);
});

test('mediální import nikdy nepotvrdí prázdný report jako platný', () => {
  assert.throws(
    () => parseMediaImport('CITY_POSTER', 'kód\tAdresa\nřádek\tbez podporovaného kódu'),
    /Nebyl nalezen žádný podporovaný datový řádek/,
  );
});

test('oba chráněné importy auditují uživatele a prostředí', () => {
  for (const route of ['app/api/import/media/route.ts', 'app/api/import/navigation/route.ts']) {
    const source = readFileSync(new URL(`../${route}`, import.meta.url), 'utf8');
    assert.match(source, /createdById: auth\.id/);
    assert.match(source, /environment: process\.env\.VERCEL_ENV/);
    assert.match(source, /requireApiAccess\('import'\)/);
    assert.match(source, /commitStarted \? 500 : 400/);
  }
});
