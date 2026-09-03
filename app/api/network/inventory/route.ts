import { NextResponse } from 'next/server';
import { MediaType } from '@prisma/client';
import type { InventoryVisibility, Prisma } from '@prisma/client';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { platformPrisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  const organizationId = auth.organizationId;
  if (!organizationId) return NextResponse.json({ success: false, error: 'Aktivní organizace není vybrána.' }, { status: 403 });
  const url = new URL(req.url);
  const city = url.searchParams.get('city')?.trim();
  const requestedMediaType = url.searchParams.get('mediaType')?.trim();
  const requestedVisibility = url.searchParams.get('visibility')?.trim();
  const networkVisibilities: InventoryVisibility[] = ['PARTNER', 'SHARED', 'MARKETPLACE'];
  const ownVisibility = networkVisibilities.includes(requestedVisibility as InventoryVisibility)
    ? requestedVisibility as InventoryVisibility
    : { in: networkVisibilities };
  const mediaType = Object.values(MediaType).includes(requestedMediaType as MediaType)
    ? requestedMediaType as MediaType
    : undefined;

  try {
    const where: Prisma.AdvertisingCarrierWhereInput = {
      status: 'ACTIVE',
      OR: [
        { organizationId, visibility: ownVisibility },
        // Until persistent partnerships exist, another tenant may expose inventory
        // only through the explicit platform-wide MARKETPLACE visibility.
        { organizationId: { not: organizationId }, visibility: 'MARKETPLACE' },
      ],
    };

    if (city && city !== 'ALL') {
      where.city = { contains: city, mode: 'insensitive' };
    }

    const carriers = await platformPrisma.advertisingCarrier.findMany({
      where,
      include: {
        surfaces: {
          where: {
            status: 'AVAILABLE',
            OR: [
              { organizationId, visibility: ownVisibility },
              { organizationId: { not: organizationId }, visibility: 'MARKETPLACE' },
            ],
            ...(mediaType ? { mediaType } : {}),
          },
          select: {
            id: true,
            name: true,
            mediaType: true,
            size: true,
            orientation: true,
            status: true,
            price: true,
          },
        },
        photos: {
          where: { type: { not: 'EXPENSE_RECEIPT' }, isPrivate: false, isClientVisible: true },
          select: { id: true, url: true, note: true },
          take: 2,
        },
      },
      take: 60,
      orderBy: { updatedAt: 'desc' },
    });

    const items = carriers.flatMap((carrier) => {
      const isOwn = carrier.organizationId === organizationId;
      const ownerLabel = isOwn ? 'Moje firma' : 'B2B Partner';
      const b2bDiscount = 0;

      return carrier.surfaces.map((surface) => {
        const listPrice = surface.price ? Number(surface.price) : 0;
        const b2bWholesalePrice = listPrice;

        return {
          id: surface.id,
          carrierId: carrier.id,
          carrierCode: carrier.code,
          carrierName: carrier.name,
          city: carrier.city,
          street: carrier.street,
          locality: carrier.locality,
          latitude: carrier.latitude,
          longitude: carrier.longitude,
          surfaceName: surface.name,
          mediaType: surface.mediaType,
          size: surface.size || '5,1 × 2,4 m',
          orientation: surface.orientation || 'Strana A',
          listPrice,
          b2bWholesalePrice,
          b2bDiscountPercent: b2bDiscount,
          visibility: carrier.visibility,
          isOwn,
          ownerLabel,
          thumbnailUrl: carrier.photos[0]?.url || '/offer/hero-campaign.png',
        };
      });
    });

    return NextResponse.json({
      success: true,
      totalCount: items.length,
      items,
    });
  } catch (error: unknown) {
    console.error('[api/network/inventory]', error);
    return NextResponse.json({ success: false, error: 'Nepodařilo se načíst partnerský inventář.' }, { status: 500 });
  }
}
