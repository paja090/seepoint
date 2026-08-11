import { NextResponse } from 'next/server';
import { prisma, checkOccupancyConflicts, hasBlockingConflict } from '@/lib/db';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: Request) {
  const auth = await requireApiAccess('occupancy');
  if (isApiDenied(auth)) return auth;

  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { surfaceIds, clientId, clientName, campaignName, dateFrom, dateTo, status, price, note } = body;

    if (!Array.isArray(surfaceIds) || surfaceIds.length === 0) {
      return NextResponse.json({ error: 'Vyberte alespoň jednu reklamní plochu.' }, { status: 400 });
    }

    if (!campaignName || !dateFrom || !dateTo) {
      return NextResponse.json({ error: 'Vyplňte název kampaně a termíny od-do.' }, { status: 400 });
    }

    // Check conflicts for all selected surface IDs
    const conflicts = await checkOccupancyConflicts(surfaceIds, dateFrom, dateTo);
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

    // Bulk create occupancy records
    const createdRecords = await prisma.$transaction(
      surfaceIds.map((surfaceId) =>
        prisma.occupancy.create({
          data: {
            surfaceId,
            clientId: clientId || undefined,
            clientName: clientName || 'Neuvedený klient',
            campaignName,
            dateFrom: new Date(dateFrom),
            dateTo: new Date(dateTo),
            status: status || 'RESERVED',
            price: price ? price / surfaceIds.length : null,
            note: note || `Hromadná rezervace pro ${surfaceIds.length} ploch`,
            createdBy,
            sourceSystem: 'EXCEL_MASS_BOOKING',
          },
        })
      )
    );

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
