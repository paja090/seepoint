import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOrganization, requireOrganizationRole } from '@/lib/organization';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireOrganization();
    const products = await prisma.product.findMany({
      include: {
        carrierType: {
          select: { id: true, code: true, name: true, icon: true, color: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nemáte oprávnění.';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireOrganizationRole('ADMIN', 'MANAGER');
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Zadejte název produktu.' }, { status: 400 });
    }

    let code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!code) {
      code = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();
    }
    if (!code) {
      code = `PROD_${Date.now().toString(36).toUpperCase()}`;
    }

    const existing = await prisma.product.findFirst({
      where: { code },
    });
    if (existing) {
      return NextResponse.json({ error: `Produkt s kódem "${code}" již existuje.` }, { status: 409 });
    }

    const maxSort = await prisma.product.aggregate({
      _max: { sortOrder: true },
    });
    const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

    const carrierTypeId = typeof body?.carrierTypeId === 'string' && body.carrierTypeId.trim() ? body.carrierTypeId.trim() : null;
    const description = typeof body?.description === 'string' ? body.description.trim() || null : null;
    const unit = typeof body?.unit === 'string' ? body.unit.trim() || 'plocha' : 'plocha';
    const sortOrder = typeof body?.sortOrder === 'number' ? body.sortOrder : nextSort;

    // If carrierTypeId provided, verify it belongs to this tenant
    if (carrierTypeId) {
      const ct = await prisma.organizationCarrierType.findUnique({
        where: { id: carrierTypeId },
      });
      if (!ct) {
        return NextResponse.json({ error: 'Zvolený typ nosiče neexistuje.' }, { status: 400 });
      }
    }

    const created = await prisma.product.create({
      data: {
        organizationId,
        code,
        name,
        description,
        carrierTypeId,
        unit,
        sortOrder,
        active: true,
      },
      include: {
        carrierType: {
          select: { id: true, code: true, name: true, icon: true, color: true },
        },
      },
    });

    return NextResponse.json({ ok: true, product: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Produkt se nepodařilo vytvořit.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
