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
      const performedByName = user.employee
        ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
        : user.name || user.email;

      let savedCount = 0;

      for (const item of body.itemsToSave) {
        const nameClean = String(item.name || '').trim();
        if (!nameClean) continue;

        const qtyToAdd = Number(item.quantityInStock) || 1;
        const category = item.category === 'RETURNABLE' ? 'RETURNABLE' : 'CONSUMABLE';

        const existing = await prisma.warehouseItem.findFirst({
          where: { name: { equals: nameClean, mode: 'insensitive' } },
        });

        if (existing) {
          // Restock existing item instead of creating a duplicate row
          const newQty = Number(existing.quantityInStock) + qtyToAdd;
          await prisma.$transaction([
            prisma.warehouseItem.update({
              where: { id: existing.id },
              data: { quantityInStock: newQty },
            }),
            prisma.warehouseMovement.create({
              data: {
                itemId: existing.id,
                type: 'RECEIPT',
                quantity: qtyToAdd,
                performedByName,
                note: 'AI naskladnění regálu (aktualizace stávající položky)',
              },
            }),
          ]);
        } else {
          // Create new item and log initial RECEIPT movement
          const newItem = await prisma.warehouseItem.create({
            data: {
              name: nameClean,
              category,
              unit: item.unit || 'ks',
              quantityInStock: qtyToAdd,
              minQuantity: item.minQuantity ? Number(item.minQuantity) : 2,
              location: item.location ? String(item.location).trim() : 'Dílna / Regál',
              note: item.note || 'Automaticky naskladněno pomocí AI Fotky regálu',
            },
          });

          await prisma.warehouseMovement.create({
            data: {
              itemId: newItem.id,
              type: 'RECEIPT',
              quantity: qtyToAdd,
              performedByName,
              note: 'AI naskladnění regálu (nová položka)',
            },
          });
        }
        savedCount++;
      }

      return NextResponse.json({
        success: true,
        count: savedCount,
        message: `Úspěšně zpracováno a uloženo ${savedCount} položek v databázi skladu!`,
      });
    }

    // Otherwise photo analysis request
    const { photoBase64, filename } = body;
    if (!photoBase64 && !filename) {
      return NextResponse.json({ error: 'Nahrajte fotku regálu s materiálem.' }, { status: 400 });
    }

    let proposedItems: any[] = [];

    // Call real Gemini Vision AI model
    if (photoBase64) {
      const { analyzeWarehouseItemsFromPhotoWithGemini } = await import('@/lib/ai-gemini');
      const aiItems = await analyzeWarehouseItemsFromPhotoWithGemini(photoBase64);

      if (aiItems.length > 0) {
        proposedItems = aiItems.map((i) => ({
          name: i.name,
          category: i.category,
          unit: i.unit,
          quantityInStock: i.quantity,
          minQuantity: 2,
          location: i.location,
          note: i.note,
        }));
      }
    }

    if (proposedItems.length === 0) {
      return NextResponse.json({
        error: 'AI z fotky nedokázala rozpoznat žádné položky. Zkontrolujte prosím, zda je fotka dostatečně ostrá a osvětlená.',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      proposedItems,
      message: `AI rozpoznala a klasifikovala ${proposedItems.length} nových položek pro uložení do databáze.`,
    });
  } catch (error) {
    console.error('AI import photo error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'AI analýza fotky selhala.',
    }, { status: 500 });
  }
}
