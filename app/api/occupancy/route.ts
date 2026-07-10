import { NextResponse } from 'next/server';
import { checkOccupancyConflicts, hasBlockingConflict, updateOccupancyAction, upsertOccupancy } from '@/lib/db';
import { isMissingDatabaseStructureError, productionMigrationMessage } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';

async function save(request: Request, status = 200) {
  try {
    const input = await request.json();
    const surfaceId = typeof input.surfaceId === 'string' ? input.surfaceId : '';
    const dateFrom = typeof input.dateFrom === 'string' ? input.dateFrom : '';
    const dateTo = typeof input.dateTo === 'string' ? input.dateTo : '';
    const occupancyStatus = typeof input.status === 'string' ? input.status : 'RESERVED';
    const shouldCheck = ['OCCUPIED', 'RESERVED', 'NEGOTIATION'].includes(occupancyStatus) && surfaceId && dateFrom && dateTo;

    if (shouldCheck) {
      const conflicts = await checkOccupancyConflicts([surfaceId], dateFrom, dateTo, typeof input.id === 'string' ? input.id : undefined);
      if (hasBlockingConflict(conflicts)) {
        return NextResponse.json({
          error: 'Plocha je v tomto terminu uz obsazena nebo rezervovana.',
          conflicts,
        }, { status: 409 });
      }
      if (conflicts.length > 0 && !input.allowNegotiationConflict) {
        return NextResponse.json({
          warning: 'Plocha je v tomto terminu v jednani. Muzete pokracovat po potvrzeni.',
          conflicts,
        }, { status: 409 });
      }
    }

    const occupancy = await upsertOccupancy(input);
    return NextResponse.json({ occupancy, conflicts: [] }, { status });
  } catch (error) {
    console.error('Occupancy save failed', error);
    if (isMissingDatabaseStructureError(error)) {
      return NextResponse.json({ error: productionMigrationMessage() }, { status: 503 });
    }
    return NextResponse.json({ error: 'Obsazenost se nepodarilo ulozit.' }, { status: 400 });
  }
}

export async function POST(request: Request) {
  return save(request, 201);
}

export async function PUT(request: Request) {
  return save(request);
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json();
    const id = typeof input.id === 'string' ? input.id : '';
    const action = typeof input.action === 'string' ? input.action : '';
    if (!id) return NextResponse.json({ error: 'Chybi ID obsazenosti.' }, { status: 400 });
    if (action !== 'extend' && action !== 'finish' && action !== 'free') {
      return NextResponse.json({ error: 'Neplatna akce obsazenosti.' }, { status: 400 });
    }

    const occupancy = await updateOccupancyAction(id, action, {
      dateTo: typeof input.dateTo === 'string' ? input.dateTo : undefined,
      updatedBy: typeof input.updatedBy === 'string' ? input.updatedBy : undefined,
    });
    return NextResponse.json({ occupancy });
  } catch (error) {
    console.error('Occupancy action failed', error);
    if (isMissingDatabaseStructureError(error)) {
      return NextResponse.json({ error: productionMigrationMessage() }, { status: 503 });
    }
    const conflicts = error instanceof Error && 'conflicts' in error
      ? (error as Error & { conflicts?: unknown }).conflicts
      : undefined;
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Akci obsazenosti se nepodarilo ulozit.',
      conflicts,
    }, { status: conflicts ? 409 : 400 });
  }
}
