import { getCurrentUser } from '@/lib/auth';
import { canAccess, AccessDenied } from '@/lib/rbac';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { listAiInboxMessages } from '@/lib/ai-inbox/service';
import { prisma } from '@/lib/db';
import { AiInboxView } from '@/components/ai-inbox/AiInboxView';

export const dynamic = 'force-dynamic';

export default async function AiInboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!canAccess(user.role, 'aiInbox' as any)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return (
      <AppShell>
        <div className="card text-center p-8">
          <p className="text-slate-600 font-medium">Chybí kontext organizace.</p>
        </div>
      </AppShell>
    );
  }

  const [{ items }, mailboxes] = await Promise.all([
    listAiInboxMessages(organizationId, { take: 100 }),
    prisma.integrationConnection.findMany({
      where: { organizationId, provider: 'GMAIL' },
      select: { id: true, accountEmail: true, provider: true, status: true },
    }),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6">
        <AiInboxView initialItems={items as any} mailboxes={mailboxes as any} />
      </div>
    </AppShell>
  );
}
