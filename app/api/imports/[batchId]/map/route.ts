import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { requireOrganization } from '@/lib/organization';
import { prisma } from '@/lib/db';
import type { ColumnMappingProposal, SheetClassificationType } from '@/lib/imports/types';

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
    const body = await request.json();
    const sheetsToUpdate: Array<{
      sheetId: string;
      classification: SheetClassificationType;
      columnMappings: ColumnMappingProposal[];
    }> = body.sheets;

    if (!Array.isArray(sheetsToUpdate) || sheetsToUpdate.length === 0) {
      return NextResponse.json({ error: 'Chybí definice mapování listů.' }, { status: 400 });
    }

    for (const item of sheetsToUpdate) {
      await prisma.importBatchSheet.updateMany({
        where: { id: item.sheetId, batchId: batch.id, organizationId },
        data: {
          classification: item.classification,
          columnMappings: item.columnMappings as any,
          status: 'MAPPED',
        },
      });
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'READY_FOR_DRY_RUN',
      },
    });

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      message: 'Mapování sloupců bylo uloženo.',
    });
  } catch (err) {
    console.error('Save mapping error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Uložení mapování selhalo.' },
      { status: 500 }
    );
  }
}
