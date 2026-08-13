import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';
import { runPostSaveTasks } from '@/lib/mobile-photo-upload';

export async function POST(req: Request) {
  try {
    const input = await req.json() as { photoId?: string; surfaceId?: string };
    if (!input.photoId || !input.surfaceId) return NextResponse.json({ error: 'Chybí fotografie nebo plocha.' }, { status: 400 });
    const user = await getCurrentUser();
    const photo = await prisma.photo.findUnique({ where: { id: input.photoId }, select: {
      id: true, carrierId: true, surfaceId: true, url: true, note: true, type: true, isClientVisible: true,
      capturedByWorkerName: true,
    } });
    if (!photo?.carrierId) return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    const surface = await prisma.advertisingSurface.findFirst({ where: { id: input.surfaceId, carrierId: photo.carrierId },
      select: { id: true, name: true, carrier: { select: { code: true, name: true, city: true } } } });
    if (!surface) return NextResponse.json({ error: 'Vybraná plocha nepatří k nosiči.' }, { status: 400 });

    await prisma.photo.update({ where: { id: photo.id }, data: { surfaceId: surface.id } });
    const workerName = photo.capturedByWorkerName || user?.name || user?.email || 'Pracovník v terénu';
    const warnings = await runPostSaveTasks([
      { name: 'history', run: () => logCarrierHistoryEvent({
        carrierId: photo.carrierId!, surfaceId: surface.id, eventType: photo.type === 'DAMAGE' ? 'REPAIR' : 'SERVICE',
        title: photo.type === 'DAMAGE' ? 'Potvrzená závada z mobilní fotodokumentace' : 'Potvrzená mobilní fotodokumentace',
        description: photo.note || 'Přiřazení plochy potvrzeno montérem.', performedBy: workerName, photoUrl: photo.url,
      }) },
      { name: 'chat', run: async () => {
        if (photo.type !== 'DAMAGE' && !photo.isClientVisible) return;
        await prisma.chatMessage.create({ data: {
          channel: photo.type === 'DAMAGE' ? 'urgent' : 'installations', userId: user?.id || 'MOBILE_WORKER',
          userName: workerName, userRole: user?.role || 'WORKER', imageUrl: photo.url,
          content: `${photo.type === 'DAMAGE' ? '🚨 Závada' : '📸 Klientská fotodokumentace'} – ${surface.carrier.name} (${surface.carrier.code}), ${surface.name}`,
        } });
      } },
    ]);
    return NextResponse.json({ success: true, warnings, message: 'Přiřazení fotografie k ploše bylo potvrzeno.' });
  } catch (error) {
    console.error('[mobile-photos/confirm]', error);
    return NextResponse.json({ error: 'Přiřazení fotografie se nepodařilo potvrdit.' }, { status: 500 });
  }
}
