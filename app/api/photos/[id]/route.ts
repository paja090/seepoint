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
    const id = (await params).id;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
    }

    const photo = await prisma.photo.findUnique({
      where: { id },
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

    const { isPrimary, isClientVisible, sortOrder, note } = body;

    const dataToUpdate: Prisma.PhotoUpdateInput = {};
    if (note !== undefined) dataToUpdate.note = note ? String(note).trim().slice(0, 1000) : null;
    if (isClientVisible !== undefined) dataToUpdate.isClientVisible = !!isClientVisible;

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
        });
        if (sibling) {
          await tx.photo.update({
            where: { id: sibling.id },
            data: { isPrimary: true },
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
            });
          }
        }
      }

      // Apply primary, visibility, note updates
      await tx.photo.update({
        where: { id },
        data: dataToUpdate,
      });
    });

    const updated = await prisma.photo.findUnique({ where: { id } });
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
    const photo = await prisma.photo.findUnique({
      where: { id },
      select: { id: true, driveFileId: true, storageProvider: true, employeeId: true, carrierId: true, surfaceId: true, isPrimary: true, capturedByWorkerUserId: true },
    });
    if (!photo) return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });

    // Authorization checks
    if (photo.employeeId && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Fotografii zaměstnance může odstranit pouze administrátor.' }, { status: 403 });
    }
    const canMutate = auth.role === 'ADMIN' || auth.role === 'MANAGER' || photo.capturedByWorkerUserId === auth.id;
    if (!photo.employeeId && !canMutate) return NextResponse.json({ error: 'Tuto fotografii nemáte oprávnění odstranit.' }, { status: 403 });

    await prisma.$transaction(async (tx) => {
      // Re-elect primary photo if the deleted one was primary
      if (photo.isPrimary) {
        const nextPrimary = await tx.photo.findFirst({
          where: {
            carrierId: photo.carrierId,
            surfaceId: photo.surfaceId,
            id: { not: photo.id },
          },
          orderBy: { sortOrder: 'asc' },
        });

        if (nextPrimary) {
          await tx.photo.update({
            where: { id: nextPrimary.id },
            data: { isPrimary: true },
          });
        }
      }

      // Delete database row
      await tx.photo.delete({ where: { id: photo.id } });

      // Normalize sortOrder for siblings
      const siblings = await tx.photo.findMany({
        where: {
          carrierId: photo.carrierId,
          surfaceId: photo.surfaceId,
        },
        orderBy: { sortOrder: 'asc' },
      });

      for (let i = 0; i < siblings.length; i++) {
        await tx.photo.update({
          where: { id: siblings[i].id },
          data: { sortOrder: i },
        });
      }
    });

    let storageCleanupPending = false;
    try {
      await deleteStoredPhoto(photo);
    } catch (cleanupError) {
      storageCleanupPending = true;
      console.error('[photos/delete] Databázový záznam byl odstraněn, úklid externího souboru selhal', cleanupError);
    }

    return NextResponse.json({ ok: true, storageCleanupPending });
  } catch (error) {
    console.error('Photo delete failed:', error);
    return NextResponse.json({ error: 'Fotografii se nepodařilo odstranit.' }, { status: 502 });
  }
}
