import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { generateSecureToken } from '@/lib/navigation-documentation';

export async function GET(request: Request) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId')?.trim();
  const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;
  const quarter = searchParams.get('quarter') ? Number(searchParams.get('quarter')) : undefined;
  const status = searchParams.get('status')?.trim();

  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;
  if (year) where.year = year;
  if (quarter) where.quarter = quarter;
  if (status) where.status = status;

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
    const clientId = String(body.clientId || '').trim();
    if (!clientId) {
      return NextResponse.json({ error: 'Vyberte klienta.' }, { status: 400 });
    }

    const year = Number(body.year) || new Date().getFullYear();
    const quarter = body.quarter ? Number(body.quarter) : 2;
    const city = body.city ? String(body.city).trim() : '';

    const defaultTitle = city
      ? `Fotodokumentace ${city} – ${quarter}. čtvrtletí ${year}`
      : `Fotodokumentace ${quarter}. čtvrtletí ${year}`;
    const title = String(body.title || defaultTitle).trim();
    const description = body.description ? String(body.description).trim() : null;
    const offerId = body.offerId ? String(body.offerId).trim() : null;
    const navigationOfferId = body.navigationOfferId ? String(body.navigationOfferId).trim() : null;

    const periodFrom = body.periodFrom ? new Date(body.periodFrom) : new Date(year, (quarter - 1) * 3, 1);
    const periodTo = body.periodTo ? new Date(body.periodTo) : new Date(year, quarter * 3, 0);

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    }

    const { token, hash } = generateSecureToken();

    // Helper to extract direction/orientation
    const extractDirection = (point?: any, carrier?: any) => {
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
              where: { isPrivate: false },
              orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
            },
            surfaces: {
              include: {
                photos: {
                  where: { isPrivate: false },
                  orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (points.length === 0) {
      points = await prisma.navigationPoint.findMany({
        where: {
          navigationOffer: { offer: { clientId, ...(offerId ? { id: offerId } : {}) } },
          status: { notIn: ['REMOVED', 'CANCELLED'] },
        },
        include: {
          carrier: {
            include: {
              photos: {
                where: { isPrivate: false },
                orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
              },
              surfaces: {
                include: {
                  photos: {
                    where: { isPrivate: false },
                    orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                  },
                },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
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
          ...((point.carrier?.surfaces || []).flatMap((s: any) => s.photos || [])),
        ].sort((a: any, b: any) => {
          if (a.isClientVisible !== b.isClientVisible) return a.isClientVisible ? -1 : 1;
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

        return {
          navigationPointId: point.id,
          carrierId: point.carrierId ?? undefined,
          selectedPhotoId: point.installedPhotoId ?? availablePhotos[0]?.id ?? undefined,
          customDirection: extractDirection(point, point.carrier),
          sortOrder: index,
          isVisible: true,
        };
      });
    } else {
      // Fallback: Query carriers associated with this client
      let carriers = await prisma.advertisingCarrier.findMany({
        where: {
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
            where: { isPrivate: false },
            orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
          },
          surfaces: {
            include: {
              photos: {
                where: { isPrivate: false },
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
          ...((carrier.surfaces || []).flatMap((s: any) => s.photos || [])),
        ].sort((a: any, b: any) => {
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
        publicTokenHash: hash,
        createdById: auth.id,
        items: {
          create: itemInputs,
        },
        auditLogs: {
          create: {
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

    return NextResponse.json({ report, token });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Chyba při vytváření reportu.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
