import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('team');
  if (isApiDenied(auth)) return auth;

  try {
    const [employees, orders] = await Promise.all([
      prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: 500,
      }),
      prisma.crmOrder.findMany({
        where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: { id: true, title: true, orderNumber: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    return NextResponse.json({ employees, orders });
  } catch (error) {
    console.error('Failed to load shopping form options:', error);
    return NextResponse.json(
      { error: 'Zaměstnance a zakázky se nepodařilo načíst.' },
      { status: 500 }
    );
  }
}
