import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { requireOrganization } from '@/lib/organization';
import { prisma } from '@/lib/db';
import { parseUploadedWorkbook } from '@/lib/imports/parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Nebyl nahrán žádný soubor.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await parseUploadedWorkbook(buffer, file.name);

    // Check idempotence / duplicate file hash
    const existingBatch = await prisma.importBatch.findFirst({
      where: {
        organizationId,
        fileHash: parsed.fileHash,
        status: { in: ['IMPORTED', 'COMPLETED', 'VALIDATED'] },
      },
      select: { id: true, fileName: true, createdAt: true, status: true },
    });

    const isDuplicate = Boolean(existingBatch);
    const totalRowsCount = parsed.sheets.reduce((sum, s) => sum + s.totalRows, 0);

    // Create batch and sheet records in database
    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.importBatch.create({
        data: {
          organizationId,
          fileName: file.name,
          fileSizeBytes: parsed.fileSizeBytes,
          mimeType: file.type || 'application/octet-stream',
          sourceType: file.name.endsWith('.csv') ? 'CSV' : 'XLSX',
          status: 'UPLOADED',
          totalRows: totalRowsCount,
          fileHash: parsed.fileHash,
          createdById: auth.id,
          environment: process.env.VERCEL_ENV || 'local',
        },
      });

      for (const sheet of parsed.sheets) {
        const createdSheet = await tx.importBatchSheet.create({
          data: {
            organizationId,
            batchId: createdBatch.id,
            sheetIndex: sheet.sheetIndex,
            name: sheet.name,
            classification: 'UNKNOWN',
            confidence: 0.0,
            totalRows: sheet.totalRows,
            totalColumns: sheet.totalColumns,
            headers: sheet.headers,
            sampleRows: sheet.sampleRows,
            status: 'PENDING',
          },
        });

        // Insert initial raw rows for lineage (capped at 5000 per sheet in single batch transaction for safety)
        const rowsToInsert = sheet.rows.slice(0, 5000).map((row, idx) => ({
          organizationId,
          batchId: createdBatch.id,
          sheetId: createdSheet.id,
          rowNumber: idx + 2, // 1-indexed row number after header
          rawData: row,
          action: 'PENDING',
        }));

        if (rowsToInsert.length > 0) {
          await tx.importRow.createMany({
            data: rowsToInsert,
          });
        }
      }

      return createdBatch;
    });

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      fileName: file.name,
      fileSizeBytes: parsed.fileSizeBytes,
      fileHash: parsed.fileHash,
      fingerprint: parsed.fingerprint,
      totalRows: totalRowsCount,
      sheets: parsed.sheets.map((s) => ({
        sheetIndex: s.sheetIndex,
        name: s.name,
        totalRows: s.totalRows,
        totalColumns: s.totalColumns,
        headers: s.headers,
        sampleRows: s.sampleRows,
      })),
      isDuplicate,
      duplicateWarning: isDuplicate
        ? `Tento soubor již byl importován dne ${existingBatch?.createdAt.toLocaleDateString('cs-CZ')} (dávka ${existingBatch?.id}).`
        : null,
    });
  } catch (err) {
    console.error('Upload & parse error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Soubor se nepodařilo zpracovat.' },
      { status: 500 }
    );
  }
}
