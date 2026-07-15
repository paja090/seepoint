import { Prisma, type OfferEventType, type OfferStatus } from '@prisma/client';
import type { CurrentUser } from '@/lib/rbac';
import { prisma } from '@/lib/db';
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
  stripPublicOfferSecrets,
  type OfferInput,
  type OfferStatusValue,
} from './domain';
import { createPublicOfferToken, hashPublicOfferToken, isPlausiblePublicOfferToken } from './token';

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
    validUntil: dateOnly(row.validUntil),
    internalNote: publicView ? undefined : row.internalNote ?? row.note,
    clientMessage: row.clientMessage,
    currency: row.currency,
    taxRate: value(row.taxRate),
    subtotalBeforeDiscount: row.items.reduce((sum, item) => sum.add((item.quantity ?? new Prisma.Decimal(1)).mul(item.unitPrice ?? item.price ?? 0)), new Prisma.Decimal(0)).toFixed(2),
    subtotal: value(row.subtotal ?? row.totalPrice),
    discountAmount: value(row.discountAmount),
    taxAmount: value(row.taxAmount),
    totalWithTax: value(row.totalWithTax ?? row.totalPrice),
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
        }));
      return {
        id: publicView ? undefined : item.id,
        surfaceId: publicView ? undefined : item.surfaceId,
        dateFrom: dateOnly(item.dateFrom),
        dateTo: dateOnly(item.dateTo),
        quantity: value(item.quantity) ?? '1.00',
        unit: item.unit,
        unitPrice: value(item.unitPrice ?? item.price),
        discountPercent: value(item.discountPercent),
        discountAmount: value(item.discountAmount),
        fixedDiscountAmount: recoverFixedDiscount(
          value(item.quantity) ?? '1',
          value(item.unitPrice ?? item.price) ?? '0',
          value(item.discountPercent) ?? '0',
          value(item.discountAmount),
        ),
        subtotal: value(item.subtotal ?? item.price),
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
  const surfaces = await db.advertisingSurface.findMany({ where: { id: { in: ids }, carrier: { archivedAt: null } }, select: { id: true } });
  if (surfaces.length !== ids.length) throw new OfferValidationError('Některá reklamní plocha neexistuje nebo je archivovaná.');
  const client = await db.client.findFirst({ where: { id: input.clientId, active: true }, select: { id: true } });
  if (!client) throw new OfferValidationError('Vybraný klient neexistuje nebo není aktivní.');
}

function offerData(input: OfferInput, user: CurrentUser, calculated: ReturnType<typeof calculateOffer>) {
  return {
    clientId: input.clientId,
    title: input.title,
    campaignName: nullable(input.campaignName),
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

function itemData(item: ReturnType<typeof calculateOffer>['items'][number], index: number) {
  return {
    surfaceId: item.surfaceId,
    dateFrom: parseDateOnly(item.dateFrom, 'Začátek kampaně'),
    dateTo: parseDateOnly(item.dateTo, 'Konec kampaně'),
    quantity: new Prisma.Decimal(item.quantity),
    unit: item.unit,
    unitPrice: new Prisma.Decimal(item.unitPrice),
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

export async function createOffer(user: CurrentUser, raw: unknown, intent: 'draft' | 'send' = 'draft') {
  assertRole(user);
  const input = normalizeOfferInput(raw);
  const calculated = calculateOffer(input.items, input.taxRate);
  if (intent === 'send' && input.validUntil && input.validUntil < new Date().toISOString().slice(0, 10)) throw new OfferValidationError('Nabídku po konci platnosti nelze odeslat. Změňte platnost konceptu.');
  return prisma.$transaction(async (tx) => {
    await validateSurfaces(tx, input);
    const conflicts = await findConflicts(tx, input.items);
    assertConflicts(conflicts, input.confirmNegotiation);
    const now = new Date();
    const row = await tx.offer.create({
      data: {
        ...offerData(input, user, calculated),
        status: intent === 'send' ? 'SENT' : 'DRAFT',
        sentAt: intent === 'send' ? now : null,
        ...serverOfferAuthor(user),
        items: { create: calculated.items.map(itemData) },
        events: { create: [
          { type: 'CREATED', toStatus: 'DRAFT', actorUserId: user.id, actorName: user.name },
          ...(intent === 'send' ? [{ type: 'SENT' as const, fromStatus: 'DRAFT' as const, toStatus: 'SENT' as const, actorUserId: user.id, actorName: user.name }] : []),
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
  const calculated = calculateOffer(input.items, input.taxRate);
  return prisma.$transaction(async (tx) => {
    const existing = await getOfferRow(tx, id);
    assertAccess(user, existing);
    if (existing.status !== 'DRAFT') throw new OfferValidationError('Upravovat lze pouze koncept nabídky.', 'INVALID_STATUS_TRANSITION');
    await validateSurfaces(tx, input);
    const conflicts = await findConflicts(tx, input.items);
    assertConflicts(conflicts, input.confirmNegotiation);
    await tx.offerItem.deleteMany({ where: { offerId: id } });
    const row = await tx.offer.update({
      where: { id },
      data: {
        ...offerData(input, user, calculated),
        items: { create: calculated.items.map(itemData) },
        events: { create: { type: 'UPDATED', actorUserId: user.id, actorName: user.name } },
      },
      include: offerInclude,
    });
    return { offer: serializeOffer(row), conflicts };
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

export async function transitionOffer(user: CurrentUser, id: string, target: OfferStatusValue) {
  return prisma.$transaction(async (tx) => {
    const existing = await getOfferRow(tx, id);
    assertAccess(user, existing);
    if (target === 'ACCEPTED' && !canConvertOfferRole(user.role)) throw new OfferValidationError('Interně přijmout nabídku může pouze administrátor nebo manažer.', 'FORBIDDEN');
    assertOfferTransition(existing.status as OfferStatusValue, target);
    if (target === 'SENT') {
      if (isPastValidity(existing.validUntil)) throw new OfferValidationError('Nabídku po konci platnosti nelze odeslat. Změňte platnost konceptu.');
      const conflicts = await findConflicts(tx, existing.items);
      assertConflicts(conflicts, Boolean(existing.negotiationApprovedAt));
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
  const generated = createPublicOfferToken();
  const row = await prisma.$transaction(async (tx) => {
    const existing = await getOfferRow(tx, id);
    assertAccess(user, existing);
    return tx.offer.update({
      where: { id },
      data: { publicTokenHash: generated.hash, publishedAt: new Date(), updatedByUserId: user.id, events: { create: { type: 'PUBLISHED', actorUserId: user.id, actorName: user.name } } },
      include: offerInclude,
    });
  });
  return { offer: serializeOffer(row), token: generated.token, path: `/proposal/${generated.token}` };
}

async function getPublicRow(token: string) {
  if (!isPlausiblePublicOfferToken(token)) throw new OfferValidationError('Veřejný odkaz není platný.', 'NOT_FOUND');
  const row = await prisma.offer.findUnique({ where: { publicTokenHash: hashPublicOfferToken(token) }, include: offerInclude });
  if (!row || row.archivedAt || !row.publishedAt) throw new OfferValidationError('Nabídka nebyla nalezena.', 'NOT_FOUND');
  return row;
}

export async function getPublicOffer(token: string) {
  const row = await getPublicRow(token);
  return serializeOffer(row, { publicToken: token, publicView: true });
}

export async function respondToPublicOffer(token: string, raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new OfferValidationError('Odpověď není platná.');
  const body = raw as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  const actorName = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const actorEmail = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';
  if (!actorName || !actorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actorEmail)) throw new OfferValidationError('Vyplňte jméno a platný e-mail.');
  return prisma.$transaction(async (tx) => {
    if (!isPlausiblePublicOfferToken(token)) throw new OfferValidationError('Nabídka nebyla nalezena.', 'NOT_FOUND');
    const row = await tx.offer.findUnique({ where: { publicTokenHash: hashPublicOfferToken(token) }, include: offerInclude });
    if (!row || row.archivedAt || !row.publishedAt) throw new OfferValidationError('Nabídka nebyla nalezena.', 'NOT_FOUND');
    if (action === 'question') {
      if (!message) throw new OfferValidationError('Napište prosím dotaz.');
      await tx.offerEvent.create({ data: { offerId: row.id, type: 'QUESTION', actorName, actorEmail, message } });
      return { status: row.status, message: 'Dotaz byl uložen. Obchodník se vám ozve.' };
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
        events: { create: { type: target, fromStatus: row.status, toStatus: target, actorName, actorEmail, message: message || null, metadata: { consent: true, channel: 'public-token' } } },
      },
    });
    return { status: target, message: target === 'ACCEPTED' ? 'Děkujeme, nabídka byla přijata.' : 'Vaše odmítnutí jsme zaznamenali.' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getPublicPhoto(token: string, photoId: string) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(photoId)) throw new OfferValidationError('Fotografie nebyla nalezena.', 'NOT_FOUND');
  const offer = await getPublicRow(token);
  const allowed = offer.items.some((item) => item.surface.photos.some((photo) => photo.id === photoId) || item.surface.carrier.photos.some((photo) => photo.id === photoId));
  if (!allowed) throw new OfferValidationError('Fotografie nebyla nalezena.', 'NOT_FOUND');
  const photo = await prisma.photo.findFirst({ where: { id: photoId, isClientVisible: true }, select: { driveFileId: true, fileName: true, mimeType: true, url: true } });
  if (!photo) throw new OfferValidationError('Fotografie nebyla nalezena.', 'NOT_FOUND');
  return photo;
}

export async function convertOfferToOccupancy(user: CurrentUser, id: string, targetStatus: 'RESERVED' | 'OCCUPIED') {
  if (!canConvertOfferRole(user.role)) throw new OfferValidationError('Převod může provést pouze administrátor nebo manažer.', 'FORBIDDEN');
  return prisma.$transaction(async (tx) => {
    const offer = await getOfferRow(tx, id);
    if (offer.status !== 'ACCEPTED') throw new OfferValidationError('Převést lze pouze přijatou nabídku.', 'INVALID_STATUS_TRANSITION');
    const surfaceIds = offer.items.map((item) => item.surfaceId);
    if (surfaceIds.length === 0) throw new OfferValidationError('Nabídka nemá žádné položky.', 'EMPTY_OFFER');
    await tx.$queryRaw`SELECT "id" FROM "AdvertisingSurface" WHERE "id" IN (${Prisma.join(surfaceIds)}) FOR UPDATE`;
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
}

export async function checkOfferAvailability(user: CurrentUser, raw: unknown) {
  assertRole(user);
  const input = normalizeOfferInput(raw);
  await validateSurfaces(prisma, input);
  const conflicts = await findConflicts(prisma, input.items);
  return { conflicts, canContinue: !conflicts.some((conflict) => conflict.severity === 'block'), requiresConfirmation: conflicts.some((conflict) => conflict.severity === 'warning') };
}
