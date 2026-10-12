import test from 'node:test';
import assert from 'node:assert/strict';
import { executeStop } from '../lib/field-planning/execution';
import { runWithTenantContext } from '../lib/tenant-context';
import type { PlannerActor } from '../lib/field-planning/service';

test('Field execution: Election removal points and pitstops execute seamlessly without requiring dummy WorkOrders', async t => {
  const orgId = 'org-test-123';
  const planId = 'plan-test-1';
  const campaignId = 'campaign-test-1';
  const pointId = 'point-test-1';
  const pitstopJobId = 'warehouse-stop-1';
  const workerUserId = 'user-worker-1';
  const employeeId = 'emp-worker-1';

  const workerActor: PlannerActor = {
    id: workerUserId,
    email: 'worker@example.invalid',
    role: 'WORKER',
  };

  // State store for mocked DB
  let pointState = {
    id: pointId,
    organizationId: orgId,
    campaignId,
    label: 'Point 1',
    status: 'ASSIGNED',
    issueType: null as string | null,
    issueNote: null as string | null,
    startedAt: null as Date | null,
    completedAt: null as Date | null,
    completedByUserId: null as string | null,
  };

  const auditLogs: any[] = [];

  const mockTx = {
    organization: {
      findUnique: async () => ({ plan: 'ENTERPRISE', enabledModules: {} }),
    },
    employee: {
      findFirst: async () => ({
        id: employeeId,
        organizationId: orgId,
        userId: workerUserId,
        isActive: true,
      }),
      findMany: async () => [
        { id: employeeId, userId: workerUserId, isActive: true },
      ],
    },
    fieldPlan: {
      findUnique: async () => ({
        id: planId,
        organizationId: orgId,
        status: 'APPROVED',
        date: new Date().toISOString().slice(0, 10),
        planningInputSnapshot: {
          profile: { timezone: 'Europe/Prague' },
        },
        planningSummary: {
          crews: [
            {
              id: 'crew-1',
              employeeIds: [employeeId],
              stops: [
                {
                  jobId: `election-point:${pointId}`,
                  workOrderId: '',
                  electionRemovalPointId: pointId,
                  routeOrder: 1,
                  startAt: '2026-10-12T08:00:00Z',
                  endAt: '2026-10-12T08:15:00Z',
                },
                {
                  jobId: pitstopJobId,
                  workOrderId: '',
                  isWarehousePitstop: true,
                  routeOrder: 2,
                  startAt: '2026-10-12T09:00:00Z',
                  endAt: '2026-10-12T09:30:00Z',
                },
              ],
            },
          ],
        },
      }),
      update: async () => ({}),
    },
    electionRemovalPoint: {
      findFirst: async () => pointState,
      count: async () => (pointState.status === 'COMPLETED' ? 0 : 1),
      update: async ({ data }: any) => {
        pointState = { ...pointState, ...data };
        return pointState;
      },
    },
    crmAuditLog: {
      findUnique: async ({ where }: any) =>
        auditLogs.find((l) => l.id === where.id) || null,
      findFirst: async () => null,
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return data;
      },
    },
    workOrder: {
      findUnique: async () => null,
      count: async () => 0,
    },
    navigationPoint: {
      count: async () => 0,
    },
    workOrderItem: {
      findMany: async () => [],
    },
  };

  const mockDb = {
    $transaction: async (fn: any) => fn(mockTx),
  };

  await t.test('Worker can start work on election removal point (passing campaignId as workOrderId from MyRouteView)', async () => {
    await runWithTenantContext({ organizationId: orgId, userId: workerUserId, source: 'test' }, async () => {
      const res = await executeStop(
        {
          planId,
          workOrderId: campaignId, // MyRouteView passes campaignId as workOrderId
          jobId: `election-point:${pointId}`,
          action: 'start',
        },
        workerActor,
        mockDb as any
      );

      assert.deepEqual(res, { ok: true });
      assert.equal(pointState.status, 'IN_PROGRESS');
      assert.ok(pointState.startedAt instanceof Date);
    });
  });

  await t.test('Worker can report an issue on election removal point', async () => {
    await runWithTenantContext({ organizationId: orgId, userId: workerUserId, source: 'test' }, async () => {
      const res = await executeStop(
        {
          planId,
          workOrderId: campaignId,
          jobId: `election-point:${pointId}`,
          action: 'problem',
          problemType: 'Nedostupný nosič',
          note: 'Plot je uzamčený',
          requestKey: 'req-problem-12345',
        },
        workerActor,
        mockDb as any
      );

      assert.deepEqual(res, { ok: true });
      assert.equal(pointState.status, 'ISSUE');
      assert.equal(pointState.issueType, 'Nedostupný nosič');
      assert.equal(pointState.issueNote, 'Plot je uzamčený');
    });
  });

  await t.test('Worker can retry/restart an election point that was marked with ISSUE', async () => {
    await runWithTenantContext({ organizationId: orgId, userId: workerUserId, source: 'test' }, async () => {
      const res = await executeStop(
        {
          planId,
          workOrderId: campaignId,
          jobId: `election-point:${pointId}`,
          action: 'start',
        },
        workerActor,
        mockDb as any
      );

      assert.deepEqual(res, { ok: true });
      assert.equal(pointState.status, 'IN_PROGRESS');
    });
  });

  await t.test('Worker can complete work on election removal point', async () => {
    await runWithTenantContext({ organizationId: orgId, userId: workerUserId, source: 'test' }, async () => {
      const res = await executeStop(
        {
          planId,
          workOrderId: campaignId,
          jobId: `election-point:${pointId}`,
          action: 'complete',
        },
        workerActor,
        mockDb as any
      );

      assert.deepEqual(res, { ok: true });
      assert.equal(pointState.status, 'COMPLETED');
      assert.ok(pointState.completedAt instanceof Date);
      assert.equal(pointState.completedByUserId, workerUserId);
    });
  });

  await t.test('Worker can start and complete warehouse pitstop without workOrder error', async () => {
    await runWithTenantContext({ organizationId: orgId, userId: workerUserId, source: 'test' }, async () => {
      const resStart = await executeStop(
        {
          planId,
          workOrderId: 'warehouse',
          jobId: pitstopJobId,
          action: 'start',
        },
        workerActor,
        mockDb as any
      );
      assert.deepEqual(resStart, { ok: true });

      const resComplete = await executeStop(
        {
          planId,
          workOrderId: 'warehouse',
          jobId: pitstopJobId,
          action: 'complete',
        },
        workerActor,
        mockDb as any
      );
      assert.deepEqual(resComplete, { ok: true });
      assert.ok(auditLogs.some((l) => l.action === 'FIELD_POINT_STARTED'));
      assert.ok(auditLogs.some((l) => l.action === 'FIELD_POINT_COMPLETED'));
    });
  });
});
