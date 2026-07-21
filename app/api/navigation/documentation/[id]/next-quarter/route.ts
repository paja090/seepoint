import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { generateSecureToken } from '@/lib/navigation-documentation';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  try {
    const existing = await prisma.navigationDocumentationReport.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    let nextQuarter = (existing.quarter ?? 1) + 1;
    let nextYear = existing.year;
    if (nextQuarter > 4) {
      nextQuarter = 1;
      nextYear += 1;
    }

    const title = `Fotodokumentace ${nextQuarter}. čtvrtletí ${nextYear}`;
    const periodFrom = new Date(nextYear, (nextQuarter - 1) * 3, 1);
    const periodTo = new Date(nextYear, nextQuarter * 3, 0);

    const { token, hash } = generateSecureToken();

    // Re-query current live active navigation points & latest photos
    const points = await prisma.navigationPoint.findMany({
      where: {
        navigationOffer: {
          offer: {
            clientId: existing.clientId,
            ...(existing.offerId ? { id: existing.offerId } : {}),
          },
        },
        status: { notIn: ['REMOVED', 'CANCELLED'] },
      },
      include: {
        carrier: {
          include: {
            photos: {
              where: { isClientVisible: true, isPrivate: false },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
              take: 1,
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const newReport = await prisma.navigationDocumentationReport.create({
      data: {
        clientId: existing.clientId,
        offerId: existing.offerId,
        navigationOfferId: existing.navigationOfferId,
        title,
        description: existing.description,
        periodFrom,
        periodTo,
        quarter: nextQuarter,
        year: nextYear,
        status: 'DRAFT',
        publicTokenHash: hash,
        createdById: auth.id,
        items: {
          create: points.map((point, index) => ({
            navigationPointId: point.id,
            carrierId: point.carrierId ?? undefined,
            selectedPhotoId: point.carrier?.photos[0]?.id ?? undefined,
            sortOrder: index,
            isVisible: true,
          })),
        },
        auditLogs: {
          create: {
            actorUserId: auth.id,
            action: 'CREATED',
            message: `Vytvořen nový koncept pro ${nextQuarter}. čtvrtletí ${nextYear} na základě předchozího reportu ${existing.title}. Znovu načtena živá data.`,
          },
        },
      },
      include: {
        client: true,
        items: true,
      },
    });

    return NextResponse.json({ report: newReport, token });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Chyba při vytváření reportu pro další kvartál.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
