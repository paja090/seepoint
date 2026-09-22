import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOrganization, requireOrganizationRole } from '@/lib/organization';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireOrganization();
    const [carrierTypes, carrierCounts] = await Promise.all([
      prisma.organizationCarrierType.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.advertisingCarrier.groupBy({
        by: ['carrierTypeId'],
        _count: { _all: true },
      }),
    ]);

    const countMap = new Map<string, number>();
    for (const c of carrierCounts) {
      if (c.carrierTypeId) {
        countMap.set(c.carrierTypeId, c._count._all);
      }
    }

    const items = carrierTypes.map((ct) => ({
      id: ct.id,
      code: ct.code,
      name: ct.name,
      description: ct.description,
      icon: ct.icon,
      color: ct.color,
      active: ct.active,
      sortOrder: ct.sortOrder,
      legacyEnumValue: ct.legacyEnumValue,
      carrierCount: countMap.get(ct.id) ?? 0,
    }));

    return NextResponse.json({ carrierTypes: items });
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
      return NextResponse.json({ error: 'Zadejte název typu nosiče.' }, { status: 400 });
    }

    let code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!code) {
      // Auto-generate code from name
      code = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();
    }
    if (!code) {
      code = `TYPE_${Date.now().toString(36).toUpperCase()}`;
    }

    // Check unique code in organization
    const existing = await prisma.organizationCarrierType.findFirst({
      where: { code },
    });
    if (existing) {
      return NextResponse.json({ error: `Typ nosiče s kódem "${code}" již existuje.` }, { status: 409 });
    }

    const maxSort = await prisma.organizationCarrierType.aggregate({
      _max: { sortOrder: true },
    });
    const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

    const icon = typeof body?.icon === 'string' ? body.icon.trim() || null : null;
    const color = typeof body?.color === 'string' ? body.color.trim() || null : null;
    const description = typeof body?.description === 'string' ? body.description.trim() || null : null;
    const sortOrder = typeof body?.sortOrder === 'number' ? body.sortOrder : nextSort;

    const created = await prisma.organizationCarrierType.create({
      data: {
        organizationId,
        code,
        name,
        icon,
        color,
        description,
        sortOrder,
        active: true,
      },
    });

    return NextResponse.json({ ok: true, carrierType: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Typ nosiče se nepodařilo vytvořit.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
