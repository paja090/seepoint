import type { NavigationOrder, NavigationPoint, Photo } from '@prisma/client';
import type {
  RealizationItemContext,
  RealizationPhase,
  RealizationPhotoContext,
} from '../contracts/realization-context';

export type NavigationOrderWithPoints = NavigationOrder & {
  points: Array<
    NavigationPoint & {
      installedPhoto?: Photo | null;
      sitePhoto?: Photo | null;
      carrier?: { id: string; code: string; city: string; address?: string | null } | null;
      surface?: { id: string; name: string } | null;
    }
  >;
};

export function mapNavigationOrderStatusToPhase(status: string): RealizationPhase {
  switch (status) {
    case 'POPTAVKA':
    case 'NABIDKA':
    case 'POTVRZENO_KLIENTEM':
    case 'SMLOUVA_OBJEDNAVKA':
      return 'PREPARATION';
    case 'GRAFICKE_PODKLADY':
    case 'SCHVALENI_GRAFIKY':
      return 'GRAPHICS';
    case 'TISK_VYROBA':
    case 'PRIPRAVENO_K_INSTALACI':
      return 'PRODUCTION';
    case 'INSTALACE':
      return 'INSTALLATION';
    case 'FOTODOKUMENTACE':
      return 'PHOTO_DOCUMENTATION';
    case 'PRIPRAVENO_K_FAKTURACI':
      return 'READY_FOR_BILLING';
    case 'FAKTUROVANO':
      return 'INVOICED';
    case 'DOKONCENO':
      return 'COMPLETED';
    default:
      return 'PREPARATION';
  }
}

export function adaptNavigationPointsToRealizationItems(
  navOrder: NavigationOrderWithPoints,
  fallbackAssignedUserId?: string | null
): RealizationItemContext[] {
  return navOrder.points.map((p) => {
    const photos: RealizationPhotoContext[] = [];

    if (p.installedPhoto) {
      photos.push({
        id: p.installedPhoto.id,
        url: p.installedPhoto.url,
        type: p.installedPhoto.type,
        createdAt: p.installedPhoto.createdAt,
        surfaceId: p.surfaceId || undefined,
        carrierId: p.carrierId || undefined,
        isRelevantForRealization: true,
      });
    }

    if (p.sitePhoto) {
      photos.push({
        id: p.sitePhoto.id,
        url: p.sitePhoto.url,
        type: p.sitePhoto.type,
        createdAt: p.sitePhoto.createdAt,
        surfaceId: p.surfaceId || undefined,
        carrierId: p.carrierId || undefined,
        isRelevantForRealization: false,
      });
    }

    const isInstalled = p.status === 'INSTALLED' || Boolean(p.installedPhotoId);
    const isPhotographed = Boolean(p.installedPhotoId);
    const hasDefect = Boolean(p.issueReported);
    const assignedUserId = p.installerUserId || navOrder.installerUserId || fallbackAssignedUserId || undefined;

    return {
      id: p.id,
      surfaceId: p.surfaceId || undefined,
      surfaceName: p.surface?.name || p.label,
      carrierId: p.carrierId || undefined,
      carrierCode: p.carrier?.code,
      carrierCity: p.carrier?.city,
      carrierAddress: p.address || p.carrier?.address || undefined,
      mediaType: p.navigationType || 'NAVIGATION',
      status: p.status,
      isInstalled,
      isPhotographed,
      hasDefect,
      defectReason: p.issueNote || p.issueType || undefined,
      photos,
      plannedDate: p.plannedInstallationAt || navOrder.plannedInstallationAt || undefined,
      note: p.internalNote || undefined,
      assignedUserId,
    };
  });
}
