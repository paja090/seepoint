import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function normalizeClientName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const surfaceId = (await params).id;
    const body = await request.json() as { clientName?: unknown };
    if (body.clientName !== null && body.clientName !== undefined && typeof body.clientName !== 'string') {
      return NextResponse.json({ error: 'Název klienta musí být text.' }, { status: 400 });
    }

    const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
    if (clientName.length > 200) {
      return NextResponse.json({ error: 'Název klienta je příliš dlouhý.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.advertisingSurface.findUnique({ where: { id: surfaceId } });
      if (!existing) return null;

      if (!clientName) {
        const surface = await transaction.advertisingSurface.update({
          where: { id: surfaceId },
          data: {
            currentClientId: null,
            status: existing.status === 'OCCUPIED' ? 'AVAILABLE' : existing.status,
          },
        });
        return { surface, client: null };
      }

      const normalizedName = normalizeClientName(clientName);
      if (!normalizedName) throw new Error('Zadejte platný název klienta.');
      const client = await transaction.client.upsert({
        where: { normalizedName },
        create: { name: clientName, normalizedName, active: true },
        update: { active: true },
      });
      const surface = await transaction.advertisingSurface.update({
        where: { id: surfaceId },
        data: {
          currentClientId: client.id,
          status: existing.status === 'AVAILABLE' ? 'OCCUPIED' : existing.status,
        },
      });
      return { surface, client };
    });

    if (!result) return NextResponse.json({ error: 'Navigace nebyla nalezena.' }, { status: 404 });
    return NextResponse.json({
      id: result.surface.id,
      currentClientId: result.surface.currentClientId,
      currentClient: result.client ? { id: result.client.id, name: result.client.name } : null,
      status: result.surface.status,
    });
  } catch (error) {
    console.error('Surface client assignment failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Klienta se nepodařilo uložit.' },
      { status: 400 },
    );
  }
}
