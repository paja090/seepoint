import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { parseCarrierFilters } from '@/lib/carrier-filters';
import { getCarriersPage, upsertCarrier, type SurfaceTemplate } from '@/lib/db';
import type { Carrier, Surface } from '@/lib/types';

const allowedMediaTypes = new Set<Surface['mediaType']>(['BILLBOARD', 'PROMO_BENCH', 'PROMO_HORIZON', 'CITY_POSTER', 'NAVIGATION_SIGN', 'PROMO_TOWER', 'PROMO_MINITOWER']);

type CarrierCreateRequest = Partial<Carrier> & { surfaceTemplates?: SurfaceTemplate[] };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  return NextResponse.json(await getCarriersPage(parseCarrierFilters(params)));
}

export async function POST(req: Request) {
  try {
    const input = await req.json() as CarrierCreateRequest;
    const { surfaceTemplates: requestedTemplates = [], ...carrierInput } = input;
    if (!carrierInput.name?.trim() || !carrierInput.code?.trim() || !carrierInput.city?.trim()) return NextResponse.json({ error: 'Vyplnte nazev, interni kod a mesto.' }, { status: 400 });
    const hasLatitude = carrierInput.latitude !== undefined && carrierInput.latitude !== null;
    const hasLongitude = carrierInput.longitude !== undefined && carrierInput.longitude !== null;
    if (hasLatitude !== hasLongitude) return NextResponse.json({ error: 'Vyplnte obe GPS souradnice, nebo nechte obe prazdne.' }, { status: 400 });
    if (hasLatitude && hasLongitude && (!Number.isFinite(carrierInput.latitude) || !Number.isFinite(carrierInput.longitude) || carrierInput.latitude! < -90 || carrierInput.latitude! > 90 || carrierInput.longitude! < -180 || carrierInput.longitude! > 180)) return NextResponse.json({ error: 'Souradnice nosice nejsou platne.' }, { status: 400 });
    if (!Array.isArray(requestedTemplates) || requestedTemplates.length > 4) return NextResponse.json({ error: 'Pocet reklamnich ploch nosice neni platny.' }, { status: 400 });
    const surfaceTemplates: SurfaceTemplate[] = [];
    for (const template of requestedTemplates) {
      if (!template || typeof template.name !== 'string' || !allowedMediaTypes.has(template.mediaType)) return NextResponse.json({ error: 'Nektera reklamni plocha neni platna.' }, { status: 400 });
      const name = template.name.trim().slice(0, 80);
      const orientation = typeof template.orientation === 'string' ? template.orientation.trim().slice(0, 10) : undefined;
      if (!name) return NextResponse.json({ error: 'Nazev reklamni plochy nesmi byt prazdny.' }, { status: 400 });
      surfaceTemplates.push({ name, mediaType: template.mediaType, orientation: orientation || undefined });
    }
    return NextResponse.json(await upsertCarrier({ ...carrierInput, gpsStatus: hasLatitude && hasLongitude ? carrierInput.gpsStatus ?? 'UNVERIFIED' : 'MISSING' }, surfaceTemplates), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'Nosic s timto internim kodem uz existuje.' }, { status: 409 });
    console.error('[api/carriers] create failed', error);
    return NextResponse.json({ error: 'Nosic se nepodarilo ulozit.' }, { status: 500 });
  }
}
