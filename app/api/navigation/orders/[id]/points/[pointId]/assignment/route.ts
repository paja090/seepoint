import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; pointId: string }> },
) {
  const auth = await requireApiAccess('navigationProjects');
  if (isApiDenied(auth)) return auth;

  try {
    const { id, pointId } = await params;
    const body = await request.json() as { carrierId?: string };
    if (!body.carrierId) return NextResponse.json({ error: 'Vyberte nosič.' }, { status: 400 });

    const [point, carrier] = await Promise.all([
      prisma.navigationPoint.findUnique({ where: { id: pointId }, select: { navigationOrderId: true } }),
      prisma.advertisingCarrier.findUnique({ where: { id: body.carrierId }, select: { id: true, code: true, archivedAt: true } }),
    ]);
    if (!point || point.navigationOrderId !== id) return NextResponse.json({ error: 'Navigační bod nebyl nalezen.' }, { status: 404 });
    if (!carrier || carrier.archivedAt) return NextResponse.json({ error: 'Vybraný nosič není dostupný.' }, { status: 400 });

    await prisma.navigationPoint.update({
      where: { id: pointId },
      data: { carrierId: carrier.id, surfaceId: null },
    });

    return NextResponse.json({ point: { carrierId: carrier.id, carrierCode: carrier.code } });
  } catch (error) {
    console.error('Navigation point carrier assignment failed', error);
    return NextResponse.json({ error: 'Nosič se nepodařilo přiřadit.' }, { status: 500 });
  }
}
