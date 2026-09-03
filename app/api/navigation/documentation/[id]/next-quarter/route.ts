import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  try {
    const existing = await prisma.navigationDocumentationReport.findFirst({
      where: { id, organizationId: auth.organizationId },
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

    const duplicate = await prisma.navigationDocumentationReport.findFirst({
      where: {
        organizationId: auth.organizationId,
        clientId: existing.clientId,
        offerId: existing.offerId,
        quarter: nextQuarter,
        year: nextYear,
        status: { not: 'ARCHIVED' },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Report pro stejného klienta, nabídku a čtvrtletí již existuje.', reportId: duplicate.id }, { status: 409 });
    }

    // Re-query current live active navigation points & latest photos
    const points = await prisma.navigationPoint.findMany({
      where: {
        organizationId: auth.organizationId,
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
        organizationId: auth.organizationId,
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
        createdById: auth.id,
        items: {
          create: points.map((point, index) => ({
            organizationId: auth.organizationId,
            navigationPointId: point.id,
            carrierId: point.carrierId ?? undefined,
            selectedPhotoId: point.carrier?.photos[0]?.id ?? undefined,
            sortOrder: index,
            isVisible: true,
          })),
        },
        auditLogs: {
          create: {
            organizationId: auth.organizationId,
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

    return NextResponse.json({ report: newReport }, { status: 201 });
  } catch (error: unknown) {
    console.error('[navigation/documentation/next-quarter] Creation failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Report pro další čtvrtletí se nepodařilo vytvořit.' }, { status: 500 });
  }
}
