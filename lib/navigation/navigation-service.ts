import { Prisma, PhotoType } from '@prisma/client';
import { prisma } from '../db.ts';
import type { CurrentUser } from '../rbac.ts';
import { NavigationOrderDetail, NavigationPointItem } from './types.ts';
import { nextCrmOrderNumber } from '../crm/domain.ts';

export class NavigationServiceError extends Error {
  code: string;

  constructor(message: string, code = 'NAVIGATION_ERROR') {
    super(message);
    this.name = 'NavigationServiceError';
    this.code = code;
  }
}

export async function convertOfferToNavigationOrder(
  offerId: string,
  actorUser: CurrentUser
) {
  return prisma.$transaction(async (tx) => {
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

    // Přenést navigační body nabídky do zakázky
    if (navData?.points && navData.points.length > 0) {
      for (const p of navData.points) {
        await tx.navigationPoint.create({
          data: {
            navigationOrderId: navOrder.id,
            carrierId: p.carrierId,
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
  });
}

export async function listNavigationOrders(user: CurrentUser, filters: { query?: string; status?: string; clientId?: string }) {
  const where: Prisma.NavigationOrderWhereInput = {};

  if (filters.status) {
    where.status = filters.status as any;
  }

  if (filters.clientId) {
    where.crmOrder = { clientId: filters.clientId };
  }

  // RBAC for SALES role: only view own or assigned orders
  if (user.role === 'SALES') {
    where.crmOrder = {
      ...(where.crmOrder || {}),
      OR: [
        { assignedUserId: user.id },
        { offer: { createdByUserId: user.id } },
      ],
    };
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
      points: true,
      billingPeriods: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((o) => ({
    id: o.id,
    crmOrderId: o.crmOrderId,
    orderNumber: o.crmOrder.orderNumber,
    title: o.crmOrder.title,
    clientId: o.crmOrder.clientId,
    clientName: o.crmOrder.client.name,
    assignedUserName: o.crmOrder.assignedUser?.name || null,
    status: o.status,
    blockStatus: o.blockStatus,
    targetName: o.targetName,
    targetAddress: o.targetAddress,
    targetLatitude: o.targetLatitude,
    targetLongitude: o.targetLongitude,
    totalPrice: Number(o.crmOrder.totalPrice ?? 0),
    pointsCount: o.points.length,
    createdAt: o.createdAt.toISOString(),
  }));
}

export async function getNavigationOrderDetail(id: string, user: CurrentUser): Promise<NavigationOrderDetail> {
  const o = await prisma.navigationOrder.findUnique({
    where: { id },
    include: {
      crmOrder: {
        include: {
          client: { select: { id: true, name: true, email: true, phone: true, contactPerson: true } },
          contact: { select: { id: true, name: true, email: true, phone: true } },
          assignedUser: { select: { id: true, name: true } },
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

  // RBAC Check for SALES role
  if (user.role === 'SALES' && o.crmOrder.assignedUserId !== user.id) {
    const isOfferOwner = o.crmOrder.offerId
      ? Boolean(await prisma.offer.findFirst({ where: { id: o.crmOrder.offerId, createdByUserId: user.id } }))
      : false;
    if (!isOfferOwner) {
      throw new NavigationServiceError('K této navigační zakázce nemáte přístup.', 'FORBIDDEN');
    }
  }

  return {
    id: o.id,
    crmOrderId: o.crmOrderId,
    orderNumber: o.crmOrder.orderNumber,
    title: o.crmOrder.title,
    clientId: o.crmOrder.clientId,
    clientName: o.crmOrder.client.name,
    contactPerson: o.crmOrder.contact?.name || o.crmOrder.client.contactPerson || null,
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
  };
}

export async function attachPointInstallationPhoto(
  navigationPointId: string,
  photoUrl: string,
  photoType: PhotoType = 'AFTER_INSTALLATION',
  note?: string
) {
  return prisma.$transaction(async (tx) => {
    const point = await tx.navigationPoint.findUnique({
      where: { id: navigationPointId },
      select: { id: true, carrierId: true, surfaceId: true },
    });

    if (!point) {
      throw new NavigationServiceError('Navigační bod nebyl nalezen.', 'NOT_FOUND');
    }

    // Vytvoříme jediný fotografický záznam s vazbami na nosič I plochu
    const photo = await tx.photo.create({
      data: {
        url: photoUrl,
        type: photoType,
        carrierId: point.carrierId || null,
        surfaceId: point.surfaceId || null,
        note: note || 'Fotografie z montáže navigačního bodu',
        isClientVisible: true,
      },
    });

    // Propojíme fotografii s bodem
    await tx.navigationPoint.update({
      where: { id: navigationPointId },
      data: {
        installedPhotoId: photo.id,
        status: 'INSTALLED',
      },
    });

    return photo;
  });
}
