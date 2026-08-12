import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ carriers: [], clients: [], employees: [], vehicles: [] });
  }

  const [carriers, clients, employees, vehicles] = await Promise.all([
    // Carriers search (AdvertisingCarrier)
    prisma.advertisingCarrier.findMany({
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
    }),

    // CRM Clients search (Client)
    prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { contactPerson: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        contactPerson: true,
        email: true,
        phone: true,
      },
      take: 5,
    }),

    // Employees search (Employee)
    prisma.employee.findMany({
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
    }),

    // Vehicles search (Vehicle)
    prisma.vehicle.findMany({
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
    }),
  ]);

  return NextResponse.json({
    carriers,
    clients,
    employees,
    vehicles,
  });
}
