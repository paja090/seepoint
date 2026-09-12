import { NextResponse } from 'next/server';
import { requireOrganizationRole } from '@/lib/organization';
import { disconnectGoogleConnection } from '@/lib/integrations/google-oauth';

import { type IntegrationProvider } from '@prisma/client';

export async function POST(request: Request) {
  try {
    await requireOrganizationRole('ADMIN');
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
    const disconnected = await disconnectGoogleConnection(provider, connectionId);
    if (!disconnected) return NextResponse.json({ error: 'Integrace není připojená.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Integraci se nepodařilo odpojit.' }, { status: 403 });
  }
}

