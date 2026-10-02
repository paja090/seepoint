import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { canAccess } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { readStoredPhoto } from '@/lib/storage/photo-storage';

export const runtime = 'nodejs';

/**
 * GET /api/field-survey/photos/[id]/file
 *
 * Bezpečné servírování fotografií z terénního průzkumu.
 * Fotografie jsou striktně odděleny od modelu Photo a nosičů.
 * Přístup je podmíněn RBAC sekcí 'fieldSurvey' a tenant isolation.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  if (!user.organizationId) return NextResponse.json({ error: 'Vyberte organizaci.' }, { status: 403 });

  if (!canAccess(user.role, 'fieldSurvey')) {
    return NextResponse.json({ error: 'Nemáte oprávnění k prohlížení průzkumných fotografií.' }, { status: 403 });
  }

  enterTenantContext({ organizationId: user.organizationId, userId: user.id, source: 'session' });

  try {
    const { id } = await params;
    const photo = await prisma.fieldSurveyPhoto.findFirst({
      where: {
        organizationId: user.organizationId,
        OR: [
          { id },
          { url: { contains: id } },
        ],
      },
      select: {
        id: true,
        url: true,
        driveFileId: true,
        storageKey: true,
        storageProvider: true,
        content: true,
        fileName: true,
        mimeType: true,
      },
    });

    if (!photo || (!photo.driveFileId && !photo.content && !photo.url)) {
      return NextResponse.json({ error: 'Fotografie průzkumu nebyla nalezena.' }, { status: 404 });
    }

    const stored = await readStoredPhoto(photo);
    if (!stored) {
      return NextResponse.json({ error: 'Fotografie nemá platný zdroj dat.' }, { status: 404 });
    }

    if (stored.redirectUrl) {
      return new Response(null, {
        status: 307,
        headers: {
          Location: stored.redirectUrl,
          'Cache-Control': 'private, no-store',
          'Referrer-Policy': 'no-referrer',
        },
      });
    }

    return new Response(stored.body, {
      status: 200,
      headers: {
        'Content-Type': stored.contentType ?? photo.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ?? 'field-survey-photo')}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[field-survey/photos/file] Chyba při čtení fotografie', error);
    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 502 });
  }
}
