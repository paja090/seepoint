import { NextResponse } from 'next/server';
import { InventoryVisibility, MediaType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ALLOWED_VISIBILITIES: InventoryVisibility[] = [
  InventoryVisibility.PRIVATE,
  InventoryVisibility.PARTNER,
  InventoryVisibility.SHARED,
  InventoryVisibility.MARKETPLACE,
];

function isAllowedVisibility(value: unknown): value is InventoryVisibility {
  return typeof value === 'string' && ALLOWED_VISIBILITIES.includes(value as InventoryVisibility);
}

export async function GET() {
  const auth = await requireApiAccess('offers', 'network');
  if (isApiDenied(auth)) return auth;

  const organizationId = auth.organizationId;
  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'Aktivní organizace není vybrána.' }, { status: 403 });
  }

  try {
    const [surfaceGroups, availableGroups, ownCarriers, organization] = await Promise.all([
      prisma.advertisingSurface.groupBy({
        by: ['visibility'],
        where: {
          organizationId,
          status: { not: 'OUT_OF_SERVICE' },
          carrier: { archivedAt: null, status: 'ACTIVE' },
        },
        _count: { _all: true },
      }),
      prisma.advertisingSurface.groupBy({
        by: ['visibility'],
        where: {
          organizationId,
          status: 'AVAILABLE',
          carrier: { archivedAt: null, status: 'ACTIVE' },
        },
        _count: { _all: true },
      }),
      prisma.advertisingCarrier.findMany({
        where: {
          organizationId,
          archivedAt: null,
          status: 'ACTIVE',
        },
        include: {
          surfaces: {
            where: {
              organizationId,
              status: { not: 'OUT_OF_SERVICE' },
            },
            select: {
              id: true,
              name: true,
              mediaType: true,
              size: true,
              orientation: true,
              status: true,
              price: true,
              visibility: true,
            },
            orderBy: { name: 'asc' },
          },
        },
        take: 100,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.organization.findFirst({
        where: { id: organizationId },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    const counts: Record<InventoryVisibility, number> = {
      PRIVATE: 0,
      PARTNER: 0,
      SHARED: 0,
      MARKETPLACE: 0,
    };

    const availableByVisibility: Record<InventoryVisibility, number> = {
      PRIVATE: 0,
      PARTNER: 0,
      SHARED: 0,
      MARKETPLACE: 0,
    };

    for (const row of surfaceGroups) {
      counts[row.visibility] = row._count._all;
    }

    for (const row of availableGroups) {
      availableByVisibility[row.visibility] = row._count._all;
    }

    const totalActiveSurfaces = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const totalAvailableSurfaces = Object.values(availableByVisibility).reduce((sum, n) => sum + n, 0);

    const ownSurfaces = ownCarriers.flatMap((carrier) =>
      carrier.surfaces.map((surface) => ({
        id: surface.id,
        carrierId: carrier.id,
        carrierCode: carrier.code,
        carrierName: carrier.name,
        city: carrier.city,
        street: carrier.street,
        latitude: carrier.latitude !== null ? Number(carrier.latitude) : null,
        longitude: carrier.longitude !== null ? Number(carrier.longitude) : null,
        surfaceName: surface.name,
        mediaType: surface.mediaType,
        size: surface.size || '5,1 × 2,4 m',
        orientation: surface.orientation || 'Strana A',
        status: surface.status,
        listPrice: surface.price ? Number(surface.price) : 0,
        visibility: surface.visibility,
        carrierVisibility: carrier.visibility,
      }))
    );

    return NextResponse.json({
      success: true,
      canManage: auth.role === 'ADMIN' || auth.role === 'MANAGER',
      organization: organization || { id: organizationId, name: 'Moje organizace', slug: organizationId },
      counts: {
        ...counts,
        totalActiveSurfaces,
        totalAvailableSurfaces,
        availablePrivateSurfaces: availableByVisibility.PRIVATE,
        availablePublishedSurfaces:
          availableByVisibility.PARTNER + availableByVisibility.SHARED + availableByVisibility.MARKETPLACE,
      },
      ownSurfaces,
    });
  } catch (error: unknown) {
    console.error('[api/network/visibility GET]', error);
    return NextResponse.json(
      { success: false, error: 'Nepodařilo se načíst stav B2B publikování ploch.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAccess('offers', 'network');
  if (isApiDenied(auth)) return auth;

  const organizationId = auth.organizationId;
  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'Aktivní organizace není vybrána.' }, { status: 403 });
  }

  if (auth.role !== 'ADMIN' && auth.role !== 'MANAGER') {
    return NextResponse.json(
      { success: false, error: 'Publikovat plochy do B2B sítě může pouze administrátor nebo manažer organizace.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const action = typeof body.action === 'string' ? body.action : '';
    const visibility = body.visibility;

    if (!isAllowedVisibility(visibility)) {
      return NextResponse.json(
        { success: false, error: 'Neplatný režim viditelnosti plochy.' },
        { status: 400 }
      );
    }

    if (action === 'SET_SURFACE_VISIBILITY') {
      const surfaceId = typeof body.surfaceId === 'string' ? body.surfaceId.trim() : '';
      if (!surfaceId) {
        return NextResponse.json({ success: false, error: 'Chybí ID reklamní plochy.' }, { status: 400 });
      }

      const existingSurface = await prisma.advertisingSurface.findFirst({
        where: { id: surfaceId, organizationId },
        select: { id: true, carrierId: true, name: true },
      });

      if (!existingSurface) {
        return NextResponse.json({ success: false, error: 'Plocha nebyla nalezena ve vaší organizaci.' }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.advertisingSurface.update({
          where: { id: existingSurface.id },
          data: { visibility },
        });

        if (visibility !== InventoryVisibility.PRIVATE) {
          await tx.advertisingCarrier.update({
            where: { id: existingSurface.carrierId },
            data: { visibility },
          });
        } else {
          const remainingPublishedCount = await tx.advertisingSurface.count({
            where: {
              carrierId: existingSurface.carrierId,
              organizationId,
              visibility: { not: InventoryVisibility.PRIVATE },
            },
          });
          if (remainingPublishedCount === 0) {
            await tx.advertisingCarrier.update({
              where: { id: existingSurface.carrierId },
              data: { visibility: InventoryVisibility.PRIVATE },
            });
          }
        }
      });

      const labelMap: Record<InventoryVisibility, string> = {
        PRIVATE: 'Soukromá (skryto z B2B sítě)',
        PARTNER: 'Pro B2B partnery (PARTNER)',
        SHARED: 'Sdílená v síti (SHARED)',
        MARKETPLACE: 'Veřejná B2B Burza (MARKETPLACE)',
      };

      return NextResponse.json({
        success: true,
        visibility,
        message: `Viditelnost plochy byla změněna na: ${labelMap[visibility]}.`,
      });
    }

    if (action === 'BULK_SET_VISIBILITY') {
      const city = typeof body.city === 'string' && body.city !== 'ALL' ? body.city.trim() : undefined;
      const requestedMediaType = typeof body.mediaType === 'string' ? body.mediaType.trim() : undefined;
      const mediaType = Object.values(MediaType).includes(requestedMediaType as MediaType)
        ? (requestedMediaType as MediaType)
        : undefined;
      const onlyAvailable = body.onlyAvailable !== false;

      const carrierWhere: Prisma.AdvertisingCarrierWhereInput = {
        organizationId,
        archivedAt: null,
        status: 'ACTIVE',
        ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
      };

      const matchingCarriers = await prisma.advertisingCarrier.findMany({
        where: carrierWhere,
        select: { id: true },
      });
      const carrierIds = matchingCarriers.map((c) => c.id);

      if (carrierIds.length === 0) {
        return NextResponse.json({
          success: true,
          updatedSurfaces: 0,
          message: 'Pro zvolené filtry nebyly nalezeny žádné aktivní nosiče.',
        });
      }

      const surfaceWhere: Prisma.AdvertisingSurfaceWhereInput = {
        organizationId,
        carrierId: { in: carrierIds },
        ...(onlyAvailable && visibility !== InventoryVisibility.PRIVATE
          ? { status: 'AVAILABLE' }
          : { status: { not: 'OUT_OF_SERVICE' } }),
        ...(mediaType ? { mediaType } : {}),
      };

      const matchingSurfaces = await prisma.advertisingSurface.findMany({
        where: surfaceWhere,
        select: { id: true, carrierId: true },
      });

      if (matchingSurfaces.length === 0) {
        return NextResponse.json({
          success: true,
          updatedSurfaces: 0,
          message: 'Žádné odpovídající plochy k hromadné změně viditelnosti.',
        });
      }

      const affectedCarrierIds = Array.from(new Set(matchingSurfaces.map((s) => s.carrierId)));

      await prisma.$transaction(async (tx) => {
        await tx.advertisingSurface.updateMany({
          where: {
            id: { in: matchingSurfaces.map((s) => s.id) },
            organizationId,
          },
          data: { visibility },
        });

        if (visibility !== InventoryVisibility.PRIVATE) {
          await tx.advertisingCarrier.updateMany({
            where: {
              id: { in: affectedCarrierIds },
              organizationId,
            },
            data: { visibility },
          });
        } else {
          for (const carrierId of affectedCarrierIds) {
            const remaining = await tx.advertisingSurface.count({
              where: {
                carrierId,
                organizationId,
                visibility: { not: InventoryVisibility.PRIVATE },
              },
            });
            if (remaining === 0) {
              await tx.advertisingCarrier.update({
                where: { id: carrierId },
                data: { visibility: InventoryVisibility.PRIVATE },
              });
            }
          }
        }
      });

      const modeText =
        visibility === InventoryVisibility.MARKETPLACE
          ? 'zveřejněno do B2B Burzy (MARKETPLACE)'
          : visibility === InventoryVisibility.PARTNER
          ? 'zpřístupněno pro B2B partnery (PARTNER)'
          : 'skryto do interního režimu (PRIVATE)';

      return NextResponse.json({
        success: true,
        updatedSurfaces: matchingSurfaces.length,
        visibility,
        message: `Hromadná změna dokončena: ${matchingSurfaces.length} ploch bylo ${modeText}.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Nepodporovaná akce.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[api/network/visibility POST]', error);
    return NextResponse.json(
      { success: false, error: 'Nepodařilo se uložit změnu B2B viditelnosti.' },
      { status: 500 }
    );
  }
}
