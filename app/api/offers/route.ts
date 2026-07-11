import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { createOfferDraft, getOffers } from '@/lib/db';
import { isMissingDatabaseStructureError, productionMigrationMessage } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';

type OfferBody = {
  clientId?: unknown;
  title?: unknown;
  status?: unknown;
  validUntil?: unknown;
  note?: unknown;
  createdBy?: unknown;
  items?: unknown;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function conflictsFrom(error: unknown) {
  return error instanceof Error && 'conflicts' in error
    ? (error as Error & { conflicts?: unknown }).conflicts
    : undefined;
}

export async function GET() {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try {
    return NextResponse.json(await getOffers());
  } catch (error) {
    console.error('Offer list failed', error);
    if (isMissingDatabaseStructureError(error)) {
      return NextResponse.json({ error: productionMigrationMessage() }, { status: 503 });
    }
    return NextResponse.json({ error: 'Nabidky se nepodarilo nacist.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try {
    const body = await request.json() as OfferBody;
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items = rawItems.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        surfaceId: text(row.surfaceId),
        dateFrom: text(row.dateFrom),
        dateTo: text(row.dateTo),
        price: row.price === undefined || row.price === null || row.price === '' ? undefined : Number(row.price),
        note: text(row.note) || undefined,
      };
    }).filter((item) => item.surfaceId && item.dateFrom && item.dateTo);

    if (!text(body.clientId)) return NextResponse.json({ error: 'Vyberte klienta.' }, { status: 400 });
    if (!text(body.title)) return NextResponse.json({ error: 'Zadejte nazev nabidky.' }, { status: 400 });
    if (items.length === 0) return NextResponse.json({ error: 'Pridete alespon jednu reklamni plochu.' }, { status: 400 });
    if (items.some((item) => Number.isNaN(item.price))) return NextResponse.json({ error: 'Cena musi byt cislo.' }, { status: 400 });

    const result = await createOfferDraft({
      clientId: text(body.clientId),
      title: text(body.title),
      status: body.status === 'SENT' ? 'SENT' : 'DRAFT',
      validUntil: text(body.validUntil) || undefined,
      note: text(body.note) || undefined,
      createdBy: text(body.createdBy) || undefined,
      items,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Offer creation failed', error);
    if (isMissingDatabaseStructureError(error)) {
      return NextResponse.json({ error: productionMigrationMessage() }, { status: 503 });
    }
    const conflicts = conflictsFrom(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Nabidku se nepodarilo ulozit.',
        conflicts,
      },
      { status: conflicts ? 409 : 400 },
    );
  }
}
