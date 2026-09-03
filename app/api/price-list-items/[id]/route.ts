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
    if (!name) return NextResponse.json({ error: 'Název ceníkové položky je povinný.' }, { status: 400 });
    const carrierTypeInput = body.carrierType !== undefined ? body.carrierType : existing.carrierType;
    const mediaTypeInput = body.mediaType !== undefined ? body.mediaType : existing.mediaType;
    const carrierType = carrierTypeInput === null || carrierTypeInput === '' ? null : String(carrierTypeInput);
    const mediaType = mediaTypeInput === null || mediaTypeInput === '' ? null : String(mediaTypeInput);
    if (carrierType && !Object.values(CarrierType).includes(carrierType as CarrierType)) {
      return NextResponse.json({ error: 'Neplatný typ nosiče.' }, { status: 400 });
    }
    if (mediaType && !Object.values(MediaType).includes(mediaType as MediaType)) {
      return NextResponse.json({ error: 'Neplatný typ média.' }, { status: 400 });
    }
    const rentalMonths = body.rentalMonths !== undefined ? Number(body.rentalMonths) : existing.rentalMonths;
    const minQuantity = body.minQuantity !== undefined ? Number(body.minQuantity) : existing.minQuantity;
    const rentalPrice = body.rentalPrice !== undefined ? Number(body.rentalPrice) : existing.rentalPrice.toNumber();
    const productionPrice = body.productionPrice !== undefined ? Number(body.productionPrice) : existing.productionPrice.toNumber();
    if (!Number.isInteger(rentalMonths) || rentalMonths < 1 || !Number.isInteger(minQuantity) || minQuantity < 1) {
      return NextResponse.json({ error: 'Doba pronájmu a minimální množství musí být kladná celá čísla.' }, { status: 400 });
    }
    if (!Number.isFinite(rentalPrice) || rentalPrice < 0 || !Number.isFinite(productionPrice) || productionPrice < 0) {
      return NextResponse.json({ error: 'Ceny musí být platná nezáporná čísla.' }, { status: 400 });
    }
    const totalPrice = rentalPrice + productionPrice;
    
    const validFromDate = body.validFrom ? new Date(body.validFrom) : existing.validFrom;
    if (Number.isNaN(validFromDate.getTime())) return NextResponse.json({ error: 'Neplatné datum zahájení platnosti.' }, { status: 400 });
    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'Příznak aktivity musí být boolean.' }, { status: 400 });
    }
    const isActive = body.isActive !== undefined ? body.isActive : existing.isActive;
    const validTo = body.validTo !== undefined ? (body.validTo ? new Date(body.validTo) : null) : existing.validTo;
    if (validTo && (Number.isNaN(validTo.getTime()) || validTo < validFromDate)) {
      return NextResponse.json({ error: 'Konec platnosti musí být platné datum po začátku platnosti.' }, { status: 400 });
    }

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
        carrierType: carrierType as CarrierType | null,
        mediaType: mediaType as MediaType | null,
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
