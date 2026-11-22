import { NextResponse } from 'next/server';
import { prisma, checkOccupancyConflicts, hasBlockingConflict, syncSurfaceOccupancyState } from '@/lib/db';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';

export async function POST(req: Request) {
  const user = await requireApiAccess('occupancy');
  if (isApiDenied(user)) return user;

  try {
    const body = await req.json();
    const { surfaceIds, clientId, clientName, campaignName, dateFrom, dateTo, status, price, note, reservedUntil } = body;

    if (!Array.isArray(surfaceIds) || surfaceIds.length === 0) {
      return NextResponse.json({ error: 'Vyberte alespoň jednu reklamní plochu.' }, { status: 400 });
    }

    if (!campaignName || !dateFrom || !dateTo) {
      return NextResponse.json({ error: 'Vyplňte název kampaně a termíny od-do.' }, { status: 400 });
    }

    const parsedFrom = new Date(dateFrom);
    const parsedTo = new Date(dateTo);
    if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedTo.getTime())) {
      return NextResponse.json({ error: 'Neplatný formát data od nebo do.' }, { status: 400 });
    }
    if (parsedFrom > parsedTo) {
      return NextResponse.json({ error: 'Datum od musí být před nebo rovno datu do.' }, { status: 400 });
    }

    const parsedReservedUntil =
      reservedUntil && !Number.isNaN(new Date(reservedUntil).getTime())
        ? new Date(reservedUntil)
        : null;

    const uniqueSurfaceIds = [...new Set(surfaceIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0))];

    // Check conflicts for all selected surface IDs
    const conflicts = await checkOccupancyConflicts(uniqueSurfaceIds, dateFrom, dateTo);
    if (hasBlockingConflict(conflicts)) {
      return NextResponse.json(
        {
          error: 'Některé z vybraných ploch jsou v daném termínu již obsazeny.',
          conflicts,
        },
        { status: 409 }
      );
    }

    const createdBy = user?.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user?.email || 'Obchodník';

    // Bulk create occupancy records and sync each surface state atomically
    const createdRecords = await prisma.$transaction(async (tx) => {
      const records = [];
      for (const surfaceId of uniqueSurfaceIds) {
        const rec = await tx.occupancy.create({
          data: {
            surfaceId,
            clientId: clientId || undefined,
            clientName: clientName || 'Neuvedený klient',
            campaignName,
            dateFrom: parsedFrom,
            dateTo: parsedTo,
            status: status || 'RESERVED',
            reservedUntil: (status || 'RESERVED') === 'RESERVED' ? parsedReservedUntil : null,
            price: price ? price / uniqueSurfaceIds.length : null,
            note: note || `Hromadná rezervace pro ${uniqueSurfaceIds.length} ploch`,
            createdBy,
            sourceSystem: 'EXCEL_MASS_BOOKING',
          },
        });
        await syncSurfaceOccupancyState(surfaceId, tx);
        records.push(rec);
      }
      return records;
    });

    return NextResponse.json({
      success: true,
      count: createdRecords.length,
      occupancies: createdRecords,
    });
  } catch (error) {
    console.error('Bulk occupancy booking error:', error);
    return NextResponse.json({ error: 'Hromadné uložení kampaně selhalo.' }, { status: 500 });
  }
}
