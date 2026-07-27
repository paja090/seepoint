import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('navigationProjects');
  if (isApiDenied(authResult)) return authResult;

  try {
    const body = await req.json();
    const { pointIds, orderId, installerUserId, plannedInstallationAt, routeOrder } = body;

    if (!pointIds || !Array.isArray(pointIds) || pointIds.length === 0) {
      return NextResponse.json(
        { error: 'Chybí seznam ID navigačních bodů (pointIds).' },
        { status: 400 }
      );
    }

    const updateData: Prisma.NavigationPointUncheckedUpdateInput = {};
    if (plannedInstallationAt !== undefined) {
      updateData.plannedInstallationAt = plannedInstallationAt ? new Date(plannedInstallationAt) : null;
    }
    if (installerUserId !== undefined) {
      updateData.installerUserId = installerUserId || null;
    }
    if (routeOrder !== undefined) {
      updateData.routeOrder = Number(routeOrder) || 0;
    }

    await prisma.$transaction(async (tx) => {
      await tx.navigationPoint.updateMany({
        where: { id: { in: pointIds } },
        data: updateData,
      });

      if (orderId && plannedInstallationAt) {
        await tx.navigationOrder.update({
          where: { id: orderId },
          data: {
            plannedInstallationAt: new Date(plannedInstallationAt),
            installationDate: new Date(plannedInstallationAt),
            ...(installerUserId ? { installerUserId } : {}),
            status: 'PRIPRAVENO_K_INSTALACI',
            blockStatus: 'CEKA_NA_INSTALACI',
          },
        });
      }
    });

    return NextResponse.json({ success: true, updatedCount: pointIds.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chyba při plánování montáže.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
