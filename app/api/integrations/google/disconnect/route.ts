import { NextResponse } from 'next/server';
import { requireOrganizationRole } from '@/lib/organization';
import { disconnectGoogleConnection } from '@/lib/integrations/google-oauth';

export async function POST() {
  try {
    await requireOrganizationRole('ADMIN');
    const disconnected = await disconnectGoogleConnection('GOOGLE_DRIVE');
    if (!disconnected) return NextResponse.json({ error: 'Google Drive není připojený.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Google Drive se nepodařilo odpojit.' }, { status: 403 });
  }
}

