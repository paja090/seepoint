import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Nemáte oprávnění k úpravě fondu nosičů.' }, { status: 403 });
    }

    const input = await request.json().catch(() => null);
    if (!input || typeof input.totalFrames !== 'number') {
      return NextResponse.json({ error: 'Zadejte platný počet nosičů.' }, { status: 400 });
    }

    const totalFrames = Math.max(1, input.totalFrames);
    const maintenanceCount = Math.max(0, Number(input.maintenanceCount) || 0);

    const fleetConfig = await prisma.cityGalleryFleetConfig.upsert({
      where: { id: 'default' },
      update: { totalFrames, maintenanceCount },
      create: { id: 'default', totalFrames, maintenanceCount },
    });

    return NextResponse.json({ ok: true, fleetConfig });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chyba při ukládání fondu nosičů.' }, { status: 500 });
  }
}
