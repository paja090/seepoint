import { getCurrentUser } from '@/lib/auth';
import { hasModuleAccess } from '@/lib/module-policy';
import { prisma } from '@/lib/db';
import {
  buildClientBranchSearchWhere,
  buildClientSearchWhere,
  buildCrmOrderSearchWhere,
} from '@/lib/crm/search-query';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ carriers: [], clients: [], branches: [], orders: [], employees: [], vehicles: [] });
  }

  const hasCrm = hasModuleAccess(user, 'crm');

  const [carriers, clients, branches, orders, employees, vehicles] = await Promise.all([
    // Carriers search (AdvertisingCarrier)
    hasModuleAccess(user, 'carriers') ? prisma.advertisingCarrier.findMany({
      where: {
        archivedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        address: true,
        status: true,
      },
      take: 6,
    }) : [],

    // CRM Clients & Agencies search (Client)
    hasCrm ? prisma.client.findMany({
      where: {
        active: true,
        ...buildClientSearchWhere(q),
      },
      select: {
        id: true,
        name: true,
        clientType: true,
        contactPerson: true,
        email: true,
        phone: true,
        billingCity: true,
      },
      take: 5,
    }) : [],

    // Client Branches search (ClientBranch)
    hasCrm ? prisma.clientBranch.findMany({
      where: buildClientBranchSearchWhere(q),
      select: {
        id: true,
        clientId: true,
        name: true,
        code: true,
        city: true,
        street: true,
        client: { select: { id: true, name: true } },
      },
      take: 5,
    }) : [],

    // CRM Orders search (by client, agency, branch, orderNumber, title)
    hasCrm ? prisma.crmOrder.findMany({
      where: buildCrmOrderSearchWhere(q),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        status: true,
        clientId: true,
        agencyName: true,
        client: { select: { id: true, name: true } },
        agencyClient: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, city: true } },
      },
      take: 6,
    }) : [],

    // Employees search (Employee)
    hasModuleAccess(user, 'employees') ? prisma.employee.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { position: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        phone: true,
      },
      take: 5,
    }) : [],

    // Vehicles search (Vehicle)
    hasModuleAccess(user, 'vehicles') ? prisma.vehicle.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { registrationNumber: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        registrationNumber: true,
        status: true,
      },
      take: 4,
    }) : [],
  ]);

  return NextResponse.json({
    carriers,
    clients,
    branches,
    orders,
    employees,
    vehicles,
  });
}
