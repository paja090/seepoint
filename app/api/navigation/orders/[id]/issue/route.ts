import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { PhotoValidationError, photoFileFromDataUrl, validatePhotoFile } from '@/lib/photo-validation';
import { deleteStoredPhoto, storeTenantPhoto } from '@/lib/storage/photo-storage';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';

const ISSUE_TYPES = new Set([
  'Sloup nebyl nalezen', 'Sloup neodpovídá dokumentaci', 'Místo je obsazené jiným nájemcem',
  'Montáž není technicky možná', 'Poškozená konstrukce nebo nosič', 'Chybí cedule z tisku',
  'Nesprávný motiv grafiky', 'Překážka nebo vegetace v místě', 'Jiný provozní problém',
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationProjects');
  if (isApiDenied(auth)) return auth;
  const limited = await enforcePhotoUploadRateLimit(req, auth);
  if (limited) return limited;
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return NextResponse.json({ error: 'Nebyla nalezena organizace pro uložení fotografie.' }, { status: 400 });

  let stored: Awaited<ReturnType<typeof storeTenantPhoto>> | undefined;
  try {
    const navigationOrderId = (await params).id;
    const body = (await req.json().catch(() => null)) as {
      navigationPointId?: string; issueType?: string; issueNote?: string; photoUrl?: string;
    } | null;
    if (!body?.navigationPointId || !body.issueType) {
      return NextResponse.json({ error: 'Chybí navigační bod nebo typ problému.' }, { status: 400 });
    }
    if (!ISSUE_TYPES.has(body.issueType)) return NextResponse.json({ error: 'Vyberte platný typ problému.' }, { status: 400 });

    const point = await prisma.navigationPoint.findFirst({
      where: { id: body.navigationPointId, navigationOrderId },
      select: { id: true, carrierId: true, surfaceId: true },
    });
    if (!point) return NextResponse.json({ error: 'Navigační bod v této zakázce nebyl nalezen.' }, { status: 404 });

    const issueNote = String(body.issueNote || '').trim().slice(0, 1000) || null;
    let photoData: {
      id: string; url: string; fileName: string; mimeType: string;
    } | null = null;
    if (body.photoUrl) {
      const photoId = randomUUID();
      const file = photoFileFromDataUrl(body.photoUrl, `navigation-issue-${point.id}.jpg`);
      const validated = await validatePhotoFile(file);
      const fileName = `navigation-issue-${point.id}-${Date.now()}.jpg`;
      stored = await storeTenantPhoto({ organizationId, photoId, fileName, file: validated!.file });
      photoData = { id: photoId, url: `/api/photos/${photoId}/file`, fileName, mimeType: validated!.mimeType };
    }

    await prisma.$transaction(async (tx) => {
      if (photoData && stored) {
        await tx.photo.create({
          data: {
            id: photoData.id,
            url: photoData.url,
            fileName: photoData.fileName,
            mimeType: photoData.mimeType,
            size: stored.bytes.byteLength,
            driveFileId: stored.driveFileId,
            content: stored.storageProvider === 'DATABASE' ? Buffer.from(stored.bytes) : undefined,
            storageProvider: stored.storageProvider,
            storageKey: stored.storageKey,
            contentChecksum: stored.contentChecksum,
            carrierId: point.carrierId,
            surfaceId: point.surfaceId,
            type: 'DAMAGE',
            note: issueNote || `Závada: ${body.issueType}`,
            isClientVisible: true,
            capturedByWorkerUserId: auth.id,
            capturedByWorkerName: auth.name || auth.email,
            aiStatus: 'SKIPPED',
          },
        });
      }

      await tx.navigationPoint.update({
        where: { id: point.id },
        data: {
          issueReported: true,
          issueType: body.issueType,
          issueNote,
          ...(photoData ? { installedPhotoId: photoData.id } : {}),
        },
      });
    });

    return NextResponse.json({ success: true, photoUrl: photoData?.url || null, storageWarning: stored?.warning || null });
  } catch (error) {
    if (stored) await deleteStoredPhoto(stored).catch(() => undefined);
    if (error instanceof PhotoValidationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('[navigation/issue] Hlášení problému selhalo', error);
    return NextResponse.json({ error: 'Problém v terénu se nepodařilo uložit.' }, { status: 500 });
  }
}
