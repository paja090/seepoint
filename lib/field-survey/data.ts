import 'server-only';
import { prisma } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenant-context';
import { deleteStoredPhoto } from '@/lib/storage/photo-storage';
import type { FieldSurveySurfaceType, FieldSurveyPointStatus, FieldSurveyGpsSource, Prisma } from '@prisma/client';

export type FieldSurveyListItem = Prisma.FieldSurveyGetPayload<{
  include: {
    createdBy: { select: { id: true; name: true } };
    _count: { select: { points: true } };
  };
}>;

// ==========================================
// FIELD SURVEY DATA LAYER
// Veškeré DB operace pro FieldSurvey doménu
// Tenant isolation je vynucena PostgreSQL RLS přes enterTenantContext()
// ==========================================

export type CreateSurveyInput = {
  name: string;
  description?: string;
  createdByUserId: string;
};

export type CreateSurveyPointInput = {
  surveyId: string;
  surfaceType: FieldSurveySurfaceType;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters?: number;
  gpsSource?: FieldSurveyGpsSource;
  capturedAt?: Date;
  address?: string;
  note?: string;
  createdByUserId: string;
};

export type UpdateSurveyPointInput = {
  surfaceType?: FieldSurveySurfaceType;
  status?: FieldSurveyPointStatus;
  note?: string;
  address?: string;
};

/** Vytvoří novou průzkumnou akci */
export async function createFieldSurvey(input: CreateSurveyInput) {
  const { organizationId } = requireTenantContext();
  return prisma.fieldSurvey.create({
    data: {
      organizationId,
      name: input.name.trim().slice(0, 200),
      description: input.description?.trim().slice(0, 1000),
      createdByUserId: input.createdByUserId,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { points: true } },
    },
  });
}

/** Seznam průzkumných akcí pro tenantu */
export async function listFieldSurveys(options?: { status?: string }): Promise<FieldSurveyListItem[]> {
  const { organizationId } = requireTenantContext();
  return prisma.fieldSurvey.findMany({
    where: {
      organizationId,
      ...(options?.status ? { status: options.status as import('@prisma/client').FieldSurveyStatus } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { points: true } },
    },
  });
}

/** Detail průzkumné akce */
export async function getFieldSurvey(id: string) {
  const { organizationId } = requireTenantContext();
  return prisma.fieldSurvey.findFirst({
    where: { id, organizationId },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { points: true } },
    },
  });
}

/** Vytvoří průzkumný bod – základ mobilního workflow */
export async function createFieldSurveyPoint(input: CreateSurveyPointInput) {
  const { organizationId } = requireTenantContext();

  // Ověříme, že survey patří tomuto tenantu
  const survey = await prisma.fieldSurvey.findFirst({
    where: { id: input.surveyId, organizationId },
    select: { id: true },
  });
  if (!survey) throw new Error('Survey not found or access denied.');

  return prisma.fieldSurveyPoint.create({
    data: {
      organizationId,
      surveyId: input.surveyId,
      surfaceType: input.surfaceType,
      latitude: input.latitude,
      longitude: input.longitude,
      gpsAccuracyMeters: input.gpsAccuracyMeters ?? null,
      gpsSource: input.gpsSource ?? 'DEVICE',
      capturedAt: input.capturedAt ?? new Date(),
      address: input.address?.trim().slice(0, 500) ?? null,
      note: input.note?.trim().slice(0, 2000) ?? null,
      createdByUserId: input.createdByUserId,
      status: 'NEW',
    },
    include: {
      photos: { orderBy: { sortOrder: 'asc' }, take: 1 },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

/** Načte body průzkumu s filtry (pro mapu a seznam) */
export async function listFieldSurveyPoints(options: {
  surveyId?: string;
  status?: FieldSurveyPointStatus;
  surfaceType?: FieldSurveySurfaceType;
  createdByUserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasParcel?: boolean;
  hasContact?: boolean;
  hasAiAnalysis?: boolean;
  skip?: number;
  take?: number;
}) {
  const { organizationId } = requireTenantContext();

  return prisma.fieldSurveyPoint.findMany({
    where: {
      organizationId,
      ...(options.surveyId ? { surveyId: options.surveyId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.surfaceType ? { surfaceType: options.surfaceType } : {}),
      ...(options.createdByUserId ? { createdByUserId: options.createdByUserId } : {}),
      ...(options.dateFrom || options.dateTo
        ? {
            createdAt: {
              ...(options.dateFrom ? { gte: options.dateFrom } : {}),
              ...(options.dateTo ? { lte: options.dateTo } : {}),
            },
          }
        : {}),
      ...(options.hasParcel === true ? { parcelData: { isNot: null } } : {}),
      ...(options.hasParcel === false ? { parcelData: { is: null } } : {}),
      ...(options.hasContact === true ? { contactData: { isNot: null } } : {}),
      ...(options.hasContact === false ? { contactData: { is: null } } : {}),
      ...(options.hasAiAnalysis === true ? { aiAnalysis: { isNot: null } } : {}),
      ...(options.hasAiAnalysis === false ? { aiAnalysis: { is: null } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    skip: options.skip ?? 0,
    take: options.take ?? 500,
    include: {
      photos: { orderBy: { sortOrder: 'asc' }, take: 3, select: { id: true, url: true, mimeType: true, sortOrder: true } },
      createdBy: { select: { id: true, name: true } },
      parcelData: true,
      ownerData: true,
      contactData: true,
      aiAnalysis: {
        select: {
          status: true,
          suggestedType: true,
          isUsable: true,
          confirmedAt: true,
          locationDesc: true,
          visibility: true,
          orientation: true,
          surroundings: true,
          obstacles: true,
          placementChar: true,
          errorMessage: true,
        },
      },
    },
  });
}

/** Detail průzkumného bodu s kompletními daty */
export async function getFieldSurveyPoint(id: string) {
  const { organizationId } = requireTenantContext();
  return prisma.fieldSurveyPoint.findFirst({
    where: { id, organizationId },
    include: {
      survey: { select: { id: true, name: true } },
      photos: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { id: true, name: true, email: true } },
      convertedBy: { select: { id: true, name: true } },
      convertedCarrier: { select: { id: true, code: true, name: true } },
      parcelData: { include: { verifiedBy: { select: { id: true, name: true } } } },
      ownerData: { include: { verifiedBy: { select: { id: true, name: true } } } },
      contactData: true,
      aiAnalysis: { include: { confirmedBy: { select: { id: true, name: true } } } },
    },
  });
}

/** Aktualizuje průzkumný bod */
export async function updateFieldSurveyPoint(id: string, input: UpdateSurveyPointInput) {
  const { organizationId } = requireTenantContext();

  // Ověříme vlastnictví
  const existing = await prisma.fieldSurveyPoint.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) throw new Error('Point not found or access denied.');

  return prisma.fieldSurveyPoint.update({
    where: { id },
    data: {
      ...(input.surfaceType ? { surfaceType: input.surfaceType } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.note !== undefined ? { note: input.note?.trim().slice(0, 2000) ?? null } : {}),
      ...(input.address !== undefined ? { address: input.address?.trim().slice(0, 500) ?? null } : {}),
    },
  });
}

/** Připojí fotografii k průzkumnému bodu */
export async function createFieldSurveyPhotoRecord(input: {
  id?: string;
  surveyPointId: string;
  url: string;
  driveFileId?: string | null;
  storageKey: string;
  storageProvider: string;
  contentChecksum?: string;
  content?: Buffer | null;
  fileName: string;
  mimeType: string;
  size: number;
  note?: string;
}) {
  const { organizationId } = requireTenantContext();

  // Ověříme, že bod patří tomuto tenantu
  const point = await prisma.fieldSurveyPoint.findFirst({
    where: { id: input.surveyPointId, organizationId },
    select: { id: true },
  });
  if (!point) throw new Error('Survey point not found or access denied.');

  // Zjistíme pořadí pro novou fotografii
  const count = await prisma.fieldSurveyPhoto.count({ where: { surveyPointId: input.surveyPointId } });

  return prisma.fieldSurveyPhoto.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      organizationId,
      surveyPointId: input.surveyPointId,
      url: input.url,
      driveFileId: input.driveFileId ?? null,
      storageKey: input.storageKey,
      storageProvider: input.storageProvider,
      contentChecksum: input.contentChecksum ?? null,
      content: input.content ? new Uint8Array(input.content) : null,
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.size,
      note: input.note?.trim().slice(0, 500) ?? null,
      sortOrder: count,
    },
  });
}

/** Smaže fotografii průzkumného bodu */
export async function deleteFieldSurveyPhoto(photoId: string) {
  const { organizationId } = requireTenantContext();
  const photo = await prisma.fieldSurveyPhoto.findFirst({
    where: { id: photoId, organizationId },
  });
  if (!photo) throw new Error('Photo not found or access denied.');
  await prisma.fieldSurveyPhoto.delete({ where: { id: photoId } });
  return photo;
}

/** Smaže průzkumný bod včetně všech podřízených dat a fotografií */
export async function deleteFieldSurveyPoint(pointId: string) {
  const { organizationId } = requireTenantContext();
  const point = await prisma.fieldSurveyPoint.findFirst({
    where: { id: pointId, organizationId },
    include: { photos: true },
  });
  if (!point) throw new Error('Survey point not found or access denied.');

  // Smažeme fyzické soubory fotografií
  for (const photo of point.photos) {
    try {
      await deleteStoredPhoto({
        driveFileId: photo.driveFileId,
        storageProvider: photo.storageProvider,
      });
    } catch {
      // pokus o úklid ze storage
    }
  }

  // Transakčně smažeme relační data a bod
  await prisma.$transaction([
    prisma.fieldSurveyPhoto.deleteMany({ where: { surveyPointId: pointId } }),
    prisma.fieldSurveyParcel.deleteMany({ where: { surveyPointId: pointId } }),
    prisma.fieldSurveyOwner.deleteMany({ where: { surveyPointId: pointId } }),
    prisma.fieldSurveyContact.deleteMany({ where: { surveyPointId: pointId } }),
    prisma.fieldSurveyAiAnalysis.deleteMany({ where: { surveyPointId: pointId } }),
    prisma.fieldSurveyPoint.delete({ where: { id: pointId } }),
  ]);

  return point;
}

/** Smaže celou průzkumnou akci včetně všech jejích bodů */
export async function deleteFieldSurvey(surveyId: string) {
  const { organizationId } = requireTenantContext();
  const survey = await prisma.fieldSurvey.findFirst({
    where: { id: surveyId, organizationId },
    include: { points: { select: { id: true } } },
  });
  if (!survey) throw new Error('Survey not found or access denied.');

  for (const pt of survey.points) {
    await deleteFieldSurveyPoint(pt.id);
  }

  await prisma.fieldSurvey.delete({ where: { id: surveyId } });
  return survey;
}

/** Uloží nebo aktualizuje parcelní data (pouze z externího zdroje, ne AI) */
export async function upsertFieldSurveyParcel(
  surveyPointId: string,
  data: {
    parcelNumber?: string;
    cadastralArea?: string;
    municipality?: string;
    lv?: string;
    source: string;
    sourceUrl?: string;
    confidence: 'VERIFIED' | 'APPROXIMATE' | 'UNVERIFIED';
    rawData?: unknown;
    verifiedByUserId?: string;
  }
) {
  const { organizationId } = requireTenantContext();

  // Ověříme tenant ownership
  const point = await prisma.fieldSurveyPoint.findFirst({
    where: { id: surveyPointId, organizationId },
    select: { id: true },
  });
  if (!point) throw new Error('Survey point not found or access denied.');

  const result = await prisma.fieldSurveyParcel.upsert({
    where: { surveyPointId },
    create: {
      organizationId,
      surveyPointId,
      ...data,
      rawData: data.rawData ? (data.rawData as object) : undefined,
      verifiedAt: data.verifiedByUserId ? new Date() : undefined,
    },
    update: {
      ...data,
      rawData: data.rawData ? (data.rawData as object) : undefined,
      verifiedAt: data.verifiedByUserId ? new Date() : undefined,
    },
  });

  // Aktualizujeme status bodu pokud parcela nalezena
  if (data.parcelNumber) {
    await prisma.fieldSurveyPoint.update({
      where: { id: surveyPointId },
      data: { status: 'PARCEL_FOUND' },
    });
  }

  return result;
}

/** Převede průzkumný bod na nosič (pouze ADMIN/MANAGER) – idempotentní */
export async function convertSurveyPointToCarrier(
  surveyPointId: string,
  carrierData: {
    code: string;
    name: string;
    city: string;
    type: string;
    note?: string;
  },
  convertedByUserId: string
) {
  const { organizationId } = requireTenantContext();

  const point = await prisma.fieldSurveyPoint.findFirst({
    where: { id: surveyPointId, organizationId },
    include: { photos: { take: 1, orderBy: { sortOrder: 'asc' } } },
  });
  if (!point) throw new Error('Survey point not found or access denied.');

  // Idempotence – pokud byl bod již převeden, vrátíme existující nosič
  if (point.convertedCarrierId) {
    const existingCarrier = await prisma.advertisingCarrier.findUnique({
      where: { id: point.convertedCarrierId },
    });
    return { carrier: existingCarrier, alreadyConverted: true };
  }

  // Transakce: vytvoříme nosič a označíme bod jako CONVERTED
  const result = await prisma.$transaction(async (tx) => {
    const carrier = await tx.advertisingCarrier.create({
      data: {
        organizationId,
        code: carrierData.code.trim().slice(0, 50),
        name: carrierData.name.trim().slice(0, 200),
        city: carrierData.city.trim().slice(0, 100),
        type: carrierData.type as import('@prisma/client').CarrierType,
        latitude: point.latitude,
        longitude: point.longitude,
        gpsStatus: 'VERIFIED',
        note: [
          carrierData.note ?? '',
          `Převedeno z průzkumného bodu ${surveyPointId} (${point.surfaceType})`,
        ].filter(Boolean).join(' | ').slice(0, 500),
        status: 'ACTIVE',
      },
    });

    await tx.fieldSurveyPoint.update({
      where: { id: surveyPointId },
      data: {
        convertedCarrierId: carrier.id,
        convertedAt: new Date(),
        convertedByUserId,
        status: 'CONVERTED',
      },
    });

    return carrier;
  });

  return { carrier: result, alreadyConverted: false };
}

/** Aktualizuje průzkumnou akci */
export async function updateFieldSurvey(id: string, data: { name?: string; description?: string; status?: import('@prisma/client').FieldSurveyStatus }) {
  const { organizationId } = requireTenantContext();
  const existing = await prisma.fieldSurvey.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error('Survey not found or access denied.');

  return prisma.fieldSurvey.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim().slice(0, 200) } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim().slice(0, 1000) ?? null } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
  });
}

/** Uloží nebo aktualizuje vlastníka pozemku */
export async function upsertFieldSurveyOwner(
  surveyPointId: string,
  data: {
    ownerName?: string;
    ownerType?: string;
    source?: string;
    note?: string;
    rawData?: unknown;
    verifiedByUserId?: string;
  }
) {
  const { organizationId } = requireTenantContext();
  const point = await prisma.fieldSurveyPoint.findFirst({ where: { id: surveyPointId, organizationId } });
  if (!point) throw new Error('Survey point not found or access denied.');

  const res = await prisma.fieldSurveyOwner.upsert({
    where: { surveyPointId },
    create: {
      organizationId,
      surveyPointId,
      ownerName: data.ownerName?.trim().slice(0, 255),
      ownerType: data.ownerType,
      source: data.source,
      note: data.note?.trim().slice(0, 1000),
      rawData: data.rawData ? (data.rawData as object) : undefined,
      verifiedAt: data.verifiedByUserId ? new Date() : undefined,
      verifiedByUserId: data.verifiedByUserId,
    },
    update: {
      ownerName: data.ownerName?.trim().slice(0, 255),
      ownerType: data.ownerType,
      source: data.source,
      note: data.note?.trim().slice(0, 1000),
      rawData: data.rawData ? (data.rawData as object) : undefined,
      verifiedAt: data.verifiedByUserId ? new Date() : undefined,
      verifiedByUserId: data.verifiedByUserId,
    },
  });

  if (data.ownerName) {
    await prisma.fieldSurveyPoint.update({
      where: { id: surveyPointId },
      data: { status: 'OWNER_FOUND' },
    });
  }

  return res;
}

/** Uloží nebo aktualizuje kontaktní údaje pro oslovení */
export async function upsertFieldSurveyContact(
  surveyPointId: string,
  data: {
    company?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    website?: string;
    note?: string;
    sourceType?: string;
    verificationStatus?: import('@prisma/client').FieldSurveyContactVerification;
  }
) {
  const { organizationId } = requireTenantContext();
  const point = await prisma.fieldSurveyPoint.findFirst({ where: { id: surveyPointId, organizationId } });
  if (!point) throw new Error('Survey point not found or access denied.');

  const res = await prisma.fieldSurveyContact.upsert({
    where: { surveyPointId },
    create: {
      organizationId,
      surveyPointId,
      company: data.company?.trim().slice(0, 255),
      contactPerson: data.contactPerson?.trim().slice(0, 255),
      phone: data.phone?.trim().slice(0, 50),
      email: data.email?.trim().slice(0, 100),
      website: data.website?.trim().slice(0, 255),
      note: data.note?.trim().slice(0, 1000),
      sourceType: data.sourceType ?? 'MANUAL',
      verificationStatus: data.verificationStatus ?? 'UNVERIFIED',
    },
    update: {
      company: data.company?.trim().slice(0, 255),
      contactPerson: data.contactPerson?.trim().slice(0, 255),
      phone: data.phone?.trim().slice(0, 50),
      email: data.email?.trim().slice(0, 100),
      website: data.website?.trim().slice(0, 255),
      note: data.note?.trim().slice(0, 1000),
      sourceType: data.sourceType,
      verificationStatus: data.verificationStatus,
    },
  });

  if (data.phone || data.email || data.company) {
    await prisma.fieldSurveyPoint.update({
      where: { id: surveyPointId },
      data: { status: 'CONTACT_FOUND' },
    });
  }

  return res;
}

/** Uloží AI analýzu průzkumného bodu */
export async function upsertFieldSurveyAiAnalysis(
  surveyPointId: string,
  data: {
    status: import('@prisma/client').FieldSurveyAiStatus;
    suggestedType?: string;
    isUsable?: boolean;
    locationDesc?: string;
    visibility?: string;
    orientation?: string;
    surroundings?: string;
    obstacles?: string;
    placementChar?: string;
    rawResponse?: unknown;
    errorMessage?: string;
    confirmedAt?: Date;
    confirmedByUserId?: string;
  }
) {
  const { organizationId } = requireTenantContext();
  const point = await prisma.fieldSurveyPoint.findFirst({ where: { id: surveyPointId, organizationId } });
  if (!point) throw new Error('Survey point not found or access denied.');

  return prisma.fieldSurveyAiAnalysis.upsert({
    where: { surveyPointId },
    create: {
      organizationId,
      surveyPointId,
      status: data.status,
      suggestedType: data.suggestedType,
      isUsable: data.isUsable,
      locationDesc: data.locationDesc,
      visibility: data.visibility,
      orientation: data.orientation,
      surroundings: data.surroundings,
      obstacles: data.obstacles,
      placementChar: data.placementChar,
      rawResponse: data.rawResponse ? (data.rawResponse as object) : undefined,
      errorMessage: data.errorMessage,
      confirmedAt: data.confirmedAt,
      confirmedByUserId: data.confirmedByUserId,
    },
    update: {
      status: data.status,
      suggestedType: data.suggestedType,
      isUsable: data.isUsable,
      locationDesc: data.locationDesc,
      visibility: data.visibility,
      orientation: data.orientation,
      surroundings: data.surroundings,
      obstacles: data.obstacles,
      placementChar: data.placementChar,
      rawResponse: data.rawResponse ? (data.rawResponse as object) : undefined,
      errorMessage: data.errorMessage,
      confirmedAt: data.confirmedAt,
      confirmedByUserId: data.confirmedByUserId,
    },
  });
}
