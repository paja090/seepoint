import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canManageWarehouseCatalog, canRecordWarehouseMovement } from '@/lib/rbac';
import { recordWarehouseMovements, WarehouseStockError, type WarehouseMovementRequest } from '@/lib/warehouse-stock';
import { WarehouseInputError } from '@/lib/warehouse-validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  if (!canRecordWarehouseMovement(user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění zapisovat pohyby skladu.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => null) as (WarehouseMovementRequest & { movements?: WarehouseMovementRequest[] }) | null;
    if (!body) return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
    const movements = Array.isArray(body.movements) ? body.movements : [body];

    if (movements.some((movement) => movement.type === 'ADJUSTMENT') && !canManageWarehouseCatalog(user.role)) {
      return NextResponse.json({ error: 'Inventurní korekci může provést pouze správce skladu.' }, { status: 403 });
    }

    const performedByName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.name || user.email;
    const results = await recordWarehouseMovements(movements, performedByName);

    return NextResponse.json({ movements: results, movement: results[0], item: results[0]?.item });
  } catch (error) {
    if (error instanceof WarehouseInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof WarehouseStockError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Create warehouse movement error:', error);
    return NextResponse.json({ error: 'Registrace pohybu selhala.' }, { status: 500 });
  }
}
