import 'server-only';
import { prisma } from '@/lib/db';
import type { OfferClientOption, OfferSurfaceOption } from './view-model';

export async function getOfferFormOptions() {
  const [clients, surfaces] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true, companyId: true, contactPerson: true, email: true, phone: true, note: true }, orderBy: { name: 'asc' } }),
    prisma.advertisingSurface.findMany({
      where: { carrier: { archivedAt: null } },
      include: { currentClient: { select: { name: true } }, photos: { where: { type: { not: 'EXPENSE_RECEIPT' } }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] }, carrier: { include: { photos: { where: { type: { not: 'EXPENSE_RECEIPT' } }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } } } },
      orderBy: [{ carrier: { city: 'asc' } }, { carrier: { code: 'asc' } }, { name: 'asc' }],
      take: 2000,
    }),
  ]);
  const clientOptions: OfferClientOption[] = clients;
  const surfaceOptions: OfferSurfaceOption[] = surfaces.map((surface) => ({ id: surface.id, name: surface.name, mediaType: surface.mediaType, status: surface.status, price: surface.price?.toFixed(2) ?? '0.00', currentClient: surface.currentClient?.name, photos: [...surface.photos, ...surface.carrier.photos].filter((photo, index, all) => all.findIndex((item) => item.id === photo.id) === index).map((photo) => ({ id: photo.id, url: `/api/photos/${photo.id}/thumbnail` })), carrier: { id: surface.carrier.id, code: surface.carrier.code, name: surface.carrier.name, city: surface.carrier.city, locality: surface.carrier.locality, street: surface.carrier.street, address: surface.carrier.address, latitude: surface.carrier.latitude, longitude: surface.carrier.longitude, description: surface.carrier.description } }));
  return { clients: clientOptions, surfaces: surfaceOptions };
}
