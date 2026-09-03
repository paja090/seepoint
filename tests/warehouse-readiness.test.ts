import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { WarehouseInputError, warehouseNumber, warehouseText } from '../lib/warehouse-validation';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('warehouse numeric and text inputs reject unsafe values', () => {
  assert.equal(warehouseNumber('1.239', 'Množství'), 1.24);
  assert.equal(warehouseNumber(0, 'Množství', { allowZero: true }), 0);
  assert.equal(warehouseText('  Regál A  ', 'Umístění', 20), 'Regál A');
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 'not-a-number']) {
    assert.throws(() => warehouseNumber(value, 'Množství'), WarehouseInputError);
  }
  assert.throws(() => warehouseText('x'.repeat(21), 'Umístění', 20), WarehouseInputError);
});

test('warehouse movements update stock atomically and never clamp an over-issue to zero', () => {
  const stock = read('lib/warehouse-stock.ts');
  const voice = read('app/api/warehouse/voice-issue/route.ts');
  assert.match(stock, /quantityInStock: \{ gte: input\.quantity \}/);
  assert.match(stock, /quantityInStock: \{ decrement: input\.quantity \}/);
  assert.match(stock, /updated\.count !== 1/);
  assert.match(stock, /prisma\.\$transaction\(async \(tx\)/);
  assert.doesNotMatch(voice, /Math\.max\(0/);
  assert.match(voice, /recordWarehouseMovements/);
  assert.match(voice, /matchedIssues\.length > 1/);
});

test('photo issue is one checked batch and unknown AI results never map to the first stock item', () => {
  const api = read('app/api/warehouse/photo-recognition/route.ts');
  const client = read('components/warehouse/WarehousePhotoScannerModal.tsx');
  assert.doesNotMatch(api, /allItems\[0\]/);
  assert.match(api, /unmatchedItems\.push\(aiName\)/);
  assert.match(client, /movements: detectedItems\.map/);
  assert.match(client, /if \(!res\.ok\) throw new Error/);
});

test('warehouse catalog and movement permissions are separate and enforced server-side', () => {
  const rbac = read('lib/rbac.ts');
  assert.match(rbac, /canManageWarehouseCatalog/);
  assert.match(rbac, /canRecordWarehouseMovement/);
  for (const path of [
    'app/api/warehouse/items/route.ts',
    'app/api/warehouse/items/[id]/route.ts',
    'app/api/warehouse/items/[id]/restock/route.ts',
    'app/api/warehouse/movements/route.ts',
    'app/api/warehouse/voice-issue/route.ts',
    'app/api/warehouse/photo-recognition/route.ts',
    'app/api/warehouse/ai-import-photo/route.ts',
  ]) {
    assert.match(read(path), /canAccess|canManageWarehouseCatalog|canRecordWarehouseMovement/);
  }
  assert.match(read('app/warehouse/page.tsx'), /requirePageAccess\('warehouse'\)/);
  assert.match(read('app/warehouse/print-qr/page.tsx'), /requirePageAccess\('warehouse'\)/);
});

test('stock history cannot be silently rewritten or deleted', () => {
  const itemApi = read('app/api/warehouse/items/[id]/route.ts');
  const createApi = read('app/api/warehouse/items/route.ts');
  assert.match(itemApi, /Stav zásoby měňte pouze evidovaným skladovým pohybem/);
  assert.match(itemApi, /existing\._count\.movements > 0/);
  assert.match(itemApi, /isolationLevel: 'Serializable'/);
  assert.match(createApi, /Počáteční stav při založení skladové položky/);
});

test('mobile borrowing overview does not use fuzzy name matching or claim complete history', () => {
  const mobile = read('components/warehouse/MobileWarehouseAppClient.tsx');
  assert.match(mobile, /currentEmployeeId === m\.assignedEmployeeId/);
  assert.doesNotMatch(mobile, /userTokens\.some/);
  assert.match(mobile, /posledních 100 pohybů/);
  assert.doesNotMatch(mobile, /Všechno vypůjčené nářadí je řádně vráceno/);
});

test('warehouse QR print action works and external QR data excludes item names', () => {
  const page = read('app/warehouse/print-qr/page.tsx');
  const button = read('components/warehouse/WarehousePrintButton.tsx');
  assert.match(button, /window\.print\(\)/);
  assert.doesNotMatch(page, /onClick=\{undefined\}/);
  assert.match(page, /SEEPOINT_WH:\$\{item\.id\}/);
  assert.doesNotMatch(page, /SEEPOINT_WH:\$\{item\.id\}:\$\{item\.name\}/);
  assert.match(page, /referrerPolicy="no-referrer"/);
});

test('warehouse AI validates bounded images, rate limits calls and hides provider errors', () => {
  const validation = read('lib/warehouse-validation.ts');
  const photo = read('app/api/warehouse/photo-recognition/route.ts');
  const aiImport = read('app/api/warehouse/ai-import-photo/route.ts');
  const aiTransport = read('lib/ai-gemini.ts');
  assert.match(validation, /3 \* 1024 \* 1024/);
  assert.match(validation, /image\/jpeg.*image\/png.*image\/webp/);
  assert.match(photo, /rateLimitPolicies\.warehouseAi/);
  assert.match(aiImport, /rateLimitPolicies\.warehouseAi/);
  assert.doesNotMatch(aiImport, /error instanceof Error \? error\.message/);
  assert.doesNotMatch(aiTransport, /NEXT_PUBLIC_(?:GEMINI|GOOGLE|OPENAI)/);
  assert.match(aiTransport, /'x-goog-api-key': apiKey/);
  assert.match(aiTransport, /AbortSignal\.timeout\(20_000\)/);
  assert.doesNotMatch(aiTransport, /\?key=/);
});
