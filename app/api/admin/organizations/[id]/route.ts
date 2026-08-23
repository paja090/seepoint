import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/organization';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => null) as { isActive?: unknown } | null;
    if (typeof body?.isActive !== 'boolean') return NextResponse.json({ error: 'Stav není platný.' }, { status: 400 });
    const organization = await platformPrisma.organization.update({ where: { id }, data: { isActive: body.isActive } });
    if (!organization.isActive) await platformPrisma.userSession.deleteMany({ where: { activeOrganizationId: id } });
    return NextResponse.json({ ok: true, organization });
  } catch { return NextResponse.json({ error: 'Organizace nebyla nalezena.' }, { status: 404 }); }
}

