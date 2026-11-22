import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { Prisma } from '@prisma/client';
import {
  buildClientBranchSearchWhere,
  buildClientSearchWhere,
  buildCrmOrderSearchWhere,
} from '../lib/crm/search-query.ts';
import {
  CrmOrderValidationError,
  parseCreateCrmOrderInput,
  parseCrmOrderListQuery,
  parseUpdateCrmOrderInput,
  parseUpdateRealizationInput,
} from '../lib/crm/order-policy.ts';
import { syncCrmOrderToWorkOrderInTransaction } from '../lib/crm/crm-work-sync.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PGlite: 20261121233000_crm_agency_and_branch_links migration applies cleanly and enforces SET NULL FKs', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE "Client" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL);
      CREATE TABLE "ClientBranch" ("id" TEXT PRIMARY KEY, "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE, "name" TEXT NOT NULL);
      CREATE TABLE "CrmOrder" ("id" TEXT PRIMARY KEY, "clientId" TEXT NOT NULL REFERENCES "Client"("id"), "branchId" TEXT REFERENCES "ClientBranch"("id") ON DELETE SET NULL);
      CREATE TABLE "CrmRealization" ("id" TEXT PRIMARY KEY, "crmOrderId" TEXT NOT NULL REFERENCES "CrmOrder"("id") ON DELETE CASCADE);
      CREATE TABLE "WorkOrderItem" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "Photo" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "NavigationTarget" ("id" TEXT PRIMARY KEY);
    `);

    const migrationSql = read('prisma/migrations/20261121233000_crm_agency_and_branch_links/migration.sql');
    await db.exec(migrationSql);

    // Seed end client, agency client, branch, order, realization, workOrderItem, photo, navigationTarget
    await db.exec(`
      INSERT INTO "Client" ("id", "name") VALUES ('cli_kofola', 'Kofola a.s.'), ('cli_knowlimits', 'Knowlimits s.r.o.');
      INSERT INTO "ClientBranch" ("id", "clientId", "name") VALUES ('br_ostrava', 'cli_kofola', 'Ostrava Svinov');
      INSERT INTO "CrmOrder" ("id", "clientId", "agencyClientId", "agencyName", "branchId")
        VALUES ('ord_1', 'cli_kofola', 'cli_knowlimits', 'Knowlimits s.r.o.', 'br_ostrava');
      INSERT INTO "CrmRealization" ("id", "crmOrderId", "branchId") VALUES ('real_1', 'ord_1', 'br_ostrava');
      INSERT INTO "WorkOrderItem" ("id", "branchId") VALUES ('woi_1', 'br_ostrava');
      INSERT INTO "Photo" ("id", "branchId") VALUES ('ph_1', 'br_ostrava');
      INSERT INTO "NavigationTarget" ("id", "clientBranchId") VALUES ('nt_1', 'br_ostrava');
    `);

    const orderBefore = await db.query<{ agencyClientId: string | null; agencyName: string | null }>(
      `SELECT "agencyClientId", "agencyName" FROM "CrmOrder" WHERE "id" = 'ord_1'`
    );
    assert.equal(orderBefore.rows[0]?.agencyClientId, 'cli_knowlimits');
    assert.equal(orderBefore.rows[0]?.agencyName, 'Knowlimits s.r.o.');

    // Deleting branch sets branchId/clientBranchId to NULL rather than breaking records
    await db.exec(`DELETE FROM "ClientBranch" WHERE "id" = 'br_ostrava'`);
    const realAfter = await db.query<{ branchId: string | null }>(`SELECT "branchId" FROM "CrmRealization" WHERE "id" = 'real_1'`);
    const photoAfter = await db.query<{ branchId: string | null }>(`SELECT "branchId" FROM "Photo" WHERE "id" = 'ph_1'`);
    const targetAfter = await db.query<{ clientBranchId: string | null }>(`SELECT "clientBranchId" FROM "NavigationTarget" WHERE "id" = 'nt_1'`);
    assert.equal(realAfter.rows[0]?.branchId, null);
    assert.equal(photoAfter.rows[0]?.branchId, null);
    assert.equal(targetAfter.rows[0]?.clientBranchId, null);

    // Deleting agency sets agencyClientId to NULL while preserving free-text agencyName
    await db.exec(`DELETE FROM "Client" WHERE "id" = 'cli_knowlimits'`);
    const orderAfter = await db.query<{ agencyClientId: string | null; agencyName: string | null }>(
      `SELECT "agencyClientId", "agencyName" FROM "CrmOrder" WHERE "id" = 'ord_1'`
    );
    assert.equal(orderAfter.rows[0]?.agencyClientId, null);
    assert.equal(orderAfter.rows[0]?.agencyName, 'Knowlimits s.r.o.');
  } finally {
    await db.close();
  }
});

test('buildClientSearchWhere covers end client, contacts, branches, order agencies and agency-intermediated orders', () => {
  assert.deepEqual(buildClientSearchWhere('   '), {});
  const where = buildClientSearchWhere('  Knowlimits   Ostrava ');
  const serialized = JSON.stringify(where);
  assert.match(serialized, /"Knowlimits Ostrava"/);
  assert.match(serialized, /"branches"/);
  assert.match(serialized, /"agencyClient"/);
  assert.match(serialized, /"agencyName"/);
  assert.match(serialized, /"agencyCrmOrders"/);
  assert.match(serialized, /"contacts"/);
});

test('buildCrmOrderSearchWhere and buildClientBranchSearchWhere match end client, agency, branch, and realizations', () => {
  const orderWhere = JSON.stringify(buildCrmOrderSearchWhere('Svinov'));
  assert.match(orderWhere, /"client"/);
  assert.match(orderWhere, /"agencyClient"/);
  assert.match(orderWhere, /"agencyName"/);
  assert.match(orderWhere, /"branch"/);
  assert.match(orderWhere, /"realizations"/);
  assert.match(orderWhere, /"navigationOrder"/);
  assert.match(orderWhere, /"clientBranch"/);

  const branchWhere = JSON.stringify(buildClientBranchSearchWhere('Svinov'));
  assert.match(branchWhere, /"active":true/);
  assert.match(branchWhere, /"client"/);
});

test('CRM order & realization parsers validate agency, branch, prices, dates and pagination', () => {
  const created = parseCreateCrmOrderInput({
    clientId: 'cli_1',
    title: '  Kampaň   Podzim  ',
    agencyClientId: 'cli_ag',
    agencyName: '  PHD Media ',
    branchId: 'br_1',
    projectType: 'NAVIGATION',
    status: 'CONFIRMED',
    dateFrom: '2026-10-01',
    dateTo: '2026-10-31',
    totalPrice: '125 400,50',
  });
  assert.equal(created.title, 'Kampaň Podzim');
  assert.equal(created.agencyClientId, 'cli_ag');
  assert.equal(created.agencyName, 'PHD Media');
  assert.equal(created.branchId, 'br_1');
  assert.equal(created.totalPrice, 125400.5);

  assert.throws(
    () => parseCreateCrmOrderInput({ clientId: 'cli_1', title: 'OK', dateFrom: '2026-11-10', dateTo: '2026-11-01' }),
    CrmOrderValidationError
  );
  assert.throws(
    () => parseCreateCrmOrderInput({ clientId: 'cli_1', title: 'OK', totalPrice: -50 }),
    CrmOrderValidationError
  );

  const patched = parseUpdateCrmOrderInput({ agencyClientId: '', agencyName: '  Medea  ', branchId: null });
  assert.equal(patched.agencyClientId, null);
  assert.equal(patched.agencyName, 'Medea');
  assert.equal(patched.branchId, null);

  const realPatch = parseUpdateRealizationInput({ branchId: 'br_2' });
  assert.equal(realPatch.branchId, 'br_2');
  assert.equal(realPatch.propagateToPhotos, true);

  const listQuery = parseCrmOrderListQuery(new URLSearchParams('q=Kofola&missingAgency=1&page=2&pageSize=50'));
  assert.deepEqual(
    { q: listQuery.q, missingAgency: listQuery.missingAgency, page: listQuery.page, pageSize: listQuery.pageSize },
    { q: 'Kofola', missingAgency: true, page: 2, pageSize: 50 }
  );
  assert.throws(() => parseCrmOrderListQuery(new URLSearchParams('pageSize=999')), CrmOrderValidationError);
});

test('syncCrmOrderToWorkOrderInTransaction propagates realization or order branchId to WorkOrderItem', async () => {
  const createdItems: Array<Record<string, unknown>> = [];
  const mockTx = {
    crmOrder: {
      findUnique: async () => ({
        id: 'crm-order-branch',
        organizationId: 'org-1',
        orderNumber: 'ZAK-2026-0099',
        title: 'Multi-pobočková navigace',
        status: 'CONFIRMED',
        totalPrice: 20000,
        dateFrom: new Date('2026-11-25T08:00:00Z'),
        dateTo: null,
        clientId: 'cli-1',
        branchId: 'br-default',
        assignedUserId: null,
        client: { name: 'Obchodní řetězec s.r.o.' },
        realizations: [
          {
            id: 'real-a',
            crmOrderId: 'crm-order-branch',
            branchId: 'br-specific',
            carrierId: 'car-1',
            surfaceId: 'surf-1',
            workOrderId: null,
            workOrderItem: null,
            note: 'Pozice A',
            surface: { name: 'Sloup 1', carrierId: 'car-1' },
          },
          {
            id: 'real-b',
            crmOrderId: 'crm-order-branch',
            branchId: null,
            carrierId: 'car-2',
            surfaceId: 'surf-2',
            workOrderId: null,
            workOrderItem: null,
            note: 'Pozice B',
            surface: { name: 'Sloup 2', carrierId: 'car-2' },
          },
        ],
        workOrders: [],
        offer: null,
      }),
    },
    workOrder: {
      create: async (args: { data: Record<string, unknown> }) => ({
        id: 'wo-branch-1',
        ...args.data,
        assignments: [],
        items: [],
      }),
      findUnique: async () => ({
        id: 'wo-branch-1',
        organizationId: 'org-1',
        title: 'Montáž: Multi-pobočková navigace',
        assignments: [],
        items: [],
        status: 'PLANNED',
        priority: 'NORMAL',
      }),
    },
    crmRealization: { update: async () => ({}) },
    workOrderItem: {
      findFirst: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        createdItems.push(args.data);
        return { id: `woi-${createdItems.length}`, ...args.data };
      },
    },
    employee: { findMany: async () => [] },
    workTask: { findMany: async () => [], create: async () => ({}), deleteMany: async () => ({ count: 0 }) },
  } as unknown as Prisma.TransactionClient;

  await syncCrmOrderToWorkOrderInTransaction(mockTx, 'crm-order-branch');
  assert.equal(createdItems.length, 2);
  assert.equal(createdItems[0].branchId, 'br-specific');
  assert.equal(createdItems[1].branchId, 'br-default');
});

test('New CRM order & realization routes enforce requireApiAccess and merge preserves agency links', () => {
  for (const routePath of [
    'app/api/crm/orders/route.ts',
    'app/api/crm/orders/[id]/route.ts',
    'app/api/crm/realizations/[id]/route.ts',
    'app/api/crm/realizations/[id]/photos/route.ts',
  ]) {
    const src = read(routePath);
    assert.match(src, /requireApiAccess\('clients'\)/, routePath);
  }
  const mergeSrc = read('lib/crm/merge-service.ts');
  assert.match(mergeSrc, /agencyClientId:\s*sourceClientId/);
});
