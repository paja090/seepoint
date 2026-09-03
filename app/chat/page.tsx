import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { TeamChatContainer } from '@/components/chat/TeamChatContainer';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const user = await requirePageAccess('team');
  const { channel } = await searchParams;

  const [vehicles, employees] = await Promise.all([
    prisma.vehicle.findMany({
      select: {
        id: true,
        name: true,
        registrationNumber: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.employee.findMany({
      where: { isActive: true, userId: { not: null } },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        role: true,
        position: true,
      },
      orderBy: { lastName: 'asc' },
    }),
  ]);

  const currentUserData = {
    id: user.id,
    employeeId: user.employee?.id,
    name: user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.name || user.email,
    role: user.role,
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl h-[calc(100dvh-7.5rem)] lg:h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
        <TeamChatContainer
          initialChannel={channel}
          currentUser={currentUserData}
          vehicles={vehicles.map((v) => ({
            id: v.id,
            label: `${v.name}${v.registrationNumber ? ` (${v.registrationNumber})` : ''}`,
          }))}
          teamMembers={employees.map((e) => ({
            id: e.userId!,
            name: `${e.firstName} ${e.lastName}`.trim(),
            position: e.position || null,
          }))}
        />
      </div>
    </AppShell>
  );
}
