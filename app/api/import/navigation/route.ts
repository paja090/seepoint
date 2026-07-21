import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { parseMountingType, parseNavigationImport } from '@/lib/navigation-import';
import { buildNavigationImportPlan, normalizeClientName } from '@/lib/navigation-import-plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ImportSource = { sheetName: string; text: string };
type ImportRequest = {
  mode?: 'preview' | 'commit';
  sources?: ImportSource[];
  planHash?: string;
  confirmation?: string;
};

function readSources(value: unknown): ImportSource[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) {
    throw new Error('Vyberte 1 až 10 městských listů.');
  }

  let totalLength = 0;
  const sources = value.map((source) => {
    if (!source || typeof source !== 'object') throw new Error('Neplatný formát zdrojových dat.');
    const sheetName = 'sheetName' in source && typeof source.sheetName === 'string' ? source.sheetName.trim() : '';
    const text = 'text' in source && typeof source.text === 'string' ? source.text : '';
    if (!sheetName || !text.trim()) throw new Error('Každý list musí mít název a data.');
    totalLength += text.length;
    return { sheetName: sheetName.slice(0, 160), text };
  });

  if (totalLength > 12_000_000) throw new Error('Importní data jsou příliš velká. Maximum je přibližně 12 MB.');
  return sources;
}

function importKeyMatches(request: Request) {
  const expected = process.env.IMPORT_SECRET;
  const supplied = request.headers.get('x-import-key');
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  const czechMatch = /^(\d{1,2})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{4})$/.exec(trimmed);
  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : czechMatch
      ? { year: Number(czechMatch[3]), month: Number(czechMatch[2]), day: Number(czechMatch[1]) }
      : undefined;
  if (!parts) return undefined;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return date.getUTCFullYear() === parts.year && date.getUTCMonth() === parts.month - 1 && date.getUTCDate() === parts.day
    ? date
    : undefined;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(request: Request) {
  const auth = await requireApiAccess('import'); if (isApiDenied(auth)) return auth;
  try {
    const body = await request.json() as ImportRequest;
    const sources = readSources(body.sources);
    const reports = sources.map((source) => parseNavigationImport(source.text, source.sheetName));
    const plan = buildNavigationImportPlan(reports);

    if (body.mode !== 'commit') return NextResponse.json({ reports, plan });

    if (body.confirmation !== 'IMPORTOVAT') {
      return NextResponse.json({ error: 'Chybí výslovné potvrzení importu.' }, { status: 400 });
    }
    if (body.planHash !== plan.planHash) {
      return NextResponse.json({ error: 'Data se od vytvoření reportu změnila. Vytvořte nový náhled.' }, { status: 409 });
    }
    if (!process.env.IMPORT_SECRET) {
      return NextResponse.json({ error: 'Na Vercelu zatím není nastavený IMPORT_SECRET. Náhled funguje, zápis je bezpečně uzamčený.' }, { status: 503 });
    }
    if (!importKeyMatches(request)) {
      return NextResponse.json({ error: 'Importní klíč není správný.' }, { status: 403 });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const batch = await transaction.importBatch.create({
        data: {
          fileName: sources.map((source) => source.sheetName).join(', ').slice(0, 500),
          sourceType: 'NAVIGATION_CSV_TSV',
          status: 'VALIDATED',
          totalRows: plan.stats.navigations,
          validRows: plan.stats.navigations - plan.stats.reviewRows,
          errorRows: plan.stats.reviewRows,
          startedAt: new Date(),
          mapping: jsonValue({
            planHash: plan.planHash,
            sheets: sources.map((source) => source.sheetName),
            grouping: 'list + cislo sloupu + ulice; jinak presna GPS; jinak samostatny radek',
          }),
        },
      });

      const clientInputs: Prisma.ClientCreateManyInput[] = [...new Map(
        plan.carriers.flatMap((carrier) => carrier.navigations.map(({ row }) => [
          normalizeClientName(row.clientName),
          { name: row.clientName, normalizedName: normalizeClientName(row.clientName), active: true },
        ] as const)),
      ).values()].filter((client) => client.normalizedName);
      if (clientInputs.length) await transaction.client.createMany({ data: clientInputs, skipDuplicates: true });
      const clients = await transaction.client.findMany({
        where: { normalizedName: { in: clientInputs.map((client) => client.normalizedName) } },
      });
      const clientsByName = new Map(clients.map((client) => [client.normalizedName, client]));

      const carrierInputs: Prisma.AdvertisingCarrierCreateManyInput[] = plan.carriers.map((carrier) => ({
        name: carrier.name,
        code: carrier.code,
        type: 'NAVIGATION',
        latitude: carrier.latitude,
        longitude: carrier.longitude,
        gpsStatus: carrier.gpsStatus,
        address: carrier.address,
        city: carrier.city,
        cadastralArea: carrier.cadastralArea,
        structureCode: carrier.structureCode,
        mountingType: parseMountingType(carrier.structureCode),
        status: 'ACTIVE',
        sourceSystem: 'NAVIGATION_IMPORT',
        sourceSheet: carrier.navigations[0]?.row.sheetName,
        sourceRow: Math.min(...carrier.navigations.map(({ row }) => row.sourceRow)),
        sourceKey: carrier.sourceKey,
        importBatchId: batch.id,
      }));
      const createdCarriers = await transaction.advertisingCarrier.createMany({ data: carrierInputs, skipDuplicates: true });
      const carrierRows = await transaction.advertisingCarrier.findMany({
        where: { sourceKey: { in: plan.carriers.map((carrier) => carrier.sourceKey) } },
      });
      const carriersByKey = new Map(carrierRows.map((carrier) => [carrier.sourceKey, carrier]));

      const surfaceInputs: Prisma.AdvertisingSurfaceCreateManyInput[] = plan.carriers.flatMap((carrier) => {
        const carrierRow = carriersByKey.get(carrier.sourceKey);
        if (!carrierRow) return [];
        return carrier.navigations.map(({ row, sourceKey }) => {
          const client = clientsByName.get(normalizeClientName(row.clientName));
          const noteParts = [
            row.note,
            row.mapUrl ? `Zdrojová mapa: ${row.mapUrl}` : undefined,
            row.photoReferences.length ? `Zdrojové foto: ${row.photoReferences.join(', ')}` : undefined,
          ].filter(Boolean);
          return {
            carrierId: carrierRow.id,
            currentClientId: client?.id,
            importBatchId: batch.id,
            name: row.sourcePosition ? `Navigace ${row.sourcePosition}` : `Navigace – řádek ${row.sourceRow}`,
            mediaType: 'NAVIGATION_SIGN',
            sourcePosition: row.sourcePosition,
            directionDescription: row.directionDescription,
            rawMediaType: row.rawMediaType,
            sourceKey,
            orientation: row.directionDescription,
            status: client ? 'OCCUPIED' : 'AVAILABLE',
            note: noteParts.join(' | ') || undefined,
          } satisfies Prisma.AdvertisingSurfaceCreateManyInput;
        });
      });
      const createdSurfaces = await transaction.advertisingSurface.createMany({ data: surfaceInputs, skipDuplicates: true });
      const surfaceRows = await transaction.advertisingSurface.findMany({
        where: { sourceKey: { in: surfaceInputs.map((surface) => surface.sourceKey).filter((key): key is string => Boolean(key)) } },
      });
      const surfacesByKey = new Map(surfaceRows.map((surface) => [surface.sourceKey, surface]));

      const existingOccupancies = await transaction.occupancy.findMany({
        where: {
          surfaceId: { in: surfaceRows.map((surface) => surface.id) },
          campaignName: 'Navigace – import',
        },
      });
      const occupiedSurfaceIds = new Set(existingOccupancies.map((occupancy) => occupancy.surfaceId));
      const occupancyInputs: Prisma.OccupancyCreateManyInput[] = [];
      const errorInputs: Prisma.ImportRowErrorCreateManyInput[] = [];

      plan.carriers.forEach((carrier) => carrier.navigations.forEach(({ row, sourceKey }) => {
        const surface = surfacesByKey.get(sourceKey);
        const client = clientsByName.get(normalizeClientName(row.clientName));
        const dateFrom = parseDate(row.dateFrom);
        const dateTo = parseDate(row.dateTo);
        if (surface && client && dateFrom && dateTo && !occupiedSurfaceIds.has(surface.id)) {
          occupancyInputs.push({
            surfaceId: surface.id,
            clientId: client.id,
            clientName: client.name,
            campaignName: 'Navigace – import',
            dateFrom,
            dateTo,
            status: dateTo < new Date() ? 'FINISHED' : dateFrom <= new Date() ? 'OCCUPIED' : 'RESERVED',
            note: `Import z listu ${row.sheetName}, řádek ${row.sourceRow}`,
          });
        } else if ((row.dateFrom || row.dateTo) && (!dateFrom || !dateTo)) {
          errorInputs.push({
            batchId: batch.id,
            rowNumber: row.sourceRow,
            sheetName: row.sheetName,
            field: 'dateFrom/dateTo',
            code: 'INVALID_DATE_RANGE',
            message: 'Datum obsazenosti nebylo úplné nebo mělo neznámý formát.',
            rawData: jsonValue(row),
          });
        }
        row.issues.forEach((issue) => errorInputs.push({
          batchId: batch.id,
          rowNumber: row.sourceRow,
          sheetName: row.sheetName,
          code: issue.code,
          message: issue.message,
          rawData: jsonValue(row),
        }));
      }));

      if (occupancyInputs.length) await transaction.occupancy.createMany({ data: occupancyInputs });
      if (errorInputs.length) await transaction.importRowError.createMany({ data: errorInputs });

      await transaction.importBatch.update({
        where: { id: batch.id },
        data: {
          status: 'IMPORTED',
          importedRows: createdSurfaces.count,
          skippedRows: plan.stats.navigations - createdSurfaces.count,
          errorRows: errorInputs.length,
          finishedAt: new Date(),
        },
      });

      return {
        batchId: batch.id,
        createdCarriers: createdCarriers.count,
        createdNavigations: createdSurfaces.count,
        skippedNavigations: plan.stats.navigations - createdSurfaces.count,
        createdOccupancies: occupancyInputs.length,
        reviewItems: errorInputs.length,
      };
    }, { maxWait: 10_000, timeout: 60_000 });

    return NextResponse.json({ ok: true, planHash: plan.planHash, result });
  } catch (error) {
    console.error('Navigation import failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import se nepodařilo zpracovat.' },
      { status: 400 },
    );
  }
}
