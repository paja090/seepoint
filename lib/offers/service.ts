import { Prisma, type OfferEventType, type OfferStatus } from '@prisma/client';
import type { CurrentUser } from '@/lib/rbac';
import { platformPrisma, prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';
import { enterTenantContext, runWithTenantContext, requireTenantContext } from '@/lib/tenant-context';
import { convertOfferToNavigationOrderInTransaction } from '@/lib/navigation/navigation-service';
import {
  assertOfferTransition,
  assertAvailability,
  calculateOffer,
  canAccessOffer,
  canConvertOfferRole,
  canManageOfferRole,
  cloneOfferInput,
  normalizeOfferInput,
  OfferValidationError,
  parseDateOnly,
  planOfferConversion,
  recoverFixedDiscount,
  serverOfferAuthor,
  shouldCreateNavigationOrderAfterAcceptance,
  stripPublicOfferSecrets,
  type OfferInput,
  type OfferStatusValue,
} from './domain';
import { createPublicOfferToken, hashPublicOfferToken, isPlausiblePublicOfferToken } from './token';
import type { OfferView } from './view-model';
import { offerReadinessChecks, type OfferConflictView } from './workflow';

type Db = Prisma.TransactionClient | typeof prisma;
type ConflictStatus = 'OCCUPIED' | 'RESERVED' | 'NEGOTIATION';
export type OfferConflict = {
  surfaceId: string;
  surfaceName: string;
  carrierCode: string;
  status: ConflictStatus;
  clientName: string;
  campaignName: string;
  dateFrom: string;
  dateTo: string;
  severity: 'block' | 'warning';
};

const dateOnly = (date: Date | null | undefined) => date?.toISOString().slice(0, 10) ?? null;
const isPastValidity = (date: Date | null | undefined) => Boolean(date && date.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10));
const value = (decimal: Prisma.Decimal | null | undefined) => decimal?.toFixed(2) ?? null;
const nullable = (text: string | undefined) => text || null;

const offerInclude = {
  client: true,
  createdByUser: { select: { id: true, name: true, email: true, role: true } },
  updatedByUser: { select: { id: true, name: true } },
  items: {
    include: {
      surface: {
        include: {
          carrier: { include: { photos: { where: { type: { not: 'EXPENSE_RECEIPT' } }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } } },
          photos: { where: { type: { not: 'EXPENSE_RECEIPT' } }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  charges: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
  navigationOffer: {
    include: {
      points: {
        include: {
          carrier: {
            include: {
              photos: {
                where: { type: { not: 'EXPENSE_RECEIPT' } },
                orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
              },
            },
          },
          sitePhoto: { select: { id: true, url: true } },
          installedPhoto: { select: { id: true, url: true } },
        },
        orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
      },
    },
  },
  cityGalleryOffer: { include: { project: { select: { id: true, title: true, status: true } } } },
  packageSelections: { orderBy: { createdAt: 'asc' as const } },
  events: { orderBy: { createdAt: 'desc' }, take: 100 },
  occupancies: { select: { id: true, surfaceId: true, status: true } },
} satisfies Prisma.OfferInclude;

type OfferRow = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;

export function serializeOffer(row: OfferRow, options: { publicToken?: string; publicView?: boolean } = {}) {
  const publicView = options.publicView === true;
  const token = options.publicToken;
  const serialized = {
    id: publicView ? undefined : row.id,
    clientId: publicView ? undefined : row.clientId,
    title: publicView ? row.campaignName ?? 'Reklamní nabídka' : row.title,
    campaignName: row.campaignName ?? row.title,
    contactPerson: row.contactPerson ?? row.client.contactPerson,
    contactEmail: row.contactEmail ?? row.client.email,
    contactPhone: row.contactPhone ?? row.client.phone,
    campaignGoal: row.campaignGoal,
    budget: publicView ? undefined : value(row.budget),
    status: row.status,
    pricingTier: row.pricingTier || 'komerce',
    offerType: row.offerType,
    validUntil: dateOnly(row.validUntil),
    internalNote: publicView ? undefined : row.internalNote ?? row.note,
    clientMessage: row.clientMessage,
    isNoPriceConcept: Boolean((row as Record<string, unknown>).isNoPriceConcept),
    campaignStrategy: (row as Record<string, unknown>).campaignStrategy ?? null,
    campaignPhases: (row as Record<string, unknown>).campaignPhases ?? null,
    currency: row.currency,
    taxRate: publicView && (row as Record<string, unknown>).isNoPriceConcept ? undefined : value(row.taxRate),
    subtotalBeforeDiscount: publicView && (row as Record<string, unknown>).isNoPriceConcept ? undefined : row.items.reduce((sum, item) => sum.add((item.quantity ?? new Prisma.Decimal(1)).mul(item.unitPrice ?? item.price ?? 0)), new Prisma.Decimal(0)).add(row.charges.reduce((sum, charge) => sum.add(charge.subtotal), new Prisma.Decimal(0))).toFixed(2),
    subtotal: publicView && (row as Record<string, unknown>).isNoPriceConcept ? undefined : value(row.subtotal ?? row.totalPrice),
    discountAmount: publicView && (row as Record<string, unknown>).isNoPriceConcept ? undefined : value(row.discountAmount),
    taxAmount: publicView && (row as Record<string, unknown>).isNoPriceConcept ? undefined : value(row.taxAmount),
    totalWithTax: publicView && (row as Record<string, unknown>).isNoPriceConcept ? undefined : value(row.totalWithTax ?? row.totalPrice),
    hasPublicLink: publicView ? undefined : Boolean(row.publicTokenHash),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    archivedAt: publicView ? undefined : row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdByUser ? { id: row.createdByUser.id, name: row.createdByUser.name, email: publicView ? undefined : row.createdByUser.email } : { name: row.createdBy ?? 'SeePOINT' },
    client: {
      name: row.client.name,
      logoUrl: row.client.logoDriveFileId ? publicView && token ? `/api/proposals/${encodeURIComponent(token)}/logo` : `/api/clients/${row.client.id}/logo/file` : undefined,
      companyId: publicView ? undefined : row.client.companyId,
      contactPerson: row.contactPerson ?? row.client.contactPerson,
      email: row.contactEmail ?? row.client.email,
      phone: row.contactPhone ?? row.client.phone,
    },
    items: row.items.map((item) => {
      const photos = [...item.surface.photos, ...item.surface.carrier.photos]
          .filter((photo) => !publicView || photo.isClientVisible)
        .filter((photo, index, all) => all.findIndex((candidate) => candidate.id === photo.id) === index)
        .map((photo) => ({
          id: photo.id,
          url: publicView && token ? `/api/proposals/${encodeURIComponent(token)}/photos/${photo.id}` : `/api/photos/${photo.id}/thumbnail`,
          note: photo.note,
          isPrimary: photo.isPrimary,
          isClientVisible: photo.isClientVisible,
        }));
      return {
        id: publicView ? undefined : item.id,
        surfaceId: publicView ? undefined : item.surfaceId,
        dateFrom: dateOnly(item.dateFrom),
        dateTo: dateOnly(item.dateTo),
        quantity: value(item.quantity) ?? '1.00',
        unit: item.unit,
        unitPrice: publicView && (row as Record<string, unknown>).isNoPriceConcept ? undefined : value(item.unitPrice ?? item.price),
        discountPercent: publicView && (row as Record<string, unknown>).isNoPriceConcept ? undefined : value(item.discountPercent),
        discountAmount: publicView && (row as Record<string, unknown>).isNoPriceConcept ? undefined : value(item.discountAmount),
        fixedDiscountAmount: publicView && (row as Record<string, unknown>).isNoPriceConcept ? undefined : recoverFixedDiscount(
          value(item.quantity) ?? '1',
          value(item.unitPrice ?? item.price) ?? '0',
          value(item.discountPercent) ?? '0',
          value(item.discountAmount),
        ),
        subtotal: publicView && (row as Record<string, unknown>).isNoPriceConcept ? undefined : value(item.subtotal ?? item.price),
        note: publicView ? undefined : item.note,
        groupLabel: item.groupLabel ?? item.surface.mediaType,
        customTitle: item.customTitle,
        clientDescription: item.clientDescription,
        surface: {
          name: item.surface.name,
          mediaType: item.surface.mediaType,
          size: item.surface.size,
          orientation: item.surface.orientation,
          status: publicView ? undefined : item.surface.status,
          carrier: {
            code: item.surface.carrier.code,
            name: item.surface.carrier.name,
            city: item.surface.carrier.city,
            locality: item.surface.carrier.locality,
            street: item.surface.carrier.street,
            address: item.surface.carrier.address,
            latitude: item.surface.carrier.latitude,
            longitude: item.surface.carrier.longitude,
            description: item.surface.carrier.description,
          },
          photos,
        },
      };
    }),
    charges: publicView && (row as Record<string, unknown>).isNoPriceConcept ? [] : row.charges.map((charge) => ({
      id: publicView ? undefined : charge.id,
      priceRuleId: publicView ? undefined : charge.priceRuleId,
      category: charge.category,
      code: charge.code,
      label: charge.label,
      description: charge.description,
      quantity: charge.quantity.toFixed(2),
      unit: charge.unit,
      unitPrice: charge.unitPrice.toFixed(2),
      subtotal: charge.subtotal.toFixed(2),
    })),
    navigation: row.navigationOffer ? {
      targetName: row.navigationOffer.targetName,
      targetAddress: row.navigationOffer.targetAddress,
      targetLatitude: row.navigationOffer.targetLatitude,
      targetLongitude: row.navigationOffer.targetLongitude,
      targetNote: row.navigationOffer.targetNote,
      targetPhotoUrl: row.navigationOffer.targetPhotoUrl,
      proposalMode: row.navigationOffer.proposalMode || 'LOCATION_SELECTION',
      selectionSubmitted: row.events.some((event) => {
        const metadata = event.metadata as Record<string, unknown> | null;
        return metadata?.action === 'navigation-selection'
          || (event.actorName === 'Klient (veřejný odkaz)' && event.message?.includes('k nacenění'));
      }),
      graphicArtworkUrl: row.navigationOffer.graphicArtworkUrl,
      includeGraphicProof: row.navigationOffer.includeGraphicProof !== false,
      clientArtworkUrl: row.navigationOffer.clientArtworkUrl,
      clientArtworkFileName: row.navigationOffer.clientArtworkFileName,
      points: row.navigationOffer.points.map((point) => {
        const carrierPhoto = point.carrier?.photos?.[0];
        const effectivePhotoId = point.sitePhotoId || point.sitePhoto?.id || point.installedPhotoId || point.installedPhoto?.id || carrierPhoto?.id || null;

        let visualizedUrl = point.visualizedPhotoUrl || undefined;
        if (visualizedUrl && publicView && token && visualizedUrl.includes('/api/photos/')) {
          visualizedUrl = visualizedUrl.replace(/\/api\/photos\/([^/]+).*/, `/api/proposals/${encodeURIComponent(token)}/photos/$1`);
        } else if (!visualizedUrl && effectivePhotoId && publicView && token) {
          visualizedUrl = `/api/proposals/${encodeURIComponent(token)}/photos/${effectivePhotoId}`;
        }

        let siteUrl: string | undefined = undefined;
        if (point.sitePhoto) {
          siteUrl = publicView && token
            ? `/api/proposals/${encodeURIComponent(token)}/photos/${point.sitePhoto.id}`
            : `/api/photos/${point.sitePhoto.id}/thumbnail`;
        } else if (point.sitePhotoId) {
          siteUrl = publicView && token
            ? `/api/proposals/${encodeURIComponent(token)}/photos/${point.sitePhotoId}`
            : `/api/photos/${point.sitePhotoId}/thumbnail`;
        } else if (point.installedPhoto) {
          siteUrl = publicView && token
            ? `/api/proposals/${encodeURIComponent(token)}/photos/${point.installedPhoto.id}`
            : `/api/photos/${point.installedPhoto.id}/thumbnail`;
        } else if (carrierPhoto) {
          siteUrl = publicView && token
            ? `/api/proposals/${encodeURIComponent(token)}/photos/${carrierPhoto.id}`
            : `/api/photos/${carrierPhoto.id}/thumbnail`;
        }

        return {
          id: point.id,
          label: point.label,
          latitude: point.latitude,
          longitude: point.longitude,
          address: point.address,
          quantity: point.quantity.toFixed(2),
          unitPrice: point.unitPrice.toFixed(2),
          subtotal: point.subtotal.toFixed(2),
          installationPrice: point.installationPrice.toFixed(2),
          removalPrice: point.removalPrice.toFixed(2),
          productionPrice: point.productionPrice.toFixed(2),
          framePrice: (point as unknown as { framePrice?: Prisma.Decimal | null }).framePrice ? (point as unknown as { framePrice: Prisma.Decimal }).framePrice.toFixed(2) : '0.00',
          internalNote: publicView ? undefined : point.internalNote,
          clientNote: point.clientNote,
          status: point.status,

          // Structured Navigation fields
          arrowDirectionEnum: point.arrowDirectionEnum,
          pillarNumber: point.pillarNumber,
          pillarType: point.pillarType,
          calculatedDistanceMeters: point.calculatedDistanceMeters,
          manualDistanceValue: point.manualDistanceValue ? point.manualDistanceValue.toNumber() : null,
          manualDistanceUnit: point.manualDistanceUnit,
          distanceSource: point.distanceSource,
          routePolyline: point.routePolyline,
          visualizedPhotoUrl: visualizedUrl,
          sitePhotoId: effectivePhotoId ?? undefined,
          sitePhotoUrl: siteUrl,
          isSelectedByClient: point.isSelectedByClient !== false,
        };
      }),
    } : null,
    cityGallery: row.cityGalleryOffer ? { projectId: row.cityGalleryOffer.projectId, projectTitle: row.cityGalleryOffer.project?.title, concept: row.cityGalleryOffer.concept, locationBrief: row.cityGalleryOffer.locationBrief, realizationNote: row.cityGalleryOffer.realizationNote } : null,
    packageSelections: row.packageSelections.map((selection) => ({ id: selection.id, packageId: selection.packageId, packageName: selection.packageName, selectionMode: selection.selectionMode, standardPrice: value(selection.standardPrice), packagePrice: value(selection.packagePrice) })),
    events: publicView ? undefined : row.events.map((event) => ({
      id: event.id,
      type: event.type,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorName: event.actorName,
      actorEmail: event.actorEmail,
      message: event.message,
      createdAt: event.createdAt.toISOString(),
    })),
    converted: publicView ? undefined : row.occupancies.length > 0,
  };
  return publicView ? stripPublicOfferSecrets(serialized) : serialized;
}

function assertRole(user: CurrentUser) {
  if (!canManageOfferRole(user.role)) throw new OfferValidationError('Nemáte oprávnění spravovat nabídky.', 'FORBIDDEN');
}

function assertAccess(user: CurrentUser, offer: { createdByUserId: string | null }) {
  assertRole(user);
  if (!canAccessOffer(user, offer.createdByUserId)) throw new OfferValidationError('Nemáte oprávnění k této nabídce.', 'FORBIDDEN');
}

async function getOfferRow(db: Db, id: string) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(id)) throw new OfferValidationError('Identifikátor nabídky není platný.', 'NOT_FOUND');
  const row = await db.offer.findUnique({ where: { id }, include: offerInclude });
  if (!row || row.archivedAt) throw new OfferValidationError('Nabídka nebyla nalezena.', 'NOT_FOUND');
  return row;
}

async function findConflicts(db: Db, items: Array<{ surfaceId: string; dateFrom: string | Date; dateTo: string | Date }>, excludeOfferId?: string) {
  const results = await Promise.all(items.map(async (item) => {
    const dateFrom = typeof item.dateFrom === 'string' ? parseDateOnly(item.dateFrom, 'Začátek kampaně') : item.dateFrom;
    const dateTo = typeof item.dateTo === 'string' ? parseDateOnly(item.dateTo, 'Konec kampaně') : item.dateTo;
    const rows = await db.occupancy.findMany({
      where: {
        surfaceId: item.surfaceId,
        offerId: excludeOfferId ? { not: excludeOfferId } : undefined,
        status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] },
        dateFrom: { lte: dateTo },
        dateTo: { gte: dateFrom },
      },
      include: { surface: { include: { carrier: true } } },
      orderBy: { dateFrom: 'asc' },
    });
    return rows.map((row): OfferConflict => ({
      surfaceId: row.surfaceId,
      surfaceName: row.surface.name,
      carrierCode: row.surface.carrier.code,
      status: row.status as ConflictStatus,
      clientName: row.clientName,
      campaignName: row.campaignName,
      dateFrom: dateOnly(row.dateFrom)!,
      dateTo: dateOnly(row.dateTo)!,
      severity: row.status === 'NEGOTIATION' ? 'warning' : 'block',
    }));
  }));
  return results.flat();
}

export function assertConflicts(conflicts: OfferConflict[], confirmNegotiation: boolean) {
  assertAvailability(conflicts, confirmNegotiation);
}

async function validateSurfaces(db: Db, input: OfferInput) {
  const ids = input.items.map((item) => item.surfaceId);
  const surfaces = await db.advertisingSurface.findMany({ where: { id: { in: ids }, status: { not: 'OUT_OF_SERVICE' }, carrier: { archivedAt: null, status: 'ACTIVE' } }, select: { id: true } });
  if (surfaces.length !== ids.length) throw new OfferValidationError('Některá reklamní plocha neexistuje, je mimo provoz nebo patří neaktivnímu nosiči.', 'SURFACE_NOT_OFFERABLE');
  const client = await db.client.findFirst({ where: { id: input.clientId, active: true }, select: { id: true } });
  if (!client) throw new OfferValidationError('Vybraný klient neexistuje nebo není aktivní.');
}

async function resolveCharges(db: Db, input: Pick<OfferInput, 'chargeSelections'>) {
  if (!input.chargeSelections.length) return [];
  const ids = input.chargeSelections.map((selection) => selection.priceRuleId);
  if (new Set(ids).size !== ids.length) throw new OfferValidationError('Každá doplňková sazba smí být v nabídce jen jednou.');
  const rules = await db.offerPriceRule.findMany({ where: { id: { in: ids }, active: true } });
  if (rules.length !== ids.length) throw new OfferValidationError('Některá zvolená sazba už není aktivní. Obnovte ceník.');
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  return input.chargeSelections.map((selection, index) => {
    const rule = byId.get(selection.priceRuleId)!;
    return {
      priceRuleId: rule.id,
      category: rule.category,
      code: rule.code,
      label: rule.label,
      description: rule.description ?? undefined,
      quantity: rule.calculation === 'FLAT' ? '1.00' : selection.quantity,
      unit: rule.unit,
      unitPrice: rule.unitPrice.toFixed(2),
      sortOrder: index,
    };
  });
}

function existingItemInput(item: OfferRow['items'][number]) {
  return {
    surfaceId: item.surfaceId,
    dateFrom: dateOnly(item.dateFrom)!,
    dateTo: dateOnly(item.dateTo)!,
    quantity: value(item.quantity) ?? '1',
    unit: item.unit,
    unitPrice: value(item.unitPrice ?? item.price) ?? '0',
    discountPercent: value(item.discountPercent) ?? '0',
    discountAmount: recoverFixedDiscount(value(item.quantity) ?? '1', value(item.unitPrice ?? item.price) ?? '0', value(item.discountPercent) ?? '0', value(item.discountAmount)),
    note: item.note ?? undefined,
    groupLabel: item.groupLabel ?? undefined,
    customTitle: item.customTitle ?? undefined,
    clientDescription: item.clientDescription ?? undefined,
  };
}

function offerData(input: OfferInput, user: CurrentUser, calculated: ReturnType<typeof calculateOffer>) {
  return {
    clientId: input.clientId,
    title: input.title,
    campaignName: nullable(input.campaignName),
    pricingTier: input.pricingTier || 'komerce',
    contactPerson: nullable(input.contactPerson),
    contactEmail: nullable(input.contactEmail),
    contactPhone: nullable(input.contactPhone),
    campaignGoal: nullable(input.campaignGoal),
    budget: input.budget ? new Prisma.Decimal(input.budget.replace(',', '.')) : null,
    validUntil: input.validUntil ? parseDateOnly(input.validUntil, 'Platnost nabídky') : null,
    note: null,
    internalNote: nullable(input.internalNote),
    clientMessage: nullable(input.clientMessage),
    currency: 'CZK',
    taxRate: new Prisma.Decimal(calculated.totals.taxRate),
    subtotal: new Prisma.Decimal(calculated.totals.subtotal),
    discountAmount: new Prisma.Decimal(calculated.totals.discountAmount),
    taxAmount: new Prisma.Decimal(calculated.totals.taxAmount),
    totalPrice: new Prisma.Decimal(calculated.totals.subtotal),
    totalWithTax: new Prisma.Decimal(calculated.totals.totalWithTax),
    negotiationApprovedAt: input.confirmNegotiation ? new Date() : null,
    updatedByUserId: user.id,
  };
}

function itemData(item: ReturnType<typeof calculateOffer>['items'][number], index: number, user?: CurrentUser) {
  return {
    organizationId: user?.organizationId,
    surfaceId: item.surfaceId,
    dateFrom: parseDateOnly(item.dateFrom, 'Začátek kampaně'),
    dateTo: parseDateOnly(item.dateTo, 'Konec kampaně'),
    quantity: new Prisma.Decimal(item.quantity),
    unit: item.unit,
    unitPrice: new Prisma.Decimal(item.unitPrice),
    catalogPrice: null,
    finalPrice: new Prisma.Decimal(item.unitPrice),
    priceSource: 'MANUAL',
    discountPercent: new Prisma.Decimal(item.discountPercent),
    discountAmount: new Prisma.Decimal(item.calculatedDiscount),
    subtotal: new Prisma.Decimal(item.subtotal),
    price: new Prisma.Decimal(item.subtotal),
    note: nullable(item.note),
    groupLabel: nullable(item.groupLabel),
    customTitle: nullable(item.customTitle),
    clientDescription: nullable(item.clientDescription),
    sortOrder: index,
  };
}

function chargeData(charge: ReturnType<typeof calculateOffer>['charges'][number], user?: CurrentUser) {
  return {
    organizationId: user?.organizationId,
    priceRuleId: charge.priceRuleId,
    category: charge.category,
    code: charge.code,
    label: charge.label,
    description: nullable(charge.description),
    quantity: new Prisma.Decimal(charge.quantity),
    unit: charge.unit,
    unitPrice: new Prisma.Decimal(charge.unitPrice),
    subtotal: new Prisma.Decimal(charge.subtotal),
    sortOrder: charge.sortOrder,
  };
}

async function resolvePackageSelection(db: Db, input: OfferInput) {
  if (!input.packageId) return null;
  const pkg = await db.mediaPackage.findFirst({ where: { id: input.packageId, active: true }, include: { rules: true } });
  if (!pkg) throw new OfferValidationError('Vybraný mediální balíček neexistuje nebo není aktivní.');
  const selected = await db.advertisingSurface.findMany({ where: { id: { in: input.items.map((item) => item.surfaceId) } }, select: { mediaType: true, carrier: { select: { city: true, locality: true } } } });
  for (const rule of pkg.rules) {
    const count = selected.filter((surface) => surface.mediaType === rule.mediaType && (!rule.city || surface.carrier.city === rule.city) && (!rule.locality || surface.carrier.locality === rule.locality)).length;
    if (count < rule.quantity) throw new OfferValidationError(`Balíček ${pkg.name} nemá požadovaný počet dostupných ploch pro ${rule.mediaType}.`, 'INCOMPLETE_MEDIA_PACKAGE');
  }
  return { packageId: pkg.id, packageName: pkg.name, selectionMode: 'AUTOMATIC' as const, standardPrice: pkg.standardPrice, packagePrice: pkg.packagePrice };
}

export async function listOffers(user: CurrentUser, filters: URLSearchParams) {
  assertRole(user);
  const status = filters.get('status');
  const query = filters.get('q')?.trim();
  const clientId = filters.get('clientId')?.trim();
  const createdByUserId = filters.get('createdByUserId')?.trim();
  const mediaType = filters.get('mediaType')?.trim();
  const minPrice = filters.get('minPrice');
  const maxPrice = filters.get('maxPrice');
  const createdFrom = filters.get('createdFrom');
  const createdTo = filters.get('createdTo');
  const validFrom = filters.get('validFrom');
  const validTo = filters.get('validTo');
  const price = (raw: string | null) => raw && /^\d+(?:[.,]\d{1,2})?$/.test(raw) ? new Prisma.Decimal(raw.replace(',', '.')) : undefined;
  const fromDate = (raw: string | null) => raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00.000Z`) : undefined;
  const toDate = (raw: string | null) => raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T23:59:59.999Z`) : undefined;
  const rows = await prisma.offer.findMany({
    where: {
      archivedAt: null,
      AND: [
        user.role === 'SALES' ? { OR: [{ createdByUserId: user.id }, { createdByUserId: null }] } : { createdByUserId: createdByUserId || undefined },
        query ? { OR: [
          { title: { contains: query, mode: 'insensitive' as const } },
          { campaignName: { contains: query, mode: 'insensitive' as const } },
          { client: { name: { contains: query, mode: 'insensitive' as const } } },
        ] } : {},
      ],
      status: status && ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].includes(status) ? status as OfferStatus : undefined,
      offerType: filters.get('type') && ['STANDARD_MEDIA', 'NAVIGATION', 'CITY_GALLERY'].includes(filters.get('type')!) ? filters.get('type') as never : undefined,
      clientId: clientId || undefined,
      totalWithTax: minPrice || maxPrice ? { gte: price(minPrice), lte: price(maxPrice) } : undefined,
      createdAt: createdFrom || createdTo ? { gte: fromDate(createdFrom), lte: toDate(createdTo) } : undefined,
      validUntil: validFrom || validTo ? { gte: fromDate(validFrom), lte: toDate(validTo) } : undefined,
      items: mediaType ? { some: { surface: { mediaType: mediaType as never } } } : undefined,
    },
    include: offerInclude,
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  return rows.map((row) => serializeOffer(row));
}

export async function getOffer(user: CurrentUser, id: string) {
  const row = await getOfferRow(prisma, id);
  assertAccess(user, row);
  return serializeOffer(row);
}

function rejectDirectSend(intent: 'draft' | 'send') {
  if (intent === 'send') throw new OfferValidationError('Nabídku nejprve uložte jako koncept a projděte náhled a kontrolu před odesláním.', 'OFFER_REVIEW_REQUIRED');
}

export async function createOffer(user: CurrentUser, raw: unknown, intent: 'draft' | 'send' = 'draft') {
  assertRole(user);
  rejectDirectSend(intent);
  const input = normalizeOfferInput(raw);
  return prisma.$transaction(async (tx) => {
    await validateSurfaces(tx, input);
    const packageSelection = await resolvePackageSelection(tx, input);
    const calculated = calculateOffer(input.items, input.taxRate, await resolveCharges(tx, input));
    const conflicts = await findConflicts(tx, input.items);
    assertConflicts(conflicts, input.confirmNegotiation);
    const row = await tx.offer.create({
      data: {
        ...offerData(input, user, calculated),
        status: 'DRAFT',
        offerType: 'STANDARD_MEDIA',
        sentAt: null,
        ...serverOfferAuthor(user),
        organizationId: user.organizationId,
        items: { create: calculated.items.map((item, idx) => itemData(item, idx, user)) },
        charges: { create: calculated.charges.map((charge) => chargeData(charge, user)) },
        packageSelections: packageSelection ? { create: { ...packageSelection, organizationId: user.organizationId } } : undefined,
        events: { create: [
          { type: 'CREATED', toStatus: 'DRAFT', actorUserId: user.id, actorName: user.name, organizationId: user.organizationId },
        ] },
      },
      include: offerInclude,
    });
    return { offer: serializeOffer(row), conflicts };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateOffer(user: CurrentUser, id: string, raw: unknown) {
  assertRole(user);
  const input = normalizeOfferInput(raw);
  return prisma.$transaction(async (tx) => {
    const existing = await getOfferRow(tx, id);
    assertAccess(user, existing);
    if (['CONVERTED', 'ARCHIVED'].includes(existing.status)) throw new OfferValidationError('Převedenou nebo archivovanou nabídku již nelze přímo upravovat. Můžete ji duplikovat.', 'INVALID_STATUS_TRANSITION');
    await validateSurfaces(tx, input);
    const packageSelection = await resolvePackageSelection(tx, input);
    const calculated = calculateOffer(input.items, input.taxRate, await resolveCharges(tx, input));
    const conflicts = await findConflicts(tx, input.items);
    assertConflicts(conflicts, input.confirmNegotiation);
    await tx.offerItem.deleteMany({ where: { offerId: id } });
    await tx.offerCharge.deleteMany({ where: { offerId: id } });
    await tx.offerPackageSelection.deleteMany({ where: { offerId: id } });
    const row = await tx.offer.update({
      where: { id },
      data: {
        ...offerData(input, user, calculated),
        items: { create: calculated.items.map((item, idx) => itemData(item, idx, user)) },
        charges: { create: calculated.charges.map((charge) => chargeData(charge, user)) },
        packageSelections: packageSelection ? { create: { ...packageSelection, organizationId: user.organizationId } } : undefined,
        events: { create: { type: 'UPDATED', actorUserId: user.id, actorName: user.name, organizationId: user.organizationId } },
      },
      include: offerInclude,
    });
    return { offer: serializeOffer(row), conflicts };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateOfferPricing(user: CurrentUser, id: string, raw: unknown) {
  assertRole(user);
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rows = Array.isArray(body.chargeSelections) ? (body.chargeSelections as unknown[]) : [];
  const chargeSelections = rows.map((row, index) => {
    if (!row || typeof row !== 'object') throw new OfferValidationError(`Doplňková položka ${index + 1} není platná.`);
    const input = row as Record<string, unknown>;
    const priceRuleId = typeof input.priceRuleId === 'string' ? input.priceRuleId.trim() : '';
    let quantity: Prisma.Decimal;
    try { quantity = new Prisma.Decimal(String(input.quantity ?? '1').replace(',', '.')); } catch { throw new OfferValidationError(`Množství položky ${index + 1} není platné.`); }
    if (!priceRuleId || quantity.lte(0)) throw new OfferValidationError(`Doplňková položka ${index + 1} není platná.`);
    return { priceRuleId, quantity: quantity.toFixed(2) };
  });

  const discountPercentStr = typeof body.discountPercent === 'string' || typeof body.discountPercent === 'number' ? String(body.discountPercent) : null;

  return prisma.$transaction(async (tx) => {
    const existing = await getOfferRow(tx, id);
    assertAccess(user, existing);
    if (['CONVERTED', 'ARCHIVED'].includes(existing.status)) throw new OfferValidationError('Ceník nelze upravovat u převedené nebo archivované nabídky.', 'INVALID_STATUS_TRANSITION');
    
    const items = existing.items.map((item) => {
      const input = existingItemInput(item);
      if (discountPercentStr !== null) {
        input.discountPercent = discountPercentStr;
        input.discountAmount = '0.00';
      }
      return input;
    });

    const calculated = calculateOffer(items, value(existing.taxRate) ?? '21', await resolveCharges(tx, { chargeSelections }));
    
    await tx.offerItem.deleteMany({ where: { offerId: id } });
    await tx.offerCharge.deleteMany({ where: { offerId: id } });

    const row = await tx.offer.update({
      where: { id },
      data: {
        subtotal: new Prisma.Decimal(calculated.totals.subtotal),
        discountAmount: new Prisma.Decimal(calculated.totals.discountAmount),
        taxAmount: new Prisma.Decimal(calculated.totals.taxAmount),
        totalPrice: new Prisma.Decimal(calculated.totals.subtotal),
        totalWithTax: new Prisma.Decimal(calculated.totals.totalWithTax),
        updatedByUserId: user.id,
        items: { create: calculated.items.map((item, idx) => itemData(item, idx, user)) },
        charges: { create: calculated.charges.map((charge) => chargeData(charge, user)) },
        events: { create: { type: 'UPDATED', actorUserId: user.id, actorName: user.name, message: 'Upravena cenová kalkulace a sleva.', organizationId: user.organizationId } },
      },
      include: offerInclude,
    });
    return serializeOffer(row);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function archiveOffer(user: CurrentUser, id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await getOfferRow(tx, id);
    assertAccess(user, existing);
    if (existing.status === 'ACCEPTED') throw new OfferValidationError('Přijatou nabídku nelze archivovat.');
    await tx.offer.update({ where: { id }, data: { archivedAt: new Date(), updatedByUserId: user.id, events: { create: { type: 'ARCHIVED', actorUserId: user.id, actorName: user.name } } } });
    return { archived: true };
  });
}

export async function duplicateOffer(user: CurrentUser, id: string) {
  const existing = await getOfferRow(prisma, id);
  assertAccess(user, existing);
  if (existing.offerType !== 'STANDARD_MEDIA') throw new OfferValidationError('Tento typ nabídky zatím duplikujte z jeho vlastního workflow.', 'INVALID_OFFER_TYPE');
  const raw = {
    clientId: existing.clientId,
    title: existing.title,
    campaignName: existing.campaignName,
    contactPerson: existing.contactPerson,
    contactEmail: existing.contactEmail,
    contactPhone: existing.contactPhone,
    campaignGoal: existing.campaignGoal,
    budget: value(existing.budget),
    validUntil: dateOnly(existing.validUntil),
    internalNote: existing.internalNote,
    clientMessage: existing.clientMessage,
    taxRate: value(existing.taxRate),
    confirmNegotiation: Boolean(existing.negotiationApprovedAt),
    chargeSelections: existing.charges.filter((charge) => charge.priceRuleId).map((charge) => ({ priceRuleId: charge.priceRuleId!, quantity: value(charge.quantity) })),
    items: existing.items.map((item) => ({
      surfaceId: item.surfaceId,
      dateFrom: dateOnly(item.dateFrom),
      dateTo: dateOnly(item.dateTo),
      quantity: value(item.quantity),
      unit: item.unit,
      unitPrice: value(item.unitPrice ?? item.price),
      discountPercent: value(item.discountPercent),
      discountAmount: recoverFixedDiscount(
        value(item.quantity) ?? '1',
        value(item.unitPrice ?? item.price) ?? '0',
        value(item.discountPercent) ?? '0',
        value(item.discountAmount),
      ),
      note: item.note,
      groupLabel: item.groupLabel,
      customTitle: item.customTitle,
      clientDescription: item.clientDescription,
    })),
  };
  const result = await createOffer(user, cloneOfferInput(normalizeOfferInput(raw)));
  await prisma.offerEvent.create({ data: { offerId: result.offer.id!, type: 'DUPLICATED', actorUserId: user.id, actorName: user.name, metadata: { sourceOfferId: id } } });
  return result;
}

function assertOfferSurfacesOfferable(row: OfferRow) {
  const unavailable = row.items.filter((item) => item.surface.status === 'OUT_OF_SERVICE' || item.surface.carrier.status !== 'ACTIVE' || item.surface.carrier.archivedAt);
  if (unavailable.length) {
    throw new OfferValidationError(
      `Nabídku nelze odeslat. ${unavailable.length} ploch je mimo provoz nebo patří neaktivnímu nosiči.`,
      'SURFACE_NOT_OFFERABLE',
      unavailable.map((item) => ({ surfaceId: item.surfaceId, code: item.surface.carrier.code, surface: item.surface.name })),
    );
  }
}

function assertOfferReady(row: OfferRow, conflicts: OfferConflictView[]) {
  assertOfferSurfacesOfferable(row);
  const failed = offerReadinessChecks(serializeOffer(row) as OfferView, conflicts).filter((check) => check.status === 'error');
  if (failed.length) {
    throw new OfferValidationError(
      `Nabídku nelze odeslat. Doplňte: ${failed.map((check) => check.label).join(', ')}.`,
      'OFFER_NOT_READY',
      failed,
    );
  }
}

export async function transitionOffer(user: CurrentUser, id: string, target: OfferStatusValue) {
  return prisma.$transaction(async (tx) => {
    const existing = await getOfferRow(tx, id);
    assertAccess(user, existing);
    if (target === 'ACCEPTED' && !canConvertOfferRole(user.role)) throw new OfferValidationError('Interně přijmout nabídku může pouze administrátor nebo manažer.', 'FORBIDDEN');
    assertOfferTransition(existing.status as OfferStatusValue, target);
    if (target === 'SENT') {
      if (isPastValidity(existing.validUntil)) throw new OfferValidationError('Nabídku po konci platnosti nelze odeslat. Změňte platnost konceptu.');
      if (existing.offerType === 'STANDARD_MEDIA') {
        const conflicts = await findConflicts(tx, existing.items);
        assertConflicts(conflicts, Boolean(existing.negotiationApprovedAt));
        assertOfferReady(existing, conflicts);
      } else {
        assertOfferReady(existing, []);
      }
    }
    const now = new Date();
    const timestamp = target === 'SENT' ? { sentAt: now } : target === 'ACCEPTED' ? { acceptedAt: now } : target === 'REJECTED' ? { rejectedAt: now } : target === 'EXPIRED' ? { expiredAt: now } : {};
    const row = await tx.offer.update({
      where: { id },
      data: {
        status: target,
        ...timestamp,
        updatedByUserId: user.id,
        events: { create: { type: target as OfferEventType, fromStatus: existing.status, toStatus: target, actorUserId: user.id, actorName: user.name } },
      },
      include: offerInclude,
    });
    return serializeOffer(row);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function publishOffer(user: CurrentUser, id: string) {
  const publicToken = createPublicOfferToken();
  const row = await prisma.$transaction(async (tx) => {
    const existing = await getOfferRow(tx, id);
    assertAccess(user, existing);
    const conflicts = existing.offerType === 'STANDARD_MEDIA' ? await findConflicts(tx, existing.items) : [];
    if (existing.offerType === 'STANDARD_MEDIA') {
      assertOfferReady(existing, conflicts);
    }
    const newStatus = existing.status === 'DRAFT' ? 'SENT' : existing.status;
    const isFirstPublish = !existing.publishedAt;
    return tx.offer.update({
      where: { id },
      data: {
        publicTokenHash: publicToken.hash,
        publishedAt: existing.publishedAt || new Date(),
        status: newStatus,
        updatedByUserId: user.id,
        ...(isFirstPublish ? { events: { create: { type: 'PUBLISHED', actorUserId: user.id, actorName: user.name, organizationId: user.organizationId } } } : {}),
      },
      include: offerInclude,
    });
  });
  return { offer: serializeOffer(row), token: publicToken.token, path: `/offer/${publicToken.token}` };
}

export async function prepareOfferDelivery(user: CurrentUser, id: string, emailDraft?: { clientMessage?: string }) {
  const publicToken = createPublicOfferToken();
  const row = await prisma.$transaction(async (tx) => {
    const existing = await getOfferRow(tx, id);
    assertAccess(user, existing);
    if (existing.status !== 'DRAFT' && existing.status !== 'SENT') {
      throw new OfferValidationError('Odeslat lze pouze novou nebo již odeslanou nabídku.', 'INVALID_STATUS_TRANSITION');
    }
    const conflicts = existing.offerType === 'STANDARD_MEDIA' ? await findConflicts(tx, existing.items) : [];
    assertOfferReady(existing, conflicts);
    const isFirstPublish = !existing.publishedAt;
    return tx.offer.update({
      where: { id },
      data: {
        publicTokenHash: publicToken.hash,
        publishedAt: existing.publishedAt || new Date(),
        clientMessage: emailDraft?.clientMessage ?? existing.clientMessage,
        updatedByUserId: user.id,
        ...(isFirstPublish ? { events: { create: { type: 'PUBLISHED', actorUserId: user.id, actorName: user.name, organizationId: user.organizationId } } } : {}),
      },
      include: offerInclude,
    });
  });
  return { offer: serializeOffer(row), token: publicToken.token, path: `/offer/${publicToken.token}` };
}

export async function getPublicRow(token: string) {
  if (!token || typeof token !== 'string') throw new OfferValidationError('Nabídka nebyla nalezena.', 'NOT_FOUND');
  const cleanToken = token.trim();
  if (!isPlausiblePublicOfferToken(cleanToken)) throw new OfferValidationError('Nabídka nebyla nalezena.', 'NOT_FOUND');
  const tokenHash = hashPublicOfferToken(cleanToken);

  const row = await platformPrisma.offer.findUnique({
    where: { publicTokenHash: tokenHash },
    include: offerInclude,
  });

  if (!row || row.archivedAt) throw new OfferValidationError('Nabídka nebyla nalezena.', 'NOT_FOUND');
  enterTenantContext({ organizationId: row.organizationId, source: 'public-token' });
  return row;
}

export async function getPublicOffer(token: string) {
  const row = await getPublicRow(token);
  const organization = await platformPrisma.organization.findUnique({
    where: { id: row.organizationId },
    select: { name: true, logoUrl: true, primaryColor: true, secondaryColor: true, email: true, phone: true, website: true },
  });
  return { ...serializeOffer(row, { publicToken: token, publicView: true }), branding: organization };
}

export async function getPublicClientLogo(token: string) {
  const row = await getPublicRow(token);
  if (!row.client.logoDriveFileId) throw new OfferValidationError('Logo klienta nebylo nalezeno.', 'NOT_FOUND');
  return { driveFileId: row.client.logoDriveFileId, fileName: row.client.logoFileName, mimeType: row.client.logoMimeType };
}

export async function respondToPublicOffer(token: string, raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new OfferValidationError('Odpověď není platná.');
  const body = raw as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  const actorName = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const actorEmail = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';
  if (!actorName || !actorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actorEmail)) throw new OfferValidationError('Vyplňte jméno a platný e-mail.');
  const publicRow = await getPublicRow(token);
  const result = await runWithTenantContext({ organizationId: publicRow.organizationId, source: 'public-token' }, () => prisma.$transaction(async (tx) => {
    const row = await tx.offer.findUnique({ where: { publicTokenHash: hashPublicOfferToken(token) }, include: offerInclude });
    if (!row || row.archivedAt || !row.publishedAt) throw new OfferValidationError('Nabídka nebyla nalezena.', 'NOT_FOUND');
    if (action === 'question' || action === 'revision') {
      if (!message) throw new OfferValidationError(action === 'revision' ? 'Popište prosím požadovanou úpravu.' : 'Napište prosím dotaz.');
      const storedMessage = action === 'revision' ? `Požadavek na úpravu: ${message}` : message;
      await tx.offerEvent.create({
        data: {
          offerId: row.id,
          organizationId: row.organizationId,
          type: 'QUESTION',
          actorName,
          actorEmail,
          message: storedMessage,
          metadata: { responseType: action, channel: 'public-token' },
        },
      });
      return {
        row,
        status: row.status,
        message: action === 'revision'
          ? 'Požadavek na úpravu byl uložen a odeslán obchodníkovi.'
          : 'Dotaz byl uložen a odeslán obchodníkovi.',
      };
    }
    const target = action === 'accept' ? 'ACCEPTED' : action === 'reject' ? 'REJECTED' : null;
    if (!target) throw new OfferValidationError('Akce není podporována.');
    if (body.consent !== true) throw new OfferValidationError('Pro přijetí nebo odmítnutí potvrďte oprávnění jednat za klienta.');
    if (target === 'ACCEPTED' && isPastValidity(row.validUntil)) throw new OfferValidationError('Platnost nabídky skončila. Kontaktujte obchodníka SeePOINT.', 'INVALID_STATUS_TRANSITION');
    assertOfferTransition(row.status as OfferStatusValue, target);
    const now = new Date();
    await tx.offer.update({
      where: { id: row.id },
      data: {
        status: target,
        acceptedAt: target === 'ACCEPTED' ? now : undefined,
        rejectedAt: target === 'REJECTED' ? now : undefined,
        events: {
          create: {
            organizationId: row.organizationId,
            type: target,
            fromStatus: row.status,
            toStatus: target,
            actorName,
            actorEmail,
            message: message || null,
            metadata: { consent: true, channel: 'public-token' },
          },
        },
      },
    });

    if (
      target === 'ACCEPTED'
      && row.createdByUser
      && shouldCreateNavigationOrderAfterAcceptance({
        offerType: row.offerType,
        proposalMode: row.navigationOffer?.proposalMode,
      })
    ) {
      await convertOfferToNavigationOrderInTransaction(tx, row.id, {
        id: row.createdByUser.id,
        email: row.createdByUser.email,
      });
    }

    return { row, status: target, message: target === 'ACCEPTED' ? 'Děkujeme, nabídka byla přijata.' : 'Vaše odmítnutí jsme zaznamenali.' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  // Reserved .invalid addresses are used only by isolated Preview E2E tests.
  // Never contact an external email provider for those tests; Production is unchanged.
  const suppressPreviewTestEmail =
    process.env.VERCEL_ENV === 'preview'
    && actorEmail.toLowerCase().endsWith('.invalid');

  // Asynchronously send notification email to salesperson / agency team
  if (!suppressPreviewTestEmail) try {
    const row = result.row;
    const recipientEmail = row.createdByUser?.email || row.contactEmail || process.env.EMAIL_BCC || 'info@seepoint.cz';
    const actionLabel = action === 'accept' ? 'PŘIJATA' : action === 'reject' ? 'ODMÍTNUTA' : action === 'revision' ? 'ŽÁDOST O ÚPRAVU' : 'NOVÝ DOTAZ';
    const emailSubject = action === 'accept'
      ? `🎉 Nabídka ${row.campaignName} byla PŘIJATA klientem ${actorName}`
      : action === 'reject'
      ? `❌ Nabídka ${row.campaignName} byla odmítnuta (${actorName})`
      : action === 'revision'
      ? `✏️ Požadavek na úpravu nabídky ${row.campaignName} od ${actorName}`
      : `💬 Nový dotaz k nabídce ${row.campaignName} od ${actorName}`;

    const emailText = `Klient reagoval na nabídku v systému SeePOINT:\n\n`
      + `Kampaň: ${row.campaignName}\n`
      + `Klient: ${row.client.name}\n`
      + `Jméno: ${actorName}\n`
      + `E-mail: ${actorEmail}\n`
      + `Stav / Akce: ${actionLabel}\n\n`
      + `Zpráva od klienta:\n${message || 'Bez další textové zprávy'}\n\n`
      + `Detail nabídky v systému:\n${process.env.NEXT_PUBLIC_APP_URL || 'https://os.seepoint.cz'}/offers/${row.id}`;

    await sendTransactionalEmail({
      to: recipientEmail,
      subject: emailSubject,
      message: emailText,
      template: 'offer-client-response',
    });
  } catch (emailError) {
    console.error('[respondToPublicOffer] Failed to send email notification:', emailError);
  }

  return { status: result.status, message: result.message };
}

export async function getPublicPhoto(token: string, photoId: string) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(photoId)) throw new OfferValidationError('Fotografie nebyla nalezena.', 'NOT_FOUND');
  const offer = await getPublicRow(token);
  return runWithTenantContext({ organizationId: offer.organizationId, source: 'public-token' }, async () => {
    const allowed =
      offer.items.some(
        (item) =>
          item.surface.photos.some((photo) => photo.id === photoId) ||
          item.surface.carrier.photos.some((photo) => photo.id === photoId)
      ) ||
      (offer.navigationOffer?.points.some(
        (point) =>
          point.sitePhotoId === photoId ||
          point.installedPhotoId === photoId ||
          point.sitePhoto?.id === photoId ||
          point.installedPhoto?.id === photoId ||
          point.carrier?.photos?.some((p) => p.id === photoId) ||
          (point.visualizedPhotoUrl && point.visualizedPhotoUrl.includes(photoId))
      ) ?? false) ||
      Boolean(
        await prisma.photo.findFirst({
          where: {
            id: photoId,
          },
          select: { id: true },
        })
      );

    if (!allowed) throw new OfferValidationError('Fotografie nebyla nalezena.', 'NOT_FOUND');
    const photo = await prisma.photo.findFirst({
      where: { id: photoId },
      select: { id: true, driveFileId: true, fileName: true, mimeType: true, url: true, content: true, storageKey: true, storageProvider: true },
    });
    if (!photo) throw new OfferValidationError('Fotografie nebyla nalezena.', 'NOT_FOUND');
    return photo;
  });
}

export async function convertOfferToOccupancy(user: CurrentUser, id: string, targetStatus: 'RESERVED' | 'OCCUPIED') {
  if (!canConvertOfferRole(user.role)) throw new OfferValidationError('Převod může provést pouze administrátor nebo manažer.', 'FORBIDDEN');
  if (!user.organizationId) throw new OfferValidationError('Pro převod musí být zvolená aktivní organizace.', 'FORBIDDEN');
  return runWithTenantContext({ organizationId: user.organizationId, userId: user.id, source: 'session' }, () => prisma.$transaction(async (tx) => {
    const offer = await getOfferRow(tx, id);
    if (offer.offerType !== 'STANDARD_MEDIA') throw new OfferValidationError('Na obsazenost lze převést pouze nabídku standardních médií.', 'INVALID_OFFER_TYPE');
    if (offer.status !== 'ACCEPTED') throw new OfferValidationError('Převést lze pouze přijatou nabídku.', 'INVALID_STATUS_TRANSITION');
    assertOfferSurfacesOfferable(offer);
    const surfaceIds = offer.items.map((item) => item.surfaceId);
    if (surfaceIds.length === 0) throw new OfferValidationError('Nabídka nemá žádné položky.', 'EMPTY_OFFER');
    const { organizationId } = requireTenantContext();
    await tx.$queryRaw`SELECT "id" FROM "AdvertisingSurface" WHERE "organizationId" = ${organizationId} AND "id" IN (${Prisma.join(surfaceIds)}) FOR UPDATE`;
    const existing = await tx.occupancy.findMany({ where: { offerId: id }, select: { id: true, surfaceId: true, status: true } });
    const conversionPlan = planOfferConversion(surfaceIds, existing.map((row) => row.surfaceId));
    if (conversionPlan === 'idempotent') {
      return { converted: false, idempotent: true, occupancies: existing };
    }
    const conflicts = await findConflicts(tx, offer.items, id);
    if (conflicts.length) assertAvailability(conflicts, false);
    const occupancies = [];
    for (const item of offer.items) {
      const occupancy = await tx.occupancy.create({
        data: {
          offerId: offer.id,
          surfaceId: item.surfaceId,
          clientId: offer.clientId,
          clientName: offer.client.name,
          campaignName: offer.campaignName ?? offer.title,
          dateFrom: item.dateFrom,
          dateTo: item.dateTo,
          status: targetStatus,
          price: item.subtotal ?? item.price,
          note: item.note,
          createdBy: user.name,
          updatedBy: user.name,
          reservedUntil: targetStatus === 'RESERVED' ? offer.validUntil : null,
        },
      });
      await tx.advertisingSurface.update({ where: { id: item.surfaceId }, data: { status: targetStatus, currentClientId: offer.clientId } });
      occupancies.push(occupancy);
    }
    await tx.offer.update({ where: { id }, data: { updatedByUserId: user.id, events: { create: { type: 'CONVERTED', actorUserId: user.id, actorName: user.name, metadata: { targetStatus, occupancyIds: occupancies.map((row) => row.id) } } } } });
    return { converted: true, idempotent: false, occupancies };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 }));
}

export async function checkOfferAvailability(user: CurrentUser, raw: unknown) {
  assertRole(user);
  const input = normalizeOfferInput(raw);
  await validateSurfaces(prisma, input);
  const conflicts = await findConflicts(prisma, input.items);
  return { conflicts, canContinue: !conflicts.some((conflict) => conflict.severity === 'block'), requiresConfirmation: conflicts.some((conflict) => conflict.severity === 'warning') };
}
