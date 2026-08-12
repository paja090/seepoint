import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    prompt: string;
    clientId?: string;
    clientName?: string;
    city?: string;
    budget?: number;
    durationMonths?: number;
  } | null;

  if (!body || !body.prompt) {
    return NextResponse.json({ error: 'Zadejte požadavek na nabídku.' }, { status: 400 });
  }

  try {
    const durationMonths = body.durationMonths || 12;
    const maxBudget = body.budget || 50000;
    const targetCity = body.city?.trim() || '';

    // 1. Resolve or create Client
    let client = null;
    if (body.clientId) {
      client = await prisma.client.findUnique({ where: { id: body.clientId } });
    }

    if (!client && body.clientName) {
      client = await prisma.client.findFirst({
        where: { name: { contains: body.clientName, mode: 'insensitive' } },
      });

      if (!client) {
        client = await prisma.client.create({
          data: {
            name: body.clientName,
            normalizedName: body.clientName.toLowerCase(),
            status: 'LEAD',
          },
        });
      }
    }

    if (!client) {
      client = await prisma.client.findFirst({ orderBy: { createdAt: 'asc' } });
      if (!client) {
        client = await prisma.client.create({
          data: {
            name: 'Poptávající Klient (AI)',
            normalizedName: 'poptavajici klient (ai)',
            status: 'LEAD',
          },
        });
      }
    }

    // 2. Query carriers matching target city / available surfaces
    const availableCarriers = await prisma.advertisingCarrier.findMany({
      where: {
        archivedAt: null,
        surfaces: { some: {} },
        ...(targetCity
          ? {
              OR: [
                { city: { contains: targetCity, mode: 'insensitive' } },
                { address: { contains: targetCity, mode: 'insensitive' } },
                { name: { contains: targetCity, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        surfaces: true,
      },
      take: 20,
    });

    const selectedCarriers = availableCarriers.length > 0
      ? availableCarriers
      : await prisma.advertisingCarrier.findMany({
          where: { archivedAt: null, surfaces: { some: {} } },
          include: { surfaces: true },
          take: 8,
        });

    const targetCarriers = selectedCarriers.slice(0, Math.min(6, selectedCarriers.length));

    // 3. Build Offer Items
    const dateFrom = new Date();
    const dateTo = new Date();
    dateTo.setMonth(dateTo.getMonth() + durationMonths);

    let currentTotal = 0;
    const itemsData = targetCarriers
      .filter((carrier) => carrier.surfaces.length > 0)
      .map((carrier, idx) => {
        const surface = carrier.surfaces[0];
        const monthlyPrice = surface?.price ? Number(surface.price) : 2500;
        const totalItemPrice = monthlyPrice * durationMonths;
        currentTotal += totalItemPrice;

        return {
          surfaceId: surface.id,
          customTitle: `${carrier.name} (${carrier.code})`,
          clientDescription: `Navigační / reklamní plocha: ${carrier.city} – ${carrier.address || 'vynikající viditelnost'}`,
          quantity: durationMonths,
          unit: 'měsíc',
          unitPrice: monthlyPrice,
          price: totalItemPrice,
          dateFrom,
          dateTo,
          sortOrder: idx + 1,
        };
      });

    let discountAmount = 0;
    if (maxBudget > 0 && currentTotal > maxBudget) {
      discountAmount = Math.max(0, currentTotal - maxBudget);
    }

    const finalSubtotal = currentTotal - discountAmount;
    const taxRate = 21;
    const taxAmount = Math.round((finalSubtotal * taxRate) / 100);
    const totalPriceWithTax = finalSubtotal + taxAmount;

    // 4. Generate AI Executive Summary & Client Message
    const publicToken = crypto.randomBytes(16).toString('hex');

    const clientMessage = `Dobrý den,\n\nna základě vašeho zadání ("${body.prompt}") jsme pro vás připravili kompletní nabídku reklamních a navigačních nosičů SeePOINT v lokalitě ${targetCity || 'CZ'}.\n\nNabídka obsahuje ${itemsData.length} vybraných pozic s garancí vysoké viditelnosti a pravidelné fotodokumentace.\n\nS pozdravem,\nTým SeePOINT`;

    // 5. Create Offer DB Record
    const offer = await prisma.offer.create({
      data: {
        clientId: client.id,
        title: `AI Nabídka: ${targetCity ? `Navigace ${targetCity}` : client.name} (${itemsData.length} nosičů)`,
        campaignName: `Kampaň ${new Date().getFullYear()} – ${targetCity || 'CZ'}`,
        budget: maxBudget,
        status: 'DRAFT',
        offerType: 'STANDARD_MEDIA',
        currency: 'CZK',
        clientMessage,
        internalNote: `Vytvořeno pomocí AI Copilota ze zadání: "${body.prompt}"`,
        subtotal: currentTotal,
        discountAmount,
        taxRate,
        taxAmount,
        totalPrice: finalSubtotal,
        totalWithTax: totalPriceWithTax,
        publicTokenHash: publicToken,
        createdByUserId: user.id,
        createdBy: user.name,
      },
    });

    // Create Offer Items
    if (itemsData.length > 0) {
      await prisma.offerItem.createMany({
        data: itemsData.map((item) => ({
          offerId: offer.id,
          surfaceId: item.surfaceId,
          customTitle: item.customTitle,
          clientDescription: item.clientDescription,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          price: item.price,
          dateFrom: item.dateFrom,
          dateTo: item.dateTo,
          sortOrder: item.sortOrder,
        })),
      });
    }

    // Create Audit Event
    await prisma.offerEvent.create({
      data: {
        offerId: offer.id,
        type: 'CREATED',
        message: `AI Copilot vygeneroval novou nabídku se ${itemsData.length} nosiči v hodnotě ${finalSubtotal.toLocaleString('cs-CZ')} Kč.`,
        actorName: user.name,
        actorUserId: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      offerId: offer.id,
      title: offer.title,
      totalPrice: finalSubtotal,
      totalWithTax: totalPriceWithTax,
      itemsCount: itemsData.length,
      redirectUrl: `/offers/${offer.id}`,
      message: `✨ AI úspěšně vygenerovala nabídku (${itemsData.length} nosičů v hodnotě ${finalSubtotal.toLocaleString('cs-CZ')} Kč)!`,
    });
  } catch (err: unknown) {
    console.error('AI Offer generation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chyba při generování nabídky pomocí AI.' },
      { status: 500 }
    );
  }
}
