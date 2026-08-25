import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db';
import { uploadPhotoToGoogleDrive } from '@/lib/google-drive';
import { logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';
import { getCurrentUser } from '@/lib/auth';
import { normalizeClientName } from '@/lib/navigation-import-plan';
import {
  normalizeImageMimeType,
  parseRequiredCoordinates,
  runPostSaveTasks,
  stablePhotoUrl,
  storeMobilePhoto,
} from '@/lib/mobile-photo-upload';
import { enterTenantContext, getTenantContext } from '@/lib/tenant-context';
import { tenantStorageKey } from '@/lib/storage/tenant-storage-key';
import type { CarrierType, MountingType, MediaType } from '@prisma/client';

export const runtime = 'nodejs';

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

function mapCarrierTypeToMediaType(carrierType: string): MediaType {
  switch (carrierType) {
    case 'CITYLIGHT':
      return 'CITYLIGHT';
    case 'BANNER':
      return 'BANNER';
    case 'FACADE':
      return 'FACADE';
    case 'LED_SCREEN':
      return 'LED_SCREEN';
    case 'PROMO_BENCH':
      return 'PROMO_BENCH';
    case 'PROMO_HORIZON':
      return 'PROMO_HORIZON';
    case 'CITY_POSTER':
      return 'CITY_POSTER';
    case 'PROMO_TOWER':
      return 'PROMO_TOWER';
    case 'PROMO_MINITOWER':
      return 'PROMO_MINITOWER';
    case 'NAVIGATION':
      return 'NAVIGATION_SIGN';
    case 'BIGBOARD':
      return 'BIGBOARD';
    case 'BILLBOARD':
    default:
      return 'BILLBOARD';
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return jsonError('UNAUTHORIZED', 'Pro tuto akci musíte být přihlášeni.', 401);
    }

    let organizationId: string | undefined = user.organizationId || user.membership?.organizationId || undefined;
    if (!organizationId) {
      const currentTenant = getTenantContext();
      organizationId = currentTenant?.organizationId || undefined;
    }

    if (!organizationId) {
      return jsonError('TENANT_REQUIRED', 'Nebyla nalezena organizace pro uložení nosiče.', 400);
    }

    enterTenantContext({
      organizationId,
      userId: user.id,
      source: 'session',
    });

    const formData = await req.formData();
    const file = formData.get('file');
    const name = String(formData.get('name') || '').trim();
    let code = String(formData.get('code') || '').trim().toUpperCase();
    const type = (String(formData.get('type') || 'BILLBOARD') as CarrierType);
    const mountingType = (String(formData.get('mountingType') || 'UNKNOWN') as MountingType);
    const city = String(formData.get('city') || 'Praha').trim();
    const street = String(formData.get('street') || '').trim() || null;
    const locality = String(formData.get('locality') || '').trim() || null;
    const note = String(formData.get('note') || '').trim() || null;
    const parsedSurfacesCount = parseInt(String(formData.get('surfacesCount') || '1'), 10);
    const surfacesCount = [1, 2, 3, 4].includes(parsedSurfacesCount) ? parsedSurfacesCount : 1;
    const surfaceSize = String(formData.get('surfaceSize') || '').trim() || null;
    const clientId = String(formData.get('clientId') || '').trim() || null;
    const newClientName = String(formData.get('newClientName') || '').trim() || null;

    if (!(file instanceof File)) {
      return jsonError('INVALID_UPLOAD', 'Chybí soubor fotografie.', 400);
    }
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|hei[cf])$/i.test(file.name)) {
      return jsonError('INVALID_IMAGE', 'Vybraný soubor není podporovaná fotografie.', 415);
    }
    if (!name) {
      return jsonError('NAME_REQUIRED', 'Zadejte název nové reklamní plochy / nosiče.', 400);
    }

    const coordinates = parseRequiredCoordinates(formData.get('latitude'), formData.get('longitude'));
    if (!coordinates) {
      return jsonError('GPS_REQUIRED', 'Pro vytvoření nové plochy v terénu je nutná GPS poloha.', 400);
    }

    const accuracyValue = Number(formData.get('accuracyMeters'));
    const accuracy = Number.isFinite(accuracyValue) && accuracyValue >= 0 ? accuracyValue : null;

    // Generate code if not provided
    if (!code) {
      const prefixMap: Record<string, string> = {
        BILLBOARD: 'BB',
        BIGBOARD: 'BG',
        CITYLIGHT: 'CL',
        BANNER: 'BAN',
        FACADE: 'FAC',
        LED_SCREEN: 'LED',
        PROMO_BENCH: 'PB',
        PROMO_HORIZON: 'PH',
        CITY_POSTER: 'CP',
        PROMO_TOWER: 'TW',
        PROMO_MINITOWER: 'MTW',
        NAVIGATION: 'NAV',
        OTHER: 'REC',
      };
      const prefix = prefixMap[type] || 'REC';
      const citySlug = city.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') || 'LOC';
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      code = `${citySlug}-${prefix}-${randomSuffix}`;
    }

    // Resolve or create Client
    let targetClientId: string | null = clientId;
    if (!targetClientId && newClientName) {
      const normalized = normalizeClientName(newClientName);
      let existingClient = await prisma.client.findFirst({
        where: {
          organizationId,
          OR: [
            { name: { equals: newClientName, mode: 'insensitive' } },
            { normalizedName: normalized },
          ],
        },
      });

      if (!existingClient) {
        existingClient = await prisma.client.create({
          data: {
            organizationId,
            name: newClientName,
            normalizedName: normalized || newClientName,
          },
        });
      }
      targetClientId = existingClient.id;
    }

    const workerUserId = user.id || 'MOBILE_WORKER';
    const workerName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.email || user.name || 'Pracovník v terénu';

    // Store Photo
    const photoId = `photo-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const mimeType = normalizeImageMimeType(file);
    const extension = mimeType === 'image/heic' ? 'heic' : mimeType === 'image/heif' ? 'heif' : mimeType.split('/')[1] || 'jpg';
    const safeCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `NEW_${safeCode}_${new Date().toISOString().slice(0, 10)}_${photoId.slice(-8)}.${extension}`;
    const stored = await storeMobilePhoto(file, fileName, photoId, uploadPhotoToGoogleDrive);
    const photoUrl = stablePhotoUrl(photoId);
    const storageProvider = stored.storageProvider === 'LOCAL' ? 'DATABASE' : stored.storageProvider;
    const storageKey = tenantStorageKey({ organizationId, resource: 'photos', resourceId: photoId, fileName });
    const contentChecksum = createHash('sha256').update(stored.bytes).digest('hex');

    const mediaType = mapCarrierTypeToMediaType(type);

    // Atomic DB Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Carrier
      const carrier = await tx.advertisingCarrier.create({
        data: {
          organizationId,
          name,
          code,
          type,
          mountingType,
          status: 'ACTIVE',
          city,
          street,
          locality,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          gpsStatus: 'VERIFIED',
          note: note ? `[Založeno mobilem]: ${note}` : 'Založeno mobilním focením v terénu',
        },
      });

      // 2. Create Surface(s) based on surfacesCount (1, 2, 3, 4)
      const createdSurfaces = [];
      let surfaceConfigs: Array<{ name: string; side: 'SIDE_A' | 'SIDE_B' | null }> = [];
      if (surfacesCount === 1) {
        surfaceConfigs = [{ name: 'Strana A', side: 'SIDE_A' }];
      } else if (surfacesCount === 2) {
        surfaceConfigs = [{ name: 'Strana A', side: 'SIDE_A' }, { name: 'Strana B', side: 'SIDE_B' }];
      } else if (surfacesCount === 3) {
        surfaceConfigs = [{ name: 'Strana 1', side: 'SIDE_A' }, { name: 'Strana 2', side: 'SIDE_B' }, { name: 'Strana 3', side: null }];
      } else if (surfacesCount === 4) {
        surfaceConfigs = [
          { name: 'Strana 1 (Čelo A)', side: 'SIDE_A' },
          { name: 'Strana 2 (Bok B)', side: 'SIDE_B' },
          { name: 'Strana 3 (Záda C)', side: null },
          { name: 'Strana 4 (Bok D)', side: null },
        ];
      }

      for (const sc of surfaceConfigs) {
        const surface = await tx.advertisingSurface.create({
          data: {
            organizationId,
            carrierId: carrier.id,
            name: sc.name,
            sidePosition: sc.side,
            mediaType,
            size: surfaceSize,
            status: targetClientId ? 'OCCUPIED' : 'AVAILABLE',
            currentClientId: targetClientId,
          },
        });
        createdSurfaces.push(surface);
      }

      // 3. Create Photo
      const photo = await tx.photo.create({
        data: {
          id: photoId,
          carrierId: carrier.id,
          surfaceId: createdSurfaces[0]?.id || null,
          url: photoUrl,
          driveFileId: stored.driveFileId,
          content: stored.storageProvider === 'LOCAL' ? Buffer.from(stored.bytes) : undefined,
          storageKey,
          contentChecksum,
          fileName,
          mimeType,
          size: stored.bytes.byteLength,
          type: 'CARRIER',
          note: `Založení nového nosiče v terénu: ${name}`,
          isClientVisible: false,
          storageProvider,
          capturedLatitude: coordinates.lat,
          capturedLongitude: coordinates.lng,
          capturedAccuracyMeters: accuracy,
          capturedByWorkerUserId: workerUserId,
          capturedByWorkerName: workerName,
          aiStatus: 'SKIPPED',
        },
      });

      return { carrier, surfaces: createdSurfaces, photo };
    });

    // History Log
    const historyTask = () =>
      logCarrierHistoryEvent({
        carrierId: result.carrier.id,
        surfaceId: result.surfaces[0]?.id || null,
        eventType: 'SERVICE',
        title: 'Nosič založen v terénu z mobilní aplikace',
        description: `Vytvořen nový nosič ${name} (${code}) v lokalitě ${city}${street ? `, ${street}` : ''}. GPS: ${coordinates.lat}, ${coordinates.lng}.`,
        performedBy: workerName,
        photoUrl,
      });

    const warnings = await runPostSaveTasks([
      { name: 'history', run: historyTask },
    ]);

    return NextResponse.json({
      success: true,
      carrier: {
        id: result.carrier.id,
        code: result.carrier.code,
        name: result.carrier.name,
        city: result.carrier.city,
        street: result.carrier.street,
        latitude: result.carrier.latitude,
        longitude: result.carrier.longitude,
        surfaces: result.surfaces.map((s) => ({
          id: s.id,
          name: s.name,
          side: s.sidePosition as 'SIDE_A' | 'SIDE_B' | null,
          status: s.status,
          currentClient: null,
          currentCampaign: null,
          occupiedFrom: null,
          occupiedUntil: null,
          latestPhotoUrl: photoUrl,
          artworkUrl: null,
        })),
        photos: [
          {
            id: result.photo.id,
            url: result.photo.url,
            storageProvider: result.photo.storageProvider,
            capturedLatitude: result.photo.capturedLatitude,
            capturedLongitude: result.photo.capturedLongitude,
            capturedByWorkerName: result.photo.capturedByWorkerName,
            createdAt: result.photo.createdAt.toISOString(),
          },
        ],
      },
      warnings: [...(stored.driveWarning ? ['google-drive'] : []), ...warnings],
      message: `Nová reklamní plocha "${result.carrier.name}" (${result.carrier.code}) byla úspěšně vytvořena a uložena do databáze!`,
    });
  } catch (error: unknown) {
    console.error('[mobile-photos/create-carrier]', error);
    const msg = error instanceof Error ? error.message : 'Nepodařilo se vytvořit novou reklamní plochu.';
    return jsonError('CREATE_ERROR', msg, 500);
  }
}
