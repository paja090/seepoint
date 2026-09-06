import { prisma } from '@/lib/db';
import { normalizeCode, normalizeText } from '@/lib/carriers-2026/normalize';
import { saveOrUpdateProfile } from './profile-service';
import type { ColumnMappingProposal, ConflictResolutionChoice, SheetClassificationType } from './types';

export async function commitImportBatch(
  organizationId: string,
  batchId: string,
  options: {
    resolutions?: Record<string, ConflictResolutionChoice>;
    saveProfileAs?: string;
  }
) {
  const [batch, sheets, rows] = await Promise.all([
    prisma.importBatch.findFirstOrThrow({
      where: { id: batchId, organizationId },
    }),
    prisma.importBatchSheet.findMany({
      where: { batchId, organizationId },
    }),
    prisma.importRow.findMany({
      where: { batchId, organizationId },
      orderBy: { rowNumber: 'asc' },
    }),
  ]);

  let createdCarriersCount = 0;
  let updatedCarriersCount = 0;
  let createdClientsCount = 0;
  let createdPricesCount = 0;
  let skippedRowsCount = 0;

  // Process rows in batches of 100 in database transaction
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);

    await prisma.$transaction(async (tx) => {
      for (const row of chunk) {
        const resolution = options.resolutions?.[row.id] || (row.resolution as ConflictResolutionChoice);
        let action = row.action;

        if (action === 'CONFLICT') {
          if (resolution === 'USE_IMPORT') {
            action = 'UPDATE';
          } else {
            action = 'SKIP';
          }
        }

        if (action === 'SKIP' || action === 'ERROR' || action === 'NEEDS_REVIEW') {
          skippedRowsCount++;
          continue;
        }

        const mapped = (row.mappedData || {}) as Record<string, any>;

        if (row.targetEntity === 'CLIENT') {
          if (action === 'CREATE' && mapped.name) {
            const norm = normalizeText(mapped.name);
            const client = await tx.client.upsert({
              where: {
                organizationId_normalizedName: {
                  organizationId,
                  normalizedName: norm,
                },
              },
              create: {
                organizationId,
                name: String(mapped.name),
                normalizedName: norm,
                companyId: mapped.companyId ? String(mapped.companyId) : null,
                dic: mapped.dic ? String(mapped.dic) : null,
                billingCity: mapped.billingCity ? String(mapped.billingCity) : null,
                billingStreet: mapped.billingStreet ? String(mapped.billingStreet) : null,
                contactPerson: mapped.contactPerson ? String(mapped.contactPerson) : null,
                email: mapped.email ? String(mapped.email) : null,
                phone: mapped.phone ? String(mapped.phone) : null,
              },
              update: {
                companyId: mapped.companyId ? String(mapped.companyId) : undefined,
              },
            });
            createdClientsCount++;
            await tx.importRow.update({
              where: { id: row.id },
              data: { importedAt: new Date(), targetEntityId: client.id },
            });
          }
        } else if (row.targetEntity === 'PRICE') {
          if (action === 'CREATE' && mapped.name && mapped.rentalPrice) {
            const versionKey = `IMPORT_${batchId}_${row.rowNumber}`;
            const priceItem = await tx.priceListItem.create({
              data: {
                organizationId,
                identityKey: `PRICE_${normalizeCode(mapped.name)}`,
                versionKey,
                name: String(mapped.name),
                rentalPrice: mapped.rentalPrice,
                productionPrice: mapped.productionPrice || 0,
                totalPrice: Number(mapped.rentalPrice) + Number(mapped.productionPrice || 0),
                validFrom: mapped.validFrom ? new Date(mapped.validFrom) : new Date(),
                sourceSheet: row.sheetId,
                sourceRow: row.rowNumber,
                importBatchId: batch.id,
              },
            });
            createdPricesCount++;
            await tx.importRow.update({
              where: { id: row.id },
              data: { importedAt: new Date(), targetEntityId: priceItem.id },
            });
          }
        } else {
          // CARRIER & SURFACE
          const rawCode = mapped.carrierCode ? String(mapped.carrierCode) : `CARRIER_${row.rowNumber}`;
          const code = normalizeCode(rawCode);
          const sourceKey = `IMPORT:${organizationId}:CARRIER:${code}`;

          if (action === 'CREATE') {
            const createdCarrier = await tx.advertisingCarrier.create({
              data: {
                organizationId,
                code,
                name: mapped.name ? String(mapped.name) : code,
                city: mapped.city ? String(mapped.city) : 'Nespecifikováno',
                street: mapped.street ? String(mapped.street) : null,
                address: mapped.address ? String(mapped.address) : null,
                locality: mapped.locality ? String(mapped.locality) : null,
                latitude: typeof mapped.latitude === 'number' ? mapped.latitude : null,
                longitude: typeof mapped.longitude === 'number' ? mapped.longitude : null,
                type: 'OTHER',
                structureCode: mapped.structureCode ? String(mapped.structureCode) : null,
                sourceKey,
                importBatchId: batch.id,
                surfaces: {
                  create: {
                    organizationId,
                    name: mapped.surfaceName ? String(mapped.surfaceName) : 'Celý nosič',
                    mediaType: 'OTHER',
                    sourceKey: `IMPORT:${organizationId}:SURFACE:${code}:1`,
                    importBatchId: batch.id,
                  },
                },
              },
            });
            createdCarriersCount++;
            await tx.importRow.update({
              where: { id: row.id },
              data: { importedAt: new Date(), targetEntityId: createdCarrier.id },
            });
          } else if (action === 'UPDATE' && row.targetEntityId) {
            const updateData: Record<string, any> = {
              importBatchId: batch.id,
            };
            if (mapped.name) updateData.name = String(mapped.name);
            if (mapped.street) updateData.street = String(mapped.street);
            if (resolution === 'USE_IMPORT' && typeof mapped.latitude === 'number') {
              updateData.latitude = mapped.latitude;
              updateData.longitude = mapped.longitude;
            }

            await tx.advertisingCarrier.update({
              where: { id: row.targetEntityId },
              data: updateData,
            });
            updatedCarriersCount++;
            await tx.importRow.update({
              where: { id: row.id },
              data: { importedAt: new Date() },
            });
          }
        }
      }
    });
  }

  // Update batch status to COMPLETED
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: 'COMPLETED',
      importedRows: createdCarriersCount + updatedCarriersCount + createdClientsCount + createdPricesCount,
      skippedRows: skippedRowsCount,
      finishedAt: new Date(),
    },
  });

  // Save profile if requested
  if (options.saveProfileAs && batch.fileHash) {
    const sheetAliases: Record<string, SheetClassificationType> = {};
    const columnMappings: Record<string, ColumnMappingProposal[]> = {};

    for (const sheet of sheets) {
      sheetAliases[sheet.name] = sheet.classification as SheetClassificationType;
      columnMappings[sheet.name] = (sheet.columnMappings || []) as ColumnMappingProposal[];
    }

    await saveOrUpdateProfile(organizationId, {
      profileName: options.saveProfileAs,
      fingerprint: batch.fileHash,
      sheetAliases,
      columnMappings,
    });
  }

  return {
    batchId: batch.id,
    createdCarriers: createdCarriersCount,
    updatedCarriers: updatedCarriersCount,
    createdClients: createdClientsCount,
    createdPrices: createdPricesCount,
    skippedRows: skippedRowsCount,
  };
}
