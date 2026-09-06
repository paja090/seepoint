import { prisma } from '@/lib/db';
import { cleanText, normalizeCode, normalizeText, parseCoordinate } from '@/lib/carriers-2026/normalize';
import { calculateHaversineDistanceKm } from '@/lib/opportunities/distance';
import { matchCarrier, matchClient } from './matching';
import type {
  ColumnMappingProposal,
  DryRunRowResult,
  DryRunStats,
  FieldDiff,
  RowAction,
  RowIssue,
  TransformRule,
} from './types';

function transformValue(val: string, rule?: TransformRule): unknown {
  const trimmed = cleanText(val);
  if (!trimmed) return null;

  switch (rule) {
    case 'COORDINATES_SPLIT': {
      // Split on comma or space
      const parts = trimmed.split(/[\s,;]+/).map((p) => p.replace(/[°NSEW]/gi, '').replace(',', '.'));
      const lat = Number(parts[0]);
      const lon = Number(parts[1]);
      return {
        latitude: Number.isFinite(lat) && lat >= 48 && lat <= 52 ? lat : null,
        longitude: Number.isFinite(lon) && lon >= 12 && lon <= 19 ? lon : null,
      };
    }
    case 'CURRENCY_CZK': {
      const num = Number(trimmed.replace(/[^\d.,-]/g, '').replace(',', '.'));
      return Number.isFinite(num) ? num : null;
    }
    case 'DATE_ISO': {
      // Try YYYY-MM-DD or DD.MM.YYYY
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      const cz = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
      if (cz) {
        const d = cz[1].padStart(2, '0');
        const m = cz[2].padStart(2, '0');
        return `${cz[3]}-${m}-${d}`;
      }
      return trimmed;
    }
    case 'BOOLEAN_CZECH': {
      const l = trimmed.toLowerCase();
      if (['ano', '1', 'true', 'yes'].includes(l)) return true;
      if (['ne', '0', 'false', 'no'].includes(l)) return false;
      return null;
    }
    case 'UPPERCASE':
      return trimmed.toUpperCase();
    case 'LOWERCASE':
      return trimmed.toLowerCase();
    case 'TRIM':
    default:
      return trimmed;
  }
}

export async function executeDryRun(
  organizationId: string,
  batchId: string
): Promise<{ stats: DryRunStats; sampleRows: DryRunRowResult[] }> {
  const [batch, sheets, existingCarriersRaw, existingClientsRaw] = await Promise.all([
    prisma.importBatch.findFirstOrThrow({
      where: { id: batchId, organizationId },
    }),
    prisma.importBatchSheet.findMany({
      where: { batchId, organizationId },
    }),
    prisma.advertisingCarrier.findMany({
      where: { organizationId },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        city: true,
        street: true,
        latitude: true,
        longitude: true,
        sourceKey: true,
        _count: { select: { photos: true } },
      },
    }),
    prisma.client.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        companyId: true,
      },
    }),
  ]);

  const existingCarriers = existingCarriersRaw.map((c) => ({
    ...c,
    type: String(c.type),
    photoCount: c._count.photos,
  }));

  const existingClients = existingClientsRaw;

  // Pre-load raw rows for this batch
  const rawRows = await prisma.importRow.findMany({
    where: { batchId, organizationId },
    orderBy: { rowNumber: 'asc' },
  });

  const sheetMap = new Map(sheets.map((s) => [s.id, s]));

  let createCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;
  let skipCount = 0;
  let conflictCount = 0;
  let needsReviewCount = 0;
  let errorCount = 0;

  const entityStats = {
    carriers: { create: 0, update: 0, unchanged: 0 },
    surfaces: { create: 0, update: 0, unchanged: 0 },
    clients: { create: 0, update: 0, unchanged: 0 },
    occupancies: { create: 0, update: 0, unchanged: 0 },
    prices: { create: 0, update: 0, unchanged: 0 },
  };

  const processedResults: Array<{
    id: string;
    action: RowAction;
    targetEntity: string;
    targetEntityId?: string;
    diff?: FieldDiff[];
    conflictDetails?: any;
    issues: RowIssue[];
    mappedData: Record<string, unknown>;
  }> = [];

  const sampleResults: DryRunRowResult[] = [];

  for (const row of rawRows) {
    const sheet = row.sheetId ? sheetMap.get(row.sheetId) : null;
    const classification = sheet?.classification || 'CARRIERS';
    const mappings = (sheet?.columnMappings || []) as ColumnMappingProposal[];

    const rawData = (row.rawData || {}) as Record<string, string>;
    const mappedData: Record<string, unknown> = {};

    // Map each column
    for (const mapping of mappings) {
      if (mapping.targetField === 'IGNORE' || mapping.targetField === 'UNKNOWN') continue;
      const rawVal = rawData[mapping.sourceColumn];
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const transformed = transformValue(rawVal, mapping.transformation);
        if (mapping.targetField === 'gpsCoordinates' && typeof transformed === 'object' && transformed) {
          const coords = transformed as { latitude: number | null; longitude: number | null };
          if (coords.latitude) mappedData.latitude = coords.latitude;
          if (coords.longitude) mappedData.longitude = coords.longitude;
        } else {
          mappedData[mapping.targetField] = transformed;
        }
      }
    }

    let action: RowAction = 'CREATE';
    let targetEntity: 'CARRIER' | 'SURFACE' | 'CLIENT' | 'OCCUPANCY' | 'PRICE' = 'CARRIER';
    let targetEntityId: string | undefined;
    let targetIdentifier: string | undefined;
    const diff: FieldDiff[] = [];
    let conflictDetails: any = null;
    const issues: RowIssue[] = [];

    if (classification === 'CLIENTS') {
      targetEntity = 'CLIENT';
      const clientName = String(mappedData.name || '');
      const ico = mappedData.companyId ? String(mappedData.companyId) : undefined;

      if (!clientName) {
        action = 'ERROR';
        issues.push({ code: 'MISSING_CLIENT_NAME', message: 'Chybí název klienta.', severity: 'error' });
        errorCount++;
      } else {
        const match = matchClient({ name: clientName, companyId: ico }, existingClients);
        if (match.status === 'MATCHED') {
          targetEntityId = match.client.id;
          targetIdentifier = match.client.name;
          action = 'UNCHANGED'; // Clients generally unchanged unless updated
          unchangedCount++;
          entityStats.clients.unchanged++;
        } else if (match.status === 'NEEDS_REVIEW') {
          action = 'NEEDS_REVIEW';
          issues.push({
            code: 'SIMILAR_CLIENT_EXISTS',
            message: `Nalezen podobný existující klient: „${match.candidates[0]?.name}“. Ověřte, zda jde o stejnou firmu.`,
            severity: 'warning',
          });
          needsReviewCount++;
        } else {
          action = 'CREATE';
          targetIdentifier = clientName;
          createCount++;
          entityStats.clients.create++;
        }
      }
    } else if (classification === 'PRICES') {
      targetEntity = 'PRICE';
      const priceName = String(mappedData.name || '');
      if (!priceName) {
        action = 'ERROR';
        issues.push({ code: 'MISSING_PRICE_NAME', message: 'Chybí název položky ceníku.', severity: 'error' });
        errorCount++;
      } else {
        action = 'CREATE';
        createCount++;
        entityStats.prices.create++;
      }
    } else if (classification === 'OCCUPANCY') {
      targetEntity = 'OCCUPANCY';
      const code = mappedData.carrierCode ? String(mappedData.carrierCode) : '';
      if (!code) {
        action = 'ERROR';
        issues.push({ code: 'MISSING_OCCUPANCY_TARGET', message: 'Chybí kód plochy.', severity: 'error' });
        errorCount++;
      } else {
        action = 'CREATE';
        createCount++;
        entityStats.occupancies.create++;
      }
    } else {
      // Default: CARRIER & SURFACE
      targetEntity = 'CARRIER';
      const carrierCode = mappedData.carrierCode ? String(mappedData.carrierCode) : '';
      const city = mappedData.city ? String(mappedData.city) : '';
      const lat = typeof mappedData.latitude === 'number' ? mappedData.latitude : undefined;
      const lon = typeof mappedData.longitude === 'number' ? mappedData.longitude : undefined;

      if (!carrierCode && !mappedData.name && !lat) {
        action = 'SKIP';
        skipCount++;
      } else if (!city) {
        action = 'ERROR';
        issues.push({ code: 'MISSING_CITY', message: 'Chybí město/obec nosiče.', severity: 'error' });
        errorCount++;
      } else {
        const match = matchCarrier(
          {
            carrierCode,
            city,
            latitude: lat,
            longitude: lon,
            name: mappedData.name ? String(mappedData.name) : undefined,
          },
          existingCarriers
        );

        if (match.status === 'MATCHED') {
          targetEntityId = match.carrier.id;
          targetIdentifier = match.carrier.code;

          // Check for GPS difference conflict (> 50 meters = 0.05 km)
          if (
            lat !== undefined &&
            lon !== undefined &&
            match.carrier.latitude !== null &&
            match.carrier.longitude !== null
          ) {
            const gpsDistKm = calculateHaversineDistanceKm(
              lat,
              lon,
              match.carrier.latitude,
              match.carrier.longitude
            );
            if (gpsDistKm > 0.05) {
              action = 'CONFLICT';
              conflictDetails = {
                field: 'gps',
                message: `Rozdíl v GPS poloze je ${(gpsDistKm * 1000).toFixed(0)} metrů.`,
                dbValue: `${match.carrier.latitude.toFixed(5)}, ${match.carrier.longitude.toFixed(5)}`,
                importValue: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
              };
              diff.push({
                field: 'gps',
                label: 'GPS souřadnice',
                oldValue: `${match.carrier.latitude}, ${match.carrier.longitude}`,
                newValue: `${lat}, ${lon}`,
                isCritical: true,
              });
              conflictCount++;
            }
          }

          if (action !== 'CONFLICT') {
            // Check for updates on non-critical fields
            let hasChanges = false;
            if (mappedData.name && mappedData.name !== match.carrier.name) {
              diff.push({ field: 'name', label: 'Název', oldValue: match.carrier.name, newValue: mappedData.name });
              hasChanges = true;
            }
            if (mappedData.street && mappedData.street !== match.carrier.street) {
              diff.push({ field: 'street', label: 'Ulice', oldValue: match.carrier.street || '(prázdné)', newValue: mappedData.street });
              hasChanges = true;
            }

            if (hasChanges) {
              action = 'UPDATE';
              updateCount++;
              entityStats.carriers.update++;
            } else {
              action = 'UNCHANGED';
              unchangedCount++;
              entityStats.carriers.unchanged++;
            }
          }
        } else if (match.status === 'CONFLICT') {
          action = 'CONFLICT';
          conflictDetails = {
            field: 'city',
            message: match.reason,
            dbValue: match.carrier.city,
            importValue: city,
          };
          diff.push({
            field: 'city',
            label: 'Město',
            oldValue: match.carrier.city,
            newValue: city,
            isCritical: true,
          });
          conflictCount++;
        } else if (match.status === 'AMBIGUOUS') {
          action = 'NEEDS_REVIEW';
          issues.push({
            code: 'AMBIGUOUS_MATCH',
            message: `Nalezeno více blízkých existujících nosičů (${match.candidates.map((c) => c.code).join(', ')}).`,
            severity: 'warning',
          });
          needsReviewCount++;
        } else {
          action = 'CREATE';
          targetIdentifier = carrierCode || String(mappedData.name || 'Nový nosič');
          createCount++;
          entityStats.carriers.create++;
        }
      }
    }

    processedResults.push({
      id: row.id,
      action,
      targetEntity,
      targetEntityId,
      diff: diff.length > 0 ? diff : undefined,
      conflictDetails: conflictDetails || undefined,
      issues,
      mappedData,
    });

    if (sampleResults.length < 50) {
      sampleResults.push({
        rowNumber: row.rowNumber,
        sheetName: sheet?.name || 'Neznámý list',
        action,
        targetEntity,
        targetEntityId,
        targetIdentifier,
        diff: diff.length > 0 ? diff : undefined,
        conflictDetails: conflictDetails || undefined,
        issues,
        rawData,
        mappedData,
      });
    }
  }

  // Update rows in chunks of 200
  for (let i = 0; i < processedResults.length; i += 200) {
    const chunk = processedResults.slice(i, i + 200);
    await prisma.$transaction(
      chunk.map((item) =>
        prisma.importRow.update({
          where: { id: item.id },
          data: {
            action: item.action,
            targetEntity: item.targetEntity,
            targetEntityId: item.targetEntityId,
            diff: (item.diff as any) || null,
            conflictDetails: item.conflictDetails || null,
            issues: (item.issues as any) || null,
            mappedData: item.mappedData as any,
          },
        })
      )
    );
  }

  const stats: DryRunStats = {
    totalRows: rawRows.length,
    createCount,
    updateCount,
    unchangedCount,
    skipCount,
    conflictCount,
    needsReviewCount,
    errorCount,
    entityStats,
  };

  // Update batch with dryRunStats
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: 'DRY_RUN_COMPLETE',
      validRows: createCount + updateCount + unchangedCount,
      skippedRows: skipCount,
      errorRows: errorCount + conflictCount,
      dryRunStats: stats as any,
    },
  });

  return {
    stats,
    sampleRows: sampleResults,
  };
}
