import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { updateMailboxSettings, type CustomMailboxSettings } from '@/lib/ai-inbox/service';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'aiInbox') && !canAccess(user.role, 'settings')) {
    return NextResponse.json({ error: 'Nemáte oprávnění pro správu nastavení schránek.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  const url = new URL(request.url);
  const connectionId = url.searchParams.get('connectionId');

  try {
    const connections = await prisma.integrationConnection.findMany({
      where: {
        organizationId,
        provider: 'GMAIL',
        status: { not: 'REVOKED' },
        ...(connectionId ? { id: connectionId } : {}),
      },
      select: {
        id: true,
        accountEmail: true,
        status: true,
        settings: true,
        lastCheckedAt: true,
      },
    });

    return NextResponse.json({ ok: true, connections });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chyba při načítání nastavení schránek';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'aiInbox') && !canAccess(user.role, 'settings')) {
    return NextResponse.json({ error: 'Nemáte oprávnění pro úpravu nastavení schránek.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  try {
    const body = await request.json() as {
      connectionId: string;
      settings: CustomMailboxSettings;
    };

    if (!body.connectionId) {
      return NextResponse.json({ error: 'Chybí connectionId schránky.' }, { status: 400 });
    }

    const result = await updateMailboxSettings(organizationId, body.connectionId, body.settings || {});
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chyba při ukládání nastavení schránky';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
