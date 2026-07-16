import 'server-only';
import { prisma } from '@/lib/db';
import type { MediaPackageOption, OfferClientOption, OfferPriceRuleOption, OfferSurfaceOption } from './view-model';

export async function getOfferFormOptions() {
  const [clients, surfaces, priceRules, packages] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true, companyId: true, contactPerson: true, email: true, phone: true, note: true }, orderBy: { name: 'asc' } }),
    prisma.advertisingSurface.findMany({
      where: { carrier: { archivedAt: null } },
      include: { currentClient: { select: { name: true } }, photos: { where: { type: { not: 'EXPENSE_RECEIPT' } }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] }, carrier: { include: { photos: { where: { type: { not: 'EXPENSE_RECEIPT' } }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } } } },
      orderBy: [{ carrier: { city: 'asc' } }, { carrier: { code: 'asc' } }, { name: 'asc' }],
      take: 2000,
    }),
    prisma.offerPriceRule.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }] }),
    prisma.mediaPackage.findMany({ where: { active: true }, include: { rules: { orderBy: { sortOrder: 'asc' } } }, orderBy: { name: 'asc' } }),
  ]);
  const clientOptions: OfferClientOption[] = clients;
  const rentalRules = priceRules.filter((rule) => rule.category === 'RENTAL');
  const surfaceOptions: OfferSurfaceOption[] = surfaces.map((surface) => {
    const catalogPrice = rentalRules.find((rule) => rule.mediaType === surface.mediaType) ?? rentalRules.find((rule) => rule.mediaType === null);
    return { id: surface.id, name: surface.name, mediaType: surface.mediaType, status: surface.status, price: surface.price?.toFixed(2) ?? catalogPrice?.unitPrice.toFixed(2) ?? '0.00', priceSource: surface.price ? 'SURFACE' : catalogPrice ? 'CATALOG' : 'MISSING', currentClient: surface.currentClient?.name, photos: [...surface.photos, ...surface.carrier.photos].filter((photo, index, all) => all.findIndex((item) => item.id === photo.id) === index).map((photo) => ({ id: photo.id, url: `/api/photos/${photo.id}/thumbnail` })), carrier: { id: surface.carrier.id, code: surface.carrier.code, name: surface.carrier.name, city: surface.carrier.city, locality: surface.carrier.locality, street: surface.carrier.street, address: surface.carrier.address, latitude: surface.carrier.latitude, longitude: surface.carrier.longitude, description: surface.carrier.description } };
  });
  const pricing: OfferPriceRuleOption[] = priceRules.map((rule) => ({ ...rule, mediaType: rule.mediaType, unitPrice: rule.unitPrice.toFixed(2) }));
  const mediaPackages: MediaPackageOption[] = packages.map((pkg) => ({ id: pkg.id, name: pkg.name, description: pkg.description, standardPrice: pkg.standardPrice?.toFixed(2), packagePrice: pkg.packagePrice?.toFixed(2), defaultDuration: pkg.defaultDuration, rules: pkg.rules.map((rule) => ({ id: rule.id, mediaType: rule.mediaType, city: rule.city, locality: rule.locality, quantity: rule.quantity, sortOrder: rule.sortOrder })) }));
  return { clients: clientOptions, surfaces: surfaceOptions, priceRules: pricing, mediaPackages };
}
