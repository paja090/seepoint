import type { OfferView } from './view-model';

export type OfferConflictView = {
  surfaceId: string;
  surfaceName: string;
  carrierCode: string;
  status: string;
  clientName: string;
  campaignName: string;
  dateFrom: string;
  dateTo: string;
  severity: 'block' | 'warning';
};

export function offerAvailabilityInput(offer: OfferView) {
  return {
    clientId: offer.clientId,
    title: offer.title,
    campaignName: offer.campaignName,
    contactPerson: offer.contactPerson,
    contactEmail: offer.contactEmail,
    contactPhone: offer.contactPhone,
    campaignGoal: offer.campaignGoal,
    budget: offer.budget,
    validUntil: offer.validUntil,
    internalNote: offer.internalNote,
    clientMessage: offer.clientMessage,
    taxRate: offer.taxRate,
    confirmNegotiation: false,
    items: offer.items.map((item) => ({
      surfaceId: item.surfaceId,
      dateFrom: item.dateFrom,
      dateTo: item.dateTo,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      discountAmount: item.fixedDiscountAmount ?? '0',
      note: item.note,
      groupLabel: item.groupLabel,
      customTitle: item.customTitle,
      clientDescription: item.clientDescription,
    })),
  };
}

export function offerDateRange(offer: OfferView) {
  const starts = offer.items.map((item) => item.dateFrom).filter(Boolean) as string[];
  const ends = offer.items.map((item) => item.dateTo).filter(Boolean) as string[];
  const from = starts.sort()[0] ?? null;
  const to = ends.sort().at(-1) ?? null;
  const days = from && to ? Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1) : 0;
  return { from, to, days };
}

export function offerMissingAssets(offer: OfferView) {
  return offer.items.flatMap((item) => {
    const missing: Array<{ id: string; kind: 'photo' | 'gps'; code: string; city: string; surface: string }> = [];
    if (item.surface.photos.length === 0) missing.push({ id: `${item.surfaceId}-photo`, kind: 'photo', code: item.surface.carrier.code, city: item.surface.carrier.city, surface: item.surface.name });
    if (item.surface.carrier.latitude == null || item.surface.carrier.longitude == null) missing.push({ id: `${item.surfaceId}-gps`, kind: 'gps', code: item.surface.carrier.code, city: item.surface.carrier.city, surface: item.surface.name });
    return missing;
  });
}
