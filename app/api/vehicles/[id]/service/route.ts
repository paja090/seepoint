import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureVehicleSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  await ensureVehicleSchema();
  const { id } = await params;

  try {
    const body = await request.json();
    const { title, description, cost, mileage, date, nextServiceDate } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Zadejte název úkonu / servisu.' }, { status: 400 });
    }

    const serviceRecord = await prisma.vehicleServiceRecord.create({
      data: {
        vehicleId: id,
        title: title.trim(),
        description: description ? String(description).trim() : null,
        cost: cost !== undefined && cost !== null && cost !== '' ? Number(cost) : null,
        mileage: mileage !== undefined && mileage !== null && mileage !== '' ? parseInt(String(mileage), 10) : null,
        date: date ? new Date(date) : new Date(),
        nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
      },
    });

    return NextResponse.json(serviceRecord);
  } catch (error) {
    console.error('Service record creation error:', error);
    return NextResponse.json({ error: 'Uložení servisního záznamu selhalo.' }, { status: 500 });
  }
}
