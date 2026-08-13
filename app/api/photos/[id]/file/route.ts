import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/rbac';
import { downloadPhotoFromGoogleDrive, GoogleDriveConfigurationError } from '@/lib/google-drive';
import { canAccessOffer } from '@/lib/offers/domain';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  try {
    const photo = await prisma.photo.findUnique({
      where: { id: (await params).id },
      select: { driveFileId: true, content: true, fileName: true, mimeType: true, employeeId: true, type: true, workEntryId: true, isPrivate: true, carrierId: true, surfaceId: true, siteNavigationPoint: { select: { navigationOffer: { select: { offer: { select: { createdByUserId: true } } } } } } },
    });
    if (!photo || (!photo.driveFileId && !photo.content)) return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });

    let allowed = false;
    const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

    if (photo.type === 'EXPENSE_RECEIPT' || photo.isPrivate) {
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
      allowed = user.employee?.id === photo.employeeId || canAccess(user.role, 'employees');
    } else {
      allowed = canAccess(user.role, 'carriers')
        || (canAccess(user.role, 'navigationProjects') && Boolean(photo.carrierId || photo.surfaceId || photo.siteNavigationPoint))
        || (canAccess(user.role, 'offers') && Boolean(photo.siteNavigationPoint) && canAccessOffer(user, photo.siteNavigationPoint?.navigationOffer?.offer.createdByUserId ?? null));
    }

    if (!allowed) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    if (photo.content) {
      return new Response(photo.content, { status: 200, headers: {'Content-Type':photo.mimeType??'application/octet-stream','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(photo.fileName??'photo')}`,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'} });
    }
    const file = await downloadPhotoFromGoogleDrive(photo.driveFileId!);
    if (!file.ok || !file.body) return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: file.status === 404 ? 404 : 502 });
    return new Response(file.body, { status:200, headers:{'Content-Type':photo.mimeType??file.headers.get('Content-Type')??'application/octet-stream','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(photo.fileName??'photo')}`,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'} });
  } catch (error) {
    console.error('Photo download failed', error instanceof Error ? error.message : 'unknown error');
    if (error instanceof GoogleDriveConfigurationError) return NextResponse.json({ error: 'Google Drive úložiště zatím není nakonfigurované.' }, { status: 503 });
    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 502 });
  }
}
