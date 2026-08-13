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

export type OfferReadinessStatus = 'ok' | 'warning' | 'error';
export type OfferReadinessCheck = {
  id: string;
  label: string;
  detail: string;
  status: OfferReadinessStatus;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientVisiblePhotos(offer: OfferView) {
  return offer.items.flatMap((item) => item.surface.photos.filter((photo) => photo.isClientVisible === true));
}

export function offerReadinessChecks(offer: OfferView, conflicts: OfferConflictView[] = [], today = new Date().toISOString().slice(0, 10)): OfferReadinessCheck[] {
  const type = offer.offerType ?? 'STANDARD_MEDIA';
  const contactReady = Boolean(offer.client.name && offer.contactPerson && offer.contactEmail && emailPattern.test(offer.contactEmail));
  const validityReady = Boolean(offer.validUntil && offer.validUntil >= today);
  const calculationReady = Number(offer.totalWithTax ?? 0) > 0;
  const common: OfferReadinessCheck[] = [
    { id: 'client', label: 'Klient a kontakt', detail: contactReady ? 'Klient, kontaktní osoba a platný e-mail jsou vyplněné.' : 'Doplňte klienta, kontaktní osobu a platný e-mail.', status: contactReady ? 'ok' : 'error' },
    { id: 'validity', label: 'Platnost nabídky', detail: validityReady ? `Nabídka je platná do ${offer.validUntil}.` : 'Doplňte budoucí nebo dnešní datum platnosti nabídky.', status: validityReady ? 'ok' : 'error' },
    { id: 'calculation', label: 'Kalkulace nabídky', detail: calculationReady ? 'Celková cena včetně DPH je připravena.' : 'Celková cena nabídky musí být vyšší než nula.', status: calculationReady ? 'ok' : 'error' },
  ];

  if (type === 'NAVIGATION') {
    const targetReady = Boolean(offer.navigation?.targetName && Number.isFinite(offer.navigation.targetLatitude) && Number.isFinite(offer.navigation.targetLongitude));
    const pointsReady = Boolean(offer.navigation?.points.length && offer.navigation.points.every((point) => point.label && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)));
    const visualsReady = Boolean(offer.navigation?.points.length && offer.navigation.points.every((point) => Boolean((point as unknown as Record<string, unknown>).visualizedPhotoUrl)));
    const missingVisuals = offer.navigation?.points.filter((point) => !((point as unknown as Record<string, unknown>).visualizedPhotoUrl)).length ?? 0;
    const sitePhotosReady = Boolean(offer.navigation?.points.length && offer.navigation.points.every((point) => Boolean(point.sitePhotoId)));
    const missingSitePhotos = offer.navigation?.points.filter((point) => !point.sitePhotoId).length ?? 0;
    return [
      ...common,
      { id: 'target', label: 'Cíl navigace', detail: targetReady ? 'Cíl má název a GPS pozici.' : 'Doplňte cíl a jeho GPS pozici.', status: targetReady ? 'ok' : 'error' },
      { id: 'points', label: 'Navigační body', detail: pointsReady ? `${offer.navigation?.points.length ?? 0} bodů má název a GPS pozici.` : 'Přidejte alespoň jeden kompletní navigační bod.', status: pointsReady ? 'ok' : 'error' },
      { id: 'navigationSitePhotos', label: 'Terénní fotografie sloupů', detail: sitePhotosReady ? 'Každý návrhový bod má fotografii reálného sloupu.' : `Nahrajte fotografii reálného sloupu u ${missingSitePhotos} navigačních bodů a podle ní ověřte polohu.`, status: sitePhotosReady ? 'ok' : 'error' },
      { id: 'navigationVisuals', label: 'Fotografie a vizualizace bodů', detail: visualsReady ? 'Každý navigační bod má klientský vizuál umístění.' : `Doplňte fotografii nebo vizualizaci u ${missingVisuals} navigačních bodů.`, status: visualsReady ? 'ok' : 'error' },
    ];
  }

  if (type === 'CITY_GALLERY') {
    const conceptReady = Boolean(offer.cityGallery?.concept?.trim());
    const locationReady = Boolean(offer.cityGallery?.locationBrief?.trim());
    return [
      ...common,
      { id: 'concept', label: 'Koncept projektu', detail: conceptReady ? 'Koncept Galerie venku je popsaný.' : 'Doplňte koncept projektu.', status: conceptReady ? 'ok' : 'error' },
      { id: 'location', label: 'Lokalita projektu', detail: locationReady ? 'Lokalita nebo prostor realizace je popsaný.' : 'Doplňte zadání lokality.', status: locationReady ? 'ok' : 'error' },
    ];
  }

  const range = offerDateRange(offer);
  const missing = offerMissingAssets(offer);
  const missingPhotos = missing.filter((asset) => asset.kind === 'photo');
  const missingGps = missing.filter((asset) => asset.kind === 'gps');
  const hardConflicts = conflicts.filter((conflict) => conflict.severity === 'block');
  const datesReady = Boolean(offer.items.length && range.from && range.to && range.days > 0);
  return [
    common[0],
    common[1],
    { id: 'dates', label: 'Termín kampaně', detail: datesReady ? `${range.from} – ${range.to} (${range.days} dnů).` : 'Doplňte platný termín kampaně.', status: datesReady ? 'ok' : 'error' },
    { id: 'availability', label: 'Dostupnost ploch', detail: hardConflicts.length ? `${hardConflicts.length} ploch je blokovaných.` : conflicts.length ? `${conflicts.length} ploch vyžaduje potvrzení probíhajícího jednání.` : 'Všechny plochy jsou bez evidované kolize.', status: hardConflicts.length ? 'error' : conflicts.length ? 'warning' : 'ok' },
    { id: 'photos', label: 'Fotografie pro klienta', detail: missingPhotos.length ? `U ${missingPhotos.length} ploch chybí fotografie označená jako viditelná klientovi.` : `Každá plocha má klientskou fotografii (${clientVisiblePhotos(offer).length} celkem).`, status: missingPhotos.length ? 'error' : 'ok' },
    { id: 'gps', label: 'GPS souřadnice', detail: missingGps.length ? `U ${missingGps.length} ploch chybí GPS souřadnice.` : 'Všechny plochy mají GPS souřadnice.', status: missingGps.length ? 'error' : 'ok' },
    common[2],
  ];
}

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
    if (!item.surface.photos.some((photo) => photo.isClientVisible === true)) missing.push({ id: `${item.surfaceId}-photo`, kind: 'photo', code: item.surface.carrier.code, city: item.surface.carrier.city, surface: item.surface.name });
    if (item.surface.carrier.latitude == null || item.surface.carrier.longitude == null) missing.push({ id: `${item.surfaceId}-gps`, kind: 'gps', code: item.surface.carrier.code, city: item.surface.carrier.city, surface: item.surface.name });
    return missing;
  });
}
