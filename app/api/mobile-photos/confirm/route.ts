import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';
import { runPostSaveTasks } from '@/lib/mobile-photo-upload';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';

export async function POST(req: Request) {
  try {
    const auth = await requireApiAccess('navigationProjects');
    if (isApiDenied(auth)) return auth;
    const input = await req.json() as { photoId?: string; surfaceId?: string };
    if (!input.photoId || !input.surfaceId) return NextResponse.json({ error: 'Chybí fotografie nebo plocha.' }, { status: 400 });
    const photo = await prisma.photo.findUnique({ where: { id: input.photoId }, select: {
      id: true, carrierId: true, surfaceId: true, url: true, note: true, type: true, isClientVisible: true,
      capturedByWorkerName: true,
    } });
    if (!photo?.carrierId) return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    const surface = await prisma.advertisingSurface.findFirst({ where: { id: input.surfaceId, carrierId: photo.carrierId },
      select: { id: true, name: true, carrier: { select: { code: true, name: true, city: true } } } });
    if (!surface) return NextResponse.json({ error: 'Vybraná plocha nepatří k nosiči.' }, { status: 400 });

    if (photo.surfaceId === surface.id) {
      return NextResponse.json({ success: true, alreadyConfirmed: true, warnings: [], message: 'Fotografie už je k této ploše přiřazena.' });
    }
    if (photo.surfaceId) {
      return NextResponse.json({ error: 'Fotografie už je přiřazena k jiné ploše.' }, { status: 409 });
    }

    const assigned = await prisma.photo.updateMany({ where: { id: photo.id, surfaceId: null }, data: { surfaceId: surface.id } });
    if (assigned.count !== 1) {
      const current = await prisma.photo.findUnique({ where: { id: photo.id }, select: { surfaceId: true } });
      if (current?.surfaceId === surface.id) {
        return NextResponse.json({ success: true, alreadyConfirmed: true, warnings: [], message: 'Fotografie už je k této ploše přiřazena.' });
      }
      return NextResponse.json({ error: 'Fotografii mezitím přiřadil jiný uživatel.' }, { status: 409 });
    }
    const workerName = photo.capturedByWorkerName || auth.name || auth.email || 'Pracovník v terénu';
    const warnings = await runPostSaveTasks([
      { name: 'history', run: () => logCarrierHistoryEvent({
        carrierId: photo.carrierId!, surfaceId: surface.id, eventType: photo.type === 'DAMAGE' ? 'REPAIR' : 'SERVICE',
        title: photo.type === 'DAMAGE' ? 'Potvrzená závada z mobilní fotodokumentace' : 'Potvrzená mobilní fotodokumentace',
        description: photo.note || 'Přiřazení plochy potvrzeno montérem.', performedBy: workerName, photoUrl: photo.url,
      }) },
      { name: 'chat', run: async () => {
        if (photo.type !== 'DAMAGE') return;
        await prisma.chatMessage.create({ data: {
          channel: 'urgent', userId: auth.id,
          userName: workerName, userRole: auth.role, imageUrl: photo.url,
          content: `🚨 Závada – ${surface.carrier.name} (${surface.carrier.code}), ${surface.name}`,
        } });
      } },
    ]);
    return NextResponse.json({ success: true, warnings, message: 'Přiřazení fotografie k ploše bylo potvrzeno.' });
  } catch (error) {
    console.error('[mobile-photos/confirm]', error);
    return NextResponse.json({ error: 'Přiřazení fotografie se nepodařilo potvrdit.' }, { status: 500 });
  }
}
