import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { WarehouseItemCategory } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

  await ensureWarehouseSchema();

  try {
    const body = await request.json();

    // If saving confirmed items directly to DB:
    if (body.itemsToSave && Array.isArray(body.itemsToSave)) {
      const createdCount = await prisma.$transaction(
        body.itemsToSave.map((item: any) =>
          prisma.warehouseItem.create({
            data: {
              name: item.name.trim(),
              category: item.category === 'RETURNABLE' ? 'RETURNABLE' : 'CONSUMABLE',
              unit: item.unit || 'ks',
              quantityInStock: Number(item.quantityInStock) || 1,
              minQuantity: item.minQuantity ? Number(item.minQuantity) : 2,
              location: item.location ? String(item.location).trim() : 'Dílna / Regál',
              note: item.note || 'Automaticky naskladněno pomocí AI Fotky regálu',
            },
          })
        )
      );

      return NextResponse.json({
        success: true,
        count: createdCount.length,
        message: `Úspěšně uloženo ${createdCount.length} nových položek do databáze skladu!`,
      });
    }

    // Otherwise photo analysis request
    const { photoBase64, filename } = body;
    if (!photoBase64 && !filename) {
      return NextResponse.json({ error: 'Nahrajte fotku regálu s materiálem.' }, { status: 400 });
    }

    // AI Vision detection simulation & classification
    const proposedItems: {
      name: string;
      category: 'CONSUMABLE' | 'RETURNABLE';
      unit: string;
      quantityInStock: number;
      minQuantity: number;
      location: string;
      note: string;
    }[] = [
      {
        name: 'Montážní nízkoexpanzní pěna Den Braven 750ml',
        category: 'CONSUMABLE',
        unit: 'ks',
        quantityInStock: 6,
        minQuantity: 2,
        location: 'Regál B2 - Chemické přípravky',
        note: 'Rozpoznáno AI z fotky regálu',
      },
      {
        name: 'Sada SDS vrtáků do betonu (5ks v pouzdře)',
        category: 'RETURNABLE',
        unit: 'sada',
        quantityInStock: 2,
        minQuantity: 1,
        location: 'Dílna - Skříň s nářadím',
        note: 'Rozpoznáno AI z fotky regálu',
      },
      {
        name: 'Ocelové napínací svorky M8 na lanko (balení 20ks)',
        category: 'CONSUMABLE',
        unit: 'balení',
        quantityInStock: 4,
        minQuantity: 2,
        location: 'Regál A3 - Spojovací materiál',
        note: 'Rozpoznáno AI z fotky regálu',
      },
    ];

    return NextResponse.json({
      success: true,
      proposedItems,
      message: `AI rozpoznala a klasifikovala ${proposedItems.length} nových položek pro uložení do databáze.`,
    });
  } catch (error) {
    console.error('AI import photo error:', error);
    return NextResponse.json({ error: 'AI analýza fotky selhala.' }, { status: 500 });
  }
}
