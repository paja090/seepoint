import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { executeAiInboxAction } from '@/lib/ai-inbox/action-executor';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
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

  const body = await request.json() as { actionIds?: string[] };
  const actionIds = Array.isArray(body.actionIds) ? body.actionIds : [];

  if (actionIds.length === 0) {
    return NextResponse.json({ error: 'Nebyly vybrány žádné akce k provedení.' }, { status: 400 });
  }

  const results = [];
  for (const actionId of actionIds) {
    try {
      const res = await executeAiInboxAction(organizationId, actionId, user);
      results.push(res);
    } catch (err) {
      results.push({
        actionId,
        success: false,
        message: err instanceof Error ? err.message : 'Chyba při provádění akce',
      });
    }
  }

  return NextResponse.json({ results });
}
