import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import {
  buildSnapshotItem,
  documentationPhotoSelect,
  getDeterministicReportToken,
  isSurfaceForClients,
  resolveDocumentationPhotos,
  resolveDocumentationDirection,
  runPrePublishChecks,
} from '@/lib/navigation-documentation';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  try {
    const report = await prisma.navigationDocumentationReport.findFirst({
      where: { id, organizationId: auth.organizationId },
      include: {
        client: true,
        items: {
          include: {
            navigationPoint: {
              include: {
                installedPhoto: { select: documentationPhotoSelect },
                sitePhoto: { select: documentationPhotoSelect },
                surface: {
                  include: {
                    photos: { where: { isPrivate: false }, orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }], select: documentationPhotoSelect },
                    occupancies: { select: { clientId: true } },
                  },
                },
                carrier: {
                  include: {
                    photos: { where: { isPrivate: false }, orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }], select: documentationPhotoSelect },
                    surfaces: {
                      include: {
                        photos: { where: { isPrivate: false }, orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }], select: documentationPhotoSelect },
                        occupancies: { select: { clientId: true } },
                      },
                    },
                  },
                },
              },
            },
            carrier: {
              include: {
                photos: { where: { isPrivate: false }, orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }], select: documentationPhotoSelect },
                surfaces: {
                  include: {
                    photos: { where: { isPrivate: false }, orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }], select: documentationPhotoSelect },
                    occupancies: { select: { clientId: true } },
                  },
                },
              },
            },
            selectedPhoto: {
              include: {
                surface: {
                  select: {
                    id: true,
                    name: true,
                    currentClientId: true,
                    occupancies: { select: { clientId: true } },
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    if (report.status === 'ARCHIVED') {
      return NextResponse.json({ error: 'Archivovaný report nelze publikovat.' }, { status: 409 });
    }

    const { token, hash } = getDeterministicReportToken(id);

    // Freeze snapshot for each item
    const publishedAt = new Date();
    const tokenExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const updated = await prisma.$transaction(async (tx) => {
      for (const item of report.items) {
        if (!item.isVisible) continue;
        const carrier = item.carrier || item.navigationPoint?.carrier;
        const clientIds = [report.clientId];

        const isPhotoDisallowed =
          item.selectedPhoto?.surface &&
          !isSurfaceForClients(item.selectedPhoto.surface, clientIds);

        const preferredPhotoId = isPhotoDisallowed ? null : item.selectedPhotoId;

        const { selectedPhoto } = resolveDocumentationPhotos({
          point: item.navigationPoint,
          carrier,
          allClientIds: clientIds,
          preferredPhotoId,
        });

        const currentCustomDirection =
          item.snapshot && typeof item.snapshot === 'object' && 'direction' in item.snapshot
            ? String((item.snapshot as Record<string, unknown>).direction || '')
            : resolveDocumentationDirection({
                point: item.navigationPoint,
                carrier,
                allClientIds: clientIds,
              }) || item.navigationPoint?.orientation || null;

        const snapshotData = buildSnapshotItem({
          id: item.id,
          clientNote: item.clientNote,
          customDirection: currentCustomDirection,
          surface: item.navigationPoint?.surface ?? null,
          navigationPoint: item.navigationPoint,
          carrier,
          selectedPhoto,
        });

        await tx.navigationDocumentationItem.update({
          where: { id: item.id, organizationId: auth.organizationId },
          data: {
            selectedPhotoId: selectedPhoto?.id ?? (isPhotoDisallowed ? null : item.selectedPhotoId),
            snapshot: snapshotData as unknown as object,
          },
        });
      }

      return tx.navigationDocumentationReport.update({
        where: { id, organizationId: auth.organizationId },
        data: {
          status: 'PUBLISHED',
          publishedAt,
          sentAt: null,
          publicTokenHash: hash,
          tokenExpiresAt,
          auditLogs: {
            create: {
              organizationId: auth.organizationId,
              actorUserId: auth.id,
              action: 'PUBLISHED',
              tokenExpiresAt,
              message: 'Report byl publikován se zmrazeným snapshotem dat a novým přístupovým odkazem.',
            },
          },
        },
        include: { client: true, items: true },
      });
    }, { isolationLevel: 'Serializable' });

    const publicUrl = `/client/navigation-documentation/${token}`;

    return NextResponse.json({
      report: updated,
      token,
      publicUrl,
    });
  } catch (error: unknown) {
    console.error('[navigation/documentation/publish] Publishing failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Report se nepodařilo publikovat.' }, { status: 500 });
  }
}
