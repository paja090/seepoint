import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.employee) {
    return NextResponse.json({ error: 'Nejste přihlášeni nebo nemáte zaměstnanecký profil.' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    let photoUrl: string | null = null;
    let fileName = `profile-${user.employee.id}.jpg`;
    let fileBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const urlInput = formData.get('photoUrl') as string | null;

      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer();
        fileBuffer = Buffer.from(bytes);
        mimeType = file.type || 'image/jpeg';
        fileName = file.name || fileName;
      } else if (urlInput?.trim()) {
        photoUrl = urlInput.trim();
      }
    } else {
      const body = (await request.json().catch(() => null)) as { photoUrl?: string; imageBase64?: string } | null;
      if (body?.photoUrl?.trim()) {
        photoUrl = body.photoUrl.trim();
      } else if (body?.imageBase64?.trim()) {
        const base64Data = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        fileBuffer = Buffer.from(base64Data, 'base64');
      }
    }

    const photoId = `avatar-${user.employee.id}-${Date.now()}`;

    if (fileBuffer) {
      photoUrl = `/api/photos/${photoId}/file`;
    }

    if (!photoUrl) {
      return NextResponse.json({ error: 'Vyberte fotografii nebo zadejte její platnou URL adresu.' }, { status: 400 });
    }

    // Deactivate previous primary photos for this employee
    await prisma.photo.updateMany({
      where: { employeeId: user.employee.id },
      data: { isPrimary: false },
    });

    // Save photo
    const photo = await prisma.photo.create({
      data: {
        id: photoId,
        employeeId: user.employee.id,
        url: photoUrl,
        fileName,
        mimeType,
        size: fileBuffer?.byteLength ?? null,
        content: fileBuffer ? new Uint8Array(fileBuffer) : undefined,
        isPrimary: true,
        type: 'CARRIER',
        note: 'Profilová fotografie uživatele',
        capturedByWorkerUserId: user.id,
        capturedByWorkerName: `${user.employee.firstName} ${user.employee.lastName}`,
      },
    });

    return NextResponse.json({ ok: true, photoUrl: photo.url });
  } catch (err) {
    console.error('Error uploading profile photo:', err);
    return NextResponse.json({ error: 'Chyba při ukládání profilové fotografie.' }, { status: 500 });
  }
}
