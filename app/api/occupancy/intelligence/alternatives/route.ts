import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/rbac';
import { findAvailableSurfaces } from '@/lib/occupancy/availability-service';
import { rankAlternativeSurfaces } from '@/lib/occupancy/intelligence-ai';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || !canAccess(user.role, 'occupancy')) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { surfaceId } = body;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const dateFrom = body.dateFrom || now.toISOString().slice(0, 10);
    const dateTo = body.dateTo || in30.toISOString().slice(0, 10);

    if (!surfaceId) {
      return NextResponse.json(
        { error: 'Chybí parametr surfaceId.' },
        { status: 400 }
      );
    }

    const targetSurface = await prisma.advertisingSurface.findFirst({
      where: { id: surfaceId, organizationId: user.organizationId },
      include: { carrier: true },
    });

    if (!targetSurface) {
      return NextResponse.json({ error: 'Cílová plocha nebyla nalezena.' }, { status: 404 });
    }

    // 1. Deterministically find free candidate surfaces in the same city or region
    const rawCandidates = await findAvailableSurfaces(user.organizationId, {
      dateFrom,
      dateTo,
      city: targetSurface.carrier.city,
      excludeOfferId: undefined,
      limit: 15,
    });

    // Exclude the target surface itself
    const filteredCandidates = rawCandidates
      .filter((s) => s.id !== surfaceId)
      .map((s) => ({
        id: s.id,
        name: s.name,
        mediaType: s.mediaType,
        price: s.price ? Number(s.price) : null,
        carrier: {
          id: s.carrier.id,
          code: s.carrier.code,
          name: s.carrier.name,
          city: s.carrier.city,
          region: s.carrier.region,
          street: s.carrier.street,
        },
      }));

    // If no candidates in the same city, widen search to whole region
    if (filteredCandidates.length === 0 && targetSurface.carrier.region) {
      const regionCandidates = await findAvailableSurfaces(user.organizationId, {
        dateFrom,
        dateTo,
        region: targetSurface.carrier.region,
        limit: 15,
      });

      for (const s of regionCandidates) {
        if (s.id !== surfaceId) {
          filteredCandidates.push({
            id: s.id,
            name: s.name,
            mediaType: s.mediaType,
            price: s.price ? Number(s.price) : null,
            carrier: {
              id: s.carrier.id,
              code: s.carrier.code,
              name: s.carrier.name,
              city: s.carrier.city,
              region: s.carrier.region,
              street: s.carrier.street,
            },
          });
        }
      }
    }

    // 2. Rank candidates (with AI if available, deterministically if offline)
    const ranked = await rankAlternativeSurfaces(
      user.organizationId,
      {
        id: targetSurface.id,
        name: targetSurface.name,
        mediaType: targetSurface.mediaType,
        city: targetSurface.carrier.city,
        price: targetSurface.price ? Number(targetSurface.price) : null,
      },
      filteredCandidates
    );

    return NextResponse.json({
      targetSurface: {
        id: targetSurface.id,
        name: targetSurface.name,
        carrierCode: targetSurface.carrier.code,
        city: targetSurface.carrier.city,
      },
      candidates: ranked,
    });
  } catch (error) {
    console.error('[Occupancy Intelligence Alternatives Error]:', error);
    return NextResponse.json(
      { error: 'Hledání alternativ selhalo.', details: error instanceof Error ? error.message : 'Neznámá chyba' },
      { status: 500 }
    );
  }
}
