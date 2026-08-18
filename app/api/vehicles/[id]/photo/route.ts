import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureVehicleSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  await ensureVehicleSchema();
  const { id } = await params;

  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return NextResponse.json({ error: 'Vozidlo nebylo nalezeno.' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Vyberte platný obrázek vozidla ke nahrání.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = file.name || `vozidlo-${id}.jpg`;
    const photoId = `vehicle-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    await prisma.photo.create({
      data: {
        id: photoId,
        fileName,
        mimeType: file.type || 'image/jpeg',
        content: new Uint8Array(buffer),
        url: `/api/photos/${photoId}/file`,
        type: 'BEFORE_INSTALLATION',
      },
    });

    const photoUrl = `/api/photos/${photoId}/file`;
    await prisma.vehicle.update({
      where: { id },
      data: { photoUrl },
    });

    return NextResponse.json({ photoUrl });
  } catch (error) {
    console.error('Vehicle photo upload error:', error);
    return NextResponse.json({ error: 'Nahrání fotografie vozidla selhalo.' }, { status: 500 });
  }
}
