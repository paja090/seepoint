import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/rbac';
import { readStoredPhoto } from '@/lib/storage/photo-storage';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });

  try {
    const photo = await prisma.photo.findUnique({
      where: { id: (await params).id },
      select: { id: true, url: true, content: true, driveFileId: true, storageKey: true, storageProvider: true, fileName: true, mimeType: true, employeeId: true, type: true, workEntryId: true, isPrivate: true },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    // Check permissions
    let allowed = false;
    const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

    if (photo.type === 'EXPENSE_RECEIPT' || photo.isPrivate) {
      // Receipt photo - only author or MANAGER/ADMIN
      if (isManagerOrAdmin) {
        allowed = true;
      } else if (photo.workEntryId) {
        const entry = await prisma.workEntry.findUnique({
          where: { id: photo.workEntryId },
          select: { employee: { select: { id: true, userId: true } } }
        });
        if (entry) {
          allowed = entry.employee.userId === user.id || entry.employee.id === user.employee?.id;
        }
      }
    } else if (photo.employeeId) {
      // Profile photo
      allowed = user.employee?.id === photo.employeeId || canAccess(user.role, 'employees');
    } else {
      // Carrier/Surface photo
      allowed = canAccess(user.role, 'carriers');
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const stored = await readStoredPhoto(photo);
    if (!stored) return NextResponse.json({ error: 'Fotografie nemá platný zdroj dat.' }, { status: 404 });
    if (stored.redirectUrl) return NextResponse.redirect(stored.redirectUrl);
    return new Response(stored.body, {
      status: 200,
      headers: {
        'Content-Type': stored.contentType ?? photo.mimeType ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=86400', // Cache thumbnails longer (e.g. 24h)
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Photo thumbnail download failed:', error);
    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 502 });
  }
}
