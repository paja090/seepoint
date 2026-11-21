import { deletePhotoRecord, PhotoDeleteError } from '@/lib/photo-delete';
import { enterTenantContext, runWithTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { deleteStoredPhoto } from '@/lib/storage/photo-storage';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiAccess('dashboard');
    if (isApiDenied(auth)) return auth;
    enterTenantContext({ organizationId: auth.organizationId!, userId: auth.id, source: 'session' });
    const id = (await params).id;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
    }

    const photo = await prisma.photo.findUnique({
      where: { id, organizationId: auth.organizationId! },
      // PATCH needs only photo metadata; never transfer a database-stored image.
      omit: { content: true },
    });
    if (!photo) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    // Authorization
    if (photo.employeeId && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Fotografii zaměstnance může měnit pouze administrátor.' }, { status: 403 });
    }
    const canMutate = auth.role === 'ADMIN' || auth.role === 'MANAGER' || photo.capturedByWorkerUserId === auth.id;
    if (!photo.employeeId && !canMutate) return NextResponse.json({ error: 'Tuto fotografii nemáte oprávnění měnit.' }, { status: 403 });

    const { isPrimary, isClientVisible, sortOrder, note, fileName } = body;

    const dataToUpdate: Prisma.PhotoUpdateInput = {};
    if (note !== undefined) dataToUpdate.note = note ? String(note).trim().slice(0, 1000) : null;
    if (isClientVisible !== undefined) dataToUpdate.isClientVisible = !!isClientVisible;
    if (fileName !== undefined) {
      const cleanName = String(fileName).trim().slice(0, 255);
      if (cleanName) {
        dataToUpdate.fileName = cleanName;
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Handle primary flag changes
      if (isPrimary === true && !photo.isPrimary) {
        // Unset any existing primary photo for this carrier/surface
        await tx.photo.updateMany({
          where: {
            carrierId: photo.carrierId,
            surfaceId: photo.surfaceId,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
        dataToUpdate.isPrimary = true;
      } else if (isPrimary === false && photo.isPrimary) {
        // Prevent unsetting primary if it's the only photo, or re-elect next one
        const sibling = await tx.photo.findFirst({
          where: {
            carrierId: photo.carrierId,
            surfaceId: photo.surfaceId,
            id: { not: photo.id },
          },
          orderBy: { sortOrder: 'asc' },
          select: { id: true },
        });
        if (sibling) {
          await tx.photo.update({
            where: { id: sibling.id },
            data: { isPrimary: true },
            select: { id: true },
          });
          dataToUpdate.isPrimary = false;
        }
      }

      // 2. Handle sortOrder changes safely
      if (Number.isInteger(sortOrder) && sortOrder >= 0 && sortOrder !== photo.sortOrder) {
        const allPhotos = await tx.photo.findMany({
          where: {
            carrierId: photo.carrierId,
            surfaceId: photo.surfaceId,
          },
          orderBy: { sortOrder: 'asc' },
          select: { id: true },
        });

        // Filter out current photo, then insert at target index
        const remaining = allPhotos.filter(p => p.id !== photo.id);
        const targetIdx = Math.max(0, Math.min(sortOrder, remaining.length));
        remaining.splice(targetIdx, 0, photo);

        // Save all back in transaction with contiguous orders
        for (let i = 0; i < remaining.length; i++) {
          if (remaining[i].id === photo.id) {
            dataToUpdate.sortOrder = i;
          } else {
            await tx.photo.update({
              where: { id: remaining[i].id },
              data: { sortOrder: i },
              select: { id: true },
            });
          }
        }
      }

      // Apply primary, visibility, note updates
      await tx.photo.update({
        where: { id, organizationId: auth.organizationId! },
        data: dataToUpdate,
        select: { id: true },
      });
    });

    const updated = await prisma.photo.findUnique({ where: { id }, omit: { content: true } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Photo update failed:', error);
    return NextResponse.json({ error: 'Vlastnosti fotografie se nepodařilo uložit.' }, { status: 502 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiAccess('dashboard');
    if (isApiDenied(auth)) return auth;
    const id = (await params).id;
    const photo = await runWithTenantContext({ organizationId: auth.organizationId!, userId:auth.id, source:'session' }, () => deletePhotoRecord(id, auth));

    let storageCleanupPending = false;
    try {
      await runWithTenantContext({organizationId:auth.organizationId!,userId:auth.id,source:'session'},()=>deleteStoredPhoto(photo));
    } catch (cleanupError) {
      storageCleanupPending = true;
      console.error('[photos/delete] Databázový záznam byl odstraněn, úklid externího souboru selhal', cleanupError);
    }

    return NextResponse.json({ ok: true, storageCleanupPending });
  } catch (error) {
    if (error instanceof PhotoDeleteError) return NextResponse.json({error:error.message},{status:error.status});
    console.error('Photo delete failed:', error);
    return NextResponse.json({ error: 'Fotografii se nepodařilo odstranit.' }, { status: 502 });
  }
}
