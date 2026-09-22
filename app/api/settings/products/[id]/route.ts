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

    const existing = await prisma.product.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Produkt nebyl nalezen.' }, { status: 404 });
    }

    const data: {
      name?: string;
      code?: string;
      description?: string | null;
      carrierTypeId?: string | null;
      unit?: string | null;
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
      if (code !== existing.code) {
        const duplicate = await prisma.product.findFirst({
          where: { code, id: { not: id } },
        });
        if (duplicate) {
          return NextResponse.json({ error: `Kód "${code}" již existuje.` }, { status: 409 });
        }
      }
      data.code = code;
    }

    if (body?.description !== undefined) {
      data.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    }

    if (body?.unit !== undefined) {
      data.unit = typeof body.unit === 'string' ? body.unit.trim() || null : null;
    }

    if (body?.carrierTypeId !== undefined) {
      const carrierTypeId = typeof body.carrierTypeId === 'string' && body.carrierTypeId.trim() ? body.carrierTypeId.trim() : null;
      if (carrierTypeId) {
        const ct = await prisma.organizationCarrierType.findUnique({
          where: { id: carrierTypeId },
        });
        if (!ct) return NextResponse.json({ error: 'Zvolený typ nosiče neexistuje.' }, { status: 400 });
      }
      data.carrierTypeId = carrierTypeId;
    }

    if (typeof body?.active === 'boolean') {
      data.active = body.active;
    }

    if (typeof body?.sortOrder === 'number') {
      data.sortOrder = body.sortOrder;
    }

    const updated = await prisma.product.update({
      where: { id },
      data,
      include: {
        carrierType: {
          select: { id: true, code: true, name: true, icon: true, color: true },
        },
      },
    });

    return NextResponse.json({ ok: true, product: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Produkt se nepodařilo upravit.';
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

    const existing = await prisma.product.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Produkt nebyl nalezen.' }, { status: 404 });
    }

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Produkt se nepodařilo smazat.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
