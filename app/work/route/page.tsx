import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { WorkRoutePlanner } from '@/components/WorkRoutePlanner';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function localDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export default async function WorkRoutePage() {
  await requirePageAccess('work');
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 14);
  const rangeEnd = new Date(now);
  rangeEnd.setMonth(rangeEnd.getMonth() + 6);

  const orders = await prisma.workOrder.findMany({
    where: {
      scheduledAt: { gte: rangeStart, lte: rangeEnd },
      status: { not: 'CANCELLED' },
    },
    include: {
      assignments: true,
      items: { include: { carrier: true } },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 300,
  });

  const today = localDate(now);
  const defaultDate = orders.some((order) => localDate(order.scheduledAt) === today)
    ? today
    : localDate(orders.find((order) => order.scheduledAt >= now)?.scheduledAt ?? now);

  return (
    <AppShell>
      <WorkRoutePlanner
        defaultDate={defaultDate}
        initialOrders={orders.map((order) => {
          const carrier = order.items.find((item) => item.carrier)?.carrier;
          return {
            id: order.id,
            title: order.title,
            clientName: order.clientName,
            requestedBy: order.requestedBy,
            description: order.description,
            locationNote: order.locationNote,
            mediaLabel: order.mediaLabel,
            scheduledAt: order.scheduledAt.toISOString(),
            status: order.status,
            priority: order.priority,
            workers: order.assignments.map((assignment) => assignment.workerName),
            carrier: carrier ? {
              id: carrier.id,
              code: carrier.code,
              name: carrier.name,
              city: carrier.city,
              address: carrier.address,
              latitude: carrier.latitude,
              longitude: carrier.longitude,
            } : null,
          };
        })}
      />
    </AppShell>
  );
}
