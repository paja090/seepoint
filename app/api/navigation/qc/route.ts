import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('navigationProjects');
  if (isApiDenied(authResult)) return authResult;

  try {
    const body = await req.json();
    const { pointId, action, qcNote } = body;

    if (!pointId || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { error: 'Chybí povinné údaje: pointId a platná akce (APPROVE nebo REJECT).' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const point = await tx.navigationPoint.findUnique({
        where: { id: pointId },
        select: { id: true, navigationOrderId: true },
      });

      if (!point) {
        throw new Error('Navigační bod nebyl nalezen.');
      }

      if (action === 'APPROVE') {
        await tx.navigationPoint.update({
          where: { id: pointId },
          data: {
            qcStatus: 'APPROVED',
            qcNote: qcNote || 'Schváleno správcem fotodokumentace',
          },
        });
      } else {
        // Vrácení k opravě
        await tx.navigationPoint.update({
          where: { id: pointId },
          data: {
            qcStatus: 'REJECTED',
            qcNote: qcNote || 'Vráceno k opravě – vyžadována nová fotografie',
            status: 'PLANNED', // Vráceno zpět do stavu plánování montáže
            installedPhotoId: null, // Vyžadujeme nový snímek z terénu
          },
        });
      }

      // Pokud jsou všechny body dané zakázky schváleny, posuneme zakázku do PRIPRAVENO_K_FAKTURACI
      if (point.navigationOrderId) {
        const allPoints = await tx.navigationPoint.findMany({
          where: { navigationOrderId: point.navigationOrderId },
          select: { qcStatus: true },
        });

        const allApproved = allPoints.every((p) => p.qcStatus === 'APPROVED');
        if (allApproved) {
          await tx.navigationOrder.update({
            where: { id: point.navigationOrderId },
            data: {
              status: 'PRIPRAVENO_K_FAKTURACI',
              blockStatus: 'CEKA_NA_FAKTURACI',
              qcStatus: 'APPROVED',
              qcApprovedAt: new Date(),
              qcApprovedUserId: authResult.id,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chyba při kontrole fotodokumentace.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
