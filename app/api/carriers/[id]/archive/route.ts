import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { archiveCarrier, restoreCarrier } from '@/lib/db';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('carriers'); if (isApiDenied(auth)) return auth;
  try {
    const input = await req.json().catch(() => ({})) as { archivedBy?: string; archiveReason?: string };
    const carrier = await archiveCarrier((await params).id, {
      archivedBy: input.archivedBy,
      archiveReason: input.archiveReason,
    });
    return NextResponse.json(carrier);
  } catch (error) {
    console.error('[api/carriers/:id/archive] archive failed', error);
    return NextResponse.json({ error: 'Nosič se nepodařilo archivovat.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('carriers'); if (isApiDenied(auth)) return auth;
  try {
    const carrier = await restoreCarrier((await params).id);
    return NextResponse.json(carrier);
  } catch (error) {
    console.error('[api/carriers/:id/archive] restore failed', error);
    return NextResponse.json({ error: 'Nosič se nepodařilo obnovit.' }, { status: 500 });
  }
}
