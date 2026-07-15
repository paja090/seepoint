import { prisma } from './db.ts';
import { selectRateAtDate } from './rate-selection.ts';
import { RateType, WorkType, RateSource, Prisma, CarrierType } from '@prisma/client';

export async function resolveWorkEntryRate(params: {
  employeeId: string;
  workType: WorkType;
  workDate: Date;
  remunerationMethod: RateType;
  workOrderId?: string | null;
  carrierType?: CarrierType | null;
}, tx?: Prisma.TransactionClient) {
  const { employeeId, workType, workDate, remunerationMethod, workOrderId, carrierType } = params;
  const client = tx || prisma;

  // 1. Employee-specific rate
  const employeeRates = await client.employeeRate.findMany({
    where: {
      employeeId,
      type: remunerationMethod,
      isActive: true,
      validFrom: { lte: workDate },
      OR: [
        { validTo: null },
        { validTo: { gte: workDate } }
      ]
    },
    orderBy: { validFrom: 'desc' }
  });

  // Filter with workType and carrierType priorities
  const resolvedEmployeeRate = selectRateAtDate(employeeRates, workType, carrierType || null, workDate);
  if (resolvedEmployeeRate) {
    return {
      amount: resolvedEmployeeRate.amount,
      unit: resolvedEmployeeRate.unit || 'ks',
      source: RateSource.EMPLOYEE_RATE,
      id: resolvedEmployeeRate.id
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
        OR: [
          { validTo: null },
          { validTo: { gte: workDate } }
        ]
      },
      orderBy: { validFrom: 'desc' }
    });

    const resolvedWorkOrderRate = selectRateAtDate(workOrderRates, workType, carrierType || null, workDate);
    if (resolvedWorkOrderRate) {
      return {
        amount: resolvedWorkOrderRate.amount,
        unit: resolvedWorkOrderRate.unit || 'ks',
        source: RateSource.WORK_ORDER_RATE,
        id: resolvedWorkOrderRate.id
      };
    }
  }

  // 3. Company-wide rate
  const companyRates = await client.companyRate.findMany({
    where: {
      type: remunerationMethod,
      isActive: true,
      validFrom: { lte: workDate },
      OR: [
        { validTo: null },
        { validTo: { gte: workDate } }
      ]
    },
    orderBy: { validFrom: 'desc' }
  });

  const resolvedCompanyRate = selectRateAtDate(companyRates, workType, carrierType || null, workDate);
  if (resolvedCompanyRate) {
    return {
      amount: resolvedCompanyRate.amount,
      unit: resolvedCompanyRate.unit || 'ks',
      source: RateSource.COMPANY_RATE,
      id: resolvedCompanyRate.id
    };
  }

  return null;
}
