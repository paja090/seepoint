import type { MediaType, OfferType } from '@prisma/client';

const navigationWords = /\b(naviga|cedul|směrov|smerov|trasa|provozovn|pobočk|pobock)/i;
const galleryWords = /\b(galerie venku|city gallery|výstav|vystav)/i;
const mediaPatterns: Array<[RegExp, MediaType]> = [
  [/city\s*poster/i, 'CITY_POSTER'], [/citylight/i, 'CITYLIGHT'], [/bigboard/i, 'BIGBOARD'],
  [/billboard/i, 'BILLBOARD'], [/lavičk|lavick/i, 'PROMO_BENCH'], [/tower/i, 'PROMO_TOWER'],
  [/banner/i, 'BANNER'], [/led/i, 'LED_SCREEN'],
];

export function recommendOfferType(prompt: string): OfferType {
  if (navigationWords.test(prompt)) return 'NAVIGATION';
  if (galleryWords.test(prompt)) return 'CITY_GALLERY';
  return 'STANDARD_MEDIA';
}

export function inferMediaType(prompt: string): MediaType | undefined {
  return mediaPatterns.find(([pattern]) => pattern.test(prompt))?.[1];
}

export function inferQuantity(prompt: string, fallback = 6) {
  const match = prompt.match(/\b(\d{1,3})\s*(?:ks|ploch|cedul|billboard|city|nosič|nosic)/i);
  return match ? Math.max(1, Math.min(100, Number(match[1]))) : fallback;
}
