import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/rbac';
import { parseNaturalLanguageOccupancyQuery } from '@/lib/occupancy/intelligence-ai';
import { findAvailableSurfaces } from '@/lib/occupancy/availability-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || !canAccess(user.role, 'occupancy')) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Dotaz nesmí být prázdný.' }, { status: 400 });
    }

    // Load available cities & media types for the tenant
    const carriers = await prisma.advertisingCarrier.findMany({
      where: { organizationId: user.organizationId, archivedAt: null, status: 'ACTIVE' },
      select: { city: true },
      distinct: ['city'],
      take: 50,
    });
    const cities = carriers.map((c) => c.city).filter(Boolean);

    const mediaTypes = [
      'BILLBOARD',
      'BIGBOARD',
      'CITYLIGHT',
      'BANNER',
      'FACADE',
      'LED_SCREEN',
      'PROMO_BENCH',
      'CITY_POSTER',
      'NAVIGATION_SIGN',
      'OTHER',
    ];

    // 1. Parse natural language intent into structured parameters
    const parsed = await parseNaturalLanguageOccupancyQuery(query.trim(), cities, mediaTypes);

    let answer = parsed.summaryAnswer || 'Zpracováno.';
    let surfaces: Array<{
      id: string;
      name: string;
      mediaType: string;
      city: string;
      price?: number | null;
      carrierCode: string;
    }> = [];
    let insights: unknown[] = [];

    // 2. Execute corresponding deterministic backend queries based on parsed intent
    if (parsed.intent === 'FIND_AVAILABLE_MEDIA') {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setDate(today.getDate() + 30);

      const dateFrom = parsed.dateFrom || today.toISOString().slice(0, 10);
      const dateTo = parsed.dateTo || nextMonth.toISOString().slice(0, 10);

      const available = await findAvailableSurfaces(user.organizationId, {
        dateFrom,
        dateTo,
        city: parsed.city,
        region: parsed.region,
        mediaType: parsed.mediaType,
        maxPrice: parsed.maxPrice,
        limit: parsed.quantity || 15,
      });

      surfaces = available.map((s) => ({
        id: s.id,
        name: s.name,
        mediaType: s.mediaType,
        city: s.carrier.city,
        price: s.price ? Number(s.price) : null,
        carrierCode: s.carrier.code,
      }));

      answer = `Nalezeno ${surfaces.length} volných ploch${parsed.city ? ` v lokalitě ${parsed.city}` : ''}${parsed.mediaType ? ` typu ${parsed.mediaType}` : ''} pro období ${dateFrom} až ${dateTo}.`;
    } else if (parsed.intent === 'CHECK_COLLISIONS') {
      insights = await prisma.occupancyInsight.findMany({
        where: {
          organizationId: user.organizationId,
          type: { in: ['DOUBLE_BOOKING', 'OFFER_CONFLICT', 'STATUS_MISMATCH'] },
          status: { in: ['OPEN', 'REVIEWED'] },
        },
        include: { surface: true, carrier: true },
        take: 10,
      });
      answer = insights.length
        ? `V systému je evidováno ${insights.length} otevřených kolizí a neshod obsazenosti.`
        : 'Skvělá zpráva! V systému nejsou žádné aktivní kolize ani neshody obsazenosti.';
    } else if (parsed.intent === 'EXPIRING_CAMPAIGNS') {
      insights = await prisma.occupancyInsight.findMany({
        where: {
          organizationId: user.organizationId,
          type: 'EXPIRING_CAMPAIGN',
          status: { in: ['OPEN', 'REVIEWED'] },
        },
        include: { surface: true, carrier: true, client: true },
        take: 15,
      });
      answer = `Nalezeno ${insights.length} končících kampaní s příležitostí k prodloužení.`;
    } else if (parsed.intent === 'UNDERUTILIZED_MEDIA') {
      insights = await prisma.occupancyInsight.findMany({
        where: {
          organizationId: user.organizationId,
          type: 'UNDERUTILIZED_MEDIA',
          status: { in: ['OPEN', 'REVIEWED'] },
        },
        include: { surface: true, carrier: true },
        take: 15,
      });
      answer = `Nalezeno ${insights.length} dlouhodobě nevyužitých ploch (ležáků).`;
    }

    return NextResponse.json({
      query,
      parsedIntent: parsed,
      answer,
      surfaces,
      insights,
    });
  } catch (error) {
    console.error('[Occupancy Intelligence Ask Error]:', error);
    return NextResponse.json(
      { error: 'Zpracování dotazu selhalo.', details: error instanceof Error ? error.message : 'Neznámá chyba' },
      { status: 500 }
    );
  }
}
