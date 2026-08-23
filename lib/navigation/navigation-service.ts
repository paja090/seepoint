import { randomUUID } from 'node:crypto';
import { Prisma, PhotoType, NavigationOrderStatus, NavigationBlockStatus } from '@prisma/client';
import { prisma } from '../db.ts';
import type { CurrentUser } from '../rbac.ts';
import {
  NavigationOrderDetail,
  NavigationOrderListItem,
  NavigationDashboardStats,
  AttentionAlertItem,
} from './types.ts';
import { nextCrmOrderNumber } from '../crm/domain.ts';
import { requireTenantContext } from '../tenant-context.ts';

export class NavigationServiceError extends Error {
  code: string;

  constructor(message: string, code = 'NAVIGATION_ERROR') {
    super(message);
    this.name = 'NavigationServiceError';
    this.code = code;
  }
}

type NavigationOrderActor = Pick<CurrentUser, 'id' | 'email'>;

async function convertOfferToNavigationOrderWithTransaction(
  tx: Prisma.TransactionClient,
  offerId: string,
  actorUser: NavigationOrderActor
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('seepoint-crm-order-number'))`;

    const offer = await tx.offer.findUnique({
      where: { id: offerId },
      include: {
        navigationOffer: {
          include: {
            points: true,
          },
        },
        crmOrder: true,
      },
    });

    if (!offer || offer.offerType !== 'NAVIGATION') {
      throw new NavigationServiceError('Navigační nabídka nebyla nalezena.', 'NOT_FOUND');
    }

    if (offer.crmOrder) {
      const existingNavOrder = await tx.navigationOrder.findUnique({
        where: { crmOrderId: offer.crmOrder.id },
      });
      if (existingNavOrder) return existingNavOrder;
    }

    const year = new Date().getFullYear();
    const latestOrder = await tx.crmOrder.findFirst({
      where: { orderNumber: { startsWith: `ZAK-${year}-` } },
      select: { orderNumber: true },
      orderBy: { orderNumber: 'desc' },
    });
    const orderNumber = nextCrmOrderNumber(year, latestOrder?.orderNumber);

    const crmOrder = await tx.crmOrder.create({
      data: {
        orderNumber,
        clientId: offer.clientId,
        offerId: offer.id,
        assignedUserId: offer.createdByUserId || actorUser.id,
        title: `Navigační zakázka: ${offer.title}`,
        projectType: 'NAVIGATION',
        status: 'CONFIRMED',
        totalPrice: offer.totalPrice ?? offer.subtotal ?? 0,
        note: offer.note || null,
        internalNote: offer.internalNote || null,
      },
    });

    const navData = offer.navigationOffer;
    const targetName = navData?.targetName || offer.title;
    const targetAddress = navData?.targetAddress || null;
    const targetLatitude = navData?.targetLatitude || 0;
    const targetLongitude = navData?.targetLongitude || 0;
    const targetNote = navData?.targetNote || null;

    const navOrder = await tx.navigationOrder.create({
      data: {
        crmOrderId: crmOrder.id,
        status: 'POTVRZENO_KLIENTEM',
        blockStatus: 'CEKA_NA_OBJEDNAVKU',
        targetName,
        targetAddress,
        targetLatitude,
        targetLongitude,
        targetNote,
      },
    });

    const selectedPoints = navData?.points?.filter((p) => p.isSelectedByClient !== false) || [];
    if (selectedPoints.length > 0) {
      for (const p of selectedPoints) {
        await tx.navigationPoint.create({
          data: {
            navigationOrderId: navOrder.id,
            // Body nabídky jsou unikátní budoucí pozice. Fyzický nosič se zakládá
            // až po skutečné montáži, nikdy se nekopíruje z nabídky.
            carrierId: null,
            sortOrder: p.sortOrder,
            latitude: p.latitude,
            longitude: p.longitude,
            address: p.address,
            label: p.label,
            navigationType: p.navigationType,
            variant: p.variant,
            orientation: p.orientation,
            quantity: p.quantity,
            unitPrice: p.unitPrice,
            subtotal: p.subtotal,
            installationPrice: p.installationPrice,
            removalPrice: p.removalPrice,
            productionPrice: p.productionPrice,
            internalNote: p.internalNote,
            clientNote: p.clientNote,
            status: 'PLANNED',
          },
        });
      }
    }

    await tx.offer.update({
      where: { id: offerId },
      data: { status: 'ACCEPTED', acceptedAt: offer.acceptedAt || new Date() },
    });

    await tx.crmAuditLog.create({
      data: {
        userId: actorUser.id,
        userEmail: actorUser.email,
        action: 'CONVERT_OFFER_TO_NAVIGATION_ORDER',
        entityType: 'NavigationOrder',
        entityId: navOrder.id,
        detailsJson: JSON.stringify({ offerId: offer.id, orderNumber }),
      },
    });

  return navOrder;
}

export function convertOfferToNavigationOrderInTransaction(
  tx: Prisma.TransactionClient,
  offerId: string,
  actorUser: NavigationOrderActor
) {
  return convertOfferToNavigationOrderWithTransaction(tx, offerId, actorUser);
}

export async function convertOfferToNavigationOrder(
  offerId: string,
  actorUser: CurrentUser
) {
  return prisma.$transaction((tx) => convertOfferToNavigationOrderWithTransaction(tx, offerId, actorUser));
}

export async function listNavigationOrders(
  user: CurrentUser,
  filters: {
    query?: string;
    status?: string;
    blockStatus?: string;
    clientId?: string;
    assignedUserId?: string;
    quickFilter?: string;
  }
): Promise<NavigationOrderListItem[]> {
  const where: Prisma.NavigationOrderWhereInput = {};

  if (filters.status) {
    where.status = filters.status as NavigationOrderStatus;
  }

  if (filters.blockStatus) {
    where.blockStatus = filters.blockStatus as NavigationBlockStatus;
  }

  if (user.role === 'SALES') {
    where.crmOrder = {
      is: {
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.assignedUserId ? { assignedUserId: filters.assignedUserId } : {}),
        OR: [
          { assignedUserId: user.id },
          { offer: { is: { createdByUserId: user.id } } },
        ],
      },
    };
  } else {
    const crmOrderWhere: Prisma.CrmOrderWhereInput = {};
    if (filters.clientId) crmOrderWhere.clientId = filters.clientId;
    if (filters.assignedUserId) crmOrderWhere.assignedUserId = filters.assignedUserId;
    if (Object.keys(crmOrderWhere).length > 0) {
      where.crmOrder = { is: crmOrderWhere };
    }
  }

  // Quick filters
  if (filters.quickFilter === 'MY') {
    where.crmOrder = { is: { assignedUserId: user.id } };
  } else if (filters.quickFilter === 'ACTIVE') {
    where.status = { in: ['POPTAVKA', 'NABIDKA', 'POTVRZENO_KLIENTEM', 'SMLOUVA_OBJEDNAVKA', 'GRAFICKE_PODKLADY', 'SCHVALENI_GRAFIKY', 'TISK_VYROBA', 'PRIPRAVENO_K_INSTALACI', 'INSTALACE', 'FOTODOKUMENTACE'] };
  } else if (filters.quickFilter === 'MISSING_PHOTOS') {
    where.status = { in: ['INSTALACE', 'FOTODOKUMENTACE'] };
  } else if (filters.quickFilter === 'READY_BILLING') {
    where.status = 'PRIPRAVENO_K_FAKTURACI';
  } else if (filters.quickFilter === 'COMPLETED') {
    where.status = { in: ['FAKTUROVANO', 'DOKONCENO'] };
  }

  if (filters.query) {
    const q = filters.query.trim();
    where.OR = [
      { targetName: { contains: q, mode: 'insensitive' } },
      { targetAddress: { contains: q, mode: 'insensitive' } },
      { crmOrder: { orderNumber: { contains: q, mode: 'insensitive' } } },
      { crmOrder: { client: { name: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  const orders = await prisma.navigationOrder.findMany({
    where,
    include: {
      crmOrder: {
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          assignedUser: { select: { id: true, name: true } },
        },
      },
      points: {
        select: {
          id: true,
          status: true,
          installedPhotoId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();

  return orders.map((o) => {
    const installedPointsCount = o.points.filter((p) => p.status === 'INSTALLED').length;
    const photosCount = o.points.filter((p) => p.installedPhotoId !== null).length;
    const daysInStatus = Math.floor((now.getTime() - new Date(o.updatedAt).getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: o.id,
      crmOrderId: o.crmOrderId,
      orderNumber: o.crmOrder.orderNumber,
      title: o.crmOrder.title,
      clientId: o.crmOrder.clientId,
      clientName: o.crmOrder.client.name,
      assignedUserId: o.crmOrder.assignedUserId,
      assignedUserName: o.crmOrder.assignedUser?.name || null,
      status: o.status,
      blockStatus: o.blockStatus,
      targetName: o.targetName,
      targetAddress: o.targetAddress,
      targetLatitude: o.targetLatitude,
      targetLongitude: o.targetLongitude,
      totalPrice: Number(o.crmOrder.totalPrice ?? 0),
      pointsCount: o.points.length,
      installedPointsCount,
      photosCount,
      rentStart: o.rentStart ? o.rentStart.toISOString() : null,
      rentEnd: o.rentEnd ? o.rentEnd.toISOString() : null,
      installationDate: o.installationDate ? o.installationDate.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      daysInStatus,
    };
  });
}

export async function getNavigationDashboardStats(user: CurrentUser): Promise<NavigationDashboardStats> {
  const where: Prisma.NavigationOrderWhereInput = {};
  if (user.role === 'SALES') {
    where.crmOrder = {
      is: {
        OR: [
          { assignedUserId: user.id },
          { offer: { is: { createdByUserId: user.id } } },
        ],
      },
    };
  }

  const allOrders = await prisma.navigationOrder.findMany({
    where,
    select: {
      status: true,
      blockStatus: true,
      points: {
        select: {
          status: true,
          installedPhotoId: true,
        },
      },
    },
  });

  const totalCount = allOrders.length;
  const activeCount = allOrders.filter((o) => o.status !== 'DOKONCENO' && o.status !== 'FAKTUROVANO').length;
  const waitingForClientCount = allOrders.filter((o) => o.blockStatus === 'CEKA_NA_KLIENTA' || o.blockStatus === 'CEKA_NA_POTVRZENI_NABIDKY' || o.blockStatus === 'CEKA_NA_OBJEDNAVKU').length;
  const waitingForGraphicsCount = allOrders.filter((o) => o.status === 'GRAFICKE_PODKLADY' || o.status === 'SCHVALENI_GRAFIKY' || o.blockStatus === 'CEKA_NA_GRAFIKU' || o.blockStatus === 'CEKA_NA_SCHVALENI_GRAFIKY').length;
  const inProductionCount = allOrders.filter((o) => o.status === 'TISK_VYROBA' || o.blockStatus === 'CEKA_NA_TISK').length;
  const readyForInstallationCount = allOrders.filter((o) => o.status === 'PRIPRAVENO_K_INSTALACI' || o.blockStatus === 'CEKA_NA_INSTALACI').length;
  const installationInProgressCount = allOrders.filter((o) => o.status === 'INSTALACE').length;
  const missingPhotosCount = allOrders.filter((o) => (o.status === 'INSTALACE' || o.status === 'FOTODOKUMENTACE') && o.points.some((p) => p.installedPhotoId === null)).length;
  const readyForBillingCount = allOrders.filter((o) => o.status === 'PRIPRAVENO_K_FAKTURACI' || o.blockStatus === 'CEKA_NA_FAKTURACI').length;

  return {
    totalCount,
    activeCount,
    waitingForClientCount,
    waitingForGraphicsCount,
    inProductionCount,
    readyForInstallationCount,
    installationInProgressCount,
    missingPhotosCount,
    readyForBillingCount,
  };
}

export async function getNavigationAttentionAlerts(user: CurrentUser): Promise<AttentionAlertItem[]> {
  const where: Prisma.NavigationOrderWhereInput = {
    status: { notIn: ['DOKONCENO', 'FAKTUROVANO'] },
  };

  if (user.role === 'SALES') {
    where.crmOrder = {
      is: {
        OR: [
          { assignedUserId: user.id },
          { offer: { is: { createdByUserId: user.id } } },
        ],
      },
    };
  }

  const orders = await prisma.navigationOrder.findMany({
    where,
    include: {
      crmOrder: {
        include: {
          client: { select: { name: true } },
          assignedUser: { select: { name: true } },
        },
      },
      points: true,
    },
    orderBy: { updatedAt: 'asc' },
  });

  const alerts: AttentionAlertItem[] = [];
  const now = new Date();

  for (const o of orders) {
    const daysInStatus = Math.floor((now.getTime() - new Date(o.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    const orderNumber = o.crmOrder.orderNumber;
    const clientName = o.crmOrder.client.name;
    const assignedUserName = o.crmOrder.assignedUser?.name || 'Nepřiřazen';

    // 1. Dlouho blokováno
    if (o.blockStatus && daysInStatus > 3) {
      alerts.push({
        id: `block-${o.id}`,
        orderId: o.id,
        orderNumber,
        clientName,
        reason: `Blokováno ve stavu "${o.blockStatus}" už ${daysInStatus} dní`,
        waitingDaysOrDeadline: `${daysInStatus} dní`,
        assignedUserName,
        actionUrl: `/navigation/orders/${o.id}`,
        actionLabel: 'Vyřešit blokaci',
        severity: daysInStatus > 7 ? 'HIGH' : 'MEDIUM',
      });
    }

    // 2. Chybí fotodokumentace
    if ((o.status === 'INSTALACE' || o.status === 'FOTODOKUMENTACE') && o.points.some((p) => p.installedPhotoId === null)) {
      const missingCount = o.points.filter((p) => p.installedPhotoId === null).length;
      alerts.push({
        id: `photo-${o.id}`,
        orderId: o.id,
        orderNumber,
        clientName,
        reason: `Montáž dokončena, ale chybí ${missingCount} fotek z terénu`,
        waitingDaysOrDeadline: `${o.points.length - missingCount}/${o.points.length} fotek`,
        assignedUserName,
        actionUrl: `/navigation/orders/${o.id}`,
        actionLabel: 'Doplnit fotky',
        severity: 'HIGH',
      });
    }

    // 3. Chybí GPS u bodů
    if (o.targetLatitude === 0 && o.targetLongitude === 0) {
      alerts.push({
        id: `gps-${o.id}`,
        orderId: o.id,
        orderNumber,
        clientName,
        reason: 'Cílová provozovna nemá zadané GPS souřadnice',
        waitingDaysOrDeadline: 'Chybí GPS',
        assignedUserName,
        actionUrl: `/navigation/orders/${o.id}`,
        actionLabel: 'Doplnit GPS',
        severity: 'LOW',
      });
    }

    // 4. Chybí grafika / podklady
    if (o.status === 'GRAFICKE_PODKLADY' || o.status === 'SCHVALENI_GRAFIKY' || o.blockStatus === 'CEKA_NA_GRAFIKU') {
      alerts.push({
        id: `graphics-${o.id}`,
        orderId: o.id,
        orderNumber,
        clientName,
        reason: 'Chybí schválený grafický motiv cedule pro výrobu',
        waitingDaysOrDeadline: 'Chybí grafika',
        assignedUserName,
        actionUrl: `/navigation/orders/${o.id}`,
        actionLabel: 'Nahrát / Schválit grafiku',
        severity: 'HIGH',
      });
    }

    // 5. Čeká na instalaci
    if (o.status === 'PRIPRAVENO_K_INSTALACI' || o.blockStatus === 'CEKA_NA_INSTALACI') {
      alerts.push({
        id: `install-${o.id}`,
        orderId: o.id,
        orderNumber,
        clientName,
        reason: 'Výroba dokončena – čeká na výjezd montážní čety v terénu',
        waitingDaysOrDeadline: 'K instalaci',
        assignedUserName,
        actionUrl: `/navigation/installations/planning`,
        actionLabel: 'Naplánovat montáž',
        severity: 'MEDIUM',
      });
    }

    // 6. Připraveno k fakturaci
    if (o.status === 'PRIPRAVENO_K_FAKTURACI' || o.blockStatus === 'CEKA_NA_FAKTURACI') {
      alerts.push({
        id: `billing-${o.id}`,
        orderId: o.id,
        orderNumber,
        clientName,
        reason: 'Montáž i dokumentace schválena – čeká na vystavení faktury',
        waitingDaysOrDeadline: 'K fakturaci',
        assignedUserName,
        actionUrl: `/navigation/orders/${o.id}`,
        actionLabel: 'Vystavit fakturu',
        severity: 'MEDIUM',
      });
    }
  }

  // 7. Kontrola končících smluv (Evidence smluv - Automatické upozornění)
  const expiringContracts = await prisma.navigationContract.findMany({
    where: {
      status: 'ACTIVE',
      endDate: {
        lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
      },
    },
    include: {
      client: { select: { name: true } },
    },
    take: 5,
  });

  for (const c of expiringContracts) {
    const daysLeft = Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    alerts.push({
      id: `contract-${c.id}`,
      orderId: c.navigationOrderId || c.id,
      orderNumber: c.contractNumber,
      clientName: c.client.name,
      reason: daysLeft < 0 ? `Smlouva #${c.contractNumber} vypršela pred ${Math.abs(daysLeft)} dny` : `Smlouva #${c.contractNumber} končí za ${daysLeft} dní`,
      waitingDaysOrDeadline: daysLeft < 0 ? 'Vypršela' : `${daysLeft} dní`,
      assignedUserName: c.responsiblePerson || 'Obchodník',
      actionUrl: `/navigation/contracts`,
      actionLabel: 'Prodloužit smlouvu',
      severity: daysLeft <= 7 ? 'HIGH' : 'MEDIUM',
    });
  }

  return alerts.slice(0, 15);
}

export async function getNavigationOrderDetail(id: string, user: CurrentUser): Promise<NavigationOrderDetail> {
  const o = await prisma.navigationOrder.findUnique({
    where: { id },
    include: {
      crmOrder: {
        include: {
          client: { select: { id: true, name: true, email: true, phone: true, contactPerson: true } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          assignedUser: { select: { id: true, name: true } },
          offer: {
            select: {
              navigationOffer: {
                select: {
                  graphicArtworkUrl: true,
                  clientArtworkUrl: true,
                  clientArtworkFileName: true,
                  includeGraphicProof: true,
                },
              },
            },
          },
        },
      },
      points: {
        include: {
          carrier: { select: { id: true, code: true, name: true } },
          surface: { select: { id: true, name: true } },
          installedPhoto: { select: { id: true, url: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
      billingPeriods: {
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
        },
        orderBy: { dateFrom: 'asc' },
      },
    },
  });

  if (!o) {
    throw new NavigationServiceError('Navigační zakázka nebyla nalezena.', 'NOT_FOUND');
  }

  if (user.role === 'SALES' && o.crmOrder.assignedUserId !== user.id) {
    const isOfferOwner = o.crmOrder.offerId
      ? Boolean(await prisma.offer.findFirst({ where: { id: o.crmOrder.offerId, createdByUserId: user.id } }))
      : false;
    if (!isOfferOwner) {
      throw new NavigationServiceError('K této navigační zakázce nemáte přístup.', 'FORBIDDEN');
    }
  }

  // Fetch audit logs for history tab
  const auditLogsRaw = await prisma.crmAuditLog.findMany({
    where: {
      OR: [
        { entityId: o.id },
        { entityId: o.crmOrderId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const auditLogs = auditLogsRaw.map((log) => ({
    id: log.id,
    action: log.action,
    userEmail: log.userEmail,
    details: log.detailsJson,
    createdAt: log.createdAt.toISOString(),
  }));

  return {
    id: o.id,
    crmOrderId: o.crmOrderId,
    orderNumber: o.crmOrder.orderNumber,
    title: o.crmOrder.title,
    clientId: o.crmOrder.clientId,
    clientName: o.crmOrder.client.name,
    contactPerson: o.crmOrder.contact ? `${o.crmOrder.contact.firstName} ${o.crmOrder.contact.lastName}` : o.crmOrder.client.contactPerson || null,
    contactEmail: o.crmOrder.contact?.email || o.crmOrder.client.email || null,
    contactPhone: o.crmOrder.contact?.phone || o.crmOrder.client.phone || null,
    assignedUserId: o.crmOrder.assignedUserId,
    assignedUserName: o.crmOrder.assignedUser?.name || null,
    status: o.status,
    blockStatus: o.blockStatus,
    rentStart: o.rentStart ? o.rentStart.toISOString() : null,
    rentEnd: o.rentEnd ? o.rentEnd.toISOString() : null,
    installationDate: o.installationDate ? o.installationDate.toISOString() : null,
    deinstallationDate: o.deinstallationDate ? o.deinstallationDate.toISOString() : null,
    targetName: o.targetName,
    targetAddress: o.targetAddress,
    targetLatitude: o.targetLatitude,
    targetLongitude: o.targetLongitude,
    targetNote: o.targetNote,
    graphicArtworkUrl: o.crmOrder.offer?.navigationOffer?.graphicArtworkUrl ?? null,
    clientArtworkUrl: o.crmOrder.offer?.navigationOffer?.clientArtworkUrl ?? null,
    clientArtworkFileName: o.crmOrder.offer?.navigationOffer?.clientArtworkFileName ?? null,
    includeGraphicProof: o.crmOrder.offer?.navigationOffer?.includeGraphicProof ?? true,
    graphicsApprovedAt: o.graphicsApprovedAt ? o.graphicsApprovedAt.toISOString() : null,
    productionReadyAt: o.productionReadyAt ? o.productionReadyAt.toISOString() : null,
    installedAt: o.installedAt ? o.installedAt.toISOString() : null,
    invoicedAt: o.invoicedAt ? o.invoicedAt.toISOString() : null,
    totalPrice: Number(o.crmOrder.totalPrice ?? 0),
    note: o.crmOrder.note,
    internalNote: o.crmOrder.internalNote,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    points: o.points.map((p) => ({
      id: p.id,
      label: p.label,
      latitude: p.latitude,
      longitude: p.longitude,
      address: p.address,
      navigationType: p.navigationType,
      variant: p.variant,
      orientation: p.orientation,
      quantity: Number(p.quantity),
      unitPrice: Number(p.unitPrice),
      installationPrice: Number(p.installationPrice),
      removalPrice: Number(p.removalPrice),
      productionPrice: Number(p.productionPrice),
      subtotal: Number(p.subtotal),
      internalNote: p.internalNote,
      clientNote: p.clientNote,
      status: p.status,
      carrierId: p.carrierId,
      surfaceId: p.surfaceId,
      installedPhotoId: p.installedPhotoId,
      carrierCode: p.carrier?.code || null,
      surfaceName: p.surface?.name || null,
      installedPhotoUrl: p.installedPhoto?.url || null,
    })),
    billingPeriods: o.billingPeriods.map((bp) => ({
      id: bp.id,
      dateFrom: bp.dateFrom.toISOString(),
      dateTo: bp.dateTo.toISOString(),
      amount: Number(bp.amount),
      status: bp.status,
      invoiceId: bp.invoiceId,
      invoiceNumber: bp.invoice?.invoiceNumber || null,
    })),
    auditLogs,
  };
}

export type StoredInstallationPhoto = {
  id: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  type: Extract<PhotoType, 'BEFORE_INSTALLATION' | 'AFTER_INSTALLATION'>;
  note?: string;
};

function cityFromAddress(address?: string | null) {
  const parts = address?.split(',').map((part) => part.trim()).filter(Boolean) ?? [];
  return parts.at(-1) || 'Neuvedeno';
}

export async function attachPointInstallationPhotos(
  navigationOrderId: string,
  navigationPointId: string,
  photos: StoredInstallationPhoto[],
  capturedBy: { userId: string; userName: string },
) {
  const afterPhoto = photos.find((photo) => photo.type === 'AFTER_INSTALLATION');
  if (!afterPhoto) {
    throw new NavigationServiceError('Fotografie po montáži je povinná.', 'MISSING_INSTALLATION_PHOTO');
  }

  return prisma.$transaction(async (tx) => {
    const point = await tx.navigationPoint.findUnique({
      where: { id: navigationPointId },
      include: {
        navigationOrder: {
          include: {
            crmOrder: {
              select: {
                orderNumber: true,
                clientId: true,
                offer: {
                  select: {
                    navigationOffer: {
                      select: { graphicArtworkUrl: true, clientArtworkUrl: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!point || point.navigationOrderId !== navigationOrderId || !point.navigationOrder) {
      throw new NavigationServiceError('Navigační bod nebyl nalezen.', 'NOT_FOUND');
    }

    const sourceKey = `NAVIGATION_POINT:${point.id}`;
    let carrierId = point.carrierId;
    if (!carrierId) {
      const { organizationId } = requireTenantContext();
      const carrier = await tx.advertisingCarrier.upsert({
        where: { organizationId_sourceKey: { organizationId, sourceKey } },
        update: {
          name: point.label,
          latitude: point.latitude,
          longitude: point.longitude,
          address: point.address,
        },
        create: {
          code: `NAV-${point.navigationOrder.crmOrder.orderNumber.replace(/^ZAK-/, '')}-${point.id.slice(-6).toUpperCase()}`,
          name: point.label,
          type: 'NAVIGATION',
          latitude: point.latitude,
          longitude: point.longitude,
          gpsStatus: 'UNVERIFIED',
          address: point.address,
          city: cityFromAddress(point.address || point.navigationOrder.targetAddress),
          status: 'ACTIVE',
          description: `Unikátní navigační bod realizovaný ze zakázky ${point.navigationOrder.crmOrder.orderNumber}`,
          sourceSystem: 'NAVIGATION_REALIZATION',
          sourceKey,
        },
      });
      carrierId = carrier.id;
    }

    const surfaceSourceKey = `NAVIGATION_POINT_SURFACE:${point.id}`;
    const surface = point.surfaceId
      ? await tx.advertisingSurface.findUniqueOrThrow({ where: { id: point.surfaceId } })
      : await tx.advertisingSurface.upsert({
          where: { organizationId_sourceKey: { organizationId: requireTenantContext().organizationId, sourceKey: surfaceSourceKey } },
          update: {
            carrierId,
            currentClientId: point.navigationOrder.crmOrder.clientId,
            name: point.label,
            orientation: point.orientation,
            status: 'OCCUPIED',
          },
          create: {
            carrierId,
            currentClientId: point.navigationOrder.crmOrder.clientId,
            name: point.label,
            mediaType: 'NAVIGATION_SIGN',
            sourcePosition: point.label,
            sourceKey: surfaceSourceKey,
            directionDescription: point.orientation,
            destinationName: point.navigationOrder.targetName,
            orientation: point.orientation,
            status: 'OCCUPIED',
            artworkUrl:
              point.navigationOrder.crmOrder.offer?.navigationOffer?.clientArtworkUrl
              ?? point.navigationOrder.crmOrder.offer?.navigationOffer?.graphicArtworkUrl
              ?? null,
            note: `Vzniklo realizací bodu ze zakázky ${point.navigationOrder.crmOrder.orderNumber}`,
          },
        });

    const createdPhotos = [];
    for (const stored of photos) {
      createdPhotos.push(await tx.photo.create({
        data: {
          id: stored.id || randomUUID(),
          url: `/api/photos/${stored.id}/file`,
          driveFileId: stored.driveFileId,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          size: stored.size,
          type: stored.type,
          carrierId,
          surfaceId: surface.id,
          note: stored.note || (stored.type === 'BEFORE_INSTALLATION' ? 'Stav před montáží' : 'Stav po montáži'),
          isClientVisible: stored.type === 'AFTER_INSTALLATION',
          storageProvider: 'GOOGLE_DRIVE',
          capturedByWorkerUserId: capturedBy.userId,
          capturedByWorkerName: capturedBy.userName,
        },
      }));
    }

    const installedPhoto = createdPhotos.find((photo) => photo.id === afterPhoto.id)!;

    await tx.navigationPoint.update({
      where: { id: navigationPointId },
      data: {
        carrierId,
        surfaceId: surface.id,
        installedPhotoId: installedPhoto.id,
        status: 'INSTALLED',
      },
    });

    return { photo: installedPhoto, carrierId, surfaceId: surface.id };
  });
}
