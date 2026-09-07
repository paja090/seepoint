import { prisma } from '@/lib/db';
import type { ColumnMappingProposal, SheetClassificationType } from './types';

export type SavedProfileData = {
  id: string;
  name: string;
  fingerprint: string | null;
  sheetAliases?: Record<string, SheetClassificationType>;
  columnMappings: Record<string, ColumnMappingProposal[]>;
  mediaTypeAliases?: Record<string, string>;
  isDefault: boolean;
};

export type SchemaDriftResult = {
  hasDrift: boolean;
  profileId?: string;
  profileName?: string;
  addedColumns: string[];
  removedColumns: string[];
};

export async function findProfileByFingerprint(
  organizationId: string,
  fingerprint: string
): Promise<SavedProfileData | null> {
  const profile = await prisma.importProfile.findFirst({
    where: {
      organizationId,
      fingerprint,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    name: profile.name,
    fingerprint: profile.fingerprint,
    sheetAliases: profile.sheetAliases as Record<string, SheetClassificationType> | undefined,
    columnMappings: profile.columnMappings as Record<string, ColumnMappingProposal[]>,
    mediaTypeAliases: profile.mediaTypeAliases as Record<string, string> | undefined,
    isDefault: profile.isDefault,
  };
}

export async function checkSchemaDrift(
  organizationId: string,
  currentSheetName: string,
  currentHeaders: string[]
): Promise<SchemaDriftResult> {
  const profiles = await prisma.importProfile.findMany({
    where: { organizationId },
    orderBy: { lastUsedAt: 'desc' },
    take: 5,
  });

  if (profiles.length === 0) {
    return { hasDrift: false, addedColumns: [], removedColumns: [] };
  }

  for (const profile of profiles) {
    const mappings = (profile.columnMappings || {}) as Record<string, ColumnMappingProposal[]>;
    const savedSheetMappings = mappings[currentSheetName];

    if (savedSheetMappings && savedSheetMappings.length > 0) {
      const savedHeaders = savedSheetMappings.map((m) => m.sourceColumn);
      const added = currentHeaders.filter((h) => !savedHeaders.includes(h));
      const removed = savedHeaders.filter((h) => !currentHeaders.includes(h));

      if (added.length > 0 || removed.length > 0) {
        return {
          hasDrift: true,
          profileId: profile.id,
          profileName: profile.name,
          addedColumns: added,
          removedColumns: removed,
        };
      }
    }
  }

  return { hasDrift: false, addedColumns: [], removedColumns: [] };
}

export async function saveOrUpdateProfile(
  organizationId: string,
  data: {
    profileName: string;
    fingerprint: string;
    sheetAliases: Record<string, SheetClassificationType>;
    columnMappings: Record<string, ColumnMappingProposal[]>;
    mediaTypeAliases?: Record<string, string>;
  }
) {
  const existing = await prisma.importProfile.findFirst({
    where: {
      organizationId,
      name: data.profileName,
    },
  });

  if (existing) {
    return prisma.importProfile.update({
      where: { id: existing.id },
      data: {
        fingerprint: data.fingerprint,
        sheetAliases: data.sheetAliases,
        columnMappings: data.columnMappings as any,
        mediaTypeAliases: data.mediaTypeAliases || {},
        lastUsedAt: new Date(),
      },
    });
  }

  return prisma.importProfile.create({
    data: {
      organizationId,
      name: data.profileName,
      fingerprint: data.fingerprint,
      sheetAliases: data.sheetAliases,
      columnMappings: data.columnMappings as any,
      mediaTypeAliases: data.mediaTypeAliases || {},
      lastUsedAt: new Date(),
      isDefault: true,
    },
  });
}
