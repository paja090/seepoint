import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { runWithTenantContext } from '@/lib/tenant-context';
import { disconnectGoogleConnection } from '@/lib/integrations/google-oauth';
import { type IntegrationProvider } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Uživatel není přihlášen nebo nemá aktivní organizaci.' }, { status: 401 });
    }

    const isOrgAdmin = user.membership?.role === 'OWNER' || user.membership?.role === 'ADMIN' || (user.membership?.roles ?? []).includes('ADMIN');
    const isAppAdmin = user.role === 'ADMIN' || canAccess(user.role, 'settings');
    const isSuperAdmin = user.platformRole === 'SUPER_ADMIN';

    if (!isOrgAdmin && !isAppAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: 'Nedostatečná oprávnění pro správu integrací.' }, { status: 403 });
    }

    let provider: IntegrationProvider = 'GOOGLE_DRIVE';
    let connectionId: string | undefined;

    try {
      const body = await request.json() as { provider?: IntegrationProvider; connectionId?: string };
      if (body.provider) provider = body.provider;
      if (body.connectionId) connectionId = body.connectionId;
    } catch {
      const url = new URL(request.url);
      const queryProvider = url.searchParams.get('provider')?.toUpperCase() as IntegrationProvider;
      if (queryProvider) provider = queryProvider;
      connectionId = url.searchParams.get('connectionId') || undefined;
    }

    const organizationId = user.organizationId;
    const disconnected = await runWithTenantContext(
      { organizationId, userId: user.id, source: 'session' },
      () => disconnectGoogleConnection(provider, connectionId, organizationId)
    );

    if (!disconnected) {
      return NextResponse.json({ error: 'Integrace nebyla nalezena nebo již byla odpojena.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Integraci se nepodařilo odpojit.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


