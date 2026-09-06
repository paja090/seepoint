import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { requireOrganization } from '@/lib/organization';
import { prisma } from '@/lib/db';
import { analyzeSheetWithAI } from '@/lib/imports/ai-mapping';
import { findProfileByFingerprint, checkSchemaDrift } from '@/lib/imports/profile-service';
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
    include: {
      sheets: {
        orderBy: { sheetIndex: 'asc' },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: 'Dávka importu nebyla nalezena.' }, { status: 404 });
  }

  try {
    // Check if there's an existing profile with matching fingerprint
    const existingProfile = batch.fileHash
      ? await findProfileByFingerprint(organizationId, batch.fileHash)
      : null;

    const analyzedSheets = [];

    for (const sheet of batch.sheets) {
      const headers = (sheet.headers as string[]) || [];
      const sampleRows = (sheet.sampleRows as Array<Record<string, string>>) || [];

      let classification: SheetClassificationType = 'UNKNOWN';
      let confidence = 0.0;
      let mappings: ColumnMappingProposal[] = [];

      // If profile matched, check if it has mappings for this sheet
      if (existingProfile && existingProfile.columnMappings[sheet.name]) {
        classification = existingProfile.sheetAliases?.[sheet.name] || 'CARRIERS';
        confidence = 0.99; // Profile match
        mappings = existingProfile.columnMappings[sheet.name];
      } else {
        // Run AI / rule-based analysis
        const result = await analyzeSheetWithAI(sheet.name, headers, sampleRows);
        classification = result.classification;
        confidence = result.confidence;
        mappings = result.columnMappings;
      }

      // Check schema drift
      const drift = await checkSchemaDrift(organizationId, sheet.name, headers);

      // Save analysis results back to database
      await prisma.importBatchSheet.update({
        where: { id: sheet.id },
        data: {
          classification,
          confidence,
          columnMappings: mappings as any,
          status: 'MAPPED',
        },
      });

      analyzedSheets.push({
        id: sheet.id,
        sheetIndex: sheet.sheetIndex,
        name: sheet.name,
        classification,
        confidence,
        totalRows: sheet.totalRows,
        totalColumns: sheet.totalColumns,
        headers,
        sampleRows,
        columnMappings: mappings,
        schemaDrift: drift.hasDrift ? drift : null,
      });
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'MAPPING_REQUIRED',
      },
    });

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      sheets: analyzedSheets,
      matchedProfile: existingProfile ? existingProfile.name : null,
    });
  } catch (err) {
    console.error('Analyze batch error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analýza listů selhala.' },
      { status: 500 }
    );
  }
}
