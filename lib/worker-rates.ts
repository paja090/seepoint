import { Prisma, RateType, WorkType, CarrierType } from '@prisma/client';
import { prisma } from './db';
import { intervalsOverlap } from './rate-intervals';
import { selectRateAtDate } from './rate-selection';

export function parseRateInput(input: Record<string, unknown>) {
  const type = typeof input.type === 'string' && Object.values(RateType).includes(input.type as RateType) ? input.type as RateType : null;
  const workType = typeof input.workType === 'string' && input.workType && Object.values(WorkType).includes(input.workType as WorkType) ? input.workType as WorkType : null;
  const carrierType = typeof input.carrierType === 'string' && input.carrierType && Object.values(CarrierType).includes(input.carrierType as CarrierType) ? input.carrierType as CarrierType : null;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const amountText = typeof input.amount === 'string' || typeof input.amount === 'number' ? String(input.amount).replace(',', '.') : '';
  const validFrom = new Date(String(input.validFrom ?? ''));
  const validTo = input.validTo ? new Date(String(input.validTo)) : null;
  if (!type || !name) throw new Error('Vyplňte název a platný typ sazby.');
  if (!/^\d+(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0) throw new Error('Částka musí být kladné číslo s nejvýše dvěma desetinnými místy.');
  if (Number.isNaN(validFrom.getTime()) || (validTo && Number.isNaN(validTo.getTime()))) throw new Error('Zadejte platné datum účinnosti.');
  if (validTo && validTo < validFrom) throw new Error('Platnost do nesmí být před platností od.');
  const currency = typeof input.currency === 'string' ? input.currency.trim().toUpperCase() : 'CZK';
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Měna musí být třípísmenný ISO kód.');
  return { type, workType, carrierType, name, amount: new Prisma.Decimal(amountText), currency, validFrom, validTo,
    unit: typeof input.unit === 'string' ? input.unit.trim() || null : null,
    note: typeof input.note === 'string' ? input.note.trim() || null : null };
}

export async function resolveWorkerRate(workerId: string, workType: WorkType | null, date: Date) {
  const rates = await prisma.employeeRate.findMany({ where: { employeeId: workerId,
    ...(workType ? { OR: [{ workType }, { workType: null }] } : { workType: null }),
    validFrom: { lte: date }, AND: [{ OR: [{ validTo: null }, { validTo: { gte: date } }] }] }, orderBy: { validFrom: 'desc' } });
  const rate = selectRateAtDate(rates, workType, date);
  return rate ? { rate, source: 'INDIVIDUAL' as const } : null;
}

export async function assertNoRateConflict(tx: Prisma.TransactionClient, employeeId: string, candidate: { type: RateType; name: string; workType: WorkType | null; carrierType: CarrierType | null; validFrom: Date; validTo: Date | null }, excludeId?: string) {
  const conflicts = await tx.employeeRate.findMany({ where: { employeeId, type: candidate.type, workType: candidate.workType, carrierType: candidate.carrierType,
    ...(candidate.type === 'HOURLY' ? {} : { name: { equals: candidate.name, mode: 'insensitive' } }),
    ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { validFrom: true, validTo: true } });
  if (conflicts.some((rate) => intervalsOverlap(rate, candidate))) throw new Error('RATE_CONFLICT');
}
