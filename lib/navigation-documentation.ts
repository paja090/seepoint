import crypto from 'node:crypto';

export function generateSecureToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(token);
  return { token, hash };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
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
      url?: string;
      isClientVisible?: boolean;
      isPrivate?: boolean;
      createdAt?: Date;
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
      if (periodFrom && item.selectedPhoto.createdAt && item.selectedPhoto.createdAt < periodFrom) {
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
    url: string;
    createdAt: Date;
  } | null;
}): SnapshotItemData {
  const code = item.navigationPoint?.label || item.carrier?.code || item.carrier?.name || 'NAV';
  const address = item.navigationPoint?.address || item.carrier?.address || 'Adresa neuvedena';
  const city = item.carrier?.city || 'Lokalita neuvedena';
  const locality = item.carrier?.district || item.carrier?.city || '';
  const lat = item.navigationPoint?.latitude ?? item.carrier?.latitude ?? null;
  const lng = item.navigationPoint?.longitude ?? item.carrier?.longitude ?? null;
  const status = item.navigationPoint?.status || 'INSTALLED';
  const lastCheckDate = item.navigationPoint?.updatedAt ? item.navigationPoint.updatedAt.toISOString() : null;
  const photoDate = item.selectedPhoto?.createdAt ? item.selectedPhoto.createdAt.toISOString() : null;
  const direction = [item.navigationPoint?.orientation, item.navigationPoint?.variant].filter(Boolean).join(' · ') || 'Obousměrné';

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
