import { prisma } from './db.ts';
import { selectRateAtDate } from './rate-selection.ts';
import { RateType, WorkType, RateSource, Prisma, CarrierType } from '@prisma/client';

function matchRateByActivityTitle<
  T extends {
    name?: string | null;
    carrierTypeLabel?: string | null;
    validFrom: Date;
    validTo: Date | null;
  }
>(rates: T[], activityTitle: string | null | undefined, workDate: Date): T | null {
  const normalized = activityTitle?.trim().toLowerCase();
  if (!normalized) return null;

  const valid = rates.filter(
    (r) => r.validFrom <= workDate && (!r.validTo || r.validTo >= workDate)
  );

  const exactMatch = valid.find(
    (r) =>
      r.name?.trim().toLowerCase() === normalized ||
      r.carrierTypeLabel?.trim().toLowerCase() === normalized
  );
  if (exactMatch) return exactMatch;

  return null;
}

export async function resolveWorkEntryRate(
  params: {
    employeeId: string;
    workType: WorkType;
    workDate: Date;
    remunerationMethod: RateType;
    workOrderId?: string | null;
    carrierType?: CarrierType | null;
    carrierTypeId?: string | null;
    activityTitle?: string | null;
  },
  tx?: Prisma.TransactionClient
) {
  const {
    employeeId,
    workType,
    workDate,
    remunerationMethod,
    workOrderId,
    carrierType,
    carrierTypeId,
    activityTitle,
  } = params;
  const client = tx || prisma;

  let effectiveCarrierType = carrierType;
  if (!effectiveCarrierType && carrierTypeId) {
    const oct = await client.organizationCarrierType.findUnique({
      where: { id: carrierTypeId },
      select: { legacyEnumValue: true },
    });
    if (
      oct?.legacyEnumValue &&
      Object.values(CarrierType).includes(oct.legacyEnumValue as CarrierType)
    ) {
      effectiveCarrierType = oct.legacyEnumValue as CarrierType;
    }
  }

  // 1. Employee-specific rate
  const employeeRates = await client.employeeRate.findMany({
    where: {
      employeeId,
      type: remunerationMethod,
      isActive: true,
      validFrom: { lte: workDate },
      OR: [{ validTo: null }, { validTo: { gte: workDate } }],
    },
    orderBy: { validFrom: 'desc' },
  });

  // 1a. Exact match by activityTitle / name on EmployeeRate
  const byTitleEmployeeRate = matchRateByActivityTitle(employeeRates, activityTitle, workDate);
  if (byTitleEmployeeRate) {
    return {
      amount: byTitleEmployeeRate.amount,
      unit: byTitleEmployeeRate.unit || (remunerationMethod === 'HOURLY' ? 'hod' : 'ks'),
      source: RateSource.EMPLOYEE_RATE,
      id: byTitleEmployeeRate.id,
      name: byTitleEmployeeRate.name,
    };
  }

  // 1b. Filter with workType and carrierType priorities
  const resolvedEmployeeRate = selectRateAtDate(
    employeeRates,
    workType,
    effectiveCarrierType || null,
    workDate
  );
  if (resolvedEmployeeRate) {
    return {
      amount: resolvedEmployeeRate.amount,
      unit: resolvedEmployeeRate.unit || (remunerationMethod === 'HOURLY' ? 'hod' : 'ks'),
      source: RateSource.EMPLOYEE_RATE,
      id: resolvedEmployeeRate.id,
      name: resolvedEmployeeRate.name,
    };
  }

  // 2. WorkOrder/job-specific worker rate
  if (workOrderId) {
    const workOrderRates = await client.workOrderRate.findMany({
      where: {
        workOrderId,
        type: remunerationMethod,
        isActive: true,
        validFrom: { lte: workDate },
        OR: [{ validTo: null }, { validTo: { gte: workDate } }],
      },
      orderBy: { validFrom: 'desc' },
    });

    const byTitleOrderRate = matchRateByActivityTitle(workOrderRates, activityTitle, workDate);
    if (byTitleOrderRate) {
      return {
        amount: byTitleOrderRate.amount,
        unit: byTitleOrderRate.unit || (remunerationMethod === 'HOURLY' ? 'hod' : 'ks'),
        source: RateSource.WORK_ORDER_RATE,
        id: byTitleOrderRate.id,
        name: byTitleOrderRate.name,
      };
    }

    const resolvedWorkOrderRate = selectRateAtDate(
      workOrderRates,
      workType,
      effectiveCarrierType || null,
      workDate
    );
    if (resolvedWorkOrderRate) {
      return {
        amount: resolvedWorkOrderRate.amount,
        unit: resolvedWorkOrderRate.unit || (remunerationMethod === 'HOURLY' ? 'hod' : 'ks'),
        source: RateSource.WORK_ORDER_RATE,
        id: resolvedWorkOrderRate.id,
        name: resolvedWorkOrderRate.name,
      };
    }
  }

  // 3. Company-wide rate
  const companyRates = await client.companyRate.findMany({
    where: {
      type: remunerationMethod,
      isActive: true,
      validFrom: { lte: workDate },
      OR: [{ validTo: null }, { validTo: { gte: workDate } }],
    },
    orderBy: { validFrom: 'desc' },
  });

  // 3a. Exact match by activityTitle / name on CompanyRate
  const byTitleCompanyRate = matchRateByActivityTitle(companyRates, activityTitle, workDate);
  if (byTitleCompanyRate) {
    return {
      amount: byTitleCompanyRate.amount,
      unit: byTitleCompanyRate.unit || (remunerationMethod === 'HOURLY' ? 'hod' : 'ks'),
      source: RateSource.COMPANY_RATE,
      id: byTitleCompanyRate.id,
      name: byTitleCompanyRate.name,
    };
  }

  const resolvedCompanyRate = selectRateAtDate(
    companyRates,
    workType,
    effectiveCarrierType || null,
    workDate
  );
  if (resolvedCompanyRate) {
    return {
      amount: resolvedCompanyRate.amount,
      unit: resolvedCompanyRate.unit || (remunerationMethod === 'HOURLY' ? 'hod' : 'ks'),
      source: RateSource.COMPANY_RATE,
      id: resolvedCompanyRate.id,
      name: resolvedCompanyRate.name,
    };
  }

  return null;
}
