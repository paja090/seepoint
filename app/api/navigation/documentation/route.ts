import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import {
  NavigationDocumentationValidationError,
  parseNavigationReportStatus,
  parseOptionalText,
  parseQuarter,
  parseReportYear,
  parseRequiredText,
} from '@/lib/navigation-documentation-policy';

export async function GET(request: Request) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId')?.trim();
  let year: number | undefined;
  let quarter: number | undefined;
  const status = searchParams.get('status')?.trim();

  try {
    year = searchParams.get('year') ? parseReportYear(searchParams.get('year')) : undefined;
    quarter = searchParams.get('quarter') ? parseQuarter(searchParams.get('quarter')) : undefined;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Neplatný filtr.' }, { status: 400 });
  }

  const where: Record<string, unknown> = { organizationId: auth.organizationId };
  if (clientId) where.clientId = clientId;
  if (year) where.year = year;
  if (quarter) where.quarter = quarter;
  if (status) {
    try {
      where.status = parseNavigationReportStatus(status);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Neplatný stav.' }, { status: 400 });
    }
  }

  const reports = await prisma.navigationDocumentationReport.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, email: true } },
      offer: { select: { id: true, campaignName: true, title: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(reports);
}

export async function POST(request: Request) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  try {
    const body = await request.json();
    const clientId = parseRequiredText(body.clientId, 'Klient', 100);
    const year = parseReportYear(body.year ?? new Date().getFullYear());
    const quarter = parseQuarter(body.quarter ?? 2);
    const city = parseOptionalText(body.city, 'Město', 120) || '';

    const defaultTitle = city
      ? `Fotodokumentace ${city} – ${quarter}. čtvrtletí ${year}`
      : `Fotodokumentace ${quarter}. čtvrtletí ${year}`;
    const title = parseRequiredText(body.title || defaultTitle, 'Název reportu', 240);
    const description = parseOptionalText(body.description, 'Popis', 4_000);
    const offerId = parseOptionalText(body.offerId, 'Nabídka', 100);
    const navigationOfferId = parseOptionalText(body.navigationOfferId, 'Navigační nabídka', 100);

    const periodFrom = body.periodFrom ? new Date(body.periodFrom) : new Date(year, (quarter - 1) * 3, 1);
    const periodTo = body.periodTo ? new Date(body.periodTo) : new Date(year, quarter * 3, 0);
    if (Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime()) || periodFrom > periodTo) {
      throw new NavigationDocumentationValidationError('Období reportu není platné.');
    }

    const client = await prisma.client.findFirst({ where: { id: clientId, organizationId: auth.organizationId, active: true } });
    if (!client) {
      return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    }

    if (offerId) {
      const offer = await prisma.offer.findFirst({ where: { id: offerId, organizationId: auth.organizationId, clientId, archivedAt: null } });
      if (!offer) return NextResponse.json({ error: 'Nabídka nepatří vybranému klientovi.' }, { status: 400 });
    }
    if (navigationOfferId) {
      const navigationOffer = await prisma.navigationOffer.findFirst({
        where: { id: navigationOfferId, organizationId: auth.organizationId, offer: { clientId } },
      });
      if (!navigationOffer) return NextResponse.json({ error: 'Navigační nabídka nepatří vybranému klientovi.' }, { status: 400 });
    }

    // Helper to extract direction/orientation
    type DirectionPoint = { orientation?: string | null; variant?: string | null };
    type DirectionCarrier = { surfaces?: Array<{ directionDescription?: string | null; orientation?: string | null }> };
    const extractDirection = (point?: DirectionPoint | null, carrier?: DirectionCarrier | null) => {
      const direct = point?.orientation;
      if (direct && direct.trim() !== '') return direct.trim();
      const surf = carrier?.surfaces?.[0]?.directionDescription || carrier?.surfaces?.[0]?.orientation;
      if (surf && surf.trim() !== '') return surf.trim();
      const variant = point?.variant;
      if (variant && variant.trim() !== '') return variant.trim();
      return undefined;
    };

    // Query active navigation points for this client / offer
    let points = await prisma.navigationPoint.findMany({
      where: {
        organizationId: auth.organizationId,
        navigationOrder: {
          crmOrder: {
            clientId,
            ...(offerId ? { offerId } : {}),
          },
        },
        status: { notIn: ['REMOVED', 'CANCELLED'] },
      },
      include: {
        carrier: {
          include: {
            photos: {
              where: { isPrivate: false, isClientVisible: true },
              orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
            },
            surfaces: {
              include: {
                photos: {
                  where: { isPrivate: false, isClientVisible: true },
                  orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: 250,
    });

    if (points.length === 0) {
      points = await prisma.navigationPoint.findMany({
        where: {
          organizationId: auth.organizationId,
          navigationOffer: { offer: { clientId, ...(offerId ? { id: offerId } : {}) } },
          status: { notIn: ['REMOVED', 'CANCELLED'] },
        },
        include: {
          carrier: {
            include: {
              photos: {
                where: { isPrivate: false, isClientVisible: true },
                orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
              },
              surfaces: {
                include: {
                  photos: {
                    where: { isPrivate: false, isClientVisible: true },
                    orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                  },
                },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
        take: 250,
      });
    }

    if (city) {
      const lowerCity = city.toLowerCase();
      points = points.filter((p) => {
        const text = `${p.address || ''} ${p.carrier?.city || ''} ${p.carrier?.address || ''} ${p.carrier?.name || ''} ${p.carrier?.surfaces?.map((s) => s.name).join(' ') || ''}`.toLowerCase();
        return text.includes(lowerCity);
      });
    }

    let itemInputs: Array<{
      navigationPointId?: string;
      carrierId?: string;
      selectedPhotoId?: string;
      customDirection?: string;
      sortOrder: number;
      isVisible: boolean;
    }> = [];

    if (points.length > 0) {
      itemInputs = points.map((point, index) => {
        const availablePhotos = [
          ...(point.carrier?.photos || []),
          ...((point.carrier?.surfaces || []).flatMap((surface) => surface.photos || [])),
        ].sort((a, b) => {
          if (a.isClientVisible !== b.isClientVisible) return a.isClientVisible ? -1 : 1;
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

        return {
          navigationPointId: point.id,
          carrierId: point.carrierId ?? undefined,
          selectedPhotoId: availablePhotos[0]?.id ?? undefined,
          customDirection: extractDirection(point, point.carrier),
          sortOrder: index,
          isVisible: true,
        };
      });
    } else {
      // Fallback: Query carriers associated with this client
      let carriers = await prisma.advertisingCarrier.findMany({
        where: {
          organizationId: auth.organizationId,
          archivedAt: null,
          surfaces: {
            some: {
              OR: [
                { currentClientId: clientId },
                { occupancies: { some: { clientId } } },
              ],
            },
          },
        },
        include: {
          photos: {
            where: { isPrivate: false, isClientVisible: true },
            orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
          },
          surfaces: {
            include: {
              photos: {
                where: { isPrivate: false, isClientVisible: true },
                orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
              },
            },
          },
        },
        orderBy: { code: 'asc' },
        take: 100,
      });

      if (city) {
        const lowerCity = city.toLowerCase();
        carriers = carriers.filter((c) => {
          const text = `${c.city || ''} ${c.address || ''} ${c.name || ''} ${c.surfaces?.map((s) => s.name).join(' ') || ''}`.toLowerCase();
          return text.includes(lowerCity);
        });
      }

      itemInputs = carriers.map((carrier, index) => {
        const availablePhotos = [
          ...(carrier.photos || []),
          ...((carrier.surfaces || []).flatMap((surface) => surface.photos || [])),
        ].sort((a, b) => {
          if (a.isClientVisible !== b.isClientVisible) return a.isClientVisible ? -1 : 1;
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

        return {
          carrierId: carrier.id,
          selectedPhotoId: availablePhotos[0]?.id ?? undefined,
          customDirection: extractDirection(null, carrier),
          sortOrder: index,
          isVisible: true,
        };
      });
    }

    const report = await prisma.navigationDocumentationReport.create({
      data: {
        organizationId: auth.organizationId,
        clientId,
        offerId,
        navigationOfferId,
        title,
        description,
        periodFrom,
        periodTo,
        quarter,
        year,
        status: 'DRAFT',
        createdById: auth.id,
        items: {
          create: itemInputs.map((item) => ({ ...item, organizationId: auth.organizationId })),
        },
        auditLogs: {
          create: {
            organizationId: auth.organizationId,
            actorUserId: auth.id,
            action: 'CREATED',
            message: `Vytvořen nový koncept fotodokumentace pro klienta ${client.name} s ${itemInputs.length} položkami.`,
          },
        },
      },
      include: {
        client: true,
        items: true,
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof NavigationDocumentationValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[navigation/documentation] Creation failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Report se nepodařilo vytvořit.' }, { status: 500 });
  }
}
