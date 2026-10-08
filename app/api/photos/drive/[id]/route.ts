import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { downloadPhotoFromGoogleDrive, verifyFileInTenantStorage, GoogleDriveConfigurationError } from '@/lib/google-drive';
import { prisma } from '@/lib/db';
import { runWithTenantContext } from '@/lib/tenant-context';
import { canReadPhoto } from '@/lib/photo-access';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }
  if (!user.organizationId) {
    return NextResponse.json({ error: 'Aktivní organizace není vybraná.' }, { status: 403 });
  }

  return runWithTenantContext({ organizationId: user.organizationId, userId: user.id, source: 'session' }, async () => {
    try {
      const driveFileId = (await params).id;
      if (!driveFileId) {
        return NextResponse.json({ error: 'Chybí ID souboru.' }, { status: 400 });
      }

      const linkedPhoto = await prisma.photo.findFirst({
        where: { organizationId: user.organizationId!, driveFileId },
        select: {
          id: true, employeeId: true, type: true, workEntryId: true,
          workOrderItemId: true, isPrivate: true, carrierId: true, surfaceId: true,
          siteNavigationPoints: { take: 1, select: { id: true } },
        },
      });
      if (linkedPhoto && !await canReadPhoto(user, linkedPhoto)) {
        return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
      }
      // Files without an application record have no per-photo access policy.
      // Only tenant administrators/managers may browse these raw storage files.
      if (!linkedPhoto && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
        return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
      }
      // Existing tenant photos may predate organization folders. Unlinked files
      // must prove ownership through Drive metadata before any bytes are served.
      if (!linkedPhoto && !await verifyFileInTenantStorage(driveFileId, user.organizationId!)) {
        return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
      }
      const file = await downloadPhotoFromGoogleDrive(driveFileId);
      if (!file.ok || !file.body) {
        return NextResponse.json(
          { error: 'Fotografii se nepodařilo načíst z Google Disku.' },
          { status: file.status === 404 ? 404 : 502 }
        );
      }

      return new Response(file.body, {
        status: 200,
        headers: {
          'Content-Type': file.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      console.error('Google Drive photo fetch error:', error);
      if (error instanceof GoogleDriveConfigurationError) {
        return NextResponse.json({ error: 'Google Drive úložiště není nakonfigurované.' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Chyba při načítání fotografie.' }, { status: 502 });
    }
  });
}
