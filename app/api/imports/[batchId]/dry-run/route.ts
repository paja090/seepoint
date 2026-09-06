import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { requireOrganization } from '@/lib/organization';
import { prisma } from '@/lib/db';
import { executeDryRun } from '@/lib/imports/dry-run';

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
    const { stats, sampleRows } = await executeDryRun(organizationId, batch.id);

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      stats,
      sampleRows,
    });
  } catch (err) {
    console.error('Execute dry-run error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Spuštění kontrolního náhledu selhalo.' },
      { status: 500 }
    );
  }
}
