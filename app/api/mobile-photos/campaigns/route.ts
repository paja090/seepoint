import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getDeterministicOfferToken } from '@/lib/offers/token';

export const dynamic = 'force-dynamic';

function surfaceSide(surface: { sidePosition?: string | null; sourcePosition?: string | null; name?: string }) {
  const value = `${surface.sidePosition || ''} ${surface.sourcePosition || ''}`.toUpperCase();
  if (/\b(B|SIDE_B|STRANA B|ZADN[ÍI])\b/.test(value)) return 'Strana B';
  if (/\b(A|SIDE_A|STRANA A|PŘEDN[ÍI])\b/.test(value)) return 'Strana A';
  return surface.name || 'Plocha';
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  try {
    const offers = await prisma.offer.findMany({
      where: {
        organizationId: user.organizationId,
        status: { in: ['ACCEPTED', 'SENT'] },
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        title: true,
        campaignName: true,
        status: true,
        offerType: true,
        publicTokenHash: true,
        validUntil: true,
        client: { select: { id: true, name: true } },
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
    });

    const campaigns = offers.map((offer) => {
      const surfaces = offer.items.map((item) => {
        const installPhoto = item.surface.photos[0] || null;
        return {
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
          isInstalled: Boolean(installPhoto),
          installedPhotoUrl: installPhoto?.url || null,
        };
      });

      const totalSurfaces = surfaces.length;
      const installedCount = surfaces.filter((s) => s.isInstalled).length;

      return {
        id: offer.id,
        title: offer.campaignName ?? offer.title,
        clientName: offer.client.name,
        status: offer.status,
        publicToken: offer.publicTokenHash ? getDeterministicOfferToken(offer.id) : null,
        totalSurfaces,
        installedCount,
        progressPercent: totalSurfaces > 0 ? Math.round((installedCount / totalSurfaces) * 100) : 0,
        surfaces,
      };
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('[api/mobile-photos/campaigns] Error:', error);
    return NextResponse.json({ error: 'Chyba při načítání kampaní.' }, { status: 500 });
  }
}
