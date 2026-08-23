import { NextResponse } from 'next/server';
import { setActiveOrganization } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { organizationId?: unknown } | null;
  if (!body || typeof body.organizationId !== 'string' || !body.organizationId) {
    return NextResponse.json({ error: 'Organizace je povinná.' }, { status: 400 });
  }
  const organization = await setActiveOrganization(body.organizationId);
  if (!organization) return NextResponse.json({ error: 'Organizace nebyla nalezena.' }, { status: 404 });
  return NextResponse.json({ ok: true, organization: { id: organization.id, name: organization.name, slug: organization.slug } });
}

