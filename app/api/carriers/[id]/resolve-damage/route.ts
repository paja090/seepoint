import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('carriers');
  if (isApiDenied(auth)) return auth;

  try {
    const carrierId = (await params).id;
    const body = (await req.json().catch(() => ({}))) as {
      surfaceId?: string;
      resolutionNote?: string;
    };

    const carrier = await prisma.advertisingCarrier.findFirst({
      where: { id: carrierId },
      include: {
        surfaces: {
          include: {
            occupancies: true,
          },
        },
      },
    });

    if (!carrier) {
      return NextResponse.json({ error: 'Nosič nebyl nalezen.' }, { status: 404 });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const surfaceId = body.surfaceId ? body.surfaceId.trim() : null;
    const actorName = auth.name || auth.email || 'Technik';
    const repairDateStr = new Date().toLocaleDateString('cs-CZ');

    if (surfaceId) {
      // 1. Resolve damage specifically for selected surface
      const targetSurface = carrier.surfaces.find((s) => s.id === surfaceId);
      if (!targetSurface) {
        return NextResponse.json({ error: 'Reklamní plocha nebyla nalezena.' }, { status: 404 });
      }

      // Archive / resolve damage photos linked to this surface
      const surfaceDamagePhotos = await prisma.photo.findMany({
        where: {
          carrierId,
          surfaceId,
          type: 'DAMAGE',
        },
      });

      for (const p of surfaceDamagePhotos) {
        const resolutionTag = `[OPRAVENO dne ${repairDateStr} (${actorName})]`;
        const updatedNote = p.note ? `${p.note} | ${resolutionTag}` : resolutionTag;
        await prisma.photo.update({
          where: { id: p.id },
          data: {
            type: 'ARCHIVE',
            note: updatedNote.slice(0, 1000),
          },
        });
      }

      // Restore surface status if it was OUT_OF_SERVICE
      let nextStatus = targetSurface.status;
      if (targetSurface.status === 'OUT_OF_SERVICE') {
        const activeOccupancy = targetSurface.occupancies.find((o) => {
          if (!['OCCUPIED', 'RESERVED'].includes(o.status)) return false;
          const from = o.dateFrom.toISOString().slice(0, 10);
          const to = o.dateTo.toISOString().slice(0, 10);
          return from <= todayStr && to >= todayStr;
        });
        nextStatus = activeOccupancy ? (activeOccupancy.status === 'RESERVED' ? 'RESERVED' : 'OCCUPIED') : 'AVAILABLE';
      }

      // Clean damage tag from surface note
      const cleanedSurfaceNote = (targetSurface.note || '')
        .replace(/\[ZÁVADA:[^\]]+\]/g, '')
        .replace(/ZÁVADA:[^\n|]+/g, '')
        .trim();

      await prisma.advertisingSurface.update({
        where: { id: targetSurface.id },
        data: {
          status: nextStatus,
          note: cleanedSurfaceNote || null,
        },
      });

      // Check if there are any other remaining damage photos or out-of-service surfaces on this carrier
      const remainingDamagePhotos = await prisma.photo.count({
        where: {
          carrierId,
          type: 'DAMAGE',
        },
      });
      const remainingDamagedSurfaces = await prisma.advertisingSurface.count({
        where: {
          carrierId,
          status: 'OUT_OF_SERVICE',
        },
      });

      if (remainingDamagePhotos === 0 && remainingDamagedSurfaces === 0) {
        const cleanedCarrierNote = (carrier.note || '')
          .replace(/\[ZÁVADA:[^\]]+\]/g, '')
          .replace(/ZÁVADA:[^\n|]+/g, '')
          .trim();
        await prisma.advertisingCarrier.update({
          where: { id: carrier.id },
          data: { note: cleanedCarrierNote || null },
        });
      }

      // History audit trail
      await logCarrierHistoryEvent({
        carrierId: carrier.id,
        surfaceId: targetSurface.id,
        eventType: 'REPAIR',
        title: `Oprava plochy dokončena: ${targetSurface.name}`,
        description: body.resolutionNote?.trim() || `Závada na ploše ${targetSurface.name} byla označena jako vyřešená a plocha uvedena do provozu.`,
        performedBy: actorName,
      });

      return NextResponse.json({
        success: true,
        resolvedPhotosCount: surfaceDamagePhotos.length,
        resolvedSurfaceId: targetSurface.id,
        carrierFullyResolved: remainingDamagePhotos === 0 && remainingDamagedSurfaces === 0,
        message: `Závada na ploše ${targetSurface.name} byla úspěšně označena jako opravená.`,
      });
    }

    // 2. Resolve ALL damage on the entire carrier and all its surfaces
    const allDamagePhotos = await prisma.photo.findMany({
      where: {
        carrierId,
        type: 'DAMAGE',
      },
    });

    for (const p of allDamagePhotos) {
      const resolutionTag = `[OPRAVENO dne ${repairDateStr} (${actorName})]`;
      const updatedNote = p.note ? `${p.note} | ${resolutionTag}` : resolutionTag;
      await prisma.photo.update({
        where: { id: p.id },
        data: {
          type: 'ARCHIVE',
          note: updatedNote.slice(0, 1000),
        },
      });
    }

    // Restore any OUT_OF_SERVICE surfaces and clean their notes
    for (const s of carrier.surfaces) {
      let nextStatus = s.status;
      if (s.status === 'OUT_OF_SERVICE') {
        const activeOccupancy = s.occupancies.find((o) => {
          if (!['OCCUPIED', 'RESERVED'].includes(o.status)) return false;
          const from = o.dateFrom.toISOString().slice(0, 10);
          const to = o.dateTo.toISOString().slice(0, 10);
          return from <= todayStr && to >= todayStr;
        });
        nextStatus = activeOccupancy ? (activeOccupancy.status === 'RESERVED' ? 'RESERVED' : 'OCCUPIED') : 'AVAILABLE';
      }

      const cleanedSurfaceNote = (s.note || '')
        .replace(/\[ZÁVADA:[^\]]+\]/g, '')
        .replace(/ZÁVADA:[^\n|]+/g, '')
        .trim();

      if (nextStatus !== s.status || cleanedSurfaceNote !== (s.note || '')) {
        await prisma.advertisingSurface.update({
          where: { id: s.id },
          data: {
            status: nextStatus,
            note: cleanedSurfaceNote || null,
          },
        });
      }
    }

    // Clean carrier note
    const cleanedCarrierNote = (carrier.note || '')
      .replace(/\[ZÁVADA:[^\]]+\]/g, '')
      .replace(/ZÁVADA:[^\n|]+/g, '')
      .trim();

    await prisma.advertisingCarrier.update({
      where: { id: carrier.id },
      data: { note: cleanedCarrierNote || null },
    });

    // Resolve urgent chat messages for this carrier
    await prisma.chatMessage.updateMany({
      where: {
        channel: 'urgent',
        isResolved: false,
        OR: [
          { content: { contains: carrier.code } },
          { content: { contains: carrier.name } },
        ],
      },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });

    // History audit trail
    await logCarrierHistoryEvent({
      carrierId: carrier.id,
      eventType: 'REPAIR',
      title: 'Závada na nosiči a plochách vyřešena / Opraveno',
      description: body.resolutionNote?.trim() || 'Závada a poškození byly označeny jako opravené v kartě nosiče a plochy uvedeny do provozu.',
      performedBy: actorName,
    });

    return NextResponse.json({
      success: true,
      resolvedPhotosCount: allDamagePhotos.length,
      carrierFullyResolved: true,
      message: 'Závada na nosiči a všech jeho plochách byla úspěšně označena jako opravená.',
    });
  } catch (error) {
    console.error('[api/carriers/:id/resolve-damage] failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepodařilo se označit závadu jako opravenou.' },
      { status: 500 }
    );
  }
}
