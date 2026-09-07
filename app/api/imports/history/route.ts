import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { requireOrganization } from '@/lib/organization';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('import');
  if (isApiDenied(auth)) return auth;

  let organizationId: string;
  try {
    const org = await requireOrganization();
    organizationId = org.organizationId;
  } catch (err) {
    return NextResponse.json({ error: 'Aktivní organizace nebyla nalezena.' }, { status: 403 });
  }

  try {
    const batches = await prisma.importBatch.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        fileName: true,
        sourceType: true,
        status: true,
        totalRows: true,
        validRows: true,
        importedRows: true,
        skippedRows: true,
        errorRows: true,
        dryRunStats: true,
        createdAt: true,
        createdBy: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      batches,
    });
  } catch (err) {
    console.error('Fetch import history error:', err);
    return NextResponse.json({ error: 'Nepodařilo se načíst historii importů.' }, { status: 500 });
  }
}
