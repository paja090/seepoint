import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { listAiInboxMessages } from '@/lib/ai-inbox/service';

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const classification = url.searchParams.get('classification') || undefined;
  const mailboxId = url.searchParams.get('mailboxId') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const rawReview = url.searchParams.get('requiresReview');
  const requiresReview = rawReview === 'true' ? true : rawReview === 'false' ? false : undefined;

  const take = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('take') || '50', 10)));
  const skip = Math.max(0, Number.parseInt(url.searchParams.get('skip') || '0', 10));

  try {
    const data = await listAiInboxMessages(organizationId, {
      status,
      classification,
      mailboxId,
      search,
      requiresReview,
      take,
      skip,
    });

    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chyba při načítání AI Inboxu';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
