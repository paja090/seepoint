import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enterTenantContext } from '@/lib/tenant-context';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import type { ElectionRemovalMediaType } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type SystemSurfaceCategory =
  | 'NAVIGATION'
  | 'BENCH'
  | 'BILLBOARD'
  | 'CITYLIGHT'
  | 'BANNER'
  | 'OTHER';

export interface SystemSurfaceItem {
  id: string;
  carrierId: string | null;
  surfaceId: string | null;
  code: string;
  label: string;
  city: string;
  street: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  clientId: string | null;
  clientName: string;
  isOccupied: boolean;
  category: SystemSurfaceCategory;
  categoryLabel: string;
  mediaType: ElectionRemovalMediaType;
  objectType: string;
  dimensions: string | null;
  sideLabel: string | null;
  motif: string | null;
}

function resolveCategoryAndMedia(
  carrierType: string,
  surfaceMediaType?: string | null,
  carrierCode?: string | null,
  customTypeName?: string | null
): {
  category: SystemSurfaceCategory;
  mediaType: ElectionRemovalMediaType;
  categoryLabel: string;
} {
  const upperCarrier = (carrierType || '').toUpperCase();
  const upperSurface = (surfaceMediaType || '').toUpperCase();
  const upperCode = (carrierCode || '').toUpperCase();
  const customLower = (customTypeName || '').toLowerCase();

  if (
    upperCarrier === 'NAVIGATION' ||
    upperSurface === 'NAVIGATION_SIGN' ||
    upperSurface === 'NAVIGATION' ||
    upperCode.startsWith('VO-') ||
    customLower.includes('navigac')
  ) {
    return {
      category: 'NAVIGATION',
      mediaType: 'CITY_POSTER',
      categoryLabel: customTypeName || 'Navigační reklama (VO)',
    };
  }

  if (
    upperCarrier === 'PROMO_BENCH' ||
    upperSurface === 'PROMO_BENCH' ||
    upperCarrier === 'BENCH' ||
    upperSurface === 'BENCH' ||
    customLower.includes('lavič') ||
    customLower.includes('lavic')
  ) {
    return {
      category: 'BENCH',
      mediaType: 'BENCH',
      categoryLabel: customTypeName || 'Lavička',
    };
  }

  if (
    ['BILLBOARD', 'BIGBOARD', 'MEGABOARD', 'PROMO_TOWER', 'PROMO_MINITOWER'].includes(upperCarrier) ||
    ['BILLBOARD', 'BIGBOARD', 'MEGABOARD', 'PROMO_TOWER', 'PROMO_MINITOWER'].includes(upperSurface) ||
    customLower.includes('billboard') ||
    customLower.includes('bigboard')
  ) {
    return {
      category: 'BILLBOARD',
      mediaType: upperCarrier === 'PROMO_MINITOWER' ? 'MINI_TOWER' : 'TOWER',
      categoryLabel: customTypeName || 'Billboard / Bigboard',
    };
  }

  if (
    upperCarrier === 'CITYLIGHT' ||
    upperSurface === 'CITYLIGHT' ||
    upperCarrier === 'CITY_POSTER' ||
    upperSurface === 'CITY_POSTER' ||
    customLower.includes('citylight') ||
    customLower.includes('clv')
  ) {
    return {
      category: 'CITYLIGHT',
      mediaType: 'CITY_POSTER',
      categoryLabel: customTypeName || 'Citylight (CLV)',
    };
  }

  if (
    ['BANNER', 'FACADE', 'PROMO_HORIZON'].includes(upperCarrier) ||
    ['BANNER', 'FACADE', 'PROMO_HORIZON'].includes(upperSurface) ||
    customLower.includes('banner') ||
    customLower.includes('placht') ||
    customLower.includes('plot')
  ) {
    return {
      category: 'BANNER',
      mediaType: 'BANNER',
      categoryLabel: customTypeName || 'Banner / Plachta',
    };
  }

  return {
    category: 'OTHER',
    mediaType: 'OTHER',
    categoryLabel: customTypeName || 'Reklamní plocha',
  };
}

/**
 * GET /api/election-removal/system-surfaces
 * Vrací všechny evidované plochy a nosiče s platnou GPS v systému,
 * rozdělené podle klientů a typů nosičů pro rychlé sestavení trasy (např. Kontrola / Focení).
 */
export async function GET() {
  const auth = await requireElectionRemovalAccess(true);
  if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({
    organizationId: auth.organizationId,
    userId: auth.user.id,
    source: 'session',
  });

  try {
    const carriers = await prisma.advertisingCarrier.findMany({
        where: {
          organizationId: auth.organizationId,
          archivedAt: null,
          latitude: { not: null },
          longitude: { not: null },
        },
        include: {
          carrierTypeRef: { select: { name: true } },
          navigationPoints: {
            select: {
              id: true,
              label: true,
              navigationOrder: {
                select: {
                  targetName: true,
                  crmOrder: {
                    select: {
                      clientId: true,
                      client: { select: { id: true, name: true } },
                    },
                  },
                },
              },
              navigationOffer: {
                select: {
                  targetName: true,
                  offer: {
                    select: {
                      clientId: true,
                      client: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
            take: 1,
          },
          surfaces: {
            include: {
              currentClient: { select: { id: true, name: true } },
              carrierTypeRef: { select: { name: true } },
              occupancies: {
                orderBy: { dateTo: 'desc' },
                take: 1,
                select: {
                  clientId: true,
                  clientName: true,
                  campaignName: true,
                  status: true,
                  client: { select: { id: true, name: true } },
                },
              },
              navigationPoints: {
                select: {
                  id: true,
                  label: true,
                  navigationOrder: {
                    select: {
                      targetName: true,
                      crmOrder: {
                        select: {
                          clientId: true,
                          client: { select: { id: true, name: true } },
                        },
                      },
                    },
                  },
                  navigationOffer: {
                    select: {
                      targetName: true,
                      offer: {
                        select: {
                          clientId: true,
                          client: { select: { id: true, name: true } },
                        },
                      },
                    },
                  },
                },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ city: 'asc' }, { code: 'asc' }],
    });

    const standaloneNavPoints = await prisma.navigationPoint.findMany({
      where: {
        organizationId: auth.organizationId,
        carrierId: null,
      },
      include: {
        navigationOrder: {
          select: {
            id: true,
            targetName: true,
            targetAddress: true,
            crmOrder: {
              select: {
                orderNumber: true,
                clientId: true,
                client: { select: { id: true, name: true } },
              },
            },
          },
        },
        navigationOffer: {
          select: {
            city: true,
            targetName: true,
            targetAddress: true,
            offer: {
              select: {
                clientId: true,
                client: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const surfaces: SystemSurfaceItem[] = [];
    const citySet = new Set<string>();

    for (const c of carriers) {
      if (c.latitude == null || c.longitude == null) continue;
      const city = c.city?.trim() || 'Nezadáno';
      citySet.add(city);

      const carrierNavPt = c.navigationPoints[0];
      const carrierNavOrder = carrierNavPt?.navigationOrder;
      const carrierNavOffer = carrierNavPt?.navigationOffer;
      const street = c.street || c.address || c.locality || null;
      const carrierAddress = [c.street || c.address, c.locality].filter(Boolean).join(', ') || null;

      if (c.surfaces.length === 0) {
        const clientName =
          carrierNavOrder?.crmOrder?.client?.name?.trim() ||
          carrierNavOffer?.offer?.client?.name?.trim() ||
          carrierNavOrder?.targetName?.trim() ||
          carrierNavOffer?.targetName?.trim() ||
          'Neobsazené / Vlastní plochy';

        const clientId =
          carrierNavOrder?.crmOrder?.client?.id ||
          carrierNavOrder?.crmOrder?.clientId ||
          carrierNavOffer?.offer?.client?.id ||
          carrierNavOffer?.offer?.clientId ||
          null;

        const isOccupied = clientName !== 'Neobsazené / Vlastní plochy';
        const meta = resolveCategoryAndMedia(
          c.type,
          null,
          c.code,
          c.carrierTypeRef?.name
        );

        surfaces.push({
          id: `carrier:${c.id}`,
          carrierId: c.id,
          surfaceId: null,
          code: c.code,
          label: c.name && c.name !== c.code ? `${c.code} — ${c.name}` : c.code,
          city,
          street,
          address: carrierAddress,
          latitude: c.latitude,
          longitude: c.longitude,
          clientId,
          clientName,
          isOccupied,
          category: meta.category,
          categoryLabel: meta.categoryLabel,
          mediaType: meta.mediaType,
          objectType: meta.categoryLabel,
          dimensions: null,
          sideLabel: null,
          motif: c.note || null,
        });
      } else {
        for (const s of c.surfaces) {
          const activeOcc = s.occupancies[0];
          const surfNavPt = s.navigationPoints[0] || carrierNavPt;
          const surfNavOrder = surfNavPt?.navigationOrder;
          const surfNavOffer = surfNavPt?.navigationOffer;

          const resolvedClientName =
            activeOcc?.client?.name?.trim() ||
            activeOcc?.clientName?.trim() ||
            s.currentClient?.name?.trim() ||
            surfNavOrder?.crmOrder?.client?.name?.trim() ||
            surfNavOffer?.offer?.client?.name?.trim() ||
            surfNavOrder?.targetName?.trim() ||
            surfNavOffer?.targetName?.trim() ||
            (s.destinationName ? s.destinationName.trim() : null) ||
            'Neobsazené / Vlastní plochy';

          const resolvedClientId =
            activeOcc?.client?.id ||
            activeOcc?.clientId ||
            s.currentClient?.id ||
            surfNavOrder?.crmOrder?.client?.id ||
            surfNavOrder?.crmOrder?.clientId ||
            surfNavOffer?.offer?.client?.id ||
            surfNavOffer?.offer?.clientId ||
            null;

          const isOccupied = resolvedClientName !== 'Neobsazené / Vlastní plochy';
          const meta = resolveCategoryAndMedia(
            c.type,
            s.mediaType,
            c.code,
            s.carrierTypeRef?.name || c.carrierTypeRef?.name
          );

          const baseTitle =
            c.name && c.name !== c.code ? `${c.code} — ${c.name}` : c.code;
          const surfaceSuffix =
            c.surfaces.length > 1 && s.name && s.name !== c.name
              ? ` (${s.name})`
              : '';

          surfaces.push({
            id: `surface:${s.id}`,
            carrierId: c.id,
            surfaceId: s.id,
            code: c.code,
            label: `${baseTitle}${surfaceSuffix}`,
            city,
            street: street || s.directionDescription || null,
            address:
              carrierAddress ||
              s.directionDescription ||
              s.destinationName ||
              null,
            latitude: c.latitude,
            longitude: c.longitude,
            clientId: resolvedClientId,
            clientName: resolvedClientName,
            isOccupied,
            category: meta.category,
            categoryLabel: meta.categoryLabel,
            mediaType: meta.mediaType,
            objectType: meta.categoryLabel,
            dimensions: s.size || null,
            sideLabel: s.sidePosition || s.orientation || (c.surfaces.length > 1 ? s.name : null),
            motif: activeOcc?.campaignName || s.destinationName || s.note || null,
          });
        }
      }
    }

    // Add standalone navigation points that do not have a carrierId yet
    for (const np of standaloneNavPoints) {
      if (!Number.isFinite(np.latitude) || !Number.isFinite(np.longitude)) continue;
      const clientName =
        np.navigationOrder?.crmOrder?.client?.name?.trim() ||
        np.navigationOffer?.offer?.client?.name?.trim() ||
        np.navigationOrder?.targetName?.trim() ||
        np.navigationOffer?.targetName?.trim() ||
        'Navigační reklama (bez klienta)';
      const clientId =
        np.navigationOrder?.crmOrder?.client?.id ||
        np.navigationOrder?.crmOrder?.clientId ||
        np.navigationOffer?.offer?.client?.id ||
        np.navigationOffer?.offer?.clientId ||
        null;

      const city = np.navigationOffer?.city?.trim() || 'Ostrava';
      citySet.add(city);

      surfaces.push({
        id: `navpoint:${np.id}`,
        carrierId: null,
        surfaceId: null,
        code: np.label || np.navigationOrder?.crmOrder?.orderNumber || 'VO',
        label: np.label || `Navigace ${np.id.slice(-4)}`,
        city,
        street: np.address || np.navigationOrder?.targetAddress || np.navigationOffer?.targetAddress || null,
        address: np.address || np.navigationOrder?.targetAddress || np.navigationOffer?.targetAddress || null,
        latitude: np.latitude,
        longitude: np.longitude,
        clientId,
        clientName,
        isOccupied: true,
        category: 'NAVIGATION',
        categoryLabel: 'Navigační reklama (VO)',
        mediaType: 'CITY_POSTER',
        objectType: 'Navigační reklama (VO)',
        dimensions: np.variant || null,
        sideLabel: np.orientation || null,
        motif: np.navigationOrder?.targetName || np.navigationOffer?.targetName || np.clientNote || null,
      });
    }

    const cities = Array.from(citySet).sort((a, b) => a.localeCompare(b, 'cs'));

    return NextResponse.json({
      success: true,
      surfaces,
      cities,
    });
  } catch (error) {
    console.error('Chyba při načítání systémových ploch pro terénní práce:', error);
    return NextResponse.json(
      { error: 'Nepodařilo se načíst plochy ze systému.' },
      { status: 500 }
    );
  }
}
