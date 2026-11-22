import { importJson } from './json';
import { prisma } from '@/lib/db';
import { cleanText, normalizeCode, normalizeText } from '@/lib/carriers-2026/normalize';
import { calculateHaversineDistanceKm } from '@/lib/opportunities/distance';
import { isReservationHoldExpired, periodsOverlap } from '@/lib/occupancy/availability-service';
import {
  matchCarrier,
  matchClient,
  matchSurface,
  parseImportDateOnly,
  parseOccupancyImportDates,
  parseOccupancyImportStatus,
  type ExistingSurfaceRecord,
} from './matching';
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
  const [batch, sheets, existingCarriersRaw, existingClientsRaw, existingOccupanciesRaw] = await Promise.all([
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
        surfaces: {
          select: {
            id: true,
            carrierId: true,
            name: true,
            mediaType: true,
            sidePosition: true,
            sourceKey: true,
          },
          orderBy: { name: 'asc' },
        },
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
    prisma.occupancy.findMany({
      where: {
        organizationId,
        status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] },
      },
      select: {
        id: true,
        surfaceId: true,
        clientName: true,
        campaignName: true,
        dateFrom: true,
        dateTo: true,
        status: true,
        reservedUntil: true,
      },
    }),
  ]);

  const existingCarriers = existingCarriersRaw.map((c) => ({
    ...c,
    type: String(c.type),
    photoCount: c._count.photos,
  }));

  const surfacesByCarrierId = new Map<string, ExistingSurfaceRecord[]>(
    existingCarriersRaw.map((c) => [
      c.id,
      c.surfaces.map((s) => ({
        id: s.id,
        carrierId: s.carrierId,
        name: s.name,
        mediaType: String(s.mediaType),
        sidePosition: s.sidePosition,
        sourceKey: s.sourceKey,
      })),
    ])
  );

  const now = new Date();
  const activeOccupanciesBySurfaceId = new Map<
    string,
    Array<{
      id: string;
      clientName: string;
      campaignName: string;
      dateFrom: Date;
      dateTo: Date;
      status: string;
      source: 'DB' | 'BATCH';
      rowNumber?: number;
    }>
  >();

  for (const occ of existingOccupanciesRaw) {
    if (isReservationHoldExpired({ status: occ.status, reservedUntil: occ.reservedUntil }, now)) {
      continue;
    }
    const list = activeOccupanciesBySurfaceId.get(occ.surfaceId) ?? [];
    list.push({
      id: occ.id,
      clientName: occ.clientName,
      campaignName: occ.campaignName,
      dateFrom: occ.dateFrom,
      dateTo: occ.dateTo,
      status: occ.status,
      source: 'DB',
    });
    activeOccupanciesBySurfaceId.set(occ.surfaceId, list);
  }

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
    conflictDetails?: DryRunRowResult['conflictDetails'];
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
    let conflictDetails: DryRunRowResult['conflictDetails'];
    const issues: RowIssue[] = [];

    if (classification === 'CLIENTS') {
      targetEntity = 'CLIENT';
      const clientName = String(mappedData.name || mappedData.clientName || '');
      const ico = mappedData.companyId ? String(mappedData.companyId) : undefined;
      if (!mappedData.name && clientName) {
        mappedData.name = clientName;
      }

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
      const priceName = String(mappedData.name || mappedData.carrierType || mappedData.mediaType || mappedData.code || '');
      if (!mappedData.name && priceName) {
        mappedData.name = priceName;
      }
      if (mappedData.price !== undefined && mappedData.rentalPrice === undefined) {
        mappedData.rentalPrice = mappedData.price;
      }

      if (!priceName) {
        action = 'ERROR';
        issues.push({ code: 'MISSING_PRICE_NAME', message: 'Chybí název položky ceníku.', severity: 'error' });
        errorCount++;
      } else {
        action = 'CREATE';
        targetIdentifier = priceName;
        createCount++;
        entityStats.prices.create++;
      }
    } else if (classification === 'OCCUPANCY') {
      targetEntity = 'OCCUPANCY';
      const rawCode = mappedData.carrierCode ? String(mappedData.carrierCode).trim() : '';
      if (!rawCode) {
        action = 'SKIP';
        skipCount++;
      } else {
        const normCode = normalizeCode(rawCode);
        const carrier = existingCarriers.find((c) => normalizeCode(c.code) === normCode);
        if (!carrier) {
          action = 'ERROR';
          targetIdentifier = rawCode;
          issues.push({
            code: 'CARRIER_NOT_FOUND',
            message: `Nosič s kódem „${rawCode}“ nebyl v databázi nalezen.`,
            severity: 'error',
          });
          errorCount++;
        } else {
          const carrierSurfaces = surfacesByCarrierId.get(carrier.id) ?? [];
          const surfMatch = matchSurface(carrierSurfaces, {
            sidePosition: mappedData.sidePosition ? String(mappedData.sidePosition) : null,
            surfaceName: mappedData.surfaceName ? String(mappedData.surfaceName) : null,
          });

          const parsedDates = parseOccupancyImportDates(mappedData);
          if (!parsedDates) {
            action = 'ERROR';
            targetIdentifier = `${carrier.code} (${mappedData.clientName || 'Obsazenost'})`;
            issues.push({
              code: 'MISSING_OR_INVALID_DATES',
              message: 'Chybí platné datum od/do (nebo měsíc obsazenosti).',
              severity: 'error',
            });
            errorCount++;
          } else if (parsedDates.dateFrom > parsedDates.dateTo) {
            action = 'ERROR';
            targetIdentifier = `${carrier.code} (${mappedData.clientName || 'Obsazenost'})`;
            issues.push({
              code: 'INVALID_DATE_RANGE',
              message: `Datum od (${parsedDates.dateFrom.toISOString().slice(0, 10)}) je po datu do (${parsedDates.dateTo.toISOString().slice(0, 10)}).`,
              severity: 'error',
            });
            errorCount++;
          } else if (surfMatch.status === 'NOT_FOUND') {
            action = 'ERROR';
            targetIdentifier = carrier.code;
            issues.push({
              code: 'NO_SURFACE_ON_CARRIER',
              message: `Nosič ${carrier.code} nemá založenou žádnou reklamní plochu.`,
              severity: 'error',
            });
            errorCount++;
          } else if (surfMatch.status === 'AMBIGUOUS') {
            action = 'NEEDS_REVIEW';
            targetIdentifier = `${carrier.code} (neurčená strana)`;
            issues.push({
              code: 'AMBIGUOUS_SURFACE_SIDE',
              message: `Nosič ${carrier.code} má více stran (${surfMatch.candidates.map((s) => s.sidePosition ? `${s.name} [${s.sidePosition}]` : s.name).join(', ')}). Doplňte sloupec Strana (A/B) nebo Název plochy.`,
              severity: 'warning',
            });
            needsReviewCount++;
          } else {
            const surface = surfMatch.surface;
            const dateFromIso = parsedDates.dateFrom.toISOString().slice(0, 10);
            const dateToIso = parsedDates.dateTo.toISOString().slice(0, 10);
            const parsedStatus = parseOccupancyImportStatus(
              mappedData.status,
              parsedDates.dateFrom,
              parsedDates.dateTo,
              now
            );
            const parsedReservedUntil = parseImportDateOnly(mappedData.reservedUntil);
            const clientName = mappedData.clientName ? String(mappedData.clientName).trim() : '';

            // Resolve existing client ID if matched
            if (clientName) {
              const clientMatch = matchClient({ name: clientName }, existingClients);
              if (clientMatch.status === 'MATCHED') {
                mappedData.matchedClientId = clientMatch.client.id;
              }
            }

            mappedData.resolvedSurfaceId = surface.id;
            mappedData.resolvedSurfaceName = surface.name;
            mappedData.dateFrom = dateFromIso;
            mappedData.dateTo = dateToIso;
            mappedData.parsedStatus = parsedStatus;
            if (parsedReservedUntil) {
              mappedData.reservedUntil = parsedReservedUntil.toISOString().slice(0, 10);
            }

            targetEntityId = surface.id;
            targetIdentifier = `${carrier.code} · ${surface.name} (${clientName || mappedData.campaignName || 'Obsazenost'})`;

            // Check date-overlap collisions against DB and earlier rows in this batch
            const surfaceOccupancies = activeOccupanciesBySurfaceId.get(surface.id) ?? [];
            const overlapping = surfaceOccupancies.filter((existingOcc) => {
              if (parsedStatus === 'FINISHED') return false;
              if (existingOcc.status === 'NEGOTIATION' && parsedStatus === 'NEGOTIATION') return false;
              return periodsOverlap(
                parsedDates.dateFrom,
                parsedDates.dateTo,
                existingOcc.dateFrom,
                existingOcc.dateTo
              );
            });

            const hardOverlaps = overlapping.filter(
              (o) => o.status === 'OCCUPIED' || o.status === 'RESERVED'
            );

            if (hardOverlaps.length > 0 && (parsedStatus === 'OCCUPIED' || parsedStatus === 'RESERVED')) {
              const first = hardOverlaps[0];
              const dbRange = `${first.dateFrom.toISOString().slice(0, 10)} – ${first.dateTo.toISOString().slice(0, 10)}`;
              const srcLabel =
                first.source === 'BATCH'
                  ? `řádek #${first.rowNumber} v tomto importu`
                  : 'databáze';
              action = 'CONFLICT';
              conflictDetails = {
                field: 'occupancy_overlap',
                message: `Kolize obsazenosti na ploše ${carrier.code} (${surface.name}): překryv s ${first.clientName} (${dbRange}, zdroj: ${srcLabel}).`,
                dbValue: `${first.clientName} · ${dbRange}`,
                importValue: `${clientName || 'Import'} · ${dateFromIso} – ${dateToIso}`,
              };
              diff.push({
                field: 'occupancy_overlap',
                label: 'Termín obsazenosti',
                oldValue: `${first.clientName} (${dbRange})`,
                newValue: `${clientName || 'Import'} (${dateFromIso} – ${dateToIso})`,
                isCritical: true,
              });
              conflictCount++;
            } else {
              if (overlapping.length > 0) {
                issues.push({
                  code: 'SOFT_OCCUPANCY_OVERLAP',
                  message: `Měkký překryv s opcí/jednáním (${overlapping[0].clientName}).`,
                  severity: 'warning',
                });
              }
              action = 'CREATE';
              createCount++;
              entityStats.occupancies.create++;

              // Register in intra-batch map so subsequent overlapping rows in the same Excel are caught
              if (parsedStatus === 'OCCUPIED' || parsedStatus === 'RESERVED') {
                const list = activeOccupanciesBySurfaceId.get(surface.id) ?? [];
                list.push({
                  id: `batch:${row.id}`,
                  clientName: clientName || 'Import',
                  campaignName: mappedData.campaignName ? String(mappedData.campaignName) : 'Kampaň',
                  dateFrom: parsedDates.dateFrom,
                  dateTo: parsedDates.dateTo,
                  status: parsedStatus,
                  source: 'BATCH',
                  rowNumber: row.rowNumber,
                });
                activeOccupanciesBySurfaceId.set(surface.id, list);
              }
            }
          }
        }
      }
    } else {
      // Default: CARRIER & SURFACE
      targetEntity = 'CARRIER';
      const carrierCode = mappedData.carrierCode ? String(mappedData.carrierCode) : '';
      let city = mappedData.city ? String(mappedData.city) : '';
      const lat = typeof mappedData.latitude === 'number' ? mappedData.latitude : undefined;
      const lon = typeof mappedData.longitude === 'number' ? mappedData.longitude : undefined;

      if (!carrierCode && !mappedData.name && !lat) {
        action = 'SKIP';
        skipCount++;
      } else {
        if (!city) {
          city = 'Nespecifikováno';
          mappedData.city = city;
        }

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

    const isPrioritySample = action === 'CONFLICT' || action === 'ERROR' || action === 'NEEDS_REVIEW';
    if (sampleResults.length < 50 || (isPrioritySample && sampleResults.length < 150)) {
      sampleResults.push({
        rowId: row.id,
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
            diff: importJson(item.diff ?? null),
            conflictDetails: importJson(item.conflictDetails ?? null),
            issues: importJson(item.issues),
            mappedData: importJson(item.mappedData),
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
      dryRunStats: stats,
    },
  });

  return {
    stats,
    sampleRows: sampleResults,
  };
}
