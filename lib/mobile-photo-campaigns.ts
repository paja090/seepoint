import { prisma } from '@/lib/db';
import { recoverPortalToken } from '@/lib/offers/token';

export type MobilePhotoTargetKind =
  | 'STANDARD_SURFACE'
  | 'NAVIGATION_POINT'
  | 'FIELD_POINT'
  | 'WORK_ORDER_ITEM';

export type MobilePhotoCampaignSurface = {
  targetKind: MobilePhotoTargetKind;
  itemId: string;
  surfaceId: string;
  surfaceName: string;
  side: string;
  carrierId: string;
  carrierCode: string;
  carrierName: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  isInstalled: boolean;
  installedPhotoUrl: string | null;
  crmRealizationId?: string | null;
  workOrderItemId?: string | null;
  navigationOrderId?: string | null;
  navigationPointId?: string | null;
  electionRemovalPointId?: string | null;
};

export type MobilePhotoCampaign = {
  id: string;
  sourceType: 'OFFER' | 'CRM_ORDER' | 'NAVIGATION' | 'FIELD_WORK' | 'WORK_ORDER';
  title: string;
  clientName: string;
  status: string;
  publicToken?: string | null;
  totalSurfaces: number;
  installedCount: number;
  progressPercent: number;
  surfaces: MobilePhotoCampaignSurface[];
};

function surfaceSide(surface?: { sidePosition?: string | null; sourcePosition?: string | null; name?: string | null } | null) {
  if (!surface) return 'Plocha';
  const value = `${surface.sidePosition || ''} ${surface.sourcePosition || ''}`.toUpperCase();
  if (/\b(B|SIDE_B|STRANA B|ZADN[ÍI])\b/.test(value)) return 'Strana B';
  if (/\b(A|SIDE_A|STRANA A|PŘEDN[ÍI])\b/.test(value)) return 'Strana A';
  return surface.name || 'Plocha';
}

const COMPLETED_REALIZATION_STATUSES = new Set([
  'INSTALLED',
  'PHOTOGRAPHED',
  'DELIVERED_TO_CLIENT',
  'COMPLETED',
]);

/**
 * Computes progress counters and hides campaigns that have 0 items or are 100% photographed.
 */
export function finalizeMobilePhotoCampaigns(
  raw: Array<Omit<MobilePhotoCampaign, 'totalSurfaces' | 'installedCount' | 'progressPercent'>>
): MobilePhotoCampaign[] {
  return raw
    .map((campaign) => {
      const totalSurfaces = campaign.surfaces.length;
      const installedCount = campaign.surfaces.filter((s) => s.isInstalled).length;
      return {
        ...campaign,
        totalSurfaces,
        installedCount,
        progressPercent: totalSurfaces > 0 ? Math.round((installedCount / totalSurfaces) * 100) : 0,
      };
    })
    .filter((campaign) => campaign.totalSurfaces > 0 && campaign.installedCount < campaign.totalSurfaces);
}

/**
 * Loads all active, unfinished campaigns/orders across the entire organization so any team member
 * can photograph an active job in 1 tap — even when no route (FieldPlan) is assigned to them.
 */
export async function loadMobilePhotoCampaigns(
  organizationId: string,
  options?: { navigationEnabled?: boolean; fieldEnabled?: boolean },
  db = prisma
): Promise<MobilePhotoCampaign[]> {
  const navigationEnabled = options?.navigationEnabled !== false;
  const fieldEnabled = options?.fieldEnabled !== false;

  const [offers, standaloneCrmOrders, navigationOrders, fieldCampaigns, standaloneWorkOrders] = await Promise.all([
    db.offer.findMany({
      where: {
        organizationId,
        status: { in: ['ACCEPTED', 'SENT'] },
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        campaignName: true,
        status: true,
        createdAt: true,
        sentAt: true,
        acceptedAt: true,
        publicTokenHash: true,
        publicTokenEncrypted: true,
        publicTokenRevokedAt: true,
        validUntil: true,
        client: { select: { id: true, name: true } },
        crmOrder: {
          select: {
            id: true,
            status: true,
            realizations: {
              select: {
                id: true,
                surfaceId: true,
                carrierId: true,
                status: true,
                photos: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { id: true, url: true, createdAt: true },
                },
                workOrderItem: {
                  select: {
                    id: true,
                    executionStatus: true,
                    photos: {
                      orderBy: { createdAt: 'desc' },
                      take: 1,
                      select: { id: true, url: true, createdAt: true },
                    },
                  },
                },
              },
            },
          },
        },
        items: {
          select: {
            id: true,
            dateFrom: true,
            dateTo: true,
            surface: {
              select: {
                id: true,
                name: true,
                sidePosition: true,
                sourcePosition: true,
                carrier: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    city: true,
                    street: true,
                    address: true,
                    latitude: true,
                    longitude: true,
                  },
                },
                photos: {
                  where: { type: { in: ['INSTALLATION', 'AFTER_INSTALLATION'] } },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { id: true, url: true, createdAt: true },
                },
              },
            },
          },
        },
      },
    }),

    db.crmOrder.findMany({
      where: {
        organizationId,
        offerId: null,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'DRAFT'] },
        navigationOrder: { is: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        orderNumber: true,
        title: true,
        status: true,
        createdAt: true,
        dateFrom: true,
        dateTo: true,
        client: { select: { id: true, name: true } },
        realizations: {
          select: {
            id: true,
            status: true,
            surface: {
              select: {
                id: true,
                name: true,
                sidePosition: true,
                sourcePosition: true,
                photos: {
                  where: { type: { in: ['INSTALLATION', 'AFTER_INSTALLATION'] } },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { id: true, url: true, createdAt: true },
                },
              },
            },
            carrier: {
              select: {
                id: true,
                code: true,
                name: true,
                city: true,
                street: true,
                address: true,
                latitude: true,
                longitude: true,
              },
            },
            photos: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, url: true, createdAt: true },
            },
            workOrderItem: {
              select: {
                id: true,
                executionStatus: true,
                photos: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { id: true, url: true, createdAt: true },
                },
              },
            },
          },
        },
      },
    }),

    navigationEnabled
      ? db.navigationOrder.findMany({
          where: {
            organizationId,
            status: { notIn: ['PRIPRAVENO_K_FAKTURACI', 'FAKTUROVANO', 'DOKONCENO'] },
            crmOrder: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 30,
          select: {
            id: true,
            status: true,
            targetName: true,
            targetAddress: true,
            rentStart: true,
            rentEnd: true,
            crmOrder: {
              select: {
                id: true,
                title: true,
                orderNumber: true,
                client: { select: { id: true, name: true } },
              },
            },
            points: {
              where: {
                isSelectedByClient: true,
                status: { notIn: ['CANCELLED', 'REMOVED'] },
              },
              orderBy: [{ routeOrder: 'asc' }, { sortOrder: 'asc' }],
              select: {
                id: true,
                label: true,
                address: true,
                latitude: true,
                longitude: true,
                orientation: true,
                navigationType: true,
                pillarNumber: true,
                status: true,
                carrierId: true,
                surfaceId: true,
                installedPhotoId: true,
                installedPhoto: { select: { id: true, url: true } },
                carrier: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    city: true,
                    street: true,
                    address: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),

    fieldEnabled
      ? db.electionCampaign.findMany({
          where: {
            organizationId,
            status: { notIn: ['COMPLETED', 'ARCHIVED', 'CANCELLED'] },
          },
          orderBy: { updatedAt: 'desc' },
          take: 25,
          select: {
            id: true,
            name: true,
            clientName: true,
            status: true,
            targetDate: true,
            points: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                label: true,
                description: true,
                latitude: true,
                longitude: true,
                mediaType: true,
                mediaTypeRaw: true,
                layerName: true,
                operationType: true,
                status: true,
                carrierId: true,
                surfaceId: true,
                photos: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { id: true, url: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),

    db.workOrder.findMany({
      where: {
        organizationId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        crmOrderId: null,
        navigationOrderId: null,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 30,
      select: {
        id: true,
        title: true,
        clientName: true,
        status: true,
        scheduledAt: true,
        planningConstraints: true,
        items: {
          select: {
            id: true,
            description: true,
            executionStatus: true,
            crmRealizationId: true,
            surface: {
              select: {
                id: true,
                name: true,
                sidePosition: true,
                sourcePosition: true,
              },
            },
            carrier: {
              select: {
                id: true,
                code: true,
                name: true,
                city: true,
                street: true,
                address: true,
                latitude: true,
                longitude: true,
              },
            },
            photos: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, url: true },
            },
          },
        },
      },
    }),
  ]);

  const rawCampaigns: Array<Omit<MobilePhotoCampaign, 'totalSurfaces' | 'installedCount' | 'progressPercent'>> = [];

  for (const offer of offers) {
    if (offer.crmOrder && ['CANCELLED', 'COMPLETED'].includes(offer.crmOrder.status)) {
      continue;
    }
    const baseline = offer.acceptedAt ?? offer.sentAt ?? offer.createdAt;
    const realizations = offer.crmOrder?.realizations ?? [];
    const usedRealizationIds = new Set<string>();

    const surfaces: MobilePhotoCampaignSurface[] = offer.items.map((item) => {
      const realization =
        realizations.find((r) => r.surfaceId === item.surface.id && !usedRealizationIds.has(r.id)) ??
        realizations.find((r) => r.carrierId === item.surface.carrier.id && !r.surfaceId && !usedRealizationIds.has(r.id)) ??
        null;
      if (realization) usedRealizationIds.add(realization.id);

      const realizationPhoto = realization?.photos[0] ?? realization?.workOrderItem?.photos[0] ?? null;
      const freshSurfacePhoto =
        item.surface.photos[0] && item.surface.photos[0].createdAt >= baseline ? item.surface.photos[0] : null;
      const chosenPhoto = realizationPhoto ?? freshSurfacePhoto;
      const isInstalled =
        Boolean(chosenPhoto) ||
        Boolean(realization && COMPLETED_REALIZATION_STATUSES.has(realization.status)) ||
        realization?.workOrderItem?.executionStatus === 'DONE';

      return {
        targetKind: 'STANDARD_SURFACE',
        itemId: item.id,
        surfaceId: item.surface.id,
        surfaceName: item.surface.name,
        side: surfaceSide(item.surface),
        carrierId: item.surface.carrier.id,
        carrierCode: item.surface.carrier.code,
        carrierName: item.surface.carrier.name,
        address: item.surface.carrier.address || item.surface.carrier.street || item.surface.carrier.name,
        city: item.surface.carrier.city,
        latitude: item.surface.carrier.latitude,
        longitude: item.surface.carrier.longitude,
        dateFrom: item.dateFrom ? item.dateFrom.toISOString().slice(0, 10) : null,
        dateTo: item.dateTo ? item.dateTo.toISOString().slice(0, 10) : null,
        isInstalled,
        installedPhotoUrl: chosenPhoto?.url || null,
        crmRealizationId: realization?.id ?? null,
        workOrderItemId: realization?.workOrderItem?.id ?? null,
      };
    });

    rawCampaigns.push({
      id: offer.id,
      sourceType: 'OFFER',
      title: offer.campaignName ?? offer.title,
      clientName: offer.client.name,
      status: offer.status,
      publicToken: recoverPortalToken(offer),
      surfaces,
    });
  }

  for (const order of standaloneCrmOrders) {
    const surfaces: MobilePhotoCampaignSurface[] = [];
    for (const rel of order.realizations) {
      if (!rel.carrier) continue;
      const directPhoto = rel.photos[0] ?? rel.workOrderItem?.photos[0] ?? null;
      const freshSurfacePhoto =
        rel.surface?.photos[0] && rel.surface.photos[0].createdAt >= order.createdAt ? rel.surface.photos[0] : null;
      const chosenPhoto = directPhoto ?? freshSurfacePhoto;
      const isInstalled =
        Boolean(chosenPhoto) ||
        COMPLETED_REALIZATION_STATUSES.has(rel.status) ||
        rel.workOrderItem?.executionStatus === 'DONE';

      surfaces.push({
        targetKind: 'STANDARD_SURFACE',
        itemId: rel.id,
        surfaceId: rel.surface?.id || '',
        surfaceName: rel.surface?.name || rel.carrier.name,
        side: surfaceSide(rel.surface),
        carrierId: rel.carrier.id,
        carrierCode: rel.carrier.code,
        carrierName: rel.carrier.name,
        address: rel.carrier.address || rel.carrier.street || rel.carrier.name,
        city: rel.carrier.city,
        latitude: rel.carrier.latitude,
        longitude: rel.carrier.longitude,
        dateFrom: order.dateFrom ? order.dateFrom.toISOString().slice(0, 10) : null,
        dateTo: order.dateTo ? order.dateTo.toISOString().slice(0, 10) : null,
        isInstalled,
        installedPhotoUrl: chosenPhoto?.url || null,
        crmRealizationId: rel.id,
        workOrderItemId: rel.workOrderItem?.id ?? null,
      });
    }
    rawCampaigns.push({
      id: `crm-${order.id}`,
      sourceType: 'CRM_ORDER',
      title: order.title || order.orderNumber,
      clientName: order.client.name,
      status: order.status,
      surfaces,
    });
  }

  for (const nav of navigationOrders) {
    const surfaces: MobilePhotoCampaignSurface[] = nav.points.map((pt, idx) => {
      const isInstalled = pt.status === 'INSTALLED' || Boolean(pt.installedPhotoId);
      return {
        targetKind: 'NAVIGATION_POINT',
        itemId: pt.id,
        surfaceId: pt.surfaceId || pt.id,
        surfaceName: pt.label || `Navigační bod ${idx + 1}`,
        side: pt.orientation || pt.navigationType || 'Navigace',
        carrierId: pt.carrierId || '',
        carrierCode: pt.carrier?.code || pt.pillarNumber || `NAV-${idx + 1}`,
        carrierName: pt.label || nav.targetName,
        address: pt.address || pt.carrier?.address || pt.carrier?.street || nav.targetAddress || nav.targetName,
        city: pt.carrier?.city || '',
        latitude: pt.latitude,
        longitude: pt.longitude,
        dateFrom: nav.rentStart ? nav.rentStart.toISOString().slice(0, 10) : null,
        dateTo: nav.rentEnd ? nav.rentEnd.toISOString().slice(0, 10) : null,
        isInstalled,
        installedPhotoUrl: pt.installedPhoto?.url || null,
        navigationOrderId: nav.id,
        navigationPointId: pt.id,
      };
    });

    rawCampaigns.push({
      id: `nav-${nav.id}`,
      sourceType: 'NAVIGATION',
      title: nav.crmOrder.title || `Navigace: ${nav.targetName}`,
      clientName: nav.crmOrder.client.name,
      status: nav.status,
      surfaces,
    });
  }

  for (const camp of fieldCampaigns) {
    const surfaces: MobilePhotoCampaignSurface[] = camp.points.map((pt, idx) => {
      const isInstalled = pt.status === 'COMPLETED' || pt.photos.length > 0;
      return {
        targetKind: 'FIELD_POINT',
        itemId: pt.id,
        surfaceId: pt.surfaceId || pt.id,
        surfaceName: pt.label,
        side: pt.operationType || pt.layerName || 'Terénní práce',
        carrierId: pt.carrierId || '',
        carrierCode: pt.mediaTypeRaw || pt.mediaType || `BOD-${idx + 1}`,
        carrierName: pt.label,
        address: pt.description || pt.label,
        city: '',
        latitude: pt.latitude,
        longitude: pt.longitude,
        dateFrom: camp.targetDate ? camp.targetDate.toISOString().slice(0, 10) : null,
        dateTo: null,
        isInstalled,
        installedPhotoUrl: pt.photos[0]?.url || null,
        electionRemovalPointId: pt.id,
      };
    });

    rawCampaigns.push({
      id: `field-${camp.id}`,
      sourceType: 'FIELD_WORK',
      title: camp.name,
      clientName: camp.clientName || 'Terénní práce',
      status: camp.status,
      surfaces,
    });
  }

  for (const wo of standaloneWorkOrders) {
    const pcMeta =
      wo.planningConstraints && typeof wo.planningConstraints === 'object' && !Array.isArray(wo.planningConstraints)
        ? (wo.planningConstraints as Record<string, unknown>)
        : null;
    if (pcMeta?.dispatchCampaign === true) continue;

    const carrierItems = wo.items.filter((item) => item.carrier && !item.crmRealizationId);
    if (carrierItems.length === 0) continue;

    const surfaces: MobilePhotoCampaignSurface[] = carrierItems.map((item) => {
      const carrier = item.carrier!;
      const photo = item.photos[0] ?? null;
      const isInstalled = item.executionStatus === 'DONE' || Boolean(photo);
      return {
        targetKind: 'WORK_ORDER_ITEM',
        itemId: item.id,
        surfaceId: item.surface?.id || '',
        surfaceName: item.surface?.name || item.description || carrier.name,
        side: surfaceSide(item.surface),
        carrierId: carrier.id,
        carrierCode: carrier.code,
        carrierName: carrier.name,
        address: carrier.address || carrier.street || carrier.name,
        city: carrier.city,
        latitude: carrier.latitude,
        longitude: carrier.longitude,
        dateFrom: wo.scheduledAt ? wo.scheduledAt.toISOString().slice(0, 10) : null,
        dateTo: null,
        isInstalled,
        installedPhotoUrl: photo?.url || null,
        workOrderItemId: item.id,
      };
    });

    rawCampaigns.push({
      id: `wo-${wo.id}`,
      sourceType: 'WORK_ORDER',
      title: wo.title,
      clientName: wo.clientName || 'Interní zakázka',
      status: wo.status,
      surfaces,
    });
  }

  return finalizeMobilePhotoCampaigns(rawCampaigns);
}
