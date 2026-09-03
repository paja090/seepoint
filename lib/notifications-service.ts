import { prisma } from '@/lib/db';
import { canAccess, type AppRole } from '@/lib/rbac';
import { requireTenantContext } from '@/lib/tenant-context';

export type SystemNotificationItem = {
  id: string;
  type:
    | 'OVERDUE_TASK'
    | 'UNASSIGNED_WORKER'
    | 'PENDING_INVOICE'
    | 'EXPIRING_CONTRACT'
    | 'OPEN_WORK_TASK'
    | 'VEHICLE_FAULT'
    | 'LOW_STOCK'
    | 'CITY_GALLERY_PERMIT_EXPIRING';
  title: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  link: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export async function getSystemNotifications(userRole: AppRole = 'ADMIN', userId?: string, options: { includeAi?: boolean } = {}): Promise<{
  totalCount: number;
  highCount: number;
  notifications: SystemNotificationItem[];
  aiSummary?: string | null;
}> {
  const notifications: SystemNotificationItem[] = [];
  const now = new Date();
  const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // 1. WORKER & TECHNICIAN: Personal Tasks & Route Alerts
  if (userRole === 'WORKER' || userRole === 'TECHNICIAN') {
    if (userId) {
      const { organizationId } = requireTenantContext();
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { employees: { where: { organizationId }, select: { id: true }, take: 1 } },
      });

      const employee = user?.employees[0];
      if (employee?.id) {
        const openTasks = await prisma.workTask.findMany({
          where: {
            assignedToEmployeeId: employee.id,
            status: { in: ['TODO', 'IN_PROGRESS'] },
          },
          select: { id: true, title: true, scheduledDate: true },
          take: 10,
        });

        openTasks.forEach((task) => {
          notifications.push({
            id: `my-task-${task.id}`,
            type: 'OPEN_WORK_TASK',
            title: `📋 Váš úkol: ${task.title}`,
            message: task.scheduledDate
              ? `Montážní úkol je naplánovaný na ${new Date(task.scheduledDate).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })}.`
              : 'Montážní úkol zatím nemá naplánované datum.',
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
  const lowStockWarehouseItems = canAccess(userRole, 'warehouse') ? await prisma.warehouseItem.findMany({
    where: {
      minQuantity: { not: null },
    },
    select: { id: true, name: true, unit: true, quantityInStock: true, minQuantity: true, location: true },
    take: 25,
  }) : [];

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

  // A warehouse ISSUE row is only a historical movement, not an active loan.
  // Do not emit "unreturned" alerts until loans and their returns are linked persistently.

  // 6. CITY GALLERY: Permit Expiration Alerts (within 30 days)
  const thirtyDaysInFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringPermitProjects = canAccess(userRole, 'cityGallery') ? await prisma.cityGalleryProject.findMany({
    where: {
      permitValidTo: { lte: thirtyDaysInFuture, gte: now },
      status: { in: ['ACTIVE', 'PLANNED', 'DRAFT'] },
    },
    select: { id: true, title: true, city: true, locality: true, permitValidTo: true, frameCount: true },
    take: 15,
  }) : [];

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

  let aiSummary: string | null = null;
  if (options.includeAi && notifications.length > 0) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const notifText = notifications.map((n) => `- [${n.severity}] ${n.title}: ${n.message}`).join('\n');
        const systemPrompt = `Jsi AI Asistent vedení firmy SeePoint. Zde je seznam aktuálních notifikací a varování:\n${notifText}\n\nVytvoř 1 STRUČNÝ, PŘEHLEDNÝ A EFEKTIVNÍ SOUHRN v češtině (max 200 znaků) jako "AI Souhrn pro vedoucího", který vypíchne nejakutnější problémy (např. končící zábory měst, vypršení smluv, nevyřízené úkoly s důvody). Vrať ČISTÝ TEXT bez jakýchkoliv markdown značek.`;

        const configuredModel = process.env.GEMINI_TEXT_MODEL?.trim();
        const model = configuredModel && /^[A-Za-z0-9._-]+$/.test(configuredModel) ? configuredModel : 'gemini-2.5-flash';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] }),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) {
          const data = await res.json();
          aiSummary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().slice(0, 300) || null;
        }
      }
    } catch (err) {
      console.error('Error generating AI notification summary:', err);
    }
  }

  return {
    totalCount: notifications.length,
    highCount,
    notifications,
    aiSummary,
  };
}
