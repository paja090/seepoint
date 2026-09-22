import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOrganizationRole } from '@/lib/organization';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOrganizationRole('ADMIN', 'MANAGER');
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    const existing = await prisma.organizationCarrierType.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Typ nosiče nebyl nalezen.' }, { status: 404 });
    }

    const data: {
      name?: string;
      code?: string;
      icon?: string | null;
      color?: string | null;
      description?: string | null;
      active?: boolean;
      sortOrder?: number;
    } = {};

    if (typeof body?.name === 'string') {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: 'Název nesmí být prázdný.' }, { status: 400 });
      data.name = name;
    }

    if (typeof body?.code === 'string') {
      const code = body.code.trim().toUpperCase();
      if (!code) return NextResponse.json({ error: 'Kód nesmí být prázdný.' }, { status: 400 });
      // Check code uniqueness if changed
      if (code !== existing.code) {
        const duplicate = await prisma.organizationCarrierType.findFirst({
          where: { code, id: { not: id } },
        });
        if (duplicate) {
          return NextResponse.json({ error: `Kód "${code}" již existuje.` }, { status: 409 });
        }
      }
      data.code = code;
    }

    if (body?.icon !== undefined) {
      data.icon = typeof body.icon === 'string' ? body.icon.trim() || null : null;
    }

    if (body?.color !== undefined) {
      data.color = typeof body.color === 'string' ? body.color.trim() || null : null;
    }

    if (body?.description !== undefined) {
      data.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    }

    if (typeof body?.active === 'boolean') {
      data.active = body.active;
    }

    if (typeof body?.sortOrder === 'number') {
      data.sortOrder = body.sortOrder;
    }

    const updated = await prisma.organizationCarrierType.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, carrierType: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Typ nosiče se nepodařilo upravit.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOrganizationRole('ADMIN');
    const { id } = await params;

    const existing = await prisma.organizationCarrierType.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Typ nosiče nebyl nalezen.' }, { status: 404 });
    }

    // Check if in use by carriers or surfaces
    const [carrierUsage, surfaceUsage] = await Promise.all([
      prisma.advertisingCarrier.count({ where: { carrierTypeId: id } }),
      prisma.advertisingSurface.count({ where: { carrierTypeId: id } }),
    ]);

    if (carrierUsage > 0 || surfaceUsage > 0) {
      // Soft-deactivate to prevent breaking existing carriers/surfaces
      await prisma.organizationCarrierType.update({
        where: { id },
        data: { active: false },
      });
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: `Typ nosiče je přiřazen k ${carrierUsage} nosičům a byl deaktivován místo smazání, aby nedošlo k poškození dat.`,
      });
    }

    await prisma.organizationCarrierType.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Typ nosiče se nepodařilo smazat.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
