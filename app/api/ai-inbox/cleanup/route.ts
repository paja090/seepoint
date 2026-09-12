import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { cleanupSpamMessages } from '@/lib/ai-inbox/service';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'aiInbox')) {
    return NextResponse.json({ error: 'Nemáte oprávnění pro přístup k AI Inboxu.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    addSendersToIgnoreList?: boolean;
  };

  try {
    const result = await cleanupSpamMessages(
      organizationId,
      body.addSendersToIgnoreList !== false
    );
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chyba při čištění spamu';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
