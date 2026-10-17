import { Prisma, RateType, WorkType } from '@prisma/client';
import { prisma } from './db';
import {
  DEFAULT_WORK_CATEGORIES,
  WORK_CATEGORY_PRESETS,
  sanitizeWorkCategories,
  type WorkCategory,
} from './work-categories';

export async function getOrganizationWorkCategories(organizationId: string): Promise<WorkCategory[]> {
  try {
    const [org, companyRates] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { plannerDefaults: true },
      }),
      prisma.companyRate.findMany({
        where: { isActive: true },
        orderBy: { validFrom: 'desc' },
      }),
    ]);

    const defaults = org?.plannerDefaults as Record<string, unknown> | null;
    const baseCategories =
      defaults && Array.isArray(defaults.workCategories) && defaults.workCategories.length > 0
        ? sanitizeWorkCategories(defaults.workCategories)
        : DEFAULT_WORK_CATEGORIES;

    // Enrich categories with active CompanyRate amounts if matched by name
    return baseCategories.map((cat) => {
      const matchedRate = companyRates.find(
        (r) =>
          r.name.trim().toLowerCase() === cat.label.trim().toLowerCase() ||
          r.carrierTypeLabel?.trim().toLowerCase() === cat.label.trim().toLowerCase()
      );
      if (matchedRate) {
        const mappedPriceType: WorkCategory['defaultPriceType'] =
          matchedRate.type === 'TASK'
            ? 'PIECE_RATE'
            : matchedRate.type === 'FIXED'
            ? 'FIXED'
            : 'HOURLY';
        return {
          ...cat,
          defaultPriceType: mappedPriceType,
          defaultRate: Number(matchedRate.amount),
        };
      }
      return cat;
    });
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

  // Sync any category with defaultRate > 0 into CompanyRate so the price catalog stays in sync
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const cat of sanitized) {
    if (cat.defaultRate !== undefined && cat.defaultRate > 0) {
      const rateType: RateType =
        cat.defaultPriceType === 'PIECE_RATE'
          ? 'TASK'
          : cat.defaultPriceType === 'FIXED'
          ? 'FIXED'
          : 'HOURLY';
      const unit =
        rateType === 'HOURLY' ? 'hod' : rateType === 'FIXED' ? 'zakázka' : 'ks';
      const workType = (cat.defaultWorkType as WorkType) || 'INSTALLATION';

      const existingRate = await prisma.companyRate.findFirst({
        where: {
          name: { equals: cat.label, mode: 'insensitive' },
          isActive: true,
        },
        orderBy: { validFrom: 'desc' },
      });

      if (existingRate) {
        await prisma.companyRate.update({
          where: { id: existingRate.id },
          data: {
            type: rateType,
            amount: new Prisma.Decimal(cat.defaultRate),
            unit,
            workType,
            carrierTypeLabel: cat.label,
          },
        });
      } else {
        await prisma.companyRate.create({
          data: {
            type: rateType,
            name: cat.label,
            carrierTypeLabel: cat.label,
            amount: new Prisma.Decimal(cat.defaultRate),
            currency: 'CZK',
            unit,
            workType,
            validFrom: today,
            isActive: true,
          },
        });
      }
    }
  }

  return sanitized;
}

export async function applyOrganizationWorkCategoryPreset(
  organizationId: string,
  presetKey: string
): Promise<WorkCategory[]> {
  const preset = WORK_CATEGORY_PRESETS[presetKey] || WORK_CATEGORY_PRESETS.AGENCY;
  return saveOrganizationWorkCategories(organizationId, preset.categories);
}
