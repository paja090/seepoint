import type { MediaPackageOption, OfferSurfaceOption } from './view-model';

export type PackageSelectionResult = { surfaces: OfferSurfaceOption[]; missing: Array<{ mediaType: string; city?: string | null; locality?: string | null; quantity: number; available: number }> };

export function selectMediaPackageSurfaces(pkg: MediaPackageOption, surfaces: OfferSurfaceOption[]): PackageSelectionResult {
  const selected: OfferSurfaceOption[] = [];
  const used = new Set<string>();
  const missing: PackageSelectionResult['missing'] = [];
  for (const rule of [...pkg.rules].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const candidates = surfaces.filter((surface) => !used.has(surface.id) && surface.mediaType === rule.mediaType && (!rule.city || surface.carrier.city === rule.city) && (!rule.locality || surface.carrier.locality === rule.locality)).sort((a, b) => Number(a.price) - Number(b.price));
    const chosen = candidates.slice(0, rule.quantity);
    chosen.forEach((surface) => { used.add(surface.id); selected.push(surface); });
    if (chosen.length < rule.quantity) missing.push({ mediaType: rule.mediaType, city: rule.city, locality: rule.locality, quantity: rule.quantity, available: chosen.length });
  }
  return { surfaces: selected, missing };
}
