import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('navigationProjects');
  if (isApiDenied(authResult)) return authResult;

  try {
    const body = await req.json();
    const { navigationPointId, issueType, issueNote, photoUrl } = body;

    if (!navigationPointId || !issueType) {
      return NextResponse.json(
        { error: 'Chybí povinné údaje: navigationPointId, issueType.' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Zaznamenáme fotografii závady, pokud byla pořízena
      let photoId: string | null = null;
      if (photoUrl) {
        const photo = await tx.photo.create({
          data: {
            url: photoUrl,
            type: 'DAMAGE',
            note: issueNote || `Závada: ${issueType}`,
            isClientVisible: true,
          },
        });
        photoId = photo.id;
      }

      // 2. Nastavíme bod do stavu nahlášeného problému (bod se NEOZNAČÍ jako INSTALLED)
      await tx.navigationPoint.update({
        where: { id: navigationPointId },
        data: {
          issueReported: true,
          issueType,
          issueNote: issueNote || null,
          ...(photoId ? { installedPhotoId: photoId } : {}),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chyba při hlášení problému v terénu.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
