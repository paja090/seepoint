import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { buildImportPlan, validateScopePlan } from '../lib/carriers-2026/plan.ts';
import { writeImportReports, writePhase3Reports } from '../lib/carriers-2026/report.ts';
import { applyResolutionCsv, writeResolutionCsv } from '../lib/carriers-2026/resolutions.ts';
import type { ExistingState, ImportPlan, ImportScope, ScopePlan } from '../lib/carriers-2026/types.ts';
import { parseCarriers2026Workbook } from '../lib/carriers-2026/workbook.ts';
import { enterTenantContext, requireTenantContext } from '../lib/tenant-context.ts';
import { tenantPrismaExtension } from '../lib/tenant-prisma.ts';

type CliOptions = {
  file: string;
  mode: 'dry-run' | 'apply';
  confirmProduction: boolean;
  confirmBackup: boolean;
  validFrom: string;
  reportPrefix?: string;
  resolutions?: string;
  scopes: ImportScope[];
  asOfDate: string;
  plan?: string;
  organizationId: string;
};

function optionValue(args: string[], name: string) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseOptions(args: string[]): CliOptions {
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');
  if (dryRun === apply) throw new Error('Použijte právě jeden režim: --dry-run nebo --apply.');
  const file = optionValue(args, '--file');
  if (!file) throw new Error('Chybí --file cesta k XLSX souboru.');
  const validFrom = optionValue(args, '--valid-from') ?? '2026-01-01';
  const scopeValue = optionValue(args, '--scope') ?? 'inventory,pricing,occupancy';
  const scopes = [...new Set(scopeValue.split(',').map((value) => value.trim()).filter(Boolean))] as ImportScope[];
  if (!scopes.length || scopes.some((scope) => !['inventory', 'pricing', 'occupancy'].includes(scope))) throw new Error('Invalid --scope. Use inventory,pricing,occupancy.');
  const asOfDate = optionValue(args, '--as-of') ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) || Number.isNaN(new Date(`${asOfDate}T00:00:00.000Z`).getTime())) throw new Error('Invalid --as-of date; use YYYY-MM-DD.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) throw new Error('--valid-from musí být ve formátu YYYY-MM-DD.');
  return {
    file: resolve(file), mode: dryRun ? 'dry-run' : 'apply', validFrom,
    confirmProduction: optionValue(args, '--confirm-production') === 'IMPORTOVAT-2026',
    confirmBackup: args.includes('--confirm-backup'), reportPrefix: optionValue(args, '--report-prefix'),
    resolutions: optionValue(args, '--resolutions') ? resolve(optionValue(args, '--resolutions')!) : undefined,
    scopes, asOfDate, plan: optionValue(args, '--plan') ? resolve(optionValue(args, '--plan')!) : undefined,
    organizationId: optionValue(args, '--organization-id') ?? process.env.ORGANIZATION_ID ?? 'org_seepoint_default',
  };
}

function databaseEnvironment(): ImportPlan['databaseEnvironment'] {
  const value = process.env.DATABASE_URL;
  if (!value) return 'unknown';
  try {
    const host = new URL(value).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'local';
    if (process.env.VERCEL_ENV === 'preview' || process.env.IMPORT_DATABASE_ENV === 'preview') return 'preview';
    return 'production';
  } catch {
    return 'unknown';
  }
}

async function readExistingState(prisma: PrismaClient): Promise<ExistingState> {
  const { organizationId } = requireTenantContext();
  const [carriers, clients, photos] = await Promise.all([
    prisma.advertisingCarrier.findMany({
      select: {
        id: true, code: true, name: true, type: true, city: true, locality: true, street: true, address: true,
        latitude: true, longitude: true, sourceKey: true, sourceSystem: true, sourceSheet: true, sourceRow: true,
        _count: { select: { photos: true } },
        surfaces: { select: {
          id: true, name: true, mediaType: true, sourcePosition: true, orientation: true, sourceKey: true,
          occupancies: { select: {
            id: true, clientId: true, clientName: true, campaignName: true, dateFrom: true, dateTo: true, status: true,
            note: true, createdBy: true, updatedBy: true, createdAt: true, updatedAt: true,
          } },
        } },
      },
    }),
    prisma.client.findMany({ select: { id: true, name: true, normalizedName: true, companyId: true, externalCode: true } }),
    prisma.photo.findMany({ select: { id: true, carrierId: true, surfaceId: true, type: true } }),
  ]);
  let prices: ExistingState['prices'] = [];
  try {
    prices = (await prisma.priceListItem.findMany({
      select: { id: true, identityKey: true, versionKey: true, rentalPrice: true, productionPrice: true, totalPrice: true, validFrom: true, validTo: true, isActive: true },
    })).map((price) => ({ ...price, rentalPrice: price.rentalPrice.toFixed(2), productionPrice: price.productionPrice.toFixed(2), totalPrice: price.totalPrice.toFixed(2) }));
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2021') throw error;
  }
  const occupancyMetadata = new Map<string, { sourceSystem: string | null; sourceKey: string | null; externalOrderReference: string | null }>();
  try {
    const columns = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Occupancy' AND column_name = 'externalOrderReference'
      ) AS "exists"
    `);
    if (columns[0]?.exists) {
      const rows = await prisma.$queryRaw<Array<{ id: string; sourceSystem: string | null; sourceKey: string | null; externalOrderReference: string | null }>>(Prisma.sql`
        SELECT "id", "sourceSystem", "sourceKey", "externalOrderReference" FROM "Occupancy"
        WHERE "organizationId" = ${organizationId}
      `);
      rows.forEach(({ id, ...metadata }) => occupancyMetadata.set(id, metadata));
    }
  } catch {
    // Starší databáze bez importních metadat je pro dry-run podporovaná.
  }
  return {
    carriers: carriers.map(({ _count, ...carrier }) => ({ ...carrier, type: String(carrier.type), photoCount: _count.photos,
      surfaces: carrier.surfaces.map((surface) => ({ ...surface, mediaType: String(surface.mediaType), occupancies: surface.occupancies.map((occupancy) => ({ ...occupancy, ...occupancyMetadata.get(occupancy.id), status: String(occupancy.status) })) })),
    })),
    clients,
    photos: photos.map((photo) => ({ ...photo, type: String(photo.type) })),
    prices,
  };
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function loadVerifiedPlan(path: string | undefined, current: ImportPlan, options: CliOptions) {
  if (!path) throw new Error('--apply requires an explicit --plan created by dry-run.');
  const saved = JSON.parse(await readFile(path, 'utf8')) as ScopePlan;
  if (options.asOfDate !== current.asOfDate) throw new Error('asOfDate does not match the current plan.');
  return validateScopePlan(saved, current, options.scopes);
}

async function applyPlan(prisma: PrismaClient, plan: ImportPlan, options: CliOptions, jsonReportPath: string, verifiedPlan: ScopePlan, scope: ImportScope) {
  if (plan.databaseEnvironment === 'production' && !options.confirmProduction) {
    throw new Error('Produkční databáze vyžaduje --confirm-production=IMPORTOVAT-2026.');
  }
  if (!options.confirmBackup) {
    throw new Error('Před importem vytvořte zálohu a potvrďte ji parametrem --confirm-backup.');
  }
  if (plan.safetyGate.blocked) {
    throw new Error('Apply je zablokovaný: report obsahuje nejednoznačné shody, nejednoznačné kampaně nebo kolize obsazenosti.');
  }

  const allowedKeys = new Set(verifiedPlan.operations.filter((operation) => operation.scope === scope).map(({ recordKey }) => recordKey));
  return prisma.$transaction(async (transaction) => {
    const batch = await transaction.importBatch.create({ data: {
      fileName: plan.workbook.fileName, sourceType: 'CARRIERS_2026_XLSX', status: 'VALIDATED', fileHash: plan.fileHash,
      reportPath: jsonReportPath, environment: plan.databaseEnvironment, totalRows: allowedKeys.size,
      validRows: allowedKeys.size, skippedRows: 0, errorRows: 0,
      startedAt: new Date(), mapping: jsonValue({ scope, planHash: verifiedPlan.planHash, sourceFileHash: plan.fileHash, asOfDate: plan.asOfDate, stats: plan.stats }),
    } });
    const carrierIds = new Map<string, string>();
    for (const item of plan.carriers) {
      if (scope !== 'inventory' || !allowedKeys.has(item.source.sourceKey)) continue;
      if (item.action === 'AMBIGUOUS_MATCH') continue;
      const fullData = {
        name: item.source.name, code: item.source.code, type: item.source.type, city: item.source.city,
        locality: item.source.locality ?? null, street: item.source.street ?? null, address: item.source.address ?? null,
        latitude: item.source.latitude ?? null, longitude: item.source.longitude ?? null,
        gpsStatus: item.source.latitude !== undefined && item.source.longitude !== undefined ? 'UNVERIFIED' as const : 'MISSING' as const,
        sourceSystem: 'CARRIERS_2026', sourceSheet: item.source.sourceSheet, sourceRow: item.source.sourceRow,
        sourceKey: item.source.sourceKey, importBatchId: batch.id,
      };
      const changedData = Object.fromEntries(item.changes.map((change) => [change.field, change.next]));
      const saved = item.existingId
        ? await transaction.advertisingCarrier.update({ where: { id: item.existingId }, data: {
          ...changedData, sourceSystem: 'CARRIERS_2026', sourceSheet: item.source.sourceSheet,
          sourceRow: item.source.sourceRow, sourceKey: item.source.sourceKey, importBatchId: batch.id,
        } })
        : await transaction.advertisingCarrier.create({ data: fullData });
      carrierIds.set(item.source.sourceKey, saved.id);
    }
    const surfaceIds = new Map(plan.surfaces.filter(({ existingId }) => existingId).map((item) => [item.source.sourceKey, item.existingId!]));
    for (const item of plan.surfaces) {
      if (scope !== 'inventory' || !allowedKeys.has(item.source.sourceKey)) continue;
      if (item.existingId) {
        surfaceIds.set(item.source.sourceKey, item.existingId);
        await transaction.advertisingSurface.update({ where: { id: item.existingId }, data: {
          name: item.source.name, mediaType: item.source.mediaType, sourcePosition: item.source.sourcePosition,
          orientation: item.source.orientation ?? null, importBatchId: batch.id,
        } });
        continue;
      }
      const carrierId = carrierIds.get(item.carrierSourceKey);
      if (!carrierId) continue;
      const saved = await transaction.advertisingSurface.create({ data: {
        carrierId, name: item.source.name, mediaType: item.source.mediaType, sourcePosition: item.source.sourcePosition,
        orientation: item.source.orientation ?? null, status: 'AVAILABLE', sourceKey: item.source.sourceKey,
        rawMediaType: item.source.mediaType, importBatchId: batch.id,
      } });
      surfaceIds.set(item.source.sourceKey, saved.id);
    }
    let createdOccupancies = 0;
    for (const item of plan.occupancies) {
      if (scope !== 'occupancy' || !allowedKeys.has(item.sourceKey)) continue;
      if (item.action === 'EXTEND_OCCUPANCY' && item.conflictId && item.conflict?.existingRecordOrigin === 'CARRIERS_2026_IMPORT') {
        await transaction.occupancy.update({ where: { id: item.conflictId }, data: {
          campaignName: item.campaignName, clientId: item.clientId ?? null, clientName: item.clientName ?? 'NEVYĹEĹ ENĂť KLIENT',
          dateFrom: new Date(`${item.dateFrom}T00:00:00.000Z`), dateTo: new Date(`${item.dateTo}T23:59:59.999Z`), status: item.status,
          externalOrderReference: item.orderReference ?? null, rawSourceText: item.rawSourceText, sourceSystem: 'CARRIERS_2026',
          sourceSheet: item.sourceSheet, sourceRow: item.sourceRow, sourceKey: item.sourceKey, importBatchId: batch.id, updatedBy: 'CARRIERS_2026_IMPORT',
        } });
        continue;
      }
      if (!['NEW_OCCUPANCY', 'CAMPAIGN_WITHOUT_RESOLVED_CLIENT'].includes(item.action)) continue;
      const surfaceId = surfaceIds.get(item.surfaceSourceKey);
      if (!surfaceId) continue;
      await transaction.occupancy.create({ data: {
        surfaceId, clientId: item.clientId ?? null, clientName: item.clientName ?? 'Klient neurčen',
        campaignName: item.campaignName, dateFrom: new Date(`${item.dateFrom}T00:00:00.000Z`), dateTo: new Date(`${item.dateTo}T23:59:59.999Z`),
        status: item.status, note: `Import z ${item.sourceSheet}, řádek ${item.sourceRow}`,
        externalOrderReference: item.orderReference ?? null, rawSourceText: item.rawSourceText,
        sourceSystem: 'CARRIERS_2026', sourceSheet: item.sourceSheet, sourceRow: item.sourceRow,
        sourceColumn: item.sourceColumn, clientResolutionStatus: item.clientResolutionStatus ?? 'UNRESOLVED', statusDerivation: item.statusDerivation,
        sourceKey: item.sourceKey, importBatchId: batch.id, createdBy: 'CARRIERS_2026_IMPORT',
      } });
      createdOccupancies += 1;
    }
    let createdPrices = 0;
    for (const item of plan.prices) {
      if (scope !== 'pricing' || !allowedKeys.has(item.source.identityKey)) continue;
      if (item.action === 'UNCHANGED') continue;
      if (item.action === 'CHANGED_PRICE' && item.existingId) {
        await transaction.priceListItem.update({ where: { id: item.existingId }, data: { isActive: false, validTo: new Date(`${options.validFrom}T00:00:00.000Z`) } });
      }
      await transaction.priceListItem.create({ data: {
        identityKey: item.source.identityKey, versionKey: item.versionKey, name: item.source.name,
        carrierType: item.source.carrierType, mediaType: item.source.mediaType,
        rentalMonths: item.source.rentalMonths, minQuantity: item.source.minQuantity,
        rentalPrice: item.source.rentalPrice, productionPrice: item.source.productionPrice, totalPrice: item.source.totalPrice,
        currency: item.source.currency, validFrom: new Date(`${options.validFrom}T00:00:00.000Z`), isActive: true,
        sourceSheet: item.source.sourceSheet, sourceRow: item.source.sourceRow, importBatchId: batch.id,
      } });
      createdPrices += 1;
    }
    await transaction.importBatch.update({ where: { id: batch.id }, data: {
      status: 'IMPORTED', importedRows: allowedKeys.size, skippedRows: 0, errorRows: 0, finishedAt: new Date(),
    } });
    return { batchId: batch.id, scope, planHash: verifiedPlan.planHash, sourceFileHash: plan.fileHash, asOfDate: plan.asOfDate,
      appliedOperations: allowedKeys.size, createdOccupancies, createdPrices, unresolvedRecords: 0, result: 'IMPORTED' };
  }, { maxWait: 20_000, timeout: 120_000 });
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const workbook = await parseCarriers2026Workbook(options.file);
  const platformPrisma = new PrismaClient();
  const organization = await platformPrisma.organization.findFirst({ where: { id: options.organizationId, isActive: true }, select: { id: true } });
  if (!organization) throw new Error(`Aktivní organizace ${options.organizationId} nebyla nalezena.`);
  enterTenantContext({ organizationId: organization.id, source: 'script' });
  const prisma = platformPrisma.$extends(tenantPrismaExtension) as unknown as PrismaClient;
  try {
    const state = await readExistingState(prisma);
    const plan = buildImportPlan(workbook, state, databaseEnvironment(), options.validFrom, { asOfDate: options.asOfDate, scopes: options.scopes });
    if (options.resolutions) await applyResolutionCsv(plan, options.resolutions);
    const prefix = resolve(options.reportPrefix ?? `reports/carriers-2026-${plan.fileHash.slice(0, 12)}`);
    const jsonPath = `${prefix}.json`;
    const csvPath = `${prefix}.csv`;
    await writeImportReports(plan, jsonPath, csvPath);
    const phase3Paths = {
      safePlan: resolve('reports/carriers-2026-safe-plan.json'), blockedPlan: resolve('reports/carriers-2026-blocked-plan.json'),
      campaignClients: resolve('reports/carriers-2026-campaign-client-resolution.csv'), inventoryChanges: resolve('reports/carriers-2026-inventory-changes.csv'),
      historical: resolve('reports/carriers-2026-historical-skipped.json'),
    };
    await writePhase3Reports(plan, phase3Paths);
    const resolutionPath = options.resolutions ?? resolve('reports/carriers-2026-resolution.csv');
    if (!options.resolutions) await writeResolutionCsv(plan.resolution.rows, resolutionPath);
    console.log(JSON.stringify({ mode: options.mode, databaseEnvironment: plan.databaseEnvironment, scopes: plan.selectedScopes, asOfDate: plan.asOfDate,
      jsonReport: jsonPath, csvReport: csvPath, resolutionReport: resolutionPath, ...phase3Paths, safePlanHash: plan.safePlan.planHash,
      blockedPlanHash: plan.blockedPlan.planHash, photoOperations: plan.photoAudit.operations, safetyGate: plan.safetyGate, stats: plan.stats }, null, 2));
    if (options.mode === 'apply') {
      const verifiedPlan = await loadVerifiedPlan(options.plan, plan, options);
      const results = [];
      for (const scope of options.scopes) results.push(await applyPlan(prisma, plan, options, jsonPath, verifiedPlan, scope));
      console.log(JSON.stringify(results, null, 2));
    }
  } finally {
    await platformPrisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
/* obsolete duplicate removed in the next cleanup
  const scopeValue = optionValue(args, '--scope') ?? 'inventory,pricing,occupancy';
  const scopes = [...new Set(scopeValue.split(',').map((value) => value.trim()).filter(Boolean))] as ImportScope[];
  if (!scopes.length || scopes.some((scope) => !['inventory', 'pricing', 'occupancy'].includes(scope))) throw new Error('--scope smĂ­ obsahovat pouze inventory,pricing,occupancy.');
  const asOfDate = optionValue(args, '--as-of') ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) || Number.isNaN(new Date(`${asOfDate}T00:00:00.000Z`).getTime())) throw new Error('--as-of must be YYYY-MM-DD.');
*/
