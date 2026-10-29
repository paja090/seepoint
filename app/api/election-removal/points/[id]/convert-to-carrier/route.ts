import { NextResponse } from 'next/server';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { enterTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { CarrierType, MediaType } from '@prisma/client';

export const dynamic = 'force-dynamic';

function mapMediaTypeToCarrierType(mediaType: string): { carrierType: CarrierType; surfaceMediaType: MediaType } {
  switch (mediaType) {
    case 'BENCH':
      return { carrierType: CarrierType.PROMO_BENCH, surfaceMediaType: MediaType.PROMO_BENCH };
    case 'CITY_POSTER':
      return { carrierType: CarrierType.CITY_POSTER, surfaceMediaType: MediaType.CITY_POSTER };
    case 'TOWER':
      return { carrierType: CarrierType.PROMO_TOWER, surfaceMediaType: MediaType.PROMO_TOWER };
    case 'MINI_TOWER':
      return { carrierType: CarrierType.PROMO_MINITOWER, surfaceMediaType: MediaType.PROMO_MINITOWER };
    case 'BANNER':
    case 'PLOT':
      return { carrierType: CarrierType.BANNER, surfaceMediaType: MediaType.BANNER };
    case 'ACKO':
    case 'OTHER':
    default:
      return { carrierType: CarrierType.OTHER, surfaceMediaType: MediaType.OTHER };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess(true);
  if (isElectionRemovalAccessDenied(auth)) return auth;

  enterTenantContext({
    organizationId: auth.organizationId,
    userId: auth.user.id,
    source: 'session',
  });

  const { id } = await params;

  try {
    const point = await prisma.electionRemovalPoint.findFirst({
      where: { id, organizationId: auth.organizationId },
    });

    if (!point) {
      return NextResponse.json({ error: 'Bod nebyl nalezen.' }, { status: 404 });
    }

    if (point.carrierId) {
      const existingCarrier = await prisma.advertisingCarrier.findFirst({
        where: { id: point.carrierId, organizationId: auth.organizationId },
      });
      if (existingCarrier) {
        return NextResponse.json({
          carrier: existingCarrier,
          message: 'Tento bod již byl převeden na reklamní nosič.',
        });
      }
    }

    const { carrierType, surfaceMediaType } = mapMediaTypeToCarrierType(point.mediaType);

    // City resolution: from cadastral area, or point label/description, or fallback
    const city = point.cadastralArea || 'Neznámé město';
    const street = point.accessInstructions || point.contact || null;

    // Generate unique carrier code
    const prefix = point.mediaType.slice(0, 3).toUpperCase();
    const uniqueSuffix = Date.now().toString(36).slice(-4).toUpperCase();
    const candidateCode = `${prefix}-${uniqueSuffix}`;

    const carrier = await prisma.$transaction(async (tx) => {
      const newCarrier = await tx.advertisingCarrier.create({
        data: {
          organizationId: auth.organizationId,
          name: point.label,
          code: candidateCode,
          type: carrierType,
          city,
          street,
          latitude: point.latitude,
          longitude: point.longitude,
          gpsStatus: 'VERIFIED',
          cadastralArea: point.cadastralArea,
          cadastralAreaCode: point.cadastralAreaCode,
          parcelNumber: point.parcelNumber,
          landOwnership: point.landOwnership,
          landownerName: point.landownerName,
          landownerContact: point.landownerContact,
          monthlyRent: point.monthlyRent,
          permitValidUntil: point.permitValidUntil,
          description: point.description || `Zmapováno a povoleno z terénního průzkumu`,
          status: 'ACTIVE',
        },
      });

      // Create primary surface for this carrier
      await tx.advertisingSurface.create({
        data: {
          organizationId: auth.organizationId,
          carrierId: newCarrier.id,
          name: 'Plocha A',
          mediaType: surfaceMediaType,
          status: 'AVAILABLE',
        },
      });

      // Link carrier to point and mark permitted
      await tx.electionRemovalPoint.update({
        where: { id: point.id },
        data: {
          carrierId: newCarrier.id,
          permitStatus: 'APPROVED',
        },
      });

      return newCarrier;
    });

    return NextResponse.json({
      carrier,
      message: `Bod byl úspěšně převeden na nosič ${carrier.code} a zařazen do inventáře SeePOINT.`,
    });
  } catch (error) {
    console.error('[convert-to-carrier] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Převod na nosič selhal.' },
      { status: 500 }
    );
  }
}
