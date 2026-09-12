import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { rejectAiInboxAction } from '@/lib/ai-inbox/action-executor';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string; actionId: string }> }
) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'aiInbox')) {
    return NextResponse.json({ error: 'Nemáte oprávnění pro odmítnutí akce v AI Inboxu.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  try {
    await rejectAiInboxAction(organizationId, params.actionId, user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chyba při odmítnutí akce';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
