import { NextResponse } from 'next/server';
import { requireOrganization, requireOrganizationRole } from '@/lib/organization';
import {
  getOrganizationWorkCategories,
  saveOrganizationWorkCategories,
  applyOrganizationWorkCategoryPreset,
} from '@/lib/work-categories-server';
import {
  WORK_CATEGORY_PRESETS,
  type WorkCategory,
} from '@/lib/work-categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { organizationId } = await requireOrganization();
    const categories = await getOrganizationWorkCategories(organizationId);
    return NextResponse.json({
      categories,
      presets: Object.values(WORK_CATEGORY_PRESETS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nemáte oprávnění.';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function PUT(request: Request) {
  try {
    const { organizationId } = await requireOrganizationRole('ADMIN', 'MANAGER');
    const body = (await request.json().catch(() => null)) as { categories?: WorkCategory[] } | null;

    if (!body || !Array.isArray(body.categories)) {
      return NextResponse.json({ error: 'Neplatný formát dat činností.' }, { status: 400 });
    }

    const saved = await saveOrganizationWorkCategories(organizationId, body.categories);
    return NextResponse.json({ ok: true, categories: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Změnu se nepodařilo uložit.';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireOrganizationRole('ADMIN', 'MANAGER');
    const body = (await request.json().catch(() => null)) as { preset?: string } | null;

    if (!body?.preset || typeof body.preset !== 'string') {
      return NextResponse.json({ error: 'Vyberte platnou šablonu činností.' }, { status: 400 });
    }

    const saved = await applyOrganizationWorkCategoryPreset(organizationId, body.preset);
    return NextResponse.json({ ok: true, categories: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Šablonu se nepodařilo aplikovat.';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
