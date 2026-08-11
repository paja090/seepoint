import { prisma } from '@/lib/db';

export type SystemNotificationItem = {
  id: string;
  type: 'OVERDUE_TASK' | 'UNASSIGNED_WORKER' | 'PENDING_INVOICE' | 'EXPIRING_CONTRACT' | 'MISSING_PHOTO' | 'MISSING_GRAPHICS';
  title: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  link: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export async function getSystemNotifications(): Promise<{
  totalCount: number;
  highCount: number;
  notifications: SystemNotificationItem[];
}> {
  const notifications: SystemNotificationItem[] = [];
  const now = new Date();
  const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // 1. Check Overdue Work Tasks
  const overdueWorkOrders = await prisma.workOrder.findMany({
    where: {
      deadlineAt: { lt: now },
      status: { notIn: ['DONE', 'CANCELLED'] },
    },
    select: { id: true, title: true, clientName: true, deadlineAt: true, priority: true },
    take: 20,
  });

  overdueWorkOrders.forEach((o) => {
    notifications.push({
      id: `overdue-${o.id}`,
      type: 'OVERDUE_TASK',
      title: `🚨 Úkol po termínu: ${o.title}`,
      message: `Zakázka pro ${o.clientName} měla být hotová do ${o.deadlineAt ? new Date(o.deadlineAt).toLocaleDateString('cs-CZ') : 'dnes'}.`,
      severity: 'HIGH',
      link: `/work/${o.id}`,
      createdAt: now.toISOString(),
    });
  });

  // 2. Check Unassigned Work Orders scheduled in next 48h
  const unassignedOrders = await prisma.workOrder.findMany({
    where: {
      scheduledAt: { lte: next48h },
      status: { notIn: ['DONE', 'CANCELLED'] },
      assignments: { none: {} },
    },
    select: { id: true, title: true, clientName: true, scheduledAt: true },
    take: 20,
  });

  unassignedOrders.forEach((o) => {
    notifications.push({
      id: `unassigned-${o.id}`,
      type: 'UNASSIGNED_WORKER',
      title: `⚠️ Nepřiřazený montážník`,
      message: `Zakázka "${o.title}" plánovaná na ${new Date(o.scheduledAt).toLocaleDateString('cs-CZ')} nemá přiřazeného pracovníka.`,
      severity: 'HIGH',
      link: `/work/${o.id}`,
      createdAt: now.toISOString(),
    });
  });

  // 3. Check Pending Invoices (FTD Sent but not invoiced)
  const pendingInvoices = await prisma.workOrder.findMany({
    where: {
      ftdSent: true,
      invoiced: false,
      status: { not: 'CANCELLED' },
    },
    select: { id: true, title: true, clientName: true, price: true },
    take: 20,
  });

  pendingInvoices.forEach((o) => {
    notifications.push({
      id: `invoice-${o.id}`,
      type: 'PENDING_INVOICE',
      title: `🧾 Čeká na fakturaci`,
      message: `Práce na "${o.title}" pro ${o.clientName} byla dokončena a odeslána. Zbývá vystavit fakturu (${o.price ? `${Number(o.price).toLocaleString('cs-CZ')} Kč` : 'cena neuvedena'}).`,
      severity: 'MEDIUM',
      link: `/work/${o.id}`,
      createdAt: now.toISOString(),
    });
  });

  // 4. Check Expiring Navigation Contracts (<30 days)
  const thirtyDaysInFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringContracts = await prisma.navigationContract.findMany({
    where: {
      endDate: { lte: thirtyDaysInFuture, gte: now },
      status: 'ACTIVE',
    },
    select: { id: true, contractNumber: true, client: { select: { name: true } }, endDate: true },
    take: 20,
  });

  expiringContracts.forEach((c) => {
    const diffDays = Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    notifications.push({
      id: `contract-${c.id}`,
      type: 'EXPIRING_CONTRACT',
      title: `⌛ Končí smlouva: ${c.contractNumber}`,
      message: `Smlouva s klientem ${c.client.name} vyprší za ${diffDays} dní (${new Date(c.endDate).toLocaleDateString('cs-CZ')}).`,
      severity: diffDays <= 7 ? 'HIGH' : 'MEDIUM',
      link: `/navigation/contracts`,
      createdAt: now.toISOString(),
    });
  });

  const highCount = notifications.filter((n) => n.severity === 'HIGH').length;

  return {
    totalCount: notifications.length,
    highCount,
    notifications,
  };
}
