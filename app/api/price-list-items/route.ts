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

    const carrierType = body.carrierType ? (body.carrierType as CarrierType) : null;
    const mediaType = body.mediaType ? (body.mediaType as MediaType) : null;
    const rentalMonths = Math.max(1, parseInt(body.rentalMonths) || 1);
    const minQuantity = Math.max(1, parseInt(body.minQuantity) || 1);
    const rentalPrice = parseFloat(body.rentalPrice) || 0;
    const productionPrice = parseFloat(body.productionPrice) || 0;
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
        carrierType,
        mediaType,
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
        where: { code },
        create: {
          code,
          category: 'PRINT',
          label,
          mediaType,
          calculation: 'PER_SURFACE',
          unit: 'ks',
          unitPrice: productionPrice,
          defaultSelected: true,
          active: true,
        },
        update: {
          label,
          mediaType,
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

