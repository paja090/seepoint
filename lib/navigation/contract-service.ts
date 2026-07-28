import { prisma } from '@/lib/db';
import type { CurrentUser } from '@/lib/rbac';

export type ContractInput = {
  contractNumber: string;
  contractType: string; // RENTAL, PRODUCTION, SERVICE, MASTER
  clientId: string;
  agencyName?: string | null;
  responsiblePerson?: string | null;
  phone?: string | null;
  email?: string | null;
  offerId?: string | null;
  navigationOrderId?: string | null;
  startDate: string;
  endDate: string;
  monthlyPrice?: number | null;
  totalPrice?: number | null;
  status?: string; // DRAFT, ACTIVE, EXPIRING, EXPIRED, TERMINATED
  autoRenews?: boolean;
  alertDaysBefore?: number;
  note?: string | null;
};

export async function listNavigationContracts(
  _user: CurrentUser,
  filters?: { clientId?: string; status?: string; query?: string }
) {
  const where: any = {};
  if (filters?.clientId) where.clientId = filters.clientId;
  if (filters?.status) where.status = filters.status;
  if (filters?.query) {
    where.OR = [
      { contractNumber: { contains: filters.query, mode: 'insensitive' } },
      { responsiblePerson: { contains: filters.query, mode: 'insensitive' } },
      { agencyName: { contains: filters.query, mode: 'insensitive' } },
      { client: { name: { contains: filters.query, mode: 'insensitive' } } },
    ];
  }

  return prisma.navigationContract.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      offer: { select: { id: true, title: true } },
      navigationOrder: { select: { id: true, targetName: true } },
      surfaces: { select: { id: true, name: true, sidePosition: true } },
    },
    orderBy: { endDate: 'asc' },
  });
}

export async function createNavigationContract(_user: CurrentUser, data: ContractInput) {
  return prisma.navigationContract.create({
    data: {
      contractNumber: data.contractNumber,
      contractType: data.contractType || 'RENTAL',
      clientId: data.clientId,
      agencyName: data.agencyName || null,
      responsiblePerson: data.responsiblePerson || null,
      phone: data.phone || null,
      email: data.email || null,
      offerId: data.offerId || null,
      navigationOrderId: data.navigationOrderId || null,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      monthlyPrice: data.monthlyPrice !== undefined && data.monthlyPrice !== null ? data.monthlyPrice : null,
      totalPrice: data.totalPrice !== undefined && data.totalPrice !== null ? data.totalPrice : null,
      status: data.status || 'ACTIVE',
      autoRenews: Boolean(data.autoRenews),
      alertDaysBefore: data.alertDaysBefore || 30,
      note: data.note || null,
    },
  });
}

export async function listNavigationContactPersons(clientId: string) {
  return prisma.navigationContactPerson.findMany({
    where: { clientId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createNavigationContactPerson(data: {
  clientId: string;
  contactType?: string;
  name: string;
  agencyName?: string;
  role?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
  note?: string;
}) {
  return prisma.navigationContactPerson.create({
    data: {
      clientId: data.clientId,
      contactType: data.contactType || 'CLIENT',
      name: data.name,
      agencyName: data.agencyName || null,
      role: data.role || null,
      phone: data.phone || null,
      email: data.email || null,
      isPrimary: Boolean(data.isPrimary),
      note: data.note || null,
    },
  });
}
