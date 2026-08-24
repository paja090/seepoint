import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { platformPrisma } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  const { organizationId } = requireTenantContext();
  const url = new URL(req.url);
  const city = url.searchParams.get('city')?.trim();
  const mediaType = url.searchParams.get('mediaType')?.trim();
  const visibility = url.searchParams.get('visibility')?.trim();

  try {
    const where: any = {
      status: 'ACTIVE',
      // Look for carriers outside own organization marked as PARTNER or MARKETPLACE, or own shared
      visibility: visibility && visibility !== 'ALL'
        ? visibility
        : { in: ['PARTNER', 'SHARED', 'MARKETPLACE'] },
    };

    if (city && city !== 'ALL') {
      where.city = { contains: city, mode: 'insensitive' };
    }

    const carriers = await platformPrisma.advertisingCarrier.findMany({
      where,
      include: {
        surfaces: {
          where: { status: 'AVAILABLE' },
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
          where: { type: { not: 'EXPENSE_RECEIPT' } },
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
      const b2bDiscount = isOwn ? 0 : 20; // 20% B2B partner discount

      return carrier.surfaces.map((surface) => {
        const listPrice = surface.price ? Number(surface.price) : 8500;
        const b2bWholesalePrice = Math.round(listPrice * (1 - b2bDiscount / 100));

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
