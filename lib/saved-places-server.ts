import { prisma } from './db';

export type SavedWorkPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  contactName?: string;
  contactPhone?: string;
  openingHours?: string;
  website?: string;
  accessNote?: string;
  updatedAt: string;
};

export function sanitizeSavedPlaces(raw: unknown): SavedWorkPlace[] {
  if (!Array.isArray(raw)) return [];
  const results: SavedWorkPlace[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, 160) : '';
    const address = typeof obj.address === 'string' ? obj.address.trim().slice(0, 300) : '';
    if (!name && !address) continue;
    const lat = typeof obj.latitude === 'number' && Number.isFinite(obj.latitude) ? obj.latitude : null;
    const lng = typeof obj.longitude === 'number' && Number.isFinite(obj.longitude) ? obj.longitude : null;
    results.push({
      id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `place_${Math.random().toString(36).slice(2, 10)}`,
      name: name || address,
      address,
      latitude: lat,
      longitude: lng,
      contactName: typeof obj.contactName === 'string' && obj.contactName.trim() ? obj.contactName.trim().slice(0, 160) : undefined,
      contactPhone: typeof obj.contactPhone === 'string' && obj.contactPhone.trim() ? obj.contactPhone.trim().slice(0, 80) : undefined,
      openingHours: typeof obj.openingHours === 'string' && obj.openingHours.trim() ? obj.openingHours.trim().slice(0, 200) : undefined,
      website: typeof obj.website === 'string' && obj.website.trim() ? obj.website.trim().slice(0, 300) : undefined,
      accessNote: typeof obj.accessNote === 'string' && obj.accessNote.trim() ? obj.accessNote.trim().slice(0, 500) : undefined,
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
    });
  }
  return results.slice(0, 100);
}

export async function getOrganizationSavedPlaces(organizationId: string): Promise<SavedWorkPlace[]> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plannerDefaults: true },
    });
    const defaults = org?.plannerDefaults as Record<string, unknown> | null;
    if (defaults && Array.isArray(defaults.savedWorkPlaces)) {
      return sanitizeSavedPlaces(defaults.savedWorkPlaces);
    }
  } catch (err) {
    console.error('[getOrganizationSavedPlaces] Failed to load saved places:', err);
  }
  return [];
}

export async function upsertOrganizationSavedPlace(
  organizationId: string,
  input: Omit<SavedWorkPlace, 'id' | 'updatedAt'> & { id?: string }
): Promise<SavedWorkPlace[]> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plannerDefaults: true },
  });
  const existingDefaults = (org?.plannerDefaults as Record<string, unknown> | null) || {};
  const currentPlaces = sanitizeSavedPlaces(existingDefaults.savedWorkPlaces);

  const norm = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const cleanName = (input.name || input.address || '').trim().slice(0, 160);
  const cleanAddress = (input.address || '').trim().slice(0, 300);
  if (!cleanName && !cleanAddress) {
    throw new Error('Vyplňte alespoň název nebo adresu místa.');
  }

  const existingIdx = currentPlaces.findIndex(
    (p) =>
      (input.id && p.id === input.id) ||
      (cleanName && norm(p.name) === norm(cleanName)) ||
      (cleanAddress && p.address && norm(p.address) === norm(cleanAddress) && norm(p.name) === norm(cleanName))
  );

  const entry: SavedWorkPlace = {
    id:
      existingIdx >= 0
        ? currentPlaces[existingIdx].id
        : input.id || `place_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName || cleanAddress,
    address: cleanAddress,
    latitude: typeof input.latitude === 'number' && Number.isFinite(input.latitude) ? input.latitude : null,
    longitude: typeof input.longitude === 'number' && Number.isFinite(input.longitude) ? input.longitude : null,
    contactName: input.contactName?.trim() || undefined,
    contactPhone: input.contactPhone?.trim() || undefined,
    openingHours: input.openingHours?.trim() || undefined,
    website: input.website?.trim() || undefined,
    accessNote: input.accessNote?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };

  const nextPlaces =
    existingIdx >= 0
      ? currentPlaces.map((p, idx) => (idx === existingIdx ? entry : p))
      : [entry, ...currentPlaces].slice(0, 100);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      plannerDefaults: {
        ...existingDefaults,
        savedWorkPlaces: nextPlaces,
      },
    },
  });

  return nextPlaces;
}

export async function deleteOrganizationSavedPlace(
  organizationId: string,
  placeId: string
): Promise<SavedWorkPlace[]> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plannerDefaults: true },
  });
  const existingDefaults = (org?.plannerDefaults as Record<string, unknown> | null) || {};
  const currentPlaces = sanitizeSavedPlaces(existingDefaults.savedWorkPlaces);
  const nextPlaces = currentPlaces.filter((p) => p.id !== placeId);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      plannerDefaults: {
        ...existingDefaults,
        savedWorkPlaces: nextPlaces,
      },
    },
  });

  return nextPlaces;
}
