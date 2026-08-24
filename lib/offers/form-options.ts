import 'server-only';
import { prisma } from '@/lib/db';
import type { MediaPackageOption, OfferClientOption, OfferPriceRuleOption, OfferSurfaceOption } from './view-model';

export async function getOfferFormOptions() {
  const [clients, surfaces, priceRules, packages, priceListItems] = await Promise.all([
    prisma.client.findMany({
      where: { active: true },
      select: { id: true, name: true, companyId: true, contactPerson: true, email: true, phone: true, note: true, logoDriveFileId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.advertisingSurface.findMany({
      where: { status: { not: 'OUT_OF_SERVICE' }, carrier: { archivedAt: null, status: 'ACTIVE' } },
      include: {
        currentClient: { select: { name: true } },
        photos: { where: { type: { not: 'EXPENSE_RECEIPT' } }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        carrier: {
          include: {
            photos: { where: { type: { not: 'EXPENSE_RECEIPT' } }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
          },
        },
      },
      orderBy: [{ carrier: { city: 'asc' } }, { carrier: { code: 'asc' } }, { name: 'asc' }],
      take: 2000,
    }),
    prisma.offerPriceRule.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    }),
    prisma.mediaPackage.findMany({
      where: { active: true },
      include: { rules: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.priceListItem.findMany({
      where: { isActive: true, validTo: null },
    }),
  ]);

  const clientOptions: OfferClientOption[] = clients.map(({ logoDriveFileId, ...client }) => ({
    ...client,
    logoUrl: logoDriveFileId ? `/api/clients/${client.id}/logo/file` : undefined,
  }));

  const surfaceOptions: OfferSurfaceOption[] = surfaces.map((surface) => {
    // Find catalog price from the price list items matching either mediaType or carrierType
    const catalogItem = priceListItems.find(
      (item) => item.mediaType === surface.mediaType || item.carrierType === surface.carrier.type
    );
    const resolvedPrice = surface.price?.toFixed(2)
      ?? catalogItem?.rentalPrice.toNumber().toFixed(2)
      ?? '0.00';
    const priceSource = surface.price ? 'SURFACE' : catalogItem ? 'CATALOG' : 'MISSING';

    const numPrice = Number(resolvedPrice) || 8500;
    const isPartner = surface.visibility === 'PARTNER' || surface.carrier.visibility === 'PARTNER' || surface.carrier.visibility === 'MARKETPLACE';
    const partnerDiscountPercent = isPartner ? 20 : 0;
    const wholesaleB2BPrice = isPartner ? (numPrice * 0.8).toFixed(2) : undefined;

    return {
      id: surface.id,
      name: surface.name,
      mediaType: surface.mediaType,
      status: surface.status,
      price: resolvedPrice,
      priceSource,
      isPartner,
      partnerDiscountPercent,
      wholesaleB2BPrice,
      currentClient: surface.currentClient?.name,
      photos: [...surface.photos, ...surface.carrier.photos]
        .filter((photo, index, all) => all.findIndex((item) => item.id === photo.id) === index)
        .map((photo) => ({ id: photo.id, url: `/api/photos/${photo.id}/thumbnail` })),
      carrier: {
        id: surface.carrier.id,
        code: surface.carrier.code,
        name: surface.carrier.name,
        city: surface.carrier.city,
        type: surface.carrier.type,
        locality: surface.carrier.locality,
        street: surface.carrier.street,
        address: surface.carrier.address,
        latitude: surface.carrier.latitude,
        longitude: surface.carrier.longitude,
        description: surface.carrier.description,
      },
    };
  });

  const pricing: OfferPriceRuleOption[] = priceRules.map((rule) => ({
    ...rule,
    mediaType: rule.mediaType,
    unitPrice: rule.unitPrice.toFixed(2),
    validFrom: rule.validFrom?.toISOString().slice(0, 10) ?? null,
    validTo: rule.validTo?.toISOString().slice(0, 10) ?? null,
  }));

  const mediaPackages: MediaPackageOption[] = packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    standardPrice: pkg.standardPrice?.toFixed(2),
    packagePrice: pkg.packagePrice?.toFixed(2),
    defaultDuration: pkg.defaultDuration,
    rules: pkg.rules.map((rule) => ({
      id: rule.id,
      mediaType: rule.mediaType,
      city: rule.city,
      locality: rule.locality,
      quantity: rule.quantity,
      sortOrder: rule.sortOrder,
    })),
  }));

  return {
    clients: clientOptions,
    surfaces: surfaceOptions,
    priceRules: pricing,
    mediaPackages,
    priceListItems: priceListItems.map((item) => ({
      id: item.id,
      name: item.name,
      mediaType: item.mediaType,
      carrierType: item.carrierType,
      rentalPrice: item.rentalPrice.toNumber().toFixed(2),
    })),
  };
}
