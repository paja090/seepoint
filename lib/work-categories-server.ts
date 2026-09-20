import { prisma } from './db';
import {
  DEFAULT_WORK_CATEGORIES,
  WORK_CATEGORY_PRESETS,
  sanitizeWorkCategories,
  type WorkCategory,
} from './work-categories';

export async function getOrganizationWorkCategories(organizationId: string): Promise<WorkCategory[]> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plannerDefaults: true },
    });

    const defaults = org?.plannerDefaults as Record<string, unknown> | null;
    if (defaults && Array.isArray(defaults.workCategories) && defaults.workCategories.length > 0) {
      return sanitizeWorkCategories(defaults.workCategories);
    }
  } catch (error) {
    console.error('[getOrganizationWorkCategories] Failed to load custom categories', error);
  }

  return DEFAULT_WORK_CATEGORIES;
}

export async function saveOrganizationWorkCategories(
  organizationId: string,
  categories: WorkCategory[]
): Promise<WorkCategory[]> {
  const sanitized = sanitizeWorkCategories(categories);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plannerDefaults: true },
  });

  const existingDefaults = (org?.plannerDefaults as Record<string, unknown> | null) || {};
  const updatedDefaults = {
    ...existingDefaults,
    workCategories: sanitized,
    workCategoriesUpdatedAt: new Date().toISOString(),
  };

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      plannerDefaults: updatedDefaults,
    },
  });

  return sanitized;
}

export async function applyOrganizationWorkCategoryPreset(
  organizationId: string,
  presetKey: string
): Promise<WorkCategory[]> {
  const preset = WORK_CATEGORY_PRESETS[presetKey] || WORK_CATEGORY_PRESETS.AGENCY;
  return saveOrganizationWorkCategories(organizationId, preset.categories);
}
