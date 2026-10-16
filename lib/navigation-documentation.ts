import * as crypto from 'node:crypto';

export function generateSecureToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(token);
  return { token, hash };
}

export function getDeterministicReportToken(
  reportId: string,
  secret = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || 'seepoint-navdoc-token-salt-2026',
): { token: string; hash: string } {
  const token = crypto.createHmac('sha256', secret).update(`navdoc:${reportId}`).digest('hex');
  const hash = hashToken(token);
  return { token, hash };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const documentationPhotoSelect = {
  id: true,
  url: true,
  isClientVisible: true,
  isPrivate: true,
  isPrimary: true,
  createdAt: true,
  carrierId: true,
  surfaceId: true,
} as const;

export const documentationSurfaceSelect = {
  id: true,
  name: true,
  currentClientId: true,
  directionDescription: true,
  destinationName: true,
  orientation: true,
  photos: {
    where: { isPrivate: false },
    orderBy: [{ isClientVisible: 'desc' as const }, { isPrimary: 'desc' as const }, { createdAt: 'desc' as const }],
    select: documentationPhotoSelect,
  },
  occupancies: {
    select: { clientId: true },
  },
} as const;

export type DocumentationPhoto = {
  id: string;
  url: string;
  isClientVisible?: boolean | null;
  isPrivate?: boolean | null;
  isPrimary?: boolean | null;
  createdAt?: Date | string | null;
  carrierId?: string | null;
  surfaceId?: string | null;
};

export type DocumentationSurface = {
  id: string;
  name?: string | null;
  currentClientId?: string | null;
  directionDescription?: string | null;
  destinationName?: string | null;
  orientation?: string | null;
  photos?: DocumentationPhoto[] | null;
  occupancies?: Array<{ clientId?: string | null }> | null;
};

export type DocumentationCarrier = {
  id: string;
  code?: string | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photos?: DocumentationPhoto[] | null;
  surfaces?: DocumentationSurface[] | null;
};

export type DocumentationPoint = {
  id?: string;
  label?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  orientation?: string | null;
  variant?: string | null;
  surfaceId?: string | null;
  surface?: DocumentationSurface | null;
  installedPhotoId?: string | null;
  installedPhoto?: DocumentationPhoto | null;
  sitePhotoId?: string | null;
  sitePhoto?: DocumentationPhoto | null;
  carrierId?: string | null;
  carrier?: DocumentationCarrier | null;
  updatedAt?: Date | null;
};

/**
 * Determines whether a surface belongs to one of the given client IDs (directly or via occupancy).
 */
export function isSurfaceForClients(surface?: DocumentationSurface | null, allClientIds: string[] = []): boolean {
  if (!surface) return false;
  if (surface.currentClientId && allClientIds.includes(surface.currentClientId)) return true;
  if (surface.occupancies?.some((occ) => occ.clientId && allClientIds.includes(occ.clientId))) return true;
  return false;
}

/**
 * Resolves available photos strictly isolated to the specified client / surface.
 * Guarantees that photos attached to surfaces of other clients on the same carrier
 * are NEVER included or auto-selected.
 */
export function resolveDocumentationPhotos(params: {
  point?: DocumentationPoint | null;
  carrier?: DocumentationCarrier | null;
  surface?: DocumentationSurface | null;
  allClientIds: string[];
  preferredPhotoId?: string | null;
}): {
  availablePhotos: DocumentationPhoto[];
  selectedPhoto: DocumentationPhoto | null;
  matchedSurface: DocumentationSurface | null;
} {
  const { point, carrier, surface: directSurface, allClientIds, preferredPhotoId } = params;

  // 1. Identify matched surface for this item
  let matchedSurface: DocumentationSurface | null = directSurface ?? point?.surface ?? null;
  if (!matchedSurface && point?.surfaceId && carrier?.surfaces) {
    matchedSurface = carrier.surfaces.find((s) => s.id === point.surfaceId) ?? null;
  }
  if (!matchedSurface && carrier?.surfaces) {
    matchedSurface = carrier.surfaces.find((s) => isSurfaceForClients(s, allClientIds)) ?? null;
  }

  // 2. Identify allowed vs disallowed surface IDs on this carrier
  const allowedSurfaceIds = new Set<string>();
  const disallowedSurfaceIds = new Set<string>();

  if (matchedSurface) {
    allowedSurfaceIds.add(matchedSurface.id);
  }
  if (carrier?.surfaces) {
    for (const s of carrier.surfaces) {
      if (matchedSurface && s.id === matchedSurface.id) {
        allowedSurfaceIds.add(s.id);
      } else if (!point?.surfaceId && isSurfaceForClients(s, allClientIds)) {
        allowedSurfaceIds.add(s.id);
      } else {
        disallowedSurfaceIds.add(s.id);
      }
    }
  }

  // 3. Collect candidates in priority order
  const rawCandidates: DocumentationPhoto[] = [];

  // Priority 1: Point installed photo (exact photo of installed board)
  if (point?.installedPhoto && !point.installedPhoto.isPrivate) {
    rawCandidates.push(point.installedPhoto);
  }

  // Priority 2: Photos from matched surface(s)
  const surfacePhotos: DocumentationPhoto[] = [];
  if (matchedSurface?.photos) {
    surfacePhotos.push(...matchedSurface.photos);
  } else if (!point?.surfaceId && carrier?.surfaces) {
    for (const s of carrier.surfaces) {
      if (allowedSurfaceIds.has(s.id) && s.photos) {
        surfacePhotos.push(...s.photos);
      }
    }
  }

  const sortedSurfacePhotos = surfacePhotos
    .filter((p) => !p.isPrivate)
    .sort((a, b) => {
      if (Boolean(a.isClientVisible) !== Boolean(b.isClientVisible)) return a.isClientVisible ? -1 : 1;
      if (Boolean(a.isPrimary) !== Boolean(b.isPrimary)) return a.isPrimary ? -1 : 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  rawCandidates.push(...sortedSurfacePhotos);

  // Priority 3: Carrier-neutral photos (ONLY photos with surfaceId === null/undefined)
  const neutralCarrierPhotos = (carrier?.photos || [])
    .filter((p) => !p.isPrivate && !p.surfaceId)
    .sort((a, b) => {
      if (Boolean(a.isClientVisible) !== Boolean(b.isClientVisible)) return a.isClientVisible ? -1 : 1;
      if (Boolean(a.isPrimary) !== Boolean(b.isPrimary)) return a.isPrimary ? -1 : 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  rawCandidates.push(...neutralCarrierPhotos);

  // Priority 4: Point site photo
  if (point?.sitePhoto && !point.sitePhoto.isPrivate) {
    rawCandidates.push(point.sitePhoto);
  }

  // 4. Strict filtering and de-duplication
  const uniqueMap = new Map<string, DocumentationPhoto>();
  for (const photo of rawCandidates) {
    if (!photo || !photo.id) continue;
    // CRITICAL: NEVER include photos belonging to a disallowed surface
    if (photo.surfaceId && disallowedSurfaceIds.has(photo.surfaceId)) {
      continue;
    }
    // If we have an exact matched surface, any photo with a DIFFERENT surfaceId is dropped
    if (matchedSurface && photo.surfaceId && photo.surfaceId !== matchedSurface.id) {
      continue;
    }
    if (!uniqueMap.has(photo.id)) {
      uniqueMap.set(photo.id, photo);
    }
  }

  const availablePhotos = Array.from(uniqueMap.values());

  // 5. Determine selectedPhoto
  let selectedPhoto: DocumentationPhoto | null = null;
  if (preferredPhotoId) {
    selectedPhoto = availablePhotos.find((p) => p.id === preferredPhotoId) ?? null;
  }
  if (!selectedPhoto && availablePhotos.length > 0) {
    selectedPhoto = availablePhotos[0];
  }

  return {
    availablePhotos,
    selectedPhoto,
    matchedSurface,
  };
}

/**
 * Resolves the direction/orientation description strictly isolated to the specified client / surface.
 * Never pulls descriptions from competitor/other clients' surfaces sharing the same carrier pole.
 */
export function resolveDocumentationDirection(params: {
  point?: { orientation?: string | null; variant?: string | null; surfaceId?: string | null; surface?: DocumentationSurface | null } | null;
  carrier?: DocumentationCarrier | null;
  surface?: DocumentationSurface | null;
  allClientIds: string[];
  customDirection?: string | null;
}): string | undefined {
  const { point, carrier, surface: directSurface, allClientIds, customDirection } = params;

  if (customDirection && customDirection.trim() !== '') {
    return customDirection.trim();
  }

  const directOrientation = point?.orientation;
  if (directOrientation && directOrientation.trim() !== '') {
    return directOrientation.trim();
  }

  // Find target surface strictly for this client
  let targetSurface: DocumentationSurface | null = directSurface ?? point?.surface ?? null;
  if (!targetSurface && point?.surfaceId && carrier?.surfaces) {
    targetSurface = carrier.surfaces.find((s) => s.id === point.surfaceId) ?? null;
  }
  if (!targetSurface && carrier?.surfaces) {
    targetSurface = carrier.surfaces.find((s) => isSurfaceForClients(s, allClientIds)) ?? null;
  }

  if (targetSurface) {
    const desc = targetSurface.directionDescription?.trim();
    if (desc) return desc;
    const dest = targetSurface.destinationName?.trim();
    if (dest) return dest;
    const surfOrient = targetSurface.orientation?.trim();
    if (surfOrient) return surfOrient;
  }

  const variant = point?.variant;
  if (variant && variant.trim() !== '') {
    return variant.trim();
  }

  return undefined;
}

export type SnapshotItemData = {
  id: string;
  pointCode: string;
  address: string;
  city: string;
  locality: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  lastCheckDate: string | null;
  photoDate: string | null;
  direction: string;
  photoUrl: string | null;
  clientNote: string | null;
};

export type PrePublishWarning = {
  type: 'MISSING_PHOTO' | 'UNAPPROVED_PHOTO' | 'MISSING_GPS' | 'MISSING_CHECK_DATE' | 'EMPTY_REPORT' | 'MISSING_CLIENT_EMAIL' | 'OLD_PHOTO';
  message: string;
  count?: number;
};

export function runPrePublishChecks(
  clientEmail: string | null | undefined,
  items: Array<{
    id: string;
    navigationPoint?: {
      label?: string;
      latitude?: number | null;
      longitude?: number | null;
      status?: string;
      updatedAt?: Date;
    } | null;
    carrier?: {
      code?: string;
      latitude?: number | null;
      longitude?: number | null;
      city?: string | null;
    } | null;
    selectedPhoto?: {
      url?: string | null;
      isClientVisible?: boolean | null;
      isPrivate?: boolean | null;
      createdAt?: Date | string | null;
    } | null;
    isVisible?: boolean;
  }>,
  periodFrom?: Date,
): PrePublishWarning[] {
  const warnings: PrePublishWarning[] = [];

  const visibleItems = items.filter((item) => item.isVisible !== false);

  if (visibleItems.length === 0) {
    warnings.push({
      type: 'EMPTY_REPORT',
      message: 'Report neobsahuje žádnou viditelnou položku.',
    });
  }

  if (!clientEmail) {
    warnings.push({
      type: 'MISSING_CLIENT_EMAIL',
      message: 'Klient nemá v systému zadaný e-mailový kontakt.',
    });
  }

  let missingPhotosCount = 0;
  let unapprovedPhotosCount = 0;
  let missingGpsCount = 0;
  let oldPhotosCount = 0;

  for (const item of visibleItems) {
    if (!item.selectedPhoto?.url) {
      missingPhotosCount++;
    } else {
      if (item.selectedPhoto.isClientVisible === false || item.selectedPhoto.isPrivate === true) {
        unapprovedPhotosCount++;
      }
      if (periodFrom && item.selectedPhoto.createdAt && new Date(item.selectedPhoto.createdAt) < periodFrom) {
        oldPhotosCount++;
      }
    }

    const lat = item.navigationPoint?.latitude ?? item.carrier?.latitude;
    const lng = item.navigationPoint?.longitude ?? item.carrier?.longitude;
    if (lat === undefined || lat === null || lng === undefined || lng === null || (lat === 0 && lng === 0)) {
      missingGpsCount++;
    }
  }

  if (missingPhotosCount > 0) {
    warnings.push({
      type: 'MISSING_PHOTO',
      message: `${missingPhotosCount} ${missingPhotosCount === 1 ? 'položka nemá' : 'položky nemají'} vybranou fotografii.`,
      count: missingPhotosCount,
    });
  }

  if (unapprovedPhotosCount > 0) {
    warnings.push({
      type: 'UNAPPROVED_PHOTO',
      message: `${unapprovedPhotosCount} ${unapprovedPhotosCount === 1 ? 'fotografie není schválená' : 'fotografií není schválených'} pro klienta.`,
      count: unapprovedPhotosCount,
    });
  }

  if (missingGpsCount > 0) {
    warnings.push({
      type: 'MISSING_GPS',
      message: `${missingGpsCount} ${missingGpsCount === 1 ? 'položka nemá' : 'položky nemají'} platné GPS souřadnice pro mapu.`,
      count: missingGpsCount,
    });
  }

  if (oldPhotosCount > 0) {
    warnings.push({
      type: 'OLD_PHOTO',
      message: `${oldPhotosCount} ${oldPhotosCount === 1 ? 'fotografie pochází' : 'fotografií pochází'} z období před začátkem sledovaného kvartálu.`,
      count: oldPhotosCount,
    });
  }

  return warnings;
}

export function buildSnapshotItem(item: {
  id: string;
  clientNote?: string | null;
  customDirection?: string | null;
  surface?: {
    id: string;
    name?: string | null;
    directionDescription?: string | null;
    orientation?: string | null;
  } | null;
  navigationPoint?: {
    id: string;
    label: string;
    address?: string | null;
    latitude: number;
    longitude: number;
    status: string;
    orientation?: string | null;
    variant?: string | null;
    updatedAt: Date;
  } | null;
  carrier?: {
    id: string;
    code: string;
    name: string;
    address?: string | null;
    city?: string | null;
    district?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  selectedPhoto?: {
    id: string;
    url?: string | null;
    createdAt?: Date | string | null;
  } | null;
}): SnapshotItemData {
  const code = item.surface?.name || item.navigationPoint?.label || item.carrier?.code || item.carrier?.name || 'NAV';
  const address = item.navigationPoint?.address || item.carrier?.address || 'Adresa neuvedena';
  const city = item.carrier?.city || 'Lokalita neuvedena';
  const locality = item.carrier?.district || item.carrier?.city || '';
  const lat = item.navigationPoint?.latitude ?? item.carrier?.latitude ?? null;
  const lng = item.navigationPoint?.longitude ?? item.carrier?.longitude ?? null;
  const status = item.navigationPoint?.status || 'INSTALLED';
  const lastCheckDate = item.navigationPoint?.updatedAt ? item.navigationPoint.updatedAt.toISOString() : null;
  const photoDate = item.selectedPhoto?.createdAt ? new Date(item.selectedPhoto.createdAt).toISOString() : null;
  const direction =
    item.customDirection ||
    [item.navigationPoint?.orientation, item.navigationPoint?.variant].filter(Boolean).join(' · ') ||
    item.surface?.directionDescription ||
    item.surface?.orientation ||
    'Obousměrný (A/B)';

  return {
    id: item.id,
    pointCode: code,
    address,
    city,
    locality,
    latitude: lat,
    longitude: lng,
    status,
    lastCheckDate,
    photoDate,
    direction,
    photoUrl: item.selectedPhoto?.url ?? null,
    clientNote: item.clientNote ?? null,
  };
}
