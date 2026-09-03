import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CurrentUser } from '@/lib/rbac';
import {
  NavigationContractValidationError,
  type NavigationContactFormInput,
  type NavigationContractFormInput,
} from '@/lib/navigation/contract-policy';

type ContractFilters = { clientId?: string; status?: string; query?: string; take?: number; skip?: number };
type ContactFilters = { clientId?: string; query?: string; take?: number; skip?: number };

const contractInclude = {
  client: { select: { id: true, name: true } },
  offer: { select: { id: true, title: true } },
  navigationOrder: { select: { id: true, targetName: true } },
  surfaces: { select: { id: true, name: true, sidePosition: true } },
} satisfies Prisma.NavigationContractInclude;

function organizationIdFor(user: CurrentUser) {
  if (!user.organizationId) throw new NavigationContractValidationError('Uživatel nemá přiřazenou organizaci.', 403);
  return user.organizationId;
}

async function validateContractLinks(tx: Prisma.TransactionClient, organizationId: string, data: NavigationContractFormInput) {
  const client = await tx.client.findFirst({
    where: { id: data.clientId, organizationId, active: true },
    select: { id: true },
  });
  if (!client) throw new NavigationContractValidationError('Vybraný klient nebyl nalezen nebo není aktivní.', 404);

  if (data.offerId) {
    const offer = await tx.offer.findFirst({ where: { id: data.offerId, organizationId }, select: { clientId: true } });
    if (!offer) throw new NavigationContractValidationError('Vybraná nabídka nebyla nalezena.', 404);
    if (offer.clientId !== data.clientId) throw new NavigationContractValidationError('Nabídka nepatří vybranému klientovi.', 409);
  }
  if (data.navigationOrderId) {
    const order = await tx.navigationOrder.findFirst({
      where: { id: data.navigationOrderId, organizationId },
      select: { crmOrder: { select: { clientId: true } } },
    });
    if (!order) throw new NavigationContractValidationError('Vybraná navigační zakázka nebyla nalezena.', 404);
    if (order.crmOrder.clientId !== data.clientId) throw new NavigationContractValidationError('Navigační zakázka nepatří vybranému klientovi.', 409);
  }
}

function contractData(data: NavigationContractFormInput) {
  return {
    contractNumber: data.contractNumber,
    contractType: data.contractType,
    clientId: data.clientId,
    agencyName: data.agencyName,
    responsiblePerson: data.responsiblePerson,
    phone: data.phone,
    email: data.email,
    offerId: data.offerId,
    navigationOrderId: data.navigationOrderId,
    startDate: new Date(`${data.startDate}T00:00:00.000Z`),
    endDate: new Date(`${data.endDate}T00:00:00.000Z`),
    monthlyPrice: data.monthlyPrice,
    totalPrice: data.totalPrice,
    status: data.status,
    autoRenews: data.autoRenews,
    alertDaysBefore: data.alertDaysBefore,
    note: data.note,
  };
}

function contactData(data: NavigationContactFormInput) {
  return {
    clientId: data.clientId,
    contactType: data.contactType,
    name: data.name,
    agencyName: data.agencyName,
    role: data.role,
    phone: data.phone,
    email: data.email,
    isPrimary: data.isPrimary,
    note: data.note,
  };
}

export async function listNavigationContracts(user: CurrentUser, filters: ContractFilters = {}) {
  const organizationId = organizationIdFor(user);
  const where: Prisma.NavigationContractWhereInput = { organizationId };
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.status) where.status = filters.status;
  if (filters.query) where.OR = [
    { contractNumber: { contains: filters.query, mode: 'insensitive' } },
    { responsiblePerson: { contains: filters.query, mode: 'insensitive' } },
    { agencyName: { contains: filters.query, mode: 'insensitive' } },
    { client: { name: { contains: filters.query, mode: 'insensitive' } } },
  ];

  const [items, total] = await Promise.all([
    prisma.navigationContract.findMany({
      where,
      include: contractInclude,
      orderBy: [{ endDate: 'asc' }, { contractNumber: 'asc' }],
      take: filters.take ?? 100,
      skip: filters.skip ?? 0,
    }),
    prisma.navigationContract.count({ where }),
  ]);
  return { items, total };
}

export async function createNavigationContract(user: CurrentUser, data: NavigationContractFormInput) {
  const organizationId = organizationIdFor(user);
  return prisma.$transaction(async (tx) => {
    await validateContractLinks(tx, organizationId, data);
    const contract = await tx.navigationContract.create({ data: { organizationId, ...contractData(data) }, include: contractInclude });
    await tx.crmAuditLog.create({ data: {
      organizationId, userId: user.id, userEmail: user.email,
      action: 'CREATE_NAVIGATION_CONTRACT', entityType: 'NavigationContract', entityId: contract.id,
      detailsJson: JSON.stringify({ contractNumber: contract.contractNumber, clientId: contract.clientId }),
    } });
    return contract;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateNavigationContract(user: CurrentUser, contractId: string, data: NavigationContractFormInput) {
  const organizationId = organizationIdFor(user);
  return prisma.$transaction(async (tx) => {
    const previous = await tx.navigationContract.findFirst({
      where: { id: contractId, organizationId },
      select: { id: true, contractNumber: true, clientId: true, status: true },
    });
    if (!previous) throw new NavigationContractValidationError('Smlouva nebyla nalezena.', 404);
    await validateContractLinks(tx, organizationId, data);
    const changed = await tx.navigationContract.updateMany({ where: { id: contractId, organizationId }, data: contractData(data) });
    if (changed.count !== 1) throw new NavigationContractValidationError('Smlouvu se nepodařilo bezpečně změnit.', 409);
    const contract = await tx.navigationContract.findFirstOrThrow({ where: { id: contractId, organizationId }, include: contractInclude });
    await tx.crmAuditLog.create({ data: {
      organizationId, userId: user.id, userEmail: user.email,
      action: 'UPDATE_NAVIGATION_CONTRACT', entityType: 'NavigationContract', entityId: contract.id,
      detailsJson: JSON.stringify({ before: previous, after: { contractNumber: contract.contractNumber, clientId: contract.clientId, status: contract.status } }),
    } });
    return contract;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listNavigationContactPersons(user: CurrentUser, filters: ContactFilters = {}) {
  const organizationId = organizationIdFor(user);
  const where: Prisma.NavigationContactPersonWhereInput = { organizationId };
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.query) where.OR = [
    { name: { contains: filters.query, mode: 'insensitive' } },
    { agencyName: { contains: filters.query, mode: 'insensitive' } },
    { role: { contains: filters.query, mode: 'insensitive' } },
    { email: { contains: filters.query, mode: 'insensitive' } },
    { client: { name: { contains: filters.query, mode: 'insensitive' } } },
  ];
  const [items, total] = await Promise.all([
    prisma.navigationContactPerson.findMany({
      where,
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      take: filters.take ?? 100,
      skip: filters.skip ?? 0,
    }),
    prisma.navigationContactPerson.count({ where }),
  ]);
  return { items, total };
}

async function saveNavigationContactPerson(user: CurrentUser, data: NavigationContactFormInput, contactId?: string) {
  const organizationId = organizationIdFor(user);
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({ where: { id: data.clientId, organizationId, active: true }, select: { id: true } });
    if (!client) throw new NavigationContractValidationError('Vybraný klient nebyl nalezen nebo není aktivní.', 404);

    const previous = contactId ? await tx.navigationContactPerson.findFirst({
      where: { id: contactId, organizationId },
      select: { id: true, clientId: true, name: true, isPrimary: true },
    }) : null;
    if (contactId && !previous) throw new NavigationContractValidationError('Kontaktní osoba nebyla nalezena.', 404);

    if (data.isPrimary) await tx.navigationContactPerson.updateMany({
      where: { organizationId, clientId: data.clientId, isPrimary: true, ...(contactId ? { id: { not: contactId } } : {}) },
      data: { isPrimary: false },
    });

    let contact;
    if (contactId) {
      const changed = await tx.navigationContactPerson.updateMany({ where: { id: contactId, organizationId }, data: contactData(data) });
      if (changed.count !== 1) throw new NavigationContractValidationError('Kontakt se nepodařilo bezpečně změnit.', 409);
      contact = await tx.navigationContactPerson.findFirstOrThrow({
        where: { id: contactId, organizationId },
        include: { client: { select: { id: true, name: true } } },
      });
    } else {
      contact = await tx.navigationContactPerson.create({
        data: { organizationId, ...contactData(data) },
        include: { client: { select: { id: true, name: true } } },
      });
    }
    await tx.crmAuditLog.create({ data: {
      organizationId, userId: user.id, userEmail: user.email,
      action: contactId ? 'UPDATE_NAVIGATION_CONTACT' : 'CREATE_NAVIGATION_CONTACT',
      entityType: 'NavigationContactPerson', entityId: contact.id,
      detailsJson: JSON.stringify({ before: previous, after: { clientId: contact.clientId, name: contact.name, isPrimary: contact.isPrimary } }),
    } });
    return contact;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function createNavigationContactPerson(user: CurrentUser, data: NavigationContactFormInput) {
  return saveNavigationContactPerson(user, data);
}

export function updateNavigationContactPerson(user: CurrentUser, contactId: string, data: NavigationContactFormInput) {
  return saveNavigationContactPerson(user, data, contactId);
}
