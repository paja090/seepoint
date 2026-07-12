import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { parseMediaImport } from '@/lib/media-import';
import type { MediaImportKind, MediaImportReport, MediaImportRow } from '@/lib/media-import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ImportSource = { kind: MediaImportKind; text: string };
type ImportRequest = {
  mode?: 'preview' | 'commit';
  sources?: ImportSource[];
  planHash?: string;
  confirmation?: string;
};

const supportedKinds = new Set<MediaImportKind>(['CITY_POSTER', 'PROMO_BENCH', 'PROMO_HORIZON', 'TOWER']);
const blockingIssueCodes = new Set(['GPS_OUTSIDE_CZ', 'INVALID_CITY', 'MISSING_MEDIA_TYPE', 'TYPE_REVIEW']);
const kindNames: Record<MediaImportKind, string> = {
  CITY_POSTER: 'CP25 - MM',
  PROMO_BENCH: 'PL25',
  PROMO_HORIZON: 'PH 2025',
  TOWER: 'T25',
};
const carrierTypes: Record<MediaImportKind, Prisma.AdvertisingCarrierCreateManyInput['type']> = {
  CITY_POSTER: 'CITY_POSTER',
  PROMO_BENCH: 'PROMO_BENCH',
  PROMO_HORIZON: 'PROMO_HORIZON',
  TOWER: 'PROMO_TOWER',
};
const mediaTypes: Record<MediaImportKind, Prisma.AdvertisingSurfaceCreateManyInput['mediaType']> = {
  CITY_POSTER: 'CITY_POSTER',
  PROMO_BENCH: 'PROMO_BENCH',
  PROMO_HORIZON: 'PROMO_HORIZON',
  TOWER: 'PROMO_TOWER',
};

function readSources(value: unknown): ImportSource[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 4) {
    throw new Error('Vyberte 1 až 4 podporované listy.');
  }

  let totalLength = 0;
  const seen = new Set<MediaImportKind>();
  const sources = value.map((source) => {
    if (!source || typeof source !== 'object') throw new Error('Neplatný formát zdrojových dat.');
    const kind = 'kind' in source && typeof source.kind === 'string' ? source.kind as MediaImportKind : undefined;
    const text = 'text' in source && typeof source.text === 'string' ? source.text : '';
    if (!kind || !supportedKinds.has(kind) || !text.trim()) throw new Error('Každý list musí mít podporovaný typ a data.');
    if (seen.has(kind)) throw new Error('Každý typ listu lze vložit pouze jednou.');
    seen.add(kind);
    totalLength += text.length;
    return { kind, text };
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

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function hasBlockingIssue(row: MediaImportRow) {
  return row.issues.some((issue) => blockingIssueCodes.has(issue.code));
}

function carrierSourceKey(row: MediaImportRow) {
  return `MEDIA:${row.kind}:CARRIER:${row.carrierCode}`;
}

function surfaceSourceKey(row: MediaImportRow, side?: string) {
  return `MEDIA:${row.kind}:SURFACE:${row.carrierCode}:${side || row.sourceCode}`;
}

function buildPlan(reports: MediaImportReport[]) {
  const rows = reports.flatMap((report) => report.rows);
  const blockedRows = rows.filter(hasBlockingIssue);
  const importableRows = rows.filter((row) => !hasBlockingIssue(row));
  const canonical = reports.map((report) => ({ kind: report.kind, rows: report.rows }));
  const planHash = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  return {
    planHash,
    stats: {
      sourceRows: rows.length,
      importableRows: importableRows.length,
      blockedRows: blockedRows.length,
      warnings: rows.reduce((sum, row) => sum + row.issues.length, 0),
    },
    rows,
    importableRows,
    blockedRows,
  };
}

function surfaceNames(row: MediaImportRow) {
  return row.kind === 'TOWER' ? ['Strana A', 'Strana B', 'Strana C', 'Strana D'] : [row.surfaceName];
}

export async function POST(request: Request) {
  const auth = await requireApiAccess('import'); if (isApiDenied(auth)) return auth;
  try {
    const body = await request.json() as ImportRequest;
    const sources = readSources(body.sources);
    const reports = sources.map((source) => parseMediaImport(source.kind, source.text));
    const plan = buildPlan(reports);

    if (body.mode !== 'commit') {
      return NextResponse.json({ reports, plan: { planHash: plan.planHash, stats: plan.stats } });
    }

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
          fileName: sources.map((source) => kindNames[source.kind]).join(', '),
          sourceType: 'MEDIA_INVENTORY_TSV',
          status: 'VALIDATED',
          totalRows: plan.stats.sourceRows,
          validRows: plan.stats.importableRows,
          skippedRows: plan.stats.blockedRows,
          errorRows: plan.stats.warnings,
          startedAt: new Date(),
          mapping: jsonValue({
            planHash: plan.planHash,
            sheets: sources.map((source) => kindNames[source.kind]),
            policy: 'Missing GPS and photo are warnings; invalid type, city or out-of-range GPS block the row.',
          }),
        },
      });

      const groupedRows = new Map<string, MediaImportRow[]>();
      plan.importableRows.forEach((row) => {
        const key = carrierSourceKey(row);
        groupedRows.set(key, [...(groupedRows.get(key) || []), row]);
      });

      const carrierInputs: Prisma.AdvertisingCarrierCreateManyInput[] = [...groupedRows.entries()].map(([sourceKey, rows]) => {
        const row = rows.find((candidate) => candidate.latitude !== undefined && candidate.longitude !== undefined) || rows[0];
        return {
          name: row.name,
          code: row.carrierCode,
          type: carrierTypes[row.kind],
          latitude: row.latitude,
          longitude: row.longitude,
          gpsStatus: row.latitude !== undefined && row.longitude !== undefined ? 'UNVERIFIED' : 'MISSING',
          address: row.address || undefined,
          city: row.city,
          mountingType: 'UNKNOWN',
          status: 'ACTIVE',
          note: `Import z listu ${kindNames[row.kind]}`,
          sourceSystem: 'MEDIA_INVENTORY_IMPORT',
          sourceSheet: kindNames[row.kind],
          sourceRow: Math.min(...rows.map((candidate) => candidate.sourceRow)),
          sourceKey,
          importBatchId: batch.id,
        };
      });
      const createdCarriers = carrierInputs.length
        ? await transaction.advertisingCarrier.createMany({ data: carrierInputs, skipDuplicates: true })
        : { count: 0 };
      const carrierRows = await transaction.advertisingCarrier.findMany({
        where: { sourceKey: { in: [...groupedRows.keys()] } },
      });
      const carriersByKey = new Map(carrierRows.map((carrier) => [carrier.sourceKey, carrier]));

      const surfaceInputs: Prisma.AdvertisingSurfaceCreateManyInput[] = plan.importableRows.flatMap((row) => {
        const carrier = carriersByKey.get(carrierSourceKey(row));
        if (!carrier) return [];
        return surfaceNames(row).map((name) => {
          const side = row.kind === 'TOWER' ? name.slice(-1) : undefined;
          const noteParts = [
            `Import z listu ${kindNames[row.kind]}, řádek ${row.sourceRow}`,
            row.photoUrl ? `Zdrojová fotografie: ${row.photoUrl}` : undefined,
          ].filter(Boolean);
          return {
            carrierId: carrier.id,
            importBatchId: batch.id,
            name,
            mediaType: mediaTypes[row.kind],
            sourcePosition: row.sourceCode,
            rawMediaType: row.kind,
            sourceKey: surfaceSourceKey(row, side),
            orientation: side,
            status: 'AVAILABLE',
            note: noteParts.join(' | '),
          } satisfies Prisma.AdvertisingSurfaceCreateManyInput;
        });
      });
      const createdSurfaces = surfaceInputs.length
        ? await transaction.advertisingSurface.createMany({ data: surfaceInputs, skipDuplicates: true })
        : { count: 0 };

      const errorInputs: Prisma.ImportRowErrorCreateManyInput[] = plan.rows.flatMap((row) => row.issues.map((issue) => ({
        batchId: batch.id,
        rowNumber: row.sourceRow,
        sheetName: kindNames[row.kind],
        code: issue.code,
        message: `${hasBlockingIssue(row) ? 'Řádek přeskočen. ' : 'Upozornění, řádek importován. '}${issue.message}`,
        rawData: jsonValue(row),
      })));
      if (errorInputs.length) await transaction.importRowError.createMany({ data: errorInputs });

      await transaction.importBatch.update({
        where: { id: batch.id },
        data: {
          status: 'IMPORTED',
          importedRows: plan.stats.importableRows,
          skippedRows: plan.stats.blockedRows,
          errorRows: errorInputs.length,
          finishedAt: new Date(),
        },
      });

      return {
        batchId: batch.id,
        createdCarriers: createdCarriers.count,
        createdSurfaces: createdSurfaces.count,
        importedRows: plan.stats.importableRows,
        skippedRows: plan.stats.blockedRows,
        reviewItems: errorInputs.length,
      };
    }, { maxWait: 10_000, timeout: 60_000 });

    return NextResponse.json({ ok: true, planHash: plan.planHash, result });
  } catch (error) {
    console.error('Media inventory import failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import se nepodařilo zpracovat.' },
      { status: 400 },
    );
  }
}
