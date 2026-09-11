import { prisma } from '@/lib/db';
import { canAccess, type AppRole } from '@/lib/rbac';
import { isModuleEnabled } from '@/lib/organization-modules';
import { getTenantContext, requireTenantContext, runWithTenantContext, TenantContextError } from '@/lib/tenant-context';

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
    | 'CITY_GALLERY_PERMIT_EXPIRING'
    | 'PRINT_APPROVED'
    | 'VEHICLE_DEADLINE'
    | 'RADAR_OPPORTUNITY';
  title: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  link: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type NotificationContext = {
  organizationId: string;
  userId?: string;
  userRole: AppRole;
  now: Date;
  next48h: Date;
  thirtyDaysInFuture: Date;
  enabled: (moduleId: string) => boolean;
};

export interface NotificationProvider {
  name: string;
  shouldRun: (ctx: NotificationContext) => boolean;
  getNotifications: (ctx: NotificationContext) => Promise<SystemNotificationItem[]>;
}

// 1. WORKER & TECHNICIAN: Personal Tasks
export const personalTasksProvider: NotificationProvider = {
  name: 'personal-tasks',
  shouldRun: (ctx) => (ctx.userRole === 'WORKER' || ctx.userRole === 'TECHNICIAN') && Boolean(ctx.userId),
  async getNotifications(ctx) {
    if (!ctx.userId) return [];
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { employees: { where: { organizationId: ctx.organizationId }, select: { id: true }, take: 1 } },
    });

    const employee = user?.employees[0];
    if (!employee?.id) return [];

    const openTasks = await prisma.workTask.findMany({
      where: {
        assignedToEmployeeId: employee.id,
        status: { in: ['TODO', 'IN_PROGRESS'] },
      },
      select: { id: true, title: true, scheduledDate: true },
      take: 10,
    });

    return openTasks.map((task) => ({
      id: `my-task-${task.id}`,
      type: 'OPEN_WORK_TASK' as const,
      title: `📋 Váš úkol: ${task.title}`,
      message: task.scheduledDate
        ? `Montážní úkol je naplánovaný na ${new Date(task.scheduledDate).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })}.`
        : 'Montážní úkol zatím nemá naplánované datum.',
      severity: 'HIGH' as const,
      link: `/my-tasks`,
      createdAt: ctx.now.toISOString(),
    }));
  },
};

// 2. SALES: Expiring Navigation Contracts
export const navigationContractsProvider: NotificationProvider = {
  name: 'navigation-contracts',
  shouldRun: (ctx) => ctx.enabled('navigation') && (ctx.userRole === 'SALES' || ctx.userRole === 'ADMIN' || ctx.userRole === 'MANAGER'),
  async getNotifications(ctx) {
    const expiringContracts = await prisma.navigationContract.findMany({
      where: {
        endDate: { lte: ctx.thirtyDaysInFuture, gte: ctx.now },
        status: 'ACTIVE',
      },
      select: { id: true, contractNumber: true, client: { select: { name: true } }, endDate: true },
      take: 15,
    });

    return expiringContracts.map((c) => {
      const diffDays = Math.ceil((new Date(c.endDate).getTime() - ctx.now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: `contract-${c.id}`,
        type: 'EXPIRING_CONTRACT' as const,
        title: `⌛ Končí smlouva: ${c.contractNumber}`,
        message: `Smlouva s klientem ${c.client.name} vyprší za ${diffDays} dní. Kontaktujte klienta pro prodloužení.`,
        severity: diffDays <= 7 ? ('HIGH' as const) : ('MEDIUM' as const),
        link: `/navigation/contracts`,
        createdAt: ctx.now.toISOString(),
      };
    });
  },
};

// 3. SALES: Fresh High-Score AI Radar Opportunities
export const radarOpportunitiesProvider: NotificationProvider = {
  name: 'radar-opportunities',
  shouldRun: (ctx) => ctx.enabled('salesRadar') && (ctx.userRole === 'SALES' || ctx.userRole === 'ADMIN' || ctx.userRole === 'MANAGER'),
  async getNotifications(ctx) {
    const enabled = ctx.enabled;
    const freshRadarOpportunities = enabled('salesRadar') ? await prisma.salesOpportunity.findMany({
      where: {
        status: 'NEW',
        opportunityScore: { gte: 40 },
      },
      select: {
        id: true,
        title: true,
        companyName: true,
        city: true,
        region: true,
        opportunityScore: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }) : [];

    return freshRadarOpportunities.map((opp) => ({
      id: `radar-opp-${opp.id}`,
      type: 'RADAR_OPPORTUNITY' as const,
      title: `🎯 Nová příležitost na AI radaru: ${opp.companyName || opp.title}`,
      message: `Nalezen vysoce relevantní lead (${opp.opportunityScore} % shoda)${opp.city ? ` v lokalitě ${opp.city}` : ''}. Prověřte a kontaktujte firmu.`,
      severity: opp.opportunityScore >= 70 ? ('HIGH' as const) : ('MEDIUM' as const),
      link: `/sales/opportunities`,
      createdAt: opp.createdAt.toISOString(),
      metadata: { opportunityId: opp.id, score: opp.opportunityScore },
    }));
  },
};

// 4. PRODUCTION: Client Approved Print Jobs (last 48h)
export const productionPrintJobsProvider: NotificationProvider = {
  name: 'production-print-jobs',
  shouldRun: (ctx) => ctx.enabled('printProduction') && (ctx.userRole === 'ADMIN' || ctx.userRole === 'MANAGER' || (ctx.userRole as string) === 'PRODUCTION'),
  async getNotifications(ctx) {
    const recentlyApprovedPrints = await prisma.printProductionJob.findMany({
      where: {
        status: 'IN_PRINT',
        clientApprovedAt: { gte: new Date(ctx.now.getTime() - 48 * 60 * 60 * 1000) },
      },
      select: { id: true, title: true, clientApprovedBy: true, clientApprovedAt: true },
      take: 10,
    });

    return recentlyApprovedPrints.map((job) => ({
      id: `print-approval-${job.id}`,
      type: 'PRINT_APPROVED' as const,
      title: `🖨️ Klient schválil data: ${job.title}`,
      message: `Zakázku schválil ${job.clientApprovedBy || 'klient'} v ${job.clientApprovedAt ? new Date(job.clientApprovedAt).toLocaleTimeString('cs-CZ') : 'nedávno'}. Můžete zahájit tisk.`,
      severity: 'MEDIUM' as const,
      link: `/production`,
      createdAt: ctx.now.toISOString(),
    }));
  },
};

// 5. WORK ORDERS: Overdue Tasks, Unassigned Workers, Pending Invoices
export const workOrdersProvider: NotificationProvider = {
  name: 'work-orders',
  shouldRun: (ctx) => ctx.enabled('work') && (ctx.userRole === 'ADMIN' || ctx.userRole === 'MANAGER'),
  async getNotifications(ctx) {
    const items: SystemNotificationItem[] = [];

    // Overdue Work Tasks
    const overdueWorkOrders = await prisma.workOrder.findMany({
      where: {
        deadlineAt: { lt: ctx.now },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      select: { id: true, title: true, clientName: true, deadlineAt: true },
      take: 15,
    });

    overdueWorkOrders.forEach((o) => {
      items.push({
        id: `overdue-${o.id}`,
        type: 'OVERDUE_TASK',
        title: `🚨 Úkol po termínu: ${o.title}`,
        message: `Zakázka pro ${o.clientName} měla být hotová do ${o.deadlineAt ? new Date(o.deadlineAt).toLocaleDateString('cs-CZ') : 'dnes'}.`,
        severity: 'HIGH',
        link: `/work/${o.id}`,
        createdAt: ctx.now.toISOString(),
      });
    });

    // Unassigned Work Orders
    const unassignedOrders = await prisma.workOrder.findMany({
      where: {
        scheduledAt: { lte: ctx.next48h },
        status: { notIn: ['DONE', 'CANCELLED'] },
        assignments: { none: {} },
      },
      select: { id: true, title: true, scheduledAt: true },
      take: 15,
    });

    unassignedOrders.forEach((o) => {
      items.push({
        id: `unassigned-${o.id}`,
        type: 'UNASSIGNED_WORKER',
        title: `⚠️ Nepřiřazený montážník`,
        message: `Zakázka "${o.title}" plánovaná na ${new Date(o.scheduledAt).toLocaleDateString('cs-CZ')} nemá přiřazeného pracovníka.`,
        severity: 'HIGH',
        link: `/work/${o.id}`,
        createdAt: ctx.now.toISOString(),
      });
    });

    // Pending Invoices
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
      items.push({
        id: `invoice-${o.id}`,
        type: 'PENDING_INVOICE',
        title: `🧾 Čeká na fakturaci`,
        message: `Práce na "${o.title}" pro ${o.clientName} byla dokončena. Zbývá vystavit fakturu (${o.price ? `${Number(o.price).toLocaleString('cs-CZ')} Kč` : 'cena neuvedena'}).`,
        severity: 'MEDIUM',
        link: `/work/${o.id}`,
        createdAt: ctx.now.toISOString(),
      });
    });

    return items;
  },
};

// 6. WAREHOUSE: Low Stock Items Alert (< minQuantity)
export const warehouseStockProvider: NotificationProvider = {
  name: 'warehouse-stock',
  shouldRun: ({ userRole, enabled }) => enabled('warehouse') && canAccess(userRole, 'warehouse'),
  async getNotifications(ctx) {
    const lowStockWarehouseItems = await prisma.warehouseItem.findMany({
      where: {
        minQuantity: { not: null },
      },
      select: { id: true, name: true, unit: true, quantityInStock: true, minQuantity: true, location: true },
      take: 25,
    });

    const criticalItems = lowStockWarehouseItems.filter(
      (item) => item.minQuantity !== null && Number(item.quantityInStock) < Number(item.minQuantity),
    );

    return criticalItems.map((item) => ({
      id: `warehouse-low-stock-${item.id}`,
      type: 'LOW_STOCK' as const,
      title: `📦 Dochází materiál ve skladu: ${item.name}`,
      message: `Skladový stav je pouze ${Number(item.quantityInStock)} ${item.unit} (minimální limit je ${Number(item.minQuantity)} ${item.unit})${item.location ? ` na pozici ${item.location}` : ''}. Nutno dokoupit nebo doobjednat!`,
      severity: 'HIGH' as const,
      link: `/warehouse?lowStock=true`,
      createdAt: ctx.now.toISOString(),
    }));
  },
};

// 7. CITY GALLERY: Permit Expiration Alerts (within 30 days)
export const cityGalleryPermitsProvider: NotificationProvider = {
  name: 'city-gallery-permits',
  shouldRun: ({ userRole, enabled }) => enabled('cityGallery') && canAccess(userRole, 'cityGallery'),
  async getNotifications(ctx) {
    const expiringPermitProjects = await prisma.cityGalleryProject.findMany({
      where: {
        permitValidTo: { lte: ctx.thirtyDaysInFuture, gte: ctx.now },
        status: { in: ['ACTIVE', 'PLANNED', 'DRAFT'] },
      },
      select: { id: true, title: true, city: true, locality: true, permitValidTo: true, frameCount: true },
      take: 15,
    });

    const items: SystemNotificationItem[] = [];
    expiringPermitProjects.forEach((p) => {
      if (p.permitValidTo) {
        const diffDays = Math.ceil((new Date(p.permitValidTo).getTime() - ctx.now.getTime()) / (1000 * 60 * 60 * 24));
        items.push({
          id: `city-gallery-permit-${p.id}`,
          type: 'CITY_GALLERY_PERMIT_EXPIRING',
          title: `📜 Končí zábor města: ${p.title}`,
          message: `Povolení záboru veřejného prostranství (${p.city || 'Město'}${p.locality ? ` – ${p.locality}` : ''}) pro ${p.frameCount} nosičů vyprší za ${diffDays} dní (${new Date(p.permitValidTo).toLocaleDateString('cs-CZ')}). Podajte žádost o prodloužení nebo naplánujte odvoz!`,
          severity: diffDays <= 7 ? 'HIGH' : 'MEDIUM',
          link: `/projects/city-gallery`,
          createdAt: ctx.now.toISOString(),
        });
      }
    });
    return items;
  },
};

// 8. VEHICLES: Service, STK, Insurance & Highway Pass Alerts
export const vehicleNotificationsProvider: NotificationProvider = {
  name: 'vehicles',
  shouldRun: (ctx) => ctx.enabled('vehicles') && canAccess(ctx.userRole, 'vehicles'),
  async getNotifications(ctx) {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: { not: 'OUT_OF_SERVICE' },
      },
      select: {
        id: true,
        name: true,
        registrationNumber: true,
        status: true,
        technicalInspectionUntil: true,
        insuranceUntil: true,
        highwayPassUntil: true,
        repairNotes: true,
      },
      take: 50,
    });

    const items: SystemNotificationItem[] = [];
    for (const v of vehicles) {
      const deadlines: Array<[string, Date | null]> = [
        ['STK', v.technicalInspectionUntil],
        ['Pojištění', v.insuranceUntil],
        ['Dálniční známka', v.highwayPassUntil],
      ];

      for (const [label, deadlineDate] of deadlines) {
        if (!deadlineDate) continue;
        const diffDays = Math.ceil((new Date(deadlineDate).getTime() - ctx.now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30 && diffDays >= -14) {
          items.push({
            id: `vehicle-${v.id}-${label.toLowerCase()}`,
            type: 'VEHICLE_DEADLINE',
            title: diffDays < 0 ? `🚨 Propadlá ${label}: ${v.name}` : `⚠️ Blíží se termín ${label}: ${v.name}`,
            message: diffDays < 0
              ? `Termín pro ${label} vozu ${v.name} (${v.registrationNumber}) vypršel před ${Math.abs(diffDays)} dny!`
              : `Termín pro ${label} vozu ${v.name} (${v.registrationNumber}) vyprší za ${diffDays} dní (${new Date(deadlineDate).toLocaleDateString('cs-CZ')}).`,
            severity: diffDays <= 7 ? 'HIGH' : 'MEDIUM',
            link: `/vehicles`,
            createdAt: ctx.now.toISOString(),
            metadata: { vehicleId: v.id, deadlineType: label, diffDays },
          });
        }
      }

      if (v.status === 'SERVICE') {
        items.push({
          id: `vehicle-${v.id}-service`,
          type: 'VEHICLE_FAULT',
          title: `🔧 Vůz v servisu: ${v.name}`,
          message: v.repairNotes ? `Důvod servisu: ${v.repairNotes}` : `Vozidlo ${v.name} je evidováno v servisním stavu.`,
          severity: 'MEDIUM',
          link: `/vehicles`,
          createdAt: ctx.now.toISOString(),
          metadata: { vehicleId: v.id },
        });
      }
    }
    return items;
  },
};

export const ALL_NOTIFICATION_PROVIDERS: NotificationProvider[] = [
  personalTasksProvider,
  navigationContractsProvider,
  radarOpportunitiesProvider,
  productionPrintJobsProvider,
  workOrdersProvider,
  warehouseStockProvider,
  cityGalleryPermitsProvider,
  vehicleNotificationsProvider,
];

export async function getSystemNotifications(
  userRole: AppRole = 'ADMIN',
  userId?: string,
  options: {
    includeAi?: boolean;
    organizationId?: string;
    providers?: NotificationProvider[];
  } = {},
): Promise<{
  totalCount: number;
  highCount: number;
  notifications: SystemNotificationItem[];
  aiSummary?: string | null;
  providerErrors?: Array<{ provider: string; error: string }>;
}> {
  // Explicitly require and enforce tenant context
  const currentTenant = getTenantContext();
  const effectiveOrgId = options.organizationId || currentTenant?.organizationId;

  if (!effectiveOrgId) {
    throw new TenantContextError('Tenant context is required for database operation in notifications.');
  }

  // Ensure deterministic tenant context wrapping for all downstream queries
  return runWithTenantContext(
    {
      organizationId: effectiveOrgId,
      userId,
      source: currentTenant?.source || 'session',
    },
    async () => {
      let organization: { id: string; isActive: boolean; plan?: string | null; enabledModules?: unknown } | null = null;
      if (process.env.DATABASE_URL) {
        try {
          organization = await prisma.organization.findUnique({
            where: { id: effectiveOrgId },
            select: { id: true, isActive: true, plan: true, enabledModules: true },
          });
        } catch {
          // In test/mock environments where DATABASE_URL is not live, continue safely
        }
      }
      const enabled = (moduleId: string) =>
        organization ? Boolean(organization.isActive && isModuleEnabled(organization, moduleId)) : true;

      const now = new Date();
      const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const thirtyDaysInFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const ctx: NotificationContext = {
        organizationId: effectiveOrgId,
        userId,
        userRole,
        now,
        next48h,
        thirtyDaysInFuture,
        enabled,
      };

      const providersToRun = (options.providers || ALL_NOTIFICATION_PROVIDERS).filter((p) => p.shouldRun(ctx));
      const providerErrors: Array<{ provider: string; error: string }> = [];
      const notifications: SystemNotificationItem[] = [];

      // Run each provider safely isolated with explicit tenant context propagation
      const results = await Promise.allSettled(
        providersToRun.map((provider) =>
          runWithTenantContext(
            {
              organizationId: effectiveOrgId,
              userId,
              source: currentTenant?.source || 'session',
            },
            async () => {
              return await provider.getNotifications(ctx);
            },
          ),
        ),
      );

      results.forEach((res, index) => {
        const provider = providersToRun[index];
        if (res.status === 'fulfilled') {
          notifications.push(...res.value);
        } else {
          const err = res.reason;
          // CRITICAL: TenantContextError or security violation MUST NOT be silently caught
          if (err instanceof TenantContextError) {
            throw err;
          }
          const errorMessage = err instanceof Error ? err.message : String(err);
          providerErrors.push({ provider: provider.name, error: errorMessage });
          console.error(
            `[NotificationsProviderError] Provider: "${provider.name}", Tenant: "${effectiveOrgId}", Route: "/api/notifications", Error: ${errorMessage}`,
          );
        }
      });

      // Sort notifications by severity and creation date
      const severityWeight: Record<SystemNotificationItem['severity'], number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      notifications.sort((a, b) => {
        const diff = severityWeight[b.severity] - severityWeight[a.severity];
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      const highCount = notifications.filter((n) => n.severity === 'HIGH').length;

      let aiSummary: string | null = null;
      if (options.includeAi && notifications.length > 0) {
        try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (apiKey) {
            const notifText = notifications.map((n) => `- [${n.severity}] ${n.title}: ${n.message}`).join('\n');
            const systemPrompt = `Jsi AI Asistent vedení firmy SeePoint. Zde je seznam aktuálních notifikací a varování:\n${notifText}\n\nVytvoř 1 STRUČNÝ, PŘEHLEDNÝ A EFEKTIVNÍ SOUHRN v češtině (max 200 znaků) jako "AI Souhrn pro vedoucího", který vypíchne nejakutnější záležitosti (např. nové obchodní příležitosti z AI radaru, končící zábory měst, vypršení smluv, nevyřízené úkoly s důvody). Vrať ČISTÝ TEXT bez jakýchkoliv markdown značek.`;

            const configuredModel = process.env.GEMINI_TEXT_MODEL?.trim();
            const modelsToTry = configuredModel && /^[A-Za-z0-9._-]+$/.test(configuredModel)
              ? [configuredModel]
              : ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];
            for (const model of modelsToTry) {
              try {
                const res = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                    body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] }),
                    signal: AbortSignal.timeout(15_000),
                  },
                );
                if (res.ok) {
                  const data = await res.json();
                  aiSummary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().slice(0, 300) || null;
                  if (aiSummary) break;
                }
              } catch {
                // try next model
              }
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
        ...(providerErrors.length > 0 ? { providerErrors } : {}),
      };
    },
  );
}
