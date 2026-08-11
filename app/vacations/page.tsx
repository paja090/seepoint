import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { VacationPlannerClient } from '@/components/vacations/VacationPlannerClient';

export const dynamic = 'force-dynamic';

export default async function VacationsPage() {
  const user = await requirePageAccess('team');

  const [employees, rawAbsences] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
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
      orderBy: { dateFrom: 'asc' },
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
    note: a.note || null,
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
