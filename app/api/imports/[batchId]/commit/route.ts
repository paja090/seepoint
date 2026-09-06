import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { requireOrganization } from '@/lib/organization';
import { prisma } from '@/lib/db';
import { commitImportBatch } from '@/lib/imports/executor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const auth = await requireApiAccess('import');
  if (isApiDenied(auth)) return auth;

  let organizationId: string;
  try {
    const org = await requireOrganization();
    organizationId = org.organizationId;
  } catch (err) {
    return NextResponse.json({ error: 'Aktivní organizace nebyla nalezena.' }, { status: 403 });
  }

  const { batchId } = await params;

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, organizationId },
  });

  if (!batch) {
    return NextResponse.json({ error: 'Dávka importu nebyla nalezena.' }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== 'IMPORTOVAT') {
      return NextResponse.json(
        { error: 'Pro provedení importu zadejte textové potvrzení „IMPORTOVAT“.' },
        { status: 400 }
      );
    }

    const result = await commitImportBatch(organizationId, batch.id, {
      resolutions: body.resolutions,
      saveProfileAs: body.saveProfileAs,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err) {
    console.error('Commit import error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Zápis importu selhal.' },
      { status: 500 }
    );
  }
}
