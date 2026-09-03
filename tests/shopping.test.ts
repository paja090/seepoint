import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ShoppingPriority } from '@prisma/client';
import { canEditShoppingList } from '@/lib/rbac';
import {
  ShoppingValidationError,
  shoppingBoolean,
  shoppingCategory,
  shoppingImage,
  shoppingOptionalText,
  shoppingPrice,
  shoppingRequiredText,
} from '@/lib/shopping-validation';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('ShoppingPriority enum contains required priority values', () => {
  const priorities: ShoppingPriority[] = ['NORMAL', 'THIS_WEEK', 'URGENT'];
  assert.equal(priorities.length, 3);
  assert.equal(priorities.includes('URGENT'), true);
  assert.equal(priorities.includes('THIS_WEEK'), true);
  assert.equal(priorities.includes('NORMAL'), true);
});

test('Shopping item priority ranking sorts URGENT first', () => {
  const items = [
    { id: '1', title: 'Položka 1', priority: 'NORMAL' as const },
    { id: '2', title: 'Položka 2', priority: 'URGENT' as const },
    { id: '3', title: 'Položka 3', priority: 'THIS_WEEK' as const },
  ];

  const priorityWeight: Record<ShoppingPriority, number> = {
    URGENT: 3,
    THIS_WEEK: 2,
    NORMAL: 1,
  };

  const sorted = [...items].sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

  assert.equal(sorted[0].id, '2');
  assert.equal(sorted[1].id, '3');
  assert.equal(sorted[2].id, '1');
});

test('Search filter matches store, title, note and employee', () => {
  const items = [
    { id: '1', title: 'Peti kolík - 16A samec', store: 'Elektro materiál', assignedEmployeeName: 'Tomáš', note: null },
    { id: '2', title: 'Kotouče řezné', store: 'Hornbach', assignedEmployeeName: 'Pavel', note: 'Řezání kovu' },
  ];

  const filterQuery = (q: string) => {
    const lower = q.toLowerCase();
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(lower) ||
        (i.store && i.store.toLowerCase().includes(lower)) ||
        (i.assignedEmployeeName && i.assignedEmployeeName.toLowerCase().includes(lower)) ||
        (i.note && i.note.toLowerCase().includes(lower))
    );
  };

  assert.equal(filterQuery('Hornbach').length, 1);
  assert.equal(filterQuery('Hornbach')[0].id, '2');
  assert.equal(filterQuery('Tomáš').length, 1);
  assert.equal(filterQuery('Tomáš')[0].id, '1');
  assert.equal(filterQuery('Řezání').length, 1);
  assert.equal(filterQuery('Řezání')[0].id, '2');
});

test('serverová validace nákupů odmítá neplatné a nebezpečné hodnoty', () => {
  assert.equal(shoppingRequiredText('  Vruty  ', 'Název', 20), 'Vruty');
  assert.equal(shoppingOptionalText('', 'Poznámka', 20), null);
  assert.equal(shoppingCategory('OFFICE'), 'OFFICE');
  assert.throws(() => shoppingCategory('PRIVATE'), ShoppingValidationError);
  assert.equal(shoppingPrice('12,50'), 12.5);
  assert.throws(() => shoppingPrice('-1'), ShoppingValidationError);
  assert.throws(() => shoppingPrice('není číslo'), ShoppingValidationError);
  assert.equal(shoppingBoolean(false, 'Stav'), false);
  assert.throws(() => shoppingBoolean('false', 'Stav'), ShoppingValidationError);
  assert.throws(() => shoppingImage('javascript:alert(1)', 'Fotografie'), ShoppingValidationError);
  assert.throws(() => shoppingImage('data:image/svg+xml;base64,PHN2Zz4=', 'Fotografie'), ShoppingValidationError);
});

test('platná JPEG fotografie projde omezenou validací nákupního seznamu', () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3]).toString('base64')}`;
  assert.equal(shoppingImage(jpeg, 'Fotografie'), jpeg);
});

test('role Náhled nemůže měnit společný nákupní seznam', () => {
  assert.equal(canEditShoppingList('VIEWER'), false);
  assert.equal(canEditShoppingList('WORKER'), true);
  assert.equal(canEditShoppingList('ADMIN'), true);
});

test('filtr přiřazeno mně používá ID zaměstnance a API nesdílí interní chyby', () => {
  const page = source('app/shopping/page.tsx');
  const shoppingModule = source('components/shopping/ShoppingListModule.tsx');
  const createRoute = source('app/api/shopping-items/route.ts');
  const updateRoute = source('app/api/shopping-items/[id]/route.ts');
  assert.match(page, /currentEmployeeId=\{user\.employee\?\.id\}/);
  assert.match(shoppingModule, /i\.assignedEmployeeId === currentEmployeeId/);
  assert.doesNotMatch(createRoute, /error\.message.*nákupního seznamu/);
  assert.doesNotMatch(updateRoute, /error\.message.*nepodařilo upravit/);
});

test('doplnění skladu serializuje souběžné požadavky na stejnou položku', () => {
  const restockRoute = source('app/api/warehouse/items/[id]/restock/route.ts');
  assert.match(restockRoute, /runTransactionWithRetry/);
  assert.match(restockRoute, /companyShoppingItem\.findFirst/);
});

test('volby nákupního formuláře používají existující tenantový endpoint s limity', () => {
  const shoppingModule = source('components/shopping/ShoppingListModule.tsx');
  const optionsRoute = source('app/api/shopping-items/options/route.ts');
  assert.match(shoppingModule, /fetch\('\/api\/shopping-items\/options'\)/);
  assert.doesNotMatch(shoppingModule, /fetch\('\/api\/employees'\)/);
  assert.doesNotMatch(shoppingModule, /fetch\('\/api\/crm\/orders'\)/);
  assert.match(optionsRoute, /requireApiAccess\('team'\)/);
  assert.match(optionsRoute, /where: \{ isActive: true \}/);
  assert.match(optionsRoute, /notIn: \['COMPLETED', 'CANCELLED'\]/);
  assert.match(optionsRoute, /take: 500/);
  assert.match(optionsRoute, /take: 200/);
  assert.doesNotMatch(optionsRoute, /error instanceof Error \? error\.message/);
});

test('ikonové akce nákupního seznamu mají přístupné názvy', () => {
  const shoppingModule = source('components/shopping/ShoppingListModule.tsx');
  assert.match(shoppingModule, /aria-label=\{`\$\{item\.isPurchased \? 'Vrátit mezi chybějící' : 'Označit jako koupené'\}: \$\{item\.title\}`\}/);
  assert.match(shoppingModule, /aria-label=\{`Zobrazit detail: \$\{item\.title\}`\}/);
  assert.match(shoppingModule, /aria-label="Zavřít formulář položky"/);
  assert.match(shoppingModule, /aria-label="Zavřít cenu a účtenku"/);
});
