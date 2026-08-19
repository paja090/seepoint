import { prisma } from '@/lib/db';
import type { AppRole } from '@/lib/rbac';

export type SystemNotificationItem = {
  id: string;
  type:
    | 'OVERDUE_TASK'
    | 'UNASSIGNED_WORKER'
    | 'PENDING_INVOICE'
    | 'EXPIRING_CONTRACT'
    | 'MY_TASK_TODAY'
    | 'VEHICLE_FAULT'
    | 'LOW_STOCK'
    | 'UNRETURNED_TOOL'
    | 'CITY_GALLERY_PERMIT_EXPIRING';
  title: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  link: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export async function getSystemNotifications(userRole: AppRole = 'ADMIN', userId?: string): Promise<{
  totalCount: number;
  highCount: number;
  notifications: SystemNotificationItem[];
}> {
  const notifications: SystemNotificationItem[] = [];
  const now = new Date();
  const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // 1. WORKER & TECHNICIAN: Personal Tasks & Route Alerts
  if (userRole === 'WORKER' || userRole === 'TECHNICIAN') {
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { employee: { select: { id: true } } },
      });

      if (user?.employee?.id) {
        const myTasksToday = await prisma.workTask.findMany({
          where: {
            assignedToEmployeeId: user.employee.id,
            status: { in: ['TODO', 'IN_PROGRESS'] },
          },
          select: { id: true, title: true, scheduledDate: true },
          take: 10,
        });

        myTasksToday.forEach((task) => {
          notifications.push({
            id: `my-task-${task.id}`,
            type: 'MY_TASK_TODAY',
            title: `📋 Váš úkol: ${task.title}`,
            message: `Máte naplánovaný montážní úkol ${task.scheduledDate ? `na ${new Date(task.scheduledDate).toLocaleDateString('cs-CZ')}` : 'na dnešek'}.`,
            severity: 'HIGH',
            link: `/my-tasks`,
            createdAt: now.toISOString(),
          });
        });
      }
    }
  }

  // 2. SALES: Expiring Contracts & Pending Client Offers
  if (userRole === 'SALES' || userRole === 'ADMIN' || userRole === 'MANAGER') {
    const thirtyDaysInFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringContracts = await prisma.navigationContract.findMany({
      where: {
        endDate: { lte: thirtyDaysInFuture, gte: now },
        status: 'ACTIVE',
      },
      select: { id: true, contractNumber: true, client: { select: { name: true } }, endDate: true },
      take: 15,
    });

    expiringContracts.forEach((c) => {
      const diffDays = Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      notifications.push({
        id: `contract-${c.id}`,
        type: 'EXPIRING_CONTRACT',
        title: `⌛ Končí smlouva: ${c.contractNumber}`,
        message: `Smlouva s klientem ${c.client.name} vyprší za ${diffDays} dní. Kontaktujte klienta pro prodloužení.`,
        severity: diffDays <= 7 ? 'HIGH' : 'MEDIUM',
        link: `/navigation/contracts`,
        createdAt: now.toISOString(),
      });
    });
  }

  // 3. MANAGER & ADMIN: System Operational Alerts (Overdue, Unassigned, Invoices)
  if (userRole === 'ADMIN' || userRole === 'MANAGER') {
    // Check Overdue Work Tasks
    const overdueWorkOrders = await prisma.workOrder.findMany({
      where: {
        deadlineAt: { lt: now },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      select: { id: true, title: true, clientName: true, deadlineAt: true },
      take: 15,
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

    // Check Unassigned Work Orders
    const unassignedOrders = await prisma.workOrder.findMany({
      where: {
        scheduledAt: { lte: next48h },
        status: { notIn: ['DONE', 'CANCELLED'] },
        assignments: { none: {} },
      },
      select: { id: true, title: true, scheduledAt: true },
      take: 15,
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

    // Check Pending Invoices
    const pendingInvoices = await prisma.workOrder.findMany({
      where: {
        ftdSent: true,
        invoiced: false,
        status: { not: 'CANCELLED' },
      },
      select: { id: true, title: true, clientName: true, price: true },
      take: 15,
    });

    pendingInvoices.forEach((o) => {
      notifications.push({
        id: `invoice-${o.id}`,
        type: 'PENDING_INVOICE',
        title: `🧾 Čeká na fakturaci`,
        message: `Práce na "${o.title}" pro ${o.clientName} byla dokončena. Zbývá vystavit fakturu (${o.price ? `${Number(o.price).toLocaleString('cs-CZ')} Kč` : 'cena neuvedena'}).`,
        severity: 'MEDIUM',
        link: `/work/${o.id}`,
        createdAt: now.toISOString(),
      });
    });
  }

  // 4. WAREHOUSE: Low Stock Items Alert (< minQuantity)
  const lowStockWarehouseItems = await prisma.warehouseItem.findMany({
    where: {
      minQuantity: { not: null },
    },
    select: { id: true, name: true, unit: true, quantityInStock: true, minQuantity: true, location: true },
    take: 25,
  });

  const criticalItems = lowStockWarehouseItems.filter(
    (item) => item.minQuantity !== null && Number(item.quantityInStock) < Number(item.minQuantity)
  );

  criticalItems.forEach((item) => {
    notifications.push({
      id: `warehouse-low-stock-${item.id}`,
      type: 'LOW_STOCK',
      title: `📦 Dochází materiál ve skladu: ${item.name}`,
      message: `Skladový stav je pouze ${Number(item.quantityInStock)} ${item.unit} (minimální limit je ${Number(item.minQuantity)} ${item.unit})${item.location ? ` na pozici ${item.location}` : ''}. Nutno dokoupit nebo doobjednat!`,
      severity: 'HIGH',
      link: `/warehouse?lowStock=true`,
      createdAt: now.toISOString(),
    });
  });

  // 5. WAREHOUSE: Long-standing Unreturned Borrowed Tools (> 48h)
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const unreturnedMovements = await prisma.warehouseMovement.findMany({
    where: {
      type: 'ISSUE',
      createdAt: { lte: twoDaysAgo },
      item: { category: 'RETURNABLE' },
    },
    include: { item: true },
    orderBy: { createdAt: 'asc' },
    take: 15,
  });

  unreturnedMovements.forEach((m) => {
    if (m.item) {
      notifications.push({
        id: `unreturned-tool-${m.id}`,
        type: 'UNRETURNED_TOOL',
        title: `🛠️ Dlouho nevrácené nářadí: ${m.item.name}`,
        message: `${m.performedByName || m.assignedEmployeeName || 'Pracovník'} má vybrané nářadí ${m.item.name} (${Number(m.quantity)} ${m.item.unit}) již od ${new Date(m.createdAt).toLocaleDateString('cs-CZ')}. Nezapomeňte vrátit do skladu!`,
        severity: 'MEDIUM',
        link: `/warehouse`,
        createdAt: now.toISOString(),
      });
    }
  });

  // 6. CITY GALLERY: Permit Expiration Alerts (within 30 days)
  const thirtyDaysInFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringPermitProjects = await prisma.cityGalleryProject.findMany({
    where: {
      permitValidTo: { lte: thirtyDaysInFuture, gte: now },
      status: { in: ['ACTIVE', 'SCHEDULED'] },
    },
    select: { id: true, title: true, city: true, locality: true, permitValidTo: true, frameCount: true },
    take: 15,
  });

  expiringPermitProjects.forEach((p) => {
    if (p.permitValidTo) {
      const diffDays = Math.ceil((new Date(p.permitValidTo).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      notifications.push({
        id: `city-gallery-permit-${p.id}`,
        type: 'CITY_GALLERY_PERMIT_EXPIRING',
        title: `📜 Končí zábor města: ${p.title}`,
        message: `Povolení záboru veřejného prostranství (${p.city || 'Město'}${p.locality ? ` – ${p.locality}` : ''}) pro ${p.frameCount} nosičů vyprší za ${diffDays} dní (${new Date(p.permitValidTo).toLocaleDateString('cs-CZ')}). Podajte žádost o prodloužení nebo naplánujte odvoz!`,
        severity: diffDays <= 7 ? 'HIGH' : 'MEDIUM',
        link: `/projects/city-gallery`,
        createdAt: now.toISOString(),
      });
    }
  });

  const highCount = notifications.filter((n) => n.severity === 'HIGH').length;

  return {
    totalCount: notifications.length,
    highCount,
    notifications,
  };
}
