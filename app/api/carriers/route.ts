import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCarriers, upsertCarrier, type SurfaceTemplate } from '@/lib/db';
import type { Carrier, Surface } from '@/lib/types';

const allowedMediaTypes = new Set<Surface['mediaType']>([
  'BILLBOARD',
  'PROMO_BENCH',
  'PROMO_HORIZON',
  'CITY_POSTER',
  'NAVIGATION_SIGN',
  'PROMO_TOWER',
  'PROMO_MINITOWER',
]);

type CarrierCreateRequest = Partial<Carrier> & {
  surfaceTemplates?: SurfaceTemplate[];
};

export async function GET() {
  return NextResponse.json(await getCarriers());
}

export async function POST(req: Request) {
  try {
    const input = await req.json() as CarrierCreateRequest;
    const { surfaceTemplates: requestedTemplates = [], ...carrierInput } = input;

    if (!carrierInput.name?.trim() || !carrierInput.code?.trim() || !carrierInput.city?.trim()) {
      return NextResponse.json({ error: 'Vyplňte název, interní kód a město.' }, { status: 400 });
    }
    if (!Number.isFinite(carrierInput.latitude) || !Number.isFinite(carrierInput.longitude)) {
      return NextResponse.json({ error: 'Souřadnice nosiče nejsou platné.' }, { status: 400 });
    }
    if (!Array.isArray(requestedTemplates) || requestedTemplates.length > 4) {
      return NextResponse.json({ error: 'Počet reklamních ploch nosiče není platný.' }, { status: 400 });
    }

    const surfaceTemplates: SurfaceTemplate[] = [];
    for (const template of requestedTemplates) {
      if (!template || typeof template.name !== 'string' || !allowedMediaTypes.has(template.mediaType)) {
        return NextResponse.json({ error: 'Některá reklamní plocha není platná.' }, { status: 400 });
      }
      const name = template.name.trim().slice(0, 80);
      const orientation = typeof template.orientation === 'string' ? template.orientation.trim().slice(0, 10) : undefined;
      if (!name) {
        return NextResponse.json({ error: 'Název reklamní plochy nesmí být prázdný.' }, { status: 400 });
      }
      surfaceTemplates.push({ name, mediaType: template.mediaType, orientation: orientation || undefined });
    }

    return NextResponse.json(await upsertCarrier(carrierInput, surfaceTemplates), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Nosič s tímto interním kódem už existuje.' }, { status: 409 });
    }
    console.error('[api/carriers] create failed', error);
    return NextResponse.json({ error: 'Nosič se nepodařilo uložit.' }, { status: 500 });
  }
}
