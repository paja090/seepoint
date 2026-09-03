import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { resolveWorkEntryRate } from '@/lib/work-entry-rates';
import { canAccess } from '@/lib/rbac';
import {
  canResolveEmployeeRate,
  parseDateOnly,
  parseId,
  parseRateType,
  parseWorkType,
  WorkEntryValidationError,
} from '@/lib/work-entry-policy';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const workType = searchParams.get('workType');
  const workDate = searchParams.get('workDate');
  const remunerationMethod = searchParams.get('remunerationMethod');
  const workOrderId = searchParams.get('workOrderId');

  if (!canAccess(user.role, 'workEntries') && !canAccess(user.role, 'myWorkEntries')) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  if (!employeeId || !workType || !workDate || !remunerationMethod) {
    return NextResponse.json({ error: 'Chybí parametry dotazu.' }, { status: 400 });
  }

  try {
    const cleanEmployeeId = parseId(employeeId, 'Pracovník');
    const employee = await prisma.employee.findUnique({
      where: { id: cleanEmployeeId },
      select: { id: true, userId: true, email: true },
    });
    if (!employee) return NextResponse.json({ error: 'Zaměstnanec nebyl nalezen.' }, { status: 404 });
    if (!canResolveEmployeeRate(user.role, user, employee)) {
      return NextResponse.json({ error: 'Nemáte oprávnění zobrazit sazbu jiného pracovníka.' }, { status: 403 });
    }

    const cleanWorkOrderId = workOrderId ? parseId(workOrderId, 'Zakázka') : undefined;
    if (cleanWorkOrderId) {
      const orderExists = await prisma.workOrder.findUnique({ where: { id: cleanWorkOrderId }, select: { id: true } });
      if (!orderExists) return NextResponse.json({ error: 'Pracovní zakázka nebyla nalezena.' }, { status: 404 });
    }

    const resolved = await resolveWorkEntryRate({
      employeeId: cleanEmployeeId,
      workType: parseWorkType(workType),
      workDate: parseDateOnly(workDate, 'Datum práce'),
      remunerationMethod: parseRateType(remunerationMethod),
      workOrderId: cleanWorkOrderId,
    });

    if (!resolved) return NextResponse.json({ rate: null, unit: 'ks', source: null });

    return NextResponse.json({ rate: resolved.amount.toString(), unit: resolved.unit, source: resolved.source });
  } catch (error) {
    if (error instanceof WorkEntryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Resolve work-entry rate failed', error);
    return NextResponse.json({ error: 'Sazbu se nepodařilo zjistit.' }, { status: 500 });
  }
}
