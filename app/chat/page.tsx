import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { TeamChatContainer } from '@/components/chat/TeamChatContainer';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const user = await requirePageAccess('team');

  const vehicles = await prisma.vehicle.findMany({
    select: {
      id: true,
      name: true,
      registrationNumber: true,
    },
    orderBy: { name: 'asc' },
  });

  const currentUserData = {
    id: user.id,
    name: user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.name || user.email,
    role: user.role,
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl h-[calc(100vh-6rem)] flex flex-col space-y-4">
        <TeamChatContainer
          currentUser={currentUserData}
          vehicles={vehicles.map((v) => ({
            id: v.id,
            label: `${v.name}${v.registrationNumber ? ` (${v.registrationNumber})` : ''}`,
          }))}
        />
      </div>
    </AppShell>
  );
}
