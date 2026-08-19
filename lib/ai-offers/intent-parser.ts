import type { MediaType, OfferType } from '@prisma/client';

const navigationWords = /\b(naviga|cedul|směrov|smerov|trasa|provozovn|pobočk|pobock)/i;
const galleryWords = /\b(galerie venku|city gallery|výstav|vystav)/i;
const mixWords = /\b(mix|kombinac|různ|ruzn|více typ|vice typ|všechna|vsechna)/i;

const mediaPatterns: Array<[RegExp, MediaType]> = [
  [/city\s*poster/i, 'CITY_POSTER'],
  [/citylight|clv/i, 'CITYLIGHT'],
  [/bigboard/i, 'BIGBOARD'],
  [/billboard/i, 'BILLBOARD'],
  [/lavičk|lavick|babičk|babick/i, 'PROMO_BENCH'],
  [/tower/i, 'PROMO_TOWER'],
  [/banner|placht/i, 'BANNER'],
  [/led|obrazovk/i, 'LED_SCREEN'],
];

export function recommendOfferType(prompt: string): OfferType {
  if (navigationWords.test(prompt)) return 'NAVIGATION';
  if (galleryWords.test(prompt)) return 'CITY_GALLERY';
  return 'STANDARD_MEDIA';
}

export function inferMediaType(prompt: string): MediaType | undefined {
  // If user explicitly asks for a mix or multiple media types, return undefined for auto-mixing
  if (mixWords.test(prompt)) return undefined;

  const matches = mediaPatterns.filter(([pattern]) => pattern.test(prompt));
  if (matches.length > 1) {
    // Multiple distinct media types specified -> return undefined to allow mix
    return undefined;
  }

  return matches[0]?.[1];
}

export function inferQuantity(prompt: string, fallback = 6) {
  const match = prompt.match(/\b(\d{1,3})\s*(?:ks|ploch|cedul|billboard|city|lavičk|babičk|nosič|nosic)/i);
  return match ? Math.max(1, Math.min(100, Number(match[1]))) : fallback;
}
