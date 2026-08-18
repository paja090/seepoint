import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureVehicleSchema } from '@/lib/db';
import { VehicleType, VehicleStatus } from '@prisma/client';

export const runtime = 'nodejs';

export async function PUT(
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
    const {
      name,
      registrationNumber,
      vin,
      type,
      status,
      technicalInspectionUntil,
      insuranceUntil,
      highwayPassUntil,
      responsiblePerson,
      tiresInfo,
      owner,
      vtpUrl,
      repairNotes,
      note,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Zadejte platný název vozidla.' }, { status: 400 });
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        name: name.trim(),
        registrationNumber: registrationNumber ? String(registrationNumber).trim() : null,
        vin: vin ? String(vin).trim() : null,
        type: (type as VehicleType) || 'CAR',
        status: (status as VehicleStatus) || 'AVAILABLE',
        technicalInspectionUntil: technicalInspectionUntil ? new Date(technicalInspectionUntil) : null,
        insuranceUntil: insuranceUntil ? new Date(insuranceUntil) : null,
        highwayPassUntil: highwayPassUntil ? new Date(highwayPassUntil) : null,
        responsiblePerson: responsiblePerson ? String(responsiblePerson).trim() : null,
        tiresInfo: tiresInfo ? String(tiresInfo).trim() : null,
        owner: owner ? String(owner).trim() : null,
        vtpUrl: vtpUrl ? String(vtpUrl).trim() : null,
        repairNotes: repairNotes ? String(repairNotes).trim() : null,
        note: note ? String(note).trim() : null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Vehicle update error:', error);
    return NextResponse.json({ error: 'Úprava vozidla selhala.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Pouze administrátor může smazat vozidlo.' }, { status: 403 });
  }

  const { id } = await params;
  try {
    await prisma.vehicle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Smazání vozidla selhalo.' }, { status: 500 });
  }
}
