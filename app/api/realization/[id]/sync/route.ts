import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { getOrganizationRealizationProfile } from '@/lib/ai-realization/profile';
import { buildRealizationContext, determineRealizationNextBestActions } from '@/lib/ai-realization/realization-engine';
import { transitionNavigationOrderStatus } from '@/lib/navigation/workflow-service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('realization');
  if (isApiDenied(auth)) return auth;

  try {
    const { id } = await params;
    const organizationId = auth.organizationId!;
    let body: { action?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable for sync
    }

    const crmOrder = await prisma.crmOrder.findFirst({
      where: {
        organizationId,
        id,
      },
      include: {
        navigationOrder: {
          include: {
            points: true,
          },
        },
      },
    });

    if (!crmOrder) {
      return NextResponse.json({ error: 'Realizační zakázka nebyla nalezena.' }, { status: 404 });
    }

    let message = 'Stav zakázky byl úspěšně zkontrolován.';
    let advancedToBilling = false;

    // Handle Navigation Orders:
    if (crmOrder.navigationOrder) {
      const navOrder = crmOrder.navigationOrder;
      const points = navOrder.points;
      const totalPoints = points.length;
      const photographedPoints = points.filter((p) => Boolean(p.installedPhotoId)).length;
      const allPhotographed = totalPoints > 0 && photographedPoints === totalPoints;

      if (body.action === 'ADVANCE_TO_BILLING') {
        if (!allPhotographed) {
          return NextResponse.json(
            {
              error: `Nelze schválit fotodokumentaci: Chybí fotografie u ${totalPoints - photographedPoints} z ${totalPoints} bodů.`,
            },
            { status: 400 }
          );
        }

        // 1. Approve all pending points in QC
        await prisma.navigationPoint.updateMany({
          where: {
            navigationOrderId: navOrder.id,
            qcStatus: 'PENDING',
          },
          data: {
            qcStatus: 'APPROVED',
            qcNote: 'Schváleno manažerem realizace',
          },
        });

        // 2. Advance navigation order to PRIPRAVENO_K_FAKTURACI
        if (navOrder.status === 'FOTODOKUMENTACE' || navOrder.status === 'INSTALACE') {
          await transitionNavigationOrderStatus(
            navOrder.id,
            'PRIPRAVENO_K_FAKTURACI',
            auth.id,
            auth.name
          );
          advancedToBilling = true;
          message = 'Fotodokumentace byla schválena a zakázka byla úspěšně posunuta do fáze Připraveno k fakturaci.';
        } else {
          message = `Navigační zakázka je již ve stavu ${navOrder.status}.`;
        }
      } else {
        // SYNC_ONLY: Check if points are already photographed and if auto-sync is needed
        if (allPhotographed && navOrder.status === 'INSTALACE') {
          await transitionNavigationOrderStatus(
            navOrder.id,
            'FOTODOKUMENTACE',
            auth.id,
            auth.name
          );
          message = 'Všechny body byly nainstalovány a vyfoceny. Zakázka byla posunuta do fáze Fotodokumentace ke schválení.';
        } else if (allPhotographed && navOrder.status === 'FOTODOKUMENTACE') {
          message = `Všech ${totalPoints} fotografií je nahráno v pořádku. Zakázka čeká na schválení k fakturaci.`;
        } else {
          message = `Stav synchronizován: nahráno ${photographedPoints} z ${totalPoints} fotografií.`;
        }
      }
    }

    const profile = await getOrganizationRealizationProfile(organizationId);
    const updatedContext = await buildRealizationContext(id, auth, profile);
    const nextBestActions = updatedContext ? determineRealizationNextBestActions(updatedContext) : [];

    return NextResponse.json({
      success: true,
      message,
      advancedToBilling,
      context: updatedContext,
      nextBestActions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chyba při synchronizaci realizace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
