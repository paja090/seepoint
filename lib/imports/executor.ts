import { prisma } from '@/lib/db';
import { normalizeCode, normalizeText } from '@/lib/carriers-2026/normalize';
import { saveOrUpdateProfile } from './profile-service';
import type { ColumnMappingProposal, ConflictResolutionChoice, SheetClassificationType } from './types';
import type { CarrierType, MediaType, Prisma } from '@prisma/client';

export function parseCarrierType(raw?: unknown): CarrierType {
  if (!raw || typeof raw !== 'string') return 'OTHER';
  const norm = raw.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('BILLBOARD')) return 'BILLBOARD';
  if (norm.includes('BIGBOARD') || norm.includes('MEGABOARD')) return 'BIGBOARD';
  if (norm.includes('CITYLIGHT') || norm.includes('CLV')) return 'CITYLIGHT';
  if (norm.includes('LED') || norm.includes('OBRAZOV')) return 'LED_SCREEN';
  if (norm.includes('BANNER') || norm.includes('PLACHTA')) return 'BANNER';
  if (norm.includes('FASAD') || norm.includes('FACADE')) return 'FACADE';
  if (norm.includes('LAVICK') || norm.includes('BENCH')) return 'PROMO_BENCH';
  if (norm.includes('HORIZON')) return 'PROMO_HORIZON';
  if (norm.includes('MINITOWER')) return 'PROMO_MINITOWER';
  if (norm.includes('TOWER')) return 'PROMO_TOWER';
  if (norm.includes('POSTER') || norm.includes('PLAKAT')) return 'CITY_POSTER';
  if (norm.includes('NAVIG')) return 'NAVIGATION';
  return 'OTHER';
}

export function parseMediaType(raw?: unknown): MediaType {
  if (!raw || typeof raw !== 'string') return 'OTHER';
  const norm = raw.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('BILLBOARD')) return 'BILLBOARD';
  if (norm.includes('BIGBOARD') || norm.includes('MEGABOARD')) return 'BIGBOARD';
  if (norm.includes('CITYLIGHT') || norm.includes('CLV')) return 'CITYLIGHT';
  if (norm.includes('LED') || norm.includes('OBRAZOV')) return 'LED_SCREEN';
  if (norm.includes('BANNER') || norm.includes('PLACHTA')) return 'BANNER';
  if (norm.includes('FASAD') || norm.includes('FACADE')) return 'FACADE';
  if (norm.includes('LAVICK') || norm.includes('BENCH')) return 'PROMO_BENCH';
  if (norm.includes('HORIZON')) return 'PROMO_HORIZON';
  if (norm.includes('MINITOWER')) return 'PROMO_MINITOWER';
  if (norm.includes('TOWER')) return 'PROMO_TOWER';
  if (norm.includes('POSTER') || norm.includes('PLAKAT')) return 'CITY_POSTER';
  if (norm.includes('NAVIG')) return 'NAVIGATION_SIGN';
  return 'OTHER';
}

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

        const mapped = (row.mappedData || {}) as Record<string, unknown>;

        if (row.targetEntity === 'CLIENT') {
          const clientName = mapped.name || mapped.clientName;
          if (action === 'CREATE' && clientName) {
            const norm = normalizeText(String(clientName));
            const client = await tx.client.upsert({
              where: {
                organizationId_normalizedName: {
                  organizationId,
                  normalizedName: norm,
                },
              },
              create: {
                organizationId,
                name: String(clientName),
                normalizedName: norm,
                companyId: mapped.companyId ? String(mapped.companyId) : null,
                dic: mapped.dic ? String(mapped.dic) : null,
                billingCity: mapped.billingCity || mapped.city ? String(mapped.billingCity || mapped.city) : null,
                billingStreet: mapped.billingStreet || mapped.address ? String(mapped.billingStreet || mapped.address) : null,
                contactPerson: mapped.contactPerson ? String(mapped.contactPerson) : null,
                email: mapped.email ? String(mapped.email) : null,
                phone: mapped.phone ? String(mapped.phone) : null,
              },
              update: {
                companyId: mapped.companyId ? String(mapped.companyId) : undefined,
                contactPerson: mapped.contactPerson ? String(mapped.contactPerson) : undefined,
                email: mapped.email ? String(mapped.email) : undefined,
                phone: mapped.phone ? String(mapped.phone) : undefined,
              },
            });
            createdClientsCount++;
            await tx.importRow.update({
              where: { id: row.id },
              data: { importedAt: new Date(), targetEntityId: client.id },
            });
          }
        } else if (row.targetEntity === 'PRICE') {
          const priceName = String(mapped.name || mapped.carrierType || mapped.mediaType || mapped.code || `Položka ${row.rowNumber}`);
          const rentPrice = mapped.rentalPrice != null ? Number(mapped.rentalPrice) : (mapped.price != null ? Number(mapped.price) : 0);
          if (action === 'CREATE' && priceName) {
            const versionKey = `IMPORT_${batchId}_${row.rowNumber}`;
            const priceItem = await tx.priceListItem.create({
              data: {
                organizationId,
                identityKey: `PRICE_${normalizeCode(priceName)}`,
                versionKey,
                name: priceName,
                rentalPrice: rentPrice,
                productionPrice: Number(mapped.productionPrice || 0),
                totalPrice: Number(rentPrice) + Number(mapped.productionPrice || 0),
                validFrom: mapped.validFrom ? new Date(String(mapped.validFrom)) : new Date(),
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
        } else if (row.targetEntity === 'OCCUPANCY') {
          const rawCode = mapped.carrierCode ? String(mapped.carrierCode) : '';
          if (rawCode) {
            const code = normalizeCode(rawCode);
            const carrier = await tx.advertisingCarrier.findFirst({
              where: { organizationId, code },
              include: { surfaces: true },
            });

            if (carrier && carrier.surfaces.length > 0) {
              const surface = carrier.surfaces[0];
              const dateFrom = mapped.dateFrom ? new Date(String(mapped.dateFrom)) : new Date();
              const dateTo = mapped.dateTo ? new Date(String(mapped.dateTo)) : new Date(Date.now() + 30 * 24 * 3600 * 1000);
              const clientName = mapped.clientName ? String(mapped.clientName) : 'Nespecifikovaný inzerent';
              const campaignName = mapped.campaignName ? String(mapped.campaignName) : 'Kampaň';

              await tx.occupancy.create({
                data: {
                  organizationId,
                  surfaceId: surface.id,
                  clientName,
                  campaignName,
                  dateFrom,
                  dateTo,
                  status: 'RESERVED',
                  note: mapped.status ? `Stav z importu: ${mapped.status}` : null,
                },
              });
              await tx.importRow.update({
                where: { id: row.id },
                data: { importedAt: new Date() },
              });
            }
          }
        } else {
          // CARRIER & SURFACE
          const rawCode = mapped.carrierCode ? String(mapped.carrierCode) : `CARRIER_${row.rowNumber}`;
          const code = normalizeCode(rawCode);
          const sourceKey = `IMPORT:${organizationId}:CARRIER:${code}`;
          const carrierType = parseCarrierType(mapped.carrierType || mapped.type || mapped.mediaType);
          const mediaType = parseMediaType(mapped.mediaType || mapped.carrierType || mapped.type);
          const surfaceSize = mapped.dimensions ? String(mapped.dimensions) : (mapped.size ? String(mapped.size) : null);
          const surfacePrice = mapped.rentalPrice != null ? Number(mapped.rentalPrice) : (mapped.price != null ? Number(mapped.price) : null);
          const lightingNote = mapped.lighting != null ? `Osvětlení: ${mapped.lighting ? 'Ano' : 'Ne'}` : null;
          const surfaceNote = [lightingNote, mapped.note ? String(mapped.note) : null].filter(Boolean).join(', ') || null;

          if (action === 'CREATE') {
            const createdCarrier = await tx.advertisingCarrier.upsert({
              where: {
                organizationId_code: { organizationId, code },
              },
              create: {
                organizationId,
                code,
                name: mapped.name ? String(mapped.name) : code,
                city: mapped.city ? String(mapped.city) : 'Nespecifikováno',
                street: mapped.street ? String(mapped.street) : null,
                address: mapped.address ? String(mapped.address) : null,
                locality: mapped.locality ? String(mapped.locality) : null,
                latitude: typeof mapped.latitude === 'number' ? mapped.latitude : null,
                longitude: typeof mapped.longitude === 'number' ? mapped.longitude : null,
                type: carrierType,
                structureCode: mapped.structureCode ? String(mapped.structureCode) : null,
                sourceKey,
                importBatchId: batch.id,
                note: mapped.note ? String(mapped.note) : null,
                placementDescription: mapped.address || mapped.locality ? String(mapped.address || mapped.locality) : null,
                surfaces: {
                  create: {
                    organizationId,
                    name: mapped.surfaceName ? String(mapped.surfaceName) : (mapped.sidePosition ? `Strana ${mapped.sidePosition}` : 'Celý nosič'),
                    mediaType,
                    size: surfaceSize,
                    price: surfacePrice,
                    note: surfaceNote,
                    sourceKey: `IMPORT:${organizationId}:SURFACE:${code}:${mapped.sidePosition || '1'}`,
                    importBatchId: batch.id,
                  },
                },
              },
              update: {
                name: mapped.name ? String(mapped.name) : undefined,
                city: mapped.city ? String(mapped.city) : undefined,
                street: mapped.street ? String(mapped.street) : undefined,
                address: mapped.address ? String(mapped.address) : undefined,
                locality: mapped.locality ? String(mapped.locality) : undefined,
                type: carrierType !== 'OTHER' ? carrierType : undefined,
                importBatchId: batch.id,
              },
            });
            createdCarriersCount++;
            await tx.importRow.update({
              where: { id: row.id },
              data: { importedAt: new Date(), targetEntityId: createdCarrier.id },
            });
          } else if (action === 'UPDATE' && row.targetEntityId) {
            const updateData: Prisma.AdvertisingCarrierUncheckedUpdateInput = {
              importBatchId: batch.id,
            };
            if (mapped.name) updateData.name = String(mapped.name);
            if (mapped.street) updateData.street = String(mapped.street);
            if (mapped.address) updateData.address = String(mapped.address);
            if (mapped.city) updateData.city = String(mapped.city);
            if (carrierType !== 'OTHER') updateData.type = carrierType;
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
