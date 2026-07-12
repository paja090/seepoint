import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveWorkEntryRate } from '@/lib/work-entry-rates';
import { RateType, WorkType } from '@prisma/client';

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

  if (!employeeId || !workType || !workDate || !remunerationMethod) {
    return NextResponse.json({ error: 'Chybí parametry dotazu.' }, { status: 400 });
  }

  const dateObj = new Date(workDate);
  if (isNaN(dateObj.getTime())) {
    return NextResponse.json({ error: 'Neplatné datum.' }, { status: 400 });
  }

  const resolved = await resolveWorkEntryRate({
    employeeId,
    workType: workType as WorkType,
    workDate: dateObj,
    remunerationMethod: remunerationMethod as RateType,
    workOrderId,
  });

  if (!resolved) {
    return NextResponse.json({ rate: null, unit: 'ks', source: null });
  }

  return NextResponse.json({
    rate: resolved.amount.toString(),
    unit: resolved.unit,
    source: resolved.source,
  });
}
