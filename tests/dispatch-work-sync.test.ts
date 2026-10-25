import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { syncUnlinkedDispatchPointsInTransaction } from '../lib/dispatch/dispatch-work-sync';

test('syncUnlinkedDispatchPointsInTransaction: returns 0 when no active campaigns exist', async () => {
  const mockTx = {
    electionCampaign: {
      findMany: async () => [],
    },
  } as unknown as Prisma.TransactionClient;

  const result = await syncUnlinkedDispatchPointsInTransaction(mockTx, 'org-1');
  assert.equal(result, 0);
});

test('syncUnlinkedDispatchPointsInTransaction: creates a single consolidated WorkOrder for a campaign and is idempotent', async () => {
  const createdOrders: Array<Record<string, unknown>> = [];
  const createdAssignments: Array<Record<string, unknown>> = [];
  const createdItems: Array<Record<string, unknown>> = [];

  const point1 = {
    id: 'point-101',
    label: 'Plzeňská x Horní',
    description: 'Instalace Mini Tower',
    operationType: 'INSTALL_OBJECT',
    objectType: 'Mini Tower',
    mediaType: 'MINI_TOWER',
    quantity: 1,
    serviceMinutes: 25,
    latitude: 49.79,
    longitude: 18.25,
    deadlineAt: new Date('2026-10-25T12:00:00Z'),
    status: 'ASSIGNED',
    referenceUrl: null,
    createdAt: new Date('2026-10-24T18:00:00Z'),
  };

  const point2 = {
    id: 'point-102',
    label: 'Dr. Martínka x Jubilejní',
    description: 'Instalace Mini Tower',
    operationType: 'INSTALL_OBJECT',
    objectType: 'Mini Tower',
    mediaType: 'MINI_TOWER',
    quantity: 1,
    serviceMinutes: 25,
    latitude: 49.78,
    longitude: 18.26,
    deadlineAt: new Date('2026-10-25T12:00:00Z'),
    status: 'ASSIGNED',
    referenceUrl: null,
    createdAt: new Date('2026-10-24T18:05:00Z'),
  };

  const campaign = {
    id: 'camp-101',
    name: 'Práce pro Náš Jih (2026-10-25)',
    clientName: 'Náš Jih',
    targetDate: new Date('2026-10-25T12:00:00Z'),
    mediaDefaults: { preferredEmployeeId: 'emp-1' },
    points: [point1, point2],
  };

  const existingWorkOrders: Array<Record<string, unknown>> = [];

  const mockTx = {
    electionCampaign: {
      findMany: async () => [campaign],
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(campaign, args.data);
        return campaign;
      },
    },
    workOrder: {
      findMany: async (args: { where: { planningConstraints?: Record<string, unknown> } }) => {
        // If searching for existing campaign orders or per-point orders
        return existingWorkOrders;
      },
      findUnique: async (args: { where: { id: string } }) => {
        const found = existingWorkOrders.find((w) => w.id === args.where.id);
        if (!found) return null;
        return {
          ...found,
          items: createdItems.filter((i) => i.workOrderId === args.where.id),
          assignments: createdAssignments.filter((a) => a.workOrderId === args.where.id),
        };
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const item = { id: `wo-${createdOrders.length + 1}`, ...args.data };
        createdOrders.push(item);
        existingWorkOrders.push(item);
        return item;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const found = existingWorkOrders.find((w) => w.id === args.where.id);
        if (found) Object.assign(found, args.data);
        return found || {};
      },
      deleteMany: async () => ({ count: 0 }),
    },
    employee: {
      findUnique: async () => ({
        id: 'emp-1',
        firstName: 'Karel',
        lastName: 'Technik',
        userId: 'user-emp-1',
      }),
      findMany: async () => [],
      findFirst: async () => null,
    },
    workAssignment: {
      create: async (args: { data: Record<string, unknown> }) => {
        createdAssignments.push(args.data);
        return { id: 'assign-1', ...args.data };
      },
      deleteMany: async () => ({ count: 0 }),
    },
    workTask: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
      create: async () => ({}),
      createMany: async () => ({ count: 1 }),
      updateMany: async () => ({ count: 0 }),
    },
    workOrderItem: {
      findMany: async () => createdItems,
      findFirst: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        const item = { id: `item-${createdItems.length + 1}`, ...args.data };
        createdItems.push(item);
        return item;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const found = createdItems.find((i) => i.id === args.where.id);
        if (found) Object.assign(found, args.data);
        return found || {};
      },
      deleteMany: async () => ({ count: 0 }),
    },
  } as unknown as Prisma.TransactionClient;

  // 1st run: creates ONE consolidated WorkOrder with 2 items
  const count1 = await syncUnlinkedDispatchPointsInTransaction(mockTx, 'org-1');
  assert.equal(count1, 1);
  assert.equal(createdOrders.length, 1);
  assert.equal(createdOrders[0].title, 'Práce pro Náš Jih (2026-10-25)');
  assert.equal(createdOrders[0].clientName, 'Náš Jih');
  assert.equal(createdOrders[0].workType, 'INSTALLATION');
  assert.equal(createdOrders[0].status, 'PLANNED');
  assert.equal(createdOrders[0].quantity, 2);
  assert.equal(createdOrders[0].mediaLabel, 'Mini Tower (2 ks)');
  assert.equal(createdAssignments.length, 1);
  assert.equal(createdAssignments[0].workerName, 'Karel Technik');
  assert.equal(createdItems.length, 2);

  // 2nd run: idempotent (0 created)
  const count2 = await syncUnlinkedDispatchPointsInTransaction(mockTx, 'org-1');
  assert.equal(count2, 0);
  assert.equal(createdOrders.length, 1);

  // 3rd run: when points complete in the field, items and order transition to DONE
  point1.status = 'COMPLETED';
  point2.status = 'COMPLETED';
  const count3 = await syncUnlinkedDispatchPointsInTransaction(mockTx, 'org-1');
  assert.equal(count3, 0);
  assert.equal(createdOrders[0].status, 'DONE');
  assert.equal(createdItems[0].executionStatus, 'DONE');
  assert.equal(createdItems[1].executionStatus, 'DONE');
  assert.equal((campaign as { status?: string }).status, 'COMPLETED');
});
