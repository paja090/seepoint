import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { createHash } from 'node:crypto';
import { CarrierType, MediaType } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireApiAccess('settings');
  if (isApiDenied(auth)) return auth;

  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Název ceníkové položky je povinný.' }, { status: 400 });
    }

    const carrierType = body.carrierType ? String(body.carrierType) : null;
    const mediaType = body.mediaType ? String(body.mediaType) : null;
    if (carrierType && !Object.values(CarrierType).includes(carrierType as CarrierType)) {
      return NextResponse.json({ error: 'Neplatný typ nosiče.' }, { status: 400 });
    }
    if (mediaType && !Object.values(MediaType).includes(mediaType as MediaType)) {
      return NextResponse.json({ error: 'Neplatný typ média.' }, { status: 400 });
    }
    const rentalMonths = Number(body.rentalMonths ?? 1);
    const minQuantity = Number(body.minQuantity ?? 1);
    const rentalPrice = Number(body.rentalPrice ?? 0);
    const productionPrice = Number(body.productionPrice ?? 0);
    if (!Number.isInteger(rentalMonths) || rentalMonths < 1 || !Number.isInteger(minQuantity) || minQuantity < 1) {
      return NextResponse.json({ error: 'Doba pronájmu a minimální množství musí být kladná celá čísla.' }, { status: 400 });
    }
    if (!Number.isFinite(rentalPrice) || rentalPrice < 0 || !Number.isFinite(productionPrice) || productionPrice < 0) {
      return NextResponse.json({ error: 'Ceny musí být platná nezáporná čísla.' }, { status: 400 });
    }
    const totalPrice = rentalPrice + productionPrice;
    
    const validFromDate = body.validFrom ? new Date(body.validFrom) : new Date();
    if (isNaN(validFromDate.getTime())) {
      return NextResponse.json({ error: 'Neplatné datum zahájení platnosti.' }, { status: 400 });
    }

    const identityKey = `PRICE:${name.toLowerCase().replace(/\s+/g, '_')}:${rentalMonths}:${minQuantity}`;
    const versionKey = createHash('sha256')
      .update(`${identityKey}:${validFromDate.toISOString()}:${rentalPrice}:${productionPrice}:${Date.now()}`)
      .digest('hex');

    const created = await prisma.priceListItem.create({
      data: {
        name,
        identityKey,
        versionKey,
        carrierType: carrierType as CarrierType | null,
        mediaType: mediaType as MediaType | null,
        rentalMonths,
        minQuantity,
        rentalPrice,
        productionPrice,
        totalPrice,
        validFrom: validFromDate,
        isActive: true,
      },
    });

    if (mediaType && productionPrice > 0) {
      const code = `PRINT_${mediaType}`;
      const label = `Tisk, výroba a instalace – ${name.replace(/\s*(komerce|kultura)\s*/i, '').trim() || mediaType}`;
      await prisma.offerPriceRule.upsert({
        where: { organizationId_code: { organizationId: auth.organizationId!, code } },
        create: {
          code,
          category: 'PRINT',
          label,
          mediaType: mediaType as MediaType,
          calculation: 'PER_SURFACE',
          unit: 'ks',
          unitPrice: productionPrice,
          defaultSelected: true,
          active: true,
        },
        update: {
          label,
          mediaType: mediaType as MediaType,
          unitPrice: productionPrice,
          defaultSelected: true,
          active: true,
        },
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Failed to create price list item:', error);
    return NextResponse.json({ error: 'Nepodařilo se vytvořit ceníkovou položku.' }, { status: 500 });
  }
}

export async function GET() {
  const auth = await requireApiAccess('settings');
  if (isApiDenied(auth)) return auth;

  try {
    const items = await prisma.priceListItem.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch price list items:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst ceníkové položky.' }, { status: 500 });
  }
}

