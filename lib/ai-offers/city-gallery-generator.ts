import type { AiOfferPreview, AiOfferRequest, AiResolvedClient } from './types';

export function generateCityGalleryPreview(input: { request: AiOfferRequest; client: AiResolvedClient; recommendedOfferType: AiOfferPreview['recommendedOfferType']; dateFrom: Date; dateTo: Date; durationMonths: number }): AiOfferPreview {
  return {
    mode: 'preview', offerType: 'CITY_GALLERY', recommendedOfferType: input.recommendedOfferType, client: input.client,
    city: input.request.city?.trim() ?? '', dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10),
    durationMonths: input.durationMonths, budget: input.request.budget ?? null, items: [], catalogTotal: null, budgetDifference: null,
    warnings: ['Galerie venku používá projektový workflow. Rozpočet a projektové položky doplňte v editoru po vytvoření konceptu.'], candidateCount: 0,
    explanation: 'Po potvrzení vznikne koncept v existujícím workflow Galerie venku; AI nevytváří paralelní kalkulaci.',
  };
}
