import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type { PhotoType } from '@prisma/client';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { storeTenantPhoto } from '@/lib/storage/photo-storage';
import { safePhotoFileName, validatePhotoFile } from '@/lib/photo-validation';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_PHOTO_TYPES = new Set<PhotoType>([
  'AFTER_INSTALLATION',
  'AFTER_DEINSTALLATION',
  'INSTALLATION',
  'CONTROL',
  'CHECK',
  'DAMAGE',
]);

/**
 * POST /api/crm/realizations/[id]/photos
 * Upload a photo directly to a CRM realization position, tagged with a specific ClientBranch.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  if (!auth.organizationId) {
    return NextResponse.json({ error: 'Chybí aktivní organizace.' }, { status: 400 });
  }

  const organizationId = auth.organizationId;
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  const { id } = await context.params;

  try {
    const realization = await prisma.crmRealization.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        branchId: true,
        carrierId: true,
        surfaceId: true,
        crmOrder: { select: { id: true, clientId: true, branchId: true } },
        workOrderItem: { select: { id: true } },
      },
    });
    if (!realization) {
      return NextResponse.json({ error: 'Realizační pozice nebyla nalezena.' }, { status: 404 });
    }

    const form = await req.formData();
    const validated = await validatePhotoFile(form.get('file'));
    const file = validated!.file;

    const requestedBranchId = form.get('branchId') ? String(form.get('branchId')).trim() : '';
    const note = form.get('note') ? String(form.get('note')).trim().slice(0, 1000) : null;
    const rawType = form.get('type') ? String(form.get('type')).trim().toUpperCase() : 'AFTER_INSTALLATION';
    const photoType: PhotoType = ALLOWED_PHOTO_TYPES.has(rawType as PhotoType)
      ? (rawType as PhotoType)
      : 'AFTER_INSTALLATION';

    let branchId: string | null = realization.branchId ?? realization.crmOrder.branchId ?? null;
    if (requestedBranchId) {
      const branch = await prisma.clientBranch.findFirst({
        where: {
          id: requestedBranchId,
          clientId: realization.crmOrder.clientId,
          organizationId,
          active: true,
        },
        select: { id: true },
      });
      if (!branch) {
        return NextResponse.json({ error: 'Vybraná pobočka nepatří tomuto klientovi.' }, { status: 400 });
      }
      branchId = branch.id;
    }

    const photoId = randomUUID();
    const safeName = safePhotoFileName(file.name, 'realizace.jpg');
    const storedName = `${Date.now()}-${safeName}`;

    const stored = await storeTenantPhoto({
      organizationId,
      photoId,
      fileName: storedName,
      file,
    });

    const created = await prisma.photo.create({
      data: {
        id: photoId,
        organizationId,
        crmRealizationId: realization.id,
        workOrderItemId: realization.workOrderItem?.id ?? null,
        carrierId: realization.carrierId,
        surfaceId: realization.surfaceId,
        branchId,
        type: photoType,
        url: `/api/photos/${photoId}/file`,
        fileName: safeName,
        mimeType: file.type,
        size: file.size,
        note,
        isClientVisible: true,
        isPrivate: false,
        capturedByWorkerUserId: auth.id,
        capturedByWorkerName: auth.name || auth.email,
        storageProvider: stored.storageProvider,
        storageKey: stored.storageKey,
        driveFileId: stored.driveFileId,
        contentChecksum: stored.contentChecksum,
        content: stored.storageProvider === 'DATABASE' ? Buffer.from(stored.bytes) : null,
      },
      include: {
        branch: { select: { id: true, name: true, city: true } },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        photo: {
          id: created.id,
          url: `/api/photos/${encodeURIComponent(created.id)}/file`,
          fileName: created.fileName,
          type: created.type,
          note: created.note,
          branchId: created.branchId,
          branch: created.branch,
          createdAt: created.createdAt.toISOString(),
          capturedByWorkerName: created.capturedByWorkerName,
        },
        warning: stored.warning,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[crm/realizations/[id]/photos] POST failed:', error instanceof Error ? error.message : 'unknown');
    const message = error instanceof Error ? error.message : 'Nahrání fotografie se nezdařilo.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * PATCH /api/crm/realizations/[id]/photos
 * Reassign an existing photo of this realization to a specific ClientBranch (or null).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  if (!auth.organizationId) {
    return NextResponse.json({ error: 'Chybí aktivní organizace.' }, { status: 400 });
  }

  const organizationId = auth.organizationId;
  const { id } = await context.params;

  const body = (await req.json().catch(() => null)) as { photoId?: unknown; branchId?: unknown } | null;
  const photoId = typeof body?.photoId === 'string' ? body.photoId.trim() : '';
  const rawBranchId = body?.branchId;
  const branchId =
    rawBranchId === null || rawBranchId === ''
      ? null
      : typeof rawBranchId === 'string'
        ? rawBranchId.trim()
        : undefined;

  if (!photoId || branchId === undefined) {
    return NextResponse.json({ error: 'Chybí photoId nebo branchId.' }, { status: 400 });
  }

  const realization = await prisma.crmRealization.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      crmOrder: { select: { clientId: true } },
    },
  });
  if (!realization) {
    return NextResponse.json({ error: 'Realizační pozice nebyla nalezena.' }, { status: 404 });
  }

  if (branchId) {
    const branch = await prisma.clientBranch.findFirst({
      where: {
        id: branchId,
        clientId: realization.crmOrder.clientId,
        organizationId,
        active: true,
      },
      select: { id: true },
    });
    if (!branch) {
      return NextResponse.json({ error: 'Vybraná pobočka nepatří tomuto klientovi.' }, { status: 400 });
    }
  }

  const existingPhoto = await prisma.photo.findFirst({
    where: { id: photoId, crmRealizationId: realization.id, organizationId },
    select: { id: true },
  });
  if (!existingPhoto) {
    return NextResponse.json({ error: 'Fotografie pro tuto realizaci nebyla nalezena.' }, { status: 404 });
  }

  const photo = await prisma.photo.update({
    where: { id: existingPhoto.id },
    data: { branchId },
    select: {
      id: true,
      branchId: true,
      branch: { select: { id: true, name: true, city: true } },
    },
  });

  return NextResponse.json({ ok: true, photo });
}
