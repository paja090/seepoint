import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/rbac';
import { downloadPhotoFromGoogleDrive, GoogleDriveConfigurationError } from '@/lib/google-drive';
import { canAccessOffer } from '@/lib/offers/domain';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });

  try {
    const { id } = await params;
    const photo = await prisma.photo.findUnique({
      where: { id },
      select: {
        id: true,
        url: true,
        driveFileId: true,
        content: true,
        fileName: true,
        mimeType: true,
        employeeId: true,
        type: true,
        workEntryId: true,
        isPrivate: true,
        carrierId: true,
        surfaceId: true,
        siteNavigationPoint: {
          select: {
            navigationOffer: {
              select: {
                offer: {
                  select: { createdByUserId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!photo || (!photo.driveFileId && !photo.content && !photo.url)) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    let allowed = false;
    const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

    if (photo.type === 'EXPENSE_RECEIPT' || photo.isPrivate) {
      if (isManagerOrAdmin) {
        allowed = true;
      } else if (photo.workEntryId) {
        const entry = await prisma.workEntry.findUnique({
          where: { id: photo.workEntryId },
          select: { employee: { select: { id: true, userId: true } } },
        });
        if (entry) {
          allowed = entry.employee.userId === user.id || entry.employee.id === user.employee?.id;
        }
      }
    } else if (photo.employeeId) {
      allowed = user.employee?.id === photo.employeeId || canAccess(user.role, 'employees');
    } else {
      allowed =
        canAccess(user.role, 'carriers') ||
        canAccess(user.role, 'offers') ||
        canAccess(user.role, 'navigationProjects') ||
        photo.type === 'SURVEY' ||
        photo.type === 'CARRIER' ||
        photo.type === 'LOCATION' ||
        Boolean(photo.carrierId || photo.surfaceId || photo.siteNavigationPoint);
    }

    if (!allowed) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    // 1. Binary content stored directly in DB
    if (photo.content) {
      return new Response(photo.content, {
        status: 200,
        headers: {
          'Content-Type': photo.mimeType ?? 'application/octet-stream',
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ?? 'photo')}`,
          'Cache-Control': 'private, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // 2. Data URL (Base64) stored in url field
    if (photo.url && photo.url.startsWith('data:')) {
      const parts = photo.url.split(';');
      const mime = parts[0].replace('data:', '') || photo.mimeType || 'image/jpeg';
      const base64Data = parts[1].replace('base64,', '');
      const buffer = Buffer.from(base64Data, 'base64');
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ?? 'photo')}`,
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // 3. Google Drive file storage (primary storage for uploaded photos)
    if (photo.driveFileId) {
      const file = await downloadPhotoFromGoogleDrive(photo.driveFileId);
      if (!file.ok || !file.body) {
        return NextResponse.json({ error: 'Fotografii se nepodařilo načíst z Google Disku.' }, { status: file.status === 404 ? 404 : 502 });
      }
      return new Response(file.body, {
        status: 200,
        headers: {
          'Content-Type': photo.mimeType ?? file.headers.get('Content-Type') ?? 'application/octet-stream',
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ?? 'photo')}`,
          'Cache-Control': 'private, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // 4. External HTTP / URL link stored in url field (excluding self-referencing endpoint URLs)
    if (
      photo.url &&
      (photo.url.startsWith('http://') || photo.url.startsWith('https://')) &&
      !photo.url.includes(`/api/photos/${photo.id}`)
    ) {
      return NextResponse.redirect(photo.url);
    }

    return NextResponse.json({ error: 'Fotografie nemá platný zdroj dat.' }, { status: 404 });
  } catch (error) {
    console.error('Photo download failed', error instanceof Error ? error.message : 'unknown error');
    if (error instanceof GoogleDriveConfigurationError) {
      return NextResponse.json({ error: 'Google Drive úložiště zatím není nakonfigurované.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 502 });
  }
}
