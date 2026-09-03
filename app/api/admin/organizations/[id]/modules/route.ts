import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/organization';
import { getOrganizationEnabledModules, SYSTEM_MODULES } from '@/lib/organization-modules';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const organization = await platformPrisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, plan: true, enabledModules: true },
    });
    if (!organization) return NextResponse.json({ error: 'Organizace nebyla nalezena.' }, { status: 404 });

    const enabledModules = getOrganizationEnabledModules(organization);
    return NextResponse.json({
      organization,
      modules: SYSTEM_MODULES,
      enabledModules,
    });
  } catch {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 403 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      enabledModules?: Record<string, boolean>;
      plan?: string;
    } | null;

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Neplatná data požadavku.' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.enabledModules && typeof body.enabledModules === 'object') {
      updateData.enabledModules = body.enabledModules;
    }
    if (body.plan && typeof body.plan === 'string') {
      const validPlans = ['INTERNAL', 'START', 'BUSINESS', 'PRO', 'ENTERPRISE'];
      if (validPlans.includes(body.plan.toUpperCase())) {
        updateData.plan = body.plan.toUpperCase();
      }
    }

    const updated = await platformPrisma.organization.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, slug: true, plan: true, enabledModules: true },
    });

    const activeModules = getOrganizationEnabledModules(updated);
    return NextResponse.json({
      ok: true,
      organization: updated,
      enabledModules: activeModules,
    });
  } catch {
    return NextResponse.json({ error: 'Chyba při ukládání nastavení modulů.' }, { status: 500 });
  }
}
