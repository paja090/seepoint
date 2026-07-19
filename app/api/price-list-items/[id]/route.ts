import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { createHash } from 'node:crypto';
import { CarrierType, MediaType } from '@prisma/client';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('settings');
  if (isApiDenied(auth)) return auth;

  try {
    const id = (await params).id;
    const body = await request.json();

    const existing = await prisma.priceListItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Ceníková položka nebyla nalezena.' }, { status: 404 });
    }

    const name = body.name !== undefined ? String(body.name || '').trim() : existing.name;
    const carrierType = body.carrierType !== undefined ? (body.carrierType as CarrierType | null) : existing.carrierType;
    const mediaType = body.mediaType !== undefined ? (body.mediaType as MediaType | null) : existing.mediaType;
    const rentalMonths = body.rentalMonths !== undefined ? Math.max(1, parseInt(body.rentalMonths) || 1) : existing.rentalMonths;
    const minQuantity = body.minQuantity !== undefined ? Math.max(1, parseInt(body.minQuantity) || 1) : existing.minQuantity;
    const rentalPrice = body.rentalPrice !== undefined ? parseFloat(body.rentalPrice) || 0 : existing.rentalPrice.toNumber();
    const productionPrice = body.productionPrice !== undefined ? parseFloat(body.productionPrice) || 0 : existing.productionPrice.toNumber();
    const totalPrice = rentalPrice + productionPrice;
    
    const validFromDate = body.validFrom ? new Date(body.validFrom) : existing.validFrom;
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive;
    const validTo = body.validTo !== undefined ? (body.validTo ? new Date(body.validTo) : null) : existing.validTo;

    const identityKey = `PRICE:${name.toLowerCase().replace(/\s+/g, '_')}:${rentalMonths}:${minQuantity}`;
    const versionKey = createHash('sha256')
      .update(`${identityKey}:${validFromDate.toISOString()}:${rentalPrice}:${productionPrice}:${Date.now()}`)
      .digest('hex');

    const updated = await prisma.priceListItem.update({
      where: { id },
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
        validTo,
        isActive,
      },
    });

    if (mediaType && productionPrice > 0) {
      const code = `PRINT_${mediaType}`;
      const label = `Tisk a výroba – ${name.replace(/\s*(komerce|kultura)\s*/i, '').trim() || mediaType}`;
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update price list item:', error);
    return NextResponse.json({ error: 'Nepodařilo se upravit ceníkovou položku.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('settings');
  if (isApiDenied(auth)) return auth;

  try {
    const id = (await params).id;
    // Archive by setting isActive: false and validTo: now
    const updated = await prisma.priceListItem.update({
      where: { id },
      data: {
        isActive: false,
        validTo: new Date(),
      },
    });
    return NextResponse.json({ ok: true, archived: updated });
  } catch (error) {
    console.error('Failed to delete price list item:', error);
    return NextResponse.json({ error: 'Nepodařilo se odstranit ceníkovou položku.' }, { status: 500 });
  }
}
