import test from 'node:test';
import assert from 'node:assert/strict';
import { syncNavigationOrderToWorkOrderInTransaction } from '../lib/navigation/navigation-work-sync';

test('syncNavigationOrderToWorkOrderInTransaction: skips sync when no installation scheduled and not in installation phase', async () => {
  const mockTx = {
    navigationOrder: {
      findUnique: async () => ({
        id: 'nav-1',
        organizationId: 'org-1',
        status: 'POPTAVKA',
        plannedInstallationAt: null,
        installationDate: null,
        points: [],
        workOrders: [],
      }),
    },
  } as any;

  const result = await syncNavigationOrderToWorkOrderInTransaction(mockTx, 'nav-1');
  assert.equal(result, null);
});

test('syncNavigationOrderToWorkOrderInTransaction: creates WorkOrder and syncs WorkTasks when installation is planned', async () => {
  let createdWorkOrderData: any = null;
  let syncedWorkOrderId: string | null = null;

  const mockTx = {
    navigationOrder: {
      findUnique: async () => ({
        id: 'nav-2',
        organizationId: 'org-1',
        crmOrderId: 'crm-2',
        targetName: 'Form Factory Ostrava',
        targetAddress: 'Novinářská 6a, Ostrava',
        status: 'INSTALACE',
        plannedInstallationAt: new Date('2026-09-25T08:00:00Z'),
        installerUserId: 'user-installer-1',
        installerUser: { name: 'Pavel Montér' },
        crmOrder: {
          clientId: 'client-1',
          client: { name: 'Form Factory s.r.o.' },
        },
        points: [
          { id: 'p-1', label: 'Bod A', carrierId: 'c-1', surfaceId: 's-1', quantity: 1 },
          { id: 'p-2', label: 'Bod B', carrierId: 'c-2', surfaceId: null, quantity: 2 },
        ],
        workOrders: [],
      }),
    },
    workOrder: {
      create: async (args: any) => {
        createdWorkOrderData = args.data;
        return {
          id: 'wo-created-1',
          ...args.data,
          assignments: args.data.assignments?.create || [],
          items: args.data.items?.create || [],
        };
      },
      findUnique: async () => ({
        id: 'wo-created-1',
        organizationId: 'org-1',
        title: 'Montáž navigace: Form Factory s.r.o. – Form Factory Ostrava',
        assignments: [{ workerName: 'Pavel Montér', userId: 'user-installer-1' }],
        items: [],
        status: 'PLANNED',
        priority: 'NORMAL',
      }),
    },
    employee: {
      findMany: async () => [],
      findFirst: async () => null,
    },
    workTask: {
      findMany: async () => [],
      create: async () => ({}),
    },
  } as any;

  const result = await syncNavigationOrderToWorkOrderInTransaction(mockTx, 'nav-2');
  assert.ok(result);
  assert.equal(result?.workOrderId, 'wo-created-1');
  assert.equal(createdWorkOrderData.navigationOrderId, 'nav-2');
  assert.equal(createdWorkOrderData.title, 'Montáž navigace: Form Factory s.r.o. – Form Factory Ostrava');
  assert.equal(createdWorkOrderData.workType, 'INSTALLATION');
  assert.equal(createdWorkOrderData.status, 'PLANNED');
  assert.equal(createdWorkOrderData.assignments.create[0].workerName, 'Pavel Montér');
  assert.equal(createdWorkOrderData.items.create.length, 2);
});
