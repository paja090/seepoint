import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { executeAiInboxAction } from '@/lib/ai-inbox/action-executor';

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
    return NextResponse.json({ error: 'Nemáte oprávnění pro provádění akcí v AI Inboxu.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  try {
    const result = await executeAiInboxAction(organizationId, params.actionId, user);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chyba při provádění akce';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
