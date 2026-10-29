import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { runWithTenantContext } from '@/lib/tenant-context';
import { createDispatchWork } from '@/lib/dispatch/intake';
import { prisma } from '@/lib/db';
import { loadProfile } from '@/lib/field-planning/data';

export async function GET() {
  const user = await requireApiAccess('work', 'workRoute');
  if (isApiDenied(user)) return user;
  return runWithTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' }, async () => {
    const [employees, vehicles, profile] = await Promise.all([
      prisma.employee.findMany({
        where: { organizationId: user.organizationId!, isActive: true },
        select: { id: true, firstName: true, lastName: true, phone: true, position: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.vehicle.findMany({
        where: {
          organizationId: user.organizationId!,
          status: { notIn: ['SERVICE', 'OUT_OF_SERVICE'] },
        },
        select: { id: true, name: true, registrationNumber: true, type: true },
        orderBy: { name: 'asc' },
      }),
      loadProfile(),
    ]);
    return NextResponse.json({
      employees,
      vehicles,
      warehouses: profile?.warehouses || [],
      depot: profile?.depot || null,
      profile,
    });
  });
}

export async function POST(request: Request) {
  const user = await requireApiAccess('work', 'workRoute');
  if (isApiDenied(user)) return user;
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění zadávat terénní práci.' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const result = await runWithTenantContext(
      { organizationId: user.organizationId!, userId: user.id, source: 'session' },
      () => createDispatchWork(body, user)
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Práci se nepodařilo uložit.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireApiAccess('work', 'workRoute');
  if (isApiDenied(user)) return user;
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění měnit stav prací.' }, { status: 403 });
  }
  try {
    const { itemId } = await request.json();
    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'Chybí ID položky práce.' }, { status: 400 });
    }

    const result = await runWithTenantContext(
      { organizationId: user.organizationId!, userId: user.id, source: 'session' },
      async () => {
        const orgId = user.organizationId!;
        const now = new Date();

        // 1. Navigation Point (navigation-point:<id>)
        if (itemId.startsWith('navigation-point:')) {
          const pointId = itemId.slice(17);
          const point = await prisma.navigationPoint.findFirst({
            where: { id: pointId, organizationId: orgId },
            include: { navigationOrder: { include: { points: true } } },
          });
          if (!point) throw new Error('Bod navigace nebyl nalezen.');

          await prisma.navigationPoint.update({
            where: { id: pointId, organizationId: orgId },
            data: { status: 'INSTALLED', installerUserId: user.id },
          });

          if (point.navigationOrder) {
            const allInstalled = point.navigationOrder.points.every(
              (p) => p.id === pointId || p.status === 'INSTALLED'
            );
            if (allInstalled) {
              await prisma.navigationOrder.update({
                where: { id: point.navigationOrder.id, organizationId: orgId },
                data: {
                  status: 'PRIPRAVENO_K_FAKTURACI',
                  blockStatus: 'CEKA_NA_FAKTURACI',
                  installedAt: now,
                },
              });
              await prisma.workOrder.updateMany({
                where: {
                  navigationOrderId: point.navigationOrder.id,
                  organizationId: orgId,
                  status: { notIn: ['DONE', 'CANCELLED'] },
                },
                data: { status: 'DONE' },
              });
            }
          }
          return { success: true, message: 'Bod navigace byl označen jako nainstalovaný.' };
        }

        // 2. Field Work Step or Point (field-step:<id> or election-point:<id>)
        if (itemId.startsWith('field-step:') || itemId.startsWith('election-point:')) {
          let pointId = '';
          if (itemId.startsWith('field-step:')) {
            const stepId = itemId.slice(11);
            const step = await prisma.fieldWorkStep.findFirst({
              where: { id: stepId, organizationId: orgId },
              select: { pointId: true },
            });
            if (step) pointId = step.pointId;
          } else {
            pointId = itemId.slice(15);
          }
          if (!pointId) throw new Error('Bod terénní práce nebyl nalezen.');

          await prisma.electionRemovalPoint.update({
            where: { id: pointId, organizationId: orgId },
            data: { status: 'COMPLETED', completedAt: now, completedByUserId: user.id },
          });
          await prisma.fieldWorkStep.updateMany({
            where: { pointId, organizationId: orgId },
            data: { status: 'COMPLETED', completedAt: now },
          });

          const point = await prisma.electionRemovalPoint.findFirst({
            where: { id: pointId, organizationId: orgId },
            select: { campaignId: true },
          });
          if (point) {
            const completedCount = await prisma.electionRemovalPoint.count({
              where: { campaignId: point.campaignId, organizationId: orgId, status: 'COMPLETED' },
            });
            await prisma.electionCampaign.update({
              where: { id: point.campaignId, organizationId: orgId },
              data: { completedPoints: completedCount },
            });
          }
          return { success: true, message: 'Terénní práce byla označena jako dokončená.' };
        }

        // 3. Work Order Item (work-item:<id>)
        if (itemId.startsWith('work-item:')) {
          const itemRowId = itemId.slice(10);
          const workItem = await prisma.workOrderItem.findFirst({
            where: { id: itemRowId, workOrder: { organizationId: orgId } },
            include: { workOrder: { include: { items: true } } },
          });
          if (!workItem) throw new Error('Položka zakázky nebyla nalezena.');

          await prisma.workOrderItem.update({
            where: { id: itemRowId },
            data: { executionStatus: 'DONE', completedAt: now },
          });

          const allItemsDone = workItem.workOrder.items.every(
            (i) => i.id === itemRowId || i.executionStatus === 'DONE'
          );
          if (allItemsDone) {
            await prisma.workOrder.update({
              where: { id: workItem.workOrderId, organizationId: orgId },
              data: { status: 'DONE' },
            });
          }
          return { success: true, message: 'Položka práce byla označena jako hotová.' };
        }

        // 4. Standard WorkOrder (by ID)
        const workOrder = await prisma.workOrder.findFirst({
          where: { id: itemId, organizationId: orgId },
          include: { navigationOrder: { include: { points: true } } },
        });
        if (!workOrder) throw new Error('Zakázka nebyla nalezena.');

        await prisma.workOrder.update({
          where: { id: itemId, organizationId: orgId },
          data: { status: 'DONE', ftdSent: true },
        });

        await prisma.workTask.updateMany({
          where: { workOrderId: itemId, organizationId: orgId, status: { not: 'CANCELLED' } },
          data: { status: 'DONE' },
        });

        if (workOrder.navigationOrder) {
          await prisma.navigationPoint.updateMany({
            where: { navigationOrderId: workOrder.navigationOrder.id, organizationId: orgId },
            data: { status: 'INSTALLED', installerUserId: user.id },
          });
          await prisma.navigationOrder.update({
            where: { id: workOrder.navigationOrder.id, organizationId: orgId },
            data: {
              status: 'PRIPRAVENO_K_FAKTURACI',
              blockStatus: 'CEKA_NA_FAKTURACI',
              installedAt: now,
            },
          });
        }

        return { success: true, message: 'Zakázka byla označena jako hotová.' };
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Změna stavu selhala.' },
      { status: 400 }
    );
  }
}
