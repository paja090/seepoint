import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Vyberte platný PDF soubor ke nahrání.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = file.name || 'podklady.pdf';
    const photoId = `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    await prisma.photo.create({
      data: {
        id: photoId,
        fileName,
        mimeType: file.type || 'application/pdf',
        content: new Uint8Array(buffer),
        url: `/api/photos/${photoId}/file`,
        type: 'BEFORE_INSTALLATION',
      },
    });

    return NextResponse.json({ url: `/api/photos/${photoId}/file`, fileName });
  } catch {
    return NextResponse.json({ error: 'Nahrání PDF souboru selhalo.' }, { status: 500 });
  }
}
