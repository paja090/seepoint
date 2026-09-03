import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { VacationPlannerClient } from '@/components/vacations/VacationPlannerClient';
import { canManageAbsences, canViewAbsenceNote } from '@/lib/absences';

export const dynamic = 'force-dynamic';

export default async function VacationsPage() {
  const user = await requirePageAccess('team');
  const canManage = canManageAbsences(user.role);
  const ownEmployeeId = user.employee?.id ?? null;
  const oldestVisibleDate = new Date();
  oldestVisibleDate.setUTCFullYear(oldestVisibleDate.getUTCFullYear() - 1);

  const [employees, rawAbsences] = await Promise.all([
    prisma.employee.findMany({
      where: canManage
        ? { isActive: true }
        : ownEmployeeId ? { id: ownEmployeeId, isActive: true } : { id: '__none__' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        role: true,
      },
      orderBy: { lastName: 'asc' },
    }),
    prisma.employeeAbsence.findMany({
      where: {
        dateTo: { gte: oldestVisibleDate },
        ...(canManage ? {} : {
          OR: [
            { status: 'APPROVED' as const },
            ...(ownEmployeeId ? [{ employeeId: ownEmployeeId }] : []),
          ],
        }),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            role: true,
          },
        },
      },
      orderBy: [{ dateFrom: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    }),
  ]);

  const absences = rawAbsences.map((a) => ({
    id: a.id,
    employeeId: a.employeeId,
    employeeName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
    position: a.employee.position || null,
    type: a.type,
    dateFrom: a.dateFrom.toISOString(),
    dateTo: a.dateTo.toISOString(),
    note: canViewAbsenceNote(user.role, ownEmployeeId, a.employeeId) ? a.note || null : null,
    status: a.status,
  }));

  return (
    <AppShell>
      <VacationPlannerClient
        currentUser={{
          id: user.id,
          employeeId: user.employee?.id || null,
          role: user.role,
        }}
        employees={employees.map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`.trim(),
          position: e.position || null,
        }))}
        initialAbsences={absences}
      />
    </AppShell>
  );
}
