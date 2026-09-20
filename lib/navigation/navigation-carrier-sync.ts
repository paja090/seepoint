import { Prisma } from '@prisma/client';

export interface SyncPointInput {
  id?: string;
  stableKey?: string | null;
  carrierId?: string | null;
  surfaceId?: string | null;
  label: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  pillarNumber?: string | null;
  pillarType?: string | null;
  navigationType?: string | null;
  variant?: string | null;
  roadSide?: string | null;
  arrowDirection?: string | null;
  calculatedDistanceMeters?: number | null;
  targetAddress?: string | null;
  targetName?: string | null;
}

export interface SyncOrderMeta {
  organizationId: string;
  clientId?: string | null;
  targetName?: string | null;
  city?: string | null;
  rentStart?: Date | null;
  rentEnd?: Date | null;
}

function cleanCity(address?: string | null, fallbackCity?: string | null): string {
  if (fallbackCity && fallbackCity.trim()) return fallbackCity.trim();
  if (!address) return 'Ostrava';
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length > 1) {
    const candidate = parts[parts.length - 1].replace(/\d{3}\s*\d{2}/, '').trim();
    if (candidate.length > 1) return candidate;
  }
  return 'Ostrava';
}

function sanitizeCodePart(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Idempotently ensures that a NavigationPoint has a corresponding AdvertisingCarrier
 * and AdvertisingSurface in the system inventory.
 */
export async function syncNavigationPointToCarrierAndSurface(
  tx: Prisma.TransactionClient,
  point: SyncPointInput,
  meta: SyncOrderMeta
): Promise<{ carrierId: string; surfaceId: string }> {
  const organizationId = meta.organizationId;
  const city = cleanCity(point.address, meta.city);
  const cityCode = sanitizeCodePart(city).slice(0, 8) || 'OVA';

  // 1. Check if existing carrierId & surfaceId are already valid
  if (point.carrierId && point.surfaceId) {
    const existingCarrier = await tx.advertisingCarrier.findFirst({
      where: { id: point.carrierId, organizationId },
    });
    const existingSurface = await tx.advertisingSurface.findFirst({
      where: { id: point.surfaceId, organizationId },
    });

    if (existingCarrier && existingSurface) {
      await tx.advertisingCarrier.update({
        where: { id: existingCarrier.id },
        data: {
          latitude: point.latitude,
          longitude: point.longitude,
          address: point.address || existingCarrier.address,
          structureCode: point.pillarNumber || existingCarrier.structureCode,
        },
      });

      await tx.advertisingSurface.update({
        where: { id: existingSurface.id },
        data: {
          currentClientId: meta.clientId ?? existingSurface.currentClientId,
          destinationName: meta.targetName || existingSurface.destinationName,
          distanceMeters: point.calculatedDistanceMeters ?? existingSurface.distanceMeters,
          directionDescription: point.arrowDirection ?? existingSurface.directionDescription,
          status: 'OCCUPIED',
        },
      });

      return { carrierId: existingCarrier.id, surfaceId: existingSurface.id };
    }
  }

  // 2. Generate a unique code for the carrier
  let baseCode = point.pillarNumber
    ? `VO-${cityCode}-${sanitizeCodePart(point.pillarNumber)}`
    : `VO-${cityCode}-${(point.stableKey || point.id || 'PT').slice(-6).toUpperCase()}`;

  let carrierCode = baseCode;
  let counter = 1;
  while (true) {
    const conflict = await tx.advertisingCarrier.findFirst({
      where: { organizationId, code: carrierCode },
      select: { id: true },
    });
    if (!conflict || (point.carrierId && conflict.id === point.carrierId)) {
      break;
    }
    counter++;
    carrierCode = `${baseCode}-${counter}`;
  }

  // 3. Find or Create AdvertisingCarrier
  let carrier = point.carrierId
    ? await tx.advertisingCarrier.findFirst({ where: { id: point.carrierId, organizationId } })
    : null;

  const carrierName = point.pillarNumber
    ? `Sloup VO ${point.pillarNumber} · ${point.address || city}`
    : `Navigační bod · ${point.address || city}`;

  if (!carrier) {
    carrier = await tx.advertisingCarrier.create({
      data: {
        organizationId,
        code: carrierCode,
        name: carrierName,
        type: 'NAVIGATION',
        mountingType: 'LIGHT_POLE',
        latitude: point.latitude,
        longitude: point.longitude,
        gpsStatus: 'VERIFIED',
        address: point.address || null,
        street: point.address?.split(',')[0]?.trim() || null,
        city,
        structureCode: point.pillarNumber || null,
        status: 'ACTIVE',
        visibility: 'PRIVATE',
      },
    });
  } else {
    carrier = await tx.advertisingCarrier.update({
      where: { id: carrier.id },
      data: {
        name: carrierName,
        latitude: point.latitude,
        longitude: point.longitude,
        address: point.address || carrier.address,
        structureCode: point.pillarNumber || carrier.structureCode,
      },
    });
  }

  // 4. Find or Create AdvertisingSurface
  let surface = point.surfaceId
    ? await tx.advertisingSurface.findFirst({ where: { id: point.surfaceId, organizationId } })
    : null;

  const surfaceName = point.label || `Směrová tabule · ${meta.targetName || 'Cíl'}`;
  const rentStart = meta.rentStart || new Date();
  const rentEnd = meta.rentEnd || new Date(rentStart.getTime() + 365 * 24 * 60 * 60 * 1000);

  if (!surface) {
    surface = await tx.advertisingSurface.create({
      data: {
        organizationId,
        carrierId: carrier.id,
        name: surfaceName,
        mediaType: 'NAVIGATION_SIGN',
        currentClientId: meta.clientId || null,
        destinationName: meta.targetName || null,
        distanceMeters: point.calculatedDistanceMeters || null,
        directionDescription: point.arrowDirection || null,
        sidePosition: point.roadSide || 'Vpravo',
        size: point.variant || '100x30 cm',
        status: 'OCCUPIED',
        currentRentStart: rentStart,
        currentRentEnd: rentEnd,
        visibility: 'PRIVATE',
      },
    });
  } else {
    surface = await tx.advertisingSurface.update({
      where: { id: surface.id },
      data: {
        name: surfaceName,
        carrierId: carrier.id,
        currentClientId: meta.clientId || surface.currentClientId,
        destinationName: meta.targetName || surface.destinationName,
        distanceMeters: point.calculatedDistanceMeters ?? surface.distanceMeters,
        directionDescription: point.arrowDirection ?? surface.directionDescription,
        status: 'OCCUPIED',
        currentRentStart: rentStart,
        currentRentEnd: rentEnd,
      },
    });
  }

  return { carrierId: carrier.id, surfaceId: surface.id };
}
