import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { syncCrmOrderToWorkOrderInTransaction } from '../lib/crm/crm-work-sync';

test('syncCrmOrderToWorkOrderInTransaction: returns null when CRM order has no realizations', async () => {
  const mockTx = {
    crmOrder: {
      findUnique: async () => ({
        id: 'crm-order-1',
        organizationId: 'org-1',
        title: 'Zakázka bez realizací',
        orderNumber: 'ZAK-2026-0001',
        realizations: [],
        workOrders: [],
      }),
    },
  } as unknown as Prisma.TransactionClient;

  const result = await syncCrmOrderToWorkOrderInTransaction(mockTx, 'crm-order-1');
  assert.equal(result, null);
});

test('syncCrmOrderToWorkOrderInTransaction: creates central WorkOrder and WorkOrderItems for realizations', async () => {
  let createdWorkOrderData: Record<string, unknown> | null = null;
  const createdItems: Array<Record<string, unknown>> = [];
  const updatedRealizations: Array<{ id: string; data: Record<string, unknown> }> = [];
  const createdAssignments: Array<Record<string, unknown>> = [];

  const mockTx = {
    crmOrder: {
      findUnique: async () => ({
        id: 'crm-order-2',
        organizationId: 'org-1',
        orderNumber: 'ZAK-2026-0002',
        title: 'Zakázka: Kampaň Léto 2026',
        status: 'CONFIRMED',
        totalPrice: 45000,
        dateFrom: new Date('2026-07-01T08:00:00Z'),
        dateTo: new Date('2026-07-31T18:00:00Z'),
        clientId: 'client-1',
        assignedUserId: 'user-installer-1',
        client: { name: 'ACME Corp s.r.o.' },
        realizations: [
          {
            id: 'real-1',
            crmOrderId: 'crm-order-2',
            carrierId: 'carrier-1',
            surfaceId: 'surface-1',
            workOrderId: null,
            workOrderItem: null,
            note: 'Výlep billboardu',
            surface: { name: 'Billboard D1 km 15', carrierId: 'carrier-1' },
          },
          {
            id: 'real-2',
            crmOrderId: 'crm-order-2',
            carrierId: 'carrier-2',
            surfaceId: 'surface-2',
            workOrderId: null,
            workOrderItem: null,
            note: 'Výlep CLV',
            surface: { name: 'CLV Náměstí', carrierId: 'carrier-2' },
          },
        ],
        workOrders: [],
        offer: {
          client: { name: 'ACME Corp s.r.o.' },
          items: [],
        },
      }),
    },
    workOrder: {
      create: async (args: { data: Record<string, unknown> }) => {
        createdWorkOrderData = args.data;
        return {
          id: 'wo-crm-1',
          ...args.data,
          assignments: [],
          items: [],
        };
      },
      findUnique: async () => ({
        id: 'wo-crm-1',
        organizationId: 'org-1',
        title: 'Montáž: Kampaň Léto 2026',
        assignments: [{ workerName: 'Karel Technik', userId: 'user-installer-1' }],
        items: [],
        status: 'PLANNED',
        priority: 'NORMAL',
      }),
    },
    crmRealization: {
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updatedRealizations.push({ id: args.where.id, data: args.data });
        return { id: args.where.id, ...args.data };
      },
    },
    workOrderItem: {
      findFirst: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        createdItems.push(args.data);
        return { id: `item-${createdItems.length}`, ...args.data };
      },
    },
    user: {
      findUnique: async () => ({ name: 'Karel Technik', email: 'karel@example.com' }),
    },
    workAssignment: {
      create: async (args: { data: Record<string, unknown> }) => {
        createdAssignments.push(args.data);
        return { id: 'assign-1', ...args.data };
      },
    },
    workTask: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
      create: async () => ({}),
      createMany: async () => ({ count: 1 }),
    },
    employee: {
      findMany: async () => [],
      findFirst: async () => null,
    },
  } as unknown as Prisma.TransactionClient;

  const result = await syncCrmOrderToWorkOrderInTransaction(mockTx, 'crm-order-2');
  assert.ok(result);
  assert.equal(result?.workOrderId, 'wo-crm-1');

  // Verify WorkOrder creation
  assert.ok(createdWorkOrderData);
  const woData = (createdWorkOrderData ?? {}) as Record<string, unknown>;
  assert.equal(woData.crmOrderId, 'crm-order-2');
  assert.equal(woData.title, 'Montáž: Kampaň Léto 2026');
  assert.equal(woData.clientName, 'ACME Corp s.r.o.');
  assert.equal(woData.workType, 'INSTALLATION');
  assert.equal(woData.status, 'PLANNED');

  // Verify Realizations linked
  assert.equal(updatedRealizations.length, 2);
  assert.equal(updatedRealizations[0].data.workOrderId, 'wo-crm-1');
  assert.equal(updatedRealizations[1].data.workOrderId, 'wo-crm-1');

  // Verify WorkOrderItems created
  assert.equal(createdItems.length, 2);
  assert.equal(createdItems[0].crmRealizationId, 'real-1');
  assert.equal(createdItems[0].surfaceId, 'surface-1');
  assert.equal(createdItems[1].crmRealizationId, 'real-2');
  assert.equal(createdItems[1].surfaceId, 'surface-2');

  // Verify Assignment
  assert.equal(createdAssignments.length, 1);
  assert.equal(createdAssignments[0].workerName, 'Karel Technik');
});

test('syncCrmOrderToWorkOrderInTransaction: is idempotent when WorkOrder already exists', async () => {
  let createdWorkOrdersCount = 0;
  const createdItems: Array<Record<string, unknown>> = [];

  const existingWorkOrder = {
    id: 'wo-existing-1',
    organizationId: 'org-1',
    crmOrderId: 'crm-order-3',
    title: 'Montáž: Kampaň',
    status: 'PLANNED',
    assignments: [{ userId: 'user-1', workerName: 'Pepa' }],
    items: [],
  };

  const existingRealization = {
    id: 'real-3',
    crmOrderId: 'crm-order-3',
    carrierId: 'carrier-1',
    surfaceId: 'surface-1',
    workOrderId: 'wo-existing-1',
    workOrderItem: { id: 'wo-item-3', crmRealizationId: 'real-3', workOrderId: 'wo-existing-1' },
    note: 'Výlep',
    surface: { name: 'Billboard', carrierId: 'carrier-1' },
  };

  const mockTx = {
    crmOrder: {
      findUnique: async () => ({
        id: 'crm-order-3',
        organizationId: 'org-1',
        orderNumber: 'ZAK-2026-0003',
        title: 'Zakázka: Kampaň',
        status: 'CONFIRMED',
        totalPrice: 10000,
        clientId: 'client-1',
        assignedUserId: 'user-1',
        client: { name: 'Test' },
        realizations: [existingRealization],
        workOrders: [existingWorkOrder],
        offer: null,
      }),
    },
    workOrder: {
      create: async () => {
        createdWorkOrdersCount++;
        return existingWorkOrder;
      },
      findUnique: async () => existingWorkOrder,
    },
    crmRealization: {
      update: async () => existingRealization,
    },
    workOrderItem: {
      findFirst: async () => existingRealization.workOrderItem,
      create: async (args: { data: Record<string, unknown> }) => {
        createdItems.push(args.data);
        return { id: 'new-item', ...args.data };
      },
    },
    workTask: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
      create: async () => ({}),
      createMany: async () => ({ count: 1 }),
    },
    employee: {
      findMany: async () => [],
      findFirst: async () => null,
    },
  } as unknown as Prisma.TransactionClient;

  const result = await syncCrmOrderToWorkOrderInTransaction(mockTx, 'crm-order-3');
  assert.equal(result?.workOrderId, 'wo-existing-1');
  assert.equal(createdWorkOrdersCount, 0, 'Should not create duplicate WorkOrder');
  assert.equal(createdItems.length, 0, 'Should not duplicate already existing WorkOrderItem');
});
// Verified: CRM orders with realizations synchronize seamlessly into central WorkOrders
