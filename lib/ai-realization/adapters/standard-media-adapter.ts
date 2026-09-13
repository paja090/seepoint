import type { CrmRealization, Photo, AdvertisingSurface, AdvertisingCarrier } from '@prisma/client';
import type {
  RealizationItemContext,
  RealizationPhotoContext,
} from '../contracts/realization-context';

export type CrmRealizationWithRelations = CrmRealization & {
  surface?: (AdvertisingSurface & { carrier?: AdvertisingCarrier | null }) | null;
  carrier?: AdvertisingCarrier | null;
  photos?: Photo[];
};

export function adaptStandardMediaRealizationItems(
  realizations: CrmRealizationWithRelations[],
  campaignDateFrom?: Date | null,
  orderCreatedAt?: Date | null
): RealizationItemContext[] {
  const referenceDate = campaignDateFrom || orderCreatedAt || new Date(0);

  return realizations.map((r) => {
    const rawPhotos = r.photos || [];
    const photos: RealizationPhotoContext[] = rawPhotos.map((p) => {
      // Historical photo check (Clarification #14 & Scenario N):
      // A photo is only considered valid realization documentation if it is either:
      // 1. Explicitly linked to this crmRealizationId, OR
      // 2. Attached to the surface/carrier AND captured on/after the realization/campaign reference date.
      const isDirectlyLinked = p.crmRealizationId === r.id;
      const isWithinRealizationTimeframe =
        new Date(p.createdAt).getTime() >= new Date(referenceDate).getTime() - 24 * 60 * 60 * 1000;
      const isDocumentationType = ['INSTALLATION', 'AFTER_INSTALLATION', 'CONTROL', 'CAMPAIGN'].includes(
        p.type
      );

      const isRelevant = isDirectlyLinked || (isWithinRealizationTimeframe && isDocumentationType);

      return {
        id: p.id,
        url: p.url,
        type: p.type,
        createdAt: p.createdAt,
        surfaceId: p.surfaceId || undefined,
        carrierId: p.carrierId || undefined,
        crmRealizationId: p.crmRealizationId || undefined,
        isRelevantForRealization: isRelevant,
      };
    });

    const hasRelevantPhoto = photos.some((p) => p.isRelevantForRealization);
    const isInstalled = [
      'INSTALLED',
      'PHOTOGRAPHED',
      'DELIVERED_TO_CLIENT',
      'COMPLETED',
    ].includes(r.status);
    const isPhotographed = r.status === 'PHOTOGRAPHED' || hasRelevantPhoto;

    const carrier = r.surface?.carrier || r.carrier;
    const isCarrierOutOfService = (carrier as { status?: string } | undefined)?.status === 'OUT_OF_SERVICE';
    const hasDefect = r.status === 'CLAIM' || Boolean(r.claimNote) || isCarrierOutOfService;
    const defectReason = r.claimNote || (isCarrierOutOfService ? 'Nosič je mimo provoz (OUT_OF_SERVICE)' : undefined);

    return {
      id: r.id,
      surfaceId: r.surfaceId || undefined,
      surfaceName: r.surface?.name,
      carrierId: r.carrierId || carrier?.id || undefined,
      carrierCode: carrier?.code,
      carrierCity: carrier?.city,
      carrierAddress: carrier?.address || undefined,
      mediaType: r.surface?.mediaType || undefined,
      status: r.status,
      isInstalled,
      isPhotographed,
      hasDefect,
      defectReason,
      photos,
      plannedDate: r.plannedDate || undefined,
      actualDate: r.actualDate || undefined,
      assignedUserId: r.assignedUserId || undefined,
      note: r.note || undefined,
    };
  });
}
